import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Poolの定義
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'MyUserPool',
      selfSignUpEnabled: true, // 自己サインアップを有効化
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, // アカウントリカバリーをEメールのみに設定
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にユーザープールも削除
      signInAliases: {
        email: true, // Eメールでサインイン可能
      },
      autoVerify: {
        email: true, // Eメールの自動検証を有効化
      },
    });

    // ユーザープールのEメール設定
    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: 'MyUserPoolClient',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // AppSync GraphQL APIの定義
    const api = new appsync.GraphqlApi(this, 'GraphqlApi', {
      name: 'MyGraphqlApi',
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')), // スキーマの読み込み
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      },
      xrayEnabled: true, // X-Rayトレースを有効化
    });

    // DynamoDBテーブルの定義
    const table = new dynamodb.Table(this, 'UserProfileTable', {
      tableName: 'UserProfile',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にテーブルも削除
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // DynamoDB Streamsを有効化
    });

    // OpenSearch (Elasticsearch) ドメインの定義
    const opensearchDomain = new opensearch.Domain(this, 'UserProfileSearchDomain', {
      version: opensearch.EngineVersion.OPENSEARCH_1_3,
      domainName: 'user-profile-search',
      capacity: {
        dataNodes: 1,
        dataNodeInstanceType: 't3.small.search',
      },
      ebs: {
        volumeSize: 10,
        volumeType: ec2.EbsDeviceVolumeType.GP2,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      accessPolicies: [
        new iam.PolicyStatement({
          principals: [new iam.AnyPrincipal()],
          actions: ['es:*'],
          resources: ['*'],
          conditions: {
            IpAddress: {
              'aws:SourceIp': ['0.0.0.0/0'], // 本番環境では適切に制限してください
            },
          },
        }),
      ],
    });

    // DynamoDBからElasticsearchにデータを同期するLambda関数
    const syncLambda = new lambda.Function(this, 'DynamoToElasticsearchSync', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const elasticsearch = require('elasticsearch');
        
        const client = new elasticsearch.Client({
          host: process.env.ELASTICSEARCH_ENDPOINT,
          connectionClass: require('http-aws-es'),
          amazonES: {
            region: process.env.AWS_REGION,
            credentials: AWS.config.credentials
          }
        });

        exports.handler = async (event) => {
          console.log('DynamoDB Stream event:', JSON.stringify(event, null, 2));
          
          for (const record of event.Records) {
            const { eventName, dynamodb: dbRecord } = record;
            
            if (eventName === 'INSERT' || eventName === 'MODIFY') {
              // DynamoDBの項目をElasticsearchにインデックス
              const item = dbRecord.NewImage;
              const document = {
                id: item.id?.S,
                userId: item.userId?.S,
                fullName: item.fullName?.S,
                department: item.department?.S,
                position: item.position?.S,
                bio: item.bio?.S,
                skills: item.skills?.SS || [],
                hobbies: item.hobbies?.SS || [],
              };
              
              await client.index({
                index: 'user-profiles',
                type: '_doc',
                id: document.id,
                body: document
              });
              
              console.log(\`Indexed document: \${document.id}\`);
              
            } else if (eventName === 'REMOVE') {
              // DynamoDBから削除された項目をElasticsearchからも削除
              const oldItem = dbRecord.OldImage;
              const documentId = oldItem.id?.S;
              
              await client.delete({
                index: 'user-profiles',
                type: '_doc',
                id: documentId
              });
              
              console.log(\`Deleted document: \${documentId}\`);
            }
          }
        };
      `),
      environment: {
        ELASTICSEARCH_ENDPOINT: `https://${opensearchDomain.domainEndpoint}`,
      },
      timeout: cdk.Duration.minutes(5),
    });

    // Lambda関数にElasticsearchへのアクセス権限を付与
    opensearchDomain.grantWrite(syncLambda);
    opensearchDomain.grantRead(syncLambda);

    // DynamoDB StreamsをLambda関数のトリガーとして設定
    syncLambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 10,
      })
    );

    // DynamoDBテーブルをGraphQL APIのデータソースとして追加
    const dataSource = api.addDynamoDbDataSource('UserProfileDataSource', table);

    // 'createUserProfile' ミューテーションに対応するリゾルバを作成
    dataSource.createResolver('CreateUserProfileResolver', {
      typeName: 'Mutation', // GraphQLのMutationタイプ
      fieldName: 'createUserProfile', // ミューテーション名
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition('id').auto(), // パーティションキーを自動生成
        appsync.Values.projecting() // リクエストの値をDynamoDBにマッピング
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(), // 結果をそのまま返す
    });

    // ElasticsearchをHTTPデータソースとして追加
    const elasticsearchDataSource = api.addHttpDataSource('ElasticsearchDataSource', 
      `https://${opensearchDomain.domainEndpoint}`,
      {
        authorizationConfig: {
          signingRegion: this.region,
          signingServiceName: 'es',
        },
      }
    );

    // 検索クエリのリゾルバを作成
    elasticsearchDataSource.createResolver('SearchUserProfilesResolver', {
      typeName: 'Query',
      fieldName: 'searchUserProfiles',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2018-05-29",
          "method": "POST",
          "resourcePath": "/user-profiles/_search",
          "params": {
            "headers": {
              "Content-Type": "application/json"
            },
            "body": {
              "query": {
                "multi_match": {
                  "query": "$ctx.args.keyword",
                  "fields": ["fullName", "department", "position", "bio", "skills", "hobbies"],
                  "type": "best_fields",
                  "fuzziness": "AUTO"
                }
              },
              "size": #if($ctx.args.limit) $ctx.args.limit #else 50 #end,
              "from": #if($ctx.args.offset) $ctx.args.offset #else 0 #end
            }
          }
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        #if($ctx.error)
          $util.error($ctx.error.message, $ctx.error.type)
        #end
        
        #set($hits = $ctx.result.body.hits.hits)
        [
          #foreach($hit in $hits)
            {
              "userId": "$hit._source.userId",
              "fullName": "$hit._source.fullName",
              "department": "$hit._source.department",
              "position": "$hit._source.position",
              "bio": "$hit._source.bio",
              "skills": $util.toJson($hit._source.skills),
              "hobbies": $util.toJson($hit._source.hobbies),
              "score": $hit._score
            }#if($foreach.hasNext),#end
          #end
        ]
      `),
    });

    // ユーザー監査用Lambda関数
    const auditLambda = new lambda.Function(this, 'AuditUsersFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/audit-users')),
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.minutes(5),
    });

    // DynamoDBテーブルへのScan権限を付与
    table.grantReadData(auditLambda);

    // EventBridgeルール：毎日深夜0時(UTC)に実行
    const auditRule = new events.Rule(this, 'AuditUsersScheduleRule', {
      ruleName: 'UserAuditSchedule',
      description: 'Triggers user audit function daily at midnight UTC',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '0',
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    // EventBridgeルールのターゲットとしてLambda関数を設定
    auditRule.addTarget(new targets.LambdaFunction(auditLambda));

    // AppSync APIのエンドポイントを出力
    new cdk.CfnOutput(this, 'GraphqlApiEndpoint', {
      value: api.graphqlUrl,
      description: 'The endpoint of the AppSync GraphQL API',
      exportName: 'GraphqlApiEndpoint',
    });

    // Cognito User Pool IDを出力
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'The ID of the Cognito User Pool',
      exportName: 'UserPoolId',
    });

    // Cognito User Pool Client IDを出力
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'The Client ID of the Cognito User Pool',
      exportName: 'UserPoolClientId',
    });

    // Elasticsearch ドメインエンドポイントを出力
    new cdk.CfnOutput(this, 'ElasticsearchEndpoint', {
      value: opensearchDomain.domainEndpoint,
      description: 'The endpoint of the Elasticsearch domain',
      exportName: 'ElasticsearchEndpoint',
    });
  }
}

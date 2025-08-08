import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// DynamoDBクライアントの初期化
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: any) => {
  try {
    // 環境変数からテーブル名を取得
    const tableName = process.env.TABLE_NAME;
    
    if (!tableName) {
      throw new Error('TABLE_NAME environment variable is not set');
    }

    console.log(`[AUDIT] Starting user count audit for table: ${tableName}`);

    // DynamoDBのScan操作でアイテム総数をカウント
    let totalCount = 0;
    let lastEvaluatedKey: any = undefined;

    do {
      const scanCommand = new ScanCommand({
        TableName: tableName,
        Select: 'COUNT', // カウントのみを取得（データは取得しない）
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const response = await docClient.send(scanCommand);
      
      // カウントを累積
      totalCount += response.Count || 0;
      
      // 次のページがある場合のキーを保存
      lastEvaluatedKey = response.LastEvaluatedKey;
      
      console.log(`[AUDIT] Scanned ${response.Count} items, total so far: ${totalCount}`);
      
    } while (lastEvaluatedKey); // すべてのページをスキャン

    // 最終結果を出力
    console.log(`[AUDIT] Total users: ${totalCount}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'User audit completed successfully',
        totalUsers: totalCount,
        tableName: tableName,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[AUDIT] Error during user count audit:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'User audit failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};

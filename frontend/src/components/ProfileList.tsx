import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

// GraphQL クエリ
const LIST_USER_PROFILES = `
  query ListUserProfiles {
    listMemberProfiles {
      userId
      fullName
      department
      position
      bio
      profileImageUrl
    }
  }
`;

interface UserProfile {
  userId: string;
  fullName: string;
  department?: string;
  position?: string;
  bio?: string;
  profileImageUrl?: string;
}

const ProfileList: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // プロフィール一覧を取得
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await client.graphql({
          query: LIST_USER_PROFILES
        });
        
        const profileList = (result as any).data?.listMemberProfiles || [];
        setProfiles(profileList);
      } catch (error) {
        console.error('プロフィール一覧取得エラー:', error);
        setError('プロフィールの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  // ローディング中の表示
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px' 
      }}>
        <div style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 2s linear infinite'
        }}>
        </div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // エラー時の表示
  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '20px', 
        color: 'red' 
      }}>
        {error}
      </div>
    );
  }

  // プロフィールが空の場合
  if (profiles.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '20px', 
        color: '#666' 
      }}>
        登録されているプロフィールがありません。
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>メンバープロフィール一覧</h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '20px' 
      }}>
        {profiles.map((profile) => (
          <div
            key={profile.userId}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s ease-in-out',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            {/* プロフィール画像（もしあれば） */}
            {profile.profileImageUrl && (
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <img
                  src={profile.profileImageUrl}
                  alt={`${profile.fullName}のプロフィール画像`}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              </div>
            )}
            
            {/* 氏名 */}
            <h3 style={{ 
              margin: '0 0 10px 0', 
              fontSize: '18px', 
              color: '#333' 
            }}>
              {profile.fullName}
            </h3>
            
            {/* 部署 */}
            <p style={{ 
              margin: '0 0 8px 0', 
              color: '#666', 
              fontSize: '14px' 
            }}>
              <strong>部署:</strong> {profile.department || '未設定'}
            </p>
            
            {/* 役職（もしあれば） */}
            {profile.position && (
              <p style={{ 
                margin: '0 0 8px 0', 
                color: '#666', 
                fontSize: '14px' 
              }}>
                <strong>役職:</strong> {profile.position}
              </p>
            )}
            
            {/* 自己紹介（もしあれば） */}
            {profile.bio && (
              <p style={{ 
                margin: '10px 0 0 0', 
                color: '#555', 
                fontSize: '13px',
                lineHeight: '1.4',
                maxHeight: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {profile.bio.length > 100 
                  ? `${profile.bio.substring(0, 100)}...` 
                  : profile.bio
                }
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileList;

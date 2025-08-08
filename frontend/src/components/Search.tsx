import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

// GraphQL 検索クエリ
const SEARCH_USER_PROFILES = `
  query SearchUserProfiles($keyword: String!, $limit: Int, $offset: Int) {
    searchUserProfiles(keyword: $keyword, limit: $limit, offset: $offset) {
      userId
      fullName
      department
      position
      bio
      skills
      hobbies
      score
    }
  }
`;

interface SearchResult {
  userId: string;
  fullName: string;
  department?: string;
  position?: string;
  bio?: string;
  skills?: string[];
  hobbies?: string[];
  score?: number;
}

const Search: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 検索実行
  const handleSearch = async () => {
    if (!keyword.trim()) {
      alert('検索キーワードを入力してください。');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const result = await client.graphql({
        query: SEARCH_USER_PROFILES,
        variables: {
          keyword: keyword.trim(),
          limit: 20,
          offset: 0
        }
      });

      const results = (result as any).data?.searchUserProfiles || [];
      setSearchResults(results);
    } catch (error) {
      console.error('検索エラー:', error);
      setError('検索中にエラーが発生しました。');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Enterキーでの検索実行
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>メンバー検索</h2>
      
      {/* 検索フォーム */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '30px',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="名前、部署、スキルなどを入力してください..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '16px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#007bff'}
          onBlur={(e) => e.target.style.borderColor = '#ddd'}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !keyword.trim()}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: loading || !keyword.trim() ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading || !keyword.trim() ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? '検索中...' : '検索'}
        </button>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #ffcdd2'
        }}>
          {error}
        </div>
      )}

      {/* 検索結果 */}
      {hasSearched && !loading && !error && (
        <div>
          <h3 style={{ marginBottom: '15px' }}>
            検索結果 ({searchResults.length}件)
          </h3>
          
          {searchResults.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#666',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              検索結果がありません。<br />
              別のキーワードで検索してみてください。
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '20px'
            }}>
              {searchResults.map((result) => (
                <div
                  key={result.userId}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '12px',
                    padding: '20px',
                    backgroundColor: '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }}
                >
                  {/* 検索スコア表示 */}
                  {result.score && (
                    <div style={{
                      display: 'inline-block',
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      marginBottom: '10px',
                      fontWeight: 'bold'
                    }}>
                      関連度: {result.score.toFixed(2)}
                    </div>
                  )}
                  
                  {/* 氏名 */}
                  <h4 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    color: '#333',
                    fontWeight: 'bold'
                  }}>
                    {result.fullName}
                  </h4>
                  
                  {/* 部署と役職 */}
                  <div style={{ marginBottom: '12px' }}>
                    {result.department && (
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: '#f5f5f5',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        marginRight: '8px',
                        marginBottom: '4px'
                      }}>
                        📍 {result.department}
                      </span>
                    )}
                    {result.position && (
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: '#f5f5f5',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        marginBottom: '4px'
                      }}>
                        💼 {result.position}
                      </span>
                    )}
                  </div>
                  
                  {/* スキル */}
                  {result.skills && result.skills.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        marginBottom: '4px',
                        fontWeight: 'bold'
                      }}>
                        スキル:
                      </div>
                      <div>
                        {result.skills.slice(0, 3).map((skill, index) => (
                          <span
                            key={index}
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#e8f5e8',
                              color: '#2e7d32',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '12px',
                              marginRight: '4px',
                              marginBottom: '4px'
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                        {result.skills.length > 3 && (
                          <span style={{ fontSize: '12px', color: '#666' }}>
                            +{result.skills.length - 3}件
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* 自己紹介 */}
                  {result.bio && (
                    <div style={{
                      fontSize: '14px',
                      color: '#555',
                      lineHeight: '1.4',
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid #eee'
                    }}>
                      {result.bio.length > 100 
                        ? `${result.bio.substring(0, 100)}...` 
                        : result.bio
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;

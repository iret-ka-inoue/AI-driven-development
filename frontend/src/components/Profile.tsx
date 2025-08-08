import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

// GraphQL クエリとミューテーション
const GET_USER_PROFILE = `
  query GetUserProfile($userId: ID!) {
    getUserProfile(userId: $userId) {
      userId
      fullName
      department
      position
      hobbies
      skills
      bio
      profileImageUrl
    }
  }
`;

const CREATE_USER_PROFILE = `
  mutation CreateUserProfile(
    $userId: ID!
    $fullName: String!
    $department: String
    $bio: String
  ) {
    createUserProfile(
      userId: $userId
      fullName: $fullName
      department: $department
      bio: $bio
    ) {
      userId
      fullName
      department
      bio
    }
  }
`;

const UPDATE_USER_PROFILE = `
  mutation UpdateUserProfile(
    $userId: ID!
    $fullName: String!
    $department: String
    $bio: String
  ) {
    updateUserProfile(
      userId: $userId
      fullName: $fullName
      department: $department
      bio: $bio
    ) {
      userId
      fullName
      department
      bio
    }
  }
`;

interface ProfileProps {
  userId: string;
}

interface ProfileData {
  fullName: string;
  department: string;
  bio: string;
}

const Profile: React.FC<ProfileProps> = ({ userId }) => {
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: '',
    department: '',
    bio: ''
  });
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 既存のプロフィール情報を取得
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const result = await client.graphql({
          query: GET_USER_PROFILE,
          variables: { userId }
        });
        
        const profile = (result as any).data?.getUserProfile;
        if (profile) {
          setExistingProfile(profile);
          setProfileData({
            fullName: profile.fullName || '',
            department: profile.department || '',
            bio: profile.bio || ''
          });
        }
      } catch (error) {
        console.error('プロフィール取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  // フォームの入力値を更新
  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // プロフィールを保存
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const variables = {
        userId,
        fullName: profileData.fullName,
        department: profileData.department,
        bio: profileData.bio
      };

      if (existingProfile) {
        // 既存プロフィールを更新
        await client.graphql({
          query: UPDATE_USER_PROFILE,
          variables
        });
        console.log('プロフィールを更新しました');
      } else {
        // 新規プロフィールを作成
        await client.graphql({
          query: CREATE_USER_PROFILE,
          variables
        });
        console.log('プロフィールを作成しました');
      }
      
      alert('プロフィールを保存しました！');
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>プロフィール編集</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="fullName" style={{ display: 'block', marginBottom: '5px' }}>
          氏名 *
        </label>
        <input
          id="fullName"
          type="text"
          value={profileData.fullName}
          onChange={(e) => handleInputChange('fullName', e.target.value)}
          style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          required
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="department" style={{ display: 'block', marginBottom: '5px' }}>
          部署
        </label>
        <input
          id="department"
          type="text"
          value={profileData.department}
          onChange={(e) => handleInputChange('department', e.target.value)}
          style={{ width: '100%', padding: '8px', fontSize: '16px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="bio" style={{ display: 'block', marginBottom: '5px' }}>
          自己紹介
        </label>
        <textarea
          id="bio"
          value={profileData.bio}
          onChange={(e) => handleInputChange('bio', e.target.value)}
          style={{ width: '100%', padding: '8px', fontSize: '16px', minHeight: '100px' }}
          rows={4}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !profileData.fullName}
        style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '10px 20px',
          fontSize: '16px',
          border: 'none',
          borderRadius: '4px',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving || !profileData.fullName ? 0.6 : 1
        }}
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  );
};

export default Profile;

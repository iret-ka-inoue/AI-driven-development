export const CREATE_USER_PROFILE = `
  mutation CreateUserProfile(
    $userId: ID!
    $fullName: String!
    $department: String
    $position: String
    $hobbies: [String]
    $skills: [String]
    $bio: String
    $profileImageUrl: String
  ) {
    createUserProfile(
      userId: $userId
      fullName: $fullName
      department: $department
      position: $position
      hobbies: $hobbies
      skills: $skills
      bio: $bio
      profileImageUrl: $profileImageUrl
    ) {
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

export const UPDATE_MY_PROFILE = `
  mutation UpdateMyProfile(
    $fullName: String!
    $department: String
    $position: String
    $hobbies: [String]
    $skills: [String]
    $bio: String
    $profileImageUrl: String
  ) {
    updateMyProfile(
      fullName: $fullName
      department: $department
      position: $position
      hobbies: $hobbies
      skills: $skills
      bio: $bio
      profileImageUrl: $profileImageUrl
    ) {
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

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_ID: '@fittraxx_user_id',
  USER_PROFILE: '@fittraxx_user_profile',
  ONBOARDING_COMPLETE: '@fittraxx_onboarding',
};

export const storage = {
  // User ID
  saveUserId: async (userId: string) => {
    await AsyncStorage.setItem(KEYS.USER_ID, userId);
  },
  getUserId: async (): Promise<string | null> => {
    return await AsyncStorage.getItem(KEYS.USER_ID);
  },
  
  // User Profile
  saveUserProfile: async (profile: any) => {
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
  },
  getUserProfile: async (): Promise<any | null> => {
    const profile = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    return profile ? JSON.parse(profile) : null;
  },
  
  // Onboarding
  setOnboardingComplete: async () => {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, 'true');
  },
  isOnboardingComplete: async (): Promise<boolean> => {
    const complete = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return complete === 'true';
  },
  
  // Clear all data
  clearAll: async () => {
    await AsyncStorage.clear();
  },
};

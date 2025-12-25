import { create } from 'zustand';

interface UserProfile {
  user_id: string;
  name: string;
  age: number;
  gender: string;
  height_feet: number;
  height_inches: number;
  weight: number;
  goal_weight: number;
  activity_level: string;
  daily_calorie_goal?: number;
}

interface UserStore {
  userId: string | null;
  profile: UserProfile | null;
  isLoading: boolean;
  setUserId: (userId: string) => void;
  setProfile: (profile: UserProfile) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  userId: null,
  profile: null,
  isLoading: false,
  setUserId: (userId) => set({ userId }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ userId: null, profile: null }),
}));

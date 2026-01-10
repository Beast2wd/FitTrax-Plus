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
  custom_calorie_goal?: number;
}

interface TosAcceptance {
  accepted: boolean;
  acceptedAt: string;
  version: string;
}

interface UserStore {
  userId: string | null;
  profile: UserProfile | null;
  tosAccepted: TosAcceptance | null;
  isLoading: boolean;
  setUserId: (userId: string) => void;
  setProfile: (profile: UserProfile) => void;
  setTosAccepted: (tos: TosAcceptance) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  userId: null,
  profile: null,
  tosAccepted: null,
  isLoading: false,
  setUserId: (userId) => set({ userId }),
  setProfile: (profile) => set({ profile }),
  setTosAccepted: (tosAccepted) => set({ tosAccepted }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ userId: null, profile: null, tosAccepted: null }),
}));

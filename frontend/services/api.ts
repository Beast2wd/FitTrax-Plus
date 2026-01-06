import axios from 'axios';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// User Profile APIs
export const userAPI = {
  createOrUpdateProfile: async (profileData: any) => {
    const response = await api.post('/user/profile', profileData);
    return response.data;
  },
  getProfile: async (userId: string) => {
    const response = await api.get(`/user/profile/${userId}`);
    return response.data;
  },
};

// Food/Meal APIs
export const foodAPI = {
  analyzeFood: async (data: { user_id: string; image_base64: string; meal_category: string }) => {
    const response = await api.post('/analyze-food', data);
    return response.data;
  },
  getMeals: async (userId: string, days: number = 7) => {
    const response = await api.get(`/meals/${userId}?days=${days}`);
    return response.data;
  },
  deleteMeal: async (mealId: string) => {
    const response = await api.delete(`/meals/${mealId}`);
    return response.data;
  },
  updateMeal: async (mealId: string, data: { calories: number; protein: number; carbs: number; fat: number }) => {
    const response = await api.put(`/meals/${mealId}`, data);
    return response.data;
  },
};

// Workout APIs
export const workoutAPI = {
  addWorkout: async (workoutData: any) => {
    const response = await api.post('/workouts', workoutData);
    return response.data;
  },
  getWorkouts: async (userId: string, days: number = 7) => {
    const response = await api.get(`/workouts/${userId}?days=${days}`);
    return response.data;
  },
  deleteWorkout: async (workoutId: string) => {
    const response = await api.delete(`/workouts/${workoutId}`);
    return response.data;
  },
};

// Water APIs
export const waterAPI = {
  addWater: async (waterData: any) => {
    const response = await api.post('/water', waterData);
    return response.data;
  },
  getWaterIntake: async (userId: string, days: number = 7) => {
    const response = await api.get(`/water/${userId}?days=${days}`);
    return response.data;
  },
};

// Heart Rate APIs
export const heartRateAPI = {
  addHeartRate: async (hrData: any) => {
    const response = await api.post('/heart-rate', hrData);
    return response.data;
  },
  getHeartRate: async (userId: string, days: number = 7) => {
    const response = await api.get(`/heart-rate/${userId}?days=${days}`);
    return response.data;
  },
  getHeartRateZones: async (userId: string) => {
    const response = await api.get(`/heart-rate/zones/${userId}`);
    return response.data;
  },
};

// Workout Plans APIs
export const plansAPI = {
  getWorkoutPlans: async (filters?: { level?: string; goal?: string; type?: string }) => {
    const params = new URLSearchParams(filters as any).toString();
    const response = await api.get(`/workout-plans?${params}`);
    return response.data;
  },
  getWorkoutPlan: async (planId: string) => {
    const response = await api.get(`/workout-plans/${planId}`);
    return response.data;
  },
  startPlan: async (userPlanData: any) => {
    const response = await api.post('/user-plans', userPlanData);
    return response.data;
  },
  getUserPlans: async (userId: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/user-plans/${userId}${params}`);
    return response.data;
  },
  updateUserPlan: async (userPlanId: string, updateData: any) => {
    const params = new URLSearchParams(updateData).toString();
    const response = await api.put(`/user-plans/${userPlanId}?${params}`);
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getDashboard: async (userId: string) => {
    const response = await api.get(`/dashboard/${userId}`);
    return response.data;
  },
};

export default api;

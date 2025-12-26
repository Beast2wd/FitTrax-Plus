import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { storage } from '../services/storage';

export default function RootLayout() {
  const { setUserId, setProfile } = useUserStore();

  useEffect(() => {
    // Load user data on app start
    const loadUserData = async () => {
      const userId = await storage.getUserId();
      const profile = await storage.getUserProfile();
      if (userId) setUserId(userId);
      if (profile) setProfile(profile);
    };
    loadUserData();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background.page,
        },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="heart-rate"
        options={{
          title: 'Heart Rate',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="running"
        options={{
          title: 'Running Tracker',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="schedule"
        options={{
          title: 'Workout Schedule',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="meals-history"
        options={{
          title: 'Meal History',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="membership"
        options={{
          title: 'Premium Membership',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="badges"
        options={{
          title: 'Badges & Achievements',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}

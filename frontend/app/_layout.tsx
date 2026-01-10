import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '../stores/userStore';
import { useThemeStore } from '../stores/themeStore';
import { storage, getTosAcceptance } from '../services/storage';
import { CustomSplashScreen } from '../components/CustomSplashScreen';
import '../services/i18n'; // Initialize i18n

export default function RootLayout() {
  const { setUserId, setProfile, setTosAccepted } = useUserStore();
  const { theme } = useThemeStore();
  const [showSplash, setShowSplash] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const colors = theme.colors;

  useEffect(() => {
    // Load user data on app start
    const loadUserData = async () => {
      try {
        const userId = await storage.getUserId();
        const profile = await storage.getUserProfile();
        const tosAcceptance = await getTosAcceptance();
        
        if (userId) setUserId(userId);
        if (profile) setProfile(profile);
        if (tosAcceptance) setTosAccepted(tosAcceptance);
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsReady(true);
      }
    };
    loadUserData();
  }, []);

  // Show splash screen on app load
  if (showSplash) {
    return (
      <>
        <StatusBar style="light" />
        <CustomSplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background.secondary,
          },
          headerTintColor: colors.text.primary,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerBackTitleVisible: false,
          contentStyle: {
            backgroundColor: colors.background.primary,
          },
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
            title: 'Premium',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="badges"
          options={{
            title: 'Rewards',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="ai-workouts"
          options={{
            title: 'AI Workouts',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="weight-training"
          options={{
            title: 'Weight Training',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="progress"
          options={{
            title: 'Progress',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="wearables"
          options={{
            title: 'Health & Wearables',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="peptides"
          options={{
            title: 'Peptide Calculator',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="body-scan"
          options={{
            title: 'Body Scan',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="terms-of-service"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
      </Stack>
    </>
  );
}

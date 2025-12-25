import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { storage } from '../services/storage';

export default function TabLayout() {
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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarStyle: {
          backgroundColor: Colors.background.page,
          borderTopWidth: 1,
          borderTopColor: Colors.border.light,
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: Colors.background.page,
        },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 20,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="fitness-center" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

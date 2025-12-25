import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { dashboardAPI, waterAPI, workoutAPI } from '../services/api';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const { userId, profile } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);

  const loadDashboard = async () => {
    try {
      if (!userId) return;
      const data = await dashboardAPI.getDashboard(userId);
      setDashboardData(data);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadDashboard();
    }
  }, [userId]);

  // If no profile exists, show onboarding message without navigation
  if (!userId || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Welcome to FitTraxx! 🏃‍♀️</Text>
          <Text style={styles.subtitle}>
            Let's set up your profile to get started with your fitness journey.
          </Text>
          <Text style={styles.subtitle}>
            Please go to the Profile tab to create your account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const addWater = async (amount: number) => {
    try {
      await waterAPI.addWater({
        water_id: `water_${Date.now()}`,
        user_id: userId!,
        amount,
        timestamp: new Date().toISOString(),
      });
      loadDashboard();
    } catch (error) {
      Alert.alert('Error', 'Failed to add water');
    }
  };

  const addWater = async (amount: number) => {
    try {
      await waterAPI.addWater({
        water_id: `water_${Date.now()}`,
        user_id: userId!,
        amount,
        timestamp: new Date().toISOString(),
      });
      loadDashboard();
    } catch (error) {
      Alert.alert('Error', 'Failed to add water');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No data available</Text>
          <TouchableOpacity style={styles.button} onPress={loadDashboard}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const today = dashboardData.today || {};
  const caloriesRemaining = today.calories_goal - today.net_calories;
  const progressPercentage = Math.min(
    (today.net_calories / today.calories_goal) * 100,
    100
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Welcome Section */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {profile?.name || 'User'}! 👋</Text>
          <Text style={styles.date}>{new Date().toDateString()}</Text>
        </View>

        {/* Calorie Goal Card */}
        <View style={styles.calorieCard}>
          <Text style={styles.cardTitle}>Daily Calorie Goal</Text>
          <View style={styles.calorieRow}>
            <View>
              <Text style={styles.calorieValue}>
                {Math.round(today.net_calories || 0)}
              </Text>
              <Text style={styles.calorieLabel}>Consumed</Text>
            </View>
            <View style={styles.calorieDivider} />
            <View>
              <Text style={styles.calorieValue}>
                {Math.round(today.calories_burned || 0)}
              </Text>
              <Text style={styles.calorieLabel}>Burned</Text>
            </View>
            <View style={styles.calorieDivider} />
            <View>
              <Text style={[styles.calorieValue, caloriesRemaining < 0 && styles.calorieOver]}>
                {Math.round(Math.abs(caloriesRemaining))}
              </Text>
              <Text style={styles.calorieLabel}>
                {caloriesRemaining >= 0 ? 'Remaining' : 'Over'}
              </Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progressPercentage}%` },
                progressPercentage > 100 && { backgroundColor: Colors.status.error }
              ]} 
            />
          </View>
        </View>

        {/* Today's Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="fast-food" size={32} color={Colors.brand.primary} />
            <Text style={styles.statValue}>{today.meals_count || 0}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
            <MaterialIcons name="fitness-center" size={32} color={Colors.status.success} />
            <Text style={styles.statValue}>{today.workouts_count || 0}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="water" size={32} color="#0EA5E9" />
            <Text style={styles.statValue}>{Math.round(today.water_intake || 0)}</Text>
            <Text style={styles.statLabel}>oz Water</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#FEF2F2' }]}>
            <MaterialIcons name="favorite" size={32} color={Colors.status.error} />
            <Text style={styles.statValue}>{Math.round(today.avg_heart_rate || 0)}</Text>
            <Text style={styles.statLabel}>Avg BPM</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/scan')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="camera" size={24} color={Colors.brand.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Scan Food</Text>
              <Text style={styles.actionSubtitle}>AI-powered nutrition analysis</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/plans')}
          >
            <View style={styles.actionIcon}>
              <MaterialIcons name="fitness-center" size={24} color={Colors.status.success} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Browse Workout Plans</Text>
              <Text style={styles.actionSubtitle}>Find your perfect program</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Water Tracking */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log Water</Text>
          <View style={styles.waterButtons}>
            {[8, 16, 24, 32].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.waterButton}
                onPress={() => addWater(amount)}
              >
                <Ionicons name="water" size={20} color={Colors.brand.primary} />
                <Text style={styles.waterButtonText}>{amount} oz</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Macros */}
        {today.meals_count > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Macros</Text>
            <View style={styles.macrosCard}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(today.protein || 0)}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(today.carbs || 0)}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(today.fat || 0)}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  calorieCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  calorieValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.brand.primary,
    textAlign: 'center',
  },
  calorieOver: {
    color: Colors.status.error,
  },
  calorieLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  calorieDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border.light,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.background.light,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.primary,
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  actionSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  waterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  waterButton: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  waterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 4,
  },
  macrosCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  macroLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  button: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  buttonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 24,
  },
});

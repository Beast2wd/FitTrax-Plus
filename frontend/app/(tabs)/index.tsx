import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../stores/userStore';
import { dashboardAPI, waterAPI, workoutAPI } from '../../services/api';
import { router } from 'expo-router';
import FitTraxLogo from '../../components/FitTraxLogo';
import { LinearGradient } from 'expo-linear-gradient';
import { AchievementModal } from '../../components/AchievementModal';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { userId, profile } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [streakData, setStreakData] = useState<any>(null);
  const [achievementModal, setAchievementModal] = useState<any>({ visible: false, achievement: null });
  const [pendingAchievements, setPendingAchievements] = useState<any[]>([]);

  const loadDashboard = async () => {
    try {
      if (!userId) return;
      const data = await dashboardAPI.getDashboard(userId);
      setDashboardData(data);
      
      // Also sync gamification progress
      await syncGamification();
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const syncGamification = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Get streak data
      const streakResponse = await axios.get(`${API_URL}/api/gamification/streak/${userId}`);
      setStreakData(streakResponse.data);
      
      // Sync progress and check for new achievements
      const syncResponse = await axios.post(`${API_URL}/api/gamification/sync-progress/${userId}`);
      
      // If there are new badges, queue them for display
      if (syncResponse.data.new_badges && syncResponse.data.new_badges.length > 0) {
        const newAchievements = syncResponse.data.new_badges.map((badge: any) => ({
          type: 'badge',
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          points: badge.points,
        }));
        setPendingAchievements(prev => [...prev, ...newAchievements]);
      }
    } catch (error) {
      console.error('Error syncing gamification:', error);
    }
  }, [userId]);

  // Show pending achievements one by one
  useEffect(() => {
    if (pendingAchievements.length > 0 && !achievementModal.visible) {
      const nextAchievement = pendingAchievements[0];
      setAchievementModal({ visible: true, achievement: nextAchievement });
      setPendingAchievements(prev => prev.slice(1));
    }
  }, [pendingAchievements, achievementModal.visible]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getMotivationalMessage = () => {
    if (streakData?.current_streak >= 7) {
      return `${streakData.current_streak} day streak! 🔥 Incredible!`;
    } else if (streakData?.current_streak >= 3) {
      return `${streakData.current_streak} day streak! Keep it up! 💪`;
    }
    const messages = [
      "You're crushing it today! 💪",
      "Every step counts! 🚀",
      "Stay strong and focused! ⚡",
      "Your progress is inspiring! 🌟",
      "Keep pushing forward! 🏆",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
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
          <Text style={styles.title}>Welcome to FitTrax! 🏃‍♀️</Text>
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
        {/* Enhanced Header with Gradient */}
        <View style={styles.headerCard}>
          <View style={styles.logoContainer}>
            <FitTraxLogo size="small" showText={false} />
          </View>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>
              {getGreeting()}, {profile?.name || 'User'}! 👋
            </Text>
            <Text style={styles.motivationText}>{getMotivationalMessage()}</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}</Text>
          </View>
        </View>

        {/* Streak Card */}
        {streakData && (
          <TouchableOpacity 
            style={styles.streakCard} 
            onPress={() => router.push('/badges')}
          >
            <LinearGradient
              colors={streakData.current_streak >= 7 ? ['#EF4444', '#EC4899'] : ['#F59E0B', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.streakGradient}
            >
              <View style={styles.streakContent}>
                <View style={styles.streakIconContainer}>
                  <Text style={styles.streakIcon}>🔥</Text>
                </View>
                <View style={styles.streakInfo}>
                  <Text style={styles.streakNumber}>{streakData.current_streak}</Text>
                  <Text style={styles.streakLabel}>Day Streak</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakInfo}>
                  <Text style={styles.streakNumber}>{streakData.longest_streak}</Text>
                  <Text style={styles.streakLabel}>Best Streak</Text>
                </View>
              </View>
              {streakData.current_streak > 0 && (
                <Text style={styles.streakMessage}>
                  {streakData.streak_active_today ? "Keep it going today!" : "Don't break the chain! 💪"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Enhanced Calorie Goal Card with Gradient */}
        <View style={styles.calorieCardWrapper}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.calorieGradient}
          >
            <View style={styles.calorieHeader}>
              <Ionicons name="flame" size={28} color="#fff" />
              <Text style={styles.calorieTitle}>Today's Calorie Goal</Text>
            </View>
            
            <View style={styles.calorieStatsRow}>
              <View style={styles.calorieStatItem}>
                <Text style={styles.calorieStatValue}>
                  {Math.round(today.calories_consumed || 0)}
                </Text>
                <Text style={styles.calorieStatLabel}>Consumed</Text>
              </View>
              <View style={styles.calorieDivider} />
              <View style={styles.calorieStatItem}>
                <Text style={styles.calorieStatValue}>
                  {Math.round(today.calories_burned || 0)}
                </Text>
                <Text style={styles.calorieStatLabel}>Burned</Text>
              </View>
              <View style={styles.calorieDivider} />
              <View style={styles.calorieStatItem}>
                <Text style={[styles.calorieStatValue, caloriesRemaining < 0 && styles.calorieOver]}>
                  {Math.round(Math.abs(caloriesRemaining))}
                </Text>
                <Text style={styles.calorieStatLabel}>
                  {caloriesRemaining >= 0 ? 'Remaining' : 'Over'}
                </Text>
              </View>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${progressPercentage}%` },
                    progressPercentage > 100 && { backgroundColor: '#ef4444' }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progressPercentage)}% of goal
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Today's Stats Grid with Colors */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>
          <View style={styles.statsGrid}>
            <TouchableOpacity 
              style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}
              onPress={() => router.push('/meals-history')}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#3B82F6' }]}>
                <Ionicons name="fast-food" size={24} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>
                {today.meals_count || 0}
              </Text>
              <Text style={styles.statLabel}>Meals</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}
              onPress={() => router.push('/plans')}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#10B981' }]}>
                <MaterialIcons name="fitness-center" size={24} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                {today.workouts_count || 0}
              </Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#0EA5E9' }]}>
                <Ionicons name="water" size={24} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: '#0EA5E9' }]}>
                {Math.round(today.water_intake || 0)}
              </Text>
              <Text style={styles.statLabel}>oz Water</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statCard, { backgroundColor: '#FEF2F2' }]}
              onPress={() => router.push('/heart-rate')}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#EF4444' }]}>
                <MaterialIcons name="favorite" size={24} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>
                {Math.round(today.avg_heart_rate || 0)}
              </Text>
              <Text style={styles.statLabel}>Avg BPM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Water Tracking Section */}
        <View style={styles.waterSection}>
          <View style={styles.waterHeader}>
            <Ionicons name="water" size={24} color="#0EA5E9" />
            <Text style={styles.waterTitle}>Quick Log Water</Text>
          </View>
          <View style={styles.waterButtons}>
            {[8, 16, 24, 32].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.waterButton}
                onPress={() => addWater(amount)}
              >
                <Ionicons name="water" size={20} color="#0EA5E9" />
                <Text style={styles.waterButtonText}>{amount} oz</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Macros Section */}
        {today.meals_count > 0 && (
          <View style={styles.macrosSection}>
            <Text style={styles.sectionTitle}>Today's Nutrition</Text>
            <View style={styles.macrosCard}>
              <View style={styles.macroItem}>
                <View style={[styles.macroCircle, { backgroundColor: '#3B82F6' }]}>
                  <MaterialIcons name="fitness-center" size={20} color="#fff" />
                </View>
                <Text style={styles.macroValue}>{Math.round(today.protein || 0)}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroCircle, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="pizza" size={20} color="#fff" />
                </View>
                <Text style={styles.macroValue}>{Math.round(today.carbs || 0)}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroCircle, { backgroundColor: '#8B5CF6' }]}>
                  <Ionicons name="nutrition" size={20} color="#fff" />
                </View>
                <Text style={styles.macroValue}>{Math.round(today.fat || 0)}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#3B82F6', borderLeftWidth: 4 }]}
            onPress={() => router.push('/scan')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="camera" size={24} color="#3B82F6" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Scan Food</Text>
              <Text style={styles.actionSubtitle}>AI-powered nutrition analysis</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}
            onPress={() => router.push('/plans')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
              <MaterialIcons name="fitness-center" size={24} color="#10B981" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Browse Workout Plans</Text>
              <Text style={styles.actionSubtitle}>Find your perfect program</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}
            onPress={() => router.push('/heart-rate')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
              <MaterialIcons name="favorite" size={24} color="#EF4444" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Heart Rate Tracking</Text>
              <Text style={styles.actionSubtitle}>Monitor your heart health</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#F59E0B', borderLeftWidth: 4 }]}
            onPress={() => router.push('/schedule')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="calendar" size={24} color="#F59E0B" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Workout Schedule</Text>
              <Text style={styles.actionSubtitle}>Plan and track workouts</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#8B5CF6', borderLeftWidth: 4 }]}
            onPress={() => router.push('/body-scan')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="body" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Body Scan</Text>
              <Text style={styles.actionSubtitle}>AI workout from your body</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#3B82F6', borderLeftWidth: 4 }]}
            onPress={() => router.push('/analytics')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="stats-chart" size={24} color="#3B82F6" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Analytics & Insights</Text>
              <Text style={styles.actionSubtitle}>Track your progress</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#EC4899', borderLeftWidth: 4 }]}
            onPress={() => router.push('/running')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FCE7F3' }]}>
              <Ionicons name="footsteps" size={24} color="#EC4899" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Running Tracker</Text>
              <Text style={styles.actionSubtitle}>Track distance with GPS</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#7C3AED', borderLeftWidth: 4 }]}
            onPress={() => router.push('/weight-training')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="barbell" size={24} color="#7C3AED" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Weight Training</Text>
              <Text style={styles.actionSubtitle}>Log sets, reps & track PRs</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}
            onPress={() => router.push('/wearables')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="watch" size={24} color="#10B981" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Health & Wearables</Text>
              <Text style={styles.actionSubtitle}>Sync Apple Health & Google Fit</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#6366F1', borderLeftWidth: 4 }]}
            onPress={() => router.push('/peptides')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="flask" size={24} color="#6366F1" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Peptide Calculator</Text>
              <Text style={styles.actionSubtitle}>Reconstitution, logging & AI insights</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}
            onPress={() => router.push('/badges')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trophy" size={24} color="#EF4444" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Rewards & Challenges</Text>
              <Text style={styles.actionSubtitle}>Earn badges, complete challenges</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Premium Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Features</Text>
          
          <TouchableOpacity 
            onPress={() => router.push('/membership')}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumBanner}
            >
              <View style={styles.premiumContent}>
                <Ionicons name="diamond" size={32} color="#fff" />
                <View style={styles.premiumText}>
                  <Text style={styles.premiumTitle}>FitTrax Premium</Text>
                  <Text style={styles.premiumSubtitle}>
                    AI Workouts • Badges • Meal Planning
                  </Text>
                </View>
              </View>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>3-Day Free Trial</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.premiumFeatures}>
            <TouchableOpacity 
              style={styles.premiumFeatureCard}
              onPress={() => router.push('/badges')}
            >
              <View style={[styles.premiumFeatureIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="trophy" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.premiumFeatureTitle}>Badges</Text>
              <Text style={styles.premiumFeatureSubtitle}>Earn rewards</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.premiumFeatureCard}
              onPress={() => router.push('/ai-workouts')}
            >
              <View style={[styles.premiumFeatureIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="barbell" size={28} color="#3B82F6" />
              </View>
              <Text style={styles.premiumFeatureTitle}>AI Workouts</Text>
              <Text style={styles.premiumFeatureSubtitle}>Personalized</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.premiumFeatureCard}
              onPress={() => router.push('/membership')}
            >
              <View style={[styles.premiumFeatureIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="nutrition" size={28} color="#10B981" />
              </View>
              <Text style={styles.premiumFeatureTitle}>Meal Plans</Text>
              <Text style={styles.premiumFeatureSubtitle}>Nutrition AI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.section}>
          <TouchableOpacity onPress={() => router.push('/progress')}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressBanner}
            >
              <View style={styles.progressContent}>
                <Ionicons name="analytics" size={32} color="#fff" />
                <View style={styles.progressText}>
                  <Text style={styles.progressTitle}>View Progress</Text>
                  <Text style={styles.progressSubtitle}>
                    Charts • Goals • Body Measurements
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  
  // Enhanced Header Styles
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoContainer: {
    marginRight: 16,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  motivationText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Enhanced Calorie Card Styles
  calorieCardWrapper: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  calorieGradient: {
    padding: 24,
  },
  calorieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  calorieTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
  },
  calorieStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  calorieStatItem: {
    alignItems: 'center',
  },
  calorieStatValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  calorieStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  calorieDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  calorieOver: {
    color: '#fef2f2',
  },
  progressBarContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },

  // Enhanced Stats Section
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Water Section
  waterSection: {
    marginBottom: 24,
  },
  waterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  waterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 8,
  },
  waterButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  waterButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  waterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },

  // Macros Section
  macrosSection: {
    marginBottom: 24,
  },
  macrosCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },

  // Actions Section
  actionsSection: {
    marginBottom: 24,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Legacy styles for compatibility
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
  
  // Premium Section Styles
  premiumBanner: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  premiumText: {
    marginLeft: 16,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  premiumBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  premiumBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  premiumFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  premiumFeatureCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  premiumFeatureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  premiumFeatureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  premiumFeatureSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  
  // Progress Banner Styles
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  progressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  progressText: {},
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  progressSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
});

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
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { dashboardAPI, waterAPI } from '../../services/api';
import { router } from 'expo-router';
import FitTraxLogo from '../../components/FitTraxLogo';
import { LinearGradient } from 'expo-linear-gradient';
import { AchievementModal } from '../../components/AchievementModal';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { userId, profile } = useUserStore();
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [streakData, setStreakData] = useState<any>(null);
  const [achievementModal, setAchievementModal] = useState<any>({ visible: false, achievement: null });
  const [pendingAchievements, setPendingAchievements] = useState<any[]>([]);

  const colors = theme.colors;
  const accent = theme.accentColors;

  const loadDashboard = async () => {
    try {
      if (!userId) return;
      const data = await dashboardAPI.getDashboard(userId);
      setDashboardData(data);
      await syncGamification();
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const syncGamification = useCallback(async () => {
    if (!userId) return;
    try {
      const streakResponse = await axios.get(`${API_URL}/api/gamification/streak/${userId}`);
      setStreakData(streakResponse.data);
      
      const syncResponse = await axios.post(`${API_URL}/api/gamification/sync-progress/${userId}`);
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

  useEffect(() => {
    if (pendingAchievements.length > 0 && !achievementModal.visible) {
      const nextAchievement = pendingAchievements[0];
      setAchievementModal({ visible: true, achievement: nextAchievement });
      setPendingAchievements(prev => prev.slice(1));
    }
  }, [pendingAchievements, achievementModal.visible]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning');
    if (hour < 17) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  const getMotivationalMessage = () => {
    if (streakData?.current_streak >= 7) {
      return `${streakData.current_streak} ${t('dashboard.dayStreak')}! 🔥`;
    } else if (streakData?.current_streak >= 3) {
      return `${streakData.current_streak} ${t('dashboard.dayStreak')}! 💪`;
    }
    const messages = [t('dashboard.keepItGoing'), t('dashboard.dontBreakChain')];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  useEffect(() => {
    if (userId) {
      loadDashboard();
    } else {
      setLoading(false);
    }
  }, [userId]);

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

  // Onboarding view
  if (!userId || !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <FitTraxLogo size="xlarge" showText={true} />
          <Text style={[styles.welcomeText, { color: colors.text.primary }]}>
            {t('dashboard.welcome')}
          </Text>
          <Text style={[styles.welcomeSubtext, { color: colors.text.secondary }]}>
            {t('dashboard.createProfile')}
          </Text>
          <TouchableOpacity 
            style={[styles.ctaButton, { backgroundColor: accent.primary }]}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.ctaButtonText}>{t('dashboard.getStarted')}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const today = dashboardData?.today || {};
  const caloriesRemaining = (today.calories_goal || 2000) - (today.net_calories || 0);
  const progressPercentage = Math.min(((today.net_calories || 0) / (today.calories_goal || 2000)) * 100, 100);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={accent.primary}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background.secondary }]}>
          <View style={styles.headerLeft}>
            <FitTraxLogo size="small" showText={false} />
          </View>
          <View style={styles.headerCenter}>
            <Text style={[styles.greeting, { color: colors.text.primary }]}>
              {getGreeting()}, {profile?.name?.split(' ')[0]}
            </Text>
            <Text style={[styles.motivation, { color: accent.primary }]}>
              {getMotivationalMessage()}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.headerRight, { backgroundColor: colors.background.card }]}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person" size={20} color={accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Streak Card */}
        {streakData && streakData.current_streak > 0 && (
          <TouchableOpacity onPress={() => router.push('/badges')}>
            <LinearGradient
              colors={accent.gradient as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.streakCard}
            >
              <View style={styles.streakContent}>
                <Text style={styles.streakIcon}>🔥</Text>
                <View style={styles.streakInfo}>
                  <Text style={styles.streakNumber}>{streakData.current_streak}</Text>
                  <Text style={styles.streakLabel}>Day Streak</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakInfo}>
                  <Text style={styles.streakNumber}>{streakData.longest_streak}</Text>
                  <Text style={styles.streakLabel}>Best</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Calorie Progress */}
        <View style={[styles.calorieCard, { backgroundColor: colors.background.card }]}>
          <View style={styles.calorieHeader}>
            <View style={styles.calorieHeaderLeft}>
              <Ionicons name="flame" size={24} color={accent.primary} />
              <Text style={[styles.calorieTitle, { color: colors.text.primary }]}>
                {t('dashboard.todaysCalories')}
              </Text>
            </View>
            <Text style={[styles.calorieGoal, { color: colors.text.muted }]}>
              {t('dashboard.goal')}: {today.calories_goal || 2000}
            </Text>
          </View>
          
          <View style={styles.calorieStats}>
            <View style={styles.calorieStat}>
              <Text style={[styles.calorieStatValue, { color: colors.text.primary }]}>
                {Math.round(today.calories_consumed || 0)}
              </Text>
              <Text style={[styles.calorieStatLabel, { color: colors.text.muted }]}>{t('dashboard.eaten')}</Text>
            </View>
            <View style={[styles.calorieStatDivider, { backgroundColor: colors.border.primary }]} />
            <View style={styles.calorieStat}>
              <Text style={[styles.calorieStatValue, { color: '#22C55E' }]}>
                {Math.round(today.calories_burned || 0)}
              </Text>
              <Text style={[styles.calorieStatLabel, { color: colors.text.muted }]}>{t('dashboard.burned')}</Text>
            </View>
            <View style={[styles.calorieStatDivider, { backgroundColor: colors.border.primary }]} />
            <View style={styles.calorieStat}>
              <Text style={[
                styles.calorieStatValue, 
                { color: caloriesRemaining >= 0 ? accent.primary : '#EF4444' }
              ]}>
                {Math.abs(Math.round(caloriesRemaining))}
              </Text>
              <Text style={[styles.calorieStatLabel, { color: colors.text.muted }]}>
                {caloriesRemaining >= 0 ? t('dashboard.left') : t('dashboard.over')}
              </Text>
            </View>
          </View>

          <View style={[styles.progressBar, { backgroundColor: colors.background.elevated }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${progressPercentage}%`,
                  backgroundColor: progressPercentage > 100 ? '#EF4444' : accent.primary
                }
              ]} 
            />
          </View>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: colors.background.card }]}
            onPress={() => router.push('/meals-history')}
          >
            <View style={[styles.statIcon, { backgroundColor: `${accent.primary}20` }]}>
              <Ionicons name="restaurant" size={22} color={accent.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {today.meals_count || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>{t('dashboard.meals')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: colors.background.card }]}
            onPress={() => router.push('/weight-training')}
          >
            <View style={[styles.statIcon, { backgroundColor: '#22C55E20' }]}>
              <MaterialIcons name="fitness-center" size={22} color="#22C55E" />
            </View>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {today.workouts_count || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>{t('dashboard.workouts')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: colors.background.card }]}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: '#06B6D420' }]}>
              <Ionicons name="water" size={22} color="#06B6D4" />
            </View>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {Math.round(today.water_intake || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>oz</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: colors.background.card }]}
            onPress={() => router.push('/heart-rate')}
          >
            <View style={[styles.statIcon, { backgroundColor: '#EF444420' }]}>
              <MaterialIcons name="favorite" size={22} color="#EF4444" />
            </View>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {Math.round(today.avg_heart_rate || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>BPM</Text>
          </TouchableOpacity>
        </View>

        {/* Water Quick Add */}
        <View style={[styles.waterSection, { backgroundColor: colors.background.card }]}>
          <View style={styles.waterHeader}>
            <Ionicons name="water" size={20} color="#06B6D4" />
            <Text style={[styles.waterTitle, { color: colors.text.primary }]}>Log Water</Text>
          </View>
          <View style={styles.waterButtons}>
            {[8, 16, 24, 32].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[styles.waterButton, { backgroundColor: colors.background.elevated }]}
                onPress={() => addWater(amount)}
              >
                <Text style={[styles.waterButtonText, { color: '#06B6D4' }]}>+{amount}oz</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: 'camera', label: 'Scan Food', color: accent.primary, route: '/scan' },
            { icon: 'calendar', label: 'Schedule', color: '#F59E0B', route: '/schedule' },
            { icon: 'barbell', label: 'Workout', color: '#8B5CF6', route: '/weight-training' },
            { icon: 'footsteps', label: 'Run', color: '#EC4899', route: '/running' },
            { icon: 'body', label: 'Body Scan', color: '#10B981', route: '/body-scan' },
            { icon: 'flask', label: 'Peptides', color: '#6366F1', route: '/peptides' },
            { icon: 'trophy', label: 'Rewards', color: '#EF4444', route: '/badges' },
            { icon: 'stats-chart', label: 'Analytics', color: '#0EA5E9', route: '/analytics' },
          ].map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionCard, { backgroundColor: colors.background.card }]}
              onPress={() => router.push(action.route as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text.primary }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Premium Banner */}
        <TouchableOpacity onPress={() => router.push('/membership')}>
          <LinearGradient
            colors={accent.gradient as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.premiumBanner}
          >
            <View style={styles.premiumContent}>
              <Ionicons name="diamond" size={28} color="#fff" />
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>FitTrax Premium</Text>
                <Text style={styles.premiumSubtitle}>AI Workouts • Body Scan • Peptides</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <AchievementModal
        visible={achievementModal.visible}
        achievement={achievementModal.achievement}
        onClose={() => setAchievementModal({ visible: false, achievement: null })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scrollContent: {
    padding: 16,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 32,
    textAlign: 'center',
  },
  welcomeSubtext: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 32,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerLeft: {
    marginRight: 12,
  },
  headerCenter: {
    flex: 1,
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
  },
  motivation: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  streakCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  streakInfo: {
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  streakLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 24,
  },
  calorieCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  calorieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calorieHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calorieTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  calorieGoal: {
    fontSize: 14,
  },
  calorieStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  calorieStat: {
    alignItems: 'center',
    flex: 1,
  },
  calorieStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  calorieStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  calorieStatDivider: {
    width: 1,
    height: 40,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 48 - 12) / 2,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  waterSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  waterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  waterTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  waterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  waterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  waterButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: (width - 48 - 12) / 2,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  premiumBanner: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumText: {},
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  premiumSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
});

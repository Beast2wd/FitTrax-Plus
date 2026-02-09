import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function PlansScreen() {
  const { theme } = useThemeStore();
  const { userId } = useUserStore();
  const router = useRouter();
  const colors = theme.colors;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [prs, setPrs] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      const [historyRes, statsRes, prsRes] = await Promise.all([
        axios.get(`${API_URL}/api/weight-training/history/${userId}?days=30`),
        axios.get(`${API_URL}/api/weight-training/stats/${userId}`),
        axios.get(`${API_URL}/api/weight-training/prs/${userId}`),
      ]);
      
      setWorkoutHistory(historyRes.data.workouts || []);
      setStats(statsRes.data);
      setPrs(prsRes.data.personal_records || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accentColors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading your plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>My Plans</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Track your workout progress
          </Text>
        </View>

        {/* Quick Stats */}
        {stats && stats.total_workouts > 0 && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.background.card }]}>
              <Ionicons name="fitness" size={24} color="#7C3AED" />
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{stats.total_workouts}</Text>
              <Text style={[styles.statLabel, { color: colors.text.muted }]}>Workouts</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.background.card }]}>
              <Ionicons name="barbell" size={24} color="#10B981" />
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{(stats.total_volume / 1000).toFixed(1)}k</Text>
              <Text style={[styles.statLabel, { color: colors.text.muted }]}>Total lbs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.background.card }]}>
              <Ionicons name="trophy" size={24} color="#F59E0B" />
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{stats.total_prs}</Text>
              <Text style={[styles.statLabel, { color: colors.text.muted }]}>PRs</Text>
            </View>
          </View>
        )}

        {/* Start a Workout CTA */}
        <TouchableOpacity
          style={styles.ctaCard}
          onPress={() => router.push('/weight-training')}
        >
          <LinearGradient
            colors={['#7C3AED', '#5B21B6']}
            style={styles.ctaGradient}
          >
            <MaterialCommunityIcons name="dumbbell" size={32} color="#fff" />
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>Start a Workout</Text>
              <Text style={styles.ctaSubtitle}>Choose from training programs or quick log</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Personal Records */}
        {prs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>🏆 Personal Records</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.prsRow}>
                {prs.slice(0, 5).map((pr, index) => (
                  <View key={index} style={[styles.prCard, { backgroundColor: colors.background.card }]}>
                    <Text style={[styles.prExercise, { color: colors.text.primary }]} numberOfLines={1}>
                      {pr.exercise_name}
                    </Text>
                    <Text style={styles.prWeight}>{pr.weight} lbs</Text>
                    <Text style={[styles.prReps, { color: colors.text.secondary }]}>x {pr.reps} reps</Text>
                    <Text style={[styles.pr1rm, { color: colors.text.muted }]}>
                      Est 1RM: {pr.estimated_1rm?.toFixed(0)} lbs
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Recent Workouts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>📋 Recent Workouts</Text>
          
          {workoutHistory.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background.card }]}>
              <MaterialCommunityIcons name="weight-lifter" size={48} color={colors.text.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No workouts yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
                Complete your first workout to see it here
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: theme.accentColors.primary }]}
                onPress={() => router.push('/weight-training')}
              >
                <Text style={styles.emptyButtonText}>Start Training</Text>
              </TouchableOpacity>
            </View>
          ) : (
            workoutHistory.map((workout, index) => (
              <View key={index} style={[styles.workoutCard, { backgroundColor: colors.background.card }]}>
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutIcon}>
                    <MaterialCommunityIcons name="dumbbell" size={20} color="#7C3AED" />
                  </View>
                  <View style={styles.workoutInfo}>
                    <Text style={[styles.workoutName, { color: colors.text.primary }]}>
                      {workout.workout_name}
                    </Text>
                    <Text style={[styles.workoutDate, { color: colors.text.muted }]}>
                      {formatDate(workout.timestamp)} • {formatTime(workout.timestamp)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.workoutStats}>
                  <View style={styles.workoutStat}>
                    <Text style={[styles.workoutStatValue, { color: colors.text.primary }]}>
                      {workout.exercises?.length || 0}
                    </Text>
                    <Text style={[styles.workoutStatLabel, { color: colors.text.muted }]}>Exercises</Text>
                  </View>
                  <View style={styles.workoutStat}>
                    <Text style={[styles.workoutStatValue, { color: colors.text.primary }]}>
                      {workout.exercises?.reduce((acc: number, ex: any) => acc + (ex.sets?.length || 0), 0) || 0}
                    </Text>
                    <Text style={[styles.workoutStatLabel, { color: colors.text.muted }]}>Sets</Text>
                  </View>
                  <View style={styles.workoutStat}>
                    <Text style={[styles.workoutStatValue, { color: colors.text.primary }]}>
                      {Math.round(workout.exercises?.reduce((acc: number, ex: any) => 
                        acc + ex.sets?.reduce((sAcc: number, s: any) => sAcc + (s.weight * s.reps), 0) || 0, 0) / 1000 * 10) / 10}k
                    </Text>
                    <Text style={[styles.workoutStatLabel, { color: colors.text.muted }]}>lbs</Text>
                  </View>
                </View>

                {/* Exercise List */}
                <View style={styles.exerciseList}>
                  {workout.exercises?.slice(0, 3).map((ex: any, exIndex: number) => (
                    <Text 
                      key={exIndex} 
                      style={[styles.exerciseItem, { color: colors.text.secondary }]}
                      numberOfLines={1}
                    >
                      • {ex.exercise_name} ({ex.sets?.length || 0} sets)
                    </Text>
                  ))}
                  {(workout.exercises?.length || 0) > 3 && (
                    <Text style={[styles.moreExercises, { color: colors.text.muted }]}>
                      +{workout.exercises.length - 3} more exercises
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  ctaCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  ctaText: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  prsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  prCard: {
    width: 140,
    borderRadius: 12,
    padding: 12,
  },
  prExercise: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  prWeight: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7C3AED',
  },
  prReps: {
    fontSize: 14,
    marginTop: 2,
  },
  pr1rm: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  workoutCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  workoutDate: {
    fontSize: 13,
  },
  workoutStats: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  workoutStat: {
    flex: 1,
    alignItems: 'center',
  },
  workoutStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  workoutStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  exerciseList: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  exerciseItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  moreExercises: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

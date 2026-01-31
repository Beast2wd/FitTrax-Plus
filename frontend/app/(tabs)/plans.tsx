import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import { plansAPI } from '../../services/api';

const { width } = Dimensions.get('window');

// Exercise images from Unsplash - high quality fitness photography
const EXERCISE_IMAGES: { [key: string]: string } = {
  // Cardio
  'Jumping Jacks': 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80',
  'Burpees': 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=400&q=80',
  'Mountain Climbers': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
  'High Knees': 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400&q=80',
  'Box Jumps': 'https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=400&q=80',
  'Jump Rope': 'https://images.unsplash.com/photo-1515775054473-32ac54f498bc?w=400&q=80',
  'Running': 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&q=80',
  'Sprint Intervals': 'https://images.unsplash.com/photo-1461896836934- voices?w=400&q=80',
  'Cycling': 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80',
  
  // Strength - Upper Body
  'Push-ups': 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400&q=80',
  'Bench Press': 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?w=400&q=80',
  'Shoulder Press': 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=400&q=80',
  'Tricep Dips': 'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=400&q=80',
  'Pull-ups': 'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=400&q=80',
  'Rows': 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=400&q=80',
  'Bicep Curls': 'https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400&q=80',
  'Dips': 'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=400&q=80',
  
  // Strength - Lower Body
  'Squats': 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&q=80',
  'Lunges': 'https://images.unsplash.com/photo-1434608519344-49d77a699e1d?w=400&q=80',
  'Deadlifts': 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=400&q=80',
  'Leg Press': 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=400&q=80',
  'Glute Bridges': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
  'Calf Raises': 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=400&q=80',
  
  // Core
  'Plank': 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=400&q=80',
  'Core Work': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
  'Core Circuit': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
  
  // Flexibility
  'Yoga': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80',
  'Stretching': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80',
  'Sun Salutations': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=80',
  
  // Default
  'default': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80',
};

const getExerciseImage = (exerciseName: string): string => {
  // Try to find exact match
  if (EXERCISE_IMAGES[exerciseName]) {
    return EXERCISE_IMAGES[exerciseName];
  }
  
  // Try to find partial match
  const lowerName = exerciseName.toLowerCase();
  for (const [key, url] of Object.entries(EXERCISE_IMAGES)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return url;
    }
  }
  
  return EXERCISE_IMAGES['default'];
};

export default function PlansScreen() {
  const { theme } = useThemeStore();
  const colors = theme.colors;
  const accent = theme.accentColors;
  
  const { userId } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [selectedDay, setSelectedDay] = useState<any>(null);

  useEffect(() => {
    loadPlans();
  }, [userId]);

  const loadPlans = async () => {
    try {
      const data = await plansAPI.getWorkoutPlans();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanPress = (plan: any) => {
    setSelectedPlan(plan);
    setSelectedDay(null);
    setShowPlanDetail(true);
  };

  const handleStartPlan = async () => {
    if (!userId || !selectedPlan) {
      Alert.alert('Error', 'Please complete your profile first');
      return;
    }

    try {
      const userPlanData = {
        user_plan_id: `userplan_${Date.now()}`,
        user_id: userId,
        plan_id: selectedPlan.plan_id,
        start_date: new Date().toISOString().split('T')[0],
        current_day: 1,
        completed_days: [],
        status: 'active',
      };

      await plansAPI.startPlan(userPlanData);
      Alert.alert('Plan Activated!', 'This plan is now your active workout routine. Check back daily for your workouts!');
      setShowPlanDetail(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to start plan');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return '#10B981';
      case 'intermediate':
        return '#F59E0B';
      case 'advanced':
        return '#EF4444';
      default:
        return colors.text.secondary;
    }
  };

  const getGoalGradient = (goal: string): [string, string] => {
    switch (goal) {
      case 'weight_loss':
        return ['#EF4444', '#DC2626'];
      case 'muscle_gain':
        return ['#3B82F6', '#2563EB'];
      case 'endurance':
        return ['#10B981', '#059669'];
      case 'flexibility':
        return ['#8B5CF6', '#7C3AED'];
      case 'tone':
        return ['#F59E0B', '#D97706'];
      default:
        return ['#6366F1', '#4F46E5'];
    }
  };

  const renderPlanCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.planCard, { backgroundColor: colors.background.card }]}
      onPress={() => handlePlanPress(item)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={getGoalGradient(item.goal)}
        style={styles.planCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.planCardHeader}>
          <View style={styles.planBadge}>
            {item.is_ai_generated && (
              <View style={styles.aiBadge}>
                <MaterialCommunityIcons name="robot" size={12} color="#fff" />
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
            <View style={[styles.levelBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.levelText}>{item.level?.toUpperCase()}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
        </View>
        
        <Text style={styles.planName}>{item.name}</Text>
        <Text style={styles.planDescription} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.planMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.metaText}>{item.duration_weeks} weeks</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="fitness" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.metaText}>{item.days?.length || 0} days</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderExerciseCard = (exercise: string, index: number) => (
    <View key={index} style={[styles.exerciseCard, { backgroundColor: colors.background.card }]}>
      <Image 
        source={{ uri: getExerciseImage(exercise) }}
        style={styles.exerciseImage}
        resizeMode="cover"
      />
      <View style={styles.exerciseOverlay}>
        <Text style={styles.exerciseName}>{exercise}</Text>
        <View style={styles.exerciseActions}>
          <TouchableOpacity style={styles.playButton}>
            <Ionicons name="play-circle" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading your plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <FlatList
        data={plans}
        renderItem={renderPlanCard}
        keyExtractor={(item) => item.plan_id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={[styles.header, { color: colors.text.primary }]}>Workout Plans</Text>
            <Text style={[styles.subHeader, { color: colors.text.secondary }]}>
              Tap a plan to view workouts
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.background.card }]}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={colors.text.muted} />
            <Text style={[styles.emptyText, { color: colors.text.primary }]}>No Plans Yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
              Complete your fitness goals to get a personalized AI workout plan
            </Text>
          </View>
        }
      />

      {/* Plan Detail Modal */}
      <Modal
        visible={showPlanDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPlanDetail(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
          {selectedPlan && (
            <>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
                <TouchableOpacity 
                  onPress={() => setShowPlanDetail(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text.primary }]} numberOfLines={1}>
                  {selectedPlan.name}
                </Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Plan Overview */}
                <LinearGradient
                  colors={getGoalGradient(selectedPlan.goal)}
                  style={styles.planOverview}
                >
                  {selectedPlan.is_ai_generated && (
                    <View style={styles.aiGeneratedBadge}>
                      <MaterialCommunityIcons name="robot" size={16} color="#fff" />
                      <Text style={styles.aiGeneratedText}>AI Generated Plan</Text>
                    </View>
                  )}
                  <Text style={styles.planOverviewTitle}>{selectedPlan.name}</Text>
                  <Text style={styles.planOverviewDesc}>{selectedPlan.description}</Text>
                  
                  <View style={styles.planStats}>
                    <View style={styles.planStat}>
                      <Text style={styles.planStatValue}>{selectedPlan.duration_weeks}</Text>
                      <Text style={styles.planStatLabel}>Weeks</Text>
                    </View>
                    <View style={styles.planStatDivider} />
                    <View style={styles.planStat}>
                      <Text style={styles.planStatValue}>{selectedPlan.days?.length || 0}</Text>
                      <Text style={styles.planStatLabel}>Days</Text>
                    </View>
                    <View style={styles.planStatDivider} />
                    <View style={styles.planStat}>
                      <Text style={styles.planStatValue}>{selectedPlan.level}</Text>
                      <Text style={styles.planStatLabel}>Level</Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Workout Days */}
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  Workout Schedule
                </Text>
                
                {selectedPlan.days?.map((day: any, index: number) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCard, 
                      { backgroundColor: colors.background.card },
                      selectedDay?.day === day.day && { borderColor: accent.primary, borderWidth: 2 }
                    ]}
                    onPress={() => setSelectedDay(selectedDay?.day === day.day ? null : day)}
                  >
                    <View style={styles.dayHeader}>
                      <View style={styles.dayInfo}>
                        <View style={[styles.dayNumber, { backgroundColor: accent.primary }]}>
                          <Text style={styles.dayNumberText}>Day {day.day}</Text>
                        </View>
                        <View>
                          <Text style={[styles.dayName, { color: colors.text.primary }]}>{day.name}</Text>
                          <Text style={[styles.dayDuration, { color: colors.text.secondary }]}>
                            {day.duration_minutes} min • {day.exercises?.length || 0} exercises
                          </Text>
                        </View>
                      </View>
                      <Ionicons 
                        name={selectedDay?.day === day.day ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color={colors.text.muted} 
                      />
                    </View>
                    
                    {/* Expanded Exercises */}
                    {selectedDay?.day === day.day && (
                      <View style={styles.exercisesContainer}>
                        <Text style={[styles.exercisesTitle, { color: colors.text.primary }]}>
                          Exercises
                        </Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.exercisesList}
                        >
                          {day.exercises?.map((exercise: string, i: number) => (
                            renderExerciseCard(exercise, i)
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                {/* Start Plan Button */}
                <TouchableOpacity
                  style={[styles.startPlanButton, { backgroundColor: accent.primary }]}
                  onPress={handleStartPlan}
                >
                  <Ionicons name="rocket" size={20} color="#fff" />
                  <Text style={styles.startPlanButtonText}>Start This Plan</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerContainer: {
    marginBottom: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
  },
  subHeader: {
    fontSize: 14,
    marginTop: 4,
  },
  planCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  planCardGradient: {
    padding: 20,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planBadge: {
    flexDirection: 'row',
    gap: 8,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 16,
  },
  planMeta: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  planOverview: {
    padding: 24,
    margin: 16,
    borderRadius: 20,
  },
  aiGeneratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  aiGeneratedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planOverviewTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  planOverviewDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    marginBottom: 20,
  },
  planStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  planStat: {
    alignItems: 'center',
  },
  planStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'capitalize',
  },
  planStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  planStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  dayCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayNumber: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dayNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '700',
  },
  dayDuration: {
    fontSize: 13,
    marginTop: 2,
  },
  exercisesContainer: {
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  exercisesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  exercisesList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  exerciseCard: {
    width: 160,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  exerciseOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  exerciseName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  playButton: {
    opacity: 0.9,
  },
  startPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  startPlanButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

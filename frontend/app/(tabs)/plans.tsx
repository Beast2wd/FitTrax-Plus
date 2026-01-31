import React, { useState, useEffect, useCallback } from 'react';
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
import { Video, ResizeMode } from 'expo-av';
import { useThemeStore } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import { plansAPI } from '../../services/api';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

// Exercise data with images and video URLs
const EXERCISE_DATA: { [key: string]: { image: string; video?: string; instructions: string[] } } = {
  // Cardio
  'Jumping Jacks': {
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    instructions: ['Stand with feet together, arms at sides', 'Jump while spreading legs and raising arms overhead', 'Jump back to starting position', 'Repeat for desired reps']
  },
  'Burpees': {
    image: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=400&q=80',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    instructions: ['Start standing', 'Drop into a squat with hands on floor', 'Kick feet back to plank position', 'Do a push-up, jump feet forward, then jump up with arms overhead']
  },
  'Mountain Climbers': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
    instructions: ['Start in plank position', 'Drive one knee toward chest', 'Quickly switch legs', 'Continue alternating at a fast pace']
  },
  'High Knees': {
    image: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400&q=80',
    instructions: ['Stand tall with feet hip-width apart', 'Run in place, bringing knees up high', 'Pump arms as you run', 'Keep core engaged throughout']
  },
  'Box Jumps': {
    image: 'https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=400&q=80',
    instructions: ['Stand facing a sturdy box or platform', 'Bend knees and swing arms back', 'Jump explosively onto the box', 'Step down and repeat']
  },
  // Strength - Upper
  'Push-ups': {
    image: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400&q=80',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    instructions: ['Start in plank with hands shoulder-width apart', 'Lower chest toward floor', 'Keep body in straight line', 'Push back up to start']
  },
  'Bench Press': {
    image: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?w=400&q=80',
    instructions: ['Lie on bench with feet flat on floor', 'Grip barbell slightly wider than shoulders', 'Lower bar to chest with control', 'Press back up to starting position']
  },
  'Shoulder Press': {
    image: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=400&q=80',
    instructions: ['Hold dumbbells at shoulder height', 'Press weights overhead until arms are straight', 'Lower with control', 'Keep core engaged throughout']
  },
  'Pull-ups': {
    image: 'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=400&q=80',
    instructions: ['Hang from bar with overhand grip', 'Pull yourself up until chin is over bar', 'Lower with control', 'Keep core tight throughout']
  },
  'Rows': {
    image: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=400&q=80',
    instructions: ['Bend at hips with flat back', 'Pull weight toward lower chest', 'Squeeze shoulder blades together', 'Lower with control']
  },
  'Bicep Curls': {
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400&q=80',
    instructions: ['Stand with dumbbells at sides', 'Curl weights toward shoulders', 'Keep elbows close to body', 'Lower with control']
  },
  'Tricep Dips': {
    image: 'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=400&q=80',
    instructions: ['Place hands on bench behind you', 'Lower body by bending elbows', 'Keep elbows pointing back', 'Push back up to start']
  },
  'Dips': {
    image: 'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=400&q=80',
    instructions: ['Support yourself on parallel bars', 'Lower body by bending elbows', 'Keep elbows close to body', 'Push back up to starting position']
  },
  // Strength - Lower
  'Squats': {
    image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&q=80',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    instructions: ['Stand with feet shoulder-width apart', 'Lower hips back and down', 'Keep chest up and knees over toes', 'Push through heels to stand']
  },
  'Lunges': {
    image: 'https://images.unsplash.com/photo-1434608519344-49d77a699e1d?w=400&q=80',
    instructions: ['Stand tall with feet hip-width apart', 'Step forward and lower back knee toward floor', 'Keep front knee over ankle', 'Push back to starting position']
  },
  'Deadlifts': {
    image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=400&q=80',
    instructions: ['Stand with feet hip-width apart', 'Hinge at hips to lower bar along legs', 'Keep back flat and core engaged', 'Stand by driving through heels']
  },
  'Leg Press': {
    image: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=400&q=80',
    instructions: ['Sit in leg press machine', 'Place feet shoulder-width on platform', 'Lower weight by bending knees', 'Press back up without locking knees']
  },
  'Glute Bridges': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
    instructions: ['Lie on back with knees bent', 'Push through heels to lift hips', 'Squeeze glutes at the top', 'Lower with control']
  },
  // Core
  'Plank': {
    image: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=400&q=80',
    instructions: ['Start on forearms and toes', 'Keep body in straight line', 'Engage core and glutes', 'Hold for desired time']
  },
  'Core Work': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
    instructions: ['Mix of crunches, leg raises, and planks', 'Focus on controlled movements', 'Breathe steadily throughout', 'Rest between sets']
  },
  // Flexibility
  'Yoga': {
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80',
    instructions: ['Flow through poses mindfully', 'Focus on breath and alignment', 'Hold poses for several breaths', 'Listen to your body']
  },
  'Stretching': {
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80',
    instructions: ['Hold each stretch 20-30 seconds', 'Breathe deeply and relax into stretch', 'Never bounce or force', 'Stretch both sides equally']
  },
  'default': {
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80',
    instructions: ['Follow proper form', 'Control the movement', 'Breathe steadily', 'Rest as needed']
  },
};

const getExerciseData = (exerciseName: string) => {
  if (EXERCISE_DATA[exerciseName]) {
    return EXERCISE_DATA[exerciseName];
  }
  const lowerName = exerciseName.toLowerCase();
  for (const [key, data] of Object.entries(EXERCISE_DATA)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return data;
    }
  }
  return EXERCISE_DATA['default'];
};

export default function PlansScreen() {
  const { theme } = useThemeStore();
  const colors = theme.colors;
  const accent = theme.accentColors;
  
  const { userId } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [videoStatus, setVideoStatus] = useState<any>({});

  useEffect(() => {
    loadPlans();
    loadActivePlan();
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

  const loadActivePlan = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/user-plans/${userId}?status=active`);
      if (response.data.plans && response.data.plans.length > 0) {
        const userPlan = response.data.plans[0];
        // Get full plan details
        const planResponse = await plansAPI.getWorkoutPlans();
        const fullPlan = planResponse.plans?.find((p: any) => p.plan_id === userPlan.plan_id);
        if (fullPlan) {
          setActivePlan({ ...fullPlan, progress: userPlan });
        }
      }
    } catch (error) {
      console.error('Error loading active plan:', error);
    }
  };

  const handlePlanPress = (plan: any) => {
    setSelectedPlan(plan);
    setSelectedDay(null);
    setShowPlanDetail(true);
  };

  const handleExercisePress = (exerciseName: string) => {
    const exerciseData = getExerciseData(exerciseName);
    setSelectedExercise({ name: exerciseName, ...exerciseData });
    setShowExerciseModal(true);
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
      Alert.alert('Plan Activated!', 'Your progress will be tracked here in the Plans tab. Come back daily to complete your workouts!');
      setShowPlanDetail(false);
      loadActivePlan();
    } catch (error) {
      Alert.alert('Error', 'Failed to start plan');
    }
  };

  const handleCompleteDay = async (dayNumber: number) => {
    if (!activePlan?.progress) return;
    
    try {
      const completedDays = [...(activePlan.progress.completed_days || [])];
      if (!completedDays.includes(dayNumber)) {
        completedDays.push(dayNumber);
      }
      
      await axios.put(`${API_URL}/api/user-plans/${activePlan.progress.user_plan_id}`, {
        completed_days: completedDays,
        current_day: Math.max(...completedDays) + 1,
      });
      
      Alert.alert('Day Completed! 🎉', 'Great work! Keep up the momentum!');
      loadActivePlan();
    } catch (error) {
      Alert.alert('Error', 'Failed to mark day as complete');
    }
  };

  const getGoalGradient = (goal: string): [string, string] => {
    switch (goal) {
      case 'weight_loss': return ['#EF4444', '#DC2626'];
      case 'muscle_gain': return ['#3B82F6', '#2563EB'];
      case 'endurance': return ['#10B981', '#059669'];
      case 'flexibility': return ['#8B5CF6', '#7C3AED'];
      case 'tone': return ['#F59E0B', '#D97706'];
      default: return ['#6366F1', '#4F46E5'];
    }
  };

  const renderActivePlanProgress = () => {
    if (!activePlan) return null;
    
    const completedDays = activePlan.progress?.completed_days?.length || 0;
    const totalDays = activePlan.days?.length || 1;
    const progressPercent = Math.round((completedDays / totalDays) * 100);
    
    return (
      <View style={[styles.activePlanCard, { backgroundColor: colors.background.card }]}>
        <LinearGradient
          colors={getGoalGradient(activePlan.goal)}
          style={styles.activePlanGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.activePlanHeader}>
            <View>
              <Text style={styles.activePlanLabel}>ACTIVE PLAN</Text>
              <Text style={styles.activePlanName}>{activePlan.name}</Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
          
          <Text style={styles.progressText}>
            {completedDays} of {totalDays} days completed
          </Text>
        </LinearGradient>
        
        {/* Today's Workout */}
        <View style={styles.todayWorkout}>
          <Text style={[styles.todayLabel, { color: colors.text.primary }]}>Today's Workout</Text>
          {activePlan.days && activePlan.days[activePlan.progress?.current_day - 1] ? (
            <View>
              <TouchableOpacity 
                style={[styles.todayWorkoutCard, { backgroundColor: colors.background.elevated }]}
                onPress={() => handlePlanPress(activePlan)}
              >
                <View style={styles.todayWorkoutInfo}>
                  <Text style={[styles.todayWorkoutDay, { color: accent.primary }]}>
                    Day {activePlan.progress?.current_day || 1}
                  </Text>
                  <Text style={[styles.todayWorkoutName, { color: colors.text.primary }]}>
                    {activePlan.days[activePlan.progress?.current_day - 1]?.name}
                  </Text>
                  <Text style={[styles.todayWorkoutMeta, { color: colors.text.secondary }]}>
                    {activePlan.days[activePlan.progress?.current_day - 1]?.duration_minutes} min • {activePlan.days[activePlan.progress?.current_day - 1]?.exercises?.length} exercises
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.completeButton, { backgroundColor: accent.primary }]}
                onPress={() => handleCompleteDay(activePlan.progress?.current_day || 1)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.completeButtonText}>Mark Day as Complete</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.planComplete, { color: colors.text.secondary }]}>
              🎉 Congratulations! You've completed this plan!
            </Text>
          )}
        </View>
      </View>
    );
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.header, { color: colors.text.primary }]}>Workout Plans</Text>
        
        {/* Active Plan Progress */}
        {renderActivePlanProgress()}
        
        {/* Available Plans */}
        <Text style={[styles.sectionHeader, { color: colors.text.primary }]}>
          {activePlan ? 'Other Plans' : 'Choose a Plan'}
        </Text>
        
        {plans.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.background.card }]}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={colors.text.muted} />
            <Text style={[styles.emptyText, { color: colors.text.primary }]}>No Plans Yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
              Complete your fitness goals to get a personalized AI workout plan
            </Text>
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.plan_id}>
              {renderPlanCard({ item: plan })}
            </View>
          ))
        )}
      </ScrollView>

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
              <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
                <TouchableOpacity onPress={() => setShowPlanDetail(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text.primary }]} numberOfLines={1}>
                  {selectedPlan.name}
                </Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView 
                style={styles.modalContent} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
              >
                {/* Plan Overview */}
                <LinearGradient colors={getGoalGradient(selectedPlan.goal)} style={styles.planOverview}>
                  {selectedPlan.is_ai_generated && (
                    <View style={styles.aiGeneratedBadge}>
                      <MaterialCommunityIcons name="robot" size={16} color="#fff" />
                      <Text style={styles.aiGeneratedText}>AI Generated</Text>
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
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Workout Schedule</Text>
                
                {selectedPlan.days?.map((day: any, index: number) => (
                  <View key={index} style={[styles.dayCard, { backgroundColor: colors.background.card }]}>
                    <TouchableOpacity
                      style={styles.dayHeader}
                      onPress={() => setSelectedDay(selectedDay?.day === day.day ? null : day)}
                    >
                      <View style={styles.dayInfo}>
                        <View style={[styles.dayNumber, { backgroundColor: accent.primary }]}>
                          <Text style={styles.dayNumberText}>Day {day.day}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
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
                    </TouchableOpacity>
                    
                    {/* Expanded Exercises - Vertical List */}
                    {selectedDay?.day === day.day && (
                      <View style={styles.exercisesContainer}>
                        {day.exercises?.map((exercise: string, i: number) => {
                          const exerciseData = getExerciseData(exercise);
                          return (
                            <TouchableOpacity
                              key={i}
                              style={[styles.exerciseRow, { backgroundColor: colors.background.elevated }]}
                              onPress={() => handleExercisePress(exercise)}
                            >
                              <Image 
                                source={{ uri: exerciseData.image }}
                                style={styles.exerciseThumb}
                              />
                              <View style={styles.exerciseInfo}>
                                <Text style={[styles.exerciseName, { color: colors.text.primary }]}>{exercise}</Text>
                                <Text style={[styles.exerciseHint, { color: colors.text.secondary }]}>Tap to view tutorial</Text>
                              </View>
                              <View style={[styles.playIcon, { backgroundColor: accent.primary }]}>
                                <Ionicons name="play" size={16} color="#fff" />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}

                {/* Start Plan Button */}
                {!activePlan || activePlan.plan_id !== selectedPlan.plan_id ? (
                  <TouchableOpacity
                    style={[styles.startPlanButton, { backgroundColor: accent.primary }]}
                    onPress={handleStartPlan}
                  >
                    <Ionicons name="rocket" size={20} color="#fff" />
                    <Text style={styles.startPlanButtonText}>Start This Plan</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.activePlanBanner, { backgroundColor: '#10B98120' }]}>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    <Text style={[styles.activePlanBannerText, { color: '#10B981' }]}>This is your active plan</Text>
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Exercise Detail Modal */}
      <Modal
        visible={showExerciseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExerciseModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
          {selectedExercise && (
            <>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
                <TouchableOpacity onPress={() => setShowExerciseModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{selectedExercise.name}</Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Video or Image */}
                <View style={styles.mediaContainer}>
                  {selectedExercise.video ? (
                    <Video
                      source={{ uri: selectedExercise.video }}
                      style={styles.exerciseVideo}
                      useNativeControls
                      resizeMode={ResizeMode.COVER}
                      isLooping
                      shouldPlay={false}
                    />
                  ) : (
                    <Image 
                      source={{ uri: selectedExercise.image }}
                      style={styles.exerciseFullImage}
                      resizeMode="cover"
                    />
                  )}
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                  <Text style={[styles.instructionsTitle, { color: colors.text.primary }]}>How to Perform</Text>
                  {selectedExercise.instructions?.map((instruction: string, i: number) => (
                    <View key={i} style={styles.instructionRow}>
                      <View style={[styles.instructionNumber, { backgroundColor: accent.primary }]}>
                        <Text style={styles.instructionNumberText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.instructionText, { color: colors.text.secondary }]}>{instruction}</Text>
                    </View>
                  ))}
                </View>

                {/* Tips */}
                <View style={[styles.tipsContainer, { backgroundColor: colors.background.card }]}>
                  <Ionicons name="bulb" size={24} color="#F59E0B" />
                  <View style={styles.tipsContent}>
                    <Text style={[styles.tipsTitle, { color: colors.text.primary }]}>Pro Tip</Text>
                    <Text style={[styles.tipsText, { color: colors.text.secondary }]}>
                      Focus on controlled movements rather than speed. Quality over quantity!
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { fontSize: 28, fontWeight: '800', marginBottom: 20 },
  sectionHeader: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 16 },
  // Active Plan Card
  activePlanCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 8 },
  activePlanGradient: { padding: 20 },
  activePlanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activePlanLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  activePlanName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  progressCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  progressPercent: { color: '#fff', fontSize: 14, fontWeight: '800' },
  progressBarContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginTop: 16 },
  progressBar: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  progressText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 },
  todayWorkout: { padding: 16 },
  todayLabel: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  todayWorkoutCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12 },
  todayWorkoutInfo: { flex: 1 },
  todayWorkoutDay: { fontSize: 12, fontWeight: '700' },
  todayWorkoutName: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  todayWorkoutMeta: { fontSize: 13, marginTop: 4 },
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginTop: 12, gap: 8 },
  completeButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  planComplete: { fontSize: 16, textAlign: 'center', padding: 20 },
  // Plan Card
  planCard: { borderRadius: 20, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  planCardGradient: { padding: 20 },
  planCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planBadge: { flexDirection: 'row', gap: 8 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  levelText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  planName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  planDescription: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: 16 },
  planMeta: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  emptyState: { padding: 40, borderRadius: 20, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  closeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  modalContent: { flex: 1 },
  planOverview: { padding: 24, margin: 16, borderRadius: 20 },
  aiGeneratedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, marginBottom: 12 },
  aiGeneratedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  planOverviewTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  planOverviewDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 22, marginBottom: 20 },
  planStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16 },
  planStat: { alignItems: 'center' },
  planStatValue: { fontSize: 20, fontWeight: '800', color: '#fff', textTransform: 'capitalize' },
  planStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  planStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  dayCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  dayInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dayNumber: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  dayNumberText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dayName: { fontSize: 16, fontWeight: '700' },
  dayDuration: { fontSize: 13, marginTop: 2 },
  exercisesContainer: { padding: 16, paddingTop: 0, gap: 12 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
  exerciseThumb: { width: 60, height: 60, borderRadius: 10 },
  exerciseInfo: { flex: 1, marginLeft: 12 },
  exerciseName: { fontSize: 15, fontWeight: '600' },
  exerciseHint: { fontSize: 12, marginTop: 2 },
  playIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  startPlanButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: 16, gap: 10 },
  startPlanButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  activePlanBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: 16, gap: 10 },
  activePlanBannerText: { fontSize: 16, fontWeight: '600' },
  // Exercise Modal
  mediaContainer: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000' },
  exerciseVideo: { width: '100%', height: '100%' },
  exerciseFullImage: { width: '100%', height: '100%' },
  instructionsContainer: { padding: 20 },
  instructionsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  instructionNumber: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  instructionNumberText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  instructionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  tipsContainer: { flexDirection: 'row', margin: 20, marginTop: 0, padding: 16, borderRadius: 16, gap: 12 },
  tipsContent: { flex: 1 },
  tipsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tipsText: { fontSize: 14, lineHeight: 20 },
});

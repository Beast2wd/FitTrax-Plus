import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { router } from 'expo-router';
import { useThemeStore } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import { plansAPI } from '../../services/api';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

// Reliable workout video URLs (MP4 format, publicly accessible)
const WORKOUT_VIDEOS = {
  cardio: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  strength: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  flexibility: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
};

// Exercise database with images and instructions
const EXERCISE_DATA: { [key: string]: { image: string; category: string; instructions: string[] } } = {
  // HIIT / Cardio
  'Jumping Jacks': {
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80',
    category: 'cardio',
    instructions: ['Stand with feet together, arms at sides', 'Jump while spreading legs and raising arms overhead', 'Jump back to starting position', 'Repeat for 30-60 seconds']
  },
  'Burpees': {
    image: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=600&q=80',
    category: 'cardio',
    instructions: ['Start standing tall', 'Drop into a squat with hands on floor', 'Kick feet back to plank position', 'Do a push-up, jump feet forward, then jump up with arms overhead']
  },
  'Mountain Climbers': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    category: 'cardio',
    instructions: ['Start in high plank position', 'Drive one knee toward chest', 'Quickly switch legs in a running motion', 'Keep core tight and hips level']
  },
  'High Knees': {
    image: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=600&q=80',
    category: 'cardio',
    instructions: ['Stand tall with feet hip-width apart', 'Run in place, lifting knees to hip height', 'Pump arms in rhythm with legs', 'Maintain quick pace for 30-60 seconds']
  },
  'Box Jumps': {
    image: 'https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=600&q=80',
    category: 'cardio',
    instructions: ['Stand facing a sturdy box or platform', 'Bend knees and swing arms back for momentum', 'Jump explosively onto the box, landing softly', 'Step down carefully and repeat']
  },
  'Jump Rope': {
    image: 'https://images.unsplash.com/photo-1515775054473-32ac54f498bc?w=600&q=80',
    category: 'cardio',
    instructions: ['Hold rope handles at hip height', 'Swing rope overhead and jump as it passes under feet', 'Land softly on balls of feet', 'Maintain steady rhythm']
  },
  'Sprint Intervals': {
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&q=80',
    category: 'cardio',
    instructions: ['Sprint at maximum effort for 20-30 seconds', 'Walk or jog slowly for 60-90 seconds recovery', 'Repeat 6-10 times', 'Focus on explosive power during sprints']
  },
  'Jumping Lunges': {
    image: 'https://images.unsplash.com/photo-1434608519344-49d77a699e1d?w=600&q=80',
    category: 'cardio',
    instructions: ['Start in lunge position', 'Jump explosively, switching legs mid-air', 'Land softly in lunge with opposite leg forward', 'Continue alternating']
  },
  // Upper Body Strength
  'Push-ups': {
    image: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=600&q=80',
    category: 'strength',
    instructions: ['Start in plank with hands shoulder-width apart', 'Lower chest toward floor with elbows at 45°', 'Keep body in straight line throughout', 'Push back up to starting position']
  },
  'Bench Press': {
    image: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?w=600&q=80',
    category: 'strength',
    instructions: ['Lie on bench with feet flat on floor', 'Grip barbell slightly wider than shoulders', 'Lower bar to mid-chest with control', 'Press back up, fully extending arms']
  },
  'Incline Press': {
    image: 'https://images.unsplash.com/photo-1534368959876-26bf04f2c947?w=600&q=80',
    category: 'strength',
    instructions: ['Set bench to 30-45 degree incline', 'Press dumbbells up from shoulder level', 'Lower with control to chest', 'Focus on upper chest engagement']
  },
  'Shoulder Press': {
    image: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=600&q=80',
    category: 'strength',
    instructions: ['Hold dumbbells at shoulder height', 'Press weights straight overhead', 'Lower with control back to shoulders', 'Keep core engaged throughout']
  },
  'Arnold Press': {
    image: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=600&q=80',
    category: 'strength',
    instructions: ['Start with dumbbells at chest, palms facing you', 'Rotate palms outward as you press up', 'Reverse the motion on the way down', 'Great for full shoulder development']
  },
  'Tricep Dips': {
    image: 'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=600&q=80',
    category: 'strength',
    instructions: ['Place hands on bench behind you', 'Lower body by bending elbows to 90°', 'Keep elbows pointing straight back', 'Push back up to starting position']
  },
  'Skull Crushers': {
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=600&q=80',
    category: 'strength',
    instructions: ['Lie on bench holding barbell or dumbbells', 'Lower weight toward forehead by bending elbows', 'Keep upper arms stationary', 'Extend arms back to starting position']
  },
  'Pull-ups': {
    image: 'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=600&q=80',
    category: 'strength',
    instructions: ['Hang from bar with overhand grip, hands wider than shoulders', 'Pull yourself up until chin clears the bar', 'Lower with control', 'Engage lats and back muscles']
  },
  'Lat Pulldowns': {
    image: 'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=600&q=80',
    category: 'strength',
    instructions: ['Grip bar wider than shoulder width', 'Pull bar down to upper chest', 'Squeeze shoulder blades together', 'Control the weight back up']
  },
  'Rows': {
    image: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=600&q=80',
    category: 'strength',
    instructions: ['Hinge at hips with flat back', 'Pull weight toward lower ribs', 'Squeeze shoulder blades at top', 'Lower with control']
  },
  'Barbell Rows': {
    image: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=600&q=80',
    category: 'strength',
    instructions: ['Bend over with barbell hanging at arms length', 'Row bar to lower chest', 'Keep back flat and core braced', 'Lower with control']
  },
  'Bicep Curls': {
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=600&q=80',
    category: 'strength',
    instructions: ['Stand with dumbbells at sides, palms forward', 'Curl weights toward shoulders', 'Keep elbows pinned to sides', 'Lower with control, full extension']
  },
  'Hammer Curls': {
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=600&q=80',
    category: 'strength',
    instructions: ['Hold dumbbells with palms facing each other', 'Curl weights up keeping neutral grip', 'Targets brachialis and forearms', 'Control the negative portion']
  },
  'Dips': {
    image: 'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=600&q=80',
    category: 'strength',
    instructions: ['Support yourself on parallel bars', 'Lower body until upper arms are parallel to floor', 'Lean forward slightly for chest, upright for triceps', 'Push back to starting position']
  },
  'Chest Flyes': {
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80',
    category: 'strength',
    instructions: ['Lie on bench with dumbbells extended above chest', 'Lower weights out to sides in arc motion', 'Feel stretch in chest at bottom', 'Bring weights back together at top']
  },
  'Cable Flyes': {
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80',
    category: 'strength',
    instructions: ['Stand between cable machines', 'Bring handles together in front of chest', 'Squeeze chest at the contraction', 'Return with control']
  },
  'Lateral Raises': {
    image: 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=600&q=80',
    category: 'strength',
    instructions: ['Hold dumbbells at sides', 'Raise arms out to sides until shoulder height', 'Keep slight bend in elbows', 'Lower with control']
  },
  'Face Pulls': {
    image: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=600&q=80',
    category: 'strength',
    instructions: ['Use rope attachment on cable machine', 'Pull toward face, separating rope ends', 'Squeeze rear delts and upper back', 'Great for shoulder health']
  },
  'Shrugs': {
    image: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=600&q=80',
    category: 'strength',
    instructions: ['Hold heavy dumbbells or barbell', 'Shrug shoulders up toward ears', 'Hold at top for 1-2 seconds', 'Lower with control']
  },
  // Lower Body
  'Squats': {
    image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&q=80',
    category: 'strength',
    instructions: ['Stand with feet shoulder-width apart', 'Lower hips back and down as if sitting', 'Keep chest up, knees tracking over toes', 'Drive through heels to stand']
  },
  'Lunges': {
    image: 'https://images.unsplash.com/photo-1434608519344-49d77a699e1d?w=600&q=80',
    category: 'strength',
    instructions: ['Stand tall, feet hip-width apart', 'Step forward and lower back knee toward floor', 'Keep front knee over ankle, not past toes', 'Push through front heel to return']
  },
  'Deadlifts': {
    image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=600&q=80',
    category: 'strength',
    instructions: ['Stand with feet hip-width, bar over mid-foot', 'Hinge at hips, grip bar outside knees', 'Keep back flat, drive through floor to stand', 'Lower with control, hips back first']
  },
  'Leg Press': {
    image: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=600&q=80',
    category: 'strength',
    instructions: ['Sit in leg press with feet shoulder-width on platform', 'Lower weight by bending knees to 90°', 'Press through heels to extend legs', 'Don\'t lock knees at top']
  },
  'Leg Curls': {
    image: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=600&q=80',
    category: 'strength',
    instructions: ['Lie face down on leg curl machine', 'Curl weight up by bending knees', 'Squeeze hamstrings at top', 'Lower with control']
  },
  'Glute Bridges': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    category: 'strength',
    instructions: ['Lie on back, knees bent, feet flat', 'Push through heels to lift hips', 'Squeeze glutes hard at top', 'Lower with control']
  },
  'Calf Raises': {
    image: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=600&q=80',
    category: 'strength',
    instructions: ['Stand on edge of step, heels hanging off', 'Rise up onto balls of feet', 'Squeeze calves at top', 'Lower heels below step level for stretch']
  },
  // Core
  'Plank': {
    image: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=600&q=80',
    category: 'strength',
    instructions: ['Start on forearms and toes', 'Keep body in straight line from head to heels', 'Engage core, glutes, and quads', 'Hold for 30-60 seconds']
  },
  'Plank Jacks': {
    image: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=600&q=80',
    category: 'cardio',
    instructions: ['Start in plank position', 'Jump feet out wide then back together', 'Keep hips stable, core engaged', 'Maintain quick pace']
  },
  'Core Work': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    category: 'strength',
    instructions: ['Combine crunches, leg raises, and planks', 'Perform each for 30-45 seconds', 'Rest 15 seconds between exercises', 'Complete 2-3 rounds']
  },
  'Core Circuit': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    category: 'strength',
    instructions: ['Plank 30s → Crunches 15 reps → Leg Raises 12 reps', 'Russian Twists 20 reps → Mountain Climbers 30s', 'Rest 1 minute between rounds', 'Complete 3 rounds']
  },
  'Leg Raises': {
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    category: 'strength',
    instructions: ['Lie flat on back, hands under hips', 'Raise straight legs to 90 degrees', 'Lower slowly without touching floor', 'Keep lower back pressed down']
  },
  // Flexibility / Recovery
  'Yoga': {
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80',
    category: 'flexibility',
    instructions: ['Flow through poses mindfully with breath', 'Hold each pose for 3-5 breaths', 'Focus on alignment over depth', 'Listen to your body\'s limits']
  },
  'Stretching': {
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
    category: 'flexibility',
    instructions: ['Hold each stretch for 20-30 seconds', 'Breathe deeply and relax into stretch', 'Never bounce or force the stretch', 'Stretch both sides equally']
  },
  'Light Stretching': {
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
    category: 'flexibility',
    instructions: ['Gentle stretches for all major muscle groups', 'Hold 15-20 seconds each', 'Focus on areas that feel tight', 'Perfect for recovery days']
  },
  'Sun Salutations': {
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=80',
    category: 'flexibility',
    instructions: ['Mountain pose → Forward fold → Halfway lift', 'Plank → Chaturanga → Upward dog → Downward dog', 'Step forward → Rise to mountain pose', 'Flow with breath, one movement per breath']
  },
  'Foam rolling': {
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
    category: 'flexibility',
    instructions: ['Roll slowly over each muscle group', 'Pause on tender spots for 30-60 seconds', 'Avoid rolling directly on joints', 'Great for recovery and mobility']
  },
  'Light Jogging': {
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&q=80',
    category: 'cardio',
    instructions: ['Easy conversational pace', 'Focus on relaxed form', 'Great for active recovery', '10-20 minutes duration']
  },
  'Rowing': {
    image: 'https://images.unsplash.com/photo-1519505907962-0a6cb0167c73?w=600&q=80',
    category: 'cardio',
    instructions: ['Drive with legs first, then pull with arms', 'Keep back straight throughout', 'Return by extending arms, then bending knees', 'Maintain steady rhythm']
  },
  'Swimming': {
    image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&q=80',
    category: 'cardio',
    instructions: ['Full body, low-impact exercise', 'Focus on proper breathing technique', 'Alternate strokes for variety', 'Great for endurance and recovery']
  },
  'Cycling': {
    image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=80',
    category: 'cardio',
    instructions: ['Maintain steady cadence (70-90 RPM)', 'Keep core engaged', 'Adjust resistance for desired intensity', 'Great low-impact cardio option']
  },
};

// Default exercise data for any unlisted exercises
const DEFAULT_EXERCISE = {
  image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  category: 'strength',
  instructions: ['Maintain proper form throughout', 'Control the movement', 'Breathe steadily - exhale on effort', 'Rest as needed between sets']
};

const getExerciseData = (exerciseName: string) => {
  // Direct match
  if (EXERCISE_DATA[exerciseName]) {
    return EXERCISE_DATA[exerciseName];
  }
  
  // Partial match
  const lowerName = exerciseName.toLowerCase();
  for (const [key, data] of Object.entries(EXERCISE_DATA)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return data;
    }
  }
  
  return DEFAULT_EXERCISE;
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
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPlans(), loadActivePlan()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await plansAPI.getWorkoutPlans();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const loadActivePlan = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/user-plans/${userId}?status=active`);
      if (response.data.plans && response.data.plans.length > 0) {
        const userPlan = response.data.plans[0];
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

  const handleClosePlanDetail = () => {
    setShowPlanDetail(false);
    setSelectedDay(null);
    // Small delay to prevent state issues
    setTimeout(() => {
      setSelectedPlan(null);
    }, 300);
  };

  const handleExercisePress = (exerciseName: string) => {
    const exerciseData = getExerciseData(exerciseName);
    setSelectedExercise({ name: exerciseName, ...exerciseData });
    setVideoLoading(true);
    setVideoError(false);
    setShowExerciseModal(true);
  };

  const handleCloseExerciseModal = async () => {
    // Stop video before closing
    if (videoRef.current) {
      try {
        await videoRef.current.stopAsync();
      } catch (e) {}
    }
    setShowExerciseModal(false);
    setTimeout(() => {
      setSelectedExercise(null);
      setVideoLoading(true);
      setVideoError(false);
    }, 300);
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
      Alert.alert('Plan Activated!', 'Your progress will be tracked here. Come back daily to complete your workouts!');
      handleClosePlanDetail();
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

  const getVideoForCategory = (category: string) => {
    return WORKOUT_VIDEOS[category as keyof typeof WORKOUT_VIDEOS] || WORKOUT_VIDEOS.strength;
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
            <View style={{ flex: 1 }}>
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
        
        <View style={styles.todayWorkout}>
          <Text style={[styles.todayLabel, { color: colors.text.primary }]}>Today's Workout</Text>
          {activePlan.days && activePlan.progress?.current_day <= activePlan.days.length ? (
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
                    {activePlan.days[(activePlan.progress?.current_day || 1) - 1]?.name}
                  </Text>
                  <Text style={[styles.todayWorkoutMeta, { color: colors.text.secondary }]}>
                    {activePlan.days[(activePlan.progress?.current_day || 1) - 1]?.duration_minutes} min • {activePlan.days[(activePlan.progress?.current_day || 1) - 1]?.exercises?.length} exercises
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
            <View style={[styles.completedBanner, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="trophy" size={32} color="#10B981" />
              <Text style={[styles.completedText, { color: '#10B981' }]}>
                🎉 Congratulations! You've completed this plan!
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.header, { color: colors.text.primary }]}>Workout Plans</Text>
        
        {renderActivePlanProgress()}
        
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
            <TouchableOpacity 
              key={plan.plan_id}
              style={[styles.planCard, { backgroundColor: colors.background.card }]}
              onPress={() => handlePlanPress(plan)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={getGoalGradient(plan.goal)}
                style={styles.planCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.planCardHeader}>
                  <View style={styles.planBadge}>
                    {plan.is_ai_generated && (
                      <View style={styles.aiBadge}>
                        <MaterialCommunityIcons name="robot" size={12} color="#fff" />
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    )}
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelText}>{plan.level?.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
                </View>
                
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription} numberOfLines={2}>{plan.description}</Text>
                
                <View style={styles.planMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.metaText}>{plan.duration_weeks} weeks</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="fitness" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.metaText}>{plan.days?.length || 0} days</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Plan Detail Modal */}
      <Modal
        visible={showPlanDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClosePlanDetail}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
          {selectedPlan && (
            <>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
                <TouchableOpacity onPress={handleClosePlanDetail} style={styles.closeButton}>
                  <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
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
                                <Text style={[styles.exerciseHint, { color: colors.text.secondary }]}>Tap for video tutorial</Text>
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
                    <Text style={styles.activePlanBannerText}>This is your active plan</Text>
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Exercise Tutorial Modal */}
      <Modal
        visible={showExerciseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseExerciseModal}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
          {selectedExercise && (
            <>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
                <TouchableOpacity onPress={handleCloseExerciseModal} style={styles.closeButton}>
                  <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{selectedExercise.name}</Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Video Player */}
                <View style={styles.mediaContainer}>
                  {videoLoading && (
                    <View style={styles.videoLoading}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={styles.videoLoadingText}>Loading video...</Text>
                    </View>
                  )}
                  
                  {videoError ? (
                    <View style={styles.videoErrorContainer}>
                      <Image 
                        source={{ uri: selectedExercise.image }}
                        style={styles.exerciseFullImage}
                        resizeMode="cover"
                      />
                      <View style={styles.videoErrorOverlay}>
                        <Ionicons name="image" size={32} color="#fff" />
                        <Text style={styles.videoErrorText}>See instructions below</Text>
                      </View>
                    </View>
                  ) : (
                    <Video
                      ref={videoRef}
                      source={{ uri: getVideoForCategory(selectedExercise.category) }}
                      style={styles.exerciseVideo}
                      useNativeControls
                      resizeMode={ResizeMode.COVER}
                      isLooping
                      shouldPlay={false}
                      onLoadStart={() => setVideoLoading(true)}
                      onLoad={() => setVideoLoading(false)}
                      onError={() => {
                        setVideoLoading(false);
                        setVideoError(true);
                      }}
                    />
                  )}
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                  <Text style={[styles.instructionsTitle, { color: colors.text.primary }]}>
                    How to Perform {selectedExercise.name}
                  </Text>
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
                      Focus on controlled movements and proper form. Quality over quantity will give you better results and prevent injuries!
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
  loadingText: { marginTop: 12, fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { fontSize: 28, fontWeight: '800', marginBottom: 20 },
  sectionHeader: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 16 },
  // Active Plan
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
  completedBanner: { padding: 20, borderRadius: 12, alignItems: 'center' },
  completedText: { fontSize: 16, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  // Plan Card
  planCard: { borderRadius: 20, marginBottom: 16, overflow: 'hidden' },
  planCardGradient: { padding: 20 },
  planCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planBadge: { flexDirection: 'row', gap: 8 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  levelBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
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
  activePlanBannerText: { fontSize: 16, fontWeight: '600', color: '#10B981' },
  // Exercise Tutorial Modal
  mediaContainer: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000', position: 'relative' },
  exerciseVideo: { width: '100%', height: '100%' },
  exerciseFullImage: { width: '100%', height: '100%' },
  videoLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  videoLoadingText: { color: '#fff', marginTop: 8, fontSize: 14 },
  videoErrorContainer: { width: '100%', height: '100%', position: 'relative' },
  videoErrorOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center' },
  videoErrorText: { color: '#fff', marginTop: 4, fontSize: 14 },
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

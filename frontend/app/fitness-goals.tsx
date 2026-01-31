import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useThemeStore } from '../stores/themeStore';
import { useUserStore } from '../stores/userStore';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width, height } = Dimensions.get('window');

// Motivational workout image
const MOTIVATION_IMAGE = 'https://images.unsplash.com/photo-1595078475328-1ab05d0a6a0e?w=800&q=80';

interface FitnessGoal {
  id: string;
  title: string;
  description: string;
  icon: string;
  workoutType: string;
  color: string;
}

const FITNESS_GOALS: FitnessGoal[] = [
  {
    id: 'weight_loss',
    title: 'Lose Weight',
    description: 'Burn fat and slim down with cardio & HIIT workouts',
    icon: 'flame',
    workoutType: 'hiit',
    color: '#EF4444',
  },
  {
    id: 'muscle_gain',
    title: 'Build Muscle',
    description: 'Strength training to build lean muscle mass',
    icon: 'barbell',
    workoutType: 'strength',
    color: '#3B82F6',
  },
  {
    id: 'endurance',
    title: 'Improve Endurance',
    description: 'Boost stamina with cardio and circuit training',
    icon: 'pulse',
    workoutType: 'cardio',
    color: '#10B981',
  },
  {
    id: 'flexibility',
    title: 'Increase Flexibility',
    description: 'Yoga and stretching for mobility and recovery',
    icon: 'body',
    workoutType: 'flexibility',
    color: '#8B5CF6',
  },
  {
    id: 'tone',
    title: 'Tone & Define',
    description: 'Full body workouts for a lean, toned physique',
    icon: 'fitness',
    workoutType: 'full_body',
    color: '#F59E0B',
  },
  {
    id: 'general',
    title: 'General Fitness',
    description: 'All-around fitness with varied workout routines',
    icon: 'heart',
    workoutType: 'general',
    color: '#EC4899',
  },
];

export default function FitnessGoalsScreen() {
  const { theme } = useThemeStore();
  const { userId, setProfile } = useUserStore();
  const colors = theme.colors;
  const accent = theme.accentColors;
  
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [planGenerating, setPlanGenerating] = useState(false);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev => {
      if (prev.includes(goalId)) {
        return prev.filter(g => g !== goalId);
      }
      // Allow up to 3 goals
      if (prev.length >= 3) {
        Alert.alert('Limit Reached', 'You can select up to 3 fitness goals');
        return prev;
      }
      return [...prev, goalId];
    });
  };

  const generateAIPlan = async (goals: string[]) => {
    setPlanGenerating(true);
    try {
      const selectedGoalDetails = FITNESS_GOALS.filter(g => goals.includes(g.id));
      const goalDescriptions = selectedGoalDetails.map(g => g.title).join(', ');
      
      // Generate a temporary user ID if not logged in yet
      const effectiveUserId = userId || `temp_user_${Date.now()}`;
      
      // Generate AI workout plan based on goals
      const response = await axios.post(`${API_URL}/api/ai/generate-workout-plan`, {
        user_id: effectiveUserId,
        goals: goals,
        goal_descriptions: goalDescriptions,
        workout_types: selectedGoalDetails.map(g => g.workoutType),
      });
      
      if (response.data.success && response.data.plan) {
        setGeneratedPlan(response.data.plan);
        return response.data.plan;
      }
      return null;
    } catch (error) {
      console.error('Error generating AI plan:', error);
      // Create a fallback plan locally if API fails
      const selectedGoalDetails = FITNESS_GOALS.filter(g => goals.includes(g.id));
      const fallbackPlan = {
        name: `My ${selectedGoalDetails[0]?.title || 'Fitness'} Plan`,
        description: `A personalized plan focused on ${selectedGoalDetails.map(g => g.title.toLowerCase()).join(', ')}`,
        duration_weeks: 4,
        type: selectedGoalDetails[0]?.workoutType || 'mixed',
        goal: goals[0] || 'general',
      };
      setGeneratedPlan(fallbackPlan);
      return fallbackPlan;
    } finally {
      setPlanGenerating(false);
    }
  };

  const handleContinue = async () => {
    if (selectedGoals.length === 0) {
      Alert.alert('Select Goals', 'Please select at least one fitness goal');
      return;
    }

    setLoading(true);
    try {
      // Save fitness goals to profile
      if (userId) {
        await axios.post(`${API_URL}/api/profile/fitness-goals`, {
          user_id: userId,
          fitness_goals: selectedGoals,
        });
      }
      
      // Generate AI workout plan
      await generateAIPlan(selectedGoals);
      
      // Show transition modal
      setShowTransition(true);
      
    } catch (error) {
      console.error('Error saving fitness goals:', error);
      // Continue anyway with transition
      setShowTransition(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToPlans = () => {
    setShowTransition(false);
    router.replace('/(tabs)/plans');
  };

  const handleGoToDashboard = () => {
    setShowTransition(false);
    router.replace('/(tabs)');
  };

  const getRecommendedWorkouts = () => {
    const selectedGoalDetails = FITNESS_GOALS.filter(g => selectedGoals.includes(g.id));
    return selectedGoalDetails.map(g => g.workoutType);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={accent.gradient as [string, string]}
            style={styles.headerGradient}
          >
            <MaterialCommunityIcons name="target" size={48} color="#fff" />
            <Text style={styles.headerTitle}>What's Your Goal?</Text>
            <Text style={styles.headerSubtitle}>
              Select up to 3 fitness goals to personalize your workout recommendations
            </Text>
          </LinearGradient>
        </View>

        {/* Goals Grid */}
        <View style={styles.goalsContainer}>
          {FITNESS_GOALS.map((goal) => {
            const isSelected = selectedGoals.includes(goal.id);
            return (
              <TouchableOpacity
                key={goal.id}
                style={[
                  styles.goalCard,
                  { backgroundColor: colors.background.card },
                  isSelected && { borderColor: goal.color, borderWidth: 2 }
                ]}
                onPress={() => toggleGoal(goal.id)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={[styles.selectedBadge, { backgroundColor: goal.color }]}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
                <View style={[styles.goalIcon, { backgroundColor: `${goal.color}20` }]}>
                  <Ionicons name={goal.icon as any} size={28} color={goal.color} />
                </View>
                <Text style={[styles.goalTitle, { color: colors.text.primary }]}>
                  {goal.title}
                </Text>
                <Text style={[styles.goalDescription, { color: colors.text.secondary }]}>
                  {goal.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selection Summary */}
        {selectedGoals.length > 0 && (
          <View style={[styles.summary, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>
              Your Selection ({selectedGoals.length}/3)
            </Text>
            <View style={styles.selectedTags}>
              {selectedGoals.map(goalId => {
                const goal = FITNESS_GOALS.find(g => g.id === goalId);
                if (!goal) return null;
                return (
                  <View 
                    key={goalId} 
                    style={[styles.selectedTag, { backgroundColor: `${goal.color}20` }]}
                  >
                    <Ionicons name={goal.icon as any} size={14} color={goal.color} />
                    <Text style={[styles.selectedTagText, { color: goal.color }]}>
                      {goal.title}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={[styles.summaryNote, { color: colors.text.muted }]}>
              We'll create a personalized AI workout plan for you
            </Text>
          </View>
        )}

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: selectedGoals.length > 0 ? accent.primary : colors.background.elevated }
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={[
                styles.continueButtonText,
                { color: selectedGoals.length > 0 ? '#fff' : colors.text.muted }
              ]}>
                Create My Personalized Plan
              </Text>
              <Ionicons 
                name="sparkles" 
                size={20} 
                color={selectedGoals.length > 0 ? '#fff' : colors.text.muted} 
              />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)/profile')}
        >
          <Text style={[styles.skipButtonText, { color: colors.text.muted }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Transition Modal */}
      <Modal
        visible={showTransition}
        animationType="fade"
        transparent={false}
      >
        <View style={styles.transitionContainer}>
          {/* Background Image */}
          <Image
            source={{ uri: MOTIVATION_IMAGE }}
            style={styles.transitionImage}
            resizeMode="cover"
          />
          
          {/* Overlay Gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            style={styles.transitionOverlay}
          >
            {planGenerating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Creating your personalized plan...</Text>
              </View>
            ) : (
              <View style={styles.transitionContent}>
                {/* Success Icon */}
                <View style={styles.successIcon}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.successIconGradient}
                  >
                    <Ionicons name="checkmark" size={40} color="#fff" />
                  </LinearGradient>
                </View>
                
                <Text style={styles.transitionTitle}>Your Plan is Ready!</Text>
                
                <Text style={styles.transitionSubtitle}>
                  We've created a personalized workout plan based on your goals
                </Text>

                {generatedPlan && (
                  <View style={styles.planPreview}>
                    <Text style={styles.planPreviewName}>{generatedPlan.name}</Text>
                    <Text style={styles.planPreviewDesc}>{generatedPlan.description}</Text>
                    <View style={styles.planPreviewMeta}>
                      <View style={styles.planPreviewMetaItem}>
                        <Ionicons name="calendar" size={16} color="#10B981" />
                        <Text style={styles.planPreviewMetaText}>
                          {generatedPlan.duration_weeks || 4} weeks
                        </Text>
                      </View>
                      <View style={styles.planPreviewMetaItem}>
                        <Ionicons name="fitness" size={16} color="#10B981" />
                        <Text style={styles.planPreviewMetaText}>
                          {generatedPlan.type || 'Mixed'} training
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.locationInfo}>
                  <Ionicons name="information-circle" size={20} color="#60A5FA" />
                  <Text style={styles.locationInfoText}>
                    Your plan has been saved to the <Text style={styles.locationHighlight}>Plans</Text> tab at the bottom of your screen
                  </Text>
                </View>

                <Text style={styles.transitionQuestion}>
                  Would you like to view your plan now?
                </Text>

                {/* Action Buttons */}
                <View style={styles.transitionButtons}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleGoToPlans}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.primaryButtonGradient}
                    >
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>Yes, Take Me There</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleGoToDashboard}
                  >
                    <Text style={styles.secondaryButtonText}>
                      No, Take Me to Dashboard
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Motivational Quote */}
                <Text style={styles.motivationalQuote}>
                  "The journey of a thousand miles begins with a single step"
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  headerGradient: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  goalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    position: 'relative',
    marginBottom: 4,
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  summary: {
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  selectedTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryNote: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 10,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
  skipButtonText: {
    fontSize: 14,
  },
  // Transition Modal Styles
  transitionContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  transitionImage: {
    position: 'absolute',
    width: width,
    height: height,
    opacity: 0.6,
  },
  transitionOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  transitionContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 20,
  },
  successIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transitionTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  transitionSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  planPreview: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  planPreviewName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  planPreviewDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
    lineHeight: 20,
  },
  planPreviewMeta: {
    flexDirection: 'row',
    gap: 20,
  },
  planPreviewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planPreviewMetaText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  locationInfoText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  locationHighlight: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  transitionQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  transitionButtons: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  motivationalQuote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 24,
  },
});

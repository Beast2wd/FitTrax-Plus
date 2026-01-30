import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useThemeStore } from '../stores/themeStore';
import { useUserStore } from '../stores/userStore';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

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
      
      // Navigate to profile setup
      router.replace('/(tabs)/profile');
    } catch (error) {
      console.error('Error saving fitness goals:', error);
      // Continue anyway - goals can be set later
      router.replace('/(tabs)/profile');
    } finally {
      setLoading(false);
    }
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
              We'll recommend {getRecommendedWorkouts().join(', ')} workouts for you
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
          <Text style={[
            styles.continueButtonText,
            { color: selectedGoals.length > 0 ? '#fff' : colors.text.muted }
          ]}>
            {loading ? 'Saving...' : 'Continue to Profile Setup'}
          </Text>
          <Ionicons 
            name="arrow-forward" 
            size={20} 
            color={selectedGoals.length > 0 ? '#fff' : colors.text.muted} 
          />
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
});

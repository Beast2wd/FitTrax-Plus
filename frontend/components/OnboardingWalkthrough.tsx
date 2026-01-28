import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: () => void;
}

interface SlideData {
  id: string;
  icon: string;
  iconType: 'ionicons' | 'material' | 'materialcommunity';
  title: string;
  description: string;
  color: string;
  gradient: string[];
}

const slides: SlideData[] = [
  {
    id: 'welcome',
    icon: 'fitness',
    iconType: 'ionicons',
    title: 'Welcome to FitTrax+',
    description: 'Your all-in-one fitness companion. Track workouts, nutrition, heart rate, and more to achieve your health goals.',
    color: '#EC4899',
    gradient: ['#EC4899', '#BE185D'],
  },
  {
    id: 'workouts',
    icon: 'barbell',
    iconType: 'ionicons',
    title: 'Log Workouts',
    description: 'Track your exercises manually or use our AI Workout Coach to create personalized workout plans tailored to your goals.',
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#6D28D9'],
  },
  {
    id: 'nutrition',
    icon: 'restaurant',
    iconType: 'ionicons',
    title: 'Scan & Track Food',
    description: 'Simply take a photo of your meal and our AI will analyze the nutritional content including calories, protein, carbs, fat, and sugar.',
    color: '#10B981',
    gradient: ['#10B981', '#059669'],
  },
  {
    id: 'running',
    icon: 'run',
    iconType: 'materialcommunity',
    title: 'Track Your Runs',
    description: 'Use GPS tracking to monitor your runs with real-time distance, pace, and route mapping. View your running history and progress.',
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706'],
  },
  {
    id: 'heart',
    icon: 'favorite',
    iconType: 'material',
    title: 'Heart Rate Monitoring',
    description: 'Log your heart rate readings to track cardiovascular health. View trends and insights over time.',
    color: '#EF4444',
    gradient: ['#EF4444', '#DC2626'],
  },
  {
    id: 'schedule',
    icon: 'calendar',
    iconType: 'ionicons',
    title: 'Schedule Workouts',
    description: 'Plan your fitness routine by scheduling workouts on your calendar. Set reminders so you never miss a session.',
    color: '#3B82F6',
    gradient: ['#3B82F6', '#2563EB'],
  },
  {
    id: 'hydration',
    icon: 'water',
    iconType: 'ionicons',
    title: 'Stay Hydrated',
    description: 'Track your daily water intake with quick-add buttons. Stay on top of your hydration goals throughout the day.',
    color: '#06B6D4',
    gradient: ['#06B6D4', '#0891B2'],
  },
  {
    id: 'progress',
    icon: 'trending-up',
    iconType: 'ionicons',
    title: 'Track Progress',
    description: 'View your fitness journey with detailed stats, achievements, and progress charts. Celebrate your milestones!',
    color: '#84CC16',
    gradient: ['#84CC16', '#65A30D'],
  },
];

export default function OnboardingWalkthrough({ onComplete }: OnboardingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(currentIndex + 1);
        scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: false });
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    if (dontShowAgain) {
      await AsyncStorage.setItem('onboarding_completed', 'true');
    }
    onComplete();
  };

  const handleDotPress = (index: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(index);
      scrollViewRef.current?.scrollTo({ x: index * width, animated: false });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const renderIcon = (slide: SlideData) => {
    const iconSize = 80;
    switch (slide.iconType) {
      case 'material':
        return <MaterialIcons name={slide.icon as any} size={iconSize} color="#FFFFFF" />;
      case 'materialcommunity':
        return <MaterialCommunityIcons name={slide.icon as any} size={iconSize} color="#FFFFFF" />;
      default:
        return <Ionicons name={slide.icon as any} size={iconSize} color="#FFFFFF" />;
    }
  };

  const currentSlide = slides[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={currentSlide.gradient}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Content */}
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              {renderIcon(currentSlide)}
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{currentSlide.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{currentSlide.description}</Text>

          {/* Page Counter */}
          <Text style={styles.pageCounter}>
            {currentIndex + 1} of {slides.length}
          </Text>
        </Animated.View>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleDotPress(index)}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        {/* Don't Show Again Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setDontShowAgain(!dontShowAgain)}
        >
          <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
            {dontShowAgain && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>Don't show this again</Text>
        </TouchableOpacity>

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => handleDotPress(currentIndex - 1)}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.nextButton, currentIndex === 0 && styles.nextButtonFull]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
            </Text>
            <Ionicons 
              name={currentIndex === slides.length - 1 ? "checkmark" : "arrow-forward"} 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 10,
  },
  pageCounter: {
    marginTop: 24,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 6,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  checkboxLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

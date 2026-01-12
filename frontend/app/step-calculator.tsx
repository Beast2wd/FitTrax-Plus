import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '../stores/userStore';
import { useThemeStore } from '../stores/themeStore';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Constants for step calculations
const CALORIES_PER_STEP_BASE = 0.04;
const CALORIES_PER_POUND = 3500;

// Ring Chart Component
interface RingChartProps {
  progress: number; // 0 to 1
  size: number;
  strokeWidth: number;
  currentSteps: number;
  goalSteps: number;
  colors: any;
  accentGradient: string[];
}

const RingChart: React.FC<RingChartProps> = ({ 
  progress, 
  size, 
  strokeWidth, 
  currentSteps, 
  goalSteps, 
  colors,
  accentGradient 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(progress, 1) * circumference);
  const center = size / 2;

  return (
    <View style={styles.ringContainer}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={accentGradient[0]} />
            <Stop offset="100%" stopColor={accentGradient[1]} />
          </SvgLinearGradient>
        </Defs>
        {/* Background Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.background.elevated}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={[styles.ringContent, { width: size, height: size }]}>
        <MaterialCommunityIcons name="shoe-print" size={28} color={accentGradient[0]} />
        <Text style={[styles.ringSteps, { color: colors.text.primary }]}>
          {currentSteps.toLocaleString()}
        </Text>
        <Text style={[styles.ringGoal, { color: colors.text.muted }]}>
          of {goalSteps.toLocaleString()}
        </Text>
        <Text style={[styles.ringPercent, { color: accentGradient[0] }]}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </View>
  );
};

export default function StepCalculatorScreen() {
  const { profile } = useUserStore();
  const { theme } = useThemeStore();
  const colors = theme.colors;
  const accent = theme.accentColors;

  // User data from profile
  const [weight, setWeight] = useState(profile?.weight?.toString() || '150');
  const [goalWeight, setGoalWeight] = useState(profile?.goal_weight?.toString() || '140');
  const [heightFeet, setHeightFeet] = useState(profile?.height_feet?.toString() || '5');
  const [heightInches, setHeightInches] = useState(profile?.height_inches?.toString() || '8');
  const [age, setAge] = useState(profile?.age?.toString() || '30');
  const [gender, setGender] = useState(profile?.gender || 'male');
  const [activityLevel, setActivityLevel] = useState(profile?.activity_level || 'moderate');

  // Manual adjustment states
  const [manualStepGoal, setManualStepGoal] = useState('');
  const [manualWeeksToGoal, setManualWeeksToGoal] = useState('');
  const [useManualSteps, setUseManualSteps] = useState(false);
  const [useManualTimeline, setUseManualTimeline] = useState(false);

  // Today's steps (simulated - user would input this)
  const [todaysSteps, setTodaysSteps] = useState('0');

  // Calculated values
  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [caloriesPerStep, setCaloriesPerStep] = useState(0);
  const [calculatedDailyStepGoal, setCalculatedDailyStepGoal] = useState(0);
  const [dailyStepGoal, setDailyStepGoal] = useState(0);
  const [weeklySteps, setWeeklySteps] = useState(0);
  const [monthlySteps, setMonthlySteps] = useState(0);
  const [daysToGoal, setDaysToGoal] = useState(0);
  const [weightToLose, setWeightToLose] = useState(0);
  const [extraCaloriesToBurn, setExtraCaloriesToBurn] = useState(0);

  // Calculate BMR using Mifflin-St Jeor Equation
  const calculateBMR = () => {
    const weightKg = parseFloat(weight) * 0.453592;
    const heightCm = (parseFloat(heightFeet) * 12 + parseFloat(heightInches)) * 2.54;
    const ageYears = parseFloat(age);

    if (gender === 'male') {
      return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
    } else {
      return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
    }
  };

  // Calculate calories burned per step based on weight
  const calculateCaloriesPerStep = () => {
    const weightLbs = parseFloat(weight);
    return CALORIES_PER_STEP_BASE * (weightLbs / 150);
  };

  // Main calculation function
  const calculateStepGoals = () => {
    const currentWeight = parseFloat(weight) || 150;
    const targetWeight = parseFloat(goalWeight) || currentWeight;
    
    const calculatedBMR = calculateBMR();
    const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
    const calculatedTDEE = calculatedBMR * activityMultiplier;
    
    setBmr(Math.round(calculatedBMR));
    setTdee(Math.round(calculatedTDEE));

    const calsPerStep = calculateCaloriesPerStep();
    setCaloriesPerStep(calsPerStep);

    const weightDiff = currentWeight - targetWeight;
    setWeightToLose(Math.max(0, weightDiff));

    let computedDailySteps = 10000;
    let computedDays = 0;

    if (weightDiff > 0) {
      // Calculate based on timeline if manual
      if (useManualTimeline && manualWeeksToGoal) {
        const weeks = parseFloat(manualWeeksToGoal) || 12;
        computedDays = Math.round(weeks * 7);
        
        // Calculate lbs per week based on timeline
        const lbsPerWeek = weightDiff / weeks;
        // Calculate daily calorie deficit needed
        const dailyDeficit = (lbsPerWeek * CALORIES_PER_POUND) / 7;
        // Half from steps, half from diet
        const stepsDeficit = dailyDeficit / 2;
        const stepsNeeded = Math.round(stepsDeficit / calsPerStep);
        computedDailySteps = Math.max(stepsNeeded + 5000, 8000);
      } else {
        // Standard calculation: 1 lb per week
        const targetDailyCaloriesBurnedFromSteps = 500;
        setExtraCaloriesToBurn(targetDailyCaloriesBurnedFromSteps);
        const stepsNeeded = Math.round(targetDailyCaloriesBurnedFromSteps / calsPerStep);
        computedDailySteps = Math.max(stepsNeeded + 5000, 8000);
        
        const weeksToGoal = weightDiff / 1;
        computedDays = Math.round(weeksToGoal * 7);
      }
    }

    setCalculatedDailyStepGoal(computedDailySteps);
    
    // Use manual step goal if set
    const finalStepGoal = useManualSteps && manualStepGoal 
      ? parseInt(manualStepGoal) || computedDailySteps 
      : computedDailySteps;
    
    setDailyStepGoal(finalStepGoal);
    setWeeklySteps(finalStepGoal * 7);
    setMonthlySteps(finalStepGoal * 30);

    // Recalculate days to goal based on manual steps if needed
    if (useManualSteps && manualStepGoal && weightDiff > 0) {
      const steps = parseInt(manualStepGoal) || 10000;
      const dailyCaloriesBurned = (steps - 5000) * calsPerStep; // Steps above baseline
      const lbsPerWeek = (dailyCaloriesBurned * 7) / CALORIES_PER_POUND;
      if (lbsPerWeek > 0) {
        const weeks = weightDiff / lbsPerWeek;
        setDaysToGoal(Math.round(weeks * 7));
      } else {
        setDaysToGoal(0);
      }
    } else if (useManualTimeline && manualWeeksToGoal) {
      setDaysToGoal(computedDays);
    } else {
      setDaysToGoal(computedDays);
    }
  };

  useEffect(() => {
    calculateStepGoals();
  }, [weight, goalWeight, heightFeet, heightInches, age, gender, activityLevel, 
      manualStepGoal, manualWeeksToGoal, useManualSteps, useManualTimeline]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDaysToGoal = (days: number) => {
    if (days <= 0) return "You're at your goal! 🎉";
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.round(days / 7)} weeks`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${(days / 365).toFixed(1)} years`;
  };

  const getGoalDate = (days: number) => {
    if (days <= 0) return null;
    const goalDate = new Date();
    goalDate.setDate(goalDate.getDate() + days);
    return goalDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Calculate ring progress
  const currentStepsNum = parseInt(todaysSteps) || 0;
  const ringProgress = dailyStepGoal > 0 ? currentStepsNum / dailyStepGoal : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={accent.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Step Calculator</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Ring Chart Progress Card */}
          <View style={[styles.ringCard, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.ringCardTitle, { color: colors.text.primary }]}>
              Today's Progress
            </Text>
            
            <RingChart
              progress={ringProgress}
              size={200}
              strokeWidth={16}
              currentSteps={currentStepsNum}
              goalSteps={dailyStepGoal}
              colors={colors}
              accentGradient={accent.gradient as string[]}
            />

            {/* Today's Steps Input */}
            <View style={styles.todayStepsInput}>
              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>
                Enter Today's Steps
              </Text>
              <View style={[styles.stepsInputContainer, { backgroundColor: colors.background.input, borderColor: colors.border.primary }]}>
                <MaterialCommunityIcons name="shoe-print" size={20} color={accent.primary} />
                <TextInput
                  style={[styles.stepsInput, { color: colors.text.primary }]}
                  value={todaysSteps}
                  onChangeText={setTodaysSteps}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                />
                <Text style={[styles.stepsUnit, { color: colors.text.muted }]}>steps</Text>
              </View>
            </View>

            {/* Quick Add Buttons */}
            <View style={styles.quickAddRow}>
              {[1000, 2500, 5000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[styles.quickAddButton, { backgroundColor: colors.background.elevated }]}
                  onPress={() => {
                    const current = parseInt(todaysSteps) || 0;
                    setTodaysSteps((current + amount).toString());
                  }}
                >
                  <Text style={[styles.quickAddText, { color: accent.primary }]}>+{amount.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Daily Step Goal Card - Adjustable */}
          <View style={[styles.goalCard, { backgroundColor: colors.background.card }]}>
            <View style={styles.goalHeader}>
              <View style={[styles.goalIcon, { backgroundColor: `${accent.primary}20` }]}>
                <Ionicons name="flag" size={24} color={accent.primary} />
              </View>
              <View style={styles.goalInfo}>
                <Text style={[styles.goalTitle, { color: colors.text.primary }]}>Daily Step Goal</Text>
                <Text style={[styles.goalSubtitle, { color: colors.text.muted }]}>
                  {useManualSteps ? 'Custom goal' : 'Based on your profile'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleButton, useManualSteps && { backgroundColor: accent.primary }]}
                onPress={() => setUseManualSteps(!useManualSteps)}
              >
                <Text style={[styles.toggleText, { color: useManualSteps ? '#fff' : colors.text.secondary }]}>
                  {useManualSteps ? 'Custom' : 'Auto'}
                </Text>
              </TouchableOpacity>
            </View>

            {useManualSteps ? (
              <View style={styles.manualInputSection}>
                <View style={[styles.largeInputContainer, { backgroundColor: colors.background.input, borderColor: accent.primary }]}>
                  <TextInput
                    style={[styles.largeInput, { color: colors.text.primary }]}
                    value={manualStepGoal}
                    onChangeText={setManualStepGoal}
                    keyboardType="numeric"
                    placeholder={calculatedDailyStepGoal.toString()}
                    placeholderTextColor={colors.text.muted}
                  />
                  <Text style={[styles.largeInputUnit, { color: colors.text.muted }]}>steps/day</Text>
                </View>
                <Text style={[styles.suggestionText, { color: colors.text.muted }]}>
                  Suggested: {formatNumber(calculatedDailyStepGoal)} steps
                </Text>
              </View>
            ) : (
              <View style={styles.autoGoalDisplay}>
                <Text style={[styles.autoGoalValue, { color: accent.primary }]}>
                  {formatNumber(dailyStepGoal)}
                </Text>
                <Text style={[styles.autoGoalUnit, { color: colors.text.muted }]}>steps per day</Text>
              </View>
            )}

            <View style={styles.projectionRow}>
              <View style={styles.projectionItem}>
                <Text style={[styles.projectionValue, { color: colors.text.primary }]}>
                  {formatNumber(weeklySteps)}
                </Text>
                <Text style={[styles.projectionLabel, { color: colors.text.muted }]}>weekly</Text>
              </View>
              <View style={[styles.projectionDivider, { backgroundColor: colors.border.primary }]} />
              <View style={styles.projectionItem}>
                <Text style={[styles.projectionValue, { color: colors.text.primary }]}>
                  {formatNumber(monthlySteps)}
                </Text>
                <Text style={[styles.projectionLabel, { color: colors.text.muted }]}>monthly</Text>
              </View>
            </View>
          </View>

          {/* Timeline to Goal Card - Adjustable */}
          {weightToLose > 0 && (
            <View style={[styles.timelineCard, { backgroundColor: colors.background.card }]}>
              <View style={styles.goalHeader}>
                <View style={[styles.goalIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Ionicons name="calendar" size={24} color="#F59E0B" />
                </View>
                <View style={styles.goalInfo}>
                  <Text style={[styles.goalTitle, { color: colors.text.primary }]}>Time to Goal</Text>
                  <Text style={[styles.goalSubtitle, { color: colors.text.muted }]}>
                    {useManualTimeline ? 'Custom timeline' : 'Safe weight loss pace'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleButton, useManualTimeline && { backgroundColor: '#F59E0B' }]}
                  onPress={() => setUseManualTimeline(!useManualTimeline)}
                >
                  <Text style={[styles.toggleText, { color: useManualTimeline ? '#fff' : colors.text.secondary }]}>
                    {useManualTimeline ? 'Custom' : 'Auto'}
                  </Text>
                </TouchableOpacity>
              </View>

              {useManualTimeline ? (
                <View style={styles.manualInputSection}>
                  <View style={[styles.largeInputContainer, { backgroundColor: colors.background.input, borderColor: '#F59E0B' }]}>
                    <TextInput
                      style={[styles.largeInput, { color: colors.text.primary }]}
                      value={manualWeeksToGoal}
                      onChangeText={setManualWeeksToGoal}
                      keyboardType="numeric"
                      placeholder={Math.round(daysToGoal / 7).toString()}
                      placeholderTextColor={colors.text.muted}
                    />
                    <Text style={[styles.largeInputUnit, { color: colors.text.muted }]}>weeks</Text>
                  </View>
                  {manualWeeksToGoal && (
                    <Text style={[styles.suggestionText, { color: colors.text.muted }]}>
                      That's {(weightToLose / (parseFloat(manualWeeksToGoal) || 1)).toFixed(1)} lbs/week
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.autoGoalDisplay}>
                  <Text style={[styles.autoGoalValue, { color: '#F59E0B' }]}>
                    {formatDaysToGoal(daysToGoal)}
                  </Text>
                  <Text style={[styles.autoGoalUnit, { color: colors.text.muted }]}>at 1 lb/week</Text>
                </View>
              )}

              {getGoalDate(daysToGoal) && (
                <View style={[styles.goalDateBanner, { backgroundColor: colors.background.elevated }]}>
                  <Ionicons name="flag-outline" size={18} color="#F59E0B" />
                  <Text style={[styles.goalDateText, { color: colors.text.secondary }]}>
                    Goal Date: <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
                      {getGoalDate(daysToGoal)}
                    </Text>
                  </Text>
                </View>
              )}

              <View style={styles.weightProgress}>
                <View style={styles.weightItem}>
                  <Text style={[styles.weightLabel, { color: colors.text.muted }]}>Current</Text>
                  <Text style={[styles.weightValue, { color: colors.text.primary }]}>{weight} lbs</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={accent.primary} />
                <View style={styles.weightItem}>
                  <Text style={[styles.weightLabel, { color: colors.text.muted }]}>Goal</Text>
                  <Text style={[styles.weightValue, { color: accent.primary }]}>{goalWeight} lbs</Text>
                </View>
                <View style={styles.weightItem}>
                  <Text style={[styles.weightLabel, { color: colors.text.muted }]}>To Lose</Text>
                  <Text style={[styles.weightValue, { color: '#EF4444' }]}>{weightToLose.toFixed(1)} lbs</Text>
                </View>
              </View>
            </View>
          )}

          {/* Calculation Details */}
          <View style={[styles.detailsCard, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Your Metrics
            </Text>
            
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="flame-outline" size={20} color={colors.text.secondary} />
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>BMR</Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {formatNumber(bmr)} cal/day
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="trending-up-outline" size={20} color={colors.text.secondary} />
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>TDEE</Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {formatNumber(tdee)} cal/day
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons name="shoe-print" size={20} color={colors.text.secondary} />
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Cal/Step</Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {caloriesPerStep.toFixed(3)}
              </Text>
            </View>
          </View>

          {/* User Input Section */}
          <View style={[styles.inputCard, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Your Details
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Current Weight</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background.input, borderColor: colors.border.primary }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="150"
                    placeholderTextColor={colors.text.muted}
                  />
                  <Text style={[styles.inputUnit, { color: colors.text.muted }]}>lbs</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Goal Weight</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background.input, borderColor: colors.border.primary }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    value={goalWeight}
                    onChangeText={setGoalWeight}
                    keyboardType="numeric"
                    placeholder="140"
                    placeholderTextColor={colors.text.muted}
                  />
                  <Text style={[styles.inputUnit, { color: colors.text.muted }]}>lbs</Text>
                </View>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Height (ft)</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background.input, borderColor: colors.border.primary }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    value={heightFeet}
                    onChangeText={setHeightFeet}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor={colors.text.muted}
                  />
                  <Text style={[styles.inputUnit, { color: colors.text.muted }]}>ft</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Height (in)</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background.input, borderColor: colors.border.primary }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    value={heightInches}
                    onChangeText={setHeightInches}
                    keyboardType="numeric"
                    placeholder="8"
                    placeholderTextColor={colors.text.muted}
                  />
                  <Text style={[styles.inputUnit, { color: colors.text.muted }]}>in</Text>
                </View>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Age</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background.input, borderColor: colors.border.primary }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={colors.text.muted}
                  />
                  <Text style={[styles.inputUnit, { color: colors.text.muted }]}>yrs</Text>
                </View>
              </View>
              <View style={styles.inputGroup} />
            </View>

            {/* Gender Selection */}
            <View style={styles.selectionSection}>
              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Gender</Text>
              <View style={styles.selectionRow}>
                <TouchableOpacity
                  style={[
                    styles.selectionButton,
                    { borderColor: colors.border.primary },
                    gender === 'male' && { backgroundColor: accent.primary, borderColor: accent.primary }
                  ]}
                  onPress={() => setGender('male')}
                >
                  <Ionicons name="male" size={20} color={gender === 'male' ? '#fff' : colors.text.secondary} />
                  <Text style={[styles.selectionText, { color: gender === 'male' ? '#fff' : colors.text.secondary }]}>Male</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.selectionButton,
                    { borderColor: colors.border.primary },
                    gender === 'female' && { backgroundColor: accent.primary, borderColor: accent.primary }
                  ]}
                  onPress={() => setGender('female')}
                >
                  <Ionicons name="female" size={20} color={gender === 'female' ? '#fff' : colors.text.secondary} />
                  <Text style={[styles.selectionText, { color: gender === 'female' ? '#fff' : colors.text.secondary }]}>Female</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Activity Level Selection */}
            <View style={styles.selectionSection}>
              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Activity Level</Text>
              <View style={styles.activityGrid}>
                {[
                  { key: 'sedentary', label: 'Sedentary', desc: 'Little/no exercise' },
                  { key: 'light', label: 'Light', desc: '1-3 days/week' },
                  { key: 'moderate', label: 'Moderate', desc: '3-5 days/week' },
                  { key: 'active', label: 'Active', desc: '6-7 days/week' },
                  { key: 'very_active', label: 'Very Active', desc: 'Athlete level' },
                ].map((level) => (
                  <TouchableOpacity
                    key={level.key}
                    style={[
                      styles.activityButton,
                      { backgroundColor: colors.background.elevated, borderColor: colors.border.primary },
                      activityLevel === level.key && { backgroundColor: accent.primary, borderColor: accent.primary }
                    ]}
                    onPress={() => setActivityLevel(level.key)}
                  >
                    <Text style={[
                      styles.activityLabel,
                      { color: activityLevel === level.key ? '#fff' : colors.text.primary }
                    ]}>{level.label}</Text>
                    <Text style={[
                      styles.activityDesc,
                      { color: activityLevel === level.key ? 'rgba(255,255,255,0.8)' : colors.text.muted }
                    ]}>{level.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Tips Card */}
          <View style={[styles.tipsCard, { backgroundColor: colors.background.card }]}>
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb" size={24} color="#F59E0B" />
              <Text style={[styles.tipsTitle, { color: colors.text.primary }]}>Tips to Reach Your Goal</Text>
            </View>
            
            {[
              'Take the stairs instead of the elevator',
              'Park farther away from entrances',
              'Take a 10-minute walk after each meal',
              'Walk while on phone calls',
            ].map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={[styles.tipText, { color: colors.text.secondary }]}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  // Ring Chart Styles
  ringCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  ringCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  ringContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSteps: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  ringGoal: {
    fontSize: 13,
    marginTop: 2,
  },
  ringPercent: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  todayStepsInput: {
    width: '100%',
    marginTop: 20,
  },
  stepsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
  },
  stepsInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  stepsUnit: {
    fontSize: 14,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  quickAddButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Goal Card Styles
  goalCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  goalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manualInputSection: {
    marginBottom: 16,
  },
  largeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  largeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
  },
  largeInputUnit: {
    fontSize: 14,
  },
  suggestionText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  autoGoalDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  autoGoalValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  autoGoalUnit: {
    fontSize: 14,
    marginTop: 4,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  projectionItem: {
    flex: 1,
    alignItems: 'center',
  },
  projectionValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  projectionLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  projectionDivider: {
    width: 1,
    height: 36,
  },
  // Timeline Card
  timelineCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  goalDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  goalDateText: {
    fontSize: 14,
  },
  weightProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  weightItem: {
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 11,
  },
  weightValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  // Details Card
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Input Card
  inputCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  inputUnit: {
    fontSize: 14,
    marginLeft: 4,
  },
  selectionSection: {
    marginBottom: 16,
  },
  selectionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  activityGrid: {
    gap: 8,
  },
  activityButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  activityLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  activityDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  // Tips Card
  tipsCard: {
    borderRadius: 16,
    padding: 20,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tipBullet: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '700',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

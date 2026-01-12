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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '../stores/userStore';
import { useThemeStore } from '../stores/themeStore';
import { LinearGradient } from 'expo-linear-gradient';

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Constants for step calculations
const CALORIES_PER_STEP_BASE = 0.04; // Base calories per step (will be adjusted by weight)
const STEPS_PER_MILE = 2000;
const CALORIES_PER_POUND = 3500; // Calories needed to lose 1 pound

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

  // Calculated values
  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [caloriesPerStep, setCaloriesPerStep] = useState(0);
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
    // Heavier people burn more calories per step
    // Formula: base calories * (weight / 150) - scales linearly with weight
    return CALORIES_PER_STEP_BASE * (weightLbs / 150);
  };

  // Main calculation function
  const calculateStepGoals = () => {
    const currentWeight = parseFloat(weight) || 150;
    const targetWeight = parseFloat(goalWeight) || currentWeight;
    
    // Calculate BMR and TDEE
    const calculatedBMR = calculateBMR();
    const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
    const calculatedTDEE = calculatedBMR * activityMultiplier;
    
    setBmr(Math.round(calculatedBMR));
    setTdee(Math.round(calculatedTDEE));

    // Calculate calories per step
    const calsPerStep = calculateCaloriesPerStep();
    setCaloriesPerStep(calsPerStep);

    // Calculate weight to lose
    const weightDiff = currentWeight - targetWeight;
    setWeightToLose(Math.max(0, weightDiff));

    if (weightDiff <= 0) {
      // Already at or below goal weight
      setDailyStepGoal(10000); // Default healthy goal
      setWeeklySteps(70000);
      setMonthlySteps(300000);
      setDaysToGoal(0);
      setExtraCaloriesToBurn(0);
      return;
    }

    // Calculate total calories needed to burn to lose the weight
    const totalCaloriesToBurn = weightDiff * CALORIES_PER_POUND;

    // For safe weight loss (1-2 lbs per week), target 500-1000 calorie deficit per day
    // We'll use 500 calorie deficit from steps (rest from diet)
    const targetDailyCaloriesBurnedFromSteps = 500;
    setExtraCaloriesToBurn(targetDailyCaloriesBurnedFromSteps);

    // Calculate daily steps needed to burn extra calories
    const stepsNeeded = Math.round(targetDailyCaloriesBurnedFromSteps / calsPerStep);
    
    // Add baseline steps for general health (assuming 5000 baseline activity)
    const totalDailySteps = Math.max(stepsNeeded + 5000, 8000); // Minimum 8000
    setDailyStepGoal(totalDailySteps);

    // Weekly and monthly projections
    setWeeklySteps(totalDailySteps * 7);
    setMonthlySteps(totalDailySteps * 30);

    // Calculate days to reach goal
    // At 500 calorie deficit per day = 1 lb per week
    const weeksToGoal = weightDiff / 1; // 1 lb per week
    const calculatedDays = Math.round(weeksToGoal * 7);
    setDaysToGoal(calculatedDays);
  };

  // Recalculate when inputs change
  useEffect(() => {
    calculateStepGoals();
  }, [weight, goalWeight, heightFeet, heightInches, age, gender, activityLevel]);

  // Format large numbers with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Format days to readable string
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
          {/* Hero Card - Daily Step Goal */}
          <LinearGradient
            colors={accent.gradient as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIconContainer}>
              <MaterialCommunityIcons name="shoe-print" size={40} color="#fff" />
            </View>
            <Text style={styles.heroLabel}>Your Daily Step Goal</Text>
            <Text style={styles.heroValue}>{formatNumber(dailyStepGoal)}</Text>
            <Text style={styles.heroSubtext}>steps per day</Text>
            
            <View style={styles.heroDivider} />
            
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatNumber(weeklySteps)}</Text>
                <Text style={styles.heroStatLabel}>weekly</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatNumber(monthlySteps)}</Text>
                <Text style={styles.heroStatLabel}>monthly</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Timeline to Goal Card */}
          {weightToLose > 0 && (
            <View style={[styles.timelineCard, { backgroundColor: colors.background.card }]}>
              <View style={styles.timelineHeader}>
                <View style={[styles.timelineIcon, { backgroundColor: `${accent.primary}20` }]}>
                  <Ionicons name="calendar" size={24} color={accent.primary} />
                </View>
                <View style={styles.timelineInfo}>
                  <Text style={[styles.timelineTitle, { color: colors.text.primary }]}>
                    Time to Goal Weight
                  </Text>
                  <Text style={[styles.timelineValue, { color: accent.primary }]}>
                    {formatDaysToGoal(daysToGoal)}
                  </Text>
                </View>
              </View>
              
              {getGoalDate(daysToGoal) && (
                <View style={[styles.goalDateContainer, { backgroundColor: colors.background.elevated }]}>
                  <Ionicons name="flag" size={18} color={accent.primary} />
                  <Text style={[styles.goalDateText, { color: colors.text.secondary }]}>
                    Goal Date: <Text style={{ color: colors.text.primary, fontWeight: '600' }}>
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
                <View style={styles.weightArrow}>
                  <Ionicons name="arrow-forward" size={20} color={accent.primary} />
                </View>
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

          {/* Calculation Details Card */}
          <View style={[styles.detailsCard, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              How We Calculate
            </Text>
            
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="flame-outline" size={20} color={colors.text.secondary} />
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                  Base Metabolic Rate (BMR)
                </Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {formatNumber(bmr)} cal/day
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="trending-up-outline" size={20} color={colors.text.secondary} />
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                  Daily Energy Expenditure
                </Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {formatNumber(tdee)} cal/day
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons name="shoe-print" size={20} color={colors.text.secondary} />
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                  Calories per Step
                </Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {caloriesPerStep.toFixed(3)} cal
              </Text>
            </View>

            {extraCaloriesToBurn > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Ionicons name="fitness-outline" size={20} color={colors.text.secondary} />
                  <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                    Extra Burn Target
                  </Text>
                </View>
                <Text style={[styles.detailValue, { color: accent.primary }]}>
                  {formatNumber(extraCaloriesToBurn)} cal/day
                </Text>
              </View>
            )}
          </View>

          {/* User Input Section */}
          <View style={[styles.inputCard, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Your Details
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.text.muted }]}>
              Adjust to personalize your step goal
            </Text>

            {/* Weight Inputs */}
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

            {/* Height Inputs */}
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

            {/* Age Input */}
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
                  <Ionicons 
                    name="male" 
                    size={20} 
                    color={gender === 'male' ? '#fff' : colors.text.secondary} 
                  />
                  <Text style={[
                    styles.selectionText,
                    { color: gender === 'male' ? '#fff' : colors.text.secondary }
                  ]}>Male</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.selectionButton,
                    { borderColor: colors.border.primary },
                    gender === 'female' && { backgroundColor: accent.primary, borderColor: accent.primary }
                  ]}
                  onPress={() => setGender('female')}
                >
                  <Ionicons 
                    name="female" 
                    size={20} 
                    color={gender === 'female' ? '#fff' : colors.text.secondary} 
                  />
                  <Text style={[
                    styles.selectionText,
                    { color: gender === 'female' ? '#fff' : colors.text.secondary }
                  ]}>Female</Text>
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
            
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={[styles.tipText, { color: colors.text.secondary }]}>
                Take the stairs instead of the elevator
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={[styles.tipText, { color: colors.text.secondary }]}>
                Park farther away from entrances
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={[styles.tipText, { color: colors.text.secondary }]}>
                Take a 10-minute walk after each meal
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={[styles.tipText, { color: colors.text.secondary }]}>
                Walk while on phone calls
              </Text>
            </View>
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
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  heroValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
    marginVertical: 4,
  },
  heroSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  heroDivider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 20,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  timelineCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineInfo: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  timelineValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  goalDateContainer: {
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
  },
  weightItem: {
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 12,
  },
  weightValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  weightArrow: {
    paddingHorizontal: 8,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
  inputCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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

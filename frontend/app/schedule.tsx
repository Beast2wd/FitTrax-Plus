import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '../stores/themeStore';
import { useUserStore } from '../stores/userStore';
import { plansAPI } from '../services/api';
import * as Notifications from 'expo-notifications';
import { format, addDays, isToday, isTomorrow, isYesterday } from 'date-fns';
import { router } from 'expo-router';
import axios from 'axios';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Generate time options for picker
const generateTimeOptions = () => {
  const options = [];
  for (let h = 5; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      const time = `${hour}:${minute}`;
      const label = `${h > 12 ? h - 12 : (h === 0 ? 12 : h)}:${minute} ${h >= 12 ? 'PM' : 'AM'}`;
      options.push({ value: time, label });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

// Generate day options for picker
const DAY_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: (i + 1).toString(),
  label: `Day ${i + 1}`,
}));

export default function ScheduleScreen() {
  const { theme } = useThemeStore();
  const { userId } = useUserStore();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<any[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [customWorkoutModalVisible, setCustomWorkoutModalVisible] = useState(false);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [userPlans, setUserPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedDay, setSelectedDay] = useState('1');
  const [time, setTime] = useState('08:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [workoutToReschedule, setWorkoutToReschedule] = useState<any>(null);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  
  // Custom workout state
  const [customWorkoutName, setCustomWorkoutName] = useState('');
  const [customExercises, setCustomExercises] = useState<{name: string, sets: string, reps: string}[]>([
    { name: '', sets: '3', reps: '10' }
  ]);
  
  // Expanded picker states (inline expansion instead of separate modals)
  const [planExpanded, setPlanExpanded] = useState(false);
  const [dayExpanded, setDayExpanded] = useState(false);
  const [timeExpanded, setTimeExpanded] = useState(false);

  const colors = theme.colors;
  const accent = theme.accentColors;
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  useEffect(() => {
    if (userId) {
      loadData();
      requestNotificationPermissions();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansData, userPlansData, scheduledData, weightHistoryData] = await Promise.all([
        plansAPI.getWorkoutPlans(),
        plansAPI.getUserPlans(userId!, 'active'),
        fetch(`${API_URL}/api/scheduled-workouts/${userId}`).then(r => r.json()),
        axios.get(`${API_URL}/api/weight-training/history/${userId}?days=90`),
      ]);
      
      const allAvailablePlans = [
        ...(plansData.plans || []).map((p: any) => ({ ...p, type: 'template' })),
        ...(userPlansData.user_plans || []).map((p: any) => ({ 
          plan_id: p.plan_id,
          name: p.plan_details?.name || 'Custom Plan',
          type: 'user'
        })),
      ];
      setAllPlans(allAvailablePlans);
      setUserPlans(userPlansData.user_plans || []);
      setScheduledWorkouts(scheduledData.scheduled_workouts || []);
      setCompletedWorkouts(weightHistoryData.data.workouts || []);
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  const scheduleNotification = async (date: string, timeStr: string, minutesBefore: number, workoutName: string) => {
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const scheduledTime = new Date(date + 'T00:00:00');
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      const notificationTime = new Date(scheduledTime.getTime() - minutesBefore * 60000);
      const now = new Date();

      if (notificationTime > now) {
        const secondsFromNow = Math.floor((notificationTime.getTime() - now.getTime()) / 1000);
        
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Workout Reminder! 💪',
            body: `${workoutName} starts in ${minutesBefore} minutes`,
            sound: true,
            data: { date, time: timeStr },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsFromNow,
          },
        });
        return identifier;
      }
    } catch (error) {
      console.log('Could not schedule notification:', error);
    }
    return null;
  };

  const openAddWorkoutModal = () => {
    setSelectedDate(today);
    setSelectedPlan('');
    setSelectedDay('1');
    setTime('08:00');
    setPlanExpanded(false);
    setDayExpanded(false);
    setTimeExpanded(false);
    setModalVisible(true);
  };

  const openCustomWorkoutModal = () => {
    // Close all pickers first
    setPlanExpanded(false);
    setDayExpanded(false);
    setTimeExpanded(false);
    // Reset custom workout form
    setCustomWorkoutName('');
    setCustomExercises([{ name: '', sets: '3', reps: '10' }]);
    // Close main modal first, then open custom workout modal after a delay
    setModalVisible(false);
    setTimeout(() => {
      setCustomWorkoutModalVisible(true);
    }, 350);
  };

  const addExercise = () => {
    setCustomExercises([...customExercises, { name: '', sets: '3', reps: '10' }]);
  };

  const removeExercise = (index: number) => {
    if (customExercises.length > 1) {
      setCustomExercises(customExercises.filter((_, i) => i !== index));
    }
  };

  const updateExercise = (index: number, field: 'name' | 'sets' | 'reps', value: string) => {
    const updated = [...customExercises];
    updated[index][field] = value;
    setCustomExercises(updated);
  };

  const handleCreateCustomWorkout = async () => {
    if (!customWorkoutName.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }

    const validExercises = customExercises.filter(e => e.name.trim());
    if (validExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    try {
      // Create a custom plan
      const customPlanId = `custom_${Date.now()}`;
      const customPlan = {
        plan_id: customPlanId,
        name: customWorkoutName.trim(),
        type: 'custom',
        exercises: validExercises.map(e => ({
          name: e.name.trim(),
          sets: parseInt(e.sets) || 3,
          reps: parseInt(e.reps) || 10,
        })),
      };

      // Save to backend
      await fetch(`${API_URL}/api/custom-workout-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          plan_id: customPlanId,
          name: customWorkoutName.trim(),
          exercises: customPlan.exercises,
        }),
      });

      // Add to local plans list and select it
      setAllPlans([...allPlans, customPlan]);
      setSelectedPlan(customPlanId);
      setCustomWorkoutModalVisible(false);
      
      Alert.alert('Success', 'Custom workout created!');
    } catch (error) {
      console.error('Error creating custom workout:', error);
      // Even if backend fails, add locally
      const customPlanId = `custom_${Date.now()}`;
      const customPlan = {
        plan_id: customPlanId,
        name: customWorkoutName.trim(),
        type: 'custom',
      };
      setAllPlans([...allPlans, customPlan]);
      setSelectedPlan(customPlanId);
      setCustomWorkoutModalVisible(false);
    }
  };

  const handleScheduleWorkout = async () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a workout plan');
      return;
    }

    try {
      const scheduledId = `scheduled_${Date.now()}`;
      const planDetails = allPlans.find(p => p.plan_id === selectedPlan);
      const planName = planDetails?.name || 'Workout';
      
      const response = await fetch(`${API_URL}/api/scheduled-workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_id: scheduledId,
          user_id: userId,
          workout_plan_id: selectedPlan,
          workout_day: parseInt(selectedDay),
          scheduled_date: selectedDate,
          scheduled_time: time,
          reminder_enabled: reminderEnabled,
          reminder_minutes_before: reminderMinutes,
          completed: false,
          notes: '',
        }),
      });

      if (response.ok) {
        if (reminderEnabled) {
          await scheduleNotification(selectedDate, time, reminderMinutes, planName);
        }
        Alert.alert('Success', `Workout scheduled for ${formatDateLabel(selectedDate)} at ${formatTime(time)}!`);
        setModalVisible(false);
        loadData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule workout');
    }
  };

  const handleCompleteWorkout = async (scheduledId: string) => {
    try {
      await fetch(
        `${API_URL}/api/scheduled-workouts/${scheduledId}?completed=true`,
        { method: 'PUT' }
      );
      loadData();
      Alert.alert('Great job! 🎉', 'Workout marked as complete!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update workout');
    }
  };

  const handleDeleteWorkout = async (scheduledId: string) => {
    try {
      await fetch(
        `${API_URL}/api/scheduled-workouts/${scheduledId}`,
        { method: 'DELETE' }
      );
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete workout');
    }
  };

  const confirmDeleteWorkout = (scheduledId: string) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this scheduled workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteWorkout(scheduledId),
        },
      ]
    );
  };

  const openRescheduleModal = (workout: any) => {
    setWorkoutToReschedule(workout);
    setNewScheduleDate(workout.scheduled_date);
    setRescheduleModalVisible(true);
  };

  const handleRescheduleWorkout = async () => {
    if (!workoutToReschedule || !newScheduleDate) return;

    try {
      await fetch(
        `${API_URL}/api/scheduled-workouts/${workoutToReschedule.scheduled_id}/reschedule`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_date: newScheduleDate }),
        }
      );
      
      Alert.alert('Success', `Workout moved to ${formatDateLabel(newScheduleDate)}`);
      setRescheduleModalVisible(false);
      setWorkoutToReschedule(null);
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to reschedule workout');
    }
  };

  const formatDateLabel = (dateString: string) => {
    if (!dateString) return 'Select date';
    try {
      const date = new Date(dateString + 'T12:00:00');
      if (isNaN(date.getTime())) return dateString;
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'EEE, MMM d');
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const hour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const getSelectedPlanName = () => {
    if (!selectedPlan) return 'Tap to select...';
    const plan = allPlans.find(p => p.plan_id === selectedPlan);
    return plan?.name || 'Unknown Plan';
  };

  const quickDateOptions = [
    { label: 'Today', date: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Tomorrow', date: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: '+2 Days', date: format(addDays(new Date(), 2), 'yyyy-MM-dd') },
    { label: '+3 Days', date: format(addDays(new Date(), 3), 'yyyy-MM-dd') },
  ];

  // Render swipe delete action
  const renderRightActions = (scheduledId: string) => {
    return (
      <TouchableOpacity
        style={[localStyles.deleteAction, { backgroundColor: colors.status.error }]}
        onPress={() => confirmDeleteWorkout(scheduledId)}
      >
        <Ionicons name="trash" size={24} color="#fff" />
        <Text style={localStyles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  // Build marked dates for calendar
  const markedDates = (() => {
    const marks: any = {};
    
    scheduledWorkouts.forEach(workout => {
      const date = workout.scheduled_date;
      if (!date) return; // Skip if no date
      if (!marks[date]) {
        marks[date] = { dots: [] };
      }
      const workoutKey = workout.scheduled_id || workout.workout_id || `workout_${Math.random()}`;
      marks[date].dots.push({
        color: workout.completed ? colors.status.success : accent.primary,
        key: `scheduled_${workoutKey}`
      });
    });

    completedWorkouts.forEach(workout => {
      if (!workout.timestamp) return; // Skip if no timestamp
      const date = format(new Date(workout.timestamp), 'yyyy-MM-dd');
      if (!marks[date]) {
        marks[date] = { dots: [] };
      }
      const alreadyMarked = marks[date].dots.some((d: any) => d.color === '#10B981');
      if (!alreadyMarked) {
        marks[date].dots.push({
          color: '#10B981',
          key: `completed_${workout.workout_id || Math.random()}`
        });
      }
    });

    if (marks[selectedDate]) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: accent.primary,
      };
    } else {
      marks[selectedDate] = {
        selected: true,
        selectedColor: accent.primary,
        dots: [],
      };
    }

    return marks;
  })();

  const workoutsForSelectedDate = scheduledWorkouts.filter(
    (w) => w.scheduled_date === selectedDate
  );

  const completedForSelectedDate = completedWorkouts.filter(
    (w) => format(new Date(w.timestamp), 'yyyy-MM-dd') === selectedDate
  );

  const upcomingWorkouts = scheduledWorkouts
    .filter(w => w.scheduled_date >= today && !w.completed)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 5);

  const localStyles = createStyles(theme);

  // Toggle picker expansion (collapse others when one opens)
  const togglePlanPicker = () => {
    setPlanExpanded(!planExpanded);
    setDayExpanded(false);
    setTimeExpanded(false);
  };

  const toggleDayPicker = () => {
    setDayExpanded(!dayExpanded);
    setPlanExpanded(false);
    setTimeExpanded(false);
  };

  const toggleTimePicker = () => {
    setTimeExpanded(!timeExpanded);
    setPlanExpanded(false);
    setDayExpanded(false);
  };

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={localStyles.container}>
          <View style={localStyles.centered}>
            <ActivityIndicator size="large" color={accent.primary} />
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={localStyles.container}>
        <ScrollView contentContainerStyle={localStyles.scrollContent}>
          {/* Header */}
          <View style={localStyles.header}>
            <TouchableOpacity onPress={() => router.back()} style={localStyles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={localStyles.title}>Workout Schedule</Text>
            <TouchableOpacity onPress={openAddWorkoutModal} style={localStyles.addBtn}>
              <Ionicons name="add" size={28} color={accent.primary} />
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={localStyles.legend}>
            <View style={localStyles.legendItem}>
              <View style={[localStyles.legendDot, { backgroundColor: accent.primary }]} />
              <Text style={localStyles.legendText}>Scheduled</Text>
            </View>
            <View style={localStyles.legendItem}>
              <View style={[localStyles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={localStyles.legendText}>Completed</Text>
            </View>
          </View>

          {/* Swipe hint */}
          <View style={localStyles.swipeHint}>
            <Ionicons name="arrow-back" size={14} color={colors.text.muted} />
            <Text style={localStyles.swipeHintText}>Swipe left on workouts to delete</Text>
          </View>

          {/* Quick Add Button */}
          <TouchableOpacity style={localStyles.quickAddButton} onPress={openAddWorkoutModal}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={localStyles.quickAddText}>Schedule a Workout</Text>
          </TouchableOpacity>

          {/* Upcoming Workouts */}
          {upcomingWorkouts.length > 0 && (
            <View style={localStyles.section}>
              <Text style={localStyles.sectionTitle}>Upcoming</Text>
              {upcomingWorkouts.map((workout) => {
                const planDetails = allPlans.find(p => p.plan_id === workout.workout_plan_id);
                const workoutKey = workout.scheduled_id || workout.workout_id || `upcoming_${Math.random()}`;
                
                // Skip manual_log entries in upcoming (they're already completed)
                if (workout.workout_type === 'manual_log') return null;
                
                return (
                  <Swipeable
                    key={workoutKey}
                    ref={(ref) => { swipeableRefs.current[workoutKey] = ref; }}
                    renderRightActions={() => renderRightActions(workout.scheduled_id)}
                    overshootRight={false}
                  >
                    <View style={localStyles.upcomingCard}>
                      <View style={localStyles.upcomingLeft}>
                        <View style={localStyles.upcomingDate}>
                          <Text style={localStyles.upcomingDateText}>{formatDateLabel(workout.scheduled_date)}</Text>
                          <Text style={localStyles.upcomingTime}>{formatTime(workout.scheduled_time)}</Text>
                        </View>
                        <View style={localStyles.upcomingInfo}>
                          <Text style={localStyles.upcomingPlan}>
                            {planDetails?.name || 'Workout'}
                          </Text>
                          <Text style={localStyles.upcomingDay}>Day {workout.workout_day}</Text>
                        </View>
                      </View>
                      <View style={localStyles.upcomingActions}>
                        <TouchableOpacity
                          style={localStyles.rescheduleBtn}
                          onPress={() => openRescheduleModal(workout)}
                        >
                          <Ionicons name="calendar-outline" size={20} color={accent.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={localStyles.completeBtn}
                          onPress={() => handleCompleteWorkout(workout.scheduled_id)}
                        >
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Swipeable>
                );
              })}
            </View>
          )}

          {/* Calendar */}
          <View style={localStyles.card}>
            <Calendar
              onDayPress={(day: any) => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              markingType="multi-dot"
              theme={{
                calendarBackground: colors.background.card,
                textSectionTitleColor: colors.text.secondary,
                dayTextColor: colors.text.primary,
                todayTextColor: accent.primary,
                selectedDayBackgroundColor: accent.primary,
                selectedDayTextColor: '#ffffff',
                arrowColor: accent.primary,
                monthTextColor: colors.text.primary,
                textDayFontWeight: '500',
                textMonthFontWeight: '700',
                textDisabledColor: colors.text.muted,
              }}
            />
          </View>

          {/* Workouts for selected date */}
          <View style={localStyles.section}>
            <View style={localStyles.sectionHeader}>
              <Text style={localStyles.sectionTitle}>{formatDateLabel(selectedDate)}</Text>
              <TouchableOpacity 
                style={localStyles.addForDateBtn}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="add" size={20} color={accent.primary} />
                <Text style={localStyles.addForDateText}>Add</Text>
              </TouchableOpacity>
            </View>
            
            {workoutsForSelectedDate.length === 0 && completedForSelectedDate.length === 0 ? (
              <View style={localStyles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.text.muted} />
                <Text style={localStyles.emptyText}>No workouts for this day</Text>
                <TouchableOpacity 
                  style={localStyles.emptyButton}
                  onPress={() => setModalVisible(true)}
                >
                  <Text style={localStyles.emptyButtonText}>Add Workout</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Scheduled Workouts */}
                {workoutsForSelectedDate.map((workout) => {
                  const planDetails = allPlans.find(p => p.plan_id === workout.workout_plan_id);
                  const workoutKey = workout.scheduled_id || workout.workout_id || `workout_${Math.random()}`;
                  
                  // Handle manual workout log entries (from "Workout Complete" button)
                  if (workout.workout_type === 'manual_log') {
                    return (
                      <View key={workoutKey} style={[localStyles.workoutCard, localStyles.workoutCardCompleted]}>
                        <View style={localStyles.workoutHeader}>
                          <View style={localStyles.workoutTimeContainer}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
                            <Text style={localStyles.workoutTime}>Completed</Text>
                          </View>
                        </View>
                        <Text style={localStyles.workoutPlan}>{workout.title || 'Manual Workout'}</Text>
                        <Text style={localStyles.workoutDay}>{workout.description}</Text>
                        <View style={localStyles.completedBadge}>
                          <Ionicons name="clipboard" size={16} color={colors.status.success} />
                          <Text style={localStyles.completedText}>Logged from Workout Log</Text>
                        </View>
                      </View>
                    );
                  }
                  
                  return (
                    <Swipeable
                      key={workoutKey}
                      ref={(ref) => { swipeableRefs.current[`date_${workoutKey}`] = ref; }}
                      renderRightActions={() => renderRightActions(workout.scheduled_id)}
                      overshootRight={false}
                    >
                      <View style={[
                        localStyles.workoutCard,
                        workout.completed && localStyles.workoutCardCompleted
                      ]}>
                        <View style={localStyles.workoutHeader}>
                          <View style={localStyles.workoutTimeContainer}>
                            <Ionicons 
                              name={workout.completed ? "checkmark-circle" : "time-outline"} 
                              size={20} 
                              color={workout.completed ? colors.status.success : accent.primary} 
                            />
                            <Text style={localStyles.workoutTime}>{formatTime(workout.scheduled_time)}</Text>
                          </View>
                        </View>
                        <Text style={localStyles.workoutPlan}>
                          {planDetails?.name || 'Workout Plan'}
                        </Text>
                        <Text style={localStyles.workoutDay}>Day {workout.workout_day}</Text>
                        {!workout.completed && (
                          <TouchableOpacity
                            style={localStyles.markCompleteBtn}
                            onPress={() => handleCompleteWorkout(workout.scheduled_id)}
                          >
                            <Text style={localStyles.markCompleteBtnText}>Mark Complete</Text>
                          </TouchableOpacity>
                        )}
                        {workout.completed && (
                          <View style={localStyles.completedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
                            <Text style={localStyles.completedText}>Completed</Text>
                          </View>
                        )}
                      </View>
                    </Swipeable>
                  );
                })}

                {/* Completed Workouts from Weight Training */}
                {completedForSelectedDate.map((workout, index) => (
                  <View key={`completed_${index}`} style={[localStyles.workoutCard, localStyles.workoutCardCompleted]}>
                    <View style={localStyles.workoutHeader}>
                      <View style={localStyles.workoutTimeContainer}>
                        <MaterialCommunityIcons name="dumbbell" size={20} color="#10B981" />
                        <Text style={localStyles.workoutTime}>
                          {format(new Date(workout.timestamp), 'h:mm a')}
                        </Text>
                      </View>
                      <View style={[localStyles.completedBadgeSmall]}>
                        <Text style={localStyles.completedBadgeText}>Logged</Text>
                      </View>
                    </View>
                    <Text style={localStyles.workoutPlan}>{workout.workout_name}</Text>
                    <Text style={localStyles.workoutDay}>
                      {workout.exercises?.length || 0} exercises • {workout.duration_minutes || 0} min
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>

        {/* Add Workout Modal - With Inline Expandable Pickers */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModalVisible(false)}
        >
          <SafeAreaView style={[localStyles.modalContainer, { backgroundColor: colors.background.primary }]}>
            <View style={localStyles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[localStyles.modalCancelText, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[localStyles.modalTitle, { color: colors.text.primary }]}>Schedule Workout</Text>
              <TouchableOpacity onPress={handleScheduleWorkout} disabled={!selectedPlan}>
                <Text style={[localStyles.modalDoneText, { color: selectedPlan ? accent.primary : colors.text.muted }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={localStyles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Quick Date Selection */}
              <Text style={localStyles.label}>Date</Text>
              <View style={localStyles.quickDates}>
                {quickDateOptions.map((option) => (
                  <TouchableOpacity
                    key={option.date}
                    style={[
                      localStyles.quickDateBtn,
                      selectedDate === option.date && localStyles.quickDateBtnActive
                    ]}
                    onPress={() => setSelectedDate(option.date)}
                  >
                    <Text style={[
                      localStyles.quickDateText,
                      selectedDate === option.date && localStyles.quickDateTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={localStyles.selectedDateLabel}>
                Selected: {formatDateLabel(selectedDate)}
              </Text>

              {/* Plan Selection - Expandable */}
              <Text style={localStyles.label}>Select Plan</Text>
              {allPlans.length === 0 ? (
                <View style={localStyles.noPlansBanner}>
                  <Ionicons name="information-circle" size={20} color="#F59E0B" />
                  <Text style={localStyles.noPlansText}>
                    No workout plans available. Go to Plans tab to create one first.
                  </Text>
                </View>
              ) : (
                <View style={localStyles.expandableContainer}>
                  <TouchableOpacity 
                    style={localStyles.pickerButton}
                    onPress={togglePlanPicker}
                  >
                    <View style={localStyles.pickerButtonContent}>
                      <MaterialCommunityIcons name="dumbbell" size={20} color={accent.primary} />
                      <Text style={[
                        localStyles.pickerButtonText,
                        !selectedPlan && { color: colors.text.muted }
                      ]}>
                        {getSelectedPlanName()}
                      </Text>
                    </View>
                    <Ionicons name={planExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                  
                  {planExpanded && (
                    <View style={localStyles.expandedOptions}>
                      {/* Create Custom Workout Option */}
                      <TouchableOpacity
                        style={[localStyles.optionItem, localStyles.createCustomOption]}
                        onPress={openCustomWorkoutModal}
                      >
                        <View style={localStyles.createCustomContent}>
                          <Ionicons name="add-circle" size={20} color={accent.primary} />
                          <Text style={[localStyles.optionText, { color: accent.primary, fontWeight: '600' }]}>
                            Create Custom Workout
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={accent.primary} />
                      </TouchableOpacity>
                      
                      {/* Existing Plans */}
                      {allPlans.map((plan) => (
                        <TouchableOpacity
                          key={plan.plan_id}
                          style={[
                            localStyles.optionItem,
                            selectedPlan === plan.plan_id && localStyles.optionItemSelected
                          ]}
                          onPress={() => {
                            setSelectedPlan(plan.plan_id);
                            setPlanExpanded(false);
                          }}
                        >
                          <Text style={[
                            localStyles.optionText,
                            selectedPlan === plan.plan_id && localStyles.optionTextSelected
                          ]}>
                            {plan.name}
                          </Text>
                          {selectedPlan === plan.plan_id && (
                            <Ionicons name="checkmark" size={20} color="#fff" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Workout Day - Expandable */}
              <Text style={localStyles.label}>Workout Day</Text>
              <View style={localStyles.expandableContainer}>
                <TouchableOpacity 
                  style={localStyles.pickerButton}
                  onPress={toggleDayPicker}
                >
                  <View style={localStyles.pickerButtonContent}>
                    <Ionicons name="calendar" size={20} color={accent.primary} />
                    <Text style={localStyles.pickerButtonText}>Day {selectedDay}</Text>
                  </View>
                  <Ionicons name={dayExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.text.secondary} />
                </TouchableOpacity>
                
                {dayExpanded && (
                  <View style={localStyles.expandedOptions}>
                    {DAY_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          localStyles.optionItem,
                          selectedDay === option.value && localStyles.optionItemSelected
                        ]}
                        onPress={() => {
                          setSelectedDay(option.value);
                          setDayExpanded(false);
                        }}
                      >
                        <Text style={[
                          localStyles.optionText,
                          selectedDay === option.value && localStyles.optionTextSelected
                        ]}>
                          {option.label}
                        </Text>
                        {selectedDay === option.value && (
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Time - Expandable */}
              <Text style={localStyles.label}>Time</Text>
              <View style={localStyles.expandableContainer}>
                <TouchableOpacity 
                  style={localStyles.pickerButton}
                  onPress={toggleTimePicker}
                >
                  <View style={localStyles.pickerButtonContent}>
                    <Ionicons name="time" size={20} color={accent.primary} />
                    <Text style={localStyles.pickerButtonText}>{formatTime(time)}</Text>
                  </View>
                  <Ionicons name={timeExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.text.secondary} />
                </TouchableOpacity>
                
                {timeExpanded && (
                  <ScrollView style={localStyles.expandedOptionsScroll} nestedScrollEnabled={true}>
                    {TIME_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          localStyles.optionItem,
                          time === option.value && localStyles.optionItemSelected
                        ]}
                        onPress={() => {
                          setTime(option.value);
                          setTimeExpanded(false);
                        }}
                      >
                        <Text style={[
                          localStyles.optionText,
                          time === option.value && localStyles.optionTextSelected
                        ]}>
                          {option.label}
                        </Text>
                        {time === option.value && (
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Reminder Toggle */}
              <View style={localStyles.switchRow}>
                <View>
                  <Text style={localStyles.label}>Reminder</Text>
                  <Text style={localStyles.switchSubtext}>Get notified before workout</Text>
                </View>
                <TouchableOpacity
                  style={[localStyles.switch, reminderEnabled && localStyles.switchActive]}
                  onPress={() => setReminderEnabled(!reminderEnabled)}
                >
                  <Text style={[localStyles.switchText, reminderEnabled && localStyles.switchTextActive]}>
                    {reminderEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {reminderEnabled && (
                <View style={localStyles.reminderOptions}>
                  {[15, 30, 60].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        localStyles.reminderOption,
                        reminderMinutes === mins && localStyles.reminderOptionActive
                      ]}
                      onPress={() => setReminderMinutes(mins)}
                    >
                      <Text style={[
                        localStyles.reminderOptionText,
                        reminderMinutes === mins && localStyles.reminderOptionTextActive
                      ]}>
                        {mins < 60 ? `${mins} min` : '1 hour'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Schedule Button */}
              <TouchableOpacity 
                style={[localStyles.scheduleButton, !selectedPlan && localStyles.scheduleButtonDisabled]} 
                onPress={handleScheduleWorkout}
                disabled={!selectedPlan}
              >
                <Text style={localStyles.scheduleButtonText}>
                  Schedule for {formatDateLabel(selectedDate)}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Reschedule Modal */}
        <Modal
          visible={rescheduleModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setRescheduleModalVisible(false)}
        >
          <SafeAreaView style={[localStyles.modalContainer, { backgroundColor: colors.background.primary }]}>
            <View style={localStyles.modalHeader}>
              <TouchableOpacity onPress={() => setRescheduleModalVisible(false)}>
                <Text style={[localStyles.modalCancelText, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[localStyles.modalTitle, { color: colors.text.primary }]}>Move Workout</Text>
              <TouchableOpacity onPress={handleRescheduleWorkout}>
                <Text style={[localStyles.modalDoneText, { color: accent.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={localStyles.modalScroll}>
              <Text style={localStyles.rescheduleInfo}>
                Moving workout from {formatDateLabel(workoutToReschedule?.scheduled_date || '')}
              </Text>

              <Text style={localStyles.label}>New Date</Text>
              <View style={localStyles.quickDates}>
                {quickDateOptions.map((option) => (
                  <TouchableOpacity
                    key={option.date}
                    style={[
                      localStyles.quickDateBtn,
                      newScheduleDate === option.date && localStyles.quickDateBtnActive
                    ]}
                    onPress={() => setNewScheduleDate(option.date)}
                  >
                    <Text style={[
                      localStyles.quickDateText,
                      newScheduleDate === option.date && localStyles.quickDateTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={localStyles.miniCalendarContainer}>
                <Calendar
                  onDayPress={(day: any) => setNewScheduleDate(day.dateString)}
                  markedDates={{
                    [newScheduleDate]: {
                      selected: true,
                      selectedColor: accent.primary,
                    }
                  }}
                  theme={{
                    calendarBackground: colors.background.secondary,
                    textSectionTitleColor: colors.text.secondary,
                    dayTextColor: colors.text.primary,
                    todayTextColor: accent.primary,
                    selectedDayBackgroundColor: accent.primary,
                    selectedDayTextColor: '#ffffff',
                    arrowColor: accent.primary,
                    monthTextColor: colors.text.primary,
                    textDisabledColor: colors.text.muted,
                  }}
                  style={localStyles.miniCalendar}
                />
              </View>

              <TouchableOpacity 
                style={localStyles.scheduleButton} 
                onPress={handleRescheduleWorkout}
              >
                <Text style={localStyles.scheduleButtonText}>Move to {formatDateLabel(newScheduleDate)}</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Custom Workout Modal */}
        <Modal
          visible={customWorkoutModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCustomWorkoutModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <SafeAreaView style={[localStyles.modalContainer, { backgroundColor: colors.background.primary }]}>
              <View style={localStyles.modalHeader}>
                <TouchableOpacity onPress={() => setCustomWorkoutModalVisible(false)}>
                  <Text style={[localStyles.modalCancelText, { color: colors.text.secondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[localStyles.modalTitle, { color: colors.text.primary }]}>Create Workout</Text>
                <TouchableOpacity onPress={handleCreateCustomWorkout}>
                  <Text style={[localStyles.modalDoneText, { color: accent.primary }]}>Create</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={localStyles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Workout Name */}
                <Text style={localStyles.label}>Workout Name</Text>
                <TextInput
                  style={localStyles.textInput}
                  placeholder="e.g., Morning Push Day"
                  placeholderTextColor={colors.text.muted}
                  value={customWorkoutName}
                  onChangeText={setCustomWorkoutName}
                />

                {/* Exercises */}
                <View style={localStyles.exercisesHeader}>
                  <Text style={localStyles.label}>Exercises</Text>
                  <TouchableOpacity onPress={addExercise} style={localStyles.addExerciseBtn}>
                    <Ionicons name="add-circle" size={24} color={accent.primary} />
                  </TouchableOpacity>
                </View>

                {customExercises.map((exercise, index) => (
                  <View key={index} style={localStyles.exerciseRow}>
                    <View style={localStyles.exerciseNameContainer}>
                      <TextInput
                        style={localStyles.exerciseNameInput}
                        placeholder="Exercise name"
                        placeholderTextColor={colors.text.muted}
                        value={exercise.name}
                        onChangeText={(text) => updateExercise(index, 'name', text)}
                      />
                    </View>
                    <View style={localStyles.exerciseSetsReps}>
                      <View style={localStyles.setsRepsInput}>
                        <Text style={localStyles.setsRepsLabel}>Sets</Text>
                        <TextInput
                          style={localStyles.setsRepsValue}
                          keyboardType="numeric"
                          value={exercise.sets}
                          onChangeText={(text) => updateExercise(index, 'sets', text)}
                        />
                      </View>
                      <View style={localStyles.setsRepsInput}>
                        <Text style={localStyles.setsRepsLabel}>Reps</Text>
                        <TextInput
                          style={localStyles.setsRepsValue}
                          keyboardType="numeric"
                          value={exercise.reps}
                          onChangeText={(text) => updateExercise(index, 'reps', text)}
                        />
                      </View>
                      {customExercises.length > 1 && (
                        <TouchableOpacity 
                          onPress={() => removeExercise(index)}
                          style={localStyles.removeExerciseBtn}
                        >
                          <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}

                <TouchableOpacity 
                  style={localStyles.addMoreExerciseBtn}
                  onPress={addExercise}
                >
                  <Ionicons name="add" size={20} color={accent.primary} />
                  <Text style={[localStyles.addMoreText, { color: accent.primary }]}>Add Another Exercise</Text>
                </TouchableOpacity>

                {/* Create Button */}
                <TouchableOpacity 
                  style={[localStyles.scheduleButton, !customWorkoutName.trim() && localStyles.scheduleButtonDisabled]}
                  onPress={handleCreateCustomWorkout}
                  disabled={!customWorkoutName.trim()}
                >
                  <Text style={localStyles.scheduleButtonText}>Create & Select Workout</Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  addBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  swipeHintText: {
    fontSize: 12,
    color: theme.colors.text.muted,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accentColors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  quickAddText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  addForDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addForDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accentColors.primary,
  },
  upcomingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  upcomingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  upcomingDate: {
    backgroundColor: theme.accentColors.primary + '20',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginRight: 12,
    minWidth: 70,
  },
  upcomingDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accentColors.primary,
  },
  upcomingTime: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingPlan: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  upcomingDay: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  upcomingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rescheduleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accentColors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.status.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background.card,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text.muted,
    marginTop: 12,
  },
  emptyButton: {
    backgroundColor: theme.accentColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  workoutCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  workoutCardCompleted: {
    opacity: 0.8,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutTime: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  workoutPlan: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  workoutDay: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  markCompleteBtn: {
    backgroundColor: theme.colors.status.success,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  markCompleteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  completedBadgeSmall: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  completedText: {
    fontSize: 14,
    color: theme.colors.status.success,
    fontWeight: '500',
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 10,
    marginLeft: 8,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  modalCancelText: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalDoneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
    marginTop: 16,
  },
  quickDates: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickDateBtnActive: {
    backgroundColor: theme.accentColors.primary,
  },
  quickDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  quickDateTextActive: {
    color: '#fff',
  },
  selectedDateLabel: {
    fontSize: 14,
    color: theme.accentColors.primary,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  noPlansBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  noPlansText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  // Expandable Picker Styles
  expandableContainer: {
    marginBottom: 8,
  },
  pickerButton: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerButtonText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  expandedOptions: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    overflow: 'hidden',
  },
  expandedOptionsScroll: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    maxHeight: 200,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  optionItemSelected: {
    backgroundColor: theme.accentColors.primary,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  switchSubtext: {
    fontSize: 12,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  switch: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  switchActive: {
    backgroundColor: theme.colors.status.success,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  switchTextActive: {
    color: '#fff',
  },
  reminderOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  reminderOption: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reminderOptionActive: {
    backgroundColor: theme.accentColors.primary,
  },
  reminderOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  reminderOptionTextActive: {
    color: '#fff',
  },
  scheduleButton: {
    backgroundColor: theme.accentColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  scheduleButtonDisabled: {
    opacity: 0.5,
  },
  scheduleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rescheduleInfo: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  miniCalendarContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.background.secondary,
  },
  miniCalendar: {
    borderRadius: 12,
  },
  // Custom workout modal styles
  createCustomOption: {
    backgroundColor: theme.accentColors.primary + '10',
    borderBottomWidth: 2,
    borderBottomColor: theme.accentColors.primary + '30',
  },
  createCustomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  addExerciseBtn: {
    padding: 4,
  },
  exerciseRow: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  exerciseNameContainer: {
    marginBottom: 10,
  },
  exerciseNameInput: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  exerciseSetsReps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setsRepsInput: {
    flex: 1,
    alignItems: 'center',
  },
  setsRepsLabel: {
    fontSize: 12,
    color: theme.colors.text.muted,
    marginBottom: 4,
  },
  setsRepsValue: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 8,
    padding: 10,
    width: '100%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  removeExerciseBtn: {
    padding: 8,
  },
  addMoreExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.accentColors.primary,
    borderRadius: 12,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

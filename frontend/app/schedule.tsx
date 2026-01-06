import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../stores/themeStore';
import { useUserStore } from '../stores/userStore';
import { plansAPI } from '../services/api';
import * as Notifications from 'expo-notifications';
import { format, addDays, isToday, isTomorrow, isYesterday } from 'date-fns';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

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
      const label = `${h > 12 ? h - 12 : h}:${minute} ${h >= 12 ? 'PM' : 'AM'}`;
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
  const [selectedDate, setSelectedDate] = useState(today);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [workoutPlans, setWorkoutPlans] = useState<any[]>([]);
  const [userPlans, setUserPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedDay, setSelectedDay] = useState('1');
  const [time, setTime] = useState('08:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [workoutToReschedule, setWorkoutToReschedule] = useState<any>(null);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  
  // Picker modal states
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [tempDay, setTempDay] = useState('1');
  const [tempTime, setTempTime] = useState('08:00');

  useEffect(() => {
    if (userId) {
      loadData();
      requestNotificationPermissions();
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
      const [plansData, userPlansData, scheduledData] = await Promise.all([
        plansAPI.getWorkoutPlans(),
        plansAPI.getUserPlans(userId!, 'active'),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/scheduled-workouts/${userId}`).then(r => r.json()),
      ]);
      setWorkoutPlans(plansData.plans || []);
      setUserPlans(userPlansData.user_plans || []);
      setScheduledWorkouts(scheduledData.scheduled_workouts || []);
    } catch (error) {
      console.error('Error loading schedule data:', error);
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
        console.log('Notification scheduled:', identifier, 'in', secondsFromNow, 'seconds');
        return identifier;
      }
    } catch (error) {
      console.log('Could not schedule notification:', error);
    }
    return null;
  };

  const openAddWorkoutModal = () => {
    setSelectedDate(today);
    setModalVisible(true);
  };

  const handleScheduleWorkout = async () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a workout plan');
      return;
    }

    try {
      const scheduledId = `scheduled_${Date.now()}`;
      const planDetails = userPlans.find(p => p.plan_id === selectedPlan);
      const planName = planDetails?.plan_details?.name || 'Workout';
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/scheduled-workouts`, {
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
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/scheduled-workouts/${scheduledId}?completed=true`,
        { method: 'PUT' }
      );
      loadData();
      Alert.alert('Great job! 🎉', 'Workout marked as complete!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update workout');
    }
  };

  const handleDeleteWorkout = async (scheduledId: string) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this scheduled workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(
                `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/scheduled-workouts/${scheduledId}`,
                { method: 'DELETE' }
              );
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
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
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/scheduled-workouts/${workoutToReschedule.scheduled_id}/reschedule`,
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

  const quickDateOptions = [
    { label: 'Today', date: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Tomorrow', date: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: '+2 Days', date: format(addDays(new Date(), 2), 'yyyy-MM-dd') },
    { label: '+3 Days', date: format(addDays(new Date(), 3), 'yyyy-MM-dd') },
  ];

  const markedDates = scheduledWorkouts.reduce((acc: any, workout) => {
    const existingMark = acc[workout.scheduled_date] || { dots: [] };
    acc[workout.scheduled_date] = {
      ...existingMark,
      marked: true,
      dots: [
        ...(existingMark.dots || []),
        { color: workout.completed ? theme.colors.status.success : theme.accentColors.primary }
      ],
      selected: workout.scheduled_date === selectedDate,
      selectedColor: theme.accentColors.primary,
    };
    return acc;
  }, {
    [selectedDate]: {
      selected: true,
      selectedColor: theme.accentColors.primary,
    }
  });

  const workoutsForSelectedDate = scheduledWorkouts.filter(
    (w) => w.scheduled_date === selectedDate
  );

  const upcomingWorkouts = scheduledWorkouts
    .filter(w => w.scheduled_date >= today && !w.completed)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 5);

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Workout Schedule</Text>
          <TouchableOpacity onPress={openAddWorkoutModal} style={styles.addBtn}>
            <Ionicons name="add" size={28} color={theme.accentColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Quick Add Button */}
        <TouchableOpacity style={styles.quickAddButton} onPress={openAddWorkoutModal}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.quickAddText}>Schedule a Workout</Text>
        </TouchableOpacity>

        {/* Upcoming Workouts */}
        {upcomingWorkouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcomingWorkouts.map((workout) => {
              const planDetails = userPlans.find(p => p.plan_id === workout.workout_plan_id);
              return (
                <View key={workout.scheduled_id} style={styles.upcomingCard}>
                  <View style={styles.upcomingLeft}>
                    <View style={styles.upcomingDate}>
                      <Text style={styles.upcomingDateText}>{formatDateLabel(workout.scheduled_date)}</Text>
                      <Text style={styles.upcomingTime}>{formatTime(workout.scheduled_time)}</Text>
                    </View>
                    <View style={styles.upcomingInfo}>
                      <Text style={styles.upcomingPlan}>
                        {planDetails?.plan_details?.name || 'Workout'}
                      </Text>
                      <Text style={styles.upcomingDay}>Day {workout.workout_day}</Text>
                    </View>
                  </View>
                  <View style={styles.upcomingActions}>
                    <TouchableOpacity
                      style={styles.rescheduleBtn}
                      onPress={() => openRescheduleModal(workout)}
                    >
                      <Ionicons name="calendar-outline" size={20} color={theme.accentColors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.completeBtn}
                      onPress={() => handleCompleteWorkout(workout.scheduled_id)}
                    >
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Calendar */}
        <View style={styles.card}>
          <Calendar
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            markingType="multi-dot"
            theme={{
              calendarBackground: theme.colors.background.card,
              textSectionTitleColor: theme.colors.text.secondary,
              dayTextColor: theme.colors.text.primary,
              todayTextColor: theme.accentColors.primary,
              selectedDayBackgroundColor: theme.accentColors.primary,
              selectedDayTextColor: '#ffffff',
              arrowColor: theme.accentColors.primary,
              monthTextColor: theme.colors.text.primary,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDisabledColor: theme.colors.text.muted,
            }}
          />
        </View>

        {/* Workouts for selected date */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{formatDateLabel(selectedDate)}</Text>
            <TouchableOpacity 
              style={styles.addForDateBtn}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={20} color={theme.accentColors.primary} />
              <Text style={styles.addForDateText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {workoutsForSelectedDate.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={theme.colors.text.muted} />
              <Text style={styles.emptyText}>No workouts scheduled</Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.emptyButtonText}>Add Workout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            workoutsForSelectedDate.map((workout) => {
              const planDetails = userPlans.find(p => p.plan_id === workout.workout_plan_id);
              return (
                <View key={workout.scheduled_id} style={[
                  styles.workoutCard,
                  workout.completed && styles.workoutCardCompleted
                ]}>
                  <View style={styles.workoutHeader}>
                    <View style={styles.workoutTimeContainer}>
                      <Ionicons 
                        name={workout.completed ? "checkmark-circle" : "time-outline"} 
                        size={20} 
                        color={workout.completed ? theme.colors.status.success : theme.accentColors.primary} 
                      />
                      <Text style={styles.workoutTime}>{formatTime(workout.scheduled_time)}</Text>
                    </View>
                    {!workout.completed && (
                      <View style={styles.workoutActions}>
                        <TouchableOpacity
                          onPress={() => openRescheduleModal(workout)}
                          style={styles.workoutActionBtn}
                        >
                          <Ionicons name="swap-horizontal" size={18} color={theme.colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteWorkout(workout.scheduled_id)}
                          style={styles.workoutActionBtn}
                        >
                          <Ionicons name="trash-outline" size={18} color={theme.colors.status.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <Text style={styles.workoutPlan}>
                    {planDetails?.plan_details?.name || 'Workout Plan'}
                  </Text>
                  <Text style={styles.workoutDay}>Day {workout.workout_day}</Text>
                  {!workout.completed && (
                    <TouchableOpacity
                      style={styles.markCompleteBtn}
                      onPress={() => handleCompleteWorkout(workout.scheduled_id)}
                    >
                      <Text style={styles.markCompleteBtnText}>Mark Complete</Text>
                    </TouchableOpacity>
                  )}
                  {workout.completed && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.status.success} />
                      <Text style={styles.completedText}>Completed</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Workout Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Workout</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Quick Date Selection */}
              <Text style={styles.label}>Date</Text>
              <View style={styles.quickDates}>
                {quickDateOptions.map((option) => (
                  <TouchableOpacity
                    key={option.date}
                    style={[
                      styles.quickDateBtn,
                      selectedDate === option.date && styles.quickDateBtnActive
                    ]}
                    onPress={() => setSelectedDate(option.date)}
                  >
                    <Text style={[
                      styles.quickDateText,
                      selectedDate === option.date && styles.quickDateTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.selectedDateLabel}>
                Selected: {formatDateLabel(selectedDate)} ({format(new Date(selectedDate + 'T00:00:00'), 'MMM d, yyyy')})
              </Text>

              <Text style={styles.label}>Select Plan</Text>
              {userPlans.length === 0 ? (
                <View style={styles.noPlansBanner}>
                  <Ionicons name="information-circle" size={20} color="#F59E0B" />
                  <Text style={styles.noPlansText}>
                    No active plans. Go to Plans tab to start a workout plan first.
                  </Text>
                </View>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedPlan}
                    onValueChange={(value) => setSelectedPlan(value)}
                    style={styles.picker}
                    itemStyle={{ color: theme.colors.text.primary }}
                  >
                    <Picker.Item label="Choose a plan..." value="" color={theme.colors.text.muted} />
                    {userPlans.map((plan) => (
                      <Picker.Item
                        key={plan.user_plan_id}
                        label={plan.plan_details?.name || 'Workout Plan'}
                        value={plan.plan_id}
                        color={theme.colors.text.primary}
                      />
                    ))}
                  </Picker>
                </View>
              )}

              <Text style={styles.label}>Workout Day</Text>
              <TouchableOpacity 
                style={styles.pickerButton}
                onPress={() => {
                  setTempDay(selectedDay);
                  setDayPickerVisible(true);
                }}
              >
                <Text style={styles.pickerButtonText}>Day {selectedDay}</Text>
                <Ionicons name="chevron-down" size={20} color={theme.colors.text.secondary} />
              </TouchableOpacity>

              <Text style={styles.label}>Time</Text>
              <TouchableOpacity 
                style={styles.pickerButton}
                onPress={() => {
                  setTempTime(time);
                  setTimePickerVisible(true);
                }}
              >
                <Text style={styles.pickerButtonText}>{formatTime(time)}</Text>
                <Ionicons name="chevron-down" size={20} color={theme.colors.text.secondary} />
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.label}>Reminder</Text>
                  <Text style={styles.switchSubtext}>Get notified before workout</Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, reminderEnabled && styles.switchActive]}
                  onPress={() => setReminderEnabled(!reminderEnabled)}
                >
                  <Text style={[styles.switchText, reminderEnabled && styles.switchTextActive]}>
                    {reminderEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {reminderEnabled && (
                <View style={styles.reminderOptions}>
                  {[15, 30, 60].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.reminderOption,
                        reminderMinutes === mins && styles.reminderOptionActive
                      ]}
                      onPress={() => setReminderMinutes(mins)}
                    >
                      <Text style={[
                        styles.reminderOptionText,
                        reminderMinutes === mins && styles.reminderOptionTextActive
                      ]}>
                        {mins < 60 ? `${mins} min` : '1 hour'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.scheduleButton, !selectedPlan && styles.scheduleButtonDisabled]} 
              onPress={handleScheduleWorkout}
              disabled={!selectedPlan}
            >
              <Text style={styles.scheduleButtonText}>Schedule for {formatDateLabel(selectedDate)}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Day Picker Modal */}
      <Modal
        visible={dayPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDayPickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDayPickerVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.pickerModalContent}
          >
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setDayPickerVisible(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Workout Day</Text>
              <TouchableOpacity onPress={() => {
                setSelectedDay(tempDay);
                setDayPickerVisible(false);
              }}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={tempDay}
              onValueChange={(value) => setTempDay(value)}
              style={styles.wheelPicker}
              itemStyle={{ color: theme.colors.text.primary, fontSize: 20 }}
            >
              {DAY_OPTIONS.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={timePickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTimePickerVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.pickerModalContent}
          >
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Workout Time</Text>
              <TouchableOpacity onPress={() => {
                setTime(tempTime);
                setTimePickerVisible(false);
              }}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={tempTime}
              onValueChange={(value) => setTempTime(value)}
              style={styles.wheelPicker}
              itemStyle={{ color: theme.colors.text.primary, fontSize: 20 }}
            >
              {TIME_OPTIONS.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        visible={rescheduleModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRescheduleModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Move Workout</Text>
              <TouchableOpacity onPress={() => setRescheduleModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.rescheduleInfo}>
                Moving workout from {formatDateLabel(workoutToReschedule?.scheduled_date || '')}
              </Text>

              <Text style={styles.label}>New Date</Text>
              <View style={styles.quickDates}>
                {quickDateOptions.map((option) => (
                  <TouchableOpacity
                    key={option.date}
                    style={[
                      styles.quickDateBtn,
                      newScheduleDate === option.date && styles.quickDateBtnActive
                    ]}
                    onPress={() => setNewScheduleDate(option.date)}
                  >
                    <Text style={[
                      styles.quickDateText,
                      newScheduleDate === option.date && styles.quickDateTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.miniCalendarContainer}>
                <Calendar
                  onDayPress={(day: any) => setNewScheduleDate(day.dateString)}
                  markedDates={{
                    [newScheduleDate]: {
                      selected: true,
                      selectedColor: theme.accentColors.primary,
                    }
                  }}
                  theme={{
                    calendarBackground: theme.colors.background.secondary,
                    textSectionTitleColor: theme.colors.text.secondary,
                    dayTextColor: theme.colors.text.primary,
                    todayTextColor: theme.accentColors.primary,
                    selectedDayBackgroundColor: theme.accentColors.primary,
                    selectedDayTextColor: '#ffffff',
                    arrowColor: theme.accentColors.primary,
                    monthTextColor: theme.colors.text.primary,
                    textDisabledColor: theme.colors.text.muted,
                  }}
                  style={styles.miniCalendar}
                />
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.scheduleButton} 
              onPress={handleRescheduleWorkout}
            >
              <Text style={styles.scheduleButtonText}>Move to {formatDateLabel(newScheduleDate)}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
    opacity: 0.7,
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
  workoutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  workoutActionBtn: {
    padding: 6,
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
  completedText: {
    fontSize: 14,
    color: theme.colors.status.success,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  modalScroll: {
    maxHeight: 450,
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
  pickerContainer: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: theme.colors.text.primary,
  },
  pickerButton: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  pickerModalContent: {
    backgroundColor: theme.colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  pickerCancelText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accentColors.primary,
  },
  wheelPicker: {
    height: 200,
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
    marginTop: 20,
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
});

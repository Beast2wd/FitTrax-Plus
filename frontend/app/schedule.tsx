import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { plansAPI } from '../services/api';
import * as Notifications from 'expo-notifications';
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from 'date-fns';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function ScheduleScreen() {
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

  useEffect(() => {
    if (userId) {
      loadData();
      requestNotificationPermissions();
    }
  }, [userId]);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
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

  const scheduleNotification = async (date: string, time: string, minutesBefore: number, workoutName: string) => {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledTime = new Date(date);
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      const notificationTime = new Date(scheduledTime.getTime() - minutesBefore * 60000);

      if (notificationTime > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Workout Reminder! 💪',
            body: `${workoutName} starts in ${minutesBefore} minutes`,
            data: { date, time },
          },
          trigger: notificationTime,
        });
      }
    } catch (error) {
      console.log('Could not schedule notification:', error);
    }
  };

  const openAddWorkoutModal = () => {
    // Default to today's date
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
        Alert.alert('Success', `Workout scheduled for ${formatDateLabel(selectedDate)}!`);
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
        { color: workout.completed ? Colors.status.success : Colors.brand.primary }
      ],
      selected: workout.scheduled_date === selectedDate,
      selectedColor: Colors.brand.primary,
    };
    return acc;
  }, {
    [selectedDate]: {
      selected: true,
      selectedColor: Colors.brand.primary,
    }
  });

  const workoutsForSelectedDate = scheduledWorkouts.filter(
    (w) => w.scheduled_date === selectedDate
  );

  const upcomingWorkouts = scheduledWorkouts
    .filter(w => w.scheduled_date >= today && !w.completed)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Workout Schedule</Text>
          <TouchableOpacity onPress={openAddWorkoutModal} style={styles.addBtn}>
            <Ionicons name="add" size={28} color={Colors.brand.primary} />
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
                      <Text style={styles.upcomingTime}>{workout.scheduled_time}</Text>
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
                      <Ionicons name="calendar-outline" size={20} color={Colors.brand.primary} />
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
              todayTextColor: Colors.brand.primary,
              selectedDayBackgroundColor: Colors.brand.primary,
              selectedDayTextColor: '#ffffff',
              arrowColor: Colors.brand.primary,
              dotColor: Colors.brand.primary,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
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
              <Ionicons name="add" size={20} color={Colors.brand.primary} />
              <Text style={styles.addForDateText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {workoutsForSelectedDate.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={Colors.text.muted} />
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
                        color={workout.completed ? Colors.status.success : Colors.brand.primary} 
                      />
                      <Text style={styles.workoutTime}>{workout.scheduled_time}</Text>
                    </View>
                    {!workout.completed && (
                      <View style={styles.workoutActions}>
                        <TouchableOpacity
                          onPress={() => openRescheduleModal(workout)}
                          style={styles.workoutActionBtn}
                        >
                          <Ionicons name="swap-horizontal" size={18} color={Colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteWorkout(workout.scheduled_id)}
                          style={styles.workoutActionBtn}
                        >
                          <Ionicons name="trash-outline" size={18} color={Colors.status.error} />
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
                      <Ionicons name="checkmark-circle" size={16} color={Colors.status.success} />
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Workout</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
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
                  >
                    <Picker.Item label="Choose a plan..." value="" />
                    {userPlans.map((plan) => (
                      <Picker.Item
                        key={plan.user_plan_id}
                        label={plan.plan_details?.name || 'Workout Plan'}
                        value={plan.plan_id}
                      />
                    ))}
                  </Picker>
                </View>
              )}

              <Text style={styles.label}>Workout Day</Text>
              <TextInput
                style={styles.input}
                value={selectedDay}
                onChangeText={setSelectedDay}
                placeholder="Enter day number (1, 2, 3...)"
                keyboardType="numeric"
                placeholderTextColor={Colors.text.muted}
              />

              <Text style={styles.label}>Time</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM (e.g., 08:00)"
                placeholderTextColor={Colors.text.muted}
              />

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
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        visible={rescheduleModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Move Workout</Text>
              <TouchableOpacity onPress={() => setRescheduleModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
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
                      selectedColor: Colors.brand.primary,
                    }
                  }}
                  theme={{
                    todayTextColor: Colors.brand.primary,
                    selectedDayBackgroundColor: Colors.brand.primary,
                    selectedDayTextColor: '#ffffff',
                    arrowColor: Colors.brand.primary,
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light,
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
    color: Colors.text.primary,
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
    backgroundColor: Colors.brand.primary,
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
    color: Colors.text.primary,
  },
  addForDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addForDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.primary,
  },
  upcomingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
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
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginRight: 12,
    minWidth: 70,
  },
  upcomingDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.primary,
  },
  upcomingTime: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingPlan: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  upcomingDay: {
    fontSize: 13,
    color: Colors.text.secondary,
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
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.status.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.background.card,
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
    backgroundColor: Colors.background.card,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.muted,
    marginTop: 12,
  },
  emptyButton: {
    backgroundColor: Colors.brand.primary,
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
    backgroundColor: Colors.background.card,
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
    color: Colors.text.primary,
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
    color: Colors.text.primary,
    marginBottom: 4,
  },
  workoutDay: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  markCompleteBtn: {
    backgroundColor: Colors.status.success,
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
    color: Colors.status.success,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    color: Colors.text.primary,
  },
  modalScroll: {
    maxHeight: 450,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickDateBtnActive: {
    backgroundColor: Colors.brand.primary,
  },
  quickDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  quickDateTextActive: {
    color: '#fff',
  },
  selectedDateLabel: {
    fontSize: 14,
    color: Colors.brand.primary,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  switchSubtext: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  switch: {
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  switchActive: {
    backgroundColor: Colors.status.success,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reminderOptionActive: {
    backgroundColor: Colors.brand.primary,
  },
  reminderOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  reminderOptionTextActive: {
    color: '#fff',
  },
  scheduleButton: {
    backgroundColor: Colors.brand.primary,
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
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  miniCalendarContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  miniCalendar: {
    borderRadius: 12,
  },
});

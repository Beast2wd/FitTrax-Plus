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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { plansAPI } from '../services/api';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';

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
  const [selectedDate, setSelectedDate] = useState('');
  const [scheduledWorkouts, setScheduledWorkouts] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [workoutPlans, setWorkoutPlans] = useState<any[]>([]);
  const [userPlans, setUserPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedDay, setSelectedDay] = useState('1');
  const [time, setTime] = useState('08:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(30);

  useEffect(() => {
    if (userId) {
      loadData();
      requestNotificationPermissions();
    }
  }, [userId]);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please enable notifications to receive workout reminders');
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

  const scheduleNotification = async (date: string, time: string, minutesBefore: number) => {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledTime = new Date(date);
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    const notificationTime = new Date(scheduledTime.getTime() - minutesBefore * 60000);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Workout Reminder! 💪',
        body: `Your workout is starting in ${minutesBefore} minutes`,
        data: { date, time },
      },
      trigger: notificationTime,
    });
  };

  const handleScheduleWorkout = async () => {
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }

    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a workout plan');
      return;
    }

    try {
      const scheduledId = `scheduled_${Date.now()}`;
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
          await scheduleNotification(selectedDate, time, reminderMinutes);
        }
        Alert.alert('Success', 'Workout scheduled!');
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
      Alert.alert('Success', 'Workout marked as complete!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update workout');
    }
  };

  const markedDates = scheduledWorkouts.reduce((acc, workout) => {
    acc[workout.scheduled_date] = {
      marked: true,
      dotColor: workout.completed ? Colors.status.success : Colors.brand.primary,
      selected: workout.scheduled_date === selectedDate,
      selectedColor: Colors.brand.primary,
    };
    return acc;
  }, {});

  const workoutsForSelectedDate = scheduledWorkouts.filter(
    (w) => w.scheduled_date === selectedDate
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Workout Schedule</Text>

        <View style={styles.card}>
          <Calendar
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              todayTextColor: Colors.brand.primary,
              selectedDayBackgroundColor: Colors.brand.primary,
              selectedDayTextColor: '#ffffff',
              arrowColor: Colors.brand.primary,
            }}
          />
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (!selectedDate) {
              Alert.alert('Please select a date first');
              return;
            }
            setModalVisible(true);
          }}
        >
          <Ionicons name="add-circle" size={24} color={Colors.text.white} />
          <Text style={styles.addButtonText}>Schedule Workout</Text>
        </TouchableOpacity>

        {/* Workouts for selected date */}
        {workoutsForSelectedDate.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Workouts for {format(new Date(selectedDate), 'MMM d, yyyy')}
            </Text>
            {workoutsForSelectedDate.map((workout) => (
              <View key={workout.scheduled_id} style={styles.workoutItem}>
                <View style={styles.workoutLeft}>
                  <Ionicons
                    name={workout.completed ? 'checkmark-circle' : 'time-outline'}
                    size={24}
                    color={workout.completed ? Colors.status.success : Colors.brand.primary}
                  />
                  <View style={styles.workoutInfo}>
                    <Text style={styles.workoutTime}>{workout.scheduled_time}</Text>
                    <Text style={styles.workoutLabel}>Day {workout.workout_day}</Text>
                  </View>
                </View>
                {!workout.completed && (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => handleCompleteWorkout(workout.scheduled_id)}
                  >
                    <Text style={styles.completeButtonText}>Complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Schedule Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Schedule Workout</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Select Active Plan</Text>
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

            <Text style={styles.label}>Workout Day</Text>
            <TextInput
              style={styles.input}
              value={selectedDay}
              onChangeText={setSelectedDay}
              placeholder="Enter day number"
              keyboardType="numeric"
              placeholderTextColor={Colors.text.muted}
            />

            <Text style={styles.label}>Time</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM (24-hour format)"
              placeholderTextColor={Colors.text.muted}
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Enable Reminder</Text>
              <TouchableOpacity
                style={[styles.switch, reminderEnabled && styles.switchActive]}
                onPress={() => setReminderEnabled(!reminderEnabled)}
              >
                <Text style={styles.switchText}>{reminderEnabled ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>

            {reminderEnabled && (
              <View>
                <Text style={styles.label}>Remind me before</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={reminderMinutes}
                    onValueChange={(value) => setReminderMinutes(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="15 minutes" value={15} />
                    <Picker.Item label="30 minutes" value={30} />
                    <Picker.Item label="1 hour" value={60} />
                    <Picker.Item label="2 hours" value={120} />
                  </Picker>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleScheduleWorkout}>
              <Text style={styles.buttonText}>Schedule Workout</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 20,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
  workoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  workoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  workoutInfo: {
    marginLeft: 12,
  },
  workoutTime: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  workoutLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  completeButton: {
    backgroundColor: Colors.status.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeButtonText: {
    color: Colors.text.white,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background.light,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
  },
  pickerContainer: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  switch: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  switchActive: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  switchText: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
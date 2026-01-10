import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '../stores/userStore';
import { useThemeStore } from '../stores/themeStore';
import { SwipeableRow } from '../components/SwipeableRow';
import axios from 'axios';
import { format } from 'date-fns';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Days of the week for columns
const DAYS = ['1', '2', '3', '4', '5', '6', '7'];

interface WorkoutEntry {
  entry_id: string;
  user_id: string;
  exercise_name: string;
  sets: SetData[];
  notes: string;
  created_at: string;
  updated_at: string;
}

interface SetData {
  set_number: number;
  days: {
    [key: string]: {
      reps: string;
      weight: string;
    };
  };
}

export default function ManualWorkoutLogScreen() {
  const { userId } = useUserStore();
  const { theme } = useThemeStore();
  const colors = theme.colors;
  const accent = theme.accentColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<WorkoutEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for new/edit entry
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState<SetData[]>([
    { set_number: 1, days: {} },
    { set_number: 2, days: {} },
    { set_number: 3, days: {} },
  ]);
  const [notes, setNotes] = useState('');

  const loadEntries = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/manual-workout-log/${userId}`);
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading workout log entries:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const resetForm = () => {
    setExerciseName('');
    setSets([
      { set_number: 1, days: {} },
      { set_number: 2, days: {} },
      { set_number: 3, days: {} },
    ]);
    setNotes('');
    setEditingEntry(null);
    setIsEditing(false);
  };

  const addSet = () => {
    setSets([...sets, { set_number: sets.length + 1, days: {} }]);
  };

  const removeSet = () => {
    if (sets.length > 1) {
      setSets(sets.slice(0, -1));
    }
  };

  const updateSetData = (setIndex: number, day: string, field: 'reps' | 'weight', value: string) => {
    const newSets = [...sets];
    if (!newSets[setIndex].days[day]) {
      newSets[setIndex].days[day] = { reps: '', weight: '' };
    }
    newSets[setIndex].days[day][field] = value;
    setSets(newSets);
  };

  const saveEntry = async () => {
    if (!exerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    try {
      const entryData = {
        user_id: userId,
        exercise_name: exerciseName,
        sets: sets,
        notes: notes,
      };

      if (editingEntry) {
        // Update existing entry
        await axios.put(`${API_URL}/api/manual-workout-log/${editingEntry.entry_id}`, entryData);
        Alert.alert('Success', 'Workout entry updated');
      } else {
        // Create new entry
        await axios.post(`${API_URL}/api/manual-workout-log`, entryData);
        Alert.alert('Success', 'Workout entry saved');
      }

      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error saving workout entry:', error);
      Alert.alert('Error', 'Failed to save workout entry');
    }
  };

  const editEntry = (entry: WorkoutEntry) => {
    setEditingEntry(entry);
    setExerciseName(entry.exercise_name);
    setSets(entry.sets.length > 0 ? entry.sets : [{ set_number: 1, days: {} }]);
    setNotes(entry.notes || '');
    setIsEditing(true);
  };

  const deleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this workout entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/manual-workout-log/${entryId}`);
              setEntries(entries.filter(e => e.entry_id !== entryId));
              Alert.alert('Deleted', 'Workout entry removed');
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border.primary }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
              {isEditing ? 'Edit Workout' : 'Manual Workout Log'}
            </Text>
            {isEditing ? (
              <TouchableOpacity onPress={resetForm}>
                <Text style={[styles.cancelText, { color: accent.primary }]}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 50 }} />
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Workout Entry Form */}
            <View style={[styles.card, { backgroundColor: colors.background.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
                {isEditing ? 'Edit Exercise' : 'New Exercise Entry'}
              </Text>

              {/* Exercise Name */}
              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Exercise Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.input, color: colors.text.primary }]}
                value={exerciseName}
                onChangeText={setExerciseName}
                placeholder="e.g., Bench Press"
                placeholderTextColor={colors.text.muted}
              />

              {/* Sets/Reps/Weight Table */}
              <View style={styles.tableContainer}>
                <Text style={[styles.tableTitle, { color: colors.text.secondary }]}>
                  Sets & Reps (7-Day Tracker)
                </Text>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <View style={styles.setColumn}>
                    <Text style={[styles.headerCell, { color: colors.text.secondary }]}>Sets</Text>
                  </View>
                  {DAYS.map(day => (
                    <View key={day} style={styles.dayColumn}>
                      <Text style={[styles.headerCell, { color: colors.text.secondary }]}>{day}</Text>
                    </View>
                  ))}
                </View>

                {/* Table Rows */}
                {sets.map((set, setIndex) => (
                  <View key={setIndex}>
                    {/* Reps Row */}
                    <View style={[styles.tableRow, { backgroundColor: setIndex % 2 === 0 ? colors.background.input : 'transparent' }]}>
                      <View style={styles.setColumn}>
                        <Text style={[styles.setLabel, { color: colors.text.primary }]}>Reps</Text>
                      </View>
                      {DAYS.map(day => (
                        <View key={day} style={styles.dayColumn}>
                          <TextInput
                            style={[styles.cellInput, { color: colors.text.primary, borderColor: colors.border.primary }]}
                            value={set.days[day]?.reps || ''}
                            onChangeText={(val) => updateSetData(setIndex, day, 'reps', val)}
                            keyboardType="number-pad"
                            placeholder="-"
                            placeholderTextColor={colors.text.muted}
                          />
                        </View>
                      ))}
                    </View>
                    {/* Weight Row */}
                    <View style={[styles.tableRow, { backgroundColor: setIndex % 2 === 0 ? colors.background.input : 'transparent' }]}>
                      <View style={styles.setColumn}>
                        <Text style={[styles.setLabel, { color: colors.text.secondary }]}>Weight</Text>
                      </View>
                      {DAYS.map(day => (
                        <View key={day} style={styles.dayColumn}>
                          <TextInput
                            style={[styles.cellInput, { color: colors.text.primary, borderColor: colors.border.primary }]}
                            value={set.days[day]?.weight || ''}
                            onChangeText={(val) => updateSetData(setIndex, day, 'weight', val)}
                            keyboardType="number-pad"
                            placeholder="-"
                            placeholderTextColor={colors.text.muted}
                          />
                        </View>
                      ))}
                    </View>
                    {/* Set Divider */}
                    {setIndex < sets.length - 1 && (
                      <View style={[styles.setDivider, { backgroundColor: colors.border.primary }]} />
                    )}
                  </View>
                ))}

                {/* Add/Remove Set Buttons */}
                <View style={styles.setButtons}>
                  <TouchableOpacity
                    style={[styles.setButton, { borderColor: accent.primary }]}
                    onPress={addSet}
                  >
                    <Ionicons name="add" size={18} color={accent.primary} />
                    <Text style={[styles.setButtonText, { color: accent.primary }]}>Add Set</Text>
                  </TouchableOpacity>
                  {sets.length > 1 && (
                    <TouchableOpacity
                      style={[styles.setButton, { borderColor: '#EF4444' }]}
                      onPress={removeSet}
                    >
                      <Ionicons name="remove" size={18} color="#EF4444" />
                      <Text style={[styles.setButtonText, { color: '#EF4444' }]}>Remove Set</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Notes */}
              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput, { backgroundColor: colors.background.input, color: colors.text.primary }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes..."
                placeholderTextColor={colors.text.muted}
                multiline
              />

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: accent.primary }]}
                onPress={saveEntry}
              >
                <Ionicons name={isEditing ? 'checkmark' : 'save'} size={20} color="#fff" />
                <Text style={styles.saveButtonText}>{isEditing ? 'Update Entry' : 'Save Entry'}</Text>
              </TouchableOpacity>
            </View>

            {/* Saved Entries */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Saved Workout Entries
              </Text>
              <Text style={[styles.sectionHint, { color: colors.text.muted }]}>
                ← Swipe left to delete
              </Text>

              {entries.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: colors.background.card }]}>
                  <Ionicons name="clipboard-outline" size={48} color={colors.text.muted} />
                  <Text style={[styles.emptyText, { color: colors.text.primary }]}>No entries yet</Text>
                  <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
                    Add your first workout entry above
                  </Text>
                </View>
              ) : (
                entries.map((entry) => (
                  <SwipeableRow
                    key={entry.entry_id}
                    onDelete={() => deleteEntry(entry.entry_id)}
                  >
                    <TouchableOpacity
                      style={[styles.entryCard, { backgroundColor: colors.background.card }]}
                      onPress={() => editEntry(entry)}
                    >
                      <View style={styles.entryHeader}>
                        <Text style={[styles.entryName, { color: colors.text.primary }]}>
                          {entry.exercise_name}
                        </Text>
                        <TouchableOpacity onPress={() => editEntry(entry)}>
                          <Ionicons name="pencil" size={18} color={accent.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.entrySets, { color: colors.text.secondary }]}>
                        {entry.sets?.length || 0} sets recorded
                      </Text>
                      {entry.notes && (
                        <Text style={[styles.entryNotes, { color: colors.text.muted }]} numberOfLines={1}>
                          {entry.notes}
                        </Text>
                      )}
                      <Text style={[styles.entryDate, { color: colors.text.muted }]}>
                        {format(new Date(entry.created_at), 'MMM d, yyyy')}
                      </Text>
                    </TouchableOpacity>
                  </SwipeableRow>
                ))
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  tableContainer: {
    marginTop: 16,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  setColumn: {
    width: 60,
    justifyContent: 'center',
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 13,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'center',
  },
  setLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  cellInput: {
    width: 32,
    height: 28,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 12,
  },
  setDivider: {
    height: 1,
    marginVertical: 8,
  },
  setButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  setButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  setButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  entryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryName: {
    fontSize: 16,
    fontWeight: '700',
  },
  entrySets: {
    fontSize: 14,
    marginTop: 4,
  },
  entryNotes: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  entryDate: {
    fontSize: 12,
    marginTop: 8,
  },
});

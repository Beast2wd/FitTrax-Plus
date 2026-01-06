import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../stores/themeStore';
import { useUserStore } from '../stores/userStore';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function WeightTrainingScreen() {
  const { theme } = useThemeStore();
  const { userId } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [programs, setPrograms] = useState<any>({});
  const [exercises, setExercises] = useState<any>({});
  const [stats, setStats] = useState<any>(null);
  const [prs, setPrs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
  // Modal states
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [showExerciseLibraryModal, setShowExerciseLibraryModal] = useState(false);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  
  // Workout logging state
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<any[]>([]);
  const [currentExercise, setCurrentExercise] = useState('');
  const [currentSets, setCurrentSets] = useState<any[]>([]);
  const [savingWorkout, setSavingWorkout] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [programsRes, exercisesRes, statsRes, prsRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/api/weight-training/programs`),
        axios.get(`${API_URL}/api/weight-training/exercises`),
        userId ? axios.get(`${API_URL}/api/weight-training/stats/${userId}`) : null,
        userId ? axios.get(`${API_URL}/api/weight-training/prs/${userId}`) : null,
        userId ? axios.get(`${API_URL}/api/weight-training/history/${userId}?days=30`) : null,
      ]);
      
      setPrograms(programsRes.data.programs || {});
      setExercises(exercisesRes.data.exercises || {});
      if (statsRes) setStats(statsRes.data);
      if (prsRes) setPrs(prsRes.data.personal_records || []);
      if (historyRes) setHistory(historyRes.data.workouts || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openProgram = (programId: string) => {
    setSelectedProgram({ id: programId, ...programs[programId] });
    setShowProgramModal(true);
  };

  const startWorkout = (day: any) => {
    setSelectedDay(day);
    setWorkoutName(day.name);
    setWorkoutExercises([]);
    setCurrentSets([]);
    setShowWorkoutModal(true);
  };

  const openExerciseLibrary = (muscleGroup: string) => {
    setSelectedMuscleGroup(muscleGroup);
    setShowExerciseLibraryModal(true);
  };

  const selectExerciseFromLibrary = (exerciseName: string) => {
    setCurrentExercise(exerciseName);
    setShowExerciseLibraryModal(false);
  };

  const addSet = () => {
    setCurrentSets([...currentSets, { weight: '', reps: '', rpe: '' }]);
  };

  const updateSet = (index: number, field: string, value: string) => {
    const updated = [...currentSets];
    updated[index][field] = value;
    setCurrentSets(updated);
  };

  const removeSet = (index: number) => {
    setCurrentSets(currentSets.filter((_, i) => i !== index));
  };

  const addExerciseToWorkout = () => {
    if (!currentExercise || currentSets.length === 0) {
      Alert.alert('Missing Info', 'Please enter exercise name and at least one set');
      return;
    }

    const validSets = currentSets
      .filter(s => s.weight && s.reps)
      .map((s, i) => ({
        set_number: i + 1,
        weight: parseFloat(s.weight),
        reps: parseInt(s.reps),
        rpe: s.rpe ? parseInt(s.rpe) : null
      }));

    if (validSets.length === 0) {
      Alert.alert('Invalid Sets', 'Please enter weight and reps for at least one set');
      return;
    }

    setWorkoutExercises([
      ...workoutExercises,
      {
        exercise_name: currentExercise,
        sets: validSets
      }
    ]);
    setCurrentExercise('');
    setCurrentSets([]);
  };

  const saveWorkout = async () => {
    if (workoutExercises.length === 0) {
      Alert.alert('No Exercises', 'Please add at least one exercise');
      return;
    }

    setSavingWorkout(true);
    try {
      const response = await axios.post(`${API_URL}/api/weight-training/log`, {
        workout_id: `wt_${Date.now()}`,
        user_id: userId,
        workout_name: workoutName || 'Weight Training',
        exercises: workoutExercises,
        duration_minutes: 60,
        notes: ''
      });

      const { new_prs, total_volume } = response.data;
      
      let message = `Total volume: ${total_volume.toLocaleString()} lbs`;
      if (new_prs && new_prs.length > 0) {
        message += `\n\n🏆 NEW PRs:\n${new_prs.map((pr: any) => `${pr.exercise}: ${pr.weight}lbs x ${pr.reps}`).join('\n')}`;
      }

      Alert.alert('💪 Workout Complete!', message);
      setShowWorkoutModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save workout');
    } finally {
      setSavingWorkout(false);
    }
  };

  const quickLogWorkout = () => {
    setWorkoutName('Quick Workout');
    setWorkoutExercises([]);
    setCurrentSets([]);
    setSelectedDay(null);
    setShowWorkoutModal(true);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#EF4444';
      default: return theme.colors.text.secondary;
    }
  };

  const getMuscleIcon = (muscle: string) => {
    const icons: any = {
      chest: '🫁',
      back: '🔙',
      shoulders: '💪',
      legs: '🦵',
      arms: '💪',
      core: '🎯'
    };
    return icons[muscle] || '💪';
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accentColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Weight Training</Text>
          <Text style={styles.subtitle}>Build strength & track progress</Text>
        </View>

        {/* Quick Log Button */}
        <TouchableOpacity onPress={quickLogWorkout}>
          <LinearGradient
            colors={['#7C3AED', '#5B21B6']}
            style={styles.quickLogCard}
          >
            <MaterialCommunityIcons name="dumbbell" size={40} color="#fff" />
            <View style={styles.quickLogText}>
              <Text style={styles.quickLogTitle}>Log Workout</Text>
              <Text style={styles.quickLogSubtitle}>Track your sets, reps & weight</Text>
            </View>
            <Ionicons name="add-circle" size={32} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Stats Overview */}
        {stats && stats.total_workouts > 0 && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total_workouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{(stats.total_volume / 1000).toFixed(1)}k</Text>
              <Text style={styles.statLabel}>Total lbs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total_sets}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total_prs}</Text>
              <Text style={styles.statLabel}>PRs</Text>
            </View>
          </View>
        )}

        {/* Personal Records */}
        {prs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Personal Records</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.prsRow}>
                {prs.slice(0, 5).map((pr, index) => (
                  <View key={index} style={styles.prCard}>
                    <Text style={styles.prExercise}>{pr.exercise_name}</Text>
                    <Text style={styles.prWeight}>{pr.weight} lbs</Text>
                    <Text style={styles.prReps}>x {pr.reps} reps</Text>
                    <Text style={styles.pr1rm}>Est 1RM: {pr.estimated_1rm?.toFixed(0)} lbs</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Training Programs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training Programs</Text>
          {Object.entries(programs).map(([key, program]: [string, any]) => (
            <TouchableOpacity
              key={key}
              style={styles.programCard}
              onPress={() => openProgram(key)}
            >
              <View style={styles.programLeft}>
                <View style={[styles.programIcon, { backgroundColor: '#7C3AED20' }]}>
                  <MaterialCommunityIcons name="weight-lifter" size={28} color="#7C3AED" />
                </View>
                <View style={styles.programInfo}>
                  <Text style={styles.programName}>{program.name}</Text>
                  <Text style={styles.programDescription}>{program.description}</Text>
                  <View style={styles.programMeta}>
                    <View style={styles.programBadge}>
                      <Ionicons name="calendar" size={12} color={theme.colors.text.secondary} />
                      <Text style={styles.programBadgeText}>{program.frequency}</Text>
                    </View>
                    <View style={[styles.programBadge, { backgroundColor: getLevelColor(program.level) + '20' }]}>
                      <Text style={[styles.programBadgeText, { color: getLevelColor(program.level) }]}>
                        {program.level}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.text.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Exercise Library */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercise Library</Text>
          <Text style={styles.sectionSubtitle}>Tap to view exercises</Text>
          <View style={styles.muscleGroups}>
            {Object.entries(exercises).map(([muscle, exList]: [string, any]) => (
              <TouchableOpacity 
                key={muscle} 
                style={styles.muscleCard}
                onPress={() => openExerciseLibrary(muscle)}
              >
                <Text style={styles.muscleIcon}>{getMuscleIcon(muscle)}</Text>
                <Text style={styles.muscleName}>{muscle.charAt(0).toUpperCase() + muscle.slice(1)}</Text>
                <Text style={styles.muscleCount}>{exList.length} exercises</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Workouts */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            {history.slice(0, 5).map((workout, index) => (
              <View key={index} style={styles.historyCard}>
                <View style={styles.historyIcon}>
                  <MaterialCommunityIcons name="dumbbell" size={24} color="#7C3AED" />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>{workout.workout_name}</Text>
                  <Text style={styles.historyMeta}>
                    {workout.exercises?.length || 0} exercises • {workout.duration_minutes} min
                  </Text>
                </View>
                <Text style={styles.historyDate}>
                  {new Date(workout.timestamp).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Exercise Library Modal */}
      <Modal
        visible={showExerciseLibraryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExerciseLibraryModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowExerciseLibraryModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.exerciseLibraryModal}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowExerciseLibraryModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {selectedMuscleGroup ? selectedMuscleGroup.charAt(0).toUpperCase() + selectedMuscleGroup.slice(1) : ''} Exercises
              </Text>
              <View style={{ width: 28 }} />
            </View>

            <FlatList
              data={selectedMuscleGroup ? exercises[selectedMuscleGroup] || [] : []}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.exerciseItem}
                  onPress={() => selectExerciseFromLibrary(item.name)}
                >
                  <View style={styles.exerciseItemLeft}>
                    <View style={styles.exerciseIconContainer}>
                      <MaterialCommunityIcons name="dumbbell" size={24} color="#7C3AED" />
                    </View>
                    <View style={styles.exerciseItemInfo}>
                      <Text style={styles.exerciseItemName}>{item.name}</Text>
                      <Text style={styles.exerciseItemEquipment}>
                        {item.equipment?.join(', ')}
                      </Text>
                      <View style={styles.muscleTagsRow}>
                        {item.muscle_groups?.slice(0, 3).map((mg: string, idx: number) => (
                          <View key={idx} style={styles.muscleTag}>
                            <Text style={styles.muscleTagText}>{mg}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                  <Ionicons name="add-circle" size={28} color={theme.accentColors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>No exercises found</Text>
                </View>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Program Detail Modal */}
      <Modal
        visible={showProgramModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProgramModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProgramModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.fullScreenModal}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowProgramModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedProgram?.name}</Text>
              <View style={{ width: 28 }} />
            </View>

            {selectedProgram && (
              <ScrollView style={styles.modalContent}>
                <Text style={styles.programDetailDesc}>{selectedProgram.description}</Text>
                <View style={styles.programDetailMeta}>
                  <Text style={styles.programDetailFreq}>📅 {selectedProgram.frequency}</Text>
                  <Text style={styles.programDetailLevel}>💪 {selectedProgram.level}</Text>
                </View>

                {selectedProgram.days?.map((day: any, index: number) => (
                  <View key={index} style={styles.dayCard}>
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayName}>{day.name}</Text>
                      <TouchableOpacity
                        style={styles.startDayBtn}
                        onPress={() => {
                          setShowProgramModal(false);
                          startWorkout(day);
                        }}
                      >
                        <Ionicons name="play" size={16} color="#fff" />
                        <Text style={styles.startDayBtnText}>Start</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dayFocus}>Focus: {day.focus?.join(', ')}</Text>
                    
                    {day.exercises?.map((ex: any, exIndex: number) => (
                      <View key={exIndex} style={styles.dayExercise}>
                        <Text style={styles.dayExNumber}>{exIndex + 1}</Text>
                        <View style={styles.dayExInfo}>
                          <Text style={styles.dayExName}>{ex.name}</Text>
                          <Text style={styles.dayExDetails}>
                            {ex.sets} sets × {ex.reps} • {ex.rest}s rest
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Workout Logging Modal */}
      <Modal
        visible={showWorkoutModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWorkoutModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWorkoutModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.fullScreenModal}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowWorkoutModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Log Workout</Text>
              <TouchableOpacity onPress={saveWorkout} disabled={savingWorkout}>
                {savingWorkout ? (
                  <ActivityIndicator size="small" color={theme.accentColors.primary} />
                ) : (
                  <Text style={styles.saveBtn}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Workout Name */}
              <Text style={styles.inputLabel}>Workout Name</Text>
              <TextInput
                style={styles.textInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="e.g., Push Day"
                placeholderTextColor={theme.colors.text.muted}
              />

              {/* Logged Exercises */}
              {workoutExercises.map((ex, index) => (
                <View key={index} style={styles.loggedExercise}>
                  <View style={styles.loggedExHeader}>
                    <Text style={styles.loggedExName}>{ex.exercise_name}</Text>
                    <TouchableOpacity 
                      onPress={() => setWorkoutExercises(workoutExercises.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="trash-outline" size={20} color={theme.colors.status.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.loggedSets}>
                    {ex.sets.map((s: any, sIndex: number) => (
                      <Text key={sIndex} style={styles.loggedSetText}>
                        Set {s.set_number}: {s.weight} lbs × {s.reps}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}

              {/* Add Exercise Section */}
              <View style={styles.addExerciseSection}>
                <Text style={styles.inputLabel}>Add Exercise</Text>
                <View style={styles.exerciseInputRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={currentExercise}
                    onChangeText={setCurrentExercise}
                    placeholder="Exercise name"
                    placeholderTextColor={theme.colors.text.muted}
                  />
                  <TouchableOpacity 
                    style={styles.browseBtn}
                    onPress={() => openExerciseLibrary('chest')}
                  >
                    <Ionicons name="search" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Sets */}
                <View style={styles.setsHeader}>
                  <Text style={styles.setsLabel}>Sets</Text>
                  <TouchableOpacity style={styles.addSetBtn} onPress={addSet}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addSetBtnText}>Add Set</Text>
                  </TouchableOpacity>
                </View>

                {currentSets.map((set, index) => (
                  <View key={index} style={styles.setRow}>
                    <Text style={styles.setNumber}>#{index + 1}</Text>
                    <TextInput
                      style={styles.setInput}
                      value={set.weight}
                      onChangeText={(v) => updateSet(index, 'weight', v)}
                      placeholder="Weight"
                      placeholderTextColor={theme.colors.text.muted}
                      keyboardType="numeric"
                    />
                    <Text style={styles.setX}>×</Text>
                    <TextInput
                      style={styles.setInput}
                      value={set.reps}
                      onChangeText={(v) => updateSet(index, 'reps', v)}
                      placeholder="Reps"
                      placeholderTextColor={theme.colors.text.muted}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => removeSet(index)}>
                      <Ionicons name="close-circle" size={24} color={theme.colors.text.muted} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addExerciseBtn} onPress={addExerciseToWorkout}>
                  <Text style={styles.addExerciseBtnText}>+ Add Exercise to Workout</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  quickLogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  quickLogText: {
    flex: 1,
  },
  quickLogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  quickLogSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#7C3AED',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 16,
  },
  prsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  prCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    minWidth: 140,
    alignItems: 'center',
  },
  prExercise: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  prWeight: {
    fontSize: 24,
    fontWeight: '800',
    color: '#D97706',
  },
  prReps: {
    fontSize: 14,
    color: '#6B7280',
  },
  pr1rm: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  programLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  programIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  programInfo: {
    flex: 1,
  },
  programName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  programDescription: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  programMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  programBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  programBadgeText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  muscleGroups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  muscleCard: {
    width: '30%',
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  muscleIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  muscleName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  muscleCount: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  historyMeta: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  historyDate: {
    fontSize: 12,
    color: theme.colors.text.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  fullScreenModal: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
    minHeight: '70%',
  },
  exerciseLibraryModal: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accentColors.primary,
  },
  programDetailDesc: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 16,
  },
  programDetailMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  programDetailFreq: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  programDetailLevel: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  dayCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  startDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  startDayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  dayFocus: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 12,
  },
  dayExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  dayExNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED20',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    marginRight: 12,
    overflow: 'hidden',
  },
  dayExInfo: {
    flex: 1,
  },
  dayExName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  dayExDetails: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  exerciseInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  browseBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loggedExercise: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  loggedExHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loggedExName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  loggedSets: {
    gap: 4,
  },
  loggedSetText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  addExerciseSection: {
    marginTop: 24,
    backgroundColor: '#7C3AED10',
    borderRadius: 16,
    padding: 16,
  },
  setsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  setsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addSetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    width: 30,
  },
  setInput: {
    flex: 1,
    backgroundColor: theme.colors.background.card,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  setX: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  addExerciseBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  addExerciseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  exerciseItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseItemInfo: {
    flex: 1,
  },
  exerciseItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  exerciseItemEquipment: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: 6,
  },
  muscleTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muscleTag: {
    backgroundColor: theme.accentColors.primary + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  muscleTagText: {
    fontSize: 11,
    color: theme.accentColors.primary,
    fontWeight: '500',
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: theme.colors.text.muted,
  },
});

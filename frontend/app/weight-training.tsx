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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../stores/themeStore';
import { useUserStore } from '../stores/userStore';
import { router } from 'expo-router';
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
  const [editingExercise, setEditingExercise] = useState<any>(null);
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  
  // Inline editing state (replaces nested modal)
  const [expandedExerciseKey, setExpandedExerciseKey] = useState<string | null>(null);
  
  // Workout logging state
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<any[]>([]);
  const [currentExercise, setCurrentExercise] = useState('');
  const [currentSets, setCurrentSets] = useState<any[]>([]);
  const [savingWorkout, setSavingWorkout] = useState(false);

  // Edit exercise state
  const [editExName, setEditExName] = useState('');
  const [editExSets, setEditExSets] = useState('');
  const [editExReps, setEditExReps] = useState('');
  const [editExRest, setEditExRest] = useState('');
  
  // Past workout view state
  const [showPastWorkoutModal, setShowPastWorkoutModal] = useState(false);
  const [selectedPastWorkout, setSelectedPastWorkout] = useState<any>(null);
  
  // Exercise detail view state
  const [showExerciseDetailModal, setShowExerciseDetailModal] = useState(false);
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<any>(null);

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
    const program = programs[programId];
    // Deep clone to allow editing
    setSelectedProgram({ 
      id: programId, 
      ...program,
      days: program.days?.map((day: any) => ({
        ...day,
        exercises: day.exercises?.map((ex: any) => ({ ...ex }))
      }))
    });
    setShowProgramModal(true);
  };

  const startWorkout = (day: any) => {
    setSelectedDay(day);
    setWorkoutName(day.name);
    // Pre-populate exercises from the day's workout plan
    const prefilledExercises = day.exercises?.map((ex: any) => ({
      exercise_name: ex.name,
      sets: Array.from({ length: parseInt(ex.sets) || 3 }, (_, i) => ({
        set_number: i + 1,
        weight: '',
        reps: ex.reps?.split('-')[0] || '10',
        rpe: ''
      }))
    })) || [];
    setWorkoutExercises(prefilledExercises);
    setCurrentSets([]);
    setCurrentExercise('');
    setShowWorkoutModal(true);
  };

  const startFullDayWorkout = (day: any) => {
    setShowProgramModal(false);
    setTimeout(() => {
      startWorkout(day);
    }, 300);
  };

  const openExerciseLibrary = (muscleGroup: string) => {
    setSelectedMuscleGroup(muscleGroup);
    setShowExerciseLibraryModal(true);
  };

  const closeExerciseLibrary = () => {
    setShowExerciseLibraryModal(false);
    setSelectedMuscleGroup(null);
  };

  const selectExerciseFromLibrary = (exerciseName: string) => {
    setCurrentExercise(exerciseName);
    closeExerciseLibrary();
  };

  const viewExerciseDetail = (exercise: any) => {
    // Close the exercise library first, then open detail after delay
    setShowExerciseLibraryModal(false);
    setSelectedExerciseDetail(exercise);
    setTimeout(() => {
      setShowExerciseDetailModal(true);
    }, 350);
  };

  const closeExerciseDetail = () => {
    setShowExerciseDetailModal(false);
    setSelectedExerciseDetail(null);
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

  // Update exercise sets in prefilled workout
  const updateExerciseSet = (exerciseIndex: number, setIndex: number, field: string, value: string) => {
    const updated = [...workoutExercises];
    updated[exerciseIndex].sets[setIndex][field] = value;
    setWorkoutExercises(updated);
  };

  // Remove exercise from workout
  const removeExerciseFromWorkout = (index: number) => {
    setWorkoutExercises(workoutExercises.filter((_, i) => i !== index));
  };

  // Move exercise up in workout
  const moveExerciseUp = (index: number) => {
    if (index === 0) return;
    const updated = [...workoutExercises];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setWorkoutExercises(updated);
  };

  // Move exercise down in workout
  const moveExerciseDown = (index: number) => {
    if (index === workoutExercises.length - 1) return;
    const updated = [...workoutExercises];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setWorkoutExercises(updated);
  };

  // Edit exercise in program - using inline expansion instead of nested modal
  const openEditExercise = (dayIndex: number, exerciseIndex: number, exercise: any) => {
    const key = `${dayIndex}-${exerciseIndex}`;
    
    // If same exercise is clicked, collapse it
    if (expandedExerciseKey === key) {
      setExpandedExerciseKey(null);
      return;
    }
    
    // Expand and populate edit fields
    setEditingDayIndex(dayIndex);
    setEditingExerciseIndex(exerciseIndex);
    setEditingExercise(exercise);
    setEditExName(exercise.name);
    setEditExSets(exercise.sets?.toString() || '3');
    setEditExReps(exercise.reps || '10');
    setEditExRest(exercise.rest?.toString() || '60');
    setExpandedExerciseKey(key);
  };

  const saveExerciseEdit = () => {
    if (!selectedProgram || editingDayIndex === null || editingExerciseIndex === null) return;
    
    const updated = { ...selectedProgram };
    updated.days[editingDayIndex].exercises[editingExerciseIndex] = {
      ...editingExercise,
      name: editExName,
      sets: parseInt(editExSets) || 3,
      reps: editExReps,
      rest: parseInt(editExRest) || 60,
    };
    setSelectedProgram(updated);
    setExpandedExerciseKey(null);
  };

  const cancelExerciseEdit = () => {
    setExpandedExerciseKey(null);
  };

  // Move exercise up in program day
  const moveExerciseUpInDay = (dayIndex: number, exerciseIndex: number) => {
    if (exerciseIndex === 0) return;
    const updated = { ...selectedProgram };
    const exercises = [...updated.days[dayIndex].exercises];
    [exercises[exerciseIndex - 1], exercises[exerciseIndex]] = [exercises[exerciseIndex], exercises[exerciseIndex - 1]];
    updated.days[dayIndex].exercises = exercises;
    setSelectedProgram(updated);
  };

  // Move exercise down in program day
  const moveExerciseDownInDay = (dayIndex: number, exerciseIndex: number) => {
    if (!selectedProgram || exerciseIndex === selectedProgram.days[dayIndex].exercises.length - 1) return;
    const updated = { ...selectedProgram };
    const exercises = [...updated.days[dayIndex].exercises];
    [exercises[exerciseIndex], exercises[exerciseIndex + 1]] = [exercises[exerciseIndex + 1], exercises[exerciseIndex]];
    updated.days[dayIndex].exercises = exercises;
    setSelectedProgram(updated);
  };

  // Delete exercise from program day
  const deleteExerciseFromDay = (dayIndex: number, exerciseIndex: number) => {
    Alert.alert(
      'Remove Exercise',
      'Are you sure you want to remove this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = { ...selectedProgram };
            updated.days[dayIndex].exercises = updated.days[dayIndex].exercises.filter((_: any, i: number) => i !== exerciseIndex);
            setSelectedProgram(updated);
          }
        }
      ]
    );
  };

  const saveWorkout = async () => {
    // Filter exercises that have at least one completed set
    const completedExercises = workoutExercises
      .map(ex => ({
        ...ex,
        sets: ex.sets.filter((s: any) => s.weight && s.reps)
      }))
      .filter(ex => ex.sets.length > 0);

    if (completedExercises.length === 0) {
      Alert.alert('No Exercises', 'Please complete at least one set with weight and reps');
      return;
    }

    setSavingWorkout(true);
    try {
      const response = await axios.post(`${API_URL}/api/weight-training/log`, {
        workout_id: `wt_${Date.now()}`,
        user_id: userId,
        workout_name: workoutName || 'Weight Training',
        exercises: completedExercises,
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Weight Training</Text>
            <Text style={styles.subtitle}>Build strength & track progress</Text>
          </View>
          <View style={{ width: 40 }} />
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
              <TouchableOpacity 
                key={index} 
                style={styles.historyCard}
                onPress={() => {
                  setSelectedPastWorkout(workout);
                  setShowPastWorkoutModal(true);
                }}
              >
                <View style={styles.historyIcon}>
                  <MaterialCommunityIcons name="dumbbell" size={24} color="#7C3AED" />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>{workout.workout_name}</Text>
                  <Text style={styles.historyMeta}>
                    {workout.exercises?.length || 0} exercises • {workout.duration_minutes} min
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyDate}>
                    {new Date(workout.timestamp).toLocaleDateString()}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.text.muted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Exercise Library Modal */}
      <Modal
        visible={showExerciseLibraryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeExerciseLibrary}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeExerciseLibrary} style={styles.closeButtonContainer}>
              <Ionicons name="close-circle" size={32} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
              {selectedMuscleGroup ? selectedMuscleGroup.charAt(0).toUpperCase() + selectedMuscleGroup.slice(1) : ''} Exercises
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            data={selectedMuscleGroup ? exercises[selectedMuscleGroup] || [] : []}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.exerciseItem, { marginHorizontal: 0 }]}
                onPress={() => viewExerciseDetail(item)}
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
                <Ionicons name="chevron-forward" size={24} color={theme.colors.text.muted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No exercises found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Program Detail Modal - FIXED SCROLLING */}
      <Modal
        visible={showProgramModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProgramModal(false)}
      >
        <View style={styles.fullScreenModalContainer}>
          <View style={styles.fullScreenModalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowProgramModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedProgram?.name}</Text>
              <View style={{ width: 28 }} />
            </View>

            {selectedProgram && (
              <ScrollView 
                style={styles.programScrollView}
                contentContainerStyle={styles.programScrollContent}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.programDetailDesc}>{selectedProgram.description}</Text>
                <View style={styles.programDetailMeta}>
                  <Text style={styles.programDetailFreq}>📅 {selectedProgram.frequency}</Text>
                  <Text style={styles.programDetailLevel}>💪 {selectedProgram.level}</Text>
                </View>

                <Text style={styles.instructionText}>
                  Tap exercises to edit • Use arrows to reorder • Tap Start to begin workout
                </Text>

                {selectedProgram.days?.map((day: any, dayIndex: number) => (
                  <View key={dayIndex} style={styles.dayCard}>
                    <View style={styles.dayHeader}>
                      <View>
                        <Text style={styles.dayName}>{day.name}</Text>
                        <Text style={styles.dayFocus}>Focus: {day.focus?.join(', ')}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.startAllBtn}
                        onPress={() => startFullDayWorkout(day)}
                      >
                        <Ionicons name="play" size={18} color="#fff" />
                        <Text style={styles.startAllBtnText}>Start All</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {day.exercises?.map((ex: any, exIndex: number) => {
                      const exerciseKey = `${dayIndex}-${exIndex}`;
                      const isExpanded = expandedExerciseKey === exerciseKey;
                      
                      return (
                        <View key={exIndex}>
                          <View style={styles.dayExerciseEditable}>
                            <View style={styles.exerciseReorderBtns}>
                              <TouchableOpacity 
                                onPress={() => moveExerciseUpInDay(dayIndex, exIndex)}
                                style={[styles.reorderBtn, exIndex === 0 && styles.reorderBtnDisabled]}
                                disabled={exIndex === 0}
                              >
                                <Ionicons name="chevron-up" size={18} color={exIndex === 0 ? theme.colors.text.muted : theme.accentColors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                onPress={() => moveExerciseDownInDay(dayIndex, exIndex)}
                                style={[styles.reorderBtn, exIndex === day.exercises.length - 1 && styles.reorderBtnDisabled]}
                                disabled={exIndex === day.exercises.length - 1}
                              >
                                <Ionicons name="chevron-down" size={18} color={exIndex === day.exercises.length - 1 ? theme.colors.text.muted : theme.accentColors.primary} />
                              </TouchableOpacity>
                            </View>

                            <TouchableOpacity 
                              style={styles.dayExInfo}
                              onPress={() => openEditExercise(dayIndex, exIndex, ex)}
                            >
                              <Text style={styles.dayExNumber}>{exIndex + 1}</Text>
                              <View style={styles.dayExDetails}>
                                <Text style={styles.dayExName}>{ex.name}</Text>
                                <Text style={styles.dayExMeta}>
                                  {ex.sets} sets × {ex.reps} • {ex.rest}s rest
                                </Text>
                              </View>
                              <Ionicons name={isExpanded ? "chevron-up" : "pencil"} size={16} color={isExpanded ? theme.accentColors.primary : theme.colors.text.muted} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                              style={styles.deleteExBtn}
                              onPress={() => deleteExerciseFromDay(dayIndex, exIndex)}
                            >
                              <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                          
                          {/* Inline Edit Form */}
                          {isExpanded && (
                            <View style={styles.inlineEditForm}>
                              <View style={styles.inlineEditRow}>
                                <Text style={styles.inlineEditLabel}>Name</Text>
                                <TextInput
                                  style={styles.inlineEditInput}
                                  value={editExName}
                                  onChangeText={setEditExName}
                                  placeholder="Exercise name"
                                  placeholderTextColor={theme.colors.text.muted}
                                />
                              </View>
                              <View style={styles.inlineEditGrid}>
                                <View style={styles.inlineEditGridItem}>
                                  <Text style={styles.inlineEditLabel}>Sets</Text>
                                  <TextInput
                                    style={styles.inlineEditInputSmall}
                                    value={editExSets}
                                    onChangeText={setEditExSets}
                                    keyboardType="numeric"
                                    placeholder="3"
                                    placeholderTextColor={theme.colors.text.muted}
                                  />
                                </View>
                                <View style={styles.inlineEditGridItem}>
                                  <Text style={styles.inlineEditLabel}>Reps</Text>
                                  <TextInput
                                    style={styles.inlineEditInputSmall}
                                    value={editExReps}
                                    onChangeText={setEditExReps}
                                    placeholder="8-12"
                                    placeholderTextColor={theme.colors.text.muted}
                                  />
                                </View>
                                <View style={styles.inlineEditGridItem}>
                                  <Text style={styles.inlineEditLabel}>Rest</Text>
                                  <TextInput
                                    style={styles.inlineEditInputSmall}
                                    value={editExRest}
                                    onChangeText={setEditExRest}
                                    keyboardType="numeric"
                                    placeholder="60"
                                    placeholderTextColor={theme.colors.text.muted}
                                  />
                                </View>
                              </View>
                              <View style={styles.inlineEditActions}>
                                <TouchableOpacity 
                                  style={styles.inlineEditCancel}
                                  onPress={cancelExerciseEdit}
                                >
                                  <Text style={styles.inlineEditCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  style={styles.inlineEditSave}
                                  onPress={saveExerciseEdit}
                                >
                                  <Text style={styles.inlineEditSaveText}>Save Changes</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}

                <View style={{ height: 100 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Workout Logging Modal */}
      <Modal
        visible={showWorkoutModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWorkoutModal(false)}
      >
        <View style={styles.fullScreenModalContainer}>
          <View style={styles.fullScreenModalContent}>
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

            <ScrollView style={styles.workoutScrollView} contentContainerStyle={styles.workoutScrollContent}>
              {/* Workout Name */}
              <Text style={styles.inputLabel}>Workout Name</Text>
              <TextInput
                style={styles.textInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="e.g., Push Day"
                placeholderTextColor={theme.colors.text.muted}
              />

              {/* Pre-filled Exercises from Program */}
              {workoutExercises.length > 0 && (
                <View style={styles.prefilledSection}>
                  <Text style={styles.prefilledTitle}>
                    Exercises ({workoutExercises.length})
                  </Text>
                  <Text style={styles.prefilledHint}>
                    Fill in your weights • Use arrows to reorder
                  </Text>
                  
                  {workoutExercises.map((ex, exIndex) => (
                    <View key={exIndex} style={styles.prefilledExercise}>
                      <View style={styles.prefilledExHeader}>
                        <View style={styles.exerciseReorderBtns}>
                          <TouchableOpacity 
                            onPress={() => moveExerciseUp(exIndex)}
                            style={[styles.smallReorderBtn, exIndex === 0 && styles.reorderBtnDisabled]}
                          >
                            <Ionicons name="chevron-up" size={16} color={exIndex === 0 ? theme.colors.text.muted : '#7C3AED'} />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            onPress={() => moveExerciseDown(exIndex)}
                            style={[styles.smallReorderBtn, exIndex === workoutExercises.length - 1 && styles.reorderBtnDisabled]}
                          >
                            <Ionicons name="chevron-down" size={16} color={exIndex === workoutExercises.length - 1 ? theme.colors.text.muted : '#7C3AED'} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.prefilledExName}>{ex.exercise_name}</Text>
                        <TouchableOpacity onPress={() => removeExerciseFromWorkout(exIndex)}>
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      
                      {ex.sets.map((set: any, setIndex: number) => (
                        <View key={setIndex} style={styles.prefilledSet}>
                          <Text style={styles.prefilledSetNum}>Set {set.set_number}</Text>
                          <TextInput
                            style={styles.prefilledInput}
                            value={set.weight?.toString() || ''}
                            onChangeText={(v) => updateExerciseSet(exIndex, setIndex, 'weight', v)}
                            placeholder="Weight"
                            placeholderTextColor={theme.colors.text.muted}
                            keyboardType="numeric"
                          />
                          <Text style={styles.prefilledX}>×</Text>
                          <TextInput
                            style={styles.prefilledInput}
                            value={set.reps?.toString() || ''}
                            onChangeText={(v) => updateExerciseSet(exIndex, setIndex, 'reps', v)}
                            placeholder="Reps"
                            placeholderTextColor={theme.colors.text.muted}
                            keyboardType="numeric"
                          />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Add New Exercise Section */}
              <View style={styles.addExerciseSection}>
                <Text style={styles.inputLabel}>Add New Exercise</Text>
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

                {currentExercise && currentSets.length > 0 && (
                  <TouchableOpacity style={styles.addExerciseBtn} onPress={addExerciseToWorkout}>
                    <Text style={styles.addExerciseBtnText}>+ Add to Workout</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Past Workout Detail Modal */}
      <Modal
        visible={showPastWorkoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPastWorkoutModal(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
          <View style={styles.pastWorkoutHeader}>
            <TouchableOpacity 
              onPress={() => setShowPastWorkoutModal(false)}
              style={styles.closeButtonContainer}
            >
              <Ionicons name="close-circle" size={32} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.pastWorkoutTitle, { color: theme.colors.text.primary }]}>Workout Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {selectedPastWorkout && (
            <ScrollView style={styles.pastWorkoutContent}>
              {/* Workout Header */}
              <View style={[styles.pastWorkoutInfo, { backgroundColor: theme.colors.background.card }]}>
                <Text style={[styles.pastWorkoutName, { color: theme.colors.text.primary }]}>
                  {selectedPastWorkout.workout_name}
                </Text>
                <Text style={[styles.pastWorkoutDate, { color: theme.colors.text.secondary }]}>
                  {new Date(selectedPastWorkout.timestamp).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
                <View style={styles.pastWorkoutStats}>
                  <View style={[styles.pastWorkoutStat, { backgroundColor: theme.colors.background.secondary }]}>
                    <MaterialCommunityIcons name="dumbbell" size={20} color={theme.accentColors.primary} />
                    <Text style={[styles.pastWorkoutStatValue, { color: theme.colors.text.primary }]}>
                      {selectedPastWorkout.exercises?.length || 0}
                    </Text>
                    <Text style={[styles.pastWorkoutStatLabel, { color: theme.colors.text.secondary }]}>Exercises</Text>
                  </View>
                  <View style={[styles.pastWorkoutStat, { backgroundColor: theme.colors.background.secondary }]}>
                    <Ionicons name="time-outline" size={20} color={theme.accentColors.primary} />
                    <Text style={[styles.pastWorkoutStatValue, { color: theme.colors.text.primary }]}>
                      {selectedPastWorkout.duration_minutes || 0}
                    </Text>
                    <Text style={[styles.pastWorkoutStatLabel, { color: theme.colors.text.secondary }]}>Minutes</Text>
                  </View>
                  <View style={[styles.pastWorkoutStat, { backgroundColor: theme.colors.background.secondary }]}>
                    <Ionicons name="barbell-outline" size={20} color={theme.accentColors.primary} />
                    <Text style={[styles.pastWorkoutStatValue, { color: theme.colors.text.primary }]}>
                      {selectedPastWorkout.exercises?.reduce((acc: number, ex: any) => 
                        acc + (ex.sets?.reduce((setAcc: number, set: any) => 
                          setAcc + ((parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0)), 0) || 0), 0
                      ).toLocaleString() || 0}
                    </Text>
                    <Text style={[styles.pastWorkoutStatLabel, { color: theme.colors.text.secondary }]}>Volume (lbs)</Text>
                  </View>
                </View>
              </View>

              {/* Exercises List */}
              <Text style={[styles.pastWorkoutSectionTitle, { color: theme.colors.text.primary }]}>
                Exercises Performed
              </Text>
              {selectedPastWorkout.exercises?.map((exercise: any, index: number) => (
                <View key={index} style={[styles.pastExerciseCard, { backgroundColor: theme.colors.background.card }]}>
                  <Text style={[styles.pastExerciseName, { color: theme.colors.text.primary }]}>
                    {exercise.exercise_name || exercise.name}
                  </Text>
                  <View style={styles.pastExerciseSets}>
                    {exercise.sets?.map((set: any, setIndex: number) => (
                      <View key={setIndex} style={[styles.pastSetRow, { backgroundColor: theme.colors.background.secondary }]}>
                        <Text style={[styles.pastSetNumber, { color: theme.colors.text.secondary }]}>
                          Set {set.set_number || setIndex + 1}
                        </Text>
                        <Text style={[styles.pastSetWeight, { color: theme.colors.text.primary }]}>
                          {set.weight} lbs
                        </Text>
                        <Text style={[styles.pastSetReps, { color: theme.accentColors.primary }]}>
                          × {set.reps} reps
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              {selectedPastWorkout.notes && (
                <View style={[styles.pastWorkoutNotes, { backgroundColor: theme.colors.background.card }]}>
                  <Text style={[styles.pastWorkoutNotesLabel, { color: theme.colors.text.secondary }]}>Notes</Text>
                  <Text style={[styles.pastWorkoutNotesText, { color: theme.colors.text.primary }]}>
                    {selectedPastWorkout.notes}
                  </Text>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Exercise Detail Modal */}
      <Modal
        visible={showExerciseDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExerciseDetailModal(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
          <View style={styles.exerciseDetailHeader}>
            <TouchableOpacity 
              onPress={() => setShowExerciseDetailModal(false)}
              style={styles.closeButtonContainer}
            >
              <Ionicons name="close-circle" size={32} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.exerciseDetailTitle, { color: theme.colors.text.primary }]}>
              Exercise Details
            </Text>
            <TouchableOpacity 
              onPress={() => {
                if (selectedExerciseDetail) {
                  selectExerciseFromLibrary(selectedExerciseDetail.name);
                  setShowExerciseDetailModal(false);
                }
              }}
              style={styles.addToWorkoutBtn}
            >
              <Text style={styles.addToWorkoutBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {selectedExerciseDetail && (
            <ScrollView style={styles.exerciseDetailContent}>
              {/* Exercise Icon and Name */}
              <View style={[styles.exerciseDetailTop, { backgroundColor: theme.colors.background.card }]}>
                <View style={styles.exerciseDetailIconLarge}>
                  <MaterialCommunityIcons name="dumbbell" size={48} color="#7C3AED" />
                </View>
                <Text style={[styles.exerciseDetailName, { color: theme.colors.text.primary }]}>
                  {selectedExerciseDetail.name}
                </Text>
              </View>

              {/* Target Muscles */}
              <View style={[styles.exerciseDetailSection, { backgroundColor: theme.colors.background.card }]}>
                <Text style={[styles.exerciseDetailSectionTitle, { color: theme.colors.text.primary }]}>
                  🎯 Target Muscles
                </Text>
                <View style={styles.muscleGroupList}>
                  {selectedExerciseDetail.muscle_groups?.map((muscle: string, idx: number) => (
                    <View key={idx} style={[styles.muscleGroupChip, { backgroundColor: '#7C3AED20' }]}>
                      <Text style={[styles.muscleGroupChipText, { color: '#7C3AED' }]}>{muscle}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Equipment */}
              <View style={[styles.exerciseDetailSection, { backgroundColor: theme.colors.background.card }]}>
                <Text style={[styles.exerciseDetailSectionTitle, { color: theme.colors.text.primary }]}>
                  🏋️ Equipment Needed
                </Text>
                <View style={styles.equipmentList}>
                  {selectedExerciseDetail.equipment?.map((eq: string, idx: number) => (
                    <View key={idx} style={[styles.equipmentChip, { backgroundColor: theme.colors.background.secondary }]}>
                      <Ionicons name="fitness" size={16} color={theme.accentColors.primary} />
                      <Text style={[styles.equipmentChipText, { color: theme.colors.text.primary }]}>{eq}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* How To Perform */}
              <View style={[styles.exerciseDetailSection, { backgroundColor: theme.colors.background.card }]}>
                <Text style={[styles.exerciseDetailSectionTitle, { color: theme.colors.text.primary }]}>
                  📝 How to Perform
                </Text>
                <View style={styles.instructionsList}>
                  <View style={styles.instructionItem}>
                    <View style={[styles.instructionNumber, { backgroundColor: '#7C3AED20' }]}>
                      <Text style={styles.instructionNumberText}>1</Text>
                    </View>
                    <Text style={[styles.instructionText, { color: theme.colors.text.secondary }]}>
                      Set up your position with proper form and grip
                    </Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={[styles.instructionNumber, { backgroundColor: '#7C3AED20' }]}>
                      <Text style={styles.instructionNumberText}>2</Text>
                    </View>
                    <Text style={[styles.instructionText, { color: theme.colors.text.secondary }]}>
                      Engage your core and maintain a neutral spine
                    </Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={[styles.instructionNumber, { backgroundColor: '#7C3AED20' }]}>
                      <Text style={styles.instructionNumberText}>3</Text>
                    </View>
                    <Text style={[styles.instructionText, { color: theme.colors.text.secondary }]}>
                      Perform the movement with controlled tempo
                    </Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={[styles.instructionNumber, { backgroundColor: '#7C3AED20' }]}>
                      <Text style={styles.instructionNumberText}>4</Text>
                    </View>
                    <Text style={[styles.instructionText, { color: theme.colors.text.secondary }]}>
                      Focus on the mind-muscle connection with target muscles
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tips */}
              <View style={[styles.exerciseDetailSection, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.exerciseDetailSectionTitle, { color: '#92400E' }]}>
                  💡 Pro Tips
                </Text>
                <Text style={{ color: '#78350F', fontSize: 14, lineHeight: 20 }}>
                  • Start with lighter weight to perfect your form{'\n'}
                  • Control the negative (lowering) phase{'\n'}
                  • Breathe out on exertion, in on recovery{'\n'}
                  • Rest 60-90 seconds between sets for hypertrophy
                </Text>
              </View>

              {/* Add to Workout Button */}
              <TouchableOpacity 
                style={styles.addToWorkoutFullBtn}
                onPress={() => {
                  selectExerciseFromLibrary(selectedExerciseDetail.name);
                  setShowExerciseDetailModal(false);
                }}
              >
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.addToWorkoutFullBtnText}>Add to Current Workout</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
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
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fullScreenModalContent: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  cancelBtn: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accentColors.primary,
  },
  programScrollView: {
    flex: 1,
  },
  programScrollContent: {
    padding: 16,
  },
  workoutScrollView: {
    flex: 1,
  },
  workoutScrollContent: {
    padding: 16,
  },
  programDetailDesc: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 16,
  },
  programDetailMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  programDetailFreq: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  programDetailLevel: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  instructionText: {
    fontSize: 13,
    color: theme.colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  dayFocus: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  startAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  startAllBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  dayExerciseEditable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
  },
  exerciseReorderBtns: {
    marginRight: 8,
  },
  reorderBtn: {
    padding: 4,
  },
  smallReorderBtn: {
    padding: 2,
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  dayExInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  dayExDetails: {
    flex: 1,
  },
  dayExName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  dayExMeta: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  deleteExBtn: {
    padding: 8,
    marginLeft: 8,
  },
  editModalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editExerciseModal: {
    backgroundColor: theme.colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  editForm: {
    padding: 20,
  },
  editFormRow: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  editFormGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  editFormGridItem: {
    flex: 1,
  },
  editInputSmall: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    textAlign: 'center',
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
  prefilledSection: {
    marginTop: 24,
  },
  prefilledTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  prefilledHint: {
    fontSize: 13,
    color: theme.colors.text.muted,
    marginBottom: 16,
  },
  prefilledExercise: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  prefilledExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  prefilledExName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  prefilledSet: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  prefilledSetNum: {
    width: 50,
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  prefilledInput: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    textAlign: 'center',
  },
  prefilledX: {
    fontSize: 14,
    color: theme.colors.text.muted,
  },
  addExerciseSection: {
    marginTop: 24,
    backgroundColor: '#7C3AED10',
    borderRadius: 16,
    padding: 16,
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
  // Past Workout Modal Styles
  pastWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  closeButtonContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pastWorkoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  pastWorkoutContent: {
    flex: 1,
    padding: 16,
  },
  pastWorkoutInfo: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  pastWorkoutName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  pastWorkoutDate: {
    fontSize: 14,
    marginBottom: 16,
  },
  pastWorkoutStats: {
    flexDirection: 'row',
    gap: 12,
  },
  pastWorkoutStat: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  pastWorkoutStatValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  pastWorkoutStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  pastWorkoutSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  pastExerciseCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pastExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pastExerciseSets: {
    gap: 8,
  },
  pastSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 12,
  },
  pastSetNumber: {
    fontSize: 13,
    fontWeight: '500',
    width: 50,
  },
  pastSetWeight: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  pastSetReps: {
    fontSize: 14,
    fontWeight: '600',
  },
  pastWorkoutNotes: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  pastWorkoutNotesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  pastWorkoutNotesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Exercise Detail Modal Styles
  exerciseDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  exerciseDetailTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addToWorkoutBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addToWorkoutBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseDetailContent: {
    flex: 1,
    padding: 16,
  },
  exerciseDetailTop: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseDetailIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7C3AED20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseDetailName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  exerciseDetailSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  exerciseDetailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  muscleGroupList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleGroupChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  muscleGroupChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  equipmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  equipmentChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  addToWorkoutFullBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  addToWorkoutFullBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Inline Edit Styles
  inlineEditForm: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.accentColors.primary + '40',
  },
  inlineEditRow: {
    marginBottom: 12,
  },
  inlineEditLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 6,
  },
  inlineEditInput: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  inlineEditGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  inlineEditGridItem: {
    flex: 1,
  },
  inlineEditInputSmall: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    textAlign: 'center',
  },
  inlineEditActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineEditCancel: {
    flex: 1,
    backgroundColor: theme.colors.background.card,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  inlineEditCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  inlineEditSave: {
    flex: 1,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inlineEditSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

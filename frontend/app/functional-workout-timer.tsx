import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Vibration,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '../stores/themeStore';
import { useUserStore } from '../stores/userStore';
import { Audio } from 'expo-av';
import axios from 'axios';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface Station {
  name: string;
  duration: string;
  rest: string;
  description: string;
  image: string;
}

export default function FunctionalWorkoutTimerScreen() {
  const { theme } = useThemeStore();
  const { userId } = useUserStore();
  const params = useLocalSearchParams();
  const colors = theme.colors;
  
  // Parse workout data from params
  const workout = params.workout ? JSON.parse(params.workout as string) : null;
  const stations: Station[] = workout?.stations || [];
  const totalRounds = workout?.rounds || 3;
  
  // Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [workoutComplete, setWorkoutComplete] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Parse duration string like "40s" to seconds
  const parseDuration = (duration: string): number => {
    const match = duration.match(/(\d+)/);
    return match ? parseInt(match[1]) : 30;
  };

  // Get current station
  const currentStation = stations[currentStationIndex];
  const stationDuration = currentStation ? parseDuration(currentStation.duration) : 30;
  const restDuration = currentStation ? parseDuration(currentStation.rest) : 15;

  // Play beep sound
  const playBeep = async (type: 'start' | 'rest' | 'end') => {
    try {
      Vibration.vibrate(type === 'end' ? [0, 500, 200, 500] : 200);
    } catch (error) {
      console.log('Vibration not available');
    }
  };

  // Start workout
  const startWorkout = () => {
    setIsRunning(true);
    setIsPaused(false);
    setCurrentStationIndex(0);
    setCurrentRound(1);
    setIsResting(false);
    setTimeRemaining(parseDuration(stations[0]?.duration || '30s'));
    setTotalElapsed(0);
    setWorkoutComplete(false);
    playBeep('start');
  };

  // Pause/Resume
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Stop workout
  const stopWorkout = () => {
    Alert.alert(
      'End Workout',
      'Are you sure you want to end this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            setIsRunning(false);
            setIsPaused(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
          },
        },
      ]
    );
  };

  // Timer logic
  useEffect(() => {
    if (isRunning && !isPaused && !workoutComplete) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up for current phase
            if (isResting) {
              // Rest is over, move to next station or round
              const nextStationIndex = currentStationIndex + 1;
              
              if (nextStationIndex >= stations.length) {
                // Round complete
                if (currentRound >= totalRounds) {
                  // Workout complete!
                  playBeep('end');
                  setWorkoutComplete(true);
                  setIsRunning(false);
                  return 0;
                } else {
                  // Next round
                  setCurrentRound((r) => r + 1);
                  setCurrentStationIndex(0);
                  setIsResting(false);
                  playBeep('start');
                  return parseDuration(stations[0].duration);
                }
              } else {
                // Next station
                setCurrentStationIndex(nextStationIndex);
                setIsResting(false);
                playBeep('start');
                return parseDuration(stations[nextStationIndex].duration);
              }
            } else {
              // Work phase is over, start rest
              setIsResting(true);
              playBeep('rest');
              return parseDuration(currentStation?.rest || '15s');
            }
          }
          return prev - 1;
        });
        
        setTotalElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, isPaused, isResting, currentStationIndex, currentRound, workoutComplete]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress
  const totalStations = stations.length * totalRounds;
  const completedStations = (currentRound - 1) * stations.length + currentStationIndex + (isResting ? 0.5 : 0);
  const progress = (completedStations / totalStations) * 100;

  // Get color based on state
  const getStateColor = () => {
    if (workoutComplete) return '#10B981';
    if (isResting) return '#F59E0B';
    return '#EF4444';
  };

  if (!workout) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <Text style={[styles.errorText, { color: colors.text.primary }]}>Workout data not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.accentColors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.workoutName, { color: colors.text.primary }]}>{workout.name}</Text>
          <Text style={[styles.roundText, { color: colors.text.secondary }]}>
            Round {currentRound} of {totalRounds}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {workoutComplete ? (
        // Workout Complete Screen
        <View style={styles.completeContainer}>
          <View style={[styles.completeCircle, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="checkmark-circle" size={100} color="#10B981" />
          </View>
          <Text style={[styles.completeTitle, { color: colors.text.primary }]}>Workout Complete!</Text>
          <Text style={[styles.completeSubtitle, { color: colors.text.secondary }]}>
            Great job! You crushed {workout.name}
          </Text>
          
          <View style={[styles.statsCard, { backgroundColor: colors.background.card }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{formatTime(totalElapsed)}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Total Time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{totalRounds}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Rounds</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{stations.length * totalRounds}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Exercises</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: '#10B981' }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : !isRunning ? (
        // Pre-workout Screen
        <ScrollView contentContainerStyle={styles.preWorkoutContainer}>
          <Image source={{ uri: workout.image }} style={styles.workoutImage} resizeMode="cover" />
          
          <View style={[styles.infoCard, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.infoTitle, { color: colors.text.primary }]}>{workout.description}</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={24} color={getStateColor()} />
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Duration</Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>{workout.duration}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="repeat" size={24} color={getStateColor()} />
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Rounds</Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>{totalRounds}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="fitness" size={24} color={getStateColor()} />
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Stations</Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>{stations.length}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Stations Preview</Text>
          {stations.map((station, index) => (
            <View key={index} style={[styles.stationPreview, { backgroundColor: colors.background.card }]}>
              <View style={[styles.stationNumber, { backgroundColor: getStateColor() }]}>
                <Text style={styles.stationNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stationInfo}>
                <Text style={[styles.stationName, { color: colors.text.primary }]}>{station.name}</Text>
                <Text style={[styles.stationTiming, { color: colors.text.secondary }]}>
                  {station.duration} work • {station.rest} rest
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: getStateColor() }]}
            onPress={startWorkout}
          >
            <Ionicons name="play" size={28} color="#fff" />
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        // Active Workout Screen
        <View style={styles.activeContainer}>
          {/* Progress Bar */}
          <View style={[styles.progressContainer, { backgroundColor: colors.background.elevated }]}>
            <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: getStateColor() }]} />
          </View>

          {/* Current Station */}
          <View style={styles.currentStationContainer}>
            <Image source={{ uri: currentStation?.image }} style={styles.currentStationImage} resizeMode="cover" />
            <View style={[styles.stationOverlay, { backgroundColor: isResting ? 'rgba(245, 158, 11, 0.9)' : 'rgba(239, 68, 68, 0.9)' }]}>
              <Text style={styles.phaseText}>{isResting ? 'REST' : 'WORK'}</Text>
              <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              <Text style={styles.currentStationName}>{currentStation?.name}</Text>
              <Text style={styles.currentStationDesc}>{currentStation?.description}</Text>
            </View>
          </View>

          {/* Station Progress */}
          <View style={[styles.stationProgressCard, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.stationProgressTitle, { color: colors.text.secondary }]}>
              Station {currentStationIndex + 1} of {stations.length}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stationDots}>
              {stations.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.stationDot,
                    {
                      backgroundColor:
                        index < currentStationIndex
                          ? '#10B981'
                          : index === currentStationIndex
                          ? getStateColor()
                          : colors.background.elevated,
                    },
                  ]}
                />
              ))}
            </ScrollView>
          </View>

          {/* Next Up */}
          {currentStationIndex < stations.length - 1 && (
            <View style={[styles.nextUpCard, { backgroundColor: colors.background.card }]}>
              <Text style={[styles.nextUpLabel, { color: colors.text.secondary }]}>Next Up:</Text>
              <Text style={[styles.nextUpName, { color: colors.text.primary }]}>
                {stations[currentStationIndex + 1]?.name}
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity style={[styles.controlButton, { backgroundColor: '#EF444420' }]} onPress={stopWorkout}>
              <Ionicons name="stop" size={32} color="#EF4444" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.pauseButton, { backgroundColor: isPaused ? '#10B981' : '#F59E0B' }]}
              onPress={togglePause}
            >
              <Ionicons name={isPaused ? 'play' : 'pause'} size={40} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.background.card }]}
              onPress={() => {
                if (currentStationIndex < stations.length - 1) {
                  setCurrentStationIndex((prev) => prev + 1);
                  setIsResting(false);
                  setTimeRemaining(parseDuration(stations[currentStationIndex + 1].duration));
                }
              }}
            >
              <Ionicons name="play-skip-forward" size={32} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Total Time */}
          <Text style={[styles.totalTimeText, { color: colors.text.secondary }]}>
            Total Time: {formatTime(totalElapsed)}
          </Text>
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '700',
  },
  roundText: {
    fontSize: 14,
    marginTop: 2,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  // Pre-workout styles
  preWorkoutContainer: {
    padding: 16,
  },
  workoutImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  stationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  stationNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stationNumberText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '600',
  },
  stationTiming: {
    fontSize: 13,
    marginTop: 2,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    marginTop: 24,
    gap: 10,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  // Active workout styles
  activeContainer: {
    flex: 1,
    padding: 16,
  },
  progressContainer: {
    height: 8,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  currentStationContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  currentStationImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  stationOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  phaseText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 80,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  currentStationName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  currentStationDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  stationProgressCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  stationProgressTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  stationDots: {
    flexDirection: 'row',
  },
  stationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  nextUpCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextUpLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  nextUpName: {
    fontSize: 16,
    fontWeight: '600',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalTimeText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Complete screen styles
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completeCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

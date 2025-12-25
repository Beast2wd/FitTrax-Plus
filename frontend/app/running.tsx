import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import axios from 'axios';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

// Conditionally import MapView only for native platforms
let MapView: any, Polyline: any, Marker: any;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Polyline = maps.Polyline;
  Marker = maps.Marker;
}

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function RunningScreen() {
  const { userId } = useUserStore();
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [distance, setDistance] = useState(0); // in kilometers
  const [duration, setDuration] = useState(0); // in seconds
  const [currentPace, setCurrentPace] = useState(0); // min/km
  const [calories, setCalories] = useState(0);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [showRunDetail, setShowRunDetail] = useState(false);
  
  const locationSubscription = useRef<any>(null);
  const timerInterval = useRef<any>(null);
  const lastLocation = useRef<any>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (userId) {
      loadRuns();
      loadStats();
      getCurrentLocation();
    }
    requestLocationPermissions();
    
    return () => {
      stopTracking();
    };
  }, [userId]);

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const requestLocationPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Location permission is required to track runs');
    }
  };

  const loadRuns = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/runs/${userId}?days=30`);
      setRuns(response.data.runs || []);
    } catch (error) {
      console.error('Error loading runs:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/runs/stats/${userId}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateCalories = (distanceKm: number, durationSeconds: number) => {
    // Estimate: ~60 calories per km for running
    return distanceKm * 60;
  };

  const startTracking = async () => {
    try {
      setIsTracking(true);
      setIsPaused(false);
      setDistance(0);
      setDuration(0);
      setCalories(0);
      setRouteCoords([]);
      lastLocation.current = null;

      // Start location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 10,
        },
        (location) => {
          if (!isPaused) {
            const { latitude, longitude } = location.coords;
            setRouteCoords((prev) => [...prev, { latitude, longitude }]);

            if (lastLocation.current) {
              const dist = calculateDistance(
                lastLocation.current.latitude,
                lastLocation.current.longitude,
                latitude,
                longitude
              );
              setDistance((prev) => prev + dist);
            }

            lastLocation.current = { latitude, longitude };
          }
        }
      );

      // Start timer
      timerInterval.current = setInterval(() => {
        if (!isPaused) {
          setDuration((prev) => prev + 1);
        }
      }, 1000);
    } catch (error) {
      Alert.alert('Error', 'Failed to start tracking');
      setIsTracking(false);
    }
  };

  const pauseTracking = () => {
    setIsPaused(!isPaused);
  };

  const stopTracking = async () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    if (isTracking && distance > 0) {
      await saveRun();
    }

    setIsTracking(false);
    setIsPaused(false);
  };

  const saveRun = async () => {
    try {
      setLoading(true);
      const avgPace = duration > 0 ? (duration / 60) / distance : 0;
      const caloriesBurned = calculateCalories(distance, duration);

      const runData = {
        run_id: `run_${Date.now()}`,
        user_id: userId!,
        distance: parseFloat(distance.toFixed(2)),
        duration,
        average_pace: parseFloat(avgPace.toFixed(2)),
        calories_burned: parseFloat(caloriesBurned.toFixed(1)),
        route_data: routeCoords,
        notes: '',
        timestamp: new Date().toISOString(),
      };

      await axios.post(`${API_URL}/api/runs`, runData);
      Alert.alert('Success', 'Run saved successfully!');
      
      setDistance(0);
      setDuration(0);
      setCalories(0);
      setRouteCoords([]);
      
      loadRuns();
      loadStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to save run');
    } finally {
      setLoading(false);
    }
  };

  const deleteRun = async (runId: string) => {
    Alert.alert(
      'Delete Run',
      'Are you sure you want to delete this run?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/runs/${runId}`);
              loadRuns();
              loadStats();
              setShowRunDetail(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete run');
            }
          },
        },
      ]
    );
  };

  const viewRunDetail = (run: any) => {
    setSelectedRun(run);
    setShowRunDetail(true);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0
      ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace: number) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate current pace
  useEffect(() => {
    if (duration > 0 && distance > 0) {
      const pace = (duration / 60) / distance;
      setCurrentPace(pace);
      setCalories(calculateCalories(distance, duration));
    }
  }, [duration, distance]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Running Tracker</Text>

        {/* Live Map During Tracking */}
        {isTracking && routeCoords.length > 0 && (
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: routeCoords[0].latitude,
                longitude: routeCoords[0].longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation
              followsUserLocation
            >
              <Polyline
                coordinates={routeCoords}
                strokeColor={Colors.brand.primary}
                strokeWidth={4}
              />
              {routeCoords.length > 0 && (
                <>
                  <Marker coordinate={routeCoords[0]} title="Start" pinColor="green" />
                  <Marker
                    coordinate={routeCoords[routeCoords.length - 1]}
                    title="Current"
                    pinColor="blue"
                  />
                </>
              )}
            </MapView>
          </View>
        )}

        {/* Active Tracking Card */}
        {!isTracking ? (
          <View style={styles.startCard}>
            <Ionicons name="navigate" size={64} color={Colors.brand.primary} />
            <Text style={styles.startTitle}>Start Your Run</Text>
            <Text style={styles.startSubtitle}>
              Track distance, pace, and calories burned with GPS
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={startTracking}>
              <Ionicons name="play" size={24} color="#fff" />
              <Text style={styles.startButtonText}>Start Running</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.trackingCard}
          >
            <View style={styles.trackingHeader}>
              <View style={[styles.statusDot, isPaused && styles.statusDotPaused]} />
              <Text style={styles.trackingStatus}>
                {isPaused ? 'Paused' : 'Tracking...'}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
                <Text style={styles.statLabel}>km</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatTime(duration)}</Text>
                <Text style={styles.statLabel}>time</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {currentPace > 0 ? formatPace(currentPace) : '--:--'}
                </Text>
                <Text style={styles.statLabel}>min/km</Text>
              </View>
            </View>

            <View style={styles.caloriesRow}>
              <Ionicons name="flame" size={20} color="#fff" />
              <Text style={styles.caloriesText}>{Math.round(calories)} calories</Text>
            </View>

            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={[styles.controlButton, styles.pauseButton]}
                onPress={pauseTracking}
              >
                <Ionicons name={isPaused ? 'play' : 'pause'} size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={stopTracking}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="stop" size={28} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        {/* Weekly & Monthly Stats */}
        {stats && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Your Progress</Text>
            
            <View style={styles.statsCards}>
              <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
                <View style={[styles.statIcon, { backgroundColor: '#3B82F6' }]}>
                  <Ionicons name="calendar" size={24} color="#fff" />
                </View>
                <Text style={styles.statCardLabel}>This Week</Text>
                <Text style={[styles.statCardValue, { color: '#3B82F6' }]}>
                  {stats.weekly.total_distance} km
                </Text>
                <Text style={styles.statCardDetail}>
                  {stats.weekly.run_count} runs • {Math.round(stats.weekly.total_calories)} cal
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
                <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}>
                  <MaterialIcons name="date-range" size={24} color="#fff" />
                </View>
                <Text style={styles.statCardLabel}>This Month</Text>
                <Text style={[styles.statCardValue, { color: '#10B981' }]}>
                  {stats.monthly.total_distance} km
                </Text>
                <Text style={styles.statCardDetail}>
                  {stats.monthly.run_count} runs • {Math.round(stats.monthly.total_calories)} cal
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Runs */}
        {runs.length > 0 && (
          <View style={styles.runsSection}>
            <Text style={styles.sectionTitle}>Recent Runs</Text>
            {runs.slice(0, 10).map((run) => (
              <TouchableOpacity 
                key={run.run_id} 
                style={styles.runCard}
                onPress={() => viewRunDetail(run)}
              >
                <View style={styles.runLeft}>
                  <Ionicons name="footsteps" size={32} color={Colors.brand.primary} />
                  <View style={styles.runInfo}>
                    <Text style={styles.runDistance}>{run.distance} km</Text>
                    <Text style={styles.runDetails}>
                      {formatTime(run.duration)} • {formatPace(run.average_pace)}/km
                    </Text>
                    <Text style={styles.runDate}>
                      {format(new Date(run.timestamp), 'MMM d, yyyy • h:mm a')}
                    </Text>
                  </View>
                </View>
                <View style={styles.runRight}>
                  <Text style={styles.runCalories}>{Math.round(run.calories_burned)} cal</Text>
                  <Ionicons name="chevron-forward" size={20} color={Colors.text.muted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Run Detail Modal */}
      <Modal
        visible={showRunDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRunDetail(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRunDetail(false)}>
              <Ionicons name="close" size={28} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Run Details</Text>
            <TouchableOpacity onPress={() => selectedRun && deleteRun(selectedRun.run_id)}>
              <Ionicons name="trash-outline" size={24} color={Colors.status.error} />
            </TouchableOpacity>
          </View>

          {selectedRun && (
            <ScrollView style={styles.modalContent}>
              {/* Map of the run route */}
              {selectedRun.route_data && selectedRun.route_data.length > 1 && (
                <View style={styles.detailMapContainer}>
                  <MapView
                    style={styles.detailMap}
                    initialRegion={{
                      latitude: selectedRun.route_data[0].latitude,
                      longitude: selectedRun.route_data[0].longitude,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }}
                  >
                    <Polyline
                      coordinates={selectedRun.route_data}
                      strokeColor={Colors.brand.primary}
                      strokeWidth={4}
                    />
                    <Marker
                      coordinate={selectedRun.route_data[0]}
                      title="Start"
                      pinColor="green"
                    />
                    <Marker
                      coordinate={selectedRun.route_data[selectedRun.route_data.length - 1]}
                      title="Finish"
                      pinColor="red"
                    />
                  </MapView>
                </View>
              )}

              {/* Run Statistics */}
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Run Summary</Text>
                <Text style={styles.detailDate}>
                  {format(new Date(selectedRun.timestamp), 'EEEE, MMMM d, yyyy • h:mm a')}
                </Text>

                <View style={styles.detailStatsGrid}>
                  <View style={styles.detailStatItem}>
                    <Ionicons name="navigate" size={32} color={Colors.brand.primary} />
                    <Text style={styles.detailStatValue}>{selectedRun.distance}</Text>
                    <Text style={styles.detailStatLabel}>Kilometers</Text>
                  </View>

                  <View style={styles.detailStatItem}>
                    <Ionicons name="time" size={32} color={Colors.status.success} />
                    <Text style={styles.detailStatValue}>{formatTime(selectedRun.duration)}</Text>
                    <Text style={styles.detailStatLabel}>Duration</Text>
                  </View>

                  <View style={styles.detailStatItem}>
                    <Ionicons name="speedometer" size={32} color={Colors.status.warning} />
                    <Text style={styles.detailStatValue}>
                      {formatPace(selectedRun.average_pace)}
                    </Text>
                    <Text style={styles.detailStatLabel}>Pace (min/km)</Text>
                  </View>

                  <View style={styles.detailStatItem}>
                    <Ionicons name="flame" size={32} color={Colors.status.error} />
                    <Text style={styles.detailStatValue}>
                      {Math.round(selectedRun.calories_burned)}
                    </Text>
                    <Text style={styles.detailStatLabel}>Calories</Text>
                  </View>
                </View>

                {/* Additional Info */}
                <View style={styles.detailInfoCard}>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Average Speed</Text>
                    <Text style={styles.detailInfoValue}>
                      {(selectedRun.distance / (selectedRun.duration / 3600)).toFixed(2)} km/h
                    </Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>GPS Points</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedRun.route_data?.length || 0} points
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
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
  startCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  startTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  startSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  trackingCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  statusDotPaused: {
    backgroundColor: '#FCA5A5',
  },
  trackingStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  caloriesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  statsCards: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCardLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statCardDetail: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  runsSection: {
    marginBottom: 24,
  },
  runCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  runLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  runInfo: {
    marginLeft: 12,
    flex: 1,
  },
  runDistance: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  runDetails: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  runDate: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 4,
  },
  runRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  runCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.primary,
  },
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  map: {
    flex: 1,
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
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalContent: {
    flex: 1,
  },
  detailMapContainer: {
    height: 300,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailMap: {
    flex: 1,
  },
  detailCard: {
    margin: 16,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  detailDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 24,
  },
  detailStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  detailStatItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background.light,
    borderRadius: 12,
  },
  detailStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  detailStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  detailInfoCard: {
    backgroundColor: Colors.background.light,
    borderRadius: 12,
    padding: 16,
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailInfoLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  detailInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
});


import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Health data types
export interface HealthData {
  steps: number;
  distance: number; // in miles
  activeCalories: number;
  totalCalories: number;
  heartRate: {
    current: number;
    min: number;
    max: number;
    avg: number;
  } | null;
  sleep: {
    totalMinutes: number;
    deepMinutes: number;
    lightMinutes: number;
    remMinutes: number;
    awakeMinutes: number;
  } | null;
  workouts: Array<{
    type: string;
    duration: number;
    calories: number;
    distance?: number;
    startTime: string;
    endTime: string;
  }>;
  lastSyncTime: string | null;
}

export interface ConnectionStatus {
  appleHealth: {
    available: boolean;
    connected: boolean;
    lastSync: string | null;
  };
  googleFit: {
    available: boolean;
    connected: boolean;
    lastSync: string | null;
  };
}

const STORAGE_KEYS = {
  APPLE_HEALTH_CONNECTED: 'apple_health_connected',
  GOOGLE_FIT_CONNECTED: 'google_fit_connected',
  LAST_SYNC_TIME: 'health_last_sync_time',
  CACHED_HEALTH_DATA: 'cached_health_data',
};

// Check if we're running on native (not web)
export const isNativePlatform = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

// Check platform availability
export const getConnectionStatus = async (): Promise<ConnectionStatus> => {
  const appleHealthConnected = await AsyncStorage.getItem(STORAGE_KEYS.APPLE_HEALTH_CONNECTED);
  const googleFitConnected = await AsyncStorage.getItem(STORAGE_KEYS.GOOGLE_FIT_CONNECTED);
  const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);

  return {
    appleHealth: {
      available: Platform.OS === 'ios',
      connected: appleHealthConnected === 'true',
      lastSync: Platform.OS === 'ios' ? lastSync : null,
    },
    googleFit: {
      available: Platform.OS === 'android',
      connected: googleFitConnected === 'true',
      lastSync: Platform.OS === 'android' ? lastSync : null,
    },
  };
};

// Initialize Apple HealthKit (iOS only)
export const initializeAppleHealth = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    console.log('Apple Health is only available on iOS');
    return false;
  }

  try {
    // Dynamic import to avoid bundling issues on non-iOS platforms
    const AppleHealthKit = require('react-native-health').default;
    
    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.Workout,
          AppleHealthKit.Constants.Permissions.Weight,
          AppleHealthKit.Constants.Permissions.Height,
        ],
        write: [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          AppleHealthKit.Constants.Permissions.Workout,
        ],
      },
    };

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, async (error: string) => {
        if (error) {
          console.log('Error initializing Apple HealthKit:', error);
          resolve(false);
        } else {
          await AsyncStorage.setItem(STORAGE_KEYS.APPLE_HEALTH_CONNECTED, 'true');
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.log('Apple HealthKit not available:', error);
    return false;
  }
};

// Initialize Google Health Connect (Android only)
export const initializeGoogleHealthConnect = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    console.log('Google Health Connect is only available on Android');
    return false;
  }

  try {
    const { initialize, requestPermission, Permission } = require('react-native-health-connect');
    
    const isInitialized = await initialize();
    if (!isInitialized) {
      console.log('Health Connect not available on this device');
      return false;
    }

    // Request permissions
    const grantedPermissions = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'TotalCaloriesBurned' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'Steps' },
      { accessType: 'write', recordType: 'Distance' },
      { accessType: 'write', recordType: 'ExerciseSession' },
    ]);

    if (grantedPermissions.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEYS.GOOGLE_FIT_CONNECTED, 'true');
      return true;
    }
    return false;
  } catch (error) {
    console.log('Google Health Connect error:', error);
    return false;
  }
};

// Disconnect from health services
export const disconnectAppleHealth = async (): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.APPLE_HEALTH_CONNECTED, 'false');
};

export const disconnectGoogleHealthConnect = async (): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.GOOGLE_FIT_CONNECTED, 'false');
};

// Read health data from Apple HealthKit
const readAppleHealthData = async (): Promise<HealthData> => {
  const AppleHealthKit = require('react-native-health').default;
  
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const options = {
    startDate: startOfDay.toISOString(),
    endDate: today.toISOString(),
  };

  return new Promise((resolve) => {
    const healthData: HealthData = {
      steps: 0,
      distance: 0,
      activeCalories: 0,
      totalCalories: 0,
      heartRate: null,
      sleep: null,
      workouts: [],
      lastSyncTime: new Date().toISOString(),
    };

    // Get steps
    AppleHealthKit.getStepCount(options, (err: any, results: any) => {
      if (!err && results) {
        healthData.steps = Math.round(results.value || 0);
      }
    });

    // Get distance (convert from meters to miles)
    AppleHealthKit.getDistanceWalkingRunning(options, (err: any, results: any) => {
      if (!err && results) {
        healthData.distance = (results.value || 0) / 1609.34; // meters to miles
      }
    });

    // Get active calories
    AppleHealthKit.getActiveEnergyBurned(options, (err: any, results: any) => {
      if (!err && results) {
        const total = results.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
        healthData.activeCalories = Math.round(total);
      }
    });

    // Get heart rate
    AppleHealthKit.getHeartRateSamples(options, (err: any, results: any) => {
      if (!err && results && results.length > 0) {
        const values = results.map((r: any) => r.value);
        healthData.heartRate = {
          current: values[values.length - 1],
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length),
        };
      }
    });

    // Get sleep data (last night)
    const sleepOptions = {
      startDate: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      endDate: today.toISOString(),
    };
    
    AppleHealthKit.getSleepSamples(sleepOptions, (err: any, results: any) => {
      if (!err && results && results.length > 0) {
        let totalMinutes = 0;
        let deepMinutes = 0;
        let lightMinutes = 0;
        let remMinutes = 0;
        let awakeMinutes = 0;

        results.forEach((sample: any) => {
          const duration = (new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime()) / 60000;
          totalMinutes += duration;
          
          switch (sample.value) {
            case 'ASLEEP':
            case 'INBED':
              lightMinutes += duration;
              break;
            case 'DEEP':
              deepMinutes += duration;
              break;
            case 'REM':
              remMinutes += duration;
              break;
            case 'AWAKE':
              awakeMinutes += duration;
              break;
          }
        });

        healthData.sleep = {
          totalMinutes: Math.round(totalMinutes),
          deepMinutes: Math.round(deepMinutes),
          lightMinutes: Math.round(lightMinutes),
          remMinutes: Math.round(remMinutes),
          awakeMinutes: Math.round(awakeMinutes),
        };
      }
    });

    // Get workouts
    AppleHealthKit.getSamples({
      ...options,
      type: 'Workout',
    }, (err: any, results: any) => {
      if (!err && results) {
        healthData.workouts = results.map((workout: any) => ({
          type: workout.activityName || 'Unknown',
          duration: workout.duration || 0,
          calories: workout.calories || 0,
          distance: workout.distance ? workout.distance / 1609.34 : undefined, // meters to miles
          startTime: workout.start,
          endTime: workout.end,
        }));
      }
    });

    // Wait a bit for all async calls to complete
    setTimeout(() => {
      resolve(healthData);
    }, 2000);
  });
};

// Read health data from Google Health Connect
const readGoogleHealthConnectData = async (): Promise<HealthData> => {
  const { readRecords } = require('react-native-health-connect');
  
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const healthData: HealthData = {
    steps: 0,
    distance: 0,
    activeCalories: 0,
    totalCalories: 0,
    heartRate: null,
    sleep: null,
    workouts: [],
    lastSyncTime: new Date().toISOString(),
  };

  try {
    // Get steps
    const stepsRecords = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: today.toISOString(),
      },
    });
    healthData.steps = stepsRecords.reduce((sum: number, r: any) => sum + (r.count || 0), 0);

    // Get distance (convert from meters to miles)
    const distanceRecords = await readRecords('Distance', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: today.toISOString(),
      },
    });
    healthData.distance = distanceRecords.reduce((sum: number, r: any) => 
      sum + ((r.distance?.inMeters || 0) / 1609.34), 0);

    // Get active calories
    const activeCaloriesRecords = await readRecords('ActiveCaloriesBurned', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: today.toISOString(),
      },
    });
    healthData.activeCalories = Math.round(
      activeCaloriesRecords.reduce((sum: number, r: any) => sum + (r.energy?.inKilocalories || 0), 0)
    );

    // Get total calories
    const totalCaloriesRecords = await readRecords('TotalCaloriesBurned', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: today.toISOString(),
      },
    });
    healthData.totalCalories = Math.round(
      totalCaloriesRecords.reduce((sum: number, r: any) => sum + (r.energy?.inKilocalories || 0), 0)
    );

    // Get heart rate
    const heartRateRecords = await readRecords('HeartRate', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: today.toISOString(),
      },
    });
    if (heartRateRecords.length > 0) {
      const values = heartRateRecords.flatMap((r: any) => 
        r.samples?.map((s: any) => s.beatsPerMinute) || []
      );
      if (values.length > 0) {
        healthData.heartRate = {
          current: values[values.length - 1],
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length),
        };
      }
    }

    // Get sleep data
    const sleepRecords = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        endTime: today.toISOString(),
      },
    });
    if (sleepRecords.length > 0) {
      let totalMinutes = 0;
      let deepMinutes = 0;
      let lightMinutes = 0;
      let remMinutes = 0;
      let awakeMinutes = 0;

      sleepRecords.forEach((session: any) => {
        session.stages?.forEach((stage: any) => {
          const duration = (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / 60000;
          totalMinutes += duration;
          
          switch (stage.stage) {
            case 'deep':
              deepMinutes += duration;
              break;
            case 'light':
              lightMinutes += duration;
              break;
            case 'rem':
              remMinutes += duration;
              break;
            case 'awake':
              awakeMinutes += duration;
              break;
          }
        });
      });

      healthData.sleep = {
        totalMinutes: Math.round(totalMinutes),
        deepMinutes: Math.round(deepMinutes),
        lightMinutes: Math.round(lightMinutes),
        remMinutes: Math.round(remMinutes),
        awakeMinutes: Math.round(awakeMinutes),
      };
    }

    // Get exercise sessions
    const exerciseRecords = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: today.toISOString(),
      },
    });
    healthData.workouts = exerciseRecords.map((exercise: any) => ({
      type: exercise.exerciseType || 'Unknown',
      duration: (new Date(exercise.endTime).getTime() - new Date(exercise.startTime).getTime()) / 60000,
      calories: 0, // Would need to be calculated separately
      startTime: exercise.startTime,
      endTime: exercise.endTime,
    }));

  } catch (error) {
    console.log('Error reading Health Connect data:', error);
  }

  return healthData;
};

// Main function to sync health data
export const syncHealthData = async (): Promise<HealthData | null> => {
  if (!isNativePlatform()) {
    console.log('Health sync is only available on native platforms');
    return null;
  }

  try {
    let healthData: HealthData;

    if (Platform.OS === 'ios') {
      const isConnected = await AsyncStorage.getItem(STORAGE_KEYS.APPLE_HEALTH_CONNECTED);
      if (isConnected !== 'true') {
        console.log('Apple Health not connected');
        return null;
      }
      healthData = await readAppleHealthData();
    } else if (Platform.OS === 'android') {
      const isConnected = await AsyncStorage.getItem(STORAGE_KEYS.GOOGLE_FIT_CONNECTED);
      if (isConnected !== 'true') {
        console.log('Google Health Connect not connected');
        return null;
      }
      healthData = await readGoogleHealthConnectData();
    } else {
      return null;
    }

    // Cache the health data
    await AsyncStorage.setItem(STORAGE_KEYS.CACHED_HEALTH_DATA, JSON.stringify(healthData));
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, healthData.lastSyncTime || new Date().toISOString());

    return healthData;
  } catch (error) {
    console.log('Error syncing health data:', error);
    return null;
  }
};

// Get cached health data
export const getCachedHealthData = async (): Promise<HealthData | null> => {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_HEALTH_DATA);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.log('Error getting cached health data:', error);
    return null;
  }
};

// Format duration in minutes to human readable
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

// Format sleep time
export const formatSleepTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

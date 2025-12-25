import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { heartRateAPI } from '../services/api';
import { format } from 'date-fns';

export default function HeartRateScreen() {
  const { userId, profile } = useUserStore();
  const [bpm, setBpm] = useState('');
  const [activityType, setActivityType] = useState('resting');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [heartRates, setHeartRates] = useState<any[]>([]);
  const [zones, setZones] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    try {
      const [hrData, zonesData] = await Promise.all([
        heartRateAPI.getHeartRate(userId!, 7),
        heartRateAPI.getHeartRateZones(userId!),
      ]);
      setHeartRates(hrData.heart_rates || []);
      setZones(zonesData);
    } catch (error) {
      console.error('Error loading heart rate data:', error);
    }
  };

  const handleAddHeartRate = async () => {
    if (!bpm || parseInt(bpm) < 30 || parseInt(bpm) > 250) {
      Alert.alert('Error', 'Please enter a valid BPM between 30 and 250');
      return;
    }

    try {
      setLoading(true);
      await heartRateAPI.addHeartRate({
        heart_rate_id: `hr_${Date.now()}`,
        user_id: userId!,
        bpm: parseInt(bpm),
        activity_type: activityType,
        notes,
        timestamp: new Date().toISOString(),
      });

      Alert.alert('Success', 'Heart rate logged!');
      setBpm('');
      setNotes('');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to log heart rate');
    } finally {
      setLoading(false);
    }
  };

  const getZoneForBPM = (bpm: number) => {
    if (!zones) return null;
    if (bpm >= zones.peak.min) return { name: 'Peak', color: Colors.heartRate.peak };
    if (bpm >= zones.cardio.min) return { name: 'Cardio', color: Colors.heartRate.cardio };
    if (bpm >= zones.fat_burn.min) return { name: 'Fat Burn', color: Colors.heartRate.fatBurn };
    return { name: 'Resting', color: Colors.heartRate.resting };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Heart Rate Tracking</Text>

        {/* Add Heart Rate Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Log Heart Rate</Text>

          <Text style={styles.label}>BPM (30-250)</Text>
          <TextInput
            style={styles.input}
            value={bpm}
            onChangeText={setBpm}
            placeholder="Enter heart rate"
            keyboardType="numeric"
            placeholderTextColor={Colors.text.muted}
          />

          <Text style={styles.label}>Activity Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={activityType}
              onValueChange={(value) => setActivityType(value)}
              style={styles.picker}
            >
              <Picker.Item label="Resting" value="resting" />
              <Picker.Item label="Workout" value="workout" />
              <Picker.Item label="General" value="general" />
            </Picker>
          </View>

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes"
            multiline
            numberOfLines={3}
            placeholderTextColor={Colors.text.muted}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAddHeartRate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log Heart Rate</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Heart Rate Zones */}
        {zones && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Heart Rate Zones</Text>
            <Text style={styles.subtitle}>Max HR: {zones.max_heart_rate} BPM</Text>

            <View style={styles.zonesContainer}>
              <View style={[styles.zoneCard, { backgroundColor: Colors.heartRate.resting + '20' }]}>
                <View style={[styles.zoneIndicator, { backgroundColor: Colors.heartRate.resting }]} />
                <Text style={styles.zoneName}>Resting</Text>
                <Text style={styles.zoneRange}>{zones.resting.min}-{zones.resting.max} BPM</Text>
              </View>

              <View style={[styles.zoneCard, { backgroundColor: Colors.heartRate.fatBurn + '20' }]}>
                <View style={[styles.zoneIndicator, { backgroundColor: Colors.heartRate.fatBurn }]} />
                <Text style={styles.zoneName}>Fat Burn</Text>
                <Text style={styles.zoneRange}>{zones.fat_burn.min}-{zones.fat_burn.max} BPM</Text>
              </View>

              <View style={[styles.zoneCard, { backgroundColor: Colors.heartRate.cardio + '20' }]}>
                <View style={[styles.zoneIndicator, { backgroundColor: Colors.heartRate.cardio }]} />
                <Text style={styles.zoneName}>Cardio</Text>
                <Text style={styles.zoneRange}>{zones.cardio.min}-{zones.cardio.max} BPM</Text>
              </View>

              <View style={[styles.zoneCard, { backgroundColor: Colors.heartRate.peak + '20' }]}>
                <View style={[styles.zoneIndicator, { backgroundColor: Colors.heartRate.peak }]} />
                <Text style={styles.zoneName}>Peak</Text>
                <Text style={styles.zoneRange}>{zones.peak.min}-{zones.max_heart_rate} BPM</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Heart Rates */}
        {heartRates.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Measurements</Text>
            {heartRates.slice(0, 10).map((hr) => {
              const zone = getZoneForBPM(hr.bpm);
              return (
                <View key={hr.heart_rate_id} style={styles.hrItem}>
                  <View style={styles.hrLeft}>
                    <MaterialIcons name="favorite" size={24} color={zone?.color || Colors.text.secondary} />
                    <View style={styles.hrInfo}>
                      <Text style={styles.hrBpm}>{hr.bpm} BPM</Text>
                      <Text style={styles.hrActivity}>{hr.activity_type}</Text>
                    </View>
                  </View>
                  <View style={styles.hrRight}>
                    {zone && (
                      <View style={[styles.zoneBadge, { backgroundColor: zone.color + '20' }]}>
                        <Text style={[styles.zoneText, { color: zone.color }]}>{zone.name}</Text>
                      </View>
                    )}
                    <Text style={styles.hrTime}>
                      {format(new Date(hr.timestamp), 'MMM d, h:mm a')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    padding: 20,
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
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.background.light,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: Colors.background.light,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  button: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
  zonesContainer: {
    gap: 12,
  },
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  zoneIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  zoneName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  zoneRange: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  hrItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  hrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hrInfo: {
    marginLeft: 12,
  },
  hrBpm: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  hrActivity: {
    fontSize: 14,
    color: Colors.text.secondary,
    textTransform: 'capitalize',
  },
  hrRight: {
    alignItems: 'flex-end',
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hrTime: {
    fontSize: 12,
    color: Colors.text.muted,
  },
});
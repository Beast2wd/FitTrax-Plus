import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../stores/userStore';
import { userAPI } from '../../services/api';
import { storage } from '../../services/storage';

export default function ProfileScreen() {
  const { userId, profile, setUserId, setProfile } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(!profile);

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    age: profile?.age?.toString() || '',
    gender: profile?.gender || 'male',
    height_feet: profile?.height_feet?.toString() || '',
    height_inches: profile?.height_inches?.toString() || '',
    weight: profile?.weight?.toString() || '',
    goal_weight: profile?.goal_weight?.toString() || '',
    activity_level: profile?.activity_level || 'moderate',
  });

  useEffect(() => {
    if (!userId) {
      // Generate a new user ID
      const newUserId = `user_${Date.now()}`;
      setUserId(newUserId);
      storage.saveUserId(newUserId);
    }
  }, [userId]);

  const handleSave = async () => {
    // Validation
    if (!formData.name || !formData.age || !formData.height_feet || 
        !formData.height_inches || !formData.weight || !formData.goal_weight) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const profileData = {
        user_id: userId!,
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        height_feet: parseInt(formData.height_feet),
        height_inches: parseInt(formData.height_inches),
        weight: parseFloat(formData.weight),
        goal_weight: parseFloat(formData.goal_weight),
        activity_level: formData.activity_level,
      };

      const result = await userAPI.createOrUpdateProfile(profileData);
      setProfile(result.profile);
      await storage.saveUserProfile(result.profile);
      await storage.setOnboardingComplete();
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile saved successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  if (!isEditing && profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>Your Profile</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{profile.name}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Age:</Text>
              <Text style={styles.value}>{profile.age} years</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Gender:</Text>
              <Text style={styles.value}>{profile.gender}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Height:</Text>
              <Text style={styles.value}>{profile.height_feet}' {profile.height_inches}"</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Weight:</Text>
              <Text style={styles.value}>{profile.weight} lbs</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Goal Weight:</Text>
              <Text style={styles.value}>{profile.goal_weight} lbs</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Activity Level:</Text>
              <Text style={styles.value}>{profile.activity_level.replace('_', ' ')}</Text>
            </View>
            
            <View style={styles.goalCard}>
              <Text style={styles.goalLabel}>Daily Calorie Goal</Text>
              <Text style={styles.goalValue}>{profile.daily_calorie_goal} cal</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>
              {profile ? 'Edit Profile' : 'Complete Your Profile'}
            </Text>
            <Text style={styles.subtitle}>
              Help us personalize your fitness journey
            </Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="Enter your name"
              placeholderTextColor={Colors.text.muted}
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={formData.age}
              onChangeText={(value) => updateField('age', value)}
              placeholder="Enter your age"
              keyboardType="numeric"
              placeholderTextColor={Colors.text.muted}
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.gender}
                onValueChange={(value) => updateField('gender', value)}
                style={styles.picker}
              >
                <Picker.Item label="Male" value="male" />
                <Picker.Item label="Female" value="female" />
              </Picker>
            </View>

            <Text style={styles.label}>Height</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={formData.height_feet}
                onChangeText={(value) => updateField('height_feet', value)}
                placeholder="Feet"
                keyboardType="numeric"
                placeholderTextColor={Colors.text.muted}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={formData.height_inches}
                onChangeText={(value) => updateField('height_inches', value)}
                placeholder="Inches"
                keyboardType="numeric"
                placeholderTextColor={Colors.text.muted}
              />
            </View>

            <Text style={styles.label}>Current Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={formData.weight}
              onChangeText={(value) => updateField('weight', value)}
              placeholder="Enter weight"
              keyboardType="numeric"
              placeholderTextColor={Colors.text.muted}
            />

            <Text style={styles.label}>Goal Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={formData.goal_weight}
              onChangeText={(value) => updateField('goal_weight', value)}
              placeholder="Enter goal weight"
              keyboardType="numeric"
              placeholderTextColor={Colors.text.muted}
            />

            <Text style={styles.label}>Activity Level</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.activity_level}
                onValueChange={(value) => updateField('activity_level', value)}
                style={styles.picker}
              >
                <Picker.Item label="Sedentary" value="sedentary" />
                <Picker.Item label="Light" value="light" />
                <Picker.Item label="Moderate" value="moderate" />
                <Picker.Item label="Active" value="active" />
                <Picker.Item label="Very Active" value="very_active" />
              </Picker>
            </View>

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Profile</Text>
              )}
            </TouchableOpacity>

            {profile && (
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 12,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  button: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: Colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  value: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  goalCard: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  goalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  goalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text.white,
  },
});

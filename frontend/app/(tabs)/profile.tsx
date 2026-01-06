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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../stores/userStore';
import { userAPI } from '../../services/api';
import { storage } from '../../services/storage';

// Generate arrays for picker options
const AGE_OPTIONS = Array.from({ length: 83 }, (_, i) => i + 18); // 18-100
const HEIGHT_FEET_OPTIONS = Array.from({ length: 5 }, (_, i) => i + 4); // 4-8 feet
const HEIGHT_INCHES_OPTIONS = Array.from({ length: 12 }, (_, i) => i); // 0-11 inches
const WEIGHT_OPTIONS = Array.from({ length: 351 }, (_, i) => i + 80); // 80-430 lbs

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

const ACTIVITY_OPTIONS = [
  { label: 'Sedentary (little or no exercise)', value: 'sedentary' },
  { label: 'Light (exercise 1-3 days/week)', value: 'light' },
  { label: 'Moderate (exercise 3-5 days/week)', value: 'moderate' },
  { label: 'Active (exercise 6-7 days/week)', value: 'active' },
  { label: 'Very Active (intense daily exercise)', value: 'very_active' },
];

// Custom Picker Modal Component
interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string | number) => void;
  title: string;
  options: { label: string; value: string | number }[];
  selectedValue: string | number;
}

const PickerModal: React.FC<PickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  title,
  options,
  selectedValue,
}) => {
  const [tempValue, setTempValue] = useState(selectedValue);

  useEffect(() => {
    if (visible) {
      setTempValue(selectedValue);
    }
  }, [visible, selectedValue]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modalStyles.title}>{title}</Text>
            <TouchableOpacity onPress={() => {
              onSelect(tempValue);
              onClose();
            }}>
              <Text style={modalStyles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <Picker
            selectedValue={tempValue}
            onValueChange={(value) => setTempValue(value)}
            style={modalStyles.picker}
            itemStyle={modalStyles.pickerItem}
          >
            {options.map((option) => (
              <Picker.Item
                key={option.value.toString()}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </View>
      </View>
    </Modal>
  );
};

// Selector Button Component
interface SelectorButtonProps {
  label: string;
  value: string;
  onPress: () => void;
  placeholder?: string;
}

const SelectorButton: React.FC<SelectorButtonProps> = ({
  label,
  value,
  onPress,
  placeholder = 'Select',
}) => (
  <TouchableOpacity style={styles.selectorButton} onPress={onPress}>
    <Text style={value ? styles.selectorValue : styles.selectorPlaceholder}>
      {value || placeholder}
    </Text>
    <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { userId, profile, setUserId, setProfile } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(!profile);

  // Modal visibility states
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [heightFeetModalVisible, setHeightFeetModalVisible] = useState(false);
  const [heightInchesModalVisible, setHeightInchesModalVisible] = useState(false);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [goalWeightModalVisible, setGoalWeightModalVisible] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    age: profile?.age || 30,
    gender: profile?.gender || 'male',
    height_feet: profile?.height_feet || 5,
    height_inches: profile?.height_inches || 8,
    weight: profile?.weight || 160,
    goal_weight: profile?.goal_weight || 155,
    activity_level: profile?.activity_level || 'moderate',
  });

  useEffect(() => {
    if (!userId) {
      const newUserId = `user_${Date.now()}`;
      setUserId(newUserId);
      storage.saveUserId(newUserId);
    }
  }, [userId]);

  const handleSave = async () => {
    if (!formData.name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      setLoading(true);
      const profileData = {
        user_id: userId!,
        name: formData.name,
        age: formData.age,
        gender: formData.gender,
        height_feet: formData.height_feet,
        height_inches: formData.height_inches,
        weight: formData.weight,
        goal_weight: formData.goal_weight,
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

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const getGenderLabel = (value: string) => {
    return GENDER_OPTIONS.find(g => g.value === value)?.label || value;
  };

  const getActivityLabel = (value: string) => {
    const option = ACTIVITY_OPTIONS.find(a => a.value === value);
    return option ? option.label.split(' (')[0] : value;
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
              <Text style={styles.value}>{getGenderLabel(profile.gender)}</Text>
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
              <Text style={styles.value}>{getActivityLabel(profile.activity_level)}</Text>
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

            {/* Name - Text Input */}
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="Enter your name"
              placeholderTextColor={Colors.text.muted}
            />

            {/* Age - Picker */}
            <Text style={styles.fieldLabel}>Age</Text>
            <SelectorButton
              label="Age"
              value={`${formData.age} years`}
              onPress={() => setAgeModalVisible(true)}
            />

            {/* Gender - Picker */}
            <Text style={styles.fieldLabel}>Gender</Text>
            <SelectorButton
              label="Gender"
              value={getGenderLabel(formData.gender)}
              onPress={() => setGenderModalVisible(true)}
            />

            {/* Height - Dual Picker */}
            <Text style={styles.fieldLabel}>Height</Text>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <SelectorButton
                  label="Feet"
                  value={`${formData.height_feet} ft`}
                  onPress={() => setHeightFeetModalVisible(true)}
                />
              </View>
              <View style={styles.halfInput}>
                <SelectorButton
                  label="Inches"
                  value={`${formData.height_inches} in`}
                  onPress={() => setHeightInchesModalVisible(true)}
                />
              </View>
            </View>

            {/* Current Weight - Picker */}
            <Text style={styles.fieldLabel}>Current Weight</Text>
            <SelectorButton
              label="Weight"
              value={`${formData.weight} lbs`}
              onPress={() => setWeightModalVisible(true)}
            />

            {/* Goal Weight - Picker */}
            <Text style={styles.fieldLabel}>Goal Weight</Text>
            <SelectorButton
              label="Goal Weight"
              value={`${formData.goal_weight} lbs`}
              onPress={() => setGoalWeightModalVisible(true)}
            />

            {/* Activity Level - Picker */}
            <Text style={styles.fieldLabel}>Activity Level</Text>
            <SelectorButton
              label="Activity Level"
              value={getActivityLabel(formData.activity_level)}
              onPress={() => setActivityModalVisible(true)}
            />

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

      {/* Age Picker Modal */}
      <PickerModal
        visible={ageModalVisible}
        onClose={() => setAgeModalVisible(false)}
        onSelect={(value) => updateField('age', value)}
        title="Select Age"
        options={AGE_OPTIONS.map(age => ({ label: `${age} years`, value: age }))}
        selectedValue={formData.age}
      />

      {/* Gender Picker Modal */}
      <PickerModal
        visible={genderModalVisible}
        onClose={() => setGenderModalVisible(false)}
        onSelect={(value) => updateField('gender', value)}
        title="Select Gender"
        options={GENDER_OPTIONS}
        selectedValue={formData.gender}
      />

      {/* Height Feet Picker Modal */}
      <PickerModal
        visible={heightFeetModalVisible}
        onClose={() => setHeightFeetModalVisible(false)}
        onSelect={(value) => updateField('height_feet', value)}
        title="Select Height (Feet)"
        options={HEIGHT_FEET_OPTIONS.map(ft => ({ label: `${ft} feet`, value: ft }))}
        selectedValue={formData.height_feet}
      />

      {/* Height Inches Picker Modal */}
      <PickerModal
        visible={heightInchesModalVisible}
        onClose={() => setHeightInchesModalVisible(false)}
        onSelect={(value) => updateField('height_inches', value)}
        title="Select Height (Inches)"
        options={HEIGHT_INCHES_OPTIONS.map(inch => ({ label: `${inch} inches`, value: inch }))}
        selectedValue={formData.height_inches}
      />

      {/* Weight Picker Modal */}
      <PickerModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onSelect={(value) => updateField('weight', value)}
        title="Select Current Weight"
        options={WEIGHT_OPTIONS.map(w => ({ label: `${w} lbs`, value: w }))}
        selectedValue={formData.weight}
      />

      {/* Goal Weight Picker Modal */}
      <PickerModal
        visible={goalWeightModalVisible}
        onClose={() => setGoalWeightModalVisible(false)}
        onSelect={(value) => updateField('goal_weight', value)}
        title="Select Goal Weight"
        options={WEIGHT_OPTIONS.map(w => ({ label: `${w} lbs`, value: w }))}
        selectedValue={formData.goal_weight}
      />

      {/* Activity Level Picker Modal */}
      <PickerModal
        visible={activityModalVisible}
        onClose={() => setActivityModalVisible(false)}
        onSelect={(value) => updateField('activity_level', value)}
        title="Select Activity Level"
        options={ACTIVITY_OPTIONS}
        selectedValue={formData.activity_level}
      />
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  cancelText: {
    fontSize: 17,
    color: Colors.text.secondary,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.brand.primary,
  },
  picker: {
    height: 216,
  },
  pickerItem: {
    fontSize: 20,
    color: Colors.text.primary,
  },
});

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
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  input: {
    backgroundColor: Colors.background.light,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  selectorButton: {
    backgroundColor: Colors.background.light,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorValue: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: Colors.text.muted,
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
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
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
    borderRadius: 12,
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

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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguageStore } from '../../stores/languageStore';
import { AccentColor, AccentColors, ThemeMode } from '../../constants/Colors';
import { userAPI } from '../../services/api';
import { storage } from '../../services/storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../services/i18n';

const AGE_OPTIONS = Array.from({ length: 83 }, (_, i) => i + 18);
const HEIGHT_FEET_OPTIONS = Array.from({ length: 5 }, (_, i) => i + 4);
const HEIGHT_INCHES_OPTIONS = Array.from({ length: 12 }, (_, i) => i);
const WEIGHT_OPTIONS = Array.from({ length: 351 }, (_, i) => i + 80);

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

const ACTIVITY_OPTIONS = [
  { label: 'Sedentary', value: 'sedentary' },
  { label: 'Light', value: 'light' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Active', value: 'active' },
  { label: 'Very Active', value: 'very_active' },
];

const ACCENT_COLORS: { name: string; value: AccentColor }[] = [
  { name: 'Blue', value: 'blue' },
  { name: 'Purple', value: 'purple' },
  { name: 'Green', value: 'green' },
  { name: 'Orange', value: 'orange' },
  { name: 'Pink', value: 'pink' },
  { name: 'Cyan', value: 'cyan' },
  { name: 'Red', value: 'red' },
];

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
  const { theme } = useThemeStore();
  const [tempValue, setTempValue] = useState(selectedValue);

  useEffect(() => {
    if (visible) setTempValue(selectedValue);
  }, [visible, selectedValue]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { backgroundColor: theme.colors.background.card }]}>
          <View style={[modalStyles.header, { borderBottomColor: theme.colors.border.primary }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[modalStyles.cancelText, { color: theme.colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[modalStyles.title, { color: theme.colors.text.primary }]}>{title}</Text>
            <TouchableOpacity onPress={() => { onSelect(tempValue); onClose(); }}>
              <Text style={[modalStyles.doneText, { color: theme.accentColors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <Picker
            selectedValue={tempValue}
            onValueChange={(value) => setTempValue(value)}
            style={[modalStyles.picker, { color: theme.colors.text.primary }]}
            itemStyle={{ color: theme.colors.text.primary }}
          >
            {options.map((option) => (
              <Picker.Item key={option.value.toString()} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>
      </View>
    </Modal>
  );
};

export default function ProfileScreen() {
  const { userId, profile, setUserId, setProfile } = useUserStore();
  const { theme, mode, accent, setMode, setAccent } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance'>('profile');

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

  const colors = theme.colors;
  const accentColors = theme.accentColors;

  useEffect(() => {
    if (!userId) {
      const newUserId = `user_${Date.now()}`;
      setUserId(newUserId);
      storage.saveUserId(newUserId);
    }
  }, [userId]);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        age: profile.age || 30,
        gender: profile.gender || 'male',
        height_feet: profile.height_feet || 5,
        height_inches: profile.height_inches || 8,
        weight: profile.weight || 160,
        goal_weight: profile.goal_weight || 155,
        activity_level: profile.activity_level || 'moderate',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!formData.name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    try {
      setLoading(true);
      const profileData = {
        user_id: userId!,
        ...formData,
      };
      const result = await userAPI.createOrUpdateProfile(profileData);
      setProfile(result.profile);
      await storage.saveUserProfile(result.profile);
      await storage.setOnboardingComplete();
      Alert.alert('Success', 'Profile saved!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const SelectorButton = ({ value, onPress, placeholder }: any) => (
    <TouchableOpacity 
      style={[styles.selectorButton, { backgroundColor: colors.background.input, borderColor: colors.border.primary }]} 
      onPress={onPress}
    >
      <Text style={[styles.selectorValue, { color: value ? colors.text.primary : colors.text.muted }]}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={20} color={colors.text.muted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background.secondary }]}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Settings</Text>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabContainer, { backgroundColor: colors.background.secondary }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'profile' && { backgroundColor: accentColors.primary }
            ]}
            onPress={() => setActiveTab('profile')}
          >
            <Ionicons 
              name="person" 
              size={18} 
              color={activeTab === 'profile' ? '#fff' : colors.text.secondary} 
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'profile' ? '#fff' : colors.text.secondary }
            ]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'appearance' && { backgroundColor: accentColors.primary }
            ]}
            onPress={() => setActiveTab('appearance')}
          >
            <Ionicons 
              name="color-palette" 
              size={18} 
              color={activeTab === 'appearance' ? '#fff' : colors.text.secondary} 
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'appearance' ? '#fff' : colors.text.secondary }
            ]}>Appearance</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === 'profile' ? (
            <View style={[styles.card, { backgroundColor: colors.background.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Your Profile</Text>

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.input, borderColor: colors.border.primary, color: colors.text.primary }]}
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                placeholder="Enter your name"
                placeholderTextColor={colors.text.muted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Age</Text>
              <SelectorButton value={`${formData.age} years`} onPress={() => setAgeModalVisible(true)} />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Gender</Text>
              <SelectorButton 
                value={GENDER_OPTIONS.find(g => g.value === formData.gender)?.label} 
                onPress={() => setGenderModalVisible(true)} 
              />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Height</Text>
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <SelectorButton value={`${formData.height_feet} ft`} onPress={() => setHeightFeetModalVisible(true)} />
                </View>
                <View style={styles.halfInput}>
                  <SelectorButton value={`${formData.height_inches} in`} onPress={() => setHeightInchesModalVisible(true)} />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Current Weight</Text>
              <SelectorButton value={`${formData.weight} lbs`} onPress={() => setWeightModalVisible(true)} />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Goal Weight</Text>
              <SelectorButton value={`${formData.goal_weight} lbs`} onPress={() => setGoalWeightModalVisible(true)} />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Activity Level</Text>
              <SelectorButton 
                value={ACTIVITY_OPTIONS.find(a => a.value === formData.activity_level)?.label} 
                onPress={() => setActivityModalVisible(true)} 
              />

              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: accentColors.primary }]} 
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                )}
              </TouchableOpacity>

              {profile && (
                <View style={[styles.goalCard, { backgroundColor: `${accentColors.primary}20` }]}>
                  <Text style={[styles.goalLabel, { color: colors.text.secondary }]}>Daily Calorie Goal</Text>
                  <Text style={[styles.goalValue, { color: accentColors.primary }]}>
                    {profile.daily_calorie_goal || 2000} cal
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.background.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Appearance</Text>

              {/* Theme Mode */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={24} color={accentColors.primary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Dark Mode</Text>
                    <Text style={[styles.settingDescription, { color: colors.text.muted }]}>
                      {mode === 'dark' ? 'Dark theme active' : 'Light theme active'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={mode === 'dark'}
                  onValueChange={() => setMode(mode === 'dark' ? 'light' : 'dark')}
                  trackColor={{ false: colors.border.secondary, true: accentColors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {/* Accent Color */}
              <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: 24 }]}>
                Accent Color
              </Text>
              <View style={styles.colorGrid}>
                {ACCENT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color.value}
                    style={[
                      styles.colorOption,
                      { backgroundColor: AccentColors[color.value].primary },
                      accent === color.value && styles.colorOptionSelected
                    ]}
                    onPress={() => setAccent(color.value)}
                  >
                    {accent === color.value && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: 24 }]}>
                Preview
              </Text>
              <LinearGradient
                colors={accentColors.gradient as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.previewCard}
              >
                <View style={styles.previewContent}>
                  <Ionicons name="diamond" size={28} color="#fff" />
                  <View>
                    <Text style={styles.previewTitle}>FitTrax Premium</Text>
                    <Text style={styles.previewSubtitle}>Your selected accent color</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={[styles.previewButton, { backgroundColor: accentColors.primary }]}>
                <Text style={styles.previewButtonText}>Sample Button</Text>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Picker Modals */}
      <PickerModal
        visible={ageModalVisible}
        onClose={() => setAgeModalVisible(false)}
        onSelect={(value) => updateField('age', value)}
        title="Select Age"
        options={AGE_OPTIONS.map(age => ({ label: `${age} years`, value: age }))}
        selectedValue={formData.age}
      />
      <PickerModal
        visible={genderModalVisible}
        onClose={() => setGenderModalVisible(false)}
        onSelect={(value) => updateField('gender', value)}
        title="Select Gender"
        options={GENDER_OPTIONS}
        selectedValue={formData.gender}
      />
      <PickerModal
        visible={heightFeetModalVisible}
        onClose={() => setHeightFeetModalVisible(false)}
        onSelect={(value) => updateField('height_feet', value)}
        title="Height (Feet)"
        options={HEIGHT_FEET_OPTIONS.map(ft => ({ label: `${ft} feet`, value: ft }))}
        selectedValue={formData.height_feet}
      />
      <PickerModal
        visible={heightInchesModalVisible}
        onClose={() => setHeightInchesModalVisible(false)}
        onSelect={(value) => updateField('height_inches', value)}
        title="Height (Inches)"
        options={HEIGHT_INCHES_OPTIONS.map(inch => ({ label: `${inch} inches`, value: inch }))}
        selectedValue={formData.height_inches}
      />
      <PickerModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onSelect={(value) => updateField('weight', value)}
        title="Current Weight"
        options={WEIGHT_OPTIONS.map(w => ({ label: `${w} lbs`, value: w }))}
        selectedValue={formData.weight}
      />
      <PickerModal
        visible={goalWeightModalVisible}
        onClose={() => setGoalWeightModalVisible(false)}
        onSelect={(value) => updateField('goal_weight', value)}
        title="Goal Weight"
        options={WEIGHT_OPTIONS.map(w => ({ label: `${w} lbs`, value: w }))}
        selectedValue={formData.goal_weight}
      />
      <PickerModal
        visible={activityModalVisible}
        onClose={() => setActivityModalVisible(false)}
        onSelect={(value) => updateField('activity_level', value)}
        title="Activity Level"
        options={ACTIVITY_OPTIONS}
        selectedValue={formData.activity_level}
      />
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
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
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 17,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
  },
  picker: {
    height: 216,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  selectorButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorValue: {
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  goalCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  goalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  goalValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {},
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  previewCard: {
    borderRadius: 16,
    padding: 20,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  previewSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  previewButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

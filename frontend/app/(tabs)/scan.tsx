import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { foodAPI } from '../../services/api';
import { router } from 'expo-router';

const MEAL_CATEGORIES = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅', color: '#F59E0B' },
  { value: 'lunch', label: 'Lunch', icon: '☀️', color: '#10B981' },
  { value: 'snack', label: 'Snack', icon: '🍎', color: '#EC4899' },
  { value: 'dinner', label: 'Dinner', icon: '🌙', color: '#8B5CF6' },
];

export default function ScanScreen() {
  const { userId } = useUserStore();
  const { theme } = useThemeStore();
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mealCategory, setMealCategory] = useState('breakfast');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [servingQuantity, setServingQuantity] = useState('1');
  const [editedNutrition, setEditedNutrition] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [savedMealId, setSavedMealId] = useState<string | null>(null);

  const colors = theme.colors;
  const accent = theme.accentColors;

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to scan food');
      return false;
    }
    return true;
  };

  const takePicture = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Reduced for faster upload
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setImage(result.assets[0].uri);
        setImageBase64(result.assets[0].base64);
        analyzeFood(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Reduced for faster upload
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setImage(result.assets[0].uri);
        setImageBase64(result.assets[0].base64);
        analyzeFood(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const analyzeFood = async (base64Image: string) => {
    if (!userId) {
      Alert.alert('Error', 'Please complete your profile first');
      return;
    }

    try {
      setAnalyzing(true);
      setResult(null);
      setSavedMealId(null);

      const response = await foodAPI.analyzeFood({
        user_id: userId,
        image_base64: base64Image,
        meal_category: mealCategory,
      });

      setResult(response);
      // Get meal_id from the meal object in the response
      setSavedMealId(response.meal?.meal_id || null);
      
      // Initialize edited nutrition with result values
      if (response.analysis) {
        setEditedNutrition({
          calories: Math.round(response.analysis.calories).toString(),
          protein: Math.round(response.analysis.protein).toString(),
          carbs: Math.round(response.analysis.carbs).toString(),
          fat: Math.round(response.analysis.fat).toString(),
        });
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      Alert.alert('Error', error.message || 'Failed to analyze food');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!savedMealId) {
      Alert.alert('Info', 'This scan was not saved to the database yet.');
      reset();
      return;
    }

    Alert.alert(
      'Delete Scan',
      'Are you sure you want to delete this food scan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await foodAPI.deleteMeal(savedMealId);
              Alert.alert('Deleted', 'Food scan has been removed');
              reset();
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleSaveEdits = async () => {
    if (!savedMealId) {
      // If meal wasn't saved yet, just update local state
      setResult((prev: any) => ({
        ...prev,
        analysis: {
          ...prev.analysis,
          calories: parseFloat(editedNutrition.calories) || 0,
          protein: parseFloat(editedNutrition.protein) || 0,
          carbs: parseFloat(editedNutrition.carbs) || 0,
          fat: parseFloat(editedNutrition.fat) || 0,
        },
      }));
      setEditModalVisible(false);
      return;
    }

    try {
      // Update the meal with edited values
      await foodAPI.updateMeal(savedMealId, {
        calories: parseFloat(editedNutrition.calories) || 0,
        protein: parseFloat(editedNutrition.protein) || 0,
        carbs: parseFloat(editedNutrition.carbs) || 0,
        fat: parseFloat(editedNutrition.fat) || 0,
      });

      // Update local result
      setResult((prev: any) => ({
        ...prev,
        analysis: {
          ...prev.analysis,
          calories: parseFloat(editedNutrition.calories) || 0,
          protein: parseFloat(editedNutrition.protein) || 0,
          carbs: parseFloat(editedNutrition.carbs) || 0,
          fat: parseFloat(editedNutrition.fat) || 0,
        },
      }));

      setEditModalVisible(false);
    } catch (error: any) {
      console.error('Update error:', error);
      // Still close modal and update local state even if API fails
      setResult((prev: any) => ({
        ...prev,
        analysis: {
          ...prev.analysis,
          calories: parseFloat(editedNutrition.calories) || 0,
          protein: parseFloat(editedNutrition.protein) || 0,
          carbs: parseFloat(editedNutrition.carbs) || 0,
          fat: parseFloat(editedNutrition.fat) || 0,
        },
      }));
      setEditModalVisible(false);
      Alert.alert('Note', 'Values updated locally. Sync may have failed.');
    }
  };

  const reset = () => {
    setImage(null);
    setImageBase64(null);
    setResult(null);
    setSavedMealId(null);
    setServingQuantity('1');
  };

  // Apply quantity multiplier to nutrition values
  const applyQuantity = () => {
    const qty = parseFloat(servingQuantity) || 1;
    if (qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a number greater than 0');
      return;
    }

    setResult((prev: any) => ({
      ...prev,
      analysis: {
        ...prev.analysis,
        calories: Math.round((prev.analysis.calories || 0) * qty),
        protein: Math.round(((prev.analysis.protein || 0) * qty) * 10) / 10,
        carbs: Math.round(((prev.analysis.carbs || 0) * qty) * 10) / 10,
        fat: Math.round(((prev.analysis.fat || 0) * qty) * 10) / 10,
        portion_size: `${qty} × ${prev.analysis.portion_size || '1 serving'}`,
      },
    }));
    setQuantityModalVisible(false);
    setServingQuantity('1');
  };

  const selectedCategory = MEAL_CATEGORIES.find(c => c.value === mealCategory);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header with Back Button */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border.primary }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={accent.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>AI Food Scanner</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Capture or upload a photo of your food for instant nutrition analysis
        </Text>

        {/* Meal Category Selector */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>MEAL CATEGORY</Text>
          <TouchableOpacity 
            style={[styles.categorySelector, { backgroundColor: colors.background.card, borderColor: colors.border.primary }]}
            onPress={() => setCategoryModalVisible(true)}
          >
            <View style={styles.categorySelectorContent}>
              <Text style={styles.categoryIcon}>{selectedCategory?.icon}</Text>
              <Text style={[styles.categorySelectorText, { color: colors.text.primary }]}>
                {selectedCategory?.label}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={24} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Camera/Gallery Buttons */}
        {!image && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.background.card }]} 
              onPress={takePicture}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${accent.primary}20` }]}>
                <Ionicons name="camera" size={32} color={accent.primary} />
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text.primary }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.background.card }]} 
              onPress={pickImage}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${accent.primary}20` }]}>
                <Ionicons name="images" size={32} color={accent.primary} />
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text.primary }]}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Image Preview */}
        {image && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />
            {analyzing && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color={accent.primary} />
                <Text style={styles.analyzingText}>Analyzing food...</Text>
              </View>
            )}
          </View>
        )}

        {/* Analysis Result */}
        {result && result.analysis && (
          <View style={[styles.resultCard, { backgroundColor: colors.background.card }]}>
            <View style={[styles.resultHeader, { borderBottomColor: colors.border.primary }]}>
              <MaterialIcons name="fastfood" size={24} color={accent.primary} />
              <Text style={[styles.resultTitle, { color: colors.text.primary }]}>
                {result.analysis.food_name}
              </Text>
              <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.nutritionGrid}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.editHint}>
                <Ionicons name="pencil" size={14} color={colors.text.muted} />
                <Text style={[styles.editHintText, { color: colors.text.muted }]}>Tap to edit</Text>
              </View>
              
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: accent.primary }]}>
                    {Math.round(result.analysis.calories)}
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: colors.text.secondary }]}>Calories</Text>
                </View>
                <View style={[styles.nutritionDivider, { backgroundColor: colors.border.primary }]} />
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: accent.primary }]}>
                    {Math.round(result.analysis.protein)}g
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: colors.text.secondary }]}>Protein</Text>
                </View>
              </View>
              
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: accent.primary }]}>
                    {Math.round(result.analysis.carbs)}g
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: colors.text.secondary }]}>Carbs</Text>
                </View>
                <View style={[styles.nutritionDivider, { backgroundColor: colors.border.primary }]} />
                <View style={styles.nutritionItem}>
                  <Text style={[styles.nutritionValue, { color: accent.primary }]}>
                    {Math.round(result.analysis.fat)}g
                  </Text>
                  <Text style={[styles.nutritionLabel, { color: colors.text.secondary }]}>Fat</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={[styles.portionInfo, { backgroundColor: colors.background.elevated }]}>
              <Ionicons name="resize" size={16} color={colors.text.secondary} />
              <Text style={[styles.portionText, { color: colors.text.secondary }]}>
                Portion: {result.analysis.portion_size}
              </Text>
            </View>

            {/* Quantity Adjustment Button */}
            <TouchableOpacity 
              style={[styles.quantityButton, { backgroundColor: colors.background.card, borderColor: accent.primary }]}
              onPress={() => setQuantityModalVisible(true)}
            >
              <Ionicons name="calculator" size={20} color={accent.primary} />
              <View style={styles.quantityButtonText}>
                <Text style={[styles.quantityButtonTitle, { color: colors.text.primary }]}>
                  Adjust Quantity
                </Text>
                <Text style={[styles.quantityButtonHint, { color: colors.text.secondary }]}>
                  For bulk items: cookies, donuts, etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.scanAgainButton, { backgroundColor: accent.primary }]} 
              onPress={reset}
            >
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.scanAgainText}>Scan Another Food</Text>
            </TouchableOpacity>
          </View>
        )}

        {image && !analyzing && !result && (
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: '#EF4444' }]} 
            onPress={reset}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Meal Category Picker Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setCategoryModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContainer, { backgroundColor: colors.background.card }]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Text style={[styles.modalCancel, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Select Meal</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Text style={[styles.modalDone, { color: accent.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={mealCategory}
              onValueChange={(value) => setMealCategory(value)}
              style={[styles.picker, { color: colors.text.primary }]}
              itemStyle={{ color: colors.text.primary, fontSize: 20 }}
            >
              {MEAL_CATEGORIES.map((cat) => (
                <Picker.Item 
                  key={cat.value} 
                  label={`${cat.icon}  ${cat.label}`} 
                  value={cat.value} 
                />
              ))}
            </Picker>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Nutrition Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setEditModalVisible(false)}
          />
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={[styles.editModalContainer, { backgroundColor: colors.background.card }]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.modalCancel, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Edit Nutrition</Text>
              <TouchableOpacity onPress={handleSaveEdits}>
                <Text style={[styles.modalDone, { color: accent.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <View style={styles.editRow}>
                <Text style={[styles.editLabel, { color: colors.text.secondary }]}>Calories</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.background.input, borderColor: colors.border.primary, color: colors.text.primary }]}
                  value={editedNutrition.calories}
                  onChangeText={(text) => setEditedNutrition(prev => ({ ...prev, calories: text }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                />
              </View>

              <View style={styles.editRow}>
                <Text style={[styles.editLabel, { color: colors.text.secondary }]}>Protein (g)</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.background.input, borderColor: colors.border.primary, color: colors.text.primary }]}
                  value={editedNutrition.protein}
                  onChangeText={(text) => setEditedNutrition(prev => ({ ...prev, protein: text }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                />
              </View>

              <View style={styles.editRow}>
                <Text style={[styles.editLabel, { color: colors.text.secondary }]}>Carbs (g)</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.background.input, borderColor: colors.border.primary, color: colors.text.primary }]}
                  value={editedNutrition.carbs}
                  onChangeText={(text) => setEditedNutrition(prev => ({ ...prev, carbs: text }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                />
              </View>

              <View style={styles.editRow}>
                <Text style={[styles.editLabel, { color: colors.text.secondary }]}>Fat (g)</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.background.input, borderColor: colors.border.primary, color: colors.text.primary }]}
                  value={editedNutrition.fat}
                  onChangeText={(text) => setEditedNutrition(prev => ({ ...prev, fat: text }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Quantity Adjustment Modal */}
      <Modal
        visible={quantityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuantityModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setQuantityModalVisible(false)}
          />
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={[styles.editModalContainer, { backgroundColor: colors.background.card }]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
              <TouchableOpacity onPress={() => setQuantityModalVisible(false)}>
                <Text style={[styles.modalCancel, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Adjust Quantity</Text>
              <TouchableOpacity onPress={applyQuantity}>
                <Text style={[styles.modalDone, { color: accent.primary }]}>Apply</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quantityForm}>
              <Text style={[styles.quantityDescription, { color: colors.text.secondary }]}>
                Enter the number of servings you consumed. The nutrition values will be multiplied by this amount.
              </Text>
              
              <View style={styles.quantityInputContainer}>
                <TouchableOpacity 
                  style={[styles.quantityAdjustButton, { backgroundColor: colors.background.elevated }]}
                  onPress={() => {
                    const current = parseFloat(servingQuantity) || 1;
                    if (current > 0.5) setServingQuantity((current - 0.5).toString());
                  }}
                >
                  <Ionicons name="remove" size={24} color={accent.primary} />
                </TouchableOpacity>
                
                <TextInput
                  style={[styles.quantityInput, { 
                    backgroundColor: colors.background.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary 
                  }]}
                  value={servingQuantity}
                  onChangeText={setServingQuantity}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={colors.text.muted}
                  textAlign="center"
                />
                
                <TouchableOpacity 
                  style={[styles.quantityAdjustButton, { backgroundColor: colors.background.elevated }]}
                  onPress={() => {
                    const current = parseFloat(servingQuantity) || 1;
                    setServingQuantity((current + 0.5).toString());
                  }}
                >
                  <Ionicons name="add" size={24} color={accent.primary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.quantityHint, { color: colors.text.muted }]}>
                Example: Enter "2" if you ate 2 donuts from a bag
              </Text>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  categorySelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categorySelectorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  resultCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
  nutritionGrid: {
    marginBottom: 16,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12,
  },
  editHintText: {
    fontSize: 12,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  nutritionLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  nutritionDivider: {
    width: 1,
    height: 50,
  },
  portionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  portionText: {
    fontSize: 14,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  editModalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    fontSize: 17,
  },
  modalDone: {
    fontSize: 17,
    fontWeight: '600',
  },
  picker: {
    height: 216,
  },
  editForm: {
    padding: 20,
  },
  editRow: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
  },
});

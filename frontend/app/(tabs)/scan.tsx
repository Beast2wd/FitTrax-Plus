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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../stores/userStore';
import { foodAPI } from '../../services/api';
import { Picker } from '@react-native-picker/picker';

export default function ScanScreen() {
  const { userId } = useUserStore();
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mealCategory, setMealCategory] = useState('breakfast');

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to scan food'
      );
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
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setImage(result.assets[0].uri);
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
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setImage(result.assets[0].uri);
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

      const response = await foodAPI.analyzeFood({
        user_id: userId,
        image_base64: base64Image,
        meal_category: mealCategory,
      });

      setResult(response);
      Alert.alert('Success', 'Food analyzed and saved!');
    } catch (error: any) {
      console.error('Analysis error:', error);
      Alert.alert('Error', error.message || 'Failed to analyze food');
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setMealCategory('breakfast');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>AI Food Scanner</Text>
        <Text style={styles.subtitle}>
          Capture or upload a photo of your food for instant nutrition analysis
        </Text>

        {/* Meal Category Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Meal Category</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={mealCategory}
              onValueChange={(value) => setMealCategory(value)}
              style={styles.picker}
            >
              <Picker.Item label="Breakfast" value="breakfast" />
              <Picker.Item label="Lunch" value="lunch" />
              <Picker.Item label="Dinner" value="dinner" />
              <Picker.Item label="Snack" value="snack" />
            </Picker>
          </View>
        </View>

        {/* Camera/Gallery Buttons */}
        {!image && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={takePicture}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera" size={32} color={Colors.brand.primary} />
              </View>
              <Text style={styles.actionButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
              <View style={styles.iconCircle}>
                <Ionicons name="images" size={32} color={Colors.brand.primary} />
              </View>
              <Text style={styles.actionButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Image Preview */}
        {image && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />
            {analyzing && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color={Colors.brand.primary} />
                <Text style={styles.analyzingText}>Analyzing food...</Text>
              </View>
            )}
          </View>
        )}

        {/* Analysis Result */}
        {result && result.analysis && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <MaterialIcons name="fastfood" size={24} color={Colors.brand.primary} />
              <Text style={styles.resultTitle}>{result.analysis.food_name}</Text>
            </View>

            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(result.analysis.calories)}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(result.analysis.protein)}g</Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(result.analysis.carbs)}g</Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(result.analysis.fat)}g</Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
            </View>

            <View style={styles.portionInfo}>
              <Ionicons name="resize" size={16} color={Colors.text.secondary} />
              <Text style={styles.portionText}>
                Portion: {result.analysis.portion_size}
              </Text>
            </View>

            <TouchableOpacity style={styles.scanAgainButton} onPress={reset}>
              <Text style={styles.scanAgainText}>Scan Another Food</Text>
            </TouchableOpacity>
          </View>
        )}

        {image && !analyzing && !result && (
          <TouchableOpacity style={styles.retryButton} onPress={reset}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
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
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  resultCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.brand.primary,
  },
  nutritionLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  nutritionDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border.light,
  },
  portionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.background.light,
    borderRadius: 8,
    marginBottom: 16,
  },
  portionText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  scanAgainButton: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  scanAgainText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: Colors.status.error,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    color: Colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

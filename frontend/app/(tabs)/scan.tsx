import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { foodAPI } from '../../services/api';
import { router } from 'expo-router';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MEAL_CATEGORIES = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅', color: '#F59E0B' },
  { value: 'lunch', label: 'Lunch', icon: '☀️', color: '#10B981' },
  { value: 'snack', label: 'Snack', icon: '🍎', color: '#EC4899' },
  { value: 'dinner', label: 'Dinner', icon: '🌙', color: '#8B5CF6' },
];

// Tab options for the meal planner
const TABS = [
  { id: 'planner', label: 'Meal Planner', icon: 'restaurant-menu' },
  { id: 'groceries', label: 'Groceries', icon: 'shopping-cart' },
  { id: 'recipes', label: 'Recipes', icon: 'menu-book' },
];

interface CustomMeal {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
  image?: string;
  recipe?: string;
  ingredients?: string[];
  date: string;
  cooked?: boolean;
}

interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
}

interface Recipe {
  id: string;
  name: string;
  image: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime: string;
  ingredients: string[];
  instructions: string[];
  category: string;
}

export default function ScanScreen() {
  const { userId, triggerMealRefresh } = useUserStore();
  const { theme } = useThemeStore();
  const colors = theme.colors;
  const accent = theme.accentColors;

  // Main tab state
  const [activeTab, setActiveTab] = useState('planner');
  
  // Scan states
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mealCategory, setMealCategory] = useState('breakfast');
  const [savedMealId, setSavedMealId] = useState<string | null>(null);

  // Meal Planner states
  const [plannedMeals, setPlannedMeals] = useState<CustomMeal[]>([]);
  const [showCreateMealModal, setShowCreateMealModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  
  // New meal form
  const [newMeal, setNewMeal] = useState({
    name: '',
    category: 'breakfast',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    sugar: '',
    fiber: '',
    sodium: '',
  });

  // Grocery states
  const [groceryList, setGroceryList] = useState<GroceryItem[]>([]);
  const [generatingGroceries, setGeneratingGroceries] = useState(false);
  const [showAddGroceryModal, setShowAddGroceryModal] = useState(false);
  const [newGroceryItem, setNewGroceryItem] = useState({ name: '', quantity: '1', category: 'Produce' });

  // Recipe states
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [recipePrompt, setRecipePrompt] = useState('');
  const [showRecipeGeneratorModal, setShowRecipeGeneratorModal] = useState(false);

  // Load data on mount
  useEffect(() => {
    if (userId) {
      loadPlannedMeals();
      loadGroceryList();
      loadRecipes();
    }
  }, [userId, selectedDate]);

  const loadPlannedMeals = async () => {
    if (!userId) return;
    setLoadingMeals(true);
    try {
      const response = await axios.get(`${API_URL}/api/meals/planned/${userId}?date=${selectedDate}`);
      setPlannedMeals(response.data.meals || []);
    } catch (error) {
      console.log('No planned meals found');
      setPlannedMeals([]);
    } finally {
      setLoadingMeals(false);
    }
  };

  const loadGroceryList = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/meals/groceries/${userId}`);
      setGroceryList(response.data.items || []);
    } catch (error) {
      console.log('No grocery list found');
    }
  };

  const loadRecipes = async () => {
    if (!userId) return;
    setLoadingRecipes(true);
    try {
      const response = await axios.get(`${API_URL}/api/meals/recipes/${userId}`);
      setRecipes(response.data.recipes || []);
    } catch (error) {
      console.log('No recipes found');
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Camera/Gallery functions
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
        quality: 0.5,
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
        quality: 0.5,
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
      setSavedMealId(response.meal?.meal_id || null);
      
      if (response.meal?.meal_id) {
        triggerMealRefresh();
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      Alert.alert('Error', error.message || 'Failed to analyze food');
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setImageBase64(null);
    setResult(null);
    setSavedMealId(null);
  };

  // Create custom meal
  const handleCreateMeal = async () => {
    if (!newMeal.name || !newMeal.calories) {
      Alert.alert('Required', 'Please enter meal name and calories');
      return;
    }

    try {
      const mealData: CustomMeal = {
        id: `meal_${Date.now()}`,
        name: newMeal.name,
        category: newMeal.category,
        calories: parseInt(newMeal.calories) || 0,
        protein: parseInt(newMeal.protein) || 0,
        carbs: parseInt(newMeal.carbs) || 0,
        fat: parseInt(newMeal.fat) || 0,
        sugar: parseInt(newMeal.sugar) || 0,
        fiber: parseInt(newMeal.fiber) || 0,
        sodium: parseInt(newMeal.sodium) || 0,
        date: selectedDate,
        cooked: false,
      };

      await axios.post(`${API_URL}/api/meals/planned`, {
        user_id: userId,
        meal: mealData,
      });

      setPlannedMeals(prev => [...prev, mealData]);
      setShowCreateMealModal(false);
      setNewMeal({
        name: '', category: 'breakfast', calories: '', protein: '',
        carbs: '', fat: '', sugar: '', fiber: '', sodium: '',
      });
      Alert.alert('Success', 'Meal added to your plan!');
    } catch (error) {
      console.error('Error creating meal:', error);
      Alert.alert('Error', 'Failed to create meal');
    }
  };

  // Mark meal as cooked and log nutrients
  const handleCookMeal = async (meal: CustomMeal) => {
    Alert.alert(
      'Log This Meal',
      `Log "${meal.name}" to your nutrition tracker?\n\nCalories: ${meal.calories}\nProtein: ${meal.protein}g\nCarbs: ${meal.carbs}g\nFat: ${meal.fat}g`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Meal',
          onPress: async () => {
            try {
              // Log to nutrition tracker
              await axios.post(`${API_URL}/api/food/log-custom`, {
                user_id: userId,
                meal_name: meal.name,
                meal_category: meal.category,
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fat: meal.fat,
                sugar: meal.sugar,
                fiber: meal.fiber,
                sodium: meal.sodium,
              });

              // Mark as cooked
              await axios.put(`${API_URL}/api/meals/planned/${meal.id}/cook`, {
                user_id: userId,
              });

              // Update local state
              setPlannedMeals(prev => 
                prev.map(m => m.id === meal.id ? { ...m, cooked: true } : m)
              );

              triggerMealRefresh();
              Alert.alert('Logged!', `${meal.name} has been added to your nutrition log.`);
            } catch (error) {
              console.error('Error logging meal:', error);
              Alert.alert('Error', 'Failed to log meal');
            }
          },
        },
      ]
    );
  };

  // Delete planned meal
  const handleDeleteMeal = async (mealId: string) => {
    Alert.alert(
      'Delete Meal',
      'Remove this meal from your plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/meals/planned/${mealId}?user_id=${userId}`);
              setPlannedMeals(prev => prev.filter(m => m.id !== mealId));
            } catch (error) {
              console.error('Error deleting meal:', error);
            }
          },
        },
      ]
    );
  };

  // Generate AI grocery list
  const generateGroceryList = async () => {
    if (plannedMeals.length === 0) {
      Alert.alert('No Meals', 'Add some meals to your plan first to generate a grocery list.');
      return;
    }

    setGeneratingGroceries(true);
    try {
      const response = await axios.post(`${API_URL}/api/meals/generate-groceries`, {
        user_id: userId,
        meals: plannedMeals.map(m => m.name),
      });

      setGroceryList(response.data.items || []);
      setActiveTab('groceries');
      Alert.alert('Success', 'Grocery list generated based on your meal plan!');
    } catch (error) {
      console.error('Error generating groceries:', error);
      Alert.alert('Error', 'Failed to generate grocery list');
    } finally {
      setGeneratingGroceries(false);
    }
  };

  // Toggle grocery item
  const toggleGroceryItem = async (itemId: string) => {
    setGroceryList(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
    // Save to backend
    try {
      await axios.put(`${API_URL}/api/meals/groceries/${itemId}/toggle`, {
        user_id: userId,
      });
    } catch (error) {
      console.log('Error saving grocery toggle');
    }
  };

  // Add grocery item
  const handleAddGroceryItem = async () => {
    if (!newGroceryItem.name) return;
    
    const item: GroceryItem = {
      id: `grocery_${Date.now()}`,
      name: newGroceryItem.name,
      quantity: newGroceryItem.quantity,
      category: newGroceryItem.category,
      checked: false,
    };

    try {
      await axios.post(`${API_URL}/api/meals/groceries`, {
        user_id: userId,
        item,
      });
      setGroceryList(prev => [...prev, item]);
      setShowAddGroceryModal(false);
      setNewGroceryItem({ name: '', quantity: '1', category: 'Produce' });
    } catch (error) {
      console.error('Error adding grocery item:', error);
    }
  };

  // Clear checked groceries
  const clearCheckedGroceries = async () => {
    const checkedIds = groceryList.filter(i => i.checked).map(i => i.id);
    if (checkedIds.length === 0) return;

    try {
      await axios.post(`${API_URL}/api/meals/groceries/clear-checked`, {
        user_id: userId,
        item_ids: checkedIds,
      });
      setGroceryList(prev => prev.filter(i => !i.checked));
    } catch (error) {
      console.error('Error clearing groceries:', error);
    }
  };

  // Generate AI recipe
  const generateRecipe = async () => {
    if (!recipePrompt.trim()) {
      Alert.alert('Enter Recipe', 'Please describe what you want to cook');
      return;
    }

    setGeneratingRecipe(true);
    try {
      const response = await axios.post(`${API_URL}/api/meals/generate-recipe`, {
        user_id: userId,
        prompt: recipePrompt,
      });

      const newRecipe = response.data.recipe;
      setRecipes(prev => [newRecipe, ...prev]);
      setShowRecipeGeneratorModal(false);
      setRecipePrompt('');
      setSelectedRecipe(newRecipe);
      setShowRecipeModal(true);
    } catch (error) {
      console.error('Error generating recipe:', error);
      Alert.alert('Error', 'Failed to generate recipe');
    } finally {
      setGeneratingRecipe(false);
    }
  };

  // Cook from recipe
  const cookFromRecipe = async (recipe: Recipe) => {
    Alert.alert(
      'Cook This Recipe',
      `Log "${recipe.name}" to your nutrition tracker?\n\nCalories: ${recipe.calories}\nProtein: ${recipe.protein}g\nCarbs: ${recipe.carbs}g\nFat: ${recipe.fat}g`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Meal',
          onPress: async () => {
            try {
              await axios.post(`${API_URL}/api/food/log-custom`, {
                user_id: userId,
                meal_name: recipe.name,
                meal_category: recipe.category || 'dinner',
                calories: recipe.calories,
                protein: recipe.protein,
                carbs: recipe.carbs,
                fat: recipe.fat,
                sugar: 0,
                fiber: 0,
                sodium: 0,
              });

              triggerMealRefresh();
              setShowRecipeModal(false);
              Alert.alert('Logged!', `${recipe.name} has been added to your nutrition log.`);
            } catch (error) {
              console.error('Error logging recipe:', error);
              Alert.alert('Error', 'Failed to log meal');
            }
          },
        },
      ]
    );
  };

  // Get today's date formatted
  const getFormattedDate = () => {
    const date = new Date(selectedDate);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Calculate daily totals
  const getDailyTotals = () => {
    return plannedMeals.reduce((acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  // Group meals by category
  const getMealsByCategory = (category: string) => {
    return plannedMeals.filter(m => m.category === category);
  };

  // Render Meal Planner Tab
  const renderMealPlanner = () => {
    const totals = getDailyTotals();
    
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Date Header */}
        <View style={styles.dateHeader}>
          <Text style={[styles.dateTitle, { color: colors.text.primary }]}>{getFormattedDate()}</Text>
          <Text style={[styles.dateCalories, { color: colors.text.secondary }]}>{totals.calories} cal</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.quickActionBtn, { backgroundColor: accent.primary }]}
            onPress={() => setShowCreateMealModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.quickActionText}>Create</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickActionBtn, { backgroundColor: colors.background.card }]}
            onPress={takePicture}
          >
            <Ionicons name="camera" size={20} color={accent.primary} />
            <Text style={[styles.quickActionText, { color: colors.text.primary }]}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickActionBtn, { backgroundColor: colors.background.card }]}
            onPress={generateGroceryList}
            disabled={generatingGroceries}
          >
            {generatingGroceries ? (
              <ActivityIndicator size="small" color={accent.primary} />
            ) : (
              <MaterialIcons name="shopping-cart" size={20} color={accent.primary} />
            )}
            <Text style={[styles.quickActionText, { color: colors.text.primary }]}>Groceries</Text>
          </TouchableOpacity>
        </View>

        {/* Scan/Analyze Result */}
        {(image || analyzing || result) && (
          <View style={[styles.scanResultCard, { backgroundColor: colors.background.card }]}>
            {image && (
              <Image source={{ uri: image }} style={styles.scanImage} resizeMode="cover" />
            )}
            {analyzing && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color={accent.primary} />
                <Text style={styles.analyzingText}>Analyzing food...</Text>
              </View>
            )}
            {result && (
              <View style={styles.scanResultContent}>
                <Text style={[styles.foodName, { color: colors.text.primary }]}>{result.analysis?.food_name || 'Food'}</Text>
                <View style={styles.macroRow}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(result.analysis?.calories || 0)}</Text>
                    <Text style={styles.macroLabel}>Cal</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(result.analysis?.protein || 0)}g</Text>
                    <Text style={styles.macroLabel}>Protein</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(result.analysis?.carbs || 0)}g</Text>
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(result.analysis?.fat || 0)}g</Text>
                    <Text style={styles.macroLabel}>Fat</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.resetBtn} onPress={reset}>
                  <Text style={styles.resetBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Meal Categories */}
        {MEAL_CATEGORIES.map(cat => {
          const meals = getMealsByCategory(cat.value);
          return (
            <View key={cat.value} style={styles.mealCategorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[styles.categoryTitle, { color: colors.text.primary }]}>{cat.label}</Text>
                <TouchableOpacity 
                  style={[styles.addMealBtn, { backgroundColor: `${cat.color}20` }]}
                  onPress={() => {
                    setNewMeal(prev => ({ ...prev, category: cat.value }));
                    setShowCreateMealModal(true);
                  }}
                >
                  <Ionicons name="add" size={18} color={cat.color} />
                </TouchableOpacity>
              </View>
              
              {meals.length === 0 ? (
                <TouchableOpacity 
                  style={[styles.emptyMealCard, { borderColor: colors.border.primary }]}
                  onPress={() => {
                    setNewMeal(prev => ({ ...prev, category: cat.value }));
                    setShowCreateMealModal(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={24} color={colors.text.muted} />
                  <Text style={[styles.emptyMealText, { color: colors.text.muted }]}>Add {cat.label}</Text>
                </TouchableOpacity>
              ) : (
                meals.map(meal => (
                  <View 
                    key={meal.id} 
                    style={[
                      styles.mealCard, 
                      { backgroundColor: colors.background.card },
                      meal.cooked && styles.mealCardCooked
                    ]}
                  >
                    <View style={styles.mealCardContent}>
                      <Text style={[styles.mealName, { color: colors.text.primary }]}>{meal.name}</Text>
                      <Text style={[styles.mealCalories, { color: colors.text.secondary }]}>
                        {meal.calories} cal • {meal.protein}g P • {meal.carbs}g C • {meal.fat}g F
                      </Text>
                    </View>
                    <View style={styles.mealActions}>
                      {!meal.cooked && (
                        <TouchableOpacity 
                          style={[styles.cookBtn, { backgroundColor: '#10B98120' }]}
                          onPress={() => handleCookMeal(meal)}
                        >
                          <MaterialCommunityIcons name="pot-steam" size={18} color="#10B981" />
                        </TouchableOpacity>
                      )}
                      {meal.cooked && (
                        <View style={styles.cookedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        </View>
                      )}
                      <TouchableOpacity 
                        style={styles.deleteMealBtn}
                        onPress={() => handleDeleteMeal(meal.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}

        {/* Daily Summary */}
        {plannedMeals.length > 0 && (
          <View style={[styles.dailySummary, { backgroundColor: colors.background.card }]}>
            <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>Daily Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: accent.primary }]}>{totals.calories}</Text>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>Calories</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>{totals.protein}g</Text>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>Protein</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{totals.carbs}g</Text>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>Carbs</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{totals.fat}g</Text>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>Fat</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  // Render Groceries Tab
  const renderGroceries = () => {
    const groupedGroceries = groceryList.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as { [key: string]: GroceryItem[] });

    const checkedCount = groceryList.filter(i => i.checked).length;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.groceryHeader}>
          <Text style={[styles.groceryTitle, { color: colors.text.primary }]}>Grocery List</Text>
          <View style={styles.groceryActions}>
            <TouchableOpacity 
              style={[styles.groceryActionBtn, { backgroundColor: accent.primary }]}
              onPress={() => setShowAddGroceryModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
            {checkedCount > 0 && (
              <TouchableOpacity 
                style={[styles.groceryActionBtn, { backgroundColor: '#EF444420' }]}
                onPress={clearCheckedGroceries}
              >
                <Ionicons name="trash" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* AI Generate Button */}
        <TouchableOpacity 
          style={styles.aiGenerateBtn}
          onPress={generateGroceryList}
          disabled={generatingGroceries}
        >
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.aiGenerateGradient}>
            {generatingGroceries ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="robot" size={24} color="#fff" />
            )}
            <Text style={styles.aiGenerateText}>Generate from Meal Plan</Text>
          </LinearGradient>
        </TouchableOpacity>

        {groceryList.length === 0 ? (
          <View style={styles.emptyGroceries}>
            <MaterialIcons name="shopping-cart" size={64} color={colors.text.muted} />
            <Text style={[styles.emptyGroceriesTitle, { color: colors.text.primary }]}>No groceries yet</Text>
            <Text style={[styles.emptyGroceriesText, { color: colors.text.secondary }]}>
              Add items manually or generate from your meal plan
            </Text>
          </View>
        ) : (
          Object.entries(groupedGroceries).map(([category, items]) => (
            <View key={category} style={styles.groceryCategory}>
              <Text style={[styles.groceryCategoryTitle, { color: colors.text.primary }]}>{category}</Text>
              {items.map(item => (
                <TouchableOpacity 
                  key={item.id}
                  style={[styles.groceryItem, { backgroundColor: colors.background.card }]}
                  onPress={() => toggleGroceryItem(item.id)}
                >
                  <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                    {item.checked && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <Text style={[
                    styles.groceryItemText, 
                    { color: colors.text.primary },
                    item.checked && styles.groceryItemChecked
                  ]}>
                    {item.quantity} {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  // Render Recipes Tab
  const renderRecipes = () => {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* AI Recipe Generator */}
        <TouchableOpacity 
          style={styles.aiGenerateBtn}
          onPress={() => setShowRecipeGeneratorModal(true)}
        >
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.aiGenerateGradient}>
            <MaterialCommunityIcons name="chef-hat" size={24} color="#fff" />
            <Text style={styles.aiGenerateText}>Generate AI Recipe</Text>
          </LinearGradient>
        </TouchableOpacity>

        {loadingRecipes ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accent.primary} />
          </View>
        ) : recipes.length === 0 ? (
          <View style={styles.emptyRecipes}>
            <MaterialIcons name="menu-book" size={64} color={colors.text.muted} />
            <Text style={[styles.emptyRecipesTitle, { color: colors.text.primary }]}>No recipes yet</Text>
            <Text style={[styles.emptyRecipesText, { color: colors.text.secondary }]}>
              Generate AI recipes or they'll appear here
            </Text>
          </View>
        ) : (
          <View style={styles.recipesGrid}>
            {recipes.map(recipe => (
              <TouchableOpacity 
                key={recipe.id}
                style={[styles.recipeCard, { backgroundColor: colors.background.card }]}
                onPress={() => {
                  setSelectedRecipe(recipe);
                  setShowRecipeModal(true);
                }}
              >
                <Image 
                  source={{ uri: recipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300' }}
                  style={styles.recipeImage}
                  resizeMode="cover"
                />
                <View style={styles.recipeInfo}>
                  <Text style={[styles.recipeName, { color: colors.text.primary }]} numberOfLines={2}>
                    {recipe.name}
                  </Text>
                  <Text style={[styles.recipeCalories, { color: colors.text.secondary }]}>
                    {recipe.calories} cal • {recipe.prepTime}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Meals</Text>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.background.card }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { backgroundColor: accent.primary }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialIcons 
              name={tab.icon as any} 
              size={20} 
              color={activeTab === tab.id ? '#fff' : colors.text.muted} 
            />
            <Text style={[
              styles.tabLabel,
              { color: activeTab === tab.id ? '#fff' : colors.text.muted }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'planner' && renderMealPlanner()}
      {activeTab === 'groceries' && renderGroceries()}
      {activeTab === 'recipes' && renderRecipes()}

      {/* Create Meal Modal */}
      <Modal visible={showCreateMealModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background.primary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Create Meal</Text>
              <TouchableOpacity onPress={() => setShowCreateMealModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Meal Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.card, color: colors.text.primary }]}
                placeholder="e.g., Grilled Chicken Salad"
                placeholderTextColor={colors.text.muted}
                value={newMeal.name}
                onChangeText={(t) => setNewMeal(prev => ({ ...prev, name: t }))}
              />

              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Category</Text>
              <View style={styles.categoryPicker}>
                {MEAL_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryOption,
                      { borderColor: cat.color },
                      newMeal.category === cat.value && { backgroundColor: `${cat.color}20` }
                    ]}
                    onPress={() => setNewMeal(prev => ({ ...prev, category: cat.value }))}
                  >
                    <Text>{cat.icon}</Text>
                    <Text style={[styles.categoryOptionText, { color: colors.text.primary }]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Nutrition Info</Text>
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionInput}>
                  <Text style={[styles.nutritionLabel, { color: colors.text.muted }]}>Calories *</Text>
                  <TextInput
                    style={[styles.smallInput, { backgroundColor: colors.background.card, color: colors.text.primary }]}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={newMeal.calories}
                    onChangeText={(t) => setNewMeal(prev => ({ ...prev, calories: t }))}
                  />
                </View>
                <View style={styles.nutritionInput}>
                  <Text style={[styles.nutritionLabel, { color: colors.text.muted }]}>Protein (g)</Text>
                  <TextInput
                    style={[styles.smallInput, { backgroundColor: colors.background.card, color: colors.text.primary }]}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={newMeal.protein}
                    onChangeText={(t) => setNewMeal(prev => ({ ...prev, protein: t }))}
                  />
                </View>
                <View style={styles.nutritionInput}>
                  <Text style={[styles.nutritionLabel, { color: colors.text.muted }]}>Carbs (g)</Text>
                  <TextInput
                    style={[styles.smallInput, { backgroundColor: colors.background.card, color: colors.text.primary }]}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={newMeal.carbs}
                    onChangeText={(t) => setNewMeal(prev => ({ ...prev, carbs: t }))}
                  />
                </View>
                <View style={styles.nutritionInput}>
                  <Text style={[styles.nutritionLabel, { color: colors.text.muted }]}>Fat (g)</Text>
                  <TextInput
                    style={[styles.smallInput, { backgroundColor: colors.background.card, color: colors.text.primary }]}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={newMeal.fat}
                    onChangeText={(t) => setNewMeal(prev => ({ ...prev, fat: t }))}
                  />
                </View>
                <View style={styles.nutritionInput}>
                  <Text style={[styles.nutritionLabel, { color: colors.text.muted }]}>Sugar (g)</Text>
                  <TextInput
                    style={[styles.smallInput, { backgroundColor: colors.background.card, color: colors.text.primary }]}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={newMeal.sugar}
                    onChangeText={(t) => setNewMeal(prev => ({ ...prev, sugar: t }))}
                  />
                </View>
                <View style={styles.nutritionInput}>
                  <Text style={[styles.nutritionLabel, { color: colors.text.muted }]}>Fiber (g)</Text>
                  <TextInput
                    style={[styles.smallInput, { backgroundColor: colors.background.card, color: colors.text.primary }]}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={newMeal.fiber}
                    onChangeText={(t) => setNewMeal(prev => ({ ...prev, fiber: t }))}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.createBtn, { backgroundColor: accent.primary }]}
                onPress={handleCreateMeal}
              >
                <Text style={styles.createBtnText}>Add to Meal Plan</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Grocery Modal */}
      <Modal visible={showAddGroceryModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.smallModalContent, { backgroundColor: colors.background.primary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Add Grocery Item</Text>
              <TouchableOpacity onPress={() => setShowAddGroceryModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.input, { backgroundColor: colors.background.card, color: colors.text.primary }]}
              placeholder="Item name"
              placeholderTextColor={colors.text.muted}
              value={newGroceryItem.name}
              onChangeText={(t) => setNewGroceryItem(prev => ({ ...prev, name: t }))}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background.card, color: colors.text.primary }]}
              placeholder="Quantity (e.g., 2 lbs, 1 dozen)"
              placeholderTextColor={colors.text.muted}
              value={newGroceryItem.quantity}
              onChangeText={(t) => setNewGroceryItem(prev => ({ ...prev, quantity: t }))}
            />
            
            <TouchableOpacity 
              style={[styles.createBtn, { backgroundColor: accent.primary }]}
              onPress={handleAddGroceryItem}
            >
              <Text style={styles.createBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recipe Generator Modal */}
      <Modal visible={showRecipeGeneratorModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.smallModalContent, { backgroundColor: colors.background.primary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>AI Recipe Generator</Text>
              <TouchableOpacity onPress={() => setShowRecipeGeneratorModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.recipePromptLabel, { color: colors.text.secondary }]}>
              Describe what you want to cook:
            </Text>
            <TextInput
              style={[styles.recipePromptInput, { backgroundColor: colors.background.card, color: colors.text.primary }]}
              placeholder="e.g., High protein chicken dinner under 500 calories"
              placeholderTextColor={colors.text.muted}
              value={recipePrompt}
              onChangeText={setRecipePrompt}
              multiline
            />
            
            <TouchableOpacity 
              style={[styles.createBtn, { backgroundColor: accent.primary }]}
              onPress={generateRecipe}
              disabled={generatingRecipe}
            >
              {generatingRecipe ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>Generate Recipe</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal visible={showRecipeModal} animationType="slide">
        <SafeAreaView style={[styles.recipeModalContainer, { backgroundColor: colors.background.primary }]}>
          <ScrollView>
            {selectedRecipe && (
              <>
                <Image 
                  source={{ uri: selectedRecipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600' }}
                  style={styles.recipeDetailImage}
                  resizeMode="cover"
                />
                <TouchableOpacity 
                  style={styles.closeRecipeBtn}
                  onPress={() => setShowRecipeModal(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={styles.recipeDetailContent}>
                  <Text style={[styles.recipeDetailName, { color: colors.text.primary }]}>{selectedRecipe.name}</Text>
                  
                  <View style={styles.recipeNutritionRow}>
                    <View style={styles.recipeNutritionItem}>
                      <Text style={styles.recipeNutritionValue}>{selectedRecipe.calories}</Text>
                      <Text style={styles.recipeNutritionLabel}>Calories</Text>
                    </View>
                    <View style={styles.recipeNutritionItem}>
                      <Text style={styles.recipeNutritionValue}>{selectedRecipe.protein}g</Text>
                      <Text style={styles.recipeNutritionLabel}>Protein</Text>
                    </View>
                    <View style={styles.recipeNutritionItem}>
                      <Text style={styles.recipeNutritionValue}>{selectedRecipe.carbs}g</Text>
                      <Text style={styles.recipeNutritionLabel}>Carbs</Text>
                    </View>
                    <View style={styles.recipeNutritionItem}>
                      <Text style={styles.recipeNutritionValue}>{selectedRecipe.fat}g</Text>
                      <Text style={styles.recipeNutritionLabel}>Fat</Text>
                    </View>
                  </View>

                  <Text style={[styles.recipeDetailPrepTime, { color: colors.text.secondary }]}>
                    ⏱️ {selectedRecipe.prepTime}
                  </Text>

                  <Text style={[styles.recipeSectionTitle, { color: colors.text.primary }]}>Ingredients</Text>
                  {selectedRecipe.ingredients?.map((ing, i) => (
                    <Text key={i} style={[styles.ingredientItem, { color: colors.text.secondary }]}>• {ing}</Text>
                  ))}

                  <Text style={[styles.recipeSectionTitle, { color: colors.text.primary }]}>Instructions</Text>
                  {selectedRecipe.instructions?.map((step, i) => (
                    <View key={i} style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.instructionText, { color: colors.text.secondary }]}>{step}</Text>
                    </View>
                  ))}

                  <TouchableOpacity 
                    style={[styles.cookRecipeBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => cookFromRecipe(selectedRecipe)}
                  >
                    <MaterialCommunityIcons name="pot-steam" size={24} color="#fff" />
                    <Text style={styles.cookRecipeBtnText}>Cook & Log This Meal</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  
  // Tab Bar
  tabBar: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  
  tabContent: { flex: 1, padding: 16 },
  
  // Date Header
  dateHeader: { marginBottom: 16 },
  dateTitle: { fontSize: 20, fontWeight: '700' },
  dateCalories: { fontSize: 14, marginTop: 4 },
  
  // Quick Actions
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  quickActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  quickActionText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  
  // Scan Result
  scanResultCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  scanImage: { width: '100%', height: 200 },
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  analyzingText: { color: '#fff', marginTop: 8, fontSize: 16 },
  scanResultContent: { padding: 16 },
  foodName: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem: { alignItems: 'center' },
  macroValue: { fontSize: 18, fontWeight: '700', color: '#7C3AED' },
  macroLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  resetBtn: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#EF444420', borderRadius: 20 },
  resetBtnText: { color: '#EF4444', fontWeight: '600' },
  
  // Meal Category
  mealCategorySection: { marginBottom: 20 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  categoryIcon: { fontSize: 20, marginRight: 8 },
  categoryTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  addMealBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  
  emptyMealCard: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  emptyMealText: { fontSize: 14 },
  
  mealCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8 },
  mealCardCooked: { opacity: 0.7 },
  mealCardContent: { flex: 1 },
  mealName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  mealCalories: { fontSize: 13 },
  mealActions: { flexDirection: 'row', gap: 8 },
  cookBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  cookedBadge: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  deleteMealBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EF444410' },
  
  // Daily Summary
  dailySummary: { padding: 16, borderRadius: 16, marginTop: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700' },
  summaryLabel: { fontSize: 12, marginTop: 4 },
  
  // Groceries
  groceryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  groceryTitle: { fontSize: 20, fontWeight: '700' },
  groceryActions: { flexDirection: 'row', gap: 8 },
  groceryActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  aiGenerateBtn: { marginBottom: 20, borderRadius: 12, overflow: 'hidden' },
  aiGenerateGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
  aiGenerateText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  emptyGroceries: { alignItems: 'center', paddingVertical: 40 },
  emptyGroceriesTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyGroceriesText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  
  groceryCategory: { marginBottom: 20 },
  groceryCategoryTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  groceryItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#7C3AED', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#7C3AED' },
  groceryItemText: { fontSize: 15, flex: 1 },
  groceryItemChecked: { textDecorationLine: 'line-through', opacity: 0.5 },
  
  // Recipes
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyRecipes: { alignItems: 'center', paddingVertical: 40 },
  emptyRecipesTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyRecipesText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  
  recipesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  recipeCard: { width: (SCREEN_WIDTH - 44) / 2, borderRadius: 12, overflow: 'hidden' },
  recipeImage: { width: '100%', height: 120 },
  recipeInfo: { padding: 12 },
  recipeName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  recipeCalories: { fontSize: 12 },
  
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  smallModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalBody: { maxHeight: 500 },
  
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 8 },
  
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  categoryOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6 },
  categoryOptionText: { fontSize: 13, fontWeight: '500' },
  
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nutritionInput: { width: '31%' },
  nutritionLabel: { fontSize: 11, marginBottom: 4 },
  smallInput: { borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'center' },
  
  createBtn: { marginTop: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  recipePromptLabel: { fontSize: 14, marginBottom: 12 },
  recipePromptInput: { borderRadius: 12, padding: 14, fontSize: 16, height: 100, textAlignVertical: 'top' },
  
  // Recipe Modal
  recipeModalContainer: { flex: 1 },
  recipeDetailImage: { width: '100%', height: 250 },
  closeRecipeBtn: { position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  recipeDetailContent: { padding: 20 },
  recipeDetailName: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  recipeNutritionRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, paddingVertical: 16, backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 12 },
  recipeNutritionItem: { alignItems: 'center' },
  recipeNutritionValue: { fontSize: 20, fontWeight: '700', color: '#7C3AED' },
  recipeNutritionLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  recipeDetailPrepTime: { fontSize: 14, marginBottom: 20 },
  recipeSectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  ingredientItem: { fontSize: 15, marginBottom: 6, lineHeight: 22 },
  instructionItem: { flexDirection: 'row', marginBottom: 16 },
  instructionNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  instructionNumberText: { color: '#fff', fontWeight: '700' },
  instructionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  cookRecipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, marginTop: 20, gap: 10 },
  cookRecipeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

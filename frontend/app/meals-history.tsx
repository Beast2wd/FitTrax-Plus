import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useUserStore } from '../stores/userStore';
import { useThemeStore } from '../stores/themeStore';
import { foodAPI } from '../services/api';
import { format } from 'date-fns';
import { router } from 'expo-router';

export default function MealsHistoryScreen() {
  const { userId } = useUserStore();
  const { theme } = useThemeStore();
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [editedNutrition, setEditedNutrition] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });

  const colors = theme.colors;
  const accent = theme.accentColors;

  useEffect(() => {
    if (userId) {
      loadMeals();
    }
  }, [userId]);

  const loadMeals = async () => {
    try {
      const data = await foodAPI.getMeals(userId!, 30);
      setMeals(data.meals || []);
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = (mealId: string) => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await foodAPI.deleteMeal(mealId);
              setMeals(meals.filter((m) => m.meal_id !== mealId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete meal');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (meal: any) => {
    setSelectedMeal(meal);
    setEditedNutrition({
      calories: Math.round(meal.calories || 0).toString(),
      protein: Math.round(meal.protein || 0).toString(),
      carbs: Math.round(meal.carbs || 0).toString(),
      fat: Math.round(meal.fat || 0).toString(),
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMeal) return;

    const updatedValues = {
      calories: parseFloat(editedNutrition.calories) || 0,
      protein: parseFloat(editedNutrition.protein) || 0,
      carbs: parseFloat(editedNutrition.carbs) || 0,
      fat: parseFloat(editedNutrition.fat) || 0,
    };

    // Update local state immediately
    setMeals(meals.map(m => 
      m.meal_id === selectedMeal.meal_id
        ? { ...m, ...updatedValues }
        : m
    ));

    // Close modal immediately
    setEditModalVisible(false);
    setSelectedMeal(null);

    // Then try to sync with server
    try {
      await foodAPI.updateMeal(selectedMeal.meal_id, updatedValues);
    } catch (error: any) {
      console.error('Update error:', error);
      // Values already updated locally, just log the error
    }
  };
      Alert.alert('Error', 'Failed to update meal');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMeals();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'breakfast': return '#F59E0B';
      case 'lunch': return '#10B981';
      case 'dinner': return '#8B5CF6';
      case 'snack': return '#EC4899';
      default: return colors.text.secondary;
    }
  };

  const filteredMeals = filter === 'all'
    ? meals
    : meals.filter((m) => m.meal_category === filter);

  const renderMeal = ({ item }: { item: any }) => (
    <View style={[styles.mealCard, { backgroundColor: colors.background.card }]}>
      {item.image_base64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }}
          style={styles.mealImage}
        />
      )}
      <View style={styles.mealContent}>
        <View style={styles.mealHeader}>
          <Text style={[styles.mealName, { color: colors.text.primary }]}>{item.food_name}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.meal_category) + '20' }]}>
            <Text style={[styles.categoryText, { color: getCategoryColor(item.meal_category) }]}>
              {item.meal_category}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.nutritionRow}
          onPress={() => handleEdit(item)}
          activeOpacity={0.7}
        >
          <View style={styles.nutritionItem}>
            <Ionicons name="flame" size={16} color="#EF4444" />
            <Text style={[styles.nutritionText, { color: colors.text.primary }]}>{Math.round(item.calories)} cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <MaterialIcons name="fitness-center" size={16} color={accent.primary} />
            <Text style={[styles.nutritionText, { color: colors.text.primary }]}>{Math.round(item.protein)}g protein</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.nutritionRow}>
          <View style={styles.nutritionItem}>
            <Text style={[styles.macroLabel, { color: colors.text.muted }]}>Carbs:</Text>
            <Text style={[styles.nutritionText, { color: colors.text.primary }]}>{Math.round(item.carbs)}g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={[styles.macroLabel, { color: colors.text.muted }]}>Fat:</Text>
            <Text style={[styles.nutritionText, { color: colors.text.primary }]}>{Math.round(item.fat)}g</Text>
          </View>
        </View>

        <View style={[styles.mealFooter, { borderTopColor: colors.border.primary }]}>
          <Text style={[styles.mealTime, { color: colors.text.muted }]}>
            {format(new Date(item.timestamp), 'MMM d, yyyy • h:mm a')}
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
              <Ionicons name="pencil" size={18} color={accent.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.meal_id)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['bottom']}>
      {/* Header with Camera Icon */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Meal History</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{filteredMeals.length} meals logged</Text>
        </View>
        <TouchableOpacity 
          style={[styles.cameraButton, { backgroundColor: accent.primary }]}
          onPress={() => router.push('/scan')}
        >
          <Ionicons name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {['all', 'breakfast', 'lunch', 'snack', 'dinner'].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterButton,
              { backgroundColor: filter === cat ? accent.primary : colors.background.card, borderColor: filter === cat ? accent.primary : colors.border.primary },
            ]}
            onPress={() => setFilter(cat)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === cat ? '#fff' : colors.text.secondary },
              ]}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredMeals}
        renderItem={renderMeal}
        keyExtractor={(item) => item.meal_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={accent.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={64} color={colors.text.muted} />
            <Text style={[styles.emptyText, { color: colors.text.primary }]}>No meals logged yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
              Start scanning your food to track nutrition
            </Text>
            <TouchableOpacity 
              style={[styles.scanButton, { backgroundColor: accent.primary }]}
              onPress={() => router.push('/scan')}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.scanButtonText}>Scan Food</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Edit Modal */}
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
          <View style={[styles.editModalContainer, { backgroundColor: colors.background.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.modalCancel, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Edit Nutrition</Text>
              <TouchableOpacity onPress={handleSaveEdit}>
                <Text style={[styles.modalDone, { color: accent.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>

            {selectedMeal && (
              <Text style={[styles.editMealName, { color: colors.text.primary }]}>
                {selectedMeal.food_name}
              </Text>
            )}

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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  mealCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  mealImage: {
    width: '100%',
    height: 180,
  },
  mealContent: {
    padding: 16,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mealName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nutritionText: {
    fontSize: 14,
  },
  macroLabel: {
    fontSize: 14,
  },
  mealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  mealTime: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
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
  editMealName: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    padding: 16,
    paddingBottom: 0,
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

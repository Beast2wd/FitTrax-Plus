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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { foodAPI } from '../services/api';
import { format } from 'date-fns';

export default function MealsHistoryScreen() {
  const { userId } = useUserStore();
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (userId) {
      loadMeals();
    }
  }, [userId]);

  const loadMeals = async () => {
    try {
      const data = await foodAPI.getMeals(userId!, 30); // Last 30 days
      setMeals(data.meals || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load meals');
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
              Alert.alert('Success', 'Meal deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete meal');
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMeals();
  };

  const filteredMeals = filter === 'all'
    ? meals
    : meals.filter((m) => m.meal_category === filter);

  const renderMeal = ({ item }: { item: any }) => (
    <View style={styles.mealCard}>
      <Image
        source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }}
        style={styles.mealImage}
      />
      <View style={styles.mealContent}>
        <View style={styles.mealHeader}>
          <Text style={styles.mealName}>{item.food_name}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.meal_category) + '20' }]}>
            <Text style={[styles.categoryText, { color: getCategoryColor(item.meal_category) }]}>
              {item.meal_category}
            </Text>
          </View>
        </View>

        <View style={styles.nutritionRow}>
          <View style={styles.nutritionItem}>
            <Ionicons name="flame" size={16} color={Colors.status.error} />
            <Text style={styles.nutritionText}>{Math.round(item.calories)} cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <MaterialIcons name="fitness-center" size={16} color={Colors.brand.primary} />
            <Text style={styles.nutritionText}>{Math.round(item.protein)}g protein</Text>
          </View>
        </View>

        <View style={styles.nutritionRow}>
          <View style={styles.nutritionItem}>
            <Text style={styles.macroLabel}>Carbs:</Text>
            <Text style={styles.nutritionText}>{Math.round(item.carbs)}g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.macroLabel}>Fat:</Text>
            <Text style={styles.nutritionText}>{Math.round(item.fat)}g</Text>
          </View>
        </View>

        <View style={styles.mealFooter}>
          <Text style={styles.mealTime}>
            {format(new Date(item.timestamp), 'MMM d, yyyy • h:mm a')}
          </Text>
          <TouchableOpacity onPress={() => handleDelete(item.meal_id)}>
            <Ionicons name="trash-outline" size={20} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'breakfast': return '#F59E0B';
      case 'lunch': return '#10B981';
      case 'dinner': return '#8B5CF6';
      case 'snack': return '#EC4899';
      default: return Colors.text.secondary;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal History</Text>
        <Text style={styles.subtitle}>{filteredMeals.length} meals logged</Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterButton,
              filter === cat && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(cat)}
          >
            <Text
              style={[
                styles.filterText,
                filter === cat && styles.filterTextActive,
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={64} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No meals logged yet</Text>
            <Text style={styles.emptySubtext}>Start scanning your food to track nutrition</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterButtonActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  filterTextActive: {
    color: Colors.text.white,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  mealCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mealImage: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.background.light,
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
    color: Colors.text.primary,
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
    color: Colors.text.primary,
  },
  macroLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  mealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  mealTime: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
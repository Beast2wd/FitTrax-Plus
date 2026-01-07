import React, { useState, useEffect, useMemo } from 'react';
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
  ScrollView,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore } from '../stores/userStore';
import { useThemeStore } from '../stores/themeStore';
import { foodAPI } from '../services/api';
import { format, isToday, isYesterday, parseISO, startOfDay, isSameDay } from 'date-fns';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface DailyLog {
  date: string;
  dateLabel: string;
  meals: any[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealCount: number;
  };
}

export default function MealsHistoryScreen() {
  const { userId } = useUserStore();
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'all'>('daily');
  const [filter, setFilter] = useState<string>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [selectedDayModal, setSelectedDayModal] = useState<DailyLog | null>(null);
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
      const data = await foodAPI.getMeals(userId!, 60); // Load 60 days of history
      setMeals(data.meals || []);
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Group meals by date
  const dailyLogs = useMemo((): DailyLog[] => {
    const grouped: { [key: string]: any[] } = {};
    
    meals.forEach(meal => {
      const date = format(new Date(meal.timestamp), 'yyyy-MM-dd');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(meal);
    });

    return Object.entries(grouped)
      .map(([date, dayMeals]) => {
        const dateObj = parseISO(date);
        let dateLabel = format(dateObj, 'EEEE, MMMM d');
        if (isToday(dateObj)) {
          dateLabel = 'Today';
        } else if (isYesterday(dateObj)) {
          dateLabel = 'Yesterday';
        }

        const totals = dayMeals.reduce((acc, meal) => ({
          calories: acc.calories + (meal.calories || 0),
          protein: acc.protein + (meal.protein || 0),
          carbs: acc.carbs + (meal.carbs || 0),
          fat: acc.fat + (meal.fat || 0),
          mealCount: acc.mealCount + 1,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });

        return {
          date,
          dateLabel,
          meals: dayMeals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
          totals,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [meals]);

  const handleDelete = (mealId: string, fromDayModal = false) => {
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
              
              // Update day modal if open
              if (fromDayModal && selectedDayModal) {
                const updatedMeals = selectedDayModal.meals.filter(m => m.meal_id !== mealId);
                if (updatedMeals.length === 0) {
                  setSelectedDayModal(null);
                } else {
                  const totals = updatedMeals.reduce((acc, meal) => ({
                    calories: acc.calories + (meal.calories || 0),
                    protein: acc.protein + (meal.protein || 0),
                    carbs: acc.carbs + (meal.carbs || 0),
                    fat: acc.fat + (meal.fat || 0),
                    mealCount: acc.mealCount + 1,
                  }), { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
                  
                  setSelectedDayModal({
                    ...selectedDayModal,
                    meals: updatedMeals,
                    totals,
                  });
                }
              }
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

    // Update day modal if open
    if (selectedDayModal) {
      const updatedMeals = selectedDayModal.meals.map(m =>
        m.meal_id === selectedMeal.meal_id ? { ...m, ...updatedValues } : m
      );
      const totals = updatedMeals.reduce((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fat: acc.fat + (meal.fat || 0),
        mealCount: acc.mealCount + 1,
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
      
      setSelectedDayModal({
        ...selectedDayModal,
        meals: updatedMeals,
        totals,
      });
    }

    setEditModalVisible(false);
    setSelectedMeal(null);

    try {
      await foodAPI.updateMeal(selectedMeal.meal_id, updatedValues);
    } catch (error: any) {
      console.error('Update error:', error);
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'breakfast': return 'sunny';
      case 'lunch': return 'restaurant';
      case 'dinner': return 'moon';
      case 'snack': return 'cafe';
      default: return 'fast-food';
    }
  };

  const filteredMeals = filter === 'all'
    ? meals
    : meals.filter((m) => m.meal_category === filter);

  const renderDailyLogCard = ({ item }: { item: DailyLog }) => {
    const isComplete = !isToday(parseISO(item.date));
    
    return (
      <TouchableOpacity 
        style={[styles.dailyCard, { backgroundColor: colors.background.card }]}
        onPress={() => setSelectedDayModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.dailyHeader}>
          <View style={styles.dailyDateContainer}>
            <View style={[styles.calendarIcon, { backgroundColor: isComplete ? accent.primary + '20' : colors.background.elevated }]}>
              <Ionicons 
                name={isComplete ? "checkmark-circle" : "calendar"} 
                size={24} 
                color={isComplete ? accent.primary : colors.text.secondary} 
              />
            </View>
            <View>
              <Text style={[styles.dailyDateLabel, { color: colors.text.primary }]}>
                {item.dateLabel}
              </Text>
              <Text style={[styles.dailyMealCount, { color: colors.text.muted }]}>
                {item.totals.mealCount} meal{item.totals.mealCount !== 1 ? 's' : ''} logged
              </Text>
            </View>
          </View>
          {isComplete && (
            <View style={[styles.completeBadge, { backgroundColor: '#10B98120' }]}>
              <Text style={[styles.completeBadgeText, { color: '#10B981' }]}>Complete</Text>
            </View>
          )}
        </View>

        {/* Daily Totals */}
        <View style={[styles.dailyTotals, { borderTopColor: colors.border.primary }]}>
          <View style={styles.dailyTotalItem}>
            <Ionicons name="flame" size={18} color="#EF4444" />
            <Text style={[styles.dailyTotalValue, { color: colors.text.primary }]}>
              {Math.round(item.totals.calories)}
            </Text>
            <Text style={[styles.dailyTotalLabel, { color: colors.text.muted }]}>cal</Text>
          </View>
          <View style={[styles.dailyTotalDivider, { backgroundColor: colors.border.primary }]} />
          <View style={styles.dailyTotalItem}>
            <MaterialIcons name="fitness-center" size={18} color={accent.primary} />
            <Text style={[styles.dailyTotalValue, { color: colors.text.primary }]}>
              {Math.round(item.totals.protein)}g
            </Text>
            <Text style={[styles.dailyTotalLabel, { color: colors.text.muted }]}>protein</Text>
          </View>
          <View style={[styles.dailyTotalDivider, { backgroundColor: colors.border.primary }]} />
          <View style={styles.dailyTotalItem}>
            <MaterialCommunityIcons name="bread-slice" size={18} color="#F59E0B" />
            <Text style={[styles.dailyTotalValue, { color: colors.text.primary }]}>
              {Math.round(item.totals.carbs)}g
            </Text>
            <Text style={[styles.dailyTotalLabel, { color: colors.text.muted }]}>carbs</Text>
          </View>
          <View style={[styles.dailyTotalDivider, { backgroundColor: colors.border.primary }]} />
          <View style={styles.dailyTotalItem}>
            <MaterialCommunityIcons name="water" size={18} color="#06B6D4" />
            <Text style={[styles.dailyTotalValue, { color: colors.text.primary }]}>
              {Math.round(item.totals.fat)}g
            </Text>
            <Text style={[styles.dailyTotalLabel, { color: colors.text.muted }]}>fat</Text>
          </View>
        </View>

        {/* Meal Preview Icons */}
        <View style={styles.mealPreview}>
          {['breakfast', 'lunch', 'snack', 'dinner'].map((cat) => {
            const catMeals = item.meals.filter(m => m.meal_category === cat);
            const hasCategory = catMeals.length > 0;
            return (
              <View 
                key={cat} 
                style={[
                  styles.mealPreviewItem, 
                  { 
                    backgroundColor: hasCategory ? getCategoryColor(cat) + '20' : colors.background.elevated,
                    opacity: hasCategory ? 1 : 0.4
                  }
                ]}
              >
                <Ionicons 
                  name={getCategoryIcon(cat) as any} 
                  size={16} 
                  color={hasCategory ? getCategoryColor(cat) : colors.text.muted} 
                />
                {hasCategory && (
                  <Text style={[styles.mealPreviewCount, { color: getCategoryColor(cat) }]}>
                    {catMeals.length}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.viewDetailsRow}>
          <Text style={[styles.viewDetailsText, { color: accent.primary }]}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={accent.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderMealInDay = (meal: any, isInModal = false) => (
    <View 
      key={meal.meal_id}
      style={[styles.mealInDayCard, { backgroundColor: isInModal ? colors.background.secondary : colors.background.card }]}
    >
      <View style={styles.mealInDayHeader}>
        <View style={[styles.mealCategoryIcon, { backgroundColor: getCategoryColor(meal.meal_category) + '20' }]}>
          <Ionicons name={getCategoryIcon(meal.meal_category) as any} size={20} color={getCategoryColor(meal.meal_category)} />
        </View>
        <View style={styles.mealInDayInfo}>
          <Text style={[styles.mealInDayName, { color: colors.text.primary }]} numberOfLines={1}>
            {meal.food_name}
          </Text>
          <Text style={[styles.mealInDayTime, { color: colors.text.muted }]}>
            {format(new Date(meal.timestamp), 'h:mm a')} • {meal.meal_category}
          </Text>
        </View>
        <View style={styles.mealInDayActions}>
          <TouchableOpacity onPress={() => handleEdit(meal)} style={styles.mealActionBtn}>
            <Ionicons name="pencil" size={18} color={accent.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(meal.meal_id, isInModal)} style={styles.mealActionBtn}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {meal.image_base64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${meal.image_base64}` }}
          style={styles.mealInDayImage}
        />
      )}

      <View style={styles.mealInDayNutrition}>
        <View style={styles.nutritionChip}>
          <Text style={[styles.nutritionChipValue, { color: '#EF4444' }]}>{Math.round(meal.calories)}</Text>
          <Text style={[styles.nutritionChipLabel, { color: colors.text.muted }]}>cal</Text>
        </View>
        <View style={styles.nutritionChip}>
          <Text style={[styles.nutritionChipValue, { color: accent.primary }]}>{Math.round(meal.protein)}g</Text>
          <Text style={[styles.nutritionChipLabel, { color: colors.text.muted }]}>protein</Text>
        </View>
        <View style={styles.nutritionChip}>
          <Text style={[styles.nutritionChipValue, { color: '#F59E0B' }]}>{Math.round(meal.carbs)}g</Text>
          <Text style={[styles.nutritionChipLabel, { color: colors.text.muted }]}>carbs</Text>
        </View>
        <View style={styles.nutritionChip}>
          <Text style={[styles.nutritionChipValue, { color: '#06B6D4' }]}>{Math.round(meal.fat)}g</Text>
          <Text style={[styles.nutritionChipLabel, { color: colors.text.muted }]}>fat</Text>
        </View>
      </View>
    </View>
  );

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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Meal History</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {dailyLogs.length} day{dailyLogs.length !== 1 ? 's' : ''} logged
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.cameraButton, { backgroundColor: accent.primary }]}
          onPress={() => router.push('/scan')}
        >
          <Ionicons name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[
            styles.viewToggleBtn,
            viewMode === 'daily' && { backgroundColor: accent.primary },
            viewMode !== 'daily' && { backgroundColor: colors.background.card }
          ]}
          onPress={() => setViewMode('daily')}
        >
          <Ionicons 
            name="calendar" 
            size={18} 
            color={viewMode === 'daily' ? '#fff' : colors.text.secondary} 
          />
          <Text style={[
            styles.viewToggleText,
            { color: viewMode === 'daily' ? '#fff' : colors.text.secondary }
          ]}>
            Daily Logs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewToggleBtn,
            viewMode === 'all' && { backgroundColor: accent.primary },
            viewMode !== 'all' && { backgroundColor: colors.background.card }
          ]}
          onPress={() => setViewMode('all')}
        >
          <Ionicons 
            name="list" 
            size={18} 
            color={viewMode === 'all' ? '#fff' : colors.text.secondary} 
          />
          <Text style={[
            styles.viewToggleText,
            { color: viewMode === 'all' ? '#fff' : colors.text.secondary }
          ]}>
            All Meals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Buttons (only show in "all" view) */}
      {viewMode === 'all' && (
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
      )}

      {viewMode === 'daily' ? (
        <FlatList
          data={dailyLogs}
          renderItem={renderDailyLogCard}
          keyExtractor={(item) => item.date}
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
      ) : (
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
      )}

      {/* Day Detail Modal */}
      <Modal
        visible={!!selectedDayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDayModal(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDayModal(null)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={[styles.dayDetailModal, { backgroundColor: colors.background.primary }]}
          >
            {selectedDayModal && (
              <>
                {/* Modal Header */}
                <View style={[styles.dayModalHeader, { borderBottomColor: colors.border.primary }]}>
                  <TouchableOpacity onPress={() => setSelectedDayModal(null)}>
                    <Ionicons name="close" size={28} color={colors.text.primary} />
                  </TouchableOpacity>
                  <View style={styles.dayModalTitleContainer}>
                    <Text style={[styles.dayModalTitle, { color: colors.text.primary }]}>
                      {selectedDayModal.dateLabel}
                    </Text>
                    <Text style={[styles.dayModalSubtitle, { color: colors.text.muted }]}>
                      {format(parseISO(selectedDayModal.date), 'MMMM d, yyyy')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/scan')}>
                    <Ionicons name="add-circle" size={28} color={accent.primary} />
                  </TouchableOpacity>
                </View>

                {/* Day Summary */}
                <View style={[styles.daySummary, { backgroundColor: colors.background.card }]}>
                  <Text style={[styles.daySummaryTitle, { color: colors.text.primary }]}>Daily Totals</Text>
                  <View style={styles.daySummaryGrid}>
                    <View style={styles.daySummaryItem}>
                      <Ionicons name="flame" size={24} color="#EF4444" />
                      <Text style={[styles.daySummaryValue, { color: colors.text.primary }]}>
                        {Math.round(selectedDayModal.totals.calories)}
                      </Text>
                      <Text style={[styles.daySummaryLabel, { color: colors.text.muted }]}>Calories</Text>
                    </View>
                    <View style={styles.daySummaryItem}>
                      <MaterialIcons name="fitness-center" size={24} color={accent.primary} />
                      <Text style={[styles.daySummaryValue, { color: colors.text.primary }]}>
                        {Math.round(selectedDayModal.totals.protein)}g
                      </Text>
                      <Text style={[styles.daySummaryLabel, { color: colors.text.muted }]}>Protein</Text>
                    </View>
                    <View style={styles.daySummaryItem}>
                      <MaterialCommunityIcons name="bread-slice" size={24} color="#F59E0B" />
                      <Text style={[styles.daySummaryValue, { color: colors.text.primary }]}>
                        {Math.round(selectedDayModal.totals.carbs)}g
                      </Text>
                      <Text style={[styles.daySummaryLabel, { color: colors.text.muted }]}>Carbs</Text>
                    </View>
                    <View style={styles.daySummaryItem}>
                      <MaterialCommunityIcons name="water" size={24} color="#06B6D4" />
                      <Text style={[styles.daySummaryValue, { color: colors.text.primary }]}>
                        {Math.round(selectedDayModal.totals.fat)}g
                      </Text>
                      <Text style={[styles.daySummaryLabel, { color: colors.text.muted }]}>Fat</Text>
                    </View>
                  </View>
                </View>

                {/* Meals List */}
                <ScrollView style={styles.dayMealsList}>
                  <Text style={[styles.mealsListTitle, { color: colors.text.primary }]}>
                    Meals ({selectedDayModal.totals.mealCount})
                  </Text>
                  {selectedDayModal.meals.map(meal => renderMealInDay(meal, true))}
                  <View style={{ height: 40 }} />
                </ScrollView>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  viewToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    paddingTop: 4,
  },
  // Daily Log Card Styles
  dailyCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dailyDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dailyDateLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  dailyMealCount: {
    fontSize: 13,
    marginTop: 2,
  },
  completeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dailyTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  dailyTotalItem: {
    alignItems: 'center',
    flex: 1,
  },
  dailyTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  dailyTotalLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  dailyTotalDivider: {
    width: 1,
    height: '100%',
  },
  mealPreview: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  mealPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mealPreviewCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Meal in day card styles
  mealInDayCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  mealInDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealInDayInfo: {
    flex: 1,
  },
  mealInDayName: {
    fontSize: 16,
    fontWeight: '600',
  },
  mealInDayTime: {
    fontSize: 13,
    marginTop: 2,
  },
  mealInDayActions: {
    flexDirection: 'row',
    gap: 8,
  },
  mealActionBtn: {
    padding: 6,
  },
  mealInDayImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginTop: 12,
  },
  mealInDayNutrition: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  nutritionChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  nutritionChipValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  nutritionChipLabel: {
    fontSize: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dayDetailModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
  },
  dayModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  dayModalTitleContainer: {
    alignItems: 'center',
  },
  dayModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  dayModalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  daySummary: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  daySummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  daySummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  daySummaryItem: {
    alignItems: 'center',
  },
  daySummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  daySummaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  dayMealsList: {
    paddingHorizontal: 16,
  },
  mealsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  // Old meal card styles (for all view)
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

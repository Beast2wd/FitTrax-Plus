import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import { plansAPI } from '../services/api';

export default function PlansScreen() {
  const { userId } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await plansAPI.getWorkoutPlans();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'Failed to load workout plans');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPlan = async (planId: string) => {
    if (!userId) {
      Alert.alert('Error', 'Please complete your profile first');
      return;
    }

    try {
      const userPlanData = {
        user_plan_id: `userplan_${Date.now()}`,
        user_id: userId,
        plan_id: planId,
        start_date: new Date().toISOString().split('T')[0],
        current_day: 1,
        completed_days: [],
        status: 'active',
      };

      await plansAPI.startPlan(userPlanData);
      Alert.alert('Success', 'Workout plan started! Check your schedule.');
    } catch (error) {
      Alert.alert('Error', 'Failed to start plan');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return Colors.status.success;
      case 'intermediate':
        return Colors.status.warning;
      case 'advanced':
        return Colors.status.error;
      default:
        return Colors.text.secondary;
    }
  };

  const renderPlanCard = ({ item }: { item: any }) => (
    <View style={styles.planCard}>
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{item.name}</Text>
        <View style={[styles.levelBadge, { backgroundColor: getLevelColor(item.level) + '20' }]}>
          <Text style={[styles.levelText, { color: getLevelColor(item.level) }]}>
            {item.level.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.planDescription}>{item.description}</Text>
      
      <View style={styles.planMeta}>
        <View style={styles.metaItem}>
          <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
          <Text style={styles.metaText}>{item.duration_weeks} weeks</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialIcons name="fitness-center" size={16} color={Colors.text.secondary} />
          <Text style={styles.metaText}>{item.type}</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialIcons name="flag" size={16} color={Colors.text.secondary} />
          <Text style={styles.metaText}>{item.goal.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.planFooter}>
        <Text style={styles.daysCount}>{item.days?.length || 0} workout days</Text>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => handleStartPlan(item.plan_id)}
        >
          <Text style={styles.startButtonText}>Start Plan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={plans}
        renderItem={renderPlanCard}
        keyExtractor={(item) => item.plan_id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.header}>Choose Your Workout Plan</Text>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No workout plans available</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  listContent: {
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 20,
  },
  planCard: {
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
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '700',
  },
  planDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  planMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textTransform: 'capitalize',
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  daysCount: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  startButton: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startButtonText: {
    color: Colors.text.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});

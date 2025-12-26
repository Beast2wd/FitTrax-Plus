import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function BadgesScreen() {
  const { userId } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [badgesData, setBadgesData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [checkingBadges, setCheckingBadges] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [badgesRes, leaderboardRes] = await Promise.all([
        userId ? axios.get(`${API_URL}/api/gamification/user-badges/${userId}`) : null,
        axios.get(`${API_URL}/api/gamification/leaderboard?limit=10`)
      ]);
      
      if (badgesRes) setBadgesData(badgesRes.data);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const checkForNewBadges = async () => {
    if (!userId) return;
    
    setCheckingBadges(true);
    try {
      const response = await axios.post(`${API_URL}/api/gamification/check-badges/${userId}`);
      if (response.data.new_badges_awarded?.length > 0) {
        // Show badge earned animation/notification
        loadData();
      }
    } catch (error) {
      console.error('Error checking badges:', error);
    } finally {
      setCheckingBadges(false);
    }
  };

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
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Points Summary */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.pointsCard}
        >
          <Text style={styles.pointsLabel}>Total Points</Text>
          <Text style={styles.pointsValue}>{badgesData?.total_points || 0}</Text>
          <View style={styles.badgeProgress}>
            <Text style={styles.badgeProgressText}>
              {badgesData?.badges_earned || 0} / {badgesData?.badges_total || 0} Badges Earned
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.checkButton}
            onPress={checkForNewBadges}
            disabled={checkingBadges}
          >
            {checkingBadges ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.checkButtonText}>Check for New Badges</Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>

        {/* Badges Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Achievements</Text>
          <View style={styles.badgesGrid}>
            {badgesData?.badges?.map((badge: any) => (
              <View 
                key={badge.id}
                style={[
                  styles.badgeCard,
                  !badge.earned && styles.badgeCardLocked
                ]}
              >
                <View style={[
                  styles.badgeIconContainer,
                  badge.earned ? styles.badgeIconEarned : styles.badgeIconLocked
                ]}>
                  <Text style={styles.badgeEmoji}>{badge.icon}</Text>
                </View>
                <Text style={[
                  styles.badgeName,
                  !badge.earned && styles.badgeNameLocked
                ]}>
                  {badge.name}
                </Text>
                <Text style={styles.badgeDescription}>{badge.description}</Text>
                <View style={styles.badgePoints}>
                  <Ionicons 
                    name="star" 
                    size={14} 
                    color={badge.earned ? '#F59E0B' : '#9CA3AF'} 
                  />
                  <Text style={[
                    styles.badgePointsText,
                    !badge.earned && styles.badgePointsLocked
                  ]}>
                    {badge.points} pts
                  </Text>
                </View>
                {badge.earned && (
                  <View style={styles.earnedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Leaderboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Leaderboard</Text>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyLeaderboard}>
              <Ionicons name="trophy-outline" size={48} color={Colors.text.muted} />
              <Text style={styles.emptyText}>No rankings yet</Text>
              <Text style={styles.emptySubtext}>Earn badges to appear here!</Text>
            </View>
          ) : (
            leaderboard.map((user, index) => (
              <View 
                key={user.user_id}
                style={[
                  styles.leaderboardItem,
                  index === 0 && styles.leaderboardFirst,
                  user.user_id === userId && styles.leaderboardYou
                ]}
              >
                <View style={[
                  styles.rankBadge,
                  index === 0 && styles.rankFirst,
                  index === 1 && styles.rankSecond,
                  index === 2 && styles.rankThird,
                ]}>
                  <Text style={styles.rankText}>#{user.rank}</Text>
                </View>
                <View style={styles.leaderboardInfo}>
                  <Text style={styles.leaderboardName}>
                    {user.name}
                    {user.user_id === userId && ' (You)'}
                  </Text>
                  <Text style={styles.leaderboardBadges}>
                    {user.badge_count} badges
                  </Text>
                </View>
                <View style={styles.leaderboardPoints}>
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <Text style={styles.leaderboardPointsText}>{user.total_points}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  },
  scrollContent: {
    padding: 16,
  },
  pointsCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  pointsLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  badgeProgress: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  badgeProgressText: {
    color: '#fff',
    fontWeight: '600',
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  checkButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  badgeCardLocked: {
    backgroundColor: '#F3F4F6',
  },
  badgeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeIconEarned: {
    backgroundColor: '#FEF3C7',
  },
  badgeIconLocked: {
    backgroundColor: '#E5E7EB',
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeNameLocked: {
    color: Colors.text.muted,
  },
  badgeDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  badgePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgePointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  badgePointsLocked: {
    color: '#9CA3AF',
  },
  earnedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyLeaderboard: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
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
    marginTop: 4,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  leaderboardFirst: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  leaderboardYou: {
    backgroundColor: '#EFF6FF',
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankFirst: {
    backgroundColor: '#F59E0B',
  },
  rankSecond: {
    backgroundColor: '#9CA3AF',
  },
  rankThird: {
    backgroundColor: '#CD7F32',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  leaderboardBadges: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  leaderboardPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderboardPointsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
});

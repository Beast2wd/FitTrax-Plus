import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { useUserStore } from '../stores/userStore';
import axios from 'axios';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function MembershipScreen() {
  const { userId, profile } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [startingTrial, setStartingTrial] = useState(false);

  useEffect(() => {
    loadMembershipData();
  }, [userId]);

  const loadMembershipData = async () => {
    try {
      setLoading(true);
      const [statusRes, pricingRes] = await Promise.all([
        userId ? axios.get(`${API_URL}/api/membership/status/${userId}`) : null,
        axios.get(`${API_URL}/api/membership/pricing`)
      ]);
      
      if (statusRes) setMembershipStatus(statusRes.data);
      setPricing(pricingRes.data);
    } catch (error) {
      console.error('Error loading membership:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    if (!userId || !profile) {
      Alert.alert('Profile Required', 'Please create a profile first to start your free trial.');
      router.push('/profile');
      return;
    }

    setStartingTrial(true);
    try {
      // First create/get customer
      await axios.post(`${API_URL}/api/membership/create-customer`, {
        user_id: userId,
        email: `${userId}@fittraxx.app`,
        name: profile.name
      });

      // Start trial
      const response = await axios.post(`${API_URL}/api/membership/start-trial`, {
        user_id: userId
      });

      Alert.alert(
        '🎉 Welcome to Premium!',
        'Your 3-day free trial has started. Enjoy all premium features!',
        [{ text: 'Explore Features', onPress: () => router.back() }]
      );
      
      loadMembershipData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start trial');
    } finally {
      setStartingTrial(false);
    }
  };

  const handleSubscribe = async () => {
    if (!userId) {
      Alert.alert('Profile Required', 'Please create a profile first.');
      return;
    }

    // In production, this would open Stripe payment sheet
    Alert.alert(
      'Subscribe to Premium',
      'Annual subscription: $25/year\n\nStripe payment integration pending. In production, this would open the secure payment form.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Simulate Payment', 
          onPress: async () => {
            try {
              await axios.post(`${API_URL}/api/membership/subscribe`, { user_id: userId });
              Alert.alert('Success', 'Subscription activated!');
              loadMembershipData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to subscribe');
            }
          }
        }
      ]
    );
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your premium membership?',
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(`${API_URL}/api/membership/cancel/${userId}`);
              Alert.alert('Canceled', 'Your subscription has been canceled.');
              loadMembershipData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel');
            }
          }
        }
      ]
    );
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

  const isPremium = membershipStatus?.is_premium;
  const isTrial = membershipStatus?.is_trial;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FitTrax Premium</Text>
          <Text style={styles.subtitle}>Unlock your full potential</Text>
        </View>

        {/* Current Status Card */}
        {isPremium && (
          <LinearGradient
            colors={isTrial ? ['#F59E0B', '#D97706'] : ['#10B981', '#059669']}
            style={styles.statusCard}
          >
            <View style={styles.statusHeader}>
              <Ionicons 
                name={isTrial ? 'time' : 'checkmark-circle'} 
                size={32} 
                color="#fff" 
              />
              <Text style={styles.statusTitle}>
                {isTrial ? 'Free Trial Active' : 'Premium Member'}
              </Text>
            </View>
            {isTrial && (
              <Text style={styles.trialDays}>
                {membershipStatus.trial_days_remaining} days remaining
              </Text>
            )}
            <Text style={styles.statusSubtext}>
              {isTrial 
                ? 'Subscribe now to keep your premium access!' 
                : 'You have access to all premium features'}
            </Text>
          </LinearGradient>
        )}

        {/* Pricing Card */}
        {!isPremium && pricing && (
          <View style={styles.pricingCard}>
            <View style={styles.priceHeader}>
              <Text style={styles.priceName}>{pricing.name}</Text>
              <View style={styles.priceTag}>
                <Text style={styles.priceAmount}>${pricing.price}</Text>
                <Text style={styles.priceInterval}>/{pricing.interval}</Text>
              </View>
            </View>
            
            <View style={styles.trialBadge}>
              <Ionicons name="gift" size={20} color="#F59E0B" />
              <Text style={styles.trialBadgeText}>
                {pricing.trial_days}-Day Free Trial
              </Text>
            </View>

            <TouchableOpacity
              style={styles.trialButton}
              onPress={handleStartTrial}
              disabled={startingTrial}
            >
              {startingTrial ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="rocket" size={24} color="#fff" />
                  <Text style={styles.trialButtonText}>Start Free Trial</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* If on trial, show subscribe option */}
        {isTrial && (
          <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.subscribeGradient}
            >
              <Text style={styles.subscribeButtonText}>
                Subscribe Now - $25/year
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Premium Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Premium Features</Text>
          
          {pricing?.features.map((feature: string, index: number) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: getFeatureColor(index) }]}>
                <Ionicons name={getFeatureIcon(index)} size={20} color="#fff" />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
              {isPremium && (
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              )}
            </View>
          ))}
        </View>

        {/* Free Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Free Features</Text>
          
          {pricing?.free_features.map((feature: string, index: number) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#9CA3AF' }]}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>
          ))}
        </View>

        {/* Cancel option for premium users */}
        {isPremium && !isTrial && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
          >
            <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getFeatureIcon = (index: number): any => {
  const icons = [
    'barbell', 'nutrition', 'trophy', 'analytics', 
    'watch', 'fitness', 'flask', 'body', 'globe', 'accessibility'
  ];
  return icons[index % icons.length];
};

const getFeatureColor = (index: number): string => {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#EF4444', '#6366F1', '#8B5CF6', '#06B6D4', '#6366F1'
  ];
  return colors[index % colors.length];
};

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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  statusCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  trialDays: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  statusSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  pricingCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  priceHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  priceName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.brand.primary,
  },
  priceInterval: {
    fontSize: 18,
    color: Colors.text.secondary,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  trialBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
  trialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  trialButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  subscribeButton: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  subscribeGradient: {
    padding: 18,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  featuresSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.status.error,
  },
});

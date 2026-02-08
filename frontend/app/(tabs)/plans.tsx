import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

export default function PlansScreen() {
  const { theme } = useThemeStore();
  const colors = theme.colors;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <View style={styles.content}>
        <Ionicons name="construct-outline" size={64} color={colors.text.muted} />
        <Text style={[styles.title, { color: colors.text.primary }]}>Coming Soon</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          This section is being redesigned
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});

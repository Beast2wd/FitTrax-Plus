import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface FitTraxxLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function FitTraxxLogo({ size = 'medium', showText = true }: FitTraxxLogoProps) {
  const sizes = {
    small: { icon: 24, text: 16 },
    medium: { icon: 40, text: 24 },
    large: { icon: 64, text: 32 },
  };

  const currentSize = sizes[size];

  return (
    <View style={styles.container}>
      <View style={[styles.logoIcon, size === 'small' && styles.logoIconSmall]}>
        <MaterialIcons name="fitness-center" size={currentSize.icon} color={Colors.text.white} />
      </View>
      {showText && (
        <Text style={[styles.logoText, { fontSize: currentSize.text }]}>FitTraxx</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  logoText: {
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
});
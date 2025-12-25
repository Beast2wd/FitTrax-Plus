import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../constants/Colors';

interface FitTraxxLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function FitTraxxLogo({ size = 'medium', showText = true }: FitTraxxLogoProps) {
  const sizes = {
    small: { icon: 36, text: 16 },
    medium: { icon: 56, text: 24 },
    large: { icon: 80, text: 32 },
  };

  const currentSize = sizes[size];

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/icon.png')}
        style={[
          styles.logoIcon,
          { width: currentSize.icon, height: currentSize.icon },
          size === 'small' && styles.logoIconSmall
        ]}
      />
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
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoIconSmall: {
    borderRadius: 10,
  },
  logoText: {
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
});
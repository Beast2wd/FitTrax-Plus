import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { Colors } from '../constants/Colors';

interface FitTraxLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showText?: boolean;
  variant?: 'full' | 'icon';
}

export default function FitTraxLogo({ size = 'medium', showText = true, variant = 'full' }: FitTraxLogoProps) {
  const sizes = {
    small: { icon: 36, text: 16, gap: 8 },
    medium: { icon: 56, text: 24, gap: 12 },
    large: { icon: 80, text: 32, gap: 14 },
    xlarge: { icon: 120, text: 42, gap: 16 },
  };

  const currentSize = sizes[size];

  // Crisp vector logo
  const LogoIcon = ({ width, height }: { width: number; height: number }) => (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Defs>
        {/* Main gradient - vibrant blue */}
        <LinearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#0080FF" />
          <Stop offset="50%" stopColor="#0066CC" />
          <Stop offset="100%" stopColor="#004499" />
        </LinearGradient>
        {/* Accent gradient - energetic orange/yellow */}
        <LinearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FF6B35" />
          <Stop offset="100%" stopColor="#F7931E" />
        </LinearGradient>
        {/* White highlight gradient */}
        <LinearGradient id="highlightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      
      {/* Background rounded square */}
      <Path
        d="M15 5 H85 Q95 5 95 15 V85 Q95 95 85 95 H15 Q5 95 5 85 V15 Q5 5 15 5 Z"
        fill="url(#mainGradient)"
      />
      
      {/* Glossy highlight */}
      <Path
        d="M15 5 H85 Q95 5 95 15 V45 Q50 55 5 45 V15 Q5 5 15 5 Z"
        fill="url(#highlightGradient)"
      />
      
      {/* Stylized "F" - represents fitness/forward motion */}
      <G>
        {/* Main F shape */}
        <Path
          d="M28 22 L28 78 L38 78 L38 55 L58 55 L58 45 L38 45 L38 32 L62 32 L62 22 Z"
          fill="#FFFFFF"
        />
        
        {/* Dynamic motion lines / pulse indicator */}
        <Path
          d="M65 38 Q75 50 65 62"
          stroke="url(#accentGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M72 32 Q85 50 72 68"
          stroke="url(#accentGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        
        {/* Small accent dot - represents tracking point */}
        <Circle cx="78" cy="50" r="4" fill="#FFFFFF" opacity="0.9" />
      </G>
    </Svg>
  );

  if (variant === 'icon') {
    return (
      <View style={[styles.iconContainer, { borderRadius: currentSize.icon * 0.2 }]}>
        <LogoIcon width={currentSize.icon} height={currentSize.icon} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { gap: currentSize.gap }]}>
      <View style={[styles.iconContainer, { borderRadius: currentSize.icon * 0.2 }]}>
        <LogoIcon width={currentSize.icon} height={currentSize.icon} />
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.logoText, { fontSize: currentSize.text }]}>
            Fit<Text style={styles.logoTextAccent}>Trax</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -1,
  },
  logoTextAccent: {
    color: Colors.brand.primary,
  },
});

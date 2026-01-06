import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, G } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const CustomSplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate logo appearance
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(800),
    ]).start(() => {
      onFinish();
    });
  }, []);

  const gradientColors = ['#3B82F6', '#1D4ED8'];

  return (
    <View style={styles.container}>
      {/* Animated Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          },
        ]}
      >
        <Svg width={140} height={140} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="splashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientColors[0]} />
              <Stop offset="100%" stopColor={gradientColors[1]} />
            </LinearGradient>
            <LinearGradient id="splashGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          
          {/* Background glow */}
          <Circle cx="50" cy="50" r="48" fill="url(#splashGlow)" />
          
          {/* Outer ring */}
          <Circle 
            cx="50" 
            cy="50" 
            r="45" 
            stroke="url(#splashGradient)" 
            strokeWidth="3" 
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Progress arc */}
          <Path
            d="M 50 8 A 42 42 0 0 1 92 50"
            stroke={gradientColors[0]}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
          />
          
          {/* Stylized F + heartbeat */}
          <G>
            <Path
              d="M 32 28 L 32 72 M 32 28 L 52 28 M 32 48 L 48 48"
              stroke="url(#splashGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            
            <Path
              d="M 48 50 L 54 50 L 58 35 L 64 65 L 70 42 L 76 58 L 80 50 L 86 50"
              stroke="url(#splashGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </G>
          
          {/* Active indicator dot */}
          <Circle cx="86" cy="14" r="6" fill={gradientColors[0]} />
        </Svg>
      </Animated.View>

      {/* App Name */}
      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.title}>
          Fit<Text style={styles.titleAccent}>Trax</Text>
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{ opacity: taglineOpacity }}>
        <Text style={styles.tagline}>TRACK • TRANSFORM • THRIVE</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  textContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  titleAccent: {
    color: '#3B82F6',
  },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: 3,
  },
});

export default CustomSplashScreen;

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';

interface ScanProgressModalProps {
  visible: boolean;
}

const STEPS = [
  'Mengompresi & mengunggah gambar...',
  'Google Gemini Vision membaca teks struk...',
  'Mengekstrak rincian barang, pajak & diskon...',
  'Menyiapkan form konfirmasi transaksi...',
];

export const ScanProgressModal: React.FC<ScanProgressModalProps> = ({ visible }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setCurrentStepIndex(0);

      // Radar Spin
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Pulse Icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Step intervals
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
      }, 900);

      return () => clearInterval(interval);
    }
  }, [visible, spinAnim, pulseAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Animated AI Radar */}
          <View style={styles.radarContainer}>
            <Animated.View
              style={[
                styles.radarCircle,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.centerIcon,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Ionicons name="sparkles" size={28} color={Palette.primary} />
            </Animated.View>
          </View>

          <Text style={styles.title}>AI Vision Sedang Membaca</Text>
          <Text style={styles.subtitle}>{STEPS[currentStepIndex]}</Text>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((currentStepIndex + 1) / STEPS.length) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Palette.darkCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  radarContainer: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  radarCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: Palette.primary,
    borderStyle: 'dashed',
  },
  centerIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.darkText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    textAlign: 'center',
    minHeight: 36,
    lineHeight: 18,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Palette.primary,
    borderRadius: 3,
  },
});

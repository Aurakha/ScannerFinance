import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';

interface CameraGuideOverlayProps {
  torchOn: boolean;
  onToggleTorch: () => void;
  onPickImage: () => void;
  onCapture: () => void;
  onSelectDemo: () => void;
}

export const CameraGuideOverlay: React.FC<CameraGuideOverlayProps> = ({
  torchOn,
  onToggleTorch,
  onPickImage,
  onCapture,
  onSelectDemo,
}) => {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 320],
  });

  return (
    <View style={styles.container}>
      {/* Top Header info */}
      <View style={styles.topBar}>
        <View style={styles.infoBadge}>
          <Ionicons name="scan-outline" size={16} color={Palette.primary} />
          <Text style={styles.infoText}>Arahkan kamera ke struk belanja</Text>
        </View>

        <TouchableOpacity style={styles.torchButton} onPress={onToggleTorch}>
          <Ionicons
            name={torchOn ? 'flash' : 'flash-off-outline'}
            size={20}
            color={torchOn ? Palette.amber : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>

      {/* Target Focus Frame */}
      <View style={styles.frameContainer}>
        <View style={styles.frame}>
          {/* Corner borders */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {/* Animated Laser Scanning Line */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{ translateY }],
              },
            ]}
          />
        </View>
        <Text style={styles.frameHint}>Pastikan tulisan toko & total nominal terbaca jelas</Text>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.secondaryAction} onPress={onPickImage}>
          <Ionicons name="images-outline" size={24} color="#FFFFFF" />
          <Text style={styles.actionLabel}>Galeri</Text>
        </TouchableOpacity>

        {/* Shutter Capture Button */}
        <TouchableOpacity style={styles.shutterButton} onPress={onCapture} activeOpacity={0.8}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryAction} onPress={onSelectDemo}>
          <Ionicons name="sparkles-outline" size={24} color={Palette.primaryLight} />
          <Text style={[styles.actionLabel, { color: Palette.primaryLight }]}>Demo AI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  frameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 280,
    height: 360,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Palette.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 14,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 14,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 14,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 14,
  },
  scanLine: {
    width: '100%',
    height: 3,
    backgroundColor: Palette.primary,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  frameHint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 16,
    fontWeight: '500',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
  },
  secondaryAction: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Palette.primary,
  },
});

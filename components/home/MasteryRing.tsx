import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemedText } from '@/components/ThemedText';
import { brand } from '@/constants/matric';

interface MasteryRingProps {
  percent: number;
  size?: number;
  showLabel?: boolean;
}

export function MasteryRing({ percent, size = 52, showLabel = true }: MasteryRingProps) {
  const stroke = size >= 48 ? 4 : 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={[styles.wrap, !showLabel && { width: size }]}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={brand.primarySoft}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.center}>
          <ThemedText style={[styles.percent, size < 48 && styles.percentCompact]}>
            {clamped}%
          </ThemedText>
        </View>
      </View>
      {showLabel ? <ThemedText style={styles.label}>Mastery</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    color: brand.text,
    fontSize: 12,
    fontWeight: '700',
  },
  percentCompact: {
    fontSize: 11,
  },
  label: {
    marginTop: 4,
    color: brand.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});

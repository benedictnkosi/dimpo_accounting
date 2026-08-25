import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface SaFlagMarkProps {
  size?: number;
}

export function SaFlagMark({ size = 28 }: SaFlagMarkProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle cx="16" cy="16" r="16" fill="#0B1220" />
        <Path d="M6 8 L16 16 L6 24 Z" fill="#007A4D" />
        <Path d="M6 8 L26 8 L16 16 Z" fill="#DE3831" />
        <Path d="M6 24 L16 16 L26 24 Z" fill="#002395" />
        <Path d="M16 16 L26 8 L26 24 Z" fill="#FFB612" />
        <Rect x="14.5" y="7" width="3" height="18" fill="#FFFFFF" />
        <Path d="M6 15 L16 16 L6 17 Z" fill="#000000" />
      </Svg>
    </View>
  );
}

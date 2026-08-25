import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemedTextProps extends TextProps {
  type?: 'default' | 'title' | 'secondary' | 'defaultSemiBold' | 'subtitle' | 'link';
}

export function ThemedText({ style, type = 'default', ...props }: ThemedTextProps) {
  const { colors } = useTheme();

  const color =
    type === 'secondary' || type === 'link' ? colors.textSecondary : colors.text;

  const fontSize = type === 'title' ? 32 : type === 'subtitle' ? 20 : 16;
  const fontWeight: TextStyle['fontWeight'] =
    type === 'title' || type === 'subtitle' || type === 'defaultSemiBold' ? '600' : '400';

  return (
    <Text
      style={[
        { color, fontSize, fontWeight },
        style,
      ]}
      {...props}
    />
  );
}

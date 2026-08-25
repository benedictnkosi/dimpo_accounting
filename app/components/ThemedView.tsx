import { brand } from '@/constants/matric';
import React from 'react';
import { View, ViewProps } from 'react-native';

interface ThemedViewProps extends ViewProps {
    children: React.ReactNode;
}

export function ThemedView({ style, children, ...props }: ThemedViewProps) {
    return (
        <View
            style={[
                {
                    backgroundColor: brand.background,
                },
                style,
            ]}
            {...props}
        >
            {children}
        </View>
    );
}

export default ThemedView; 
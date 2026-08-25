import React, { createContext, useContext } from 'react';

interface ThemeContextType {
    isDark: boolean;
    colors: typeof lightColors;
}

export const lightColors = {
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceHigh: '#F1F5F9',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#64748B',
    primary: '#4F46E5',
    secondary: '#9333EA',
    accent: '#F59E0B',
    border: '#E2E8F0',
    error: '#EF4444',
    success: '#22C55E',
    placeholder: '#94A3B8',
    disabled: '#E2E8F0',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    buttonText: '#FFFFFF',
    link: '#2563EB',
    gradientStart: '#4F46E5',
    gradientEnd: '#9333EA',
};

export const darkColors = {
    background: '#0B1220',
    surface: '#121A2A',
    surfaceHigh: '#1A2436',
    card: '#161F30',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    primary: '#14B8A6',
    secondary: '#2DD4BF',
    accent: '#F59E0B',
    border: '#334155',
    error: '#F43F5E',
    success: '#22C55E',
    placeholder: '#64748B',
    disabled: '#334155',
    backdrop: 'rgba(0, 0, 0, 0.7)',
    buttonText: '#FFFFFF',
    link: '#2DD4BF',
    gradientStart: '#14B8A6',
    gradientEnd: '#22C55E',
};

const ThemeContext = createContext<ThemeContextType>({
    isDark: false,
    colors: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Matric Unlocked is a dark-first study experience.
    const isDark = true;
    const colors = darkColors;

    return (
        <ThemeContext.Provider value={{ isDark, colors }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
} 
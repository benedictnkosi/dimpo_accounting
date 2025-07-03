import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../components/ThemedText';
import RegisterForm from './components/RegisterForm';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

export default function RegisterScreen() {
    const params = useLocalSearchParams();
    const { isDark } = useTheme();
    const themeColors = Colors[isDark ? 'dark' : 'light'] as any;

    // Choose gradient colors based on theme, ensure tuple type for LinearGradient
    const gradientColors = isDark
        ? ['#1B1464', '#2B2F77'] as [string, string]
        : ['#F5F7FA', '#E4ECF7'] as [string, string];

    return (
        <SafeAreaView style={styles.container} testID="register-screen">
            <LinearGradient
                colors={isDark ? ['#1B1464', '#2B2F77', '#3A3F8F'] : ['#F5F7FA', '#E4ECF7', '#D2E0FB']}
                style={styles.gradient}
                testID="register-gradient-background"
            >
                <View style={styles.content} testID="register-content">
                    <View style={styles.header} testID="register-header">
                        <ThemedText style={[styles.title, { color: themeColors.text }]} testID="register-title">Create Account</ThemedText>
                        <ThemedText style={[styles.subtitle, { color: themeColors.textSecondary }]} testID="register-subtitle">Join thousands of students acing their exams! 🎯</ThemedText>
                    </View>
                    <View style={styles.divider} />
                    <RegisterForm onboardingData={params as any} />
                </View>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingTop: 40,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        width: '100%',
        paddingHorizontal: 16,
        paddingTop: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
        width: '100%',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: '#E2E8F0',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 8,
        fontWeight: '400',
    },
    divider: {
        width: '80%',
        height: 1,
        backgroundColor: '#E2E8F0',
        opacity: 0.3,
        marginVertical: 16,
        alignSelf: 'center',
    },
    formCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: 32,
    },
}); 
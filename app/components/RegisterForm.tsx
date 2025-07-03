import { ThemedText } from '@/components/ThemedText';
import { HOST_URL } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/services/analytics';
import { completeDeviceRegistration } from '@/services/deviceRegistration';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { OnboardingData } from '../onboarding';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

interface RegisterFormProps {
    onboardingData: OnboardingData;
    defaultMethod?: RegistrationMethod;
}

type RegistrationMethod = 'email' | 'phone';

export default function RegisterForm({ onboardingData, defaultMethod = 'email' }: RegisterFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [registrationMethod, setRegistrationMethod] = useState<RegistrationMethod>(defaultMethod);
    const { signUp } = useAuth();
    const { isDark } = useTheme();

    // Refs for keyboard navigation
    const nameRef = React.useRef<TextInput>(null);
    const emailRef = React.useRef<TextInput>(null);
    const phoneRef = React.useRef<TextInput>(null);
    const passwordRef = React.useRef<TextInput>(null);
    const confirmPasswordRef = React.useRef<TextInput>(null);

    // Track page view when component mounts
    useEffect(() => {
        analytics.track('accounting_register_page_viewed', {
            registration_method: registrationMethod,
            has_onboarding_data: !!onboardingData,
            avatar_id: onboardingData?.avatar || 'none'
        });
    }, []);

    const logAnalyticsEvent = async (eventName: string, params: {
        user_id: string;
        email: string;
        error?: string;
    }) => {
        try {
            await analytics.track(eventName, params);
        } catch (error) {
            console.error('Analytics error:', error);
        }
    };

    const validatePhoneNumber = (phone: string): boolean => {
        // Allow any phone number (no strict validation)
        return phone.length > 0;
    };

    const handleRegister = async () => {
        if (!name || !password || !confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please fill in all fields',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        if (registrationMethod === 'phone' && !validatePhoneNumber(phoneNumber)) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter your phone number',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        if (registrationMethod === 'email' && !email) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter your email',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        if (password.length < 6) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Password must be at least 6 characters',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        if (password !== confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Passwords do not match',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        setIsLoading(true);
        
        try {
            const userEmail = registrationMethod === 'phone'
                ? `${phoneNumber}@examquiz.co.za`
                : email;

            // Register the user
            const user = await signUp(userEmail, password);

            // If we have onboarding data, update the learner profile
            if (onboardingData) {
                const learnerData = {
                    name: name,
                    email: userEmail,
                    avatar: onboardingData.avatar,
                };

                // Create new learner using the new API endpoint
                try {
                    const response = await fetch(`${HOST_URL}/public/learn/learner/create`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            uid: user.uid,
                            name: learnerData.name,
                            grade: "12", // Default grade for new users
                            school_name: onboardingData.school || "Default School", // Use onboarding data or default
                            school_address: onboardingData.school_address || "Default Address", // Use onboarding data or default
                            school_latitude: onboardingData.school_latitude || 0, // Use onboarding data or default
                            school_longitude: onboardingData.school_longitude || 0, // Use onboarding data or default
                            terms: "1,2,4", // Default terms for new users
                            curriculum: onboardingData.curriculum || "CAPS", // Use onboarding data or default
                            email: learnerData.email,
                            avatar: `${learnerData.avatar}.png` // Ensure avatar has .png extension
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to create learner profile');
                    }

                    const learnerResponse = await response.json();
                    //console.log('Learner created:', learnerResponse);
                } catch (error) {
                    console.error('Error creating learner:', error);
                    // Don't throw here as the user is already registered
                    // Just log the error and continue
                }
            }

            // Store auth token
            await SecureStore.setItemAsync('auth', JSON.stringify({ user }));

            // Register device with the server
            try {
                const deviceRegistrationResult = await completeDeviceRegistration(user.uid);
                if (deviceRegistrationResult.success) {
                    console.log('[RegisterForm] Device registered successfully:', deviceRegistrationResult.deviceId);
                } else {
                    console.warn('[RegisterForm] Device registration failed:', deviceRegistrationResult.message);
                    // Don't block the registration flow if device registration fails
                }
            } catch (deviceError) {
                console.error('[RegisterForm] Error during device registration:', deviceError);
                // Don't block the registration flow if device registration fails
            }

            await logAnalyticsEvent('register_success', {
                user_id: user.uid,
                email: userEmail,
            });

            // Track detailed registration success
            analytics.track('accounting_register_success', {
                user_id: user.uid,
                email: userEmail,
                registration_method: registrationMethod,
                has_onboarding_data: !!onboardingData,
                avatar_id: onboardingData?.avatar || 'none',
                curriculum: onboardingData?.curriculum || 'CAPS',
                name_provided: !!name,
                password_length: password.length
            });

            // Show success toast
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Account created successfully!',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });

            // Navigate to tabs
            router.replace('/');
        } catch (error) {
            console.error('Registration error:', error);
            
            // Track registration error
            analytics.track('accounting_register_error', {
                registration_method: registrationMethod,
                has_onboarding_data: !!onboardingData,
                avatar_id: onboardingData?.avatar || 'none',
                error_type: error instanceof Error ? error.message : 'unknown_error',
                name_provided: !!name,
                email_provided: !!email,
                phone_provided: !!phoneNumber
            });
            
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to create account',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateGmail = () => {
        setRegistrationMethod('phone');
    };

    const handleCreatePhone = () => {
        setRegistrationMethod('email');
    };

    // Use themeColors for easier access
    const themeColors = Colors as any;

    return (
        <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollViewContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
                <View style={styles.card} testID="register-form-container">
                    <View style={[styles.registrationMethodContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)' }]}> 
                        <TouchableOpacity
                            style={[
                                styles.methodButton,
                                registrationMethod === 'email' && [styles.methodButtonActive, { backgroundColor: isDark ? themeColors.primary : '#4F46E5' }]
                            ]}
                            onPress={() => {
                                setRegistrationMethod('email');
                            }}
                        >
                            <ThemedText style={[
                                styles.methodButtonText,
                                { color: isDark ? themeColors["dark"].textSecondary : themeColors["light"].textSecondary },
                                registrationMethod === 'email' && [styles.methodButtonTextActive, { color: isDark ? '#FFFFFF' : '#FFFFFF' }]
                            ]}>
                                Email
                            </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.methodButton,
                                registrationMethod === 'phone' && [styles.methodButtonActive, { backgroundColor: isDark ? themeColors.primary : '#4F46E5' }]
                            ]}
                            onPress={() => {
                                setRegistrationMethod('phone');
                            }}
                        >
                            <ThemedText style={[
                                styles.methodButtonText,
                                { color: isDark ? themeColors["dark"].textSecondary : themeColors["light"].textSecondary },
                                registrationMethod === 'phone' && [styles.methodButtonTextActive, { color: isDark ? '#FFFFFF' : '#FFFFFF' }]
                            ]}>
                                Phone
                            </ThemedText>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        ref={nameRef}
                        style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)', color: themeColors[isDark ? 'dark' : 'light'].text }]}
                        placeholder="Name"
                        placeholderTextColor={isDark ? '#AAAAAA' : '#94A3B8'}
                        value={name}
                        onChangeText={setName}
                        testID="name-input"
                        maxLength={50}
                        accessibilityLabel="Full name input"
                        returnKeyType="next"
                        onSubmitEditing={() => {
                            if (registrationMethod === 'email') {
                                emailRef.current?.focus();
                            } else {
                                phoneRef.current?.focus();
                            }
                        }}
                    />

                    {registrationMethod === 'email' ? (
                        <>
                            <TextInput
                                ref={emailRef}
                                style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)', color: themeColors[isDark ? 'dark' : 'light'].text }]}
                                placeholder="Email"
                                placeholderTextColor={isDark ? '#AAAAAA' : '#94A3B8'}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                testID="email-input"
                                maxLength={50}
                                accessibilityLabel="Email input"
                                returnKeyType="next"
                                onSubmitEditing={() => passwordRef.current?.focus()}
                            />
                            <TouchableOpacity
                                onPress={handleCreateGmail}
                                style={styles.gmailLink}
                                accessibilityLabel="Use phone number instead"
                            >
                                <ThemedText style={[styles.gmailLinkText, { color: isDark ? themeColors.primary : themeColors.primary }] }>
                                    Don't have an email? Use your phone number
                                </ThemedText>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                        <TextInput
                            ref={phoneRef}
                            style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)', color: themeColors[isDark ? 'dark' : 'light'].text }]}
                            placeholder="Phone Number"
                            placeholderTextColor={isDark ? '#AAAAAA' : '#94A3B8'}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                            testID="phone-input"
                            maxLength={50}
                            accessibilityLabel="Phone number input"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordRef.current?.focus()}
                        />
                        <TouchableOpacity
                                onPress={handleCreatePhone}
                                style={styles.gmailLink}
                                accessibilityLabel="Use email instead"
                            >
                                <ThemedText style={[styles.gmailLinkText, { color: isDark ? themeColors.primary : themeColors.primary }] }>
                                    Don't have a phone number? Use your email
                                </ThemedText>
                            </TouchableOpacity>
                        </>
                    )}

                    <View style={styles.inputContainer}>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                ref={passwordRef}
                                style={[styles.input, styles.passwordInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)', color: themeColors[isDark ? 'dark' : 'light'].text }]}
                                placeholder="Password"
                                placeholderTextColor={isDark ? '#AAAAAA' : '#94A3B8'}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                testID="password-input"
                                maxLength={50}
                                accessibilityLabel="Password input"
                                returnKeyType="next"
                                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword(!showPassword)}
                                testID="toggle-password-visibility"
                            >
                                <Ionicons
                                    name={showPassword ? "eye-off" : "eye"}
                                    size={24}
                                    color={isDark ? '#AAAAAA' : '#94A3B8'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            ref={confirmPasswordRef}
                            style={[styles.input, styles.passwordInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)', color: themeColors[isDark ? 'dark' : 'light'].text }]}
                            placeholder="Confirm Password"
                            placeholderTextColor={isDark ? '#AAAAAA' : '#94A3B8'}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            testID="confirm-password-input"
                            maxLength={50}
                            accessibilityLabel="Confirm password input"
                            returnKeyType="done"
                            onSubmitEditing={handleRegister}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            testID="toggle-confirm-password-visibility"
                        >
                            <Ionicons
                                name={showConfirmPassword ? "eye-off" : "eye"}
                                size={24}
                                color={isDark ? '#AAAAAA' : '#94A3B8'}
                            />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: isDark ? themeColors.primary : themeColors.primary }, isLoading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={isLoading}
                        testID="register-button"
                        accessibilityLabel="Create account button"
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" testID="register-loading-indicator" />
                        ) : (
                            <ThemedText style={styles.buttonText} testID="register-button-text">Create Account</ThemedText>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        paddingVertical: 20,
        paddingBottom: 100,
    },
    registrationMethodContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        borderRadius: 12,
        padding: 4,
    },
    methodButton: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    methodButtonActive: {
        backgroundColor: '#4F46E5',
    },
    methodButtonText: {
        color: '#94A3B8',
        fontSize: 16,
        fontWeight: '600',
    },
    methodButtonTextActive: {
        color: '#FFFFFF',
    },
    inputContainer: {
        marginBottom: 16,
    },
    passwordContainer: {
        position: 'relative',
        width: '100%',
        marginBottom: 16,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 4,
        color: '#FFFFFF',
        fontSize: 16,
    },
    passwordInput: {
        paddingRight: 50,
        marginBottom: 0,
    },
    eyeIcon: {
        position: 'absolute',
        right: 12,
        top: 12,
        padding: 4,
    },
    helperText: {
        fontSize: 14,
        color: '#94A3B8',
        marginLeft: 4,
        marginTop: 4,
    },
    button: {
        backgroundColor: '#4F46E5',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    gmailLink: {
        marginBottom: 16,
        padding: 8,
    },
    gmailLinkText: {
        color: '#FFFFFF',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    card: {
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
        alignSelf: 'center',
    },
});

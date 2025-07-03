import { useState } from 'react';
import { StyleSheet, TouchableOpacity, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const { isDark } = useTheme();

  const validateInput = (input: string): { isValid: boolean; email: string } => {
    // Check if input is a valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(input)) {
      return { isValid: true, email: input };
    }

    // Check if input is a valid phone number (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (phoneRegex.test(input)) {
      return { isValid: true, email: `${input}@examquiz.co.za` };
    }

    return { isValid: false, email: '' };
  };

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all fields',
        position: 'bottom'
      });
      return;
    }

    const { isValid, email } = validateInput(emailOrPhone);
    if (!isValid) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid email or 10-digit phone number',
        position: 'bottom'
      });
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      console.error('Login error:', error.code, error.message);

      const messages: { [key: string]: string } = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect email or password',
        'auth/invalid-credential': 'Incorrect email or password',
        'auth/too-many-requests': 'Too many attempts. Please try again later'
      };

      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: messages[error.code] || 'Invalid email or password',
        position: 'bottom'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      <LinearGradient
        colors={isDark ? ['#1E1E1E', '#121212'] : ['#FFFFFF', '#F5F5F5']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <ThemedText style={[styles.title, { color: isDark ? Colors.dark.text : Colors.light.text }]}>🏳️‍🌈 Dimpo Accounting</ThemedText>
                <ThemedText style={[styles.subtitle, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary }]}> 
                Master Financial Statements, Ratio Analysis, and more with interactive lessons.
                </ThemedText>
              </View>

              <View style={styles.form}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
                      color: isDark ? Colors.dark.text : Colors.light.text,
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
                    },
                  ]}
                  placeholder="Email or Phone Number"
                  placeholderTextColor={isDark ? Colors.dark.textSecondary : '#94A3B8'}
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  testID="email-input"
                  maxLength={50}
                />
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
                        color: isDark ? Colors.dark.text : Colors.light.text,
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
                      },
                    ]}
                    placeholder="Password"
                    placeholderTextColor={isDark ? Colors.dark.textSecondary : '#94A3B8'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    testID="password-input"
                    maxLength={50}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    testID="toggle-password-visibility"
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={24}
                      color={isDark ? Colors.dark.textSecondary : '#94A3B8'}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: isDark ? Colors.primary : '#FFFFFF' }, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  testID="login-button"
                >
                  <ThemedText style={[styles.buttonText, { color: isDark ? '#FFFFFF' : '#1B1464' }] }>
                    {isLoading ? 'Signing in...' : 'Start Learning →'}
                  </ThemedText>
                </TouchableOpacity>

                <View style={styles.registerContainer}>
                  <ThemedText style={[styles.helperText, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary }] }>
                    New to Dimpo Accounting? Join our community of learners! 🌍
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.createAccountButton, { backgroundColor: isDark ? Colors.primary : '#3B82F6' }]}
                    onPress={() => router.push('/onboarding')}
                    testID="create-account-button"
                  >
                    <ThemedText style={[styles.createAccountButtonText, { color: '#FFFFFF' }]}>Create an account</ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.forgotPasswordContainer}>
                  <ThemedText style={[styles.helperText, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary }] }>
                    Forgot your password? We'll help you get back to learning! 🔑
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => router.push('/forgot-password')}
                    testID="forgot-password-button"
                  >
                    <ThemedText style={[styles.linkText, { color: '#FFFFFF' }]}>Reset it here</ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.deleteAccountContainer}>
                  <TouchableOpacity
                    style={styles.deleteAccountButton}
                    onPress={() => router.push('https://examquiz.co.za/info/delete-account')}
                    testID="delete-account-button"
                  >
                    <ThemedText style={[styles.deleteAccountText, { color: '#EF4444' }]}>Delete Account</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    width: '100%',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  form: {
    gap: 16,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  button: {
    padding: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  registerContainer: {
    marginTop: 32,
    alignItems: 'center',
    width: '100%',
  },
  createAccountButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  createAccountButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPasswordContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  helperText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  linkButton: {
    padding: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 12,
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
  deleteAccountContainer: {
    marginTop: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 24,
  },
  deleteAccountButton: {
    padding: 8,
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
}); 
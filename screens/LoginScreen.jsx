import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Logo from '../components/Logo';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { colors } from '../constants/colors';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import firebase from '../firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword, getUserProfile, getUserByPhoneNumber } from '../utils/auth';
import * as Crypto from 'expo-crypto';

const LoginScreen = ({ navigation }) => {
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const recaptchaVerifier = useRef(null);
  const [awaitingOtp, setAwaitingOtp] = useState(false);

  const cacheProfileAndNavigate = async (userId, profile, emailFallback = '') => {
    const cacheItems = [
      ['userId', userId || ''],
      ['userName', profile?.name || ''],
      ['partnerName', profile?.partnerName || ''],
      ['userPhone', profile?.phoneNumber || ''],
      ['userEmail', profile?.email || emailFallback || ''],
      ['partnerId', profile?.partnerId || ''],
    ];

    await AsyncStorage.multiSet(cacheItems.map(([key, value]) => [key, value ?? '']));

    const destination = profile?.linked && profile?.partnerId ? 'Home' : 'PartnerLink';
    navigation.reset({
      index: 0,
      routes: [{ name: destination }],
    });
  };

  const getFriendlyErrorMessage = (error) => {
    const code =
      error?.code ||
      error?.errorInfo?.code ||
      (typeof error?.message === 'string' && error.message.includes('auth/')
        ? error.message.match(/auth\/[a-z0-9\-]+/i)?.[0]
        : null);

    switch (code) {
      case 'auth/user-not-found':
        return 'We couldn’t find an account with that email. Double-check it or create a new one.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'That password doesn’t match this account. Please try again or reset it.';
      case 'auth/invalid-email':
        return 'That email doesn’t look quite right. Please check the spelling.';
      case 'auth/too-many-requests':
        return 'Too many attempts right now. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'We’re having trouble connecting. Check your internet and try again.';
      default:
        return 'Something went wrong while signing you in. Please try again.';
    }
  };

  const handleMethodChange = (method) => {
    setLoginMethod(method);
    setEmailOrPhone('');
    setPassword('');
    setAwaitingOtp(false);
    setErrorMessage('');
  };

  const validatePhoneNumber = (phone) => {
    const trimmed = phone.trim();
    if (!trimmed) {
      return { valid: false, message: 'Phone number is required' };
    }
    if (!trimmed.startsWith('+')) {
      return { valid: false, message: 'Please include country code (e.g., +1...)' };
    }
    if (trimmed.length < 8) {
      return { valid: false, message: 'Phone number seems too short' };
    }
    return { valid: true, value: trimmed };
  };

  const handleEmailLogin = async () => {
    setErrorMessage('');
    if (!emailOrPhone || !password) {
      setErrorMessage('Please fill in both email and password to continue.');
      return;
    }

    setLoading(true);
    try {
      const user = await signInWithEmailAndPassword(emailOrPhone.trim(), password);
      const profile = await getUserProfile(user.uid);

      if (!profile) {
        alert('Profile not found. Please complete signup.');
        await firebase.auth().signOut();
        return;
      }

      await cacheProfileAndNavigate(user.uid, profile, emailOrPhone.trim());
      setErrorMessage('');
    } catch (error) {
      console.error('[Login] Email login failed:', error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    setErrorMessage('');
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setErrorMessage('Please enter your password to continue.');
      return;
    }

    if (!recaptchaVerifier.current) {
      setErrorMessage('Security verification is not ready yet. Please try again.');
      return;
    }

    const validation = validatePhoneNumber(emailOrPhone);
    if (!validation.valid) {
      setErrorMessage(validation.message);
      return;
    }

    setLoading(true);
    try {
      const profile = await getUserByPhoneNumber(validation.value);
      if (!profile) {
        setErrorMessage('We couldn’t find an account with that phone number. Please check it or sign up.');
        setLoading(false);
        return;
      }

      if (!profile.phonePasswordHash) {
        setErrorMessage('Please reset your password via signup to continue with phone login.');
        setLoading(false);
        return;
      }

      const enteredHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        trimmedPassword
      );

      if (enteredHash !== profile.phonePasswordHash) {
        setErrorMessage('That password doesn’t match this account. Please try again or reset it.');
        setLoading(false);
        return;
      }

      const phoneProvider = new firebase.auth.PhoneAuthProvider();
      const verificationId = await phoneProvider.verifyPhoneNumber(
        validation.value,
        recaptchaVerifier.current
      );
      console.log('[Login] Verification ID received:', verificationId);

      await AsyncStorage.multiSet(
        [
          ['userId', profile.id || ''],
          ['userName', profile.name || ''],
          ['partnerName', profile.partnerName || ''],
          ['partnerId', profile.partnerId || ''],
          ['userPhone', profile.phoneNumber || validation.value],
        ].map(([key, value]) => [key, value ?? ''])
      );

      navigation.navigate('OTP', {
        formData: { phoneNumber: validation.value },
        verificationId,
        mode: 'login',
        password: trimmedPassword,
      });
      setAwaitingOtp(true);
      setErrorMessage('');
    } catch (error) {
      console.error('[Login] Phone verification failed', error);
      const message =
        error?.code === 'auth/too-many-requests'
          ? 'Too many attempts right now. Please wait a little and try again.'
          : error?.code === 'auth/network-request-failed'
          ? 'We’re having trouble connecting. Check your internet and try again.'
          : 'Failed to send verification code. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loginMethod === 'phone' && awaitingOtp) {
      navigation.navigate('OTP', {
        formData: { phoneNumber: emailOrPhone.trim() },
        verificationId: null,
        mode: 'login-password',
        password,
      });
      setErrorMessage('');
      return;
    }

    if (loginMethod === 'email') {
      await handleEmailLogin();
    } else {
      await handlePhoneLogin();
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <FirebaseRecaptchaVerifierModal
              ref={recaptchaVerifier}
              firebaseConfig={firebase.app().options}
              attemptInvisibleVerification
            />

            <View style={styles.logoContainer}>
              <Logo size="large" />
            </View>

            <View style={styles.taglineContainer}>
              <Text style={styles.tagline}>Stay connected, share</Text>
              <Text style={styles.tagline}>memories, grow together.</Text>
            </View>

            <View style={styles.formContainer}>
              {!!errorMessage && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Let’s fix this 💡</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    loginMethod === 'email' && styles.toggleButtonActive,
                  ]}
                  onPress={() => handleMethodChange('email')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      loginMethod === 'email' && styles.toggleTextActive,
                    ]}
                  >
                    Email
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    loginMethod === 'phone' && styles.toggleButtonActive,
                  ]}
                  onPress={() => handleMethodChange('phone')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      loginMethod === 'phone' && styles.toggleTextActive,
                    ]}
                  >
                    Phone
                  </Text>
                </TouchableOpacity>
              </View>

              <CustomInput
                placeholder={loginMethod === 'email' ? 'Email' : 'Phone Number'}
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                keyboardType={loginMethod === 'email' ? 'email-address' : 'phone-pad'}
                autoCapitalize={loginMethod === 'email' ? 'none' : 'tel'}
              />

              {loginMethod === 'email' ? (
                <>
                  <CustomInput
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={styles.forgotPassword}
                    onPress={() => {
                      alert('Forgot password feature coming soon');
                    }}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <CustomInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              )}

              <CustomButton
                title={
                  loginMethod === 'email'
                    ? 'Login'
                    : awaitingOtp
                    ? 'Enter OTP'
                    : 'Send OTP'
                }
                onPress={handleLogin}
                loading={loading}
              />
            </View>

            <View style={styles.signupLink}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signupLinkText}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  tagline: {
    fontSize: 16,
    color: colors.primaryPurple,
    fontWeight: '400',
    textAlign: 'center',
  },
  formContainer: {
    marginTop: 10,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 105, 180, 0.18)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryPink,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryPurple,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: colors.primaryPurple,
    opacity: 0.9,
    lineHeight: 18,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1E6FF',
    borderRadius: 20,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primaryPink,
    shadowColor: colors.primaryPink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  toggleText: {
    color: colors.primaryPurple,
    fontSize: 16,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: colors.textLight,
    fontWeight: '600',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: colors.primaryPurple,
    fontSize: 14,
    fontWeight: '500',
  },
  signupLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    color: colors.primaryPurple,
    fontSize: 14,
  },
  signupLinkText: {
    color: colors.primaryPurple,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoginScreen;


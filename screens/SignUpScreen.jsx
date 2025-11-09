import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Logo from '../components/Logo';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { colors } from '../constants/colors';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import firebase from '../firebase.config';
import { signUpWithEmail, createUser } from '../utils/auth';
import { Ionicons } from '@expo/vector-icons';

// Gender picker will use a simple dropdown or modal

const SignUpScreen = ({ navigation }) => {
  const [signupMethod, setSignupMethod] = useState('phone'); // 'phone' | 'email'
  const [formData, setFormData] = useState({
    yourName: '',
    partnerName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: 'Male',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const getFriendlySignupError = (error) => {
    switch (error?.code) {
      case 'auth/email-already-in-use':
        return 'This email is already linked to another account. Try signing in instead.';
      case 'auth/invalid-email':
        return 'That email doesn’t look quite right. Please check the spelling.';
      case 'auth/weak-password':
        return 'This password is too easy to guess. Try a mix of letters and numbers.';
      case 'auth/network-request-failed':
        return 'We’re having trouble connecting. Check your internet and try again.';
      default:
        return 'We couldn’t create your account just yet. Please try again.';
    }
  };

  const recaptchaVerifier = useRef(null);

  const handleMethodChange = (method) => {
    setSignupMethod(method);
    setErrorMessage('');
    if (method === 'phone') {
      setFormData((prev) => ({
        ...prev,
        email: '',
        password: '',
        confirmPassword: '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        phoneNumber: '',
      }));
    }
  };

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
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

  const handleSignUp = async () => {
    setErrorMessage('');
    if (!formData.yourName || !formData.partnerName) {
      setErrorMessage('Please complete both name fields to continue.');
      return;
    }

    if (signupMethod === 'phone') {
      const phoneValidation = validatePhoneNumber(formData.phoneNumber);
      if (!phoneValidation.valid) {
        setErrorMessage(phoneValidation.message);
        return;
      }

      if (!formData.password || !formData.confirmPassword) {
        setErrorMessage('Please create and confirm your password.');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setErrorMessage('Passwords do not match. Try entering them again.');
        return;
      }

      if (formData.password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }

      if (!recaptchaVerifier.current) {
        setErrorMessage('Security verification is not ready yet. Please try again.');
        return;
      }

      setLoading(true);
      try {
        const phoneProvider = new firebase.auth.PhoneAuthProvider();
        const verificationId = await phoneProvider.verifyPhoneNumber(
          phoneValidation.value,
          recaptchaVerifier.current
        );
        console.log('[Signup] Verification ID received:', verificationId);

        navigation.navigate('OTP', {
          formData: {
            ...formData,
            phoneNumber: phoneValidation.value,
          },
          verificationId,
          mode: 'signup',
        });
      } catch (error) {
        console.error('Phone verification failed', error);
        const message =
          error?.code === 'auth/too-many-requests'
            ? 'Too many attempts right now. Please wait a little and try again.'
            : error?.code === 'auth/network-request-failed'
            ? 'We’re having trouble connecting. Check your internet and try again.'
            : 'Failed to send verification code. Please try again.';
        setErrorMessage(message);
        setLoading(false);
      }
      return;
    }

    if (!formData.email) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!formData.password || !formData.confirmPassword) {
      setErrorMessage('Please enter and confirm your password.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match. Try entering them again.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const user = await signUpWithEmail(formData.email.trim(), formData.password);
      await createUser(user.uid, {
        ...formData,
        phoneNumber: formData.phoneNumber || '',
      });
      await firebase.auth().signOut();
      setErrorMessage('');
      alert('Account created successfully! Please log in.');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('[Signup] Email signup failed', error);
      setErrorMessage(getFriendlySignupError(error));
    } finally {
      setLoading(false);
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
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.primaryPurple} />
            </TouchableOpacity>
          </View>
            <FirebaseRecaptchaVerifierModal
              ref={recaptchaVerifier}
              firebaseConfig={firebase.app().options}
              attemptInvisibleVerification
            />

            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  signupMethod === 'phone' && styles.toggleButtonActive,
                ]}
                onPress={() => handleMethodChange('phone')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    signupMethod === 'phone' && styles.toggleTextActive,
                  ]}
                >
                  Phone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  signupMethod === 'email' && styles.toggleButtonActive,
                ]}
                onPress={() => handleMethodChange('email')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    signupMethod === 'email' && styles.toggleTextActive,
                  ]}
                >
                  Email
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.logoContainer}>
              <Logo size="large" />
            </View>

            <Text style={styles.title}>Create Your Account 💕</Text>

            <View style={styles.formContainer}>
              {!!errorMessage && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Heads up 💡</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}
              <CustomInput
                placeholder="Your Name"
                value={formData.yourName}
                onChangeText={(value) => updateField('yourName', value)}
              />

              <CustomInput
                placeholder="Your Partner's Name"
                value={formData.partnerName}
                onChangeText={(value) => updateField('partnerName', value)}
              />

              {signupMethod === 'phone' ? (
                <>
                  <CustomInput
                    placeholder="Phone Number"
                    value={formData.phoneNumber}
                    onChangeText={(value) => updateField('phoneNumber', value)}
                    keyboardType="phone-pad"
                  />

                  <CustomInput
                    placeholder="Create Password"
                    value={formData.password}
                    onChangeText={(value) => updateField('password', value)}
                    secureTextEntry
                  />

                  <CustomInput
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChangeText={(value) => updateField('confirmPassword', value)}
                    secureTextEntry
                  />
                </>
              ) : (
                <>
                  <CustomInput
                    placeholder="Email"
                    value={formData.email}
                    onChangeText={(value) => updateField('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <CustomInput
                    placeholder="Create Password"
                    value={formData.password}
                    onChangeText={(value) => updateField('password', value)}
                    secureTextEntry
                  />

                  <CustomInput
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChangeText={(value) => updateField('confirmPassword', value)}
                    secureTextEntry
                  />
                </>
              )}

              <TouchableOpacity
                style={styles.genderContainer}
                onPress={() => {
                  // Simple gender selection - can be enhanced with modal
                  const genders = ['Male', 'Female', 'Other'];
                  const currentIndex = genders.indexOf(formData.gender);
                  const nextIndex = (currentIndex + 1) % genders.length;
                  updateField('gender', genders[nextIndex]);
                }}
              >
                <Text style={styles.genderLabel}>Gender: {formData.gender}</Text>
                <Text style={styles.genderIndicator}>▼</Text>
              </TouchableOpacity>

              <CustomButton
                title="Continue"
                onPress={handleSignUp}
                loading={loading}
              />
            </View>

            <View style={styles.loginLink}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLinkText}>Login</Text>
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
    padding: 20,
    paddingVertical: 40,
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
    marginBottom: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(246, 78, 159, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primaryPurple,
    textAlign: 'center',
    marginBottom: 24,
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
    marginBottom: 24,
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
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    minHeight: 50,
  },
  genderLabel: {
    fontSize: 16,
    color: colors.textDark,
  },
  genderIndicator: {
    fontSize: 12,
    color: colors.primaryPurple,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: colors.primaryPurple,
    fontSize: 14,
  },
  loginLinkText: {
    color: colors.primaryPurple,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignUpScreen;


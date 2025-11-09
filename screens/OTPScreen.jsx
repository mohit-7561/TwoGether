import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '../components/CustomButton';
import { colors } from '../constants/colors';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import firebase from '../firebase.config';
import { verifyOTP, createUser, getUserProfile } from '../utils/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logo from '../components/Logo';
import * as Crypto from 'expo-crypto';

const OTPScreen = ({ route, navigation }) => {
  const { formData, verificationId: initialVerificationId, mode = 'signup', password } = route.params || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState(initialVerificationId || '');
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);
  const recaptchaVerifier = useRef(null);

  useEffect(() => {
    if (initialVerificationId) {
      setVerificationId(initialVerificationId);
    } else if (formData?.phoneNumber) {
      // Automatically trigger OTP if none provided (e.g., deep link)
      setTimeout(() => {
        sendOTP();
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVerificationId]);

  const sendOTP = async () => {
    if (!formData?.phoneNumber) {
      alert('Phone number missing. Please restart signup.');
      return;
    }
    if (!recaptchaVerifier.current) {
      alert('Security verification is not ready yet. Please try again.');
      return;
    }

    setResending(true);
    try {
      const phoneProvider = new firebase.auth.PhoneAuthProvider();
      const verificationIdResult = await phoneProvider.verifyPhoneNumber(
        formData.phoneNumber,
        recaptchaVerifier.current
      );
      setVerificationId(verificationIdResult);
      console.log('[OTP] Verification ID received:', verificationIdResult);
      alert('OTP sent to your phone number');
    } catch (error) {
      console.error('[OTP] Failed to send code:', error);
      alert('Failed to send OTP: ' + error.message);
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, key) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      alert('Please enter complete OTP');
      return;
    }
    if (!verificationId) {
      alert('Verification session expired. Please resend the code.');
      return;
    }

    setLoading(true);
    try {
      // Verify OTP
      const user = await verifyOTP(verificationId, otpCode);
      console.log('[OTP] Verification succeeded for user:', user?.uid);

      if (mode === 'login' || mode === 'login-password') {
        const profile = await getUserProfile(user.uid);
        if (!profile) {
          alert('Profile not found. Please sign up first.');
          await firebase.auth().signOut();
          return;
        }

        const trimmedPassword = (password || '').trim();
        if (!trimmedPassword) {
          alert('Please enter your password to continue.');
          await firebase.auth().signOut();
          return;
        }

        if (profile.phonePasswordHash) {
          const enteredHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            trimmedPassword
          );
          if (enteredHash !== profile.phonePasswordHash) {
            alert('Incorrect password. Please try again.');
            await firebase.auth().signOut();
            return;
          }
        } else {
          // For legacy users without a stored hash, we prevent login to keep accounts secure.
          alert('We need you to re-create your account password. Please sign up again or contact support.');
          await firebase.auth().signOut();
          return;
        }

        const storeItems = [
          ['userId', user.uid || ''],
          ['userName', profile.name || ''],
          ['partnerName', profile.partnerName || ''],
          ['userPhone', profile.phoneNumber || ''],
          ['userEmail', profile.email || ''],
          ['userPassword', password || ''],
          ['partnerId', profile.partnerId || ''],
        ];
        await AsyncStorage.multiSet(storeItems.map(([key, value]) => [key, value ?? '']));
        console.log('[OTP] User data cached locally (login).');

        const destination = profile.linked && profile.partnerId ? 'Home' : 'PartnerLink';

        navigation.reset({
          index: 0,
          routes: [{ name: destination }],
        });
        console.log('[OTP] Navigation to Home triggered (login).');
        return;
      }

      // Phone signup flow
      await createUser(user.uid, formData);
      console.log('[OTP] User document created for:', user?.uid);

      await firebase.auth().signOut();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      console.log('[OTP] Navigation to Login triggered (signup).');
    } catch (error) {
      console.error('[OTP] Verification error:', error);
      alert('OTP verification failed: ' + error.message);
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
        <View style={styles.content}>
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaVerifier}
            firebaseConfig={firebase.app().options}
            attemptInvisibleVerification
          />

            <View style={styles.logoContainer}>
              <Logo size="large" />
            </View>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{'\n'}
            {formData?.phoneNumber || 'your phone'}
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.otpInput}
                value={digit}
                onChangeText={(value) => handleOtpChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            ))}
          </View>

          <CustomButton
            title="Verify"
            onPress={handleVerify}
            loading={loading}
          />

          <TouchableOpacity
            style={styles.resendContainer}
            onPress={sendOTP}
            disabled={resending}
          >
            <Text style={styles.resendText}>
              {resending ? 'Resending code...' : "Didn't receive code? "}
            </Text>
            {!resending && <Text style={styles.resendLink}>Resend</Text>}
          </TouchableOpacity>
        </View>
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
    justifyContent: 'center',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.primaryPurple,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    color: colors.textDark,
    backgroundColor: colors.inputBackground,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  resendText: {
    color: colors.textDark,
    fontSize: 14,
  },
  resendLink: {
    color: colors.primaryPurple,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OTPScreen;


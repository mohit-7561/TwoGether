import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Share, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { colors } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logo from '../components/Logo';
import {
  ensureInviteCodeForUser,
  findUserByInviteCode,
  getUserProfile,
  linkUserProfiles,
  refreshInviteCode,
} from '../utils/auth';
import { sendPartnerLinkedNotification } from '../utils/notifications';
import { db } from '../firebase.config';
import { Ionicons } from '@expo/vector-icons';

const PartnerLinkScreen = ({ navigation }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [userId, setUserId] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [linking, setLinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshingCode, setRefreshingCode] = useState(false);
  const [userName, setUserName] = useState('');
  const linkAlertHandledRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async () => {
      setErrorMessage('');
      try {
        const id = await AsyncStorage.getItem('userId');
        if (!id) {
          Alert.alert('Session expired', 'Please sign in again.', [
            {
              text: 'OK',
              onPress: () =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                }),
            },
          ]);
          return;
        }

        if (!isMounted) {
          return;
        }

        setUserId(id);
        const profile = await getUserProfile(id);

        if (!profile) {
          setErrorMessage('We could not load your profile. Please try signing in again.');
          return;
        }

        if (isMounted) {
          setUserName(profile.name || profile.partnerName || '');
        }

        if (profile.linked && profile.partnerId) {
          const partnerProfile = await getUserProfile(profile.partnerId);
          const partnerDisplayName =
            partnerProfile?.name || partnerProfile?.partnerName || profile.partnerName || 'Partner';

          await AsyncStorage.multiSet(
            [
              ['userName', profile.name || ''],
              ['partnerName', partnerDisplayName || ''],
              ['partnerId', profile.partnerId || ''],
            ].map(([key, value]) => [key, value ?? ''])
          );

          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
          return;
        }

        const code = await ensureInviteCodeForUser(id);
        if (isMounted) {
          setInviteCode(code);
        }
      } catch (error) {
        console.error('[PartnerLink] Failed to load profile:', error);
        setErrorMessage(error.message || 'Failed to prepare invite code. Please try again.');
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    linkAlertHandledRef.current = false;

    const unsubscribe = db.collection('users').doc(userId).onSnapshot(async (snapshot) => {
      const data = snapshot.data();

      if (!data || !data.linked || !data.partnerId) {
        return;
      }

      if (linkAlertHandledRef.current) {
        return;
      }
      linkAlertHandledRef.current = true;

      try {
        const partnerProfile = await getUserProfile(data.partnerId);
        const partnerDisplayName =
          partnerProfile?.name ||
          partnerProfile?.partnerName ||
          data.partnerName ||
          'Partner';

        await AsyncStorage.multiSet(
          [
            ['partnerName', partnerDisplayName || ''],
            ['partnerId', data.partnerId || ''],
            ['userName', data.name || userName || ''],
          ].map(([key, value]) => [key, value ?? ''])
        );

        setSuccessMessage(`You're now linked with ${partnerDisplayName}!`);

        Alert.alert('Linked Successfully 💖', `You are now connected with ${partnerDisplayName}.`, [
          {
            text: 'Go to Home',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              }),
          },
        ]);
      } catch (linkListenerError) {
        console.error('[PartnerLink] Failed to handle live link update:', linkListenerError);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId, navigation, userName]);

  const handleShareLink = async () => {
    if (!inviteCode) {
      setErrorMessage('Invite code is not ready yet. Please wait a moment.');
      return;
    }

    const inviteLink = `https://soulink.app/invite/${inviteCode}`;

    try {
      await Share.share({
        message: `Join me on Twogether 💑\nUse this link to connect: ${inviteLink}`,
        url: inviteLink,
        title: 'Link with me on Twogether',
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to share link.');
    }
  };

  const handleRegenerateCode = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!userId) {
      setErrorMessage('We could not verify your account. Please sign in again.');
      return;
    }

    setRefreshingCode(true);
    try {
      const newCode = await refreshInviteCode(userId);
      setInviteCode(newCode);
      setSuccessMessage('Your invite code was refreshed! Share the new one with your partner.');
    } catch (error) {
      console.error('[PartnerLink] Failed to refresh invite code:', error);
      setErrorMessage(error.message || 'Unable to refresh invite code right now.');
    } finally {
      setRefreshingCode(false);
    }
  };

  const handleEnterCode = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!partnerCode) {
      setErrorMessage('Please enter your partner’s invite code.');
      return;
    }

    if (!userId) {
      setErrorMessage('We could not verify your account. Please sign in again.');
      return;
    }

    try {
      setLinking(true);
      const partnerProfile = await findUserByInviteCode(partnerCode);

      if (!partnerProfile) {
        setErrorMessage('No partner found with that invite code. Double-check the code and try again.');
        return;
      }

      const { partner } = await linkUserProfiles(userId, partnerProfile.id);

      const partnerDisplayName =
        partner?.name || partner?.partnerName || partnerProfile.name || partnerProfile.partnerName || 'Partner';

      try {
        await sendPartnerLinkedNotification({
          partnerId: partnerProfile.id,
          partnerName: partnerDisplayName,
          senderName: userName || partner?.partnerName || '',
        });
      } catch (notificationError) {
        console.warn('[PartnerLink] Failed to notify partner about link:', notificationError);
      }

      await AsyncStorage.multiSet(
        [
          ['partnerName', partnerDisplayName || ''],
          ['partnerId', partnerProfile.id || ''],
        ].map(([key, value]) => [key, value ?? ''])
      );

      setSuccessMessage(`You're now linked with ${partnerDisplayName}!`);
      linkAlertHandledRef.current = true;

      Alert.alert('Linked Successfully 💖', `You are now connected with ${partnerDisplayName}.`, [
        {
          text: 'Continue',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            }),
        },
      ]);
    } catch (error) {
      console.error('[PartnerLink] Failed to link partner:', error);
      setErrorMessage(error.message || 'Failed to link partner. Please try again.');
    } finally {
      setLinking(false);
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
            <View style={styles.logoContainer}>
              <Logo size="large" />
            </View>
            <Text style={styles.title}>Link with your Partner 💑</Text>
            <Text style={styles.subtitle}>
              Share your invite code or enter your partner's code to connect
            </Text>

            {!!errorMessage && (
              <View style={styles.messageCard}>
                <Text style={styles.messageTitle}>Let’s fix this 💡</Text>
                <Text style={styles.messageText}>{errorMessage}</Text>
              </View>
            )}

            {!!successMessage && (
              <View style={[styles.messageCard, styles.successCard]}>
                <Text style={styles.messageTitle}>You’re connected! 🎉</Text>
                <Text style={styles.messageText}>{successMessage}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Share Your Invite Code</Text>

              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>
                  {loadingProfile ? '••••••' : inviteCode || '------'}
                </Text>
              </View>

              <CustomButton
                title="Share Invite Link"
                onPress={handleShareLink}
                loading={loadingProfile}
                disabled={loadingProfile || !inviteCode || refreshingCode}
              />

              <CustomButton
                title="Regenerate Invite Code"
                onPress={handleRegenerateCode}
                loading={refreshingCode}
                disabled={loadingProfile || refreshingCode}
                style={styles.regenerateButton}
              />
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enter Partner Code</Text>
              
              <CustomInput
                placeholder="Enter Partner Code"
                value={partnerCode}
                onChangeText={(value) => setPartnerCode(value.toUpperCase())}
                autoCapitalize="characters"
              />

              <CustomButton
                title="Link Partner"
                onPress={handleEnterCode}
                loading={linking}
                disabled={loadingProfile}
              />
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
    marginBottom: 16,
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  messageCard: {
    backgroundColor: 'rgba(255, 105, 180, 0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryPink,
    marginBottom: 20,
  },
  successCard: {
    backgroundColor: 'rgba(80, 200, 120, 0.12)',
    borderLeftColor: '#50C878',
  },
  messageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryPurple,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    color: colors.primaryPurple,
    opacity: 0.9,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryPurple,
    marginBottom: 16,
  },
  codeContainer: {
    backgroundColor: colors.gradientStart,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primaryPink,
    borderStyle: 'dashed',
  },
  codeText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primaryPurple,
    letterSpacing: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inputBorder,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.textDark,
    fontSize: 14,
    opacity: 0.5,
  },
  regenerateButton: {
    marginTop: 12,
  },
});

export default PartnerLinkScreen;


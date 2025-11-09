import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { colors } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotifications, sendRingNotification } from '../utils/notifications';
import Logo from '../components/Logo';
import firebase from '../firebase.config';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase.config';

const HomeScreen = ({ navigation }) => {
  const [userName, setUserName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [userId, setUserId] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [incomingRingSender, setIncomingRingSender] = useState('');
  const [isRinging, setIsRinging] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef(null);
  const glowLoopRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const lastPartnerNameRef = useRef('');

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (!id) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          return;
        }

        if (!isMounted) {
          return;
        }

        setUserId(id);

        const userDoc = await db.collection('users').doc(id).get();
        if (!userDoc.exists) {
          setUserName('User');
          setPartnerName('Partner');
          setIsConnected(false);
          return;
        }

        const userData = userDoc.data() || {};
        const retrievedPartnerId = userData.partnerId || null;
        const linked = !!userData.linked && !!retrievedPartnerId;

        if (!linked) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'PartnerLink' }],
          });
          return;
        }

        let partnerDisplayName = userData.partnerName || 'Partner';
        if (retrievedPartnerId) {
          try {
            const partnerDoc = await db.collection('users').doc(retrievedPartnerId).get();
            if (partnerDoc.exists) {
              const partnerData = partnerDoc.data() || {};
              partnerDisplayName =
                partnerData.name || partnerData.partnerName || partnerDisplayName;
            }
          } catch (partnerError) {
            console.error('[Home] Failed to fetch partner profile:', partnerError);
          }
        }

        if (!isMounted) {
          return;
        }

        setUserName(userData.name || 'User');
        setPartnerName(partnerDisplayName || 'Partner');
        setIsConnected(linked);
        setPartnerId(retrievedPartnerId);
        lastPartnerNameRef.current = partnerDisplayName || 'Partner';

        await AsyncStorage.multiSet(
          [
            ['userName', userData.name || 'User'],
            ['partnerName', partnerDisplayName || 'Partner'],
            ['partnerId', retrievedPartnerId || ''],
          ].map(([key, value]) => [key, value ?? ''])
        );
      } catch (error) {
        console.error('[Home] Failed to load user profile:', error);
        Alert.alert('Error', 'We had trouble loading your profile. Please sign in again.', [
          {
            text: 'OK',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              }),
          },
        ]);
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    loadUserData();
    startAnimations();

    return () => {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
      if (glowLoopRef.current) {
        glowLoopRef.current.stop();
      }
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      isMounted = false;
    };
  }, [pulseAnim, glowAnim, navigation]);

  useEffect(() => {
    const setupPush = async () => {
      try {
        if (userId) {
          await registerForPushNotifications(userId);
        }
      } catch (error) {
        console.error('[Home] Failed to register push notifications:', error);
      }
    };

    setupPush();
  }, [userId]);

  useEffect(() => {
    lastPartnerNameRef.current = partnerName || '';
  }, [partnerName]);

  useEffect(() => {
    const handleIncomingRing = (senderName, data = {}) => {
      const displayName = senderName || data?.senderName || lastPartnerNameRef.current || 'Your partner';

      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
      }

      const vibrationPattern = [0, 900, 150, 900, 150, 900, 150, 900, 150, 900];
      Vibration.vibrate(vibrationPattern);
      setIncomingRingSender(displayName);
      setIsRinging(true);

      ringTimeoutRef.current = setTimeout(() => {
        Vibration.cancel();
        setIsRinging(false);
        ringTimeoutRef.current = null;
      }, 6000);
    };

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const { data = {} } = notification.request.content;
      if (data.type === 'ring') {
        handleIncomingRing(data.senderName, data);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const { data = {} } = response.notification.request.content;
      if (data.type === 'ring') {
        handleIncomingRing(data.senderName, data);
        navigation.navigate('Notification');
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      Vibration.cancel();
    };
  }, [navigation]);

  const startAnimations = () => {
    // Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    );
    pulseLoopRef.current = pulseLoop;
    pulseLoop.start();

    // Glow animation
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );
    glowLoopRef.current = glowLoop;
    glowLoop.start();
  };

  const handleRing = async () => {
    try {
      if (!isConnected) {
        Alert.alert(
          'Link with your partner',
          'You need to link with your partner before you can ring them.'
        );
        navigation.reset({
          index: 0,
          routes: [{ name: 'PartnerLink' }],
        });
        return;
      }

      if (!partnerId) {
        Alert.alert(
          'Partner not available',
          'We could not find your partner connection. Please re-link and try again.'
        );
        return;
      }

      // Send notification to partner
      const result = await sendRingNotification({
        partnerId,
        partnerName,
        senderName: userName,
      });

      if (!result?.delivered) {
        Alert.alert(
          'Ring pending',
          'We couldn\'t reach your partner\'s device. Ask them to open the app and allow notifications, then try again.'
        );
      }

      // Enhanced pulse animation on press
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    } catch (error) {
      alert('Failed to send ring: ' + error.message);
    }
  };

  const handleStopRing = () => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    Vibration.cancel();
    setIsRinging(false);
  };

  const handleLogout = async () => {
    try {
      await firebase.auth().signOut();
      await AsyncStorage.multiRemove([
        'userId',
        'userName',
        'partnerName',
        'userPhone',
        'userEmail',
        'userPassword',
        'partnerId',
      ]);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      alert('Failed to logout: ' + error.message);
    }
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      {isRinging && (
        <View style={styles.ringBanner}>
          <View style={styles.ringBannerLeft}>
            <Text style={styles.ringBannerTitle}>Sun&apos;s Thinking of the Moon 💕</Text>
            <Text style={styles.ringBannerText}>
              {incomingRingSender || partnerName || 'Your partner'} is ringing you!
            </Text>
          </View>
          <View style={styles.ringBannerActions}>
            <TouchableOpacity
              style={[styles.ringBannerButton, styles.ringBannerButtonPrimary]}
              onPress={() => {
                handleStopRing();
                navigation.navigate('Notification');
              }}
            >
              <Text style={[styles.ringBannerButtonText, styles.ringBannerButtonPrimaryText]}>
                View
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ringBannerButton} onPress={handleStopRing}>
              <Text style={styles.ringBannerButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.contentWrapper}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleLogout}
            accessibilityLabel="Logout"
          >
            <Ionicons name="log-out-outline" size={24} color={colors.primaryPurple} />
          </TouchableOpacity>
        </View>

        <View style={styles.logoSection}>
          <Logo size="large" />
        </View>

        <View style={styles.textSection}>
          <Text style={styles.greetingText}>
            {loadingProfile ? 'Loading your vibe…' : `Hey ${userName || 'there'} 👋`}
          </Text>
          <Text style={styles.partnerStatus}>
            {loadingProfile
              ? 'Checking your connection...'
              : isConnected
              ? `You’re linked with ${partnerName || 'your partner'} 💖`
              : 'Link with your partner to start sending love'}
          </Text>
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, isConnected && styles.statusDotActive]} />
            <Text style={styles.connectionText}>
              {isConnected ? 'Connected' : 'Awaiting partner'}
            </Text>
          </View>
        </View>

        <View style={styles.heartWrapper}>
          <Animated.View
            style={[
              styles.heartGlow,
              {
                opacity: glowOpacity,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.heartButton,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.heartButtonInner}
              onPress={handleRing}
              activeOpacity={0.85}
            >
              <Text style={styles.heartEmoji}>💞</Text>
              <Text style={styles.ringActionText}>Ring {partnerName || 'your partner'}</Text>
              <Text style={styles.ringHint}>Tap to send a burst of love</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.insightSection}>
          <Text style={styles.insightTitle}>Keep the spark alive ✨</Text>
          <Text style={styles.insightText}>
            Share a ring whenever they cross your mind—it’s the quickest way to say “I’m thinking of
            you.”
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 50,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 32,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  textSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  greetingText: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.primaryPurple,
    textAlign: 'center',
    marginBottom: 10,
  },
  partnerStatus: {
    fontSize: 16,
    color: colors.primaryPurple,
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 22,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.disconnected,
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: colors.connected,
  },
  connectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryPurple,
    opacity: 0.8,
  },
  heartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  heartGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 105, 180, 0.25)',
  },
  heartButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primaryPink,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  heartButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 76,
    marginBottom: 8,
  },
  ringActionText: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 0.8,
  },
  ringHint: {
    fontSize: 13,
    color: colors.textLight,
    opacity: 0.9,
    marginTop: 6,
  },
  insightSection: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryPurple,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: colors.primaryPurple,
    opacity: 0.7,
    lineHeight: 20,
    textAlign: 'center',
  },
  ringBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  ringBannerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  ringBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryPurple,
    marginBottom: 4,
  },
  ringBannerText: {
    fontSize: 13,
    color: colors.primaryPurple,
    opacity: 0.75,
    lineHeight: 18,
  },
  ringBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(246, 78, 159, 0.12)',
    marginLeft: 8,
  },
  ringBannerButtonPrimary: {
    backgroundColor: colors.primaryPink,
  },
  ringBannerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryPurple,
  },
  ringBannerButtonPrimaryText: {
    color: colors.textLight,
  },
});

export default HomeScreen;


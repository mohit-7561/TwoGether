import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '../components/CustomButton';
import { colors } from '../constants/colors';
import { sendRingNotification } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logo from '../components/Logo';

const NotificationScreen = ({ navigation, route }) => {
  const [partnerName, setPartnerName] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadPartnerName();
  }, []);

  const loadPartnerName = async () => {
    try {
      const entries = await AsyncStorage.multiGet(['partnerName', 'partnerId', 'userName']);
      const entryMap = Object.fromEntries(entries);
      setPartnerName(entryMap.partnerName || 'Partner');
      setPartnerId(entryMap.partnerId || '');
      setUserName(entryMap.userName || '');
    } catch (error) {
      console.error('[Notification] Failed to load cached partner details:', error);
      setPartnerName('Partner');
      setPartnerId('');
    }
  };

  const handleRingBack = async () => {
    try {
      if (!partnerId) {
        alert('We could not find your partner connection. Please re-link and try again.');
        return;
      }

      await sendRingNotification({
        partnerId,
        partnerName,
        senderName: userName,
      });
      navigation.goBack();
    } catch (error) {
      alert('Failed to ring back: ' + error.message);
    }
  };

  const handleSendEmoji = () => {
    // Navigate to emoji picker or show emoji options
    alert('Emoji feature coming soon!');
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Logo size="large" />
        </View>
        <View style={styles.messageContainer}>
          <Text style={styles.emoji}>💌</Text>
          <Text style={styles.message}>My Soul Remembers!</Text>
          <Text style={styles.subMessage}>
            {partnerName} is thinking of you 💕
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <CustomButton
            title="Ring back 💞"
            onPress={handleRingBack}
            style={styles.button}
          />

          <TouchableOpacity
            style={styles.emojiButton}
            onPress={handleSendEmoji}
          >
            <Text style={styles.emojiButtonText}>Send emoji ❤️😍😘</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  message: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primaryPurple,
    textAlign: 'center',
    marginBottom: 10,
  },
  subMessage: {
    fontSize: 18,
    color: colors.primaryPurple,
    textAlign: 'center',
    opacity: 0.8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    marginBottom: 16,
  },
  emojiButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryPink,
  },
  emojiButtonText: {
    color: colors.primaryPurple,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default NotificationScreen;


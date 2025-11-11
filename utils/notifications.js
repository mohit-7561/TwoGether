import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import firebase from '../firebase.config';
import { db } from '../firebase.config';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

let lastRegisteredUserId = null;
let lastRegisteredToken = null;

const collectExistingTokens = (data = {}) => {
  const tokens = [];

  if (Array.isArray(data.expoPushTokens)) {
    tokens.push(...data.expoPushTokens);
  }

  if (typeof data.expoPushToken === 'string') {
    tokens.push(data.expoPushToken);
  }

  if (Array.isArray(data.pushTokens)) {
    tokens.push(...data.pushTokens);
  }

  if (typeof data.pushToken === 'string') {
    tokens.push(data.pushToken);
  }

  return Array.from(new Set(tokens.filter(Boolean)));
};

const getExpoProjectId = () => {
  const easProjectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId;
  if (easProjectId) {
    return easProjectId;
  }
  return (
    Constants?.expoConfig?.extra?.expoGo?.projectId ||
    Constants?.expoConfig?.projectId ||
    null
  );
};

const saveExpoPushToken = async (userId, token) => {
  if (!userId || !token) {
    return;
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  const existingData = userSnap.exists ? userSnap.data() || {} : {};
  const tokens = collectExistingTokens(existingData);

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  await userRef.set(
    {
      expoPushTokens: tokens,
      notificationsEnabled: true,
      updatedAt: new Date().toISOString(),
      expoPushToken: firebase.firestore.FieldValue.delete(),
      pushToken: firebase.firestore.FieldValue.delete(),
      pushTokens: firebase.firestore.FieldValue.delete(),
    },
    { merge: true }
  );
};

const removeInvalidTokens = async (userId, tokensToRemove) => {
  if (!userId || !tokensToRemove?.length) {
    return;
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return;
  }

  const existingTokens = collectExistingTokens(userSnap.data() || {});
  const filteredTokens = existingTokens.filter(
    (token) => !tokensToRemove.includes(token)
  );

  await userRef.set(
    {
      expoPushTokens: filteredTokens,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
};

const notifyLocally = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('[Notifications] Failed to present local notification:', error);
  }
};

export const requestPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted');
    return false;
  }

  return true;
};

export const registerForPushNotifications = async (userId) => {
  try {
    if (!userId) {
      return null;
    }

    const permissionsGranted = await requestPermissions();
    if (!permissionsGranted) {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF00FF',
      });
    }

    if (!Device.isDevice) {
      console.warn('[Notifications] Push notifications require a physical device');
      return null;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn(
        '[Notifications] Missing Expo projectId. Define extra.eas.projectId in app.json or set EXPO_PROJECT_ID.'
      );
      return null;
    }
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      { projectId }
    );
    const token = tokenResponse?.data;

    if (!token) {
      console.warn('[Notifications] No Expo push token retrieved');
      return null;
    }

    if (lastRegisteredUserId === userId && lastRegisteredToken === token) {
      return token;
    }

    await saveExpoPushToken(userId, token);
    lastRegisteredUserId = userId;
    lastRegisteredToken = token;

    return token;
  } catch (error) {
    console.error('[Notifications] Failed to register device push token:', error);
    return null;
  }
};

const fetchPartnerNotificationTargets = async (partnerId) => {
  if (!partnerId) {
    throw new Error('Partner ID is required for notification.');
  }

  const partnerSnap = await db.collection('users').doc(partnerId).get();
  if (!partnerSnap.exists) {
    throw new Error('We could not find your partner profile.');
  }

  const partnerData = partnerSnap.data() || {};
  const tokens = collectExistingTokens(partnerData);

  return {
    partnerData,
    tokens,
  };
};

const dispatchExpoNotification = async (
  partnerId,
  tokens,
  payload,
  fallbackMessage = null
) => {
  if (!tokens.length) {
    if (fallbackMessage) {
      await notifyLocally(payload.title, fallbackMessage, payload.data);
    }
    return { delivered: 0, tokens: [] };
  }

  const invalidTokens = [];
  let deliveredCount = 0;

  for (const token of tokens) {
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data: {
            ...payload.data,
            timestamp: Date.now(),
          },
        }),
      });

      const result = await response.json();
      const status = result?.data?.status;

      if (status === 'ok') {
        deliveredCount += 1;
      } else {
        const errorCode =
          result?.data?.details?.error ||
          result?.data?.message ||
          'unknown-error';
        console.warn('[Notifications] Push send failed:', errorCode);
        if (errorCode === 'DeviceNotRegistered' || errorCode === 'InvalidCredentials') {
          invalidTokens.push(token);
        }
      }
    } catch (innerError) {
      console.error('[Notifications] Push send error:', innerError);
    }
  }

  if (invalidTokens.length) {
    await removeInvalidTokens(partnerId, invalidTokens);
  }

  if (!deliveredCount && fallbackMessage) {
    await notifyLocally(payload.title, fallbackMessage, payload.data);
  }

  return { delivered: deliveredCount, tokens };
};

export const sendRingNotification = async ({ partnerId, partnerName, senderName }) => {
  try {
    const { partnerData, tokens } = await fetchPartnerNotificationTargets(partnerId);

    const title = "Sun's Thinking of the Moon \uD83D\uDC95";
    const body = senderName
      ? `${senderName} is thinking of you!`
      : 'Your partner is thinking of you!';

    return dispatchExpoNotification(
      partnerId,
      tokens,
      {
        title,
        body,
        data: {
          type: 'ring',
          senderName: senderName || '',
          partnerName: partnerName || partnerData.name || '',
        },
      }
    );
  } catch (error) {
    console.error('[Notifications] Failed to send ring notification:', error);
    throw new Error('Failed to send notification: ' + error.message);
  }
};

export const sendPartnerLinkedNotification = async ({
  partnerId,
  partnerName,
  senderName,
}) => {
  try {
    const { partnerData, tokens } = await fetchPartnerNotificationTargets(partnerId);

    const title = 'You are now linked! \uD83D\uDC96';
    const body = senderName
      ? `${senderName} just linked hearts with you.`
      : 'Your partner just linked hearts with you.';

    return dispatchExpoNotification(
      partnerId,
      tokens,
      {
        title,
        body,
        data: {
          type: 'linked',
          senderName: senderName || '',
          partnerName: partnerName || partnerData.name || '',
        },
      },
      partnerName
        ? `Linked with ${partnerName}! Ask them to open the app to see the connection.`
        : 'Link successful! Ask your partner to open the app to see the connection.'
    );
  } catch (error) {
    console.error('[Notifications] Failed to send linked notification:', error);
    throw new Error('Failed to send notification: ' + error.message);
  }
};

export const setupNotificationListeners = (navigation) => {
  // Handle notification received while app is in foreground
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
  });

  // Handle notification tapped
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (data.type === 'ring') {
      navigation.navigate('Notification');
    }
  });
};

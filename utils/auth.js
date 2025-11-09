import firebase from '../firebase.config';
import { db } from '../firebase.config';
import * as Crypto from 'expo-crypto';

export const signUpWithEmail = async (email, password) => {
  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const signInWithEmailAndPassword = async (email, password) => {
  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const signInWithPhoneNumber = async (phoneNumber, verifier) => {
  try {
    if (!verifier) {
      throw new Error('App verifier is required for phone sign-in.');
    }
    const confirmation = await firebase.auth().signInWithPhoneNumber(phoneNumber, verifier);
    return confirmation;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const verifyOTP = async (verificationId, otpCode) => {
  try {
    const credential = firebase.auth.PhoneAuthProvider.credential(verificationId, otpCode);
    const userCredential = await firebase.auth().signInWithCredential(credential);
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message || 'Failed to verify OTP.');
  }
};

export const createUser = async (userId, userData) => {
  try {
    console.log('[createUser] Writing user document for:', userId);

    let phonePasswordHash = null;
    if (userData?.phoneNumber && userData?.password) {
      const normalizedPassword = userData.password.trim();
      if (normalizedPassword) {
        phonePasswordHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          normalizedPassword
        );
      }
    }

    const payload = {
      name: userData.yourName,
      partnerName: userData.partnerName,
      email: userData.email,
      phoneNumber: userData.phoneNumber,
      gender: userData.gender,
      anniversaryDate: userData.anniversaryDate || null,
      createdAt: new Date().toISOString(),
      linked: false,
    };

    if (phonePasswordHash) {
      payload.phonePasswordHash = phonePasswordHash;
    }

    await db.collection('users').doc(userId).set(payload, { merge: true });
    console.log('[createUser] User document write complete for:', userId);
  } catch (error) {
    console.error('[createUser] Failed to write user document:', error);
    throw new Error('Failed to create user: ' + error.message);
  }
};

export const getUserProfile = async (userId) => {
  try {
    const docSnap = await db.collection('users').doc(userId).get();
    if (!docSnap.exists) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('[getUserProfile] Failed to fetch user profile:', error);
    throw new Error('Failed to fetch user profile.');
  }
};

export const getUserByPhoneNumber = async (phoneNumber) => {
  try {
    const querySnapshot = await db
      .collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('[getUserByPhoneNumber] Failed to fetch user by phone number:', error);
    throw new Error('Failed to fetch account by phone number.');
  }
};

const generateCandidateInviteCode = async (seed) => {
  if (seed) {
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        seed
      );
      return hash.substring(0, 6).toUpperCase();
    } catch (error) {
      console.warn('[createUniqueInviteCode] Failed to create hash-based code, falling back to random:', error);
    }
  }
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createUniqueInviteCode = async (userId) => {
  const attempted = new Set();

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const seed =
      attempt === 0 && userId
        ? `${userId}`.trim()
        : `${userId || 'anon'}-${Date.now()}-${Math.random()}`;
    const candidate = await generateCandidateInviteCode(seed);

    if (!candidate || attempted.has(candidate)) {
      continue;
    }

    attempted.add(candidate);

    const existing = await db
      .collection('users')
      .where('inviteCode', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) {
      return candidate;
    }
  }

  throw new Error('Failed to generate unique invite code. Please try again.');
};

export const ensureInviteCodeForUser = async (userId) => {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error('User profile not found.');
  }

  const data = userSnap.data();
  if (data?.inviteCode) {
    const duplicates = await db
      .collection('users')
      .where('inviteCode', '==', data.inviteCode)
      .get();

    const uniqueToCurrentUser =
      duplicates.size === 1 && duplicates.docs[0]?.id === userId;

    if (uniqueToCurrentUser) {
      return data.inviteCode;
    }
  }

  const inviteCode = await createUniqueInviteCode(userId);
  await userRef.set({ inviteCode }, { merge: true });
  return inviteCode;
};

export const refreshInviteCode = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required to refresh invite code.');
  }

  const userRef = db.collection('users').doc(userId);

  const newInviteCode = await createUniqueInviteCode(userId);
  await userRef.set(
    {
      inviteCode: newInviteCode,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return newInviteCode;
};

export const findUserByInviteCode = async (inviteCode) => {
  const trimmed = inviteCode?.trim().toUpperCase();
  if (!trimmed) {
    throw new Error('Invite code is required.');
  }

  const snapshot = await db
    .collection('users')
    .where('inviteCode', '==', trimmed)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

export const linkUserProfiles = async (userId, partnerId) => {
  if (!userId) {
    throw new Error('Missing user ID.');
  }
  if (!partnerId) {
    throw new Error('Missing partner ID.');
  }
  if (userId === partnerId) {
    throw new Error('You cannot link with your own invite code.');
  }

  return db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const partnerRef = db.collection('users').doc(partnerId);

    const userSnap = await transaction.get(userRef);
    const partnerSnap = await transaction.get(partnerRef);

    if (!userSnap.exists) {
      throw new Error('Your profile data is missing.');
    }
    if (!partnerSnap.exists) {
      throw new Error('Partner profile not found.');
    }

    const userData = userSnap.data() || {};
    const partnerData = partnerSnap.data() || {};

    if (
      userData.linked &&
      userData.partnerId &&
      userData.partnerId !== partnerId
    ) {
      throw new Error('Your account is already linked with another partner.');
    }

    if (
      partnerData.linked &&
      partnerData.partnerId &&
      partnerData.partnerId !== userId
    ) {
      throw new Error(`${partnerData.name || 'This partner'} is already linked with someone else.`);
    }

    // Already linked together - no further action needed.
    if (
      userData.linked &&
      partnerData.linked &&
      userData.partnerId === partnerId &&
      partnerData.partnerId === userId
    ) {
      return {
        user: { id: userId, ...userData },
        partner: { id: partnerId, ...partnerData },
      };
    }

    const timestamp = new Date().toISOString();
    const partnerDisplayName = partnerData.name || partnerData.partnerName || '';
    const userDisplayName = userData.name || userData.partnerName || '';

    transaction.set(
      userRef,
      {
        linked: true,
        partnerId,
        partnerName: partnerDisplayName,
        partnerInviteCode: partnerData.inviteCode || null,
        linkedAt: timestamp,
      },
      { merge: true }
    );

    transaction.set(
      partnerRef,
      {
        linked: true,
        partnerId: userId,
        partnerName: userDisplayName,
        partnerInviteCode: userData.inviteCode || null,
        linkedAt: partnerData.linkedAt || timestamp,
      },
      { merge: true }
    );

    return {
      user: {
        id: userId,
        ...userData,
        linked: true,
        partnerId,
        partnerName: partnerDisplayName,
        partnerInviteCode: partnerData.inviteCode || null,
        linkedAt: timestamp,
      },
      partner: {
        id: partnerId,
        ...partnerData,
        linked: true,
        partnerId: userId,
        partnerName: userDisplayName,
        partnerInviteCode: userData.inviteCode || null,
        linkedAt: partnerData.linkedAt || timestamp,
      },
    };
  });
};


import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCLUAx9oD6TAjKOFFsgaamriXc9fSCvnDY",
  authDomain: "twogether-68315.firebaseapp.com",
  projectId: "twogether-68315",
  storageBucket: "twogether-68315.firebasestorage.app",
  messagingSenderId: "328758396203",
  appId: "1:328758396203:android:a4f75faff6ee892d33f16e"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();

export default firebase;


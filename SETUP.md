# TwoGether App Setup Guide

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase account

## Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Firebase Configuration**
   - Go to Firebase Console (https://console.firebase.google.com/)
   - Create a new project or use existing one
   - Enable Authentication (Email/Password and Phone)
   - Enable Firestore Database
   - Enable Cloud Messaging (for push notifications)
   - Copy your Firebase config and update `firebase.config.js`:
     ```javascript
     const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_AUTH_DOMAIN",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_STORAGE_BUCKET",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID"
     };
     ```

3. **Firestore Setup**
   - Create a collection named `users` in Firestore
   - Set up security rules (for development, you can use test mode)

4. **Run the App**
   ```bash
   npm start
   ```
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your phone

## Project Structure

```
Twogether/
├── App.jsx                 # Main entry point
├── firebase.config.js      # Firebase configuration
├── screens/               # All app screens
│   ├── SplashScreen.jsx
│   ├── LoginScreen.jsx
│   ├── SignUpScreen.jsx
│   ├── OTPScreen.jsx
│   ├── PartnerLinkScreen.jsx
│   ├── HomeScreen.jsx
│   └── NotificationScreen.jsx
├── components/            # Reusable components
│   ├── Logo.jsx
│   ├── CustomButton.jsx
│   └── CustomInput.jsx
├── utils/                 # Utility functions
│   ├── auth.js
│   └── notifications.js
└── constants/             # Constants and theme
    └── colors.js
```

## Features Implemented

✅ Splash screen with animated logo
✅ Login/Signup screens matching design
✅ OTP verification flow
✅ Partner linking with invite codes
✅ Home screen with ring button
✅ Push notifications setup
✅ Firebase authentication
✅ Firestore database integration

## Next Steps

1. Add date picker for anniversary date
2. Implement proper gender selection modal
3. Set up Firebase Cloud Messaging (FCM) for real-time notifications
4. Add partner matching logic
5. Implement emoji picker
6. Add profile screen
7. Add settings screen

## Notes

- All screens use `.jsx` extension as requested
- Design matches the provided images with gradient backgrounds
- Color scheme: Light pink to purple gradient, vibrant pink buttons, dark purple text
- Logo component with heart animation


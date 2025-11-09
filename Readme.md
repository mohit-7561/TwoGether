I want to build a React Native mobile app called “TwoGether”
This app connects two partners through a shared invitation link and lets them interact in a simple emotional way.


TECH STACK- React Native(Expo), Firebase, 

💞 Partner App – Flow Overview
1. Splash Screen

App logo animation (heart pulse or wave).

Brief text: “Connecting Hearts…”

After 2–3 seconds → navigates to Login/Signup screen.

2. Signup Flow

Page Title: “Create Your Account 💕”
Fields:

Your Name
Your Partner's Name
Phone Number
email
Create password
Confirm password
Gender
Anniversary Date(optional)




“Continue” button → triggers OTP verification

OTP Verification:

User receives OTP via Firebase SMS.

After successful verification → user is created in Firestore.

2. LogIn Flow

email or phone number(user should enter either phone or email to signIn)
Password


3. Invite / Link Partner Screen

Title: “Link with your Partner 💑”

Two options:

a. Share Invite Code / Link

User gets a unique invite link (like https://soulink.app/invite/ABC123).

They can share it through WhatsApp, SMS, etc.

b. Enter Partner Code

The partner enters the code they received.

Once matched, both accounts get linked:

After linking → redirect to Home Screen.


4. Home Screen (Main Interaction)

Header: “Hey Mohit 👋”
Subtext: “You’re linked with Ayeshu 💖”

Main Button:

A large heart button labeled “💞 Ring Ayeshu”.

When pressed:

Sends a Firebase Cloud Message to Ayeshu’s phone.

On Ayeshu’s phone → plays sound / vibration + popup “Sun's Thinking of the Moon 💕”.

Extra touches:

Heart button animates (pulse or glow).

Small “Connected” indicator.



5. Notification Screen (optional for later)

When a partner receives the ring, it shows:

“💌 My Soul Remembers!”

With options:

“Ring back 💞”

“Send emoji ❤️😍😘”

# MUTTHI PANEL

A Firebase Web SDK admin dashboard starter inspired by dark admin panels. It supports:
- Firebase Email/Password sign-in
- Cloud Firestore collection document listing, adding, and deleting
- Realtime Database path read/write
- Cloud Storage upload, list, download URL, and delete
- Responsive dark UI

## Requirements
- Node.js 20.19+ or 22.12+
- A Firebase project

## Setup
1. Extract the ZIP.
2. Open a terminal in this folder and run `npm install`.
3. In Firebase Console, add a Web App and copy its config.
4. Paste the config values into `src/firebase.js`.
5. In Firebase Console, enable Authentication > Email/Password.
6. Create your administrator account in Firebase Authentication. This starter intentionally has no public sign-up form.
7. Enable only the Firebase services you intend to use.
8. Configure restrictive Firestore, Realtime Database, and Storage security rules for your admin accounts.
9. Run `npm run dev` for local testing.
10. Run `npm run build`; deploy the generated `dist/` folder to Firebase Hosting or Vercel.

## Important security notes
- Firebase Web config is not a secret, but it does not grant administrator privileges.
- All database and storage access is governed by Firebase Security Rules. Do not use public read/write rules.
- Client-side Firebase Auth cannot list every Authentication user or safely perform privileged account administration. For that, add a trusted server using Firebase Admin SDK, verify ID tokens, and enforce an admin claim/allowlist.
- Never put a Firebase service-account JSON file or private key in this frontend or in a public repository.
- Use HTTPS and consider Firebase App Check.
- Test your rules with the Firebase Emulator Suite before production.

## Current limitations
The Authentication section provides secure sign-in only. Listing/deleting all Firebase Auth users is intentionally not included because that requires a trusted Admin SDK backend.

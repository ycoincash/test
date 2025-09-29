// This file is for SERVER-SIDE use only. Do not import in client components.
// Firebase Admin SDK - only works on server side
let adminAuth: any;
let adminDb: any;

// Only initialize on server side
if (typeof window === 'undefined') {
  try {
    const admin = require('firebase-admin');
    const { getApps } = require('firebase-admin/app');

    // This is a more secure way to load credentials on the server.
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf-8')
      : null;

    const serviceAccount = serviceAccountKey ? JSON.parse(serviceAccountKey) : null;

    if (!getApps().length) {
      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin SDK initialized with service account.');
      } else {
        // This will work in environments like Cloud Run, Cloud Functions, App Engine
        admin.initializeApp();
        console.log('Firebase Admin SDK initialized with Application Default Credentials.');
      }
    }

    adminAuth = admin.auth();
    adminDb = admin.firestore();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
  }
}

export { adminAuth, adminDb };

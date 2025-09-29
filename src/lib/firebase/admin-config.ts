// This file is for SERVER-SIDE use only. Do not import in client components.
import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// This is a more secure way to load credentials on the server.
// It assumes you have set up Google Application Default Credentials.
// https://cloud.google.com/docs/authentication/provide-credentials-adc
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

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

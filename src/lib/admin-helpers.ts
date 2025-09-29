'use server';

import { adminAuth, adminDb } from './firebase/admin-config';
import { auth } from './firebase/config';
import { headers } from 'next/headers';

/**
 * Verifies that the provided user ID belongs to an admin
 * This is used for server actions where we pass the UID from the client
 * 
 * @param uid - The user ID to verify
 * @throws Error if user is not an admin
 */
export async function verifyAdminAccess(uid: string): Promise<void> {
  if (!uid) {
    throw new Error('Unauthorized: No user ID provided');
  }

  try {
    // Get user from Firebase Admin SDK
    const userRecord = await adminAuth.getUser(uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      throw new Error('Unauthorized: Admin access required');
    }
  } catch (error: any) {
    console.error('Admin verification failed:', error);
    throw new Error('Unauthorized: ' + (error.message || 'Admin verification failed'));
  }
}

/**
 * Gets the authenticated user's UID from the client
 * This should be called from the client-side before calling server actions
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  // This is a server function but we expect the UID to be passed from client
  // The client will use Firebase Auth to get the current user's UID
  return null;
}

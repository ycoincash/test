import { headers } from 'next/headers';
import { adminAuth } from './firebase/admin-config';

/**
 * Verifies the Firebase ID token from the Authorization header
 * Returns the decoded token if valid, throws error if invalid
 * NOTE: This only works with API routes, not Server Actions
 */
export async function verifyAuthToken() {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verifies that the provided UID belongs to an admin user
 * This should be called from Server Actions with the UID from the client
 * @param uid The user ID to verify
 */
export async function verifyAdminByUid(uid: string) {
  if (!uid) {
    throw new Error('Unauthorized: No user ID provided');
  }
  
  try {
    const userRecord = await adminAuth.getUser(uid);
    const customClaims = userRecord.customClaims || {};
    
    if (!customClaims.admin) {
      throw new Error('Unauthorized: Admin access required');
    }
    
    return { uid, admin: true };
  } catch (error) {
    console.error('Admin verification failed:', error);
    throw new Error('Unauthorized: Admin verification failed');
  }
}

/**
 * Verifies that the current user is an admin (for API routes with Authorization header)
 * Throws error if not authenticated or not an admin
 */
export async function verifyAdminToken() {
  const decodedToken = await verifyAuthToken();
  
  if (!decodedToken.admin) {
    throw new Error('Unauthorized: Admin access required');
  }
  
  return decodedToken;
}

/**
 * Gets the current authenticated user's UID (for API routes)
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const decodedToken = await verifyAuthToken();
    return decodedToken.uid;
  } catch {
    return null;
  }
}

/**
 * Verifies an ID token passed from the client (for Server Actions)
 * @param idToken The Firebase ID token from the client
 * @returns The decoded token containing uid and custom claims
 * @throws Error if token is invalid or expired
 */
export async function verifyClientIdToken(idToken: string) {
  if (!idToken) {
    throw new Error('No ID token provided');
  }
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Client ID token verification failed:', error);
    throw new Error('Invalid or expired authentication token');
  }
}

/**
 * Checks if the current user owns the specified resource (for API routes)
 * @param resourceUserId The userId field from the resource
 */
export async function verifyResourceOwnership(resourceUserId: string) {
  const decodedToken = await verifyAuthToken();
  
  if (decodedToken.uid !== resourceUserId && !decodedToken.admin) {
    throw new Error('Unauthorized: You do not have permission to access this resource');
  }
  
  return decodedToken;
}

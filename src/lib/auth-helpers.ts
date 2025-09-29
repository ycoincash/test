import { headers } from 'next/headers';
import { adminAuth } from './firebase/admin-config';

/**
 * Verifies the Firebase ID token from the Authorization header
 * Returns the decoded token if valid, throws error if invalid
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
 * Verifies that the current user is an admin
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
 * Gets the current authenticated user's UID
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
 * Checks if the current user owns the specified resource
 * @param resourceUserId The userId field from the resource
 */
export async function verifyResourceOwnership(resourceUserId: string) {
  const decodedToken = await verifyAuthToken();
  
  if (decodedToken.uid !== resourceUserId && !decodedToken.admin) {
    throw new Error('Unauthorized: You do not have permission to access this resource');
  }
  
  return decodedToken;
}

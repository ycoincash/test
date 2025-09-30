import 'server-only';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getServerConfig } from '@/lib/firebase/auth-edge-config';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  customClaims?: {
    admin?: boolean;
    [key: string]: any;
  };
}

/**
 * Get authenticated user from HTTP-only cookies in server actions
 * Throws an error if no valid session exists
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const config = getServerConfig();
  
  // Debug: log all cookies
  const allCookies = cookieStore.getAll();
  console.log('Available cookies:', allCookies.map(c => c.name));
  
  const token = cookieStore.get(config.cookieName)?.value;
  
  if (!token) {
    console.error('No session cookie found. Looking for:', config.cookieName);
    throw new Error('Unauthorized: No session cookie found');
  }

  try {
    const tokens = await getTokens(cookieStore, {
      serviceAccount: config.serviceAccount,
      apiKey: config.apiKey,
      cookieName: config.cookieName,
      cookieSignatureKeys: config.cookieSignatureKeys,
      cookieSerializeOptions: config.cookieSerializeOptions,
    });

    if (!tokens) {
      throw new Error('No valid tokens found');
    }

    return {
      uid: tokens.decodedToken.uid,
      email: tokens.decodedToken.email || null,
      emailVerified: tokens.decodedToken.email_verified || false,
      customClaims: tokens.decodedToken as any,
    };
  } catch (error) {
    console.error('Failed to verify session token:', error);
    throw new Error('Unauthorized: Invalid session token');
  }
}

/**
 * Get authenticated user or return null if no valid session
 * Use this when authentication is optional
 */
export async function getAuthenticatedUserOrNull(): Promise<AuthenticatedUser | null> {
  try {
    return await getAuthenticatedUser();
  } catch {
    return null;
  }
}

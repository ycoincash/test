import { Tokens } from 'next-firebase-auth-edge';

export interface ServerConfig {
  serviceAccount: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  apiKey: string;
  cookieName: string;
  cookieSignatureKeys: string[];
  cookieSerializeOptions: {
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    maxAge: number;
  };
}

function getFirebaseAdminCredentials() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf-8')
    : null;

  if (!serviceAccountKey) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64');
  }

  const serviceAccount = JSON.parse(serviceAccountKey);

  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  };
}

export function getServerConfig(): ServerConfig {
  const credentials = getFirebaseAdminCredentials();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const cookieSignatureKeys = process.env.COOKIE_SIGNATURE_KEYS;

  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY');
  }

  if (!cookieSignatureKeys) {
    throw new Error('Missing COOKIE_SIGNATURE_KEYS');
  }

  return {
    serviceAccount: credentials,
    apiKey,
    cookieName: 'AuthToken',
    cookieSignatureKeys: JSON.parse(cookieSignatureKeys),
    cookieSerializeOptions: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 24, // 12 days
    },
  };
}

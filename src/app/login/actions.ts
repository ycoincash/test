'use server';

import { logUserActivity } from '@/app/admin/actions';
import { getClientSessionInfo } from '@/lib/device-info';

export async function logLoginActivity(userId: string) {
  try {
    const clientInfo = await getClientSessionInfo();
    await logUserActivity(userId, 'login', clientInfo);
    return { success: true };
  } catch (error) {
    console.error('Failed to log login activity:', error);
    return { success: false };
  }
}

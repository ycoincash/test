
'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import { getAuthenticatedUser } from '@/lib/auth/server-auth';
import type { Withdrawal } from '@/types';

export async function getWalletHistory(): Promise<{ withdrawals: Withdrawal[] }> {
    // Get the authenticated user from session cookies
    const { uid: userId } = await getAuthenticatedUser();
    try {
        // Use Admin SDK to bypass Firestore rules (server-side only)
        const withdrawalsSnap = await adminDb.collection('withdrawals')
            .where('userId', '==', userId)
            .get();

        const withdrawals = withdrawalsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                requestedAt: data.requestedAt?.toDate() || new Date(),
                completedAt: data.completedAt?.toDate(),
            } as Withdrawal;
        });

        // Sort descending by request date
        withdrawals.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

        return { withdrawals };

    } catch (error) {
        console.error("Error fetching wallet history:", error);
        return { withdrawals: [] };
    }
}

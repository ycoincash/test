
'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import { verifyClientIdToken } from '@/lib/auth-helpers';
import type { Withdrawal } from '@/types';

export async function getWalletHistory(idToken: string): Promise<{ withdrawals: Withdrawal[] }> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
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

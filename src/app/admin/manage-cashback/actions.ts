
'use server';

import { db } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, runTransaction, increment, getDocs, query, Timestamp, orderBy } from 'firebase/firestore';
import type { CashbackTransaction, UserProfile } from '@/types';
import { createNotification, awardReferralCommission } from '../actions';

async function verifyAdmin() {
    // Placeholder for real admin verification
    return true;
}

const safeToDate = (timestamp: any): Date | undefined => {
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    return undefined;
};


export async function addCashbackTransaction(data: Omit<CashbackTransaction, 'id' | 'date'>) {
    await verifyAdmin();
    try {
        // Step 1: Run the primary transaction for the user receiving cashback.
        await runTransaction(db, async (transaction) => {
            const newTransactionRef = doc(collection(db, 'cashbackTransactions'));
            transaction.set(newTransactionRef, {
                ...data,
                date: serverTimestamp(),
            });

            const userRef = doc(db, 'users', data.userId);
            transaction.update(userRef, { 
                status: 'Trader', 
                monthlyEarnings: increment(data.cashbackAmount) 
            });

            const message = `لقد تلقيت ${data.cashbackAmount.toFixed(2)}$ كاش باك للحساب ${data.accountNumber}.`;
            await createNotification(transaction, data.userId, message, 'cashback', '/dashboard/transactions');
        });

        // Step 2: After the primary transaction succeeds, award commission in a separate, non-blocking operation.
        // This was the line that was mistakenly removed.
        await awardReferralCommission(data.userId, 'cashback', data.cashbackAmount);

        return { success: true, message: 'تمت إضافة معاملة الكاش باك بنجاح.' };

    } catch (error) {
        console.error("Error adding cashback transaction:", error);
        return { success: false, message: 'فشل إضافة معاملة الكاش باك.' };
    }
}

export async function getCashbackHistory(): Promise<(CashbackTransaction & { userProfile?: Partial<UserProfile> })[]> {
    await verifyAdmin();
    const [transactionsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "cashbackTransactions"), orderBy("date", "desc"))),
        getDocs(collection(db, 'users'))
    ]);

    const usersMap = new Map(usersSnap.docs.map(doc => [doc.id, doc.data() as UserProfile]));

    return transactionsSnap.docs.map(doc => {
        const data = doc.data() as CashbackTransaction;
        const userProfile = usersMap.get(data.userId);
        return {
            ...data,
            id: doc.id,
            date: safeToDate(data.date) || new Date(),
            userProfile: userProfile ? { name: userProfile.name, email: userProfile.email, clientId: userProfile.clientId } : undefined
        };
    });
}

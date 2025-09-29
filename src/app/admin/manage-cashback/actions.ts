'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { CashbackTransaction, UserProfile } from '@/types';
import { createNotification, awardReferralCommission } from '../actions';

const safeToDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp?._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  if (typeof timestamp?.toDate === 'function') {
    return timestamp.toDate();
  }
  return undefined;
};

export async function addCashbackTransaction(
  data: Omit<CashbackTransaction, 'id' | 'date'>
) {
  try {
    // Step 1: Run the primary transaction for the user receiving cashback
    await adminDb.runTransaction(async (transaction) => {
      const newTransactionRef = adminDb.collection('cashbackTransactions').doc();
      transaction.set(newTransactionRef, {
        ...data,
        date: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userRef = adminDb.collection('users').doc(data.userId);
      transaction.update(userRef, {
        status: 'Trader',
        monthlyEarnings: admin.firestore.FieldValue.increment(data.cashbackAmount),
      });

      const message = `لقد تلقيت ${data.cashbackAmount.toFixed(
        2
      )}$ كاش باك للحساب ${data.accountNumber}.`;
      await createNotification(
        transaction,
        data.userId,
        message,
        'cashback',
        '/dashboard/transactions'
      );
    });

    // Step 2: After the primary transaction succeeds, award commission in a separate operation
    await awardReferralCommission(data.userId, 'cashback', data.cashbackAmount);

    return { success: true, message: 'تمت إضافة معاملة الكاش باك بنجاح.' };
  } catch (error) {
    console.error('Error adding cashback transaction:', error);
    return { success: false, message: 'فشل إضافة معاملة الكاش باك.' };
  }
}

export async function getCashbackHistory(): Promise<
  (CashbackTransaction & { userProfile?: Partial<UserProfile> })[]
> {
  const [transactionsSnap, usersSnap] = await Promise.all([
    adminDb.collection('cashbackTransactions').orderBy('date', 'desc').get(),
    adminDb.collection('users').get(),
  ]);

  const usersMap = new Map(
    usersSnap.docs.map((doc) => [doc.id, doc.data() as UserProfile])
  );

  return transactionsSnap.docs.map((doc) => {
    const data = doc.data() as CashbackTransaction;
    const userProfile = usersMap.get(data.userId);
    return {
      ...data,
      id: doc.id,
      date: safeToDate(data.date) || new Date(),
      userProfile: userProfile
        ? { name: userProfile.name, email: userProfile.email, clientId: userProfile.clientId }
        : undefined,
    };
  });
}

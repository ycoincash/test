'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { Withdrawal } from '@/types';
import { createNotification } from '../actions';

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

export async function getWithdrawals(): Promise<Withdrawal[]> {
  const withdrawalsSnapshot = await adminDb
    .collection('withdrawals')
    .orderBy('requestedAt', 'desc')
    .get();

  const withdrawals: Withdrawal[] = [];

  withdrawalsSnapshot.docs.forEach((doc) => {
    try {
      const data = doc.data();
      withdrawals.push({
        id: doc.id,
        ...data,
        requestedAt: safeToDate(data.requestedAt) || new Date(),
        completedAt: safeToDate(data.completedAt),
        previousWithdrawalDetails: null,
      } as Withdrawal);
    } catch (error) {
      console.error(`Error processing withdrawal ${doc.id}:`, error);
    }
  });

  return withdrawals;
}

export async function approveWithdrawal(withdrawalId: string, txId: string) {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const withdrawalRef = adminDb.collection('withdrawals').doc(withdrawalId);
      const withdrawalSnap = await transaction.get(withdrawalRef);

      if (!withdrawalSnap.exists) {
        throw new Error('لم يتم العثور على طلب السحب');
      }

      const withdrawalData = withdrawalSnap.data() as Withdrawal;

      transaction.update(withdrawalRef, {
        status: 'Completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        txId: txId,
        rejectionReason: '',
      });

      const message = `تم إكمال طلب السحب الخاص بك بمبلغ ${withdrawalData.amount.toFixed(
        2
      )}$.`;
      await createNotification(
        transaction,
        withdrawalData.userId,
        message,
        'withdrawal',
        '/dashboard/withdraw'
      );
    });

    return { success: true, message: 'تمت الموافقة على السحب بنجاح مع TXID.' };
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    return { success: false, message: 'فشل الموافقة على السحب.' };
  }
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const withdrawalRef = adminDb.collection('withdrawals').doc(withdrawalId);
      const withdrawalSnap = await transaction.get(withdrawalRef);

      if (!withdrawalSnap.exists) {
        throw new Error('لم يتم العثور على طلب السحب');
      }

      const withdrawalData = withdrawalSnap.data() as Withdrawal;

      if (!reason) throw new Error('سبب الرفض مطلوب.');

      transaction.update(withdrawalRef, { status: 'Failed', rejectionReason: reason });

      const message = `فشل طلب السحب الخاص بك بمبلغ ${withdrawalData.amount.toFixed(
        2
      )}$. السبب: ${reason}`;
      await createNotification(
        transaction,
        withdrawalData.userId,
        message,
        'withdrawal',
        '/dashboard/withdraw'
      );
    });

    return { success: true, message: `تم تحديث حالة السحب إلى "فشل".` };
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف';
    return { success: false, message: `فشل رفض السحب: ${errorMessage}` };
  }
}

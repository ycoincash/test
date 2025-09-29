'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { TradingAccount } from '@/types';
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

export async function getTradingAccounts(): Promise<TradingAccount[]> {
  const accountsSnapshot = await adminDb.collection('tradingAccounts').get();
  const accounts: TradingAccount[] = [];

  accountsSnapshot.docs.forEach((doc) => {
    try {
      const data = doc.data();
      accounts.push({
        id: doc.id,
        ...data,
        createdAt: safeToDate(data.createdAt) || new Date(),
      } as TradingAccount);
    } catch (error) {
      console.error(`Error processing trading account ${doc.id}:`, error);
    }
  });

  return accounts;
}

export async function updateTradingAccountStatus(
  accountId: string,
  status: 'Approved' | 'Rejected',
  reason?: string
) {
  return adminDb
    .runTransaction(async (transaction) => {
      const accountRef = adminDb.collection('tradingAccounts').doc(accountId);
      const accountSnap = await transaction.get(accountRef);

      if (!accountSnap.exists) {
        throw new Error('لم يتم العثور على الحساب');
      }

      const currentData = accountSnap.data() as TradingAccount;
      if (currentData.status !== 'Pending') {
        throw new Error(`لا يمكن تحديث الحساب. الحالة الحالية هي ${currentData.status}.`);
      }

      const updateData: { status: 'Approved' | 'Rejected'; rejectionReason?: string } = {
        status,
      };
      let message = `تم ${status === 'Approved' ? 'الموافقة على' : 'رفض'} حساب التداول الخاص بك ${
        currentData.accountNumber
      }.`;

      if (status === 'Rejected') {
        if (!reason) throw new Error('سبب الرفض مطلوب.');
        updateData.rejectionReason = reason;
        message += ` السبب: ${reason}`;
      } else {
        // Update user status to 'Active' if they were 'NEW'
        const userRef = adminDb.collection('users').doc(currentData.userId);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists && userSnap.data()?.status === 'NEW') {
          transaction.update(userRef, { status: 'Active' });
        }
        updateData.rejectionReason = '';
      }

      transaction.update(accountRef, updateData);
      await createNotification(
        transaction,
        currentData.userId,
        message,
        'account',
        '/dashboard/my-accounts'
      );

      return { success: true, message: `تم تحديث حالة الحساب إلى ${status}.` };
    })
    .catch((error) => {
      console.error('Error updating account status:', error);
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف';
      return { success: false, message: `فشل تحديث حالة الحساب: ${errorMessage}` };
    });
}

export async function adminAddTradingAccount(
  userId: string,
  brokerName: string,
  accountNumber: string
) {
  try {
    // Check for duplicate account first (outside transaction)
    const existingAccountsSnap = await adminDb
      .collection('tradingAccounts')
      .where('broker', '==', brokerName)
      .where('accountNumber', '==', accountNumber)
      .get();

    if (!existingAccountsSnap.empty) {
      throw new Error('رقم حساب التداول هذا مرتبط بالفعل لهذا الوسيط.');
    }

    return await adminDb.runTransaction(async (transaction) => {
      const newAccountRef = adminDb.collection('tradingAccounts').doc();
      transaction.set(newAccountRef, {
        userId: userId,
        broker: brokerName,
        accountNumber: accountNumber,
        status: 'Approved',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await createNotification(
        transaction,
        userId,
        `تمت إضافة حسابك ${accountNumber} والموافقة عليه من قبل المسؤول.`,
        'account',
        '/dashboard/my-accounts'
      );

      // Also set user status to Active if NEW
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists && userSnap.data()?.status === 'NEW') {
        transaction.update(userRef, { status: 'Active' });
      }

      return { success: true, message: 'تمت إضافة الحساب والموافقة عليه بنجاح.' };
    });
  } catch (error) {
    console.error('Error adding trading account: ', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف';
    return { success: false, message: `فشل إضافة الحساب: ${errorMessage}` };
  }
}

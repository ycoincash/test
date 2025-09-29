
'use server';

import { db } from '@/lib/firebase/config';
import { collection, doc, getDocs, updateDoc, addDoc, serverTimestamp, query, where, Timestamp, runTransaction } from 'firebase/firestore';
import type { TradingAccount, UserProfile } from '@/types';
import { createNotification } from '../actions';

async function verifyAdmin() {
    // This is a placeholder for a real admin verification check.
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

export async function getTradingAccounts(): Promise<TradingAccount[]> {
  await verifyAdmin();
  const accountsSnapshot = await getDocs(collection(db, 'tradingAccounts'));
  const accounts: TradingAccount[] = [];
  accountsSnapshot.docs.forEach(doc => {
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

export async function updateTradingAccountStatus(accountId: string, status: 'Approved' | 'Rejected', reason?: string) {
    await verifyAdmin();
    return runTransaction(db, async (transaction) => {
        const accountRef = doc(db, 'tradingAccounts', accountId);
        const accountSnap = await transaction.get(accountRef);
        if (!accountSnap.exists()) throw new Error("لم يتم العثور على الحساب");

        const currentData = accountSnap.data() as TradingAccount;
        if (currentData.status !== 'Pending') {
            throw new Error(`لا يمكن تحديث الحساب. الحالة الحالية هي ${currentData.status}.`);
        }

        const updateData: { status: 'Approved' | 'Rejected', rejectionReason?: string } = { status };
        let message = `تم ${status === 'Approved' ? 'الموافقة على' : 'رفض'} حساب التداول الخاص بك ${currentData.accountNumber}.`;

        if (status === 'Rejected') {
            if (!reason) throw new Error("سبب الرفض مطلوب.");
            updateData.rejectionReason = reason;
            message += ` السبب: ${reason}`;
        } else {
            // Update user status to 'Active' if they were 'NEW'
            const userRef = doc(db, 'users', currentData.userId);
            const userSnap = await transaction.get(userRef);
            if (userSnap.exists() && userSnap.data().status === 'NEW') {
                transaction.update(userRef, { status: 'Active' });
            }
            updateData.rejectionReason = "";
        }

        transaction.update(accountRef, updateData);
        await createNotification(transaction, currentData.userId, message, 'account', '/dashboard/my-accounts');
        
        return { success: true, message: `تم تحديث حالة الحساب إلى ${status}.` };
    }).catch(error => {
        console.error("Error updating account status:", error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير معروف";
        return { success: false, message: `فشل تحديث حالة الحساب: ${errorMessage}` };
    });
}

export async function adminAddTradingAccount(userId: string, brokerName: string, accountNumber: string) {
    await verifyAdmin();
    return runTransaction(db, async (transaction) => {
        const q = query(
            collection(db, 'tradingAccounts'),
            where('broker', '==', brokerName),
            where('accountNumber', '==', accountNumber)
        );
        const querySnapshot = await getDocs(q); // This is outside a transaction in the calling function, but should be fine here.

        if (!querySnapshot.empty) {
            throw new Error('رقم حساب التداول هذا مرتبط بالفعل لهذا الوسيط.');
        }

        const newAccountRef = doc(collection(db, 'tradingAccounts'));
        transaction.set(newAccountRef, {
            userId: userId,
            broker: brokerName,
            accountNumber: accountNumber,
            status: 'Approved',
            createdAt: serverTimestamp(),
        });
        await createNotification(transaction, userId, `تمت إضافة حسابك ${accountNumber} والموافقة عليه من قبل المسؤول.`, 'account', '/dashboard/my-accounts');
        
        // Also set user status to Active if NEW
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists() && userSnap.data().status === 'NEW') {
            transaction.update(userRef, { status: 'Active' });
        }
        
        return { success: true, message: 'تمت إضافة الحساب والموافقة عليه بنجاح.' };
    }).catch(error => {
        console.error('Error adding trading account: ', error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير معروف";
        return { success: false, message: `فشل إضافة الحساب: ${errorMessage}` };
    });
}

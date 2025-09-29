
"use server";

import { db } from '@/lib/firebase/config';
import { collection, doc, getDocs, updateDoc, serverTimestamp, query, orderBy, runTransaction, Timestamp } from 'firebase/firestore';
import type { Withdrawal } from '@/types';
import { createNotification } from '../actions';
import { verifyAdminToken } from '@/lib/auth-helpers';


async function verifyAdmin() {
    await verifyAdminToken();
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

export async function getWithdrawals(): Promise<Withdrawal[]> {
    await verifyAdmin();
    const withdrawalsSnapshot = await getDocs(query(collection(db, 'withdrawals'), orderBy('requestedAt', 'desc')));
    const withdrawals: Withdrawal[] = [];

    withdrawalsSnapshot.docs.forEach(doc => {
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
    await verifyAdmin();
    try {
        await runTransaction(db, async (transaction) => {
            const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
            const withdrawalSnap = await transaction.get(withdrawalRef);
            if (!withdrawalSnap.exists()) throw new Error("لم يتم العثور على طلب السحب");
            const withdrawalData = withdrawalSnap.data() as Withdrawal;

            transaction.update(withdrawalRef, {
                status: 'Completed',
                completedAt: serverTimestamp(),
                txId: txId,
                rejectionReason: "",
            });

            const message = `تم إكمال طلب السحب الخاص بك بمبلغ ${withdrawalData.amount.toFixed(2)}$.`;
            await createNotification(transaction, withdrawalData.userId, message, 'withdrawal', '/dashboard/withdraw');
        });

        return { success: true, message: 'تمت الموافقة على السحب بنجاح مع TXID.' };
    } catch (error) {
        console.error("Error approving withdrawal:", error);
        return { success: false, message: 'فشل الموافقة على السحب.' };
    }
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
    await verifyAdmin();
     try {
        await runTransaction(db, async (transaction) => {
            const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
            const withdrawalSnap = await transaction.get(withdrawalRef);
            if (!withdrawalSnap.exists()) throw new Error("لم يتم العثور على طلب السحب");
            const withdrawalData = withdrawalSnap.data() as Withdrawal;

            if (!reason) throw new Error("سبب الرفض مطلوب.");

            transaction.update(withdrawalRef, { status: 'Failed', rejectionReason: reason });

            const message = `فشل طلب السحب الخاص بك بمبلغ ${withdrawalData.amount.toFixed(2)}$. السبب: ${reason}`;
            await createNotification(transaction, withdrawalData.userId, message, 'withdrawal', '/dashboard/withdraw');
        });

        return { success: true, message: `تم تحديث حالة السحب إلى "فشل".` };
    } catch (error) {
        console.error("Error rejecting withdrawal:", error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير معروف";
        return { success: false, message: `فشل رفض السحب: ${errorMessage}` };
    }
}

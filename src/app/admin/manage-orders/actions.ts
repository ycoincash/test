
"use server";

import { db } from '@/lib/firebase/config';
import { collection, doc, getDocs, updateDoc, serverTimestamp, query, orderBy, runTransaction, increment, Transaction } from 'firebase/firestore';
import type { Order, Notification } from '@/types';
import { awardReferralCommission, clawbackReferralCommission, createNotification } from '../actions';

async function verifyAdmin() {
    // This is a placeholder for a real admin verification check.
    return true;
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
    await verifyAdmin();
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) {
                throw new Error("لم يتم العثور على الطلب.");
            }
            const orderData = orderSnap.data() as Order;

            // Prevent awarding commission multiple times
            if (status === 'Delivered' && !orderData.referralCommissionAwarded) {
                await awardReferralCommission(orderData.userId, 'store_purchase', orderData.price);
                transaction.update(orderRef, { status, referralCommissionAwarded: true });
            } else if (status === 'Cancelled' && orderData.referralCommissionAwarded) {
                // Clawback commission if order is cancelled after delivery
                await clawbackReferralCommission(transaction, orderData.userId, 'store_purchase', orderData.price);
                transaction.update(orderRef, { status, referralCommissionAwarded: false });
            } else {
                 transaction.update(orderRef, { status });
            }

            const message = `تم تحديث حالة طلبك لـ "${orderData.productName}" إلى ${status}.`;
            await createNotification(transaction, orderData.userId, message, 'store', '/dashboard/store/orders');
        });

        return { success: true, message: 'تم تحديث حالة الطلب.' };
    } catch (error) {
        console.error("Error updating order status:", error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير معروف";
        return { success: false, message: `فشل تحديث حالة الطلب: ${errorMessage}` };
    }
}

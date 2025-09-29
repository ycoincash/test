
"use server";

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { Order, Notification } from '@/types';
import { awardReferralCommission, clawbackReferralCommission, createNotification } from '../actions';


export async function updateOrderStatus(orderId: string, status: Order['status']) {
    try {
        await adminDb.runTransaction, async (transaction) => {
            const orderRef = adminDb.collection('orders').doc(orderId);
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

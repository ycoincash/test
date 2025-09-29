
"use server";

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { PaymentMethod } from '@/types';



export async function getPaymentMethods(): Promise<PaymentMethod[]> {
    const snapshot = await adminDb.collection('paymentMethods').orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
}

export async function addPaymentMethod(data: Omit<PaymentMethod, 'id'>) {
    try {
        await adminDb.collection('paymentMethods').add( data);
        return { success: true, message: 'تمت إضافة طريقة الدفع بنجاح.' };
    } catch (error) {
        console.error("Error adding payment method:", error);
        return { success: false, message: 'فشل إضافة طريقة الدفع.' };
    }
}

export async function updatePaymentMethod(id: string, data: Partial<PaymentMethod>) {
    try {
        await adminDb.collection('paymentMethods').doc(id).update( data);
        return { success: true, message: 'تم تحديث طريقة الدفع بنجاح.' };
    } catch (error) {
        console.error("Error updating payment method:", error);
        return { success: false, message: 'فشل تحديث طريقة الدفع.' };
    }
}

export async function deletePaymentMethod(id: string) {
    try {
        await adminDb.collection('paymentMethods').doc(id).delete();
        return { success: true, message: 'تم حذف طريقة الدفع بنجاح.' };
    } catch (error) {
        console.error("Error deleting payment method:", error);
        return { success: false, message: 'فشل حذف طريقة الدفع.' };
    }
}

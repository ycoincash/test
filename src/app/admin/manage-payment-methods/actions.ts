
"use server";

import { db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, doc } from 'firebase/firestore';
import type { PaymentMethod } from '@/types';



export async function getPaymentMethods(): Promise<PaymentMethod[]> {
    const snapshot = await getDocs(query(collection(db, 'paymentMethods'), orderBy('name')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
}

export async function addPaymentMethod(data: Omit<PaymentMethod, 'id'>) {
    try {
        await addDoc(collection(db, 'paymentMethods'), data);
        return { success: true, message: 'تمت إضافة طريقة الدفع بنجاح.' };
    } catch (error) {
        console.error("Error adding payment method:", error);
        return { success: false, message: 'فشل إضافة طريقة الدفع.' };
    }
}

export async function updatePaymentMethod(id: string, data: Partial<PaymentMethod>) {
    try {
        await updateDoc(doc(db, 'paymentMethods', id), data);
        return { success: true, message: 'تم تحديث طريقة الدفع بنجاح.' };
    } catch (error) {
        console.error("Error updating payment method:", error);
        return { success: false, message: 'فشل تحديث طريقة الدفع.' };
    }
}

export async function deletePaymentMethod(id: string) {
    try {
        await deleteDoc(doc(db, 'paymentMethods', id));
        return { success: true, message: 'تم حذف طريقة الدفع بنجاح.' };
    } catch (error) {
        console.error("Error deleting payment method:", error);
        return { success: false, message: 'فشل حذف طريقة الدفع.' };
    }
}

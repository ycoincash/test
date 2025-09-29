
"use server";

import { db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, doc } from 'firebase/firestore';
import type { Product } from '@/types';

async function verifyAdmin() {
    // This is a placeholder for a real admin verification check.
    return true;
}

export async function addProduct(data: Omit<Product, 'id'>) {
    await verifyAdmin();
    try {
        await addDoc(collection(db, 'products'), data);
        return { success: true, message: 'تمت إضافة المنتج بنجاح.' };
    } catch (error) {
        console.error("Error adding product:", error);
        return { success: false, message: 'فشل إضافة المنتج.' };
    }
}

export async function updateProduct(id: string, data: Partial<Product>) {
    await verifyAdmin();
    try {
        await updateDoc(doc(db, 'products', id), data);
        return { success: true, message: 'تم تحديث المنتج بنجاح.' };
    } catch (error) {
        console.error("Error updating product:", error);
        return { success: false, message: 'فشل تحديث المنتج.' };
    }
}

export async function deleteProduct(id: string) {
    await verifyAdmin();
    try {
        await deleteDoc(doc(db, 'products', id));
        return { success: true, message: 'تم حذف المنتج بنجاح.' };
    } catch (error) {
        console.error("Error deleting product:", error);
        return { success: false, message: 'فشل حذف المنتج.' };
    }
}

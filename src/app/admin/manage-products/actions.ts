
"use server";

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { Product } from '@/types';


export async function addProduct(data: Omit<Product, 'id'>) {
    try {
        await adminDb.collection('products').add(data);
        return { success: true, message: 'تمت إضافة المنتج بنجاح.' };
    } catch (error) {
        console.error("Error adding product:", error);
        return { success: false, message: 'فشل إضافة المنتج.' };
    }
}

export async function updateProduct(id: string, data: Partial<Product>) {
    try {
        await adminDb.collection('products').doc(id).update(data);
        return { success: true, message: 'تم تحديث المنتج بنجاح.' };
    } catch (error) {
        console.error("Error updating product:", error);
        return { success: false, message: 'فشل تحديث المنتج.' };
    }
}

export async function deleteProduct(id: string) {
    try {
        await adminDb.collection('products').doc(id).delete();
        return { success: true, message: 'تم حذف المنتج بنجاح.' };
    } catch (error) {
        console.error("Error deleting product:", error);
        return { success: false, message: 'فشل حذف المنتج.' };
    }
}

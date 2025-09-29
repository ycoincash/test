
"use server";

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { ProductCategory } from '@/types';

export async function addCategory(data: Omit<ProductCategory, 'id'>) {
    try {
        await adminDb.collection('productCategories').add(data);
        return { success: true, message: 'تمت إضافة الفئة بنجاح.' };
    } catch (error) {
        console.error("Error adding category:", error);
        return { success: false, message: 'فشل إضافة الفئة.' };
    }
}

export async function updateCategory(id: string, data: Partial<ProductCategory>) {
    try {
        await adminDb.collection('productCategories').doc(id).update(data);
        return { success: true, message: 'تم تحديث الفئة بنجاح.' };
    } catch (error) {
        console.error("Error updating category:", error);
        return { success: false, message: 'فشل تحديث الفئة.' };
    }
}

export async function deleteCategory(id: string) {
    try {
        await adminDb.collection('productCategories').doc(id).delete();
        return { success: true, message: 'تم حذف الفئة بنجاح.' };
    } catch (error) {
        console.error("Error deleting category:", error);
        return { success: false, message: 'فشل حذف الفئة.' };
    }
}

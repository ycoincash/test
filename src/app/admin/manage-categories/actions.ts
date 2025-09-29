
"use server";

import { db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, doc } from 'firebase/firestore';
import type { ProductCategory } from '@/types';

async function verifyAdmin() {
    // This is a placeholder for a real admin verification check.
    return true;
}

export async function addCategory(data: Omit<ProductCategory, 'id'>) {
    await verifyAdmin();
    try {
        await addDoc(collection(db, 'productCategories'), data);
        return { success: true, message: 'تمت إضافة الفئة بنجاح.' };
    } catch (error) {
        console.error("Error adding category:", error);
        return { success: false, message: 'فشل إضافة الفئة.' };
    }
}

export async function updateCategory(id: string, data: Partial<ProductCategory>) {
    await verifyAdmin();
    try {
        await updateDoc(doc(db, 'productCategories', id), data);
        return { success: true, message: 'تم تحديث الفئة بنجاح.' };
    } catch (error) {
        console.error("Error updating category:", error);
        return { success: false, message: 'فشل تحديث الفئة.' };
    }
}

export async function deleteCategory(id: string) {
    await verifyAdmin();
    try {
        await deleteDoc(doc(db, 'productCategories', id));
        return { success: true, message: 'تم حذف الفئة بنجاح.' };
    } catch (error) {
        console.error("Error deleting category:", error);
        return { success: false, message: 'فشل حذف الفئة.' };
    }
}

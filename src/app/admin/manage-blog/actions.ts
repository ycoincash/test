
'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { BlogPost } from '@/types';

const safeToDate = (timestamp: any): Date | undefined => {
    if (timestamp instanceof Date) return timestamp;
    if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate();
    return undefined;
};

const convertTimestamps = (docData: any): BlogPost => {
    const data = docData.data();
    return {
        id: docData.id,
        ...data,
        createdAt: safeToDate(data.createdAt) || new Date(),
        updatedAt: safeToDate(data.updatedAt) || new Date(),
    } as BlogPost;
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
    const snapshot = await adminDb.collection('blogPosts').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(convertTimestamps);
}

export async function addBlogPost(data: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        await adminDb.collection('blogPosts').add( {
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: 'تم إنشاء المقال بنجاح.' };
    } catch (error) {
        console.error("Error adding blog post:", error);
        return { success: false, message: 'فشل إنشاء المقال.' };
    }
}

export async function updateBlogPost(id: string, data: Partial<Omit<BlogPost, 'id' | 'createdAt'>>) {
    try {
        const postRef = adminDb.collection('blogPosts').doc(id);
        await postRef.update( {
            ...data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: 'تم تحديث المقال بنجاح.' };
    } catch (error) {
        console.error("Error updating blog post:", error);
        return { success: false, message: 'فشل تحديث المقال.' };
    }
}

export async function deleteBlogPost(id: string) {
    try {
        await adminDb.collection('blogPosts').doc(id).delete();
        return { success: true, message: 'تم حذف المقال بنجاح.' };
    } catch (error) {
        console.error("Error deleting blog post:", error);
        return { success: false, message: 'فشل حذف المقال.' };
    }
}

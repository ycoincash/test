
'use server';

import { db } from '@/lib/firebase/config';
import { collection, doc, getDocs, updateDoc, addDoc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import type { BlogPost } from '@/types';

    return true;
}

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
    const snapshot = await getDocs(query(collection(db, 'blogPosts'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(convertTimestamps);
}

export async function addBlogPost(data: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        await addDoc(collection(db, 'blogPosts'), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { success: true, message: 'تم إنشاء المقال بنجاح.' };
    } catch (error) {
        console.error("Error adding blog post:", error);
        return { success: false, message: 'فشل إنشاء المقال.' };
    }
}

export async function updateBlogPost(id: string, data: Partial<Omit<BlogPost, 'id' | 'createdAt'>>) {
    try {
        const postRef = doc(db, 'blogPosts', id);
        await updateDoc(postRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        return { success: true, message: 'تم تحديث المقال بنجاح.' };
    } catch (error) {
        console.error("Error updating blog post:", error);
        return { success: false, message: 'فشل تحديث المقال.' };
    }
}

export async function deleteBlogPost(id: string) {
    try {
        await deleteDoc(doc(db, 'blogPosts', id));
        return { success: true, message: 'تم حذف المقال بنجاح.' };
    } catch (error) {
        console.error("Error deleting blog post:", error);
        return { success: false, message: 'فشل حذف المقال.' };
    }
}

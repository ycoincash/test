

'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { FeedbackForm, FeedbackResponse, EnrichedFeedbackResponse, UserProfile } from '@/types';


const safeToDate = (timestamp: any): Date | undefined => {
    if (timestamp instanceof Date) {
        return timestamp;
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    return undefined;
};


// Feedback System
export async function getFeedbackForms(): Promise<FeedbackForm[]> {
    const snapshot = await adminDb.collection('feedbackForms').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: safeToDate(data.createdAt) || new Date(),
        } as FeedbackForm;
    });
}

export async function addFeedbackForm(data: Omit<FeedbackForm, 'id' | 'createdAt' | 'responseCount'>) {
    try {
        await adminDb.collection('feedbackForms').add( {
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            responseCount: 0,
        });
        return { success: true, message: 'تم إنشاء نموذج الملاحظات بنجاح.' };
    } catch (error) {
        console.error("Error adding feedback form:", error);
        return { success: false, message: 'فشل إنشاء النموذج.' };
    }
}

export async function updateFeedbackForm(id: string, data: Partial<Omit<FeedbackForm, 'id' | 'createdAt'>>) {
    try {
        await adminDb.collection('feedbackForms').doc(id).update( data);
        return { success: true, message: 'تم تحديث النموذج بنجاح.' };
    } catch (error) {
        console.error("Error updating feedback form:", error);
        return { success: false, message: 'فشل تحديث النموذج.' };
    }
}

export async function deleteFeedbackForm(id: string) {
    try {
        await adminDb.collection('feedbackForms').doc(id).delete();
        return { success: true, message: 'تم حذف النموذج بنجاح.' };
    } catch (error) {
        console.error("Error deleting feedback form:", error);
        return { success: false, message: 'فشل حذف النموذج.' };
    }
}

export async function getFeedbackFormById(formId: string): Promise<FeedbackForm | null> {
    const docRef = adminDb.collection('feedbackForms').doc(formId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        return null;
    }
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        createdAt: safeToDate(data.createdAt) || new Date(),
    } as FeedbackForm;
}

export async function getFeedbackResponses(formId: string): Promise<EnrichedFeedbackResponse[]> {
    // Query without ordering to avoid needing a composite index
    const responsesQuery = adminDb.collection('feedbackResponses').where('formId', '==', formId);
    const responsesSnap = await responsesQuery.get();

    const responses = responsesSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            submittedAt: safeToDate(data.submittedAt) || new Date(),
        } as FeedbackResponse;
    });

    // Sort in-memory instead of in the query
    responses.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

    const userIds = [...new Set(responses.map(r => r.userId))];
    if (userIds.length === 0) return [];

    const usersQuery = adminDb.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', userIds);
    const usersSnap = await usersQuery.get();
    const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data() as UserProfile]));

    return responses.map(response => ({
        ...response,
        userName: usersMap.get(response.userId)?.name || 'مستخدم غير معروف'
    }));
}

'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import type { ContactSettings } from '@/types';

const SETTINGS_DOC_ID = 'contact';

export async function getContactSettings(): Promise<ContactSettings> {
    try {
        const doc = await adminDb.collection('settings').doc(SETTINGS_DOC_ID).get();
        
        if (!doc.exists) {
            const defaultSettings: Omit<ContactSettings, 'id'> = {
                email: '',
                phone: '',
                address: '',
                social: {
                    facebook: '',
                    twitter: '',
                    instagram: '',
                    whatsapp: '',
                    telegram: '',
                },
            };
            
            await adminDb.collection('settings').doc(SETTINGS_DOC_ID).set(defaultSettings);
            
            return {
                id: SETTINGS_DOC_ID,
                ...defaultSettings,
            };
        }
        
        return {
            id: doc.id,
            ...doc.data(),
        } as ContactSettings;
    } catch (error) {
        console.error("Error fetching contact settings:", error);
        throw new Error("Failed to fetch contact settings");
    }
}

export async function updateContactSettings(data: Omit<ContactSettings, 'id'>) {
    try {
        await adminDb.collection('settings').doc(SETTINGS_DOC_ID).set(data, { merge: true });
        return { success: true, message: 'تم تحديث إعدادات الاتصال بنجاح.' };
    } catch (error) {
        console.error("Error updating contact settings:", error);
        return { success: false, message: 'فشل تحديث إعدادات الاتصال.' };
    }
}

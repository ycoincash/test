
'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { ClientLevel } from '@/types';


export async function updateClientLevels(levels: ClientLevel[]) {
    try {
        const batch = adminDb.batch();
        levels.forEach(level => {
            const levelRef = adminDb.collection('clientLevels').doc(String(level.id));
            // The 'id' is the document ID, so we don't need to save it inside the document.
            const { id, ...levelData } = level;
            batch.set(levelRef, levelData);
        });
        await batch.commit();
        return { success: true, message: 'تم تحديث مستويات العملاء بنجاح.' };
    } catch (error) {
        console.error("Error updating client levels:", error);
        return { success: false, message: 'فشل تحديث مستويات العملاء.' };
    }
}

export async function seedClientLevels(): Promise<{ success: boolean; message: string; }> {
    const levelsCollection = adminDb.collection('clientLevels');
    const snapshot = await levelsCollection.get();
    if (!snapshot.empty) {
        return { success: false, message: 'مستويات العملاء موجودة بالفعل.' };
    }

    const defaultLevels: Omit<ClientLevel, 'id'>[] = [
        { name: 'Bronze', required_total: 0, advantage_referral_cashback: 5, advantage_referral_store: 2, advantage_product_discount: 0 },
        { name: 'Silver', required_total: 100, advantage_referral_cashback: 7, advantage_referral_store: 4, advantage_product_discount: 2 },
        { name: 'Gold', required_total: 500, advantage_referral_cashback: 10, advantage_referral_store: 6, advantage_product_discount: 4 },
        { name: 'Platinum', required_total: 2000, advantage_referral_cashback: 15, advantage_referral_store: 8, advantage_product_discount: 6 },
        { name: 'Diamond', required_total: 10000, advantage_referral_cashback: 20, advantage_referral_store: 10, advantage_product_discount: 8 },
        { name: 'Ambassador', required_total: 50000, advantage_referral_cashback: 25, advantage_referral_store: 15, advantage_product_discount: 10 },
    ];

    try {
        const batch = adminDb.batch();
        defaultLevels.forEach((level, index) => {
            const levelId = String(index + 1);
            const docRef = adminDb.collection('clientLevels').doc(levelId);
            batch.set(docRef, level);
        });
        await batch.commit();
        return { success: true, message: 'تمت إضافة مستويات العملاء الافتراضية بنجاح.' };
    } catch (error) {
        console.error("Error seeding client levels:", error);
        return { success: false, message: 'فشل إضافة مستويات العملاء الافتراضية.' };
    }
}

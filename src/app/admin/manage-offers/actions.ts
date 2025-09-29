

'use server';

import { db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, doc, where } from 'firebase/firestore';
import type { Offer, UserProfile } from '@/types';
import { getClientSessionInfo } from '@/lib/device-info';
import { getAuth } from 'firebase/auth';

async function verifyAdmin() {
    // Placeholder
    return true;
}

export async function addOffer(data: Omit<Offer, 'id'>) {
    await verifyAdmin();
    try {
        await addDoc(collection(db, 'offers'), data);
        return { success: true, message: 'تمت إضافة العرض بنجاح.' };
    } catch (error) {
        console.error("Error adding offer:", error);
        return { success: false, message: 'فشل إضافة العرض.' };
    }
}

export async function updateOffer(id: string, data: Partial<Omit<Offer, 'id'>>) {
    await verifyAdmin();
    try {
        await updateDoc(doc(db, 'offers', id), data);
        return { success: true, message: 'تم تحديث العرض بنجاح.' };
    } catch (error) {
        console.error("Error updating offer:", error);
        return { success: false, message: 'فشل تحديث العرض.' };
    }
}

export async function deleteOffer(id: string) {
    await verifyAdmin();
    try {
        await deleteDoc(doc(db, 'offers', id));
        return { success: true, message: 'تم حذف العرض بنجاح.' };
    } catch (error) {
        console.error("Error deleting offer:", error);
        return { success: false, message: 'فشل حذف العرض.' };
    }
}

export async function getOffers(): Promise<Offer[]> {
    const snapshot = await getDocs(query(collection(db, 'offers')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
}

export async function getOffersForUser(user: UserProfile | undefined): Promise<Offer[]> {
    try {
        if (!user) return [];
        
        const { geoInfo } = await getClientSessionInfo();
        const userCountry = geoInfo.country;

        const q = query(collection(db, 'offers'), where('isEnabled', '==', true));
        const snapshot = await getDocs(q);
        
        const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));

        return offers.filter(offer => {
            const hasCountryTargeting = offer.targetCountries && offer.targetCountries.length > 0;
            // If no country is targeted, it's a match.
            // If countries are targeted, it's a match if the user's country is in the list OR if we don't know the user's country yet.
            const countryMatch = !hasCountryTargeting || (userCountry && offer.targetCountries!.includes(userCountry)) || !userCountry;
            
            const hasLevelTargeting = offer.targetLevels && offer.targetLevels.length > 0;
            const levelMatch = !hasLevelTargeting || offer.targetLevels!.includes(String(user.level));

            const hasStatusTargeting = offer.targetStatuses && offer.targetStatuses.length > 0;
            const statusMatch = !hasStatusTargeting || offer.targetStatuses!.includes(user.status);
            
            return countryMatch && levelMatch && statusMatch;
        });

    } catch (error) {
        console.error("Error fetching offers for user:", error);
        return [];
    }
}


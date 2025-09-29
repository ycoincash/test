'use server';

import { db } from '@/lib/firebase/config';
import { collection, doc, getDocs, updateDoc, addDoc, query, orderBy, writeBatch, deleteDoc } from 'firebase/firestore';
import type { Broker } from '@/types';

    return true;
}

export async function getBrokers(): Promise<Broker[]> {
    const brokersSnapshot = await getDocs(query(collection(db, 'brokers'), orderBy('order')));
    return brokersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broker));
}

export async function addBroker(data: Omit<Broker, 'id' | 'order'>) {
    try {
        const brokersSnapshot = await getDocs(query(collection(db, 'brokers'), orderBy('order', 'desc')));
        const maxOrder = brokersSnapshot.docs.length > 0 && brokersSnapshot.docs[0].data().order != null ? brokersSnapshot.docs[0].data().order : -1;
        await addDoc(collection(db, 'brokers'), { ...data, order: maxOrder + 1 });
        return { success: true, message: 'تمت إضافة الوسيط بنجاح.' };
    } catch (error) {
        console.error("Error adding broker:", error);
        return { success: false, message: 'فشل إضافة الوسيط.' };
    }
}

export async function updateBroker(brokerId: string, data: Partial<Omit<Broker, 'id'>>) {
    try {
        const brokerRef = doc(db, 'brokers', brokerId);
        await updateDoc(brokerRef, data);
        return { success: true, message: 'تم تحديث الوسيط بنجاح.' };
    } catch (error) {
        console.error("Error updating broker:", error);
        return { success: false, message: 'فشل تحديث الوسيط.' };
    }
}

export async function deleteBroker(brokerId: string) {
    try {
        await deleteDoc(doc(db, 'brokers', brokerId));
        return { success: true, message: 'تم حذف الوسيط بنجاح.' };
    } catch (error) {
        console.error("Error deleting broker:", error);
        return { success: false, message: 'فشل حذف الوسيط.' };
    }
}

export async function updateBrokerOrder(orderedIds: string[]) {
    try {
        const batch = writeBatch(db);
        orderedIds.forEach((id, index) => {
            const docRef = doc(db, 'brokers', id);
            batch.update(docRef, { order: index });
        });
        await batch.commit();
        return { success: true, message: 'تم تحديث ترتيب الوسطاء.' };
    } catch (error) {
        console.error("Error updating broker order:", error);
        return { success: false, message: 'فشل تحديث ترتيب الوسطاء.' };
    }
}

export async function addBrokersBatch(brokers: Omit<Broker, 'id' | 'order'>[]) {
    try {
        const batch = writeBatch(db);
        const brokersCollection = collection(db, 'brokers');
        const brokersSnapshot = await getDocs(query(brokersCollection, orderBy('order', 'desc')));
        let maxOrder = brokersSnapshot.docs.length > 0 && brokersSnapshot.docs[0].data().order != null ? brokersSnapshot.docs[0].data().order : -1;
        brokers.forEach(brokerData => {
            const newBrokerRef = doc(brokersCollection);
            maxOrder++;
            batch.set(newBrokerRef, { ...brokerData, order: maxOrder });
        });
        await batch.commit();
        return { success: true, message: `تمت إضافة ${brokers.length} وسطاء بنجاح.` };
    } catch (error) {
        console.error("Error adding brokers batch:", error);
        return { success: false, message: 'فشل إضافة الوسطاء.' };
    }
}

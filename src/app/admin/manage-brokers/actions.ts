'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { Broker } from '@/types';

export async function getBrokers(): Promise<Broker[]> {
  const brokersSnapshot = await adminDb.collection('brokers').orderBy('order').get();
  return brokersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Broker));
}

export async function addBroker(data: Omit<Broker, 'id' | 'order'>) {
  try {
    const brokersSnapshot = await adminDb.collection('brokers').orderBy('order', 'desc').get();
    const maxOrder =
      brokersSnapshot.docs.length > 0 && brokersSnapshot.docs[0].data().order != null
        ? brokersSnapshot.docs[0].data().order
        : -1;
    await adminDb.collection('brokers').add({ ...data, order: maxOrder + 1 });
    return { success: true, message: 'تمت إضافة الوسيط بنجاح.' };
  } catch (error) {
    console.error('Error adding broker:', error);
    return { success: false, message: 'فشل إضافة الوسيط.' };
  }
}

export async function updateBroker(brokerId: string, data: Partial<Omit<Broker, 'id'>>) {
  try {
    await adminDb.collection('brokers').doc(brokerId).update(data);
    return { success: true, message: 'تم تحديث الوسيط بنجاح.' };
  } catch (error) {
    console.error('Error updating broker:', error);
    return { success: false, message: 'فشل تحديث الوسيط.' };
  }
}

export async function deleteBroker(brokerId: string) {
  try {
    await adminDb.collection('brokers').doc(brokerId).delete();
    return { success: true, message: 'تم حذف الوسيط بنجاح.' };
  } catch (error) {
    console.error('Error deleting broker:', error);
    return { success: false, message: 'فشل حذف الوسيط.' };
  }
}

export async function updateBrokerOrder(orderedIds: string[]) {
  try {
    const batch = adminDb.batch();
    orderedIds.forEach((id, index) => {
      const docRef = adminDb.collection('brokers').doc(id);
      batch.update(docRef, { order: index });
    });
    await batch.commit();
    return { success: true, message: 'تم تحديث ترتيب الوسطاء.' };
  } catch (error) {
    console.error('Error updating broker order:', error);
    return { success: false, message: 'فشل تحديث ترتيب الوسطاء.' };
  }
}

export async function addBrokersBatch(brokers: Omit<Broker, 'id' | 'order'>[]) {
  try {
    const batch = adminDb.batch();
    const brokersCollection = adminDb.collection('brokers');
    const brokersSnapshot = await brokersCollection.orderBy('order', 'desc').get();
    let maxOrder =
      brokersSnapshot.docs.length > 0 && brokersSnapshot.docs[0].data().order != null
        ? brokersSnapshot.docs[0].data().order
        : -1;

    brokers.forEach((brokerData) => {
      const newBrokerRef = brokersCollection.doc();
      maxOrder++;
      batch.set(newBrokerRef, { ...brokerData, order: maxOrder });
    });

    await batch.commit();
    return { success: true, message: `تمت إضافة ${brokers.length} وسطاء بنجاح.` };
  } catch (error) {
    console.error('Error adding brokers batch:', error);
    return { success: false, message: 'فشل إضافة الوسطاء.' };
  }
}

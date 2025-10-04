'use server';

import { createAdminClient } from '@/lib/supabase/server';
import type { Broker } from '@/types';

export async function getBrokers(): Promise<Broker[]> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('brokers')
    .select('*')
    .order('order');

  if (error) {
    console.error('Error fetching brokers:', error);
    return [];
  }

  return data as Broker[];
}

export async function addBroker(data: Omit<Broker, 'id' | 'order'>) {
  try {
    const supabase = await createAdminClient();
    
    const { data: brokersData, error: fetchError } = await supabase
      .from('brokers')
      .select('order')
      .order('order', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching max order:', fetchError);
      return { success: false, message: 'فشل إضافة الوسيط.' };
    }

    const maxOrder = brokersData && brokersData.length > 0 && brokersData[0].order != null
      ? brokersData[0].order
      : -1;

    const { error } = await supabase
      .from('brokers')
      .insert({ ...data, order: maxOrder + 1 });

    if (error) {
      console.error('Error adding broker:', error);
      return { success: false, message: 'فشل إضافة الوسيط.' };
    }

    return { success: true, message: 'تمت إضافة الوسيط بنجاح.' };
  } catch (error) {
    console.error('Error adding broker:', error);
    return { success: false, message: 'فشل إضافة الوسيط.' };
  }
}

export async function updateBroker(brokerId: string, data: Partial<Omit<Broker, 'id'>>) {
  try {
    const supabase = await createAdminClient();
    const { error } = await supabase
      .from('brokers')
      .update(data)
      .eq('id', brokerId);

    if (error) {
      console.error('Error updating broker:', error);
      return { success: false, message: 'فشل تحديث الوسيط.' };
    }

    return { success: true, message: 'تم تحديث الوسيط بنجاح.' };
  } catch (error) {
    console.error('Error updating broker:', error);
    return { success: false, message: 'فشل تحديث الوسيط.' };
  }
}

export async function deleteBroker(brokerId: string) {
  try {
    const supabase = await createAdminClient();
    const { error } = await supabase
      .from('brokers')
      .delete()
      .eq('id', brokerId);

    if (error) {
      console.error('Error deleting broker:', error);
      return { success: false, message: 'فشل حذف الوسيط.' };
    }

    return { success: true, message: 'تم حذف الوسيط بنجاح.' };
  } catch (error) {
    console.error('Error deleting broker:', error);
    return { success: false, message: 'فشل حذف الوسيط.' };
  }
}

export async function updateBrokerOrder(orderedIds: string[]) {
  try {
    const supabase = await createAdminClient();
    
    for (let index = 0; index < orderedIds.length; index++) {
      const { error } = await supabase
        .from('brokers')
        .update({ order: index })
        .eq('id', orderedIds[index]);

      if (error) {
        console.error('Error updating broker order:', error);
        return { success: false, message: 'فشل تحديث ترتيب الوسطاء.' };
      }
    }

    return { success: true, message: 'تم تحديث ترتيب الوسطاء.' };
  } catch (error) {
    console.error('Error updating broker order:', error);
    return { success: false, message: 'فشل تحديث ترتيب الوسطاء.' };
  }
}

export async function addBrokersBatch(brokers: Omit<Broker, 'id' | 'order'>[]) {
  try {
    const supabase = await createAdminClient();
    
    const { data: brokersData, error: fetchError } = await supabase
      .from('brokers')
      .select('order')
      .order('order', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching max order:', fetchError);
      return { success: false, message: 'فشل إضافة الوسطاء.' };
    }

    let maxOrder = brokersData && brokersData.length > 0 && brokersData[0].order != null
      ? brokersData[0].order
      : -1;

    const brokersToInsert = brokers.map((brokerData) => {
      maxOrder++;
      return { ...brokerData, order: maxOrder };
    });

    const { error } = await supabase
      .from('brokers')
      .insert(brokersToInsert);

    if (error) {
      console.error('Error adding brokers batch:', error);
      return { success: false, message: 'فشل إضافة الوسطاء.' };
    }

    return { success: true, message: `تمت إضافة ${brokers.length} وسطاء بنجاح.` };
  } catch (error) {
    console.error('Error adding brokers batch:', error);
    return { success: false, message: 'فشل إضافة الوسطاء.' };
  }
}

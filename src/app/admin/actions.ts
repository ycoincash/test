'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import { startOfMonth } from 'date-fns';
import type { ActivityLog, BannerSettings, BlogPost, Broker, CashbackTransaction, DeviceInfo, Notification, Order, PaymentMethod, ProductCategory, Product, TradingAccount, UserProfile, Withdrawal, GeoInfo, ClientLevel, AdminNotification, Offer } from '@/types';
import { getClientLevels } from '@/app/actions';

// ====================================================================
// SECURITY: Admin operations use Firebase Admin SDK which bypasses
// Firestore Security Rules. All functions in this file should only be
// called from admin-authenticated contexts.
// ====================================================================

const safeToDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp?._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  if (typeof timestamp?.toDate === 'function') {
    return timestamp.toDate();
  }
  return undefined;
};

// Activity Logging
export async function logUserActivity(
  userId: string,
  event: ActivityLog['event'],
  clientInfo: { deviceInfo: DeviceInfo; geoInfo: GeoInfo },
  details?: Record<string, any>
) {
  try {
    const logEntry: Omit<ActivityLog, 'id'> = {
      userId,
      event,
      timestamp: new Date(),
      ipAddress: clientInfo.geoInfo.ip || 'unknown',
      userAgent: `${clientInfo.deviceInfo.browser} on ${clientInfo.deviceInfo.os}`,
      device: clientInfo.deviceInfo,
      geo: {
        country: clientInfo.geoInfo.country || 'Unknown',
        city: clientInfo.geoInfo.city || 'Unknown',
      },
      details,
    };
    await adminDb.collection('activityLogs').add(logEntry);
  } catch (error) {
    console.error(`Failed to log activity for event ${event}:`, error);
  }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const snapshot = await adminDb
    .collection('activityLogs')
    .orderBy('timestamp', 'desc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: safeToDate(data.timestamp) || new Date(),
    } as ActivityLog;
  });
}

// Generic function to create a notification
export async function createNotification(
  transaction: admin.firestore.Transaction,
  userId: string,
  message: string,
  type: Notification['type'],
  link?: string
) {
  const newNotifRef = adminDb.collection('notifications').doc();
  transaction.set(newNotifRef, {
    userId,
    message,
    type,
    link,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Balance Calculation
export async function getUserBalance(userId: string) {
  const [transactionsSnap, withdrawalsSnap, ordersSnap] = await Promise.all([
    adminDb.collection('cashbackTransactions').where('userId', '==', userId).get(),
    adminDb.collection('withdrawals').where('userId', '==', userId).get(),
    adminDb.collection('orders').where('userId', '==', userId).get(),
  ]);

  const totalEarned = transactionsSnap.docs.reduce(
    (sum, doc) => sum + (doc.data().cashbackAmount || 0),
    0
  );

  let pendingWithdrawals = 0;
  let completedWithdrawals = 0;
  withdrawalsSnap.docs.forEach((doc) => {
    const withdrawal = doc.data() as Withdrawal;
    if (withdrawal.status === 'Processing') {
      pendingWithdrawals += withdrawal.amount;
    } else if (withdrawal.status === 'Completed') {
      completedWithdrawals += withdrawal.amount;
    }
  });

  const totalSpentOnOrders = ordersSnap.docs
    .filter((doc) => doc.data().status !== 'Cancelled')
    .reduce((sum, doc) => sum + (doc.data().price || 0), 0);

  const availableBalance =
    totalEarned - completedWithdrawals - pendingWithdrawals - totalSpentOnOrders;

  return {
    availableBalance: Number(availableBalance.toFixed(2)),
    totalEarned: Number(totalEarned.toFixed(2)),
    pendingWithdrawals: Number(pendingWithdrawals.toFixed(2)),
    completedWithdrawals: Number(completedWithdrawals.toFixed(2)),
    totalSpentOnOrders: Number(totalSpentOnOrders.toFixed(2)),
  };
}

// Point Awarding Engine
export async function awardReferralCommission(
  userId: string,
  sourceType: 'cashback' | 'store_purchase',
  amountValue: number
) {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists || !userSnap.data()?.referredBy) {
        console.log(`User ${userId} has no referrer. Skipping commission.`);
        return;
      }
      if (amountValue <= 0) {
        console.log(
          `Commission source amount is zero or negative for user ${userId}. Skipping.`
        );
        return;
      }

      const referrerId = userSnap.data()!.referredBy;
      const referrerRef = adminDb.collection('users').doc(referrerId);
      const referrerSnap = await transaction.get(referrerRef);

      if (!referrerSnap.exists) {
        console.log(`Referrer ${referrerId} does not exist. Skipping commission.`);
        return;
      }

      const referrerLevel = referrerSnap.data()?.level || 1;
      const levels = await getClientLevels();
      const currentLevelConfig = levels.find((l) => l.id === referrerLevel);

      if (!currentLevelConfig) {
        console.log(`Level config not found for level ${referrerLevel}. Skipping commission.`);
        return;
      }

      const commissionPercent =
        sourceType === 'cashback'
          ? currentLevelConfig.advantage_referral_cashback
          : currentLevelConfig.advantage_referral_store;

      if (commissionPercent <= 0) {
        console.log(`No commission for level ${referrerLevel} and source ${sourceType}. Skipping.`);
        return;
      }

      const commissionAmount = (amountValue * commissionPercent) / 100;
      const newTransactionRef = adminDb.collection('cashbackTransactions').doc();

      transaction.set(newTransactionRef, {
        userId: referrerId,
        accountId: 'REFERRAL_COMMISSION',
        accountNumber: 'Referral',
        broker: `Commission from ${userSnap.data()!.name}`,
        date: admin.firestore.FieldValue.serverTimestamp(),
        tradeDetails: `Referral commission from ${sourceType}`,
        cashbackAmount: commissionAmount,
        sourceUserId: userId,
        sourceType: sourceType,
      });

      transaction.update(referrerRef, {
        monthlyEarnings: admin.firestore.FieldValue.increment(commissionAmount),
      });

      const message = `لقد ربحت ${commissionAmount.toFixed(2)}$ عمولة إحالة من ${
        userSnap.data()!.name
      }.`;
      await createNotification(
        transaction,
        referrerId,
        message,
        'general',
        '/dashboard/referrals'
      );
    });
  } catch (error) {
    console.error(`Failed to award referral commission to user ${userId}'s referrer:`, error);
  }
}

export async function clawbackReferralCommission(
  transaction: admin.firestore.Transaction,
  originalUserId: string,
  sourceType: 'cashback' | 'store_purchase',
  originalAmount: number
) {
  const userRef = adminDb.collection('users').doc(originalUserId);
  const userSnap = await transaction.get(userRef);

  if (!userSnap.exists || !userSnap.data()?.referredBy) {
    return;
  }

  const referrerId = userSnap.data()!.referredBy;
  const referrerRef = adminDb.collection('users').doc(referrerId);
  const referrerSnap = await transaction.get(referrerRef);

  if (!referrerSnap.exists) return;

  const referrerLevel = referrerSnap.data()?.level || 1;
  const levels = await getClientLevels();
  const currentLevelConfig = levels.find((l) => l.id === referrerLevel);

  if (!currentLevelConfig) return;

  const commissionPercent =
    sourceType === 'cashback'
      ? currentLevelConfig.advantage_referral_cashback
      : currentLevelConfig.advantage_referral_store;

  if (commissionPercent <= 0) return;

  const commissionAmountToClawback = (originalAmount * commissionPercent) / 100;
  const newTransactionRef = adminDb.collection('cashbackTransactions').doc();

  transaction.set(newTransactionRef, {
    userId: referrerId,
    accountId: 'CLAWBACK',
    accountNumber: 'Clawback',
    broker: `Reversed Commission from ${userSnap.data()!.name}`,
    date: admin.firestore.FieldValue.serverTimestamp(),
    tradeDetails: `Commission reversed due to cancelled order/transaction from original user.`,
    cashbackAmount: -commissionAmountToClawback,
    sourceUserId: originalUserId,
    sourceType: sourceType,
  });

  transaction.update(referrerRef, {
    monthlyEarnings: admin.firestore.FieldValue.increment(-commissionAmountToClawback),
  });

  const message = `تم خصم ${commissionAmountToClawback.toFixed(2)}$ من رصيدك بسبب إلغاء معاملة من قبل ${
    userSnap.data()!.name
  }.`;
  await createNotification(transaction, referrerId, message, 'general', '/dashboard/referrals');
}

// Admin Notifications
export async function getAdminNotifications(): Promise<AdminNotification[]> {
  const snapshot = await adminDb
    .collection('adminNotifications')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: safeToDate(data.createdAt) || new Date(),
    } as AdminNotification;
  });
}

export async function sendAdminNotification(
  message: string,
  target: 'all' | 'specific',
  userIds: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    const adminNotifRef = adminDb.collection('adminNotifications').doc();
    await adminNotifRef.set({
      message,
      target,
      userIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    let targetUsers: { id: string }[] = [];

    if (target === 'all') {
      const usersSnapshot = await adminDb.collection('users').get();
      targetUsers = usersSnapshot.docs.map((doc) => ({ id: doc.id }));
    } else {
      targetUsers = userIds.map((id) => ({ id }));
    }

    if (targetUsers.length === 0) {
      return { success: false, message: 'لم يتم تحديد مستخدمين مستهدفين.' };
    }

    await adminDb.runTransaction(async (transaction) => {
      targetUsers.forEach((user) => {
        const userNotifRef = adminDb.collection('notifications').doc();
        transaction.set(userNotifRef, {
          userId: user.id,
          message,
          type: 'announcement',
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    });

    return { success: true, message: `تم إرسال الإشعار إلى ${targetUsers.length} مستخدم.` };
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return { success: false, message: 'فشل إرسال الإشعار.' };
  }
}

export async function getBannerSettings(): Promise<BannerSettings> {
  const docSnap = await adminDb.collection('settings').doc('banner').get();

  if (docSnap.exists) {
    return docSnap.data() as BannerSettings;
  }

  return {
    isEnabled: false,
    type: 'text',
    title: '',
    text: '',
    ctaText: '',
    ctaLink: '',
    scriptCode: '',
    targetTiers: [],
    targetCountries: [],
    targetStatuses: [],
  };
}

export async function updateBannerSettings(settings: BannerSettings) {
  try {
    await adminDb.collection('settings').doc('banner').set(settings, { merge: true });
    return { success: true, message: 'تم تحديث إعدادات البانر بنجاح.' };
  } catch (error) {
    console.error('Error updating banner settings:', error);
    return { success: false, message: 'فشل تحديث إعدادات البانر.' };
  }
}

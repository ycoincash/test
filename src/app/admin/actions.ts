

'use server';

import { db, auth } from '@/lib/firebase/config';
import { collection, doc, getDocs, updateDoc, addDoc, serverTimestamp, query, where, Timestamp, orderBy, writeBatch, deleteDoc, getDoc, setDoc, runTransaction, increment, Transaction, limit } from 'firebase/firestore';
import { startOfMonth } from 'date-fns';
import type { ActivityLog, BannerSettings, BlogPost, Broker, CashbackTransaction, DeviceInfo, Notification, Order, PaymentMethod, ProductCategory, Product, TradingAccount, UserProfile, Withdrawal, GeoInfo, ClientLevel, AdminNotification, Offer } from '@/types';
import { headers } from 'next/headers';
import { getClientLevels } from '@/app/actions';
import { verifyAdminToken } from '@/lib/auth-helpers';

// ====================================================================
// SECURITY: Helper to verify admin role from the server-side.
// ====================================================================
async function verifyAdmin() {
    // Verify Firebase ID token and check admin claim
    // This will throw an error if the token is invalid or user is not an admin
    await verifyAdminToken();
    return true;
}


const safeToDate = (timestamp: any): Date | undefined => {
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    return undefined;
};


// Activity Logging
export async function logUserActivity(
    userId: string, 
    event: ActivityLog['event'], 
    clientInfo: { deviceInfo: DeviceInfo, geoInfo: GeoInfo },
    details?: Record<string, any>,
) {
    try {
        const logEntry: Omit<ActivityLog, 'id'> = {
            userId,
            event,
            timestamp: new Date(),
            ipAddress: clientInfo.geoInfo.ip || 'unknown',
            userAgent: clientInfo.deviceInfo.browser,
            device: clientInfo.deviceInfo,
            geo: {
                country: clientInfo.geoInfo.country,
                city: clientInfo.geoInfo.city,
            },
            details,
        };
        await addDoc(collection(db, 'activityLogs'), logEntry);
    } catch (error) {
        console.error(`Failed to log activity for event ${event}:`, error);
        // We don't want to block the user's action if logging fails
    }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
    await verifyAdmin();
    const logsSnapshot = await getDocs(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc')));
    return logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            timestamp: safeToDate(data.timestamp) || new Date(),
        } as ActivityLog
    });
}

// Generic function to create a notification
export async function createNotification(
    transaction: Transaction,
    userId: string, 
    message: string, 
    type: Notification['type'], 
    link?: string
) {
    const notificationsCollection = collection(db, 'notifications');
    const newNotifRef = doc(notificationsCollection);
    transaction.set(newNotifRef, {
        userId,
        message,
        type,
        link,
        isRead: false,
        createdAt: serverTimestamp(),
    });
}


// Balance Calculation
export async function getUserBalance(userId: string) {
    const transactionsQuery = query(collection(db, 'cashbackTransactions'), where('userId', '==', userId));
    const withdrawalsQuery = query(collection(db, 'withdrawals'), where('userId', '==', userId));
    const ordersQuery = query(collection(db, 'orders'), where('userId', '==', userId));

    const [transactionsSnap, withdrawalsSnap, ordersSnap] = await Promise.all([
        getDocs(transactionsQuery),
        getDocs(withdrawalsQuery),
        getDocs(ordersQuery)
    ]);

    const totalEarned = transactionsSnap.docs.reduce((sum, doc) => sum + doc.data().cashbackAmount, 0);
    
    let pendingWithdrawals = 0;
    let completedWithdrawals = 0;
    withdrawalsSnap.docs.forEach(doc => {
        const withdrawal = doc.data() as Withdrawal;
        if (withdrawal.status === 'Processing') {
            pendingWithdrawals += withdrawal.amount;
        } else if (withdrawal.status === 'Completed') {
            completedWithdrawals += withdrawal.amount;
        }
    });

    const totalSpentOnOrders = ordersSnap.docs
        .filter(doc => doc.data().status !== 'Cancelled')
        .reduce((sum, doc) => sum + doc.data().price, 0);
    
    const availableBalance = totalEarned - completedWithdrawals - pendingWithdrawals - totalSpentOnOrders;

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
        await runTransaction(db, async (transaction) => {
            // 1. Get the user document to find their referrer
            const userRef = doc(db, 'users', userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists() || !userSnap.data().referredBy) {
                console.log(`User ${userId} has no referrer. Skipping commission.`);
                return; // No referrer, nothing to do
            }
            if (amountValue <= 0) {
                console.log(`Commission source amount is zero or negative for user ${userId}. Skipping.`);
                return; // No commission for zero-value transactions
            }

            const referrerId = userSnap.data().referredBy;

            // 2. Get the referrer's document to find their level
            const referrerRef = doc(db, 'users', referrerId);
            const referrerSnap = await transaction.get(referrerRef);
            if (!referrerSnap.exists()) {
                console.log(`Referrer ${referrerId} does not exist. Skipping commission.`);
                return; // Referrer doesn't exist
            }
            const referrerLevel = referrerSnap.data().level || 1;

            // 3. Get the level configuration (outside transaction for read-only data)
            const levels = await getClientLevels(); // Assuming this reads from Firestore but it's okay for a small config collection.
            const currentLevelConfig = levels.find(l => l.id === referrerLevel);
            if (!currentLevelConfig) {
                console.log(`Level config not found for level ${referrerLevel}. Skipping commission.`);
                return; // Level config not found
            }

            // 4. Calculate commission
            const commissionPercent = sourceType === 'cashback'
                ? currentLevelConfig.advantage_referral_cashback
                : currentLevelConfig.advantage_referral_store;
            
            if (commissionPercent <= 0) {
                console.log(`No commission for level ${referrerLevel} and source ${sourceType}. Skipping.`);
                return; // No commission for this action at this level
            }
            
            const commissionAmount = (amountValue * commissionPercent) / 100;

            // 5. Create a new cashback transaction for the referrer
            const newTransactionRef = doc(collection(db, 'cashbackTransactions'));
            transaction.set(newTransactionRef, {
                userId: referrerId,
                accountId: 'REFERRAL_COMMISSION',
                accountNumber: 'Referral',
                broker: `Commission from ${userSnap.data().name}`,
                date: serverTimestamp(),
                tradeDetails: `Referral commission from ${sourceType}`,
                cashbackAmount: commissionAmount,
                sourceUserId: userId,
                sourceType: sourceType,
            });
            
            // 6. Update referrer's monthly earnings
            transaction.update(referrerRef, {
                monthlyEarnings: increment(commissionAmount)
            });

            // 7. Create notification for the referrer
            const message = `لقد ربحت ${commissionAmount.toFixed(2)}$ عمولة إحالة من ${userSnap.data().name}.`;
            await createNotification(transaction, referrerId, message, 'general', '/dashboard/referrals');
        });
    } catch (error) {
        console.error(`Failed to award referral commission to user ${userId}'s referrer:`, error);
        // We don't re-throw the error, so it doesn't block the main flow.
        // This could be logged to a separate error monitoring service.
    }
}

export async function clawbackReferralCommission(
    transaction: Transaction,
    originalUserId: string,
    sourceType: 'cashback' | 'store_purchase',
    originalAmount: number
) {
    const userRef = doc(db, 'users', originalUserId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists() || !userSnap.data().referredBy) {
        return; // No referrer, nothing to claw back
    }
    const referrerId = userSnap.data().referredBy;
    const referrerRef = doc(db, 'users', referrerId);
    const referrerSnap = await transaction.get(referrerRef);
    if (!referrerSnap.exists()) return; // Referrer doesn't exist

    const referrerLevel = referrerSnap.data().level || 1;
    const levels = await getClientLevels();
    const currentLevelConfig = levels.find(l => l.id === referrerLevel);
    if (!currentLevelConfig) return;

    const commissionPercent = sourceType === 'cashback' ? currentLevelConfig.advantage_referral_cashback : currentLevelConfig.advantage_referral_store;
    if (commissionPercent <= 0) return;

    const commissionAmountToClawback = (originalAmount * commissionPercent) / 100;
    
    // Create a negative cashback transaction for the referrer
    const newTransactionRef = doc(collection(db, 'cashbackTransactions'));
    transaction.set(newTransactionRef, {
        userId: referrerId,
        accountId: 'CLAWBACK',
        accountNumber: 'Clawback',
        broker: `Reversed Commission from ${userSnap.data().name}`,
        date: serverTimestamp(),
        tradeDetails: `Commission reversed due to cancelled order/transaction from original user.`,
        cashbackAmount: -commissionAmountToClawback, // Negative amount
        sourceUserId: originalUserId,
        sourceType: sourceType,
    });

    // Deduct from referrer's monthly earnings
    transaction.update(referrerRef, {
        monthlyEarnings: increment(-commissionAmountToClawback)
    });

    // Create notification for the referrer
    const message = `تم خصم ${commissionAmountToClawback.toFixed(2)}$ من رصيدك بسبب إلغاء معاملة من قبل ${userSnap.data().name}.`;
    await createNotification(transaction, referrerId, message, 'general', '/dashboard/referrals');
}

// Admin Notifications
export async function getAdminNotifications(): Promise<AdminNotification[]> {
    await verifyAdmin();
    const snapshot = await getDocs(query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(doc => {
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
    await verifyAdmin();
    try {
        // Log the admin notification itself
        const adminNotifRef = doc(collection(db, 'adminNotifications'));
        await setDoc(adminNotifRef, {
            message,
            target,
            userIds,
            createdAt: serverTimestamp(),
        });

        // Create notifications for the targeted users
        const batch = writeBatch(db);
        let targetUsers: { id: string }[] = [];

        if (target === 'all') {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            targetUsers = usersSnapshot.docs.map(doc => ({ id: doc.id }));
        } else {
            targetUsers = userIds.map(id => ({ id }));
        }

        if (targetUsers.length === 0) {
            return { success: false, message: 'لم يتم تحديد مستخدمين مستهدفين.' };
        }

        await runTransaction(db, async (transaction) => {
            targetUsers.forEach(user => {
                const userNotifRef = doc(collection(db, 'notifications'));
                transaction.set(userNotifRef, {
                    userId: user.id,
                    message,
                    type: 'announcement',
                    isRead: false,
                    createdAt: serverTimestamp(),
                });
            });
        });


        return { success: true, message: `تم إرسال الإشعار إلى ${targetUsers.length} مستخدم.` };

    } catch (error) {
        console.error("Error sending admin notification:", error);
        return { success: false, message: 'فشل إرسال الإشعار.' };
    }
}
export async function getBannerSettings(): Promise<BannerSettings> {
    const docRef = doc(db, 'settings', 'banner');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as BannerSettings;
    }
    // Return default settings if not found
    return {
        isEnabled: false,
        type: 'text',
        title: "",
        text: "",
        ctaText: "",
        ctaLink: "",
        scriptCode: "",
        targetTiers: [],
        targetCountries: [],
        targetStatuses: [],
    };
}
export async function updateBannerSettings(settings: BannerSettings) {
    await verifyAdmin();
    try {
        const docRef = doc(db, 'settings', 'banner');
        await setDoc(docRef, settings, { merge: true });
        return { success: true, message: 'تم تحديث إعدادات البانر بنجاح.' };
    } catch (error) {
        console.error("Error updating banner settings:", error);
        return { success: false, message: 'فشل تحديث إعدادات البانر.' };
    }
}

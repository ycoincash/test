
'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import type { UserProfile, UserStatus, ClientLevel, TradingAccount, CashbackTransaction, Withdrawal, Order, KycData, AddressData, ActivityLog } from '@/types';
import { startOfMonth } from 'date-fns';
import { getClientLevels } from '@/app/actions';

/**
 * Recursively converts Firestore Timestamps to JavaScript Date objects.
 * This is necessary to make data serializable for Next.js Client Components.
 * @param obj The object to traverse.
 * @returns A new object with all Timestamps converted to Dates.
 */
function convertTimestamps(obj: any): any {
    if (!obj) return obj;
    if (obj.toDate && typeof obj.toDate === 'function') {
        return obj.toDate();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => convertTimestamps(item));
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            newObj[key] = convertTimestamps(obj[key]);
        }
        return newObj;
    }
    return obj;
}


// User Management
export async function getUsers(): Promise<UserProfile[]> {
  const usersSnapshot = await adminDb.collection('users').get();
  const users: UserProfile[] = [];
  usersSnapshot.docs.forEach(doc => {
      try {
          const data = doc.data();
          users.push(convertTimestamps({
              uid: doc.id,
              ...data,
          }) as UserProfile);
      } catch (error) {
          console.error(`Error processing user ${doc.id}:`, error);
      }
  });
  return users;
}

export async function updateUser(userId: string, data: Partial<Omit<UserProfile, 'uid'>>) {
    try {
        await adminDb.collection('users').doc(userId).update(data);
        return { success: true, message: 'تم تحديث الملف الشخصي بنجاح.' };
    } catch (error) {
        console.error("Error updating user profile:", error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف.';
        return { success: false, message: `فشل تحديث الملف الشخصي: ${errorMessage}` };
    }
}

export async function adminUpdateKyc(userId: string, kycData: KycData) {
    try {
        await adminDb.collection('users').doc(userId).update({ kycData });
        return { success: true, message: "تم تحديث حالة KYC." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function adminUpdateAddress(userId: string, addressData: AddressData) {
    try {
        await adminDb.collection('users').doc(userId).update({ addressData });
        return { success: true, message: "تم تحديث بيانات العنوان." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function adminUpdatePhoneNumber(userId: string, phoneNumber: string) {
    try {
        await adminDb.collection('users').doc(userId).update({ 
            phoneNumber,
            phoneNumberVerified: false,
        });
        return { success: true, message: "تم تحديث رقم الهاتف." };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}


// Admin migration script for user statuses
export async function backfillUserStatuses(): Promise<{ success: boolean; message: string; }> {
    try {
        const usersSnapshot = await adminDb.collection('users').get();
        const batch = adminDb.batch();
        let updatedCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data() as UserProfile;
            const userId = userDoc.id;

            if (user.status) {
                continue;
            }

            let newStatus: UserStatus = 'NEW';

            const cashbackSnap = await adminDb.collection('cashbackTransactions')
                .where('userId', '==', userId)
                .limit(1)
                .get();

            if (!cashbackSnap.empty) {
                newStatus = 'Trader';
            } else {
                const accountsSnap = await adminDb.collection('tradingAccounts')
                    .where('userId', '==', userId)
                    .where('status', '==', 'Approved')
                    .limit(1)
                    .get();
                if (!accountsSnap.empty) {
                    newStatus = 'Active';
                }
            }

            batch.update(userDoc.ref, { status: newStatus });
            updatedCount++;
        }

        if (updatedCount > 0) {
            await batch.commit();
            return { success: true, message: `Successfully updated ${updatedCount} users.` };
        } else {
            return { success: true, message: 'All users already have a status. No updates were needed.' };
        }
    } catch (error) {
        console.error("Error backfilling user statuses:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to backfill statuses: ${errorMessage}` };
    }
}

export async function backfillUserLevels(): Promise<{ success: boolean; message: string; }> {
    try {
        const levels = await getClientLevels();
        if (levels.length === 0) {
             return { success: false, message: "No client levels configured. Please seed them first." };
        }
        levels.sort((a, b) => b.required_total - a.required_total);
        const lowestLevel = levels[levels.length - 1];

        const usersSnapshot = await adminDb.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
        
        const monthStart = startOfMonth(new Date());
        const cashbackSnap = await adminDb.collection('cashbackTransactions')
            .where('date', '>=', monthStart)
            .get();

        const monthlyEarningsMap = new Map<string, number>();
        cashbackSnap.forEach(doc => {
            const tx = doc.data();
            const currentEarnings = monthlyEarningsMap.get(tx.userId) || 0;
            monthlyEarningsMap.set(tx.userId, currentEarnings + tx.cashbackAmount);
        });

        const batch = adminDb.batch();
        let updatedCount = 0;

        for (const user of users) {
            const monthlyEarnings = monthlyEarningsMap.get(user.id) || 0;
            const newLevel = levels.find(level => monthlyEarnings >= level.required_total) || lowestLevel;
            batch.update(user.ref, { level: newLevel.id, monthlyEarnings: monthlyEarnings });
            updatedCount++;
        }

        if (updatedCount > 0) {
            await batch.commit();
            return { success: true, message: `Successfully updated ${updatedCount} users with calculated levels and earnings.` };
        } else {
            return { success: true, message: 'No users to update.' };
        }

    } catch (error) {
        console.error("Error backfilling user levels:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to backfill levels: ${errorMessage}` };
    }
}


export async function getUserDetails(userId: string) {
    try {
        const userSnap = await adminDb.collection('users').doc(userId).get();

        if (!userSnap.exists) {
            throw new Error("لم يتم العثور على المستخدم");
        }
        
        const rawData = userSnap.data();
        const userProfile = convertTimestamps({ uid: userSnap.id, ...rawData });

        const balanceData = { availableBalance: 0, totalEarned: 0, completedWithdrawals: 0, pendingWithdrawals: 0, totalSpentOnOrders: 0 };
        
        const [
            accountsSnapshot,
            transactionsSnapshot,
            withdrawalsSnapshot,
            ordersSnapshot
        ] = await Promise.all([
            adminDb.collection('tradingAccounts').where('userId', '==', userId).get(),
            adminDb.collection('cashbackTransactions').where('userId', '==', userId).get(),
            adminDb.collection('withdrawals').where('userId', '==', userId).get(),
            adminDb.collection('orders').where('userId', '==', userId).get(),
        ]);

        const tradingAccounts: TradingAccount[] = accountsSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        const cashbackTransactions: CashbackTransaction[] = transactionsSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        const withdrawals: Withdrawal[] = withdrawalsSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        const orders: Order[] = ordersSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));

        cashbackTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
        withdrawals.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
        orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        let referredByName = null;
        if (userProfile.referredBy) {
            const referrerSnap = await adminDb.collection('users').doc(userProfile.referredBy).get();
            if (referrerSnap.exists) {
                referredByName = referrerSnap.data()?.name;
            }
        }

        let referralsWithNames = [];
        if (userProfile.referrals && userProfile.referrals.length > 0) {
            const referralPromises = userProfile.referrals.map(uid => 
                adminDb.collection('users').doc(uid).get()
            );
            const referralSnaps = await Promise.all(referralPromises);
            referralsWithNames = referralSnaps
                .filter(snap => snap.exists)
                .map(snap => ({ uid: snap.id, name: snap.data()?.name || 'مستخدم غير معروف' }));
        }

        return {
            userProfile,
            balance: balanceData,
            tradingAccounts,
            cashbackTransactions,
            withdrawals,
            orders,
            referredByName,
            referralsWithNames,
        };
    } catch (error) {
        console.error("Error fetching user details:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { error: errorMessage };
    }
}

export async function getUserActivityLogs(userId: string): Promise<ActivityLog[]> {
    const snapshot = await adminDb.collection('activityLogs')
        .where('userId', '==', userId)
        .get();
    const logs: ActivityLog[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
        } as ActivityLog
    });
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return logs;
}

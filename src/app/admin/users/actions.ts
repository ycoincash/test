
'use server';

import { db } from '@/lib/firebase/config';
import { collection, getDocs, writeBatch, query, where, limit, getDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
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
    if (obj instanceof Timestamp) {
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
  const usersSnapshot = await getDocs(collection(db, 'users'));
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
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, data);
        return { success: true, message: 'تم تحديث الملف الشخصي بنجاح.' };
    } catch (error) {
        console.error("Error updating user profile:", error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف.';
        return { success: false, message: `فشل تحديث الملف الشخصي: ${errorMessage}` };
    }
}

export async function adminUpdateKyc(userId: string, kycData: KycData) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { kycData });
        return { success: true, message: "تم تحديث حالة KYC." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function adminUpdateAddress(userId: string, addressData: AddressData) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { addressData });
        return { success: true, message: "تم تحديث بيانات العنوان." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
export async function adminUpdatePhoneNumber(userId: string, phoneNumber: string) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { 
            phoneNumber,
            phoneNumberVerified: false, // Assume verification is needed
        });
        return { success: true, message: "تم تحديث رقم الهاتف." };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}


// Admin migration script for user statuses
export async function backfillUserStatuses(): Promise<{ success: boolean; message: string; }> {
    try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const batch = writeBatch(db);
        let updatedCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data() as UserProfile;
            const userId = userDoc.id;

            if (user.status) { // Skip users who already have a status
                continue;
            }

            let newStatus: UserStatus = 'NEW';

            // Check if they are a trader
            const cashbackQuery = query(collection(db, 'cashbackTransactions'), where('userId', '==', userId), limit(1));
            const cashbackSnap = await getDocs(cashbackQuery);

            if (!cashbackSnap.empty) {
                newStatus = 'Trader';
            } else {
                // Check if they are active
                const accountsQuery = query(collection(db, 'tradingAccounts'), where('userId', '==', userId), where('status', '==', 'Approved'), limit(1));
                const accountsSnap = await getDocs(accountsQuery);
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
        // 1. Get level configuration and sort by highest requirement first
        const levels = await getClientLevels();
        if (levels.length === 0) {
             return { success: false, message: "No client levels configured. Please seed them first." };
        }
        levels.sort((a, b) => b.required_total - a.required_total);
        const lowestLevel = levels[levels.length - 1];


        // 2. Get all users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() } as UserProfile & { id: string, ref: any }));
        
        // 3. Get all cashback transactions for the current month in one go
        const monthStart = startOfMonth(new Date());
        const cashbackQuery = query(
            collection(db, 'cashbackTransactions'),
            where('date', '>=', monthStart)
        );
        const cashbackSnap = await getDocs(cashbackQuery);

        // 4. Process data in memory: calculate monthly earnings for each user
        const monthlyEarningsMap = new Map<string, number>();
        cashbackSnap.forEach(doc => {
            const tx = doc.data();
            const currentEarnings = monthlyEarningsMap.get(tx.userId) || 0;
            monthlyEarningsMap.set(tx.userId, currentEarnings + tx.cashbackAmount);
        });

        // 5. Create a single batch to update all users
        const batch = writeBatch(db);
        let updatedCount = 0;

        for (const user of users) {
            const monthlyEarnings = monthlyEarningsMap.get(user.id) || 0;
            
            // Find the highest level the user qualifies for.
            // If they don't qualify for any, they get the lowest possible level.
            const newLevel = levels.find(level => monthlyEarnings >= level.required_total) || lowestLevel;
            
            // Update user document in the batch
            batch.update(user.ref, { level: newLevel.id, monthlyEarnings: monthlyEarnings });
            updatedCount++;
        }

        // 6. Commit the batch
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
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            throw new Error("لم يتم العثور على المستخدم");
        }
        
        const rawData = userSnap.data();
        const userProfile = convertTimestamps({ uid: userSnap.id, ...rawData });


        const accountsQuery = query(collection(db, "tradingAccounts"), where("userId", "==", userId));
        const transactionsQuery = query(collection(db, "cashbackTransactions"), where("userId", "==", userId));
        const withdrawalsQuery = query(collection(db, "withdrawals"), where("userId", "==", userId));
        const ordersQuery = query(collection(db, "orders"), where("userId", "==", userId));
        
        const balanceData = { availableBalance: 0, totalEarned: 0, completedWithdrawals: 0, pendingWithdrawals: 0, totalSpentOnOrders: 0 };
        
        const [
            accountsSnapshot,
            transactionsSnapshot,
            withdrawalsSnapshot,
            ordersSnapshot
        ] = await Promise.all([
            getDocs(accountsQuery),
            getDocs(transactionsQuery),
            getDocs(withdrawalsQuery),
            getDocs(ordersQuery),
        ]);

        const tradingAccounts: TradingAccount[] = accountsSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        const cashbackTransactions: CashbackTransaction[] = transactionsSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        const withdrawals: Withdrawal[] = withdrawalsSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        const orders: Order[] = ordersSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));

        cashbackTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
        withdrawals.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
        orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Fetch referrer name
        let referredByName = null;
        if (userProfile.referredBy) {
            const referrerSnap = await getDoc(doc(db, 'users', userProfile.referredBy));
            if (referrerSnap.exists()) {
                referredByName = referrerSnap.data().name;
            }
        }

        // Fetch names of referred users
        let referralsWithNames = [];
        if (userProfile.referrals && userProfile.referrals.length > 0) {
            const referralPromises = userProfile.referrals.map(uid => getDoc(doc(db, 'users', uid)));
            const referralSnaps = await Promise.all(referralPromises);
            referralsWithNames = referralSnaps
                .filter(snap => snap.exists())
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
    const q = query(
        collection(db, 'activityLogs'),
        where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    const logs: ActivityLog[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            timestamp: (data.timestamp as Timestamp).toDate() || new Date(),
        } as ActivityLog
    });
    // Perform sorting in-memory to avoid composite index requirement
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return logs;
}

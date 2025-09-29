
'use server';

import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, updateDoc, Timestamp, runTransaction, query, where } from 'firebase/firestore';
import type { UserProfile, PendingVerification, KycData, AddressData } from '@/types';
import { createNotification } from '../actions';

async function verifyAdmin() {
    // This is a placeholder for a real admin verification check.
    return true;
}

const safeToDate = (timestamp: any): Date | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp.toDate) return timestamp.toDate();
    return undefined;
};


export async function getPendingVerifications(): Promise<PendingVerification[]> {
    await verifyAdmin();
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    const pendingRequests: PendingVerification[] = [];

    usersSnapshot.docs.forEach(doc => {
        const user = { uid: doc.id, ...doc.data() } as UserProfile;

        // Check for pending KYC
        if (user.kycData && user.kycData.status === 'Pending') {
            pendingRequests.push({
                userId: user.uid,
                userName: user.name,
                userEmail: user.email,
                type: 'KYC',
                requestedAt: safeToDate(user.kycData.submittedAt) || new Date(),
                data: {
                    ...user.kycData,
                    submittedAt: safeToDate(user.kycData.submittedAt) || new Date(),
                }
            });
        }
        
        // Check for pending Address
        if (user.addressData && user.addressData.status === 'Pending') {
             pendingRequests.push({
                userId: user.uid,
                userName: user.name,
                userEmail: user.email,
                type: 'Address',
                requestedAt: safeToDate(user.addressData.submittedAt) || new Date(),
                data: {
                    ...user.addressData,
                    submittedAt: safeToDate(user.addressData.submittedAt) || new Date(),
                }
            });
        }
        
        // Check for pending Phone
        if (user.phoneNumber && !user.phoneNumberVerified) {
             pendingRequests.push({
                userId: user.uid,
                userName: user.name,
                userEmail: user.email,
                type: 'Phone',
                requestedAt: new Date(), // Use current date as phone doesn't have a submission timestamp
                data: { phoneNumber: user.phoneNumber }
            });
        }
    });

    // Sort by most recent requests first
    pendingRequests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

    return pendingRequests;
}


export async function updateVerificationStatus(
    userId: string,
    type: 'kyc' | 'address' | 'phone',
    status: 'Verified' | 'Rejected',
    reason?: string
) {
    await verifyAdmin();
    return runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        let updateData: Record<string, any> = {};
        let notificationMessage = '';
        let notificationLink = '/dashboard/settings/verification';

        if (type === 'kyc') {
            updateData['kycData.status'] = status;
            if (status === 'Rejected') {
                if (!reason) throw new Error("Rejection reason is required.");
                updateData['kycData.rejectionReason'] = reason;
                notificationMessage = `تم رفض طلب التحقق من الهوية. السبب: ${reason}`;
            } else {
                notificationMessage = 'تم التحقق من هويتك بنجاح.';
            }
        } else if (type === 'address') {
            updateData['addressData.status'] = status;
            if (status === 'Rejected') {
                if (!reason) throw new Error("Rejection reason is required.");
                updateData['addressData.rejectionReason'] = reason;
                notificationMessage = `تم رفض طلب التحقق من العنوان. السبب: ${reason}`;
            } else {
                notificationMessage = 'تم التحقق من عنوانك بنجاح.';
            }
        } else if (type === 'phone') {
            if (status === 'Verified') {
                updateData['phoneNumberVerified'] = true;
                notificationMessage = 'تم التحقق من رقم هاتفك بنجاح.';
            } else {
                if (!reason) throw new Error("Rejection reason is required.");
                updateData['phoneNumberVerified'] = false;
                // We might not want to clear the number, just mark as not verified
                notificationMessage = `فشل التحقق من رقم هاتفك. السبب: ${reason}`;
            }
        }
        
        transaction.update(userRef, updateData);
        await createNotification(transaction, userId, notificationMessage, 'general', notificationLink);

        return { success: true, message: `تم تحديث حالة التحقق بنجاح.` };

    }).catch(error => {
        console.error(`Error updating ${type} status for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير معروف";
        return { success: false, message: `فشل تحديث حالة التحقق: ${errorMessage}` };
    });
}

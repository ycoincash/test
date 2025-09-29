
'use server';

import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';
import type { TradingAccount } from '@/types';
import { addCashbackTransaction } from '../manage-cashback/actions';

const safeToDate = (timestamp: any): Date | undefined => {
    if (timestamp && timestamp._seconds) {
        return new Date(timestamp._seconds * 1000);
    }
    if (timestamp instanceof Date) {
        return timestamp;
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    return undefined;
};


export async function processBulkCashback(validatedData: { accountNumber: string, cashbackAmount: number, note: string, userId: string, accountId: string, broker: string }[]) {
    if (validatedData.length === 0) {
        return { success: false, message: "No valid rows to process." };
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each row one by one by calling the existing manual add function
    for (const data of validatedData) {
        try {
            const result = await addCashbackTransaction({
                userId: data.userId,
                accountId: data.accountId,
                accountNumber: data.accountNumber,
                broker: data.broker,
                tradeDetails: data.note,
                cashbackAmount: data.cashbackAmount,
            });

            if (result.success) {
                successCount++;
            } else {
                errorCount++;
                errors.push(`Account ${data.accountNumber}: ${result.message}`);
            }
        } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            errors.push(`Account ${data.accountNumber}: ${errorMessage}`);
            console.error(`Failed to process cashback for account ${data.accountNumber}:`, error);
        }
    }
    
    let message = `Processing complete. Successfully added ${successCount} transactions.`;
    if (errorCount > 0) {
        message += ` ${errorCount} failed.`;
    }
    
    return { 
        success: errorCount === 0, 
        message: message,
        errors: errors,
    };
}

export async function getApprovedAccounts(): Promise<TradingAccount[]> {
    const accountsQuery = adminDb.collection('tradingAccounts').where('status', '==', 'Approved');
    const snapshot = await accountsQuery.get();
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            createdAt: safeToDate(data.createdAt) || new Date(),
        } as TradingAccount
    });
}


'use server';

import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { TradingAccount } from '@/types';
import { addCashbackTransaction } from '../manage-cashback/actions';

async function verifyAdmin() {
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


export async function processBulkCashback(validatedData: { accountNumber: string, cashbackAmount: number, note: string, userId: string, accountId: string, broker: string }[]) {
    await verifyAdmin();
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
    await verifyAdmin();
    const accountsQuery = query(collection(db, 'tradingAccounts'), where('status', '==', 'Approved'));
    const snapshot = await getDocs(accountsQuery);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            createdAt: safeToDate(data.createdAt) || new Date(),
        } as TradingAccount
    });
}

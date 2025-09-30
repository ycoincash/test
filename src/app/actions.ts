
'use server';

import { generateProjectSummary } from "@/ai/flows/generate-project-summary";
import type { GenerateProjectSummaryOutput } from "@/ai/flows/generate-project-summary";
import { calculateCashback } from "@/ai/flows/calculate-cashback";
import type { CalculateCashbackInput, CalculateCashbackOutput } from "@/ai/flows/calculate-cashback";
import { auth, db } from "@/lib/firebase/config";
import { adminDb } from '@/lib/firebase/admin-config';
import { verifyClientIdToken } from '@/lib/auth-helpers';
import * as admin from 'firebase-admin';
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { doc, setDoc, Timestamp, getDocs, collection, query, where, runTransaction, arrayUnion, writeBatch, increment, getDoc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { generateReferralCode } from "@/lib/referral";
import { logUserActivity } from "./admin/actions";
import { getClientSessionInfo } from "@/lib/device-info";
import type { Order, Product, ProductCategory, CashbackTransaction, KycData, AddressData, FeedbackForm, ClientLevel, Notification, FeedbackResponse, Withdrawal, TradingAccount, UserProfile, BlogPost, DeviceInfo, GeoInfo } from "@/types";

// Hardcoded data based on https://github.com/tcb4dev/cashback1
const projectData = {
    projectDescription: "A cashback calculation system in Go that processes customer transactions. It determines cashback rewards based on a set of configurable rules, including handling for blacklisted Merchant Category Codes (MCCs). The system is exposed via a RESTful API.",
    architectureDetails: "The project is a single microservice built in Go. It exposes a REST API for calculating cashback. The core logic is encapsulated within a rules engine that evaluates transactions against a list of rules to determine the final cashback amount. It has handlers for different API endpoints, and a main function to set up the server.",
    technologyDetails: "The backend is written entirely in Go. It uses the `gorilla/mux` library for HTTP routing and request handling. The project has no external database dependencies mentioned in the repository, suggesting it might be stateless or store data in memory/files.",
    mainGoals: "The main goal is to provide a reliable and efficient service for calculating cashback on transactions. It aims to be flexible through a rule-based system and provide a clear API for integration into larger e-commerce or financial platforms.",
};

export async function handleGenerateSummary(): Promise<{ summary: string | null; error: string | null }> {
    try {
        const result: GenerateProjectSummaryOutput = await generateProjectSummary(projectData);
        if (result && result.summary) {
            return { summary: result.summary, error: null };
        }
        return { summary: null, error: "Failed to generate summary." };
    } catch (e) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        return { summary: null, error: `An error occurred: ${errorMessage}` };
    }
}


export async function handleCalculateCashback(input: CalculateCashbackInput): Promise<{ result: CalculateCashbackOutput | null; error: string | null }> {
    try {
        const result: CalculateCashbackOutput = await calculateCashback(input);
        if (result) {
            return { result, error: null };
        }
        return { result: null, error: "Failed to calculate cashback." };
    } catch (e) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        return { result: null, error: `An error occurred: ${errorMessage}` };
    }
}

export async function handleRegisterUser(formData: { name: string, email: string, password: string, referralCode?: string }) {
    const { name, email, password, referralCode } = formData;
    
    let referrerId: string | null = null;

    // Validate referral code using Admin SDK (bypasses Firestore rules)
    if (referralCode) {
        try {
            const usersQuery = adminDb.collection('users').where('referralCode', '==', referralCode);
            const querySnapshot = await usersQuery.get();
            if (querySnapshot.empty) {
                return { success: false, error: "The referral code you entered is not valid." };
            }
            referrerId = querySnapshot.docs[0].id;
        } catch (error) {
            console.error("Error validating referral code:", error);
            return { success: false, error: "Failed to validate referral code." };
        }
    }

    let userCredential;
    try {
        // Create Firebase Auth user
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Use Admin SDK transaction for atomic counter increment and user creation
        const newClientId = await adminDb.runTransaction(async (transaction) => {
            const counterRef = adminDb.collection('counters').doc('userCounter');
            const counterSnap = await transaction.get(counterRef);
            const lastId = counterSnap.exists ? (counterSnap.data()?.lastId || 100000) : 100000;
            const clientId = lastId + 1;

            // Create user document
            const userRef = adminDb.collection('users').doc(user.uid);
            transaction.set(userRef, {
                name,
                email,
                clientId,
                role: "user",
                status: "NEW",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                referralCode: generateReferralCode(name),
                referredBy: referrerId,
                referrals: [],
                level: 1,
                monthlyEarnings: 0,
                country: null,
            });

            // Update referrer's referrals array if applicable
            if (referrerId) {
                const referrerRef = adminDb.collection('users').doc(referrerId);
                transaction.update(referrerRef, {
                    referrals: admin.firestore.FieldValue.arrayUnion(user.uid)
                });
            }

            // Update counter atomically
            transaction.set(counterRef, { lastId: clientId }, { merge: true });

            return clientId;
        });
        
        return { success: true, userId: user.uid };

    } catch (error: any) {
        // If user was created in Auth but Firestore operations failed, delete the user using Admin SDK
        if (userCredential) {
            try {
                await admin.auth().deleteUser(userCredential.user.uid);
            } catch (deleteError) {
                console.error("Failed to delete user after registration failure:", deleteError);
            }
        }

        console.error("Registration Error:", error);
        
        if (error.code === 'auth/email-already-in-use') {
            return { success: false, error: "This email is already in use. Please log in." };
        }
        
        return { success: false, error: "An unexpected error occurred during registration. Please try again." };
    }
}


export async function handleLogout() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error("Logout Error: ", error);
        return { success: false, error: "Failed to log out." };
    }
}


export async function handleForgotPassword(email: string) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error: any) {
        console.error("Forgot Password Error: ", error);
        if (error.code === 'auth/user-not-found') {
            return { success: false, error: "No user found with this email address." };
        }
        return { success: false, error: "An unexpected error occurred. Please try again." };
    }
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

export async function getClientLevels(): Promise<ClientLevel[]> {
    const levelsCollection = collection(db, 'clientLevels');
    const snapshot = await getDocs(levelsCollection);
    if (snapshot.empty) {
        return [];
    }
    const levelsArray = snapshot.docs.map(doc => ({
        id: parseInt(doc.id, 10),
        ...doc.data()
    } as ClientLevel));
    levelsArray.sort((a, b) => a.id - b.id);
    return levelsArray;
}

export async function getNotificationsForUser(idToken: string): Promise<Notification[]> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    // Use Admin SDK to bypass Firestore rules (server-side only)
    const querySnapshot = await adminDb.collection('notifications')
        .where('userId', '==', userId)
        .get();

    const notifications = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
        } as Notification;
    });

    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return notifications;
}

export async function markNotificationsAsRead(idToken: string, notificationIds: string[]) {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    // Use Admin SDK batch for better reliability
    const batch = adminDb.batch();
    
    // Verify all notifications belong to the user before updating
    const notificationRefs = notificationIds.map(id => 
        adminDb.collection('notifications').doc(id)
    );
    
    const notifications = await Promise.all(
        notificationRefs.map(ref => ref.get())
    );
    
    notifications.forEach((notifSnap, index) => {
        if (notifSnap.exists && notifSnap.data()?.userId === userId) {
            batch.update(notificationRefs[index], { isRead: true });
        }
    });
    
    await batch.commit();
}


export async function getActiveFeedbackFormForUser(idToken: string): Promise<FeedbackForm | null> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    // Use Admin SDK to bypass Firestore rules (server-side only)
    const activeFormsSnap = await adminDb.collection('feedbackForms')
        .where('status', '==', 'active')
        .get();
    if (activeFormsSnap.empty) {
        return null;
    }

    const activeForms = activeFormsSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
        } as FeedbackForm;
    });
    
    activeForms.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());

    const userResponsesQuery = query(collection(db, 'feedbackResponses'), where('userId', '==', userId));
    const userResponsesSnap = await getDocs(userResponsesQuery);
    const respondedFormIds = new Set(userResponsesSnap.docs.map(doc => doc.data().formId));

    for (const form of activeForms) {
        if (!respondedFormIds.has(form.id)) {
            return form;
        }
    }

    return null;
}

export async function submitFeedbackResponse(
    idToken: string,
    formId: string,
    answers: Record<string, any>
): Promise<{ success: boolean, message: string }> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    try {
        // Use Admin SDK for transaction
        const db = adminDb;
        
        await db.runTransaction(async (transaction) => {
            const formRef = db.collection('feedbackForms').doc(formId);
            const responseRef = db.collection('feedbackResponses').doc();

            const responsePayload = {
                formId,
                userId,
                submittedAt: new Date(),
                answers,
            };

            transaction.set(responseRef, responsePayload);
            transaction.update(formRef, { responseCount: adminDb.FieldValue.increment(1) });
        });

        return { success: true, message: "شكرا لملاحظاتك!" };
    } catch (error) {
        console.error("Error submitting feedback:", error);
        return { success: false, message: "فشل إرسال الملاحظات." };
    }
}
export async function getProducts(): Promise<Product[]> {
    const snapshot = await getDocs(query(collection(db, 'products')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

export async function getCategories(): Promise<ProductCategory[]> {
    const snapshot = await getDocs(query(collection(db, 'productCategories')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory));
}

export async function getOrders(userId: string): Promise<Order[]> {
    const q = query(
        collection(db, 'orders'),
        where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: safeToDate(data.createdAt) || new Date(),
        } as Order;
    });
    orders.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    return orders;
}

export async function getCashbackTransactions(idToken: string): Promise<CashbackTransaction[]> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    // Use Admin SDK to bypass Firestore rules (server-side only)
    const transactionsSnapshot = await adminDb.collection('cashbackTransactions')
        .where('userId', '==', userId)
        .get();
    const userTransactions = transactionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, date: data.date?.toDate() || new Date() } as CashbackTransaction;
    });
    userTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    return userTransactions;
}

export async function placeOrder(
    userId: string,
    productId: string,
    formData: { userName: string; userEmail: string; deliveryPhoneNumber: string },
    clientInfo: { deviceInfo: DeviceInfo, geoInfo: GeoInfo }
) {
    let product: Product | null = null;

    return runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) throw new Error("Product not found.");
        product = productSnap.data() as Product;

        const { availableBalance } = await getUserBalance(userId);

        if (product.stock <= 0) throw new Error("This product is currently out of stock.");
        if (availableBalance < product.price) throw new Error("You do not have enough available balance to purchase this item.");

        transaction.update(productRef, { stock: increment(-1) });

        const orderRef = doc(collection(db, 'orders'));
        transaction.set(orderRef, {
            userId,
            productId,
            productName: product.name,
            productImage: product.imageUrl,
            price: product.price,
            status: 'Pending',
            createdAt: Timestamp.now(),
            userName: formData.userName,
            userEmail: formData.userEmail,
            deliveryPhoneNumber: formData.deliveryPhoneNumber,
            referralCommissionAwarded: false,
        });

        await logUserActivity(userId, 'store_purchase', clientInfo, { productId, price: product.price });
        
        return { success: true, message: 'تم تقديم الطلب بنجاح!' };
    }).catch(error => {
        console.error('Error placing order:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while placing your order.';
        return { success: false, message: errorMessage };
    });
}


export async function sendVerificationEmail(): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (user) {
        try {
            await auth.sendEmailVerification(user);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: 'No user is signed in.' };
}


export async function submitKycData(idToken: string, data: Omit<KycData, 'status' | 'submittedAt'>): Promise<{ success: boolean; error?: string }> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    try {
        const kycData: KycData = {
            ...data,
            status: 'Pending',
            submittedAt: new Date(),
        };
        await adminDb.collection('users').doc(userId).update({ kycData });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function submitAddressData(idToken: string, data: Omit<AddressData, 'status' | 'submittedAt'>): Promise<{ success: boolean; error?: string }> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    try {
        const addressData: AddressData = {
            ...data,
            status: 'Pending',
            submittedAt: new Date(),
        };
        await adminDb.collection('users').doc(userId).update({ addressData });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateUserPhoneNumber(idToken: string, phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    try {
        await adminDb.collection('users').doc(userId).update({ 
            phoneNumber: phoneNumber,
            phoneNumberVerified: false // Needs verification
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getUserBalance(idToken: string) {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    // Use Admin SDK to bypass Firestore rules (server-side only)
    const [transactionsSnap, withdrawalsSnap, ordersSnap] = await Promise.all([
        adminDb.collection('cashbackTransactions').where('userId', '==', userId).get(),
        adminDb.collection('withdrawals').where('userId', '==', userId).get(),
        adminDb.collection('orders').where('userId', '==', userId).get()
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
export async function requestWithdrawal(
    idToken: string, 
    payload: Omit<Withdrawal, 'id' | 'requestedAt' | 'userId'>
) {
    // Verify the ID token and extract the user ID
    const decodedToken = await verifyClientIdToken(idToken);
    const userId = decodedToken.uid;
    
    try {
        // Use Admin SDK for transaction
        await adminDb.runTransaction(async (transaction) => {
            // Validate user balance server-side
            const [transactionsSnap, withdrawalsSnap, ordersSnap] = await Promise.all([
                adminDb.collection('cashbackTransactions').where('userId', '==', userId).get(),
                adminDb.collection('withdrawals').where('userId', '==', userId).get(),
                adminDb.collection('orders').where('userId', '==', userId).get()
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
            
            if (payload.amount > availableBalance) {
                throw new Error("Insufficient available balance for this withdrawal.");
            }
            
            const newWithdrawalRef = adminDb.collection('withdrawals').doc();
            transaction.set(newWithdrawalRef, {
                ...payload,
                userId,
                requestedAt: new Date()
            });
        });
        
        return { success: true, message: 'Withdrawal request submitted successfully.' };
    } catch (error) {
        console.error('Error requesting withdrawal:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: errorMessage };
    }
}
// Admin function - gets ALL trading accounts
export async function getTradingAccounts(): Promise<TradingAccount[]> {
  const accountsSnapshot = await getDocs(collection(db, 'tradingAccounts'));
  const accounts: TradingAccount[] = [];
  accountsSnapshot.docs.forEach(doc => {
      try {
          const data = doc.data();
          accounts.push({
            id: doc.id,
            ...data,
            createdAt: safeToDate(data.createdAt) || new Date(),
          } as TradingAccount);
      } catch (error) {
          console.error(`Error processing trading account ${doc.id}:`, error);
      }
  });
  return accounts;
}

// User function - gets trading accounts for specific user
export async function getUserTradingAccounts(idToken: string): Promise<TradingAccount[]> {
  // Verify the ID token and extract the user ID
  const decodedToken = await verifyClientIdToken(idToken);
  const userId = decodedToken.uid;
  
  // Use Admin SDK to bypass Firestore rules (server-side only)
  const accountsSnapshot = await adminDb.collection('tradingAccounts')
    .where('userId', '==', userId)
    .get();
  
  const accounts: TradingAccount[] = accountsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as TradingAccount;
  });
  
  return accounts;
}

// User function - gets withdrawals for specific user
export async function getUserWithdrawals(idToken: string): Promise<Withdrawal[]> {
  // Verify the ID token and extract the user ID
  const decodedToken = await verifyClientIdToken(idToken);
  const userId = decodedToken.uid;
  
  // Use Admin SDK to bypass Firestore rules (server-side only)
  const withdrawalsSnapshot = await adminDb.collection('withdrawals')
    .where('userId', '==', userId)
    .get();
  
  const withdrawals: Withdrawal[] = withdrawalsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      requestedAt: data.requestedAt?.toDate() || new Date(),
      completedAt: data.completedAt?.toDate(),
    } as Withdrawal;
  });
  
  return withdrawals;
}

// Admin function - gets dashboard statistics
export async function getAdminDashboardStats(idToken: string) {
  // Verify admin token
  const decodedToken = await verifyClientIdToken(idToken);
  if (!decodedToken.admin) {
    throw new Error('Unauthorized: Admin access required');
  }
  
  // Fetch all cashback transactions for commissions calculation
  const commissionsSnapshot = await adminDb.collection('cashbackTransactions')
    .where('sourceType', 'in', ['cashback', 'store_purchase'])
    .get();
  
  const totalReferralCommissions = commissionsSnapshot.docs.reduce((sum, doc) => {
    return sum + (doc.data().cashbackAmount || 0);
  }, 0);
  
  // Fetch non-cancelled orders for store spending
  const ordersSnapshot = await adminDb.collection('orders')
    .get();
  
  const totalStoreSpending = ordersSnapshot.docs
    .filter(doc => doc.data().status !== 'Cancelled')
    .reduce((sum, doc) => sum + (doc.data().price || 0), 0);
  
  // Fetch all cashback transactions for total cashback added
  const allCashbackSnapshot = await adminDb.collection('cashbackTransactions')
    .get();
  
  const totalCashbackAdded = allCashbackSnapshot.docs.reduce((sum, doc) => {
    return sum + (doc.data().cashbackAmount || 0);
  }, 0);
  
  return {
    totalReferralCommissions,
    totalStoreSpending,
    totalCashbackAdded,
  };
}

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
    const q = query(
        collection(db, 'blogPosts'), 
        where('status', '==', 'published')
    );
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));

    // Sort in-memory to avoid composite index
    posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return posts;
}
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const q = query(
        collection(db, 'blogPosts'), 
        where('slug', '==', slug), 
        where('status', '==', 'published')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    return convertTimestamps({id: snapshot.docs[0].id, ...snapshot.docs[0].data()});
}
export async function addBlogPost(data: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        await addDoc(collection(db, 'blogPosts'), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { success: true, message: 'تم إنشاء المقال بنجاح.' };
    } catch (error) {
        console.error("Error adding blog post:", error);
        return { success: false, message: 'فشل إنشاء المقال.' };
    }
}
export async function updateBlogPost(id: string, data: Partial<Omit<BlogPost, 'id' | 'createdAt'>>) {
    try {
        const postRef = doc(db, 'blogPosts', id);
        await updateDoc(postRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        return { success: true, message: 'تم تحديث المقال بنجاح.' };
    } catch (error) {
        console.error("Error updating blog post:", error);
        return { success: false, message: 'فشل تحديث المقال.' };
    }
}
export async function deleteBlogPost(id: string) {
    try {
        await deleteDoc(doc(db, 'blogPosts', id));
        return { success: true, message: 'تم حذف المقال بنجاح.' };
    } catch (error) {
        console.error("Error deleting blog post:", error);
        return { success: false, message: 'فشل حذف المقال.' };
    }
}

      

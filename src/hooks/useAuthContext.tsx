
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { UserProfile } from '@/types';

// Extend the user object to include the profile
export interface AppUser extends FirebaseAuthUser {
    profile?: UserProfile;
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  refetchUserData: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    isLoading: true,
    refetchUserData: () => {},
});

const safeToDate = (timestamp: any): Date | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp.toDate) return timestamp.toDate();
    return undefined;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (firebaseUser: FirebaseAuthUser) => {
    if (!firebaseUser) {
        setUser(null);
        setIsLoading(false);
        return;
    }
    try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let userProfile: UserProfile | undefined = undefined;
        
        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            userProfile = {
                uid: firebaseUser.uid,
                ...data,
                createdAt: safeToDate(data.createdAt),
                kycData: data.kycData ? { ...data.kycData, submittedAt: safeToDate(data.kycData.submittedAt) } : undefined,
                addressData: data.addressData ? { ...data.addressData, submittedAt: safeToDate(data.addressData.submittedAt) } : undefined,
            } as UserProfile;
        }

        setUser({ 
            ...firebaseUser, 
            profile: userProfile,
        });

    } catch (error) {
        console.error("Error fetching user data:", error);
        setUser(firebaseUser); // Fallback to just firebase user
    } finally {
        setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        fetchUserData(firebaseUser);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // Custom event to trigger a refetch
    const handleRefetch = () => {
        if(auth.currentUser) {
            fetchUserData(auth.currentUser);
        }
    };
    window.addEventListener('refetchUser', handleRefetch);

    return () => {
        unsubscribe();
        window.removeEventListener('refetchUser', handleRefetch);
    };
  }, [fetchUserData]);
  
  const refetchUserData = useCallback(() => {
      if(auth.currentUser) {
          setIsLoading(true);
          fetchUserData(auth.currentUser);
      }
  }, [fetchUserData]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetchUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);

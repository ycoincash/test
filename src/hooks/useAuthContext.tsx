"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types';
import type { User } from '@supabase/supabase-js';

export interface AppUser extends User {
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
    if (typeof timestamp === 'string') return new Date(timestamp);
    return undefined;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchUserData = useCallback(async (supabaseUser: User) => {
    if (!supabaseUser) {
        setUser(null);
        setIsLoading(false);
        return;
    }
    try {
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', supabaseUser.id)
            .single();
        
        let profile: UserProfile | undefined = undefined;
        
        if (!error && userProfile) {
            profile = {
                id: supabaseUser.id,
                email: userProfile.email,
                name: userProfile.name,
                role: userProfile.role,
                clientId: userProfile.client_id,
                createdAt: safeToDate(userProfile.created_at),
                country: userProfile.country,
                isVerified: userProfile.is_verified,
                status: userProfile.status,
                phoneNumber: userProfile.phone_number,
                phoneNumberVerified: userProfile.phone_number_verified,
                referralCode: userProfile.referral_code,
                referredBy: userProfile.referred_by,
                referrals: [], // Will be calculated from referrals query if needed
                level: userProfile.level,
                monthlyEarnings: userProfile.monthly_earnings,
                kycData: userProfile.kyc_document_type ? {
                    documentType: userProfile.kyc_document_type,
                    documentNumber: userProfile.kyc_document_number,
                    gender: userProfile.kyc_gender,
                    status: userProfile.kyc_status,
                    submittedAt: safeToDate(userProfile.kyc_submitted_at),
                    rejectionReason: userProfile.kyc_rejection_reason,
                } : undefined,
                addressData: userProfile.address_country ? {
                    country: userProfile.address_country,
                    city: userProfile.address_city,
                    streetAddress: userProfile.address_street,
                    status: userProfile.address_status,
                    submittedAt: safeToDate(userProfile.address_submitted_at),
                    rejectionReason: userProfile.address_rejection_reason,
                } : undefined,
            } as UserProfile;
        }

        setUser({ 
            ...supabaseUser, 
            profile: profile,
        });

    } catch (error) {
        console.error("Error fetching user data:", error);
        setUser(supabaseUser as AppUser);
    } finally {
        setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoading(true);
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // Custom event to trigger a refetch
    const handleRefetch = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if(session?.user) {
            fetchUserData(session.user);
        }
    };
    window.addEventListener('refetchUser', handleRefetch);

    return () => {
        subscription.unsubscribe();
        window.removeEventListener('refetchUser', handleRefetch);
    };
  }, [fetchUserData, supabase]);
  
  const refetchUserData = useCallback(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if(session?.user) {
          setIsLoading(true);
          fetchUserData(session.user);
      }
  }, [fetchUserData, supabase]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetchUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);


"use client"

import { useAuthContext } from "@/hooks/useAuthContext";
import React, { useState } from 'react';
import { Loader2, ChevronRight, Mail, Phone, User, Home, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { sendVerificationEmail } from "@/app/actions";
import type { KycData, AddressData } from "@/types";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KycVerificationForm } from "@/components/verification/KycVerificationForm";
import { AddressVerificationForm } from "@/components/verification/AddressVerificationForm";

// KYC Dialog Component
function KycFormDialog({ onKycSubmit, userCountry }: { onKycSubmit: () => void; userCountry?: string | null }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="h-full w-full p-0 justify-start">
                    <VerificationItemContent icon={User} title="التحقق من الهوية (KYC)" status="Not Verified" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>التحقق من الهوية (KYC)</DialogTitle>
                </DialogHeader>
                <KycVerificationForm 
                    onSuccess={() => {
                        onKycSubmit();
                        setIsOpen(false);
                    }} 
                    onCancel={() => setIsOpen(false)}
                    userCountry={userCountry}
                />
            </DialogContent>
        </Dialog>
    );
}

// Address Dialog Component
function AddressFormDialog({ onAddressSubmit, userCountry }: { onAddressSubmit: () => void; userCountry?: string | null }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="h-full w-full p-0 justify-start">
                    <VerificationItemContent icon={Home} title="التحقق من العنوان" status="Not Verified" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>التحقق من العنوان</DialogTitle>
                </DialogHeader>
                <AddressVerificationForm 
                    onSuccess={() => {
                        onAddressSubmit();
                        setIsOpen(false);
                    }} 
                    onCancel={() => setIsOpen(false)}
                    userCountry={userCountry}
                />
            </DialogContent>
        </Dialog>
    );
}

// Reusable UI part for each verification item
function VerificationItemContent({ icon: Icon, title, status }: { icon: React.ElementType, title: string, status: 'Verified' | 'Not Verified' | 'Pending' | 'Add' }) {
    const getStatusText = () => {
        switch (status) {
            case 'Verified': return 'تم التحقق';
            case 'Not Verified': return 'لم يتم التحقق';
            case 'Pending': return 'قيد المراجعة';
            case 'Add': return 'إضافة';
            default: return status;
        }
    }
    return (
        <Card className="hover:bg-muted/50 transition-colors w-full">
            <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-4 flex-grow">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="font-semibold">{title}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                    <Badge variant={status === 'Verified' ? 'default' : status === 'Add' ? 'outline' : status === 'Pending' ? 'secondary' : 'destructive'}>
                        {getStatusText()}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function VerificationPage() {
    const { user, isLoading, refetchUserData } = useAuthContext();
    const router = useRouter();
    const { toast } = useToast();
    
    const handleSendVerificationEmail = async () => {
        const result = await sendVerificationEmail();
        if (result.success) {
            toast({ title: "تم الإرسال!", description: "تم إرسال بريد التحقق. يرجى التحقق من صندوق الوارد الخاص بك." });
        } else {
            toast({ variant: 'destructive', title: "خطأ", description: result.error });
        }
    };
    
    const handleAddPhoneNumber = () => {
        if (!user) return;
        router.push(`/phone-verification?userId=${user.id}`);
    };

    if (isLoading || !user?.profile) {
        return (
            <div className="flex items-center justify-center h-full min-h-[calc(100vh-theme(spacing.14))]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    const { profile } = user;

    // Determine statuses
    const emailStatus = user.emailVerified ? 'Verified' : 'Not Verified';
    const phoneStatus = !profile.phoneNumber ? 'Add' : profile.phoneNumberVerified ? 'Verified' : 'Pending';
    const kycStatus = !profile.kycData ? 'Not Verified' : profile.kycData.status;
    const addressStatus = !profile.addressData ? 'Not Verified' : profile.addressData.status;

    return (
        <div className="space-y-3">
            {/* Email Verification */}
            <button
                className="w-full text-left"
                onClick={emailStatus === 'Not Verified' ? handleSendVerificationEmail : undefined}
                disabled={emailStatus === 'Verified'}
            >
                <VerificationItemContent icon={Mail} title="التحقق من البريد الإلكتروني" status={emailStatus} />
            </button>

            {/* Phone Verification */}
            <button 
                className="w-full text-left"
                onClick={phoneStatus === 'Add' ? handleAddPhoneNumber : undefined}
                disabled={phoneStatus !== 'Add'}
            >
                <VerificationItemContent icon={Phone} title="التحقق من رقم الهاتف" status={phoneStatus} />
            </button>
             
            {/* Identity (KYC) Verification */}
            {kycStatus === 'Verified' || kycStatus === 'Pending' ? (
                 <VerificationItemContent icon={User} title="التحقق من الهوية (KYC)" status={kycStatus} />
            ) : (
                <KycFormDialog onKycSubmit={refetchUserData} userCountry={profile.country} />
            )}

            {/* Address Verification */}
            {addressStatus === 'Verified' || addressStatus === 'Pending' ? (
                 <VerificationItemContent icon={Home} title="التحقق من العنوان" status={addressStatus} />
            ) : (
                <AddressFormDialog onAddressSubmit={refetchUserData} userCountry={profile.country} />
            )}
        </div>
    );
}


"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Briefcase,
  Award,
  Coins,
  FileText,
  Gauge,
  Globe,
  Landmark,
  PlusCircle,
  Save,
  ShieldCheck,
  Trash2,
  BrainCircuit,
  Loader2,
  Users,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Broker } from "@/types";
import { addBroker, updateBroker } from "@/app/admin/manage-brokers/actions";
import { TermsBank } from "@/lib/terms-bank";
import { createClient } from "@/lib/supabase/client";

const licenseSchema = z.object({
    authority: z.string().min(1, "جهة الترخيص مطلوبة"),
    licenseNumber: z.string().optional(),
    status: z.string().min(1, "حالة الترخيص مطلوبة"),
});

const formSchema = z.object({
  logoUrl: z.string().url("يجب أن يكون رابطًا صالحًا.").default("https://placehold.co/100x100.png"),
  category: z.enum(['forex', 'crypto', 'other']).default('forex'),
  
  basicInfo: z.object({
    broker_name: z.string().min(2, "اسم الوسيط مطلوب."),
    group_entity: z.string().optional().default(""),
    founded_year: z.coerce.number().optional().default(new Date().getFullYear()),
    headquarters: z.string().optional().default(""),
    CEO: z.string().optional().default(""),
    broker_type: z.string().optional().default(""),
  }),
  regulation: z.object({
    regulation_status: z.string().optional().default(""),
    licenses: z.array(licenseSchema).optional().default([]),
    offshore_regulation: z.boolean().default(false),
    risk_level: z.string().optional().default(""),
    regulated_in: z.array(z.string()).optional().default([]),
    regulator_name: z.array(z.string()).optional().default([]),
  }),
  tradingConditions: z.object({
      account_types: z.array(z.string()).optional().default([]),
      max_leverage: z.string().optional().default("1:500"),
      min_deposit: z.coerce.number().min(0).default(10),
      spread_type: z.string().optional().default(""),
      min_spread: z.coerce.number().min(0).optional().default(0),
      commission_per_lot: z.coerce.number().min(0).optional().default(0),
      execution_speed: z.string().optional().default(""),
  }),
  platforms: z.object({
      platforms_supported: z.array(z.string()).optional().default([]),
      mt4_license_type: z.enum(['Full License', 'White Label', 'None']).default('None'),
      mt5_license_type: z.enum(['Full License', 'White Label', 'None']).default('None'),
      custom_platform: z.boolean().optional().default(false),
  }),
  instruments: z.object({
      forex_pairs: z.string().optional().default(""),
      crypto_trading: z.boolean().default(false),
      stocks: z.boolean().default(false),
      commodities: z.boolean().default(false),
      indices: z.boolean().default(false),
  }),
  depositsWithdrawals: z.object({
      payment_methods: z.array(z.string()).optional().default([]),
      min_withdrawal: z.coerce.number().min(0).optional().default(0),
      withdrawal_speed: z.string().optional().default(""),
      deposit_fees: z.boolean().default(false),
      withdrawal_fees: z.boolean().default(false),
  }),
  cashback: z.object({
      affiliate_program_link: z.string().url("يجب أن يكون رابطًا صالحًا.").or(z.literal("")).optional().default(""),
      cashback_account_type: z.array(z.string()).optional().default([]),
      cashback_frequency: z.string().optional().default(""),
      rebate_method: z.array(z.string()).optional().default([]),
      cashback_per_lot: z.coerce.number().min(0).optional().default(0),
  }),
  globalReach: z.object({
      business_region: z.array(z.string()).optional().default([]),
      global_presence: z.string().optional().default(""),
      languages_supported: z.array(z.string()).optional().default([]),
      customer_support_channels: z.array(z.string()).optional().default([]),
  }),
  reputation: z.object({
      wikifx_score: z.coerce.number().min(0).max(10).optional().default(0),
      trustpilot_rating: z.coerce.number().min(0).max(5).optional().default(0),
      reviews_count: z.coerce.number().min(0).optional().default(0),
      verified_users: z.coerce.number().min(0).optional().default(0),
  }),
  additionalFeatures: z.object({
      swap_free: z.boolean().default(false),
      education_center: z.boolean().default(false),
      copy_trading: z.boolean().default(false),
      demo_account: z.boolean().default(false),
      trading_contests: z.boolean().default(false),
      regulatory_alerts: z.string().optional().default(""),
      welcome_bonus: z.boolean().default(false),
  }),
  instructions: z.object({
      description: z.string().optional().default(""),
      new_account_instructions: z.string().optional().default(""),
      new_account_link: z.string().url("يجب أن يكون رابطًا صالحًا.").or(z.literal("")).optional().default(""),
      new_account_link_text: z.string().optional().default(""),
  }),
  existingAccountInstructions: z.string().optional().default(""),
});

type BrokerFormValues = z.infer<typeof formSchema>;

const getSafeDefaultValues = (broker?: Broker | null): BrokerFormValues => {
    const defaults: BrokerFormValues = {
        logoUrl: "https://placehold.co/100x100.png",
        category: 'forex',
        basicInfo: { broker_name: "", group_entity: "", founded_year: new Date().getFullYear(), headquarters: "", CEO: "", broker_type: "" },
        regulation: { regulation_status: "", licenses: [], offshore_regulation: false, risk_level: "", regulated_in: [], regulator_name: [] },
        tradingConditions: { account_types: [], max_leverage: "1:500", min_deposit: 10, spread_type: "", min_spread: 0, commission_per_lot: 0, execution_speed: "" },
        platforms: { platforms_supported: [], mt4_license_type: 'None', mt5_license_type: 'None', custom_platform: false },
        instruments: { forex_pairs: "", crypto_trading: false, stocks: false, commodities: false, indices: false },
        depositsWithdrawals: { payment_methods: [], min_withdrawal: 0, withdrawal_speed: "", deposit_fees: false, withdrawal_fees: false },
        cashback: { affiliate_program_link: "", cashback_account_type: [], cashback_frequency: "", rebate_method: [], cashback_per_lot: 0 },
        globalReach: { business_region: [], global_presence: "", languages_supported: [], customer_support_channels: [] },
        reputation: { wikifx_score: 0, trustpilot_rating: 0, reviews_count: 0, verified_users: 0 },
        additionalFeatures: { swap_free: false, education_center: false, copy_trading: false, demo_account: false, trading_contests: false, regulatory_alerts: "", welcome_bonus: false },
        instructions: { description: "", new_account_instructions: "", new_account_link: "", new_account_link_text: "" },
        existingAccountInstructions: "",
    };

    if (!broker) return defaults;

    const brokerCopy = JSON.parse(JSON.stringify(broker));
    
    const merged = {
        ...defaults, ...brokerCopy,
        basicInfo: { ...defaults.basicInfo, ...brokerCopy.basicInfo },
        regulation: { ...defaults.regulation, ...brokerCopy.regulation },
        tradingConditions: { ...defaults.tradingConditions, ...brokerCopy.tradingConditions },
        platforms: { ...defaults.platforms, ...brokerCopy.platforms },
        instruments: { ...defaults.instruments, ...brokerCopy.instruments },
        depositsWithdrawals: { ...defaults.depositsWithdrawals, ...brokerCopy.depositsWithdrawals },
        cashback: { ...defaults.cashback, ...brokerCopy.cashback },
        globalReach: { ...defaults.globalReach, ...brokerCopy.globalReach },
        reputation: { ...defaults.reputation, ...brokerCopy.reputation },
        additionalFeatures: { ...defaults.additionalFeatures, ...brokerCopy.additionalFeatures },
        instructions: { ...defaults.instructions, ...brokerCopy.instructions },
    };

    Object.keys(merged).forEach(key => {
        const section = key as keyof BrokerFormValues;
        if (typeof merged[section] === 'object' && merged[section] !== null) {
            Object.keys(merged[section] as object).forEach(field => {
                if (Array.isArray(defaults[section as keyof typeof defaults]?.[field as keyof {}]) && !Array.isArray((merged[section] as any)[field])) {
                    (merged[section] as any)[field] = [];
                }
            });
        }
    });

    return merged;
};

function DetailCard({ title, icon: Icon, children }: { title: string, icon: React.ElementType, children: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
                <Icon className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-headline">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm space-y-4">
                {children}
            </CardContent>
        </Card>
    )
}

function MultiSelectField({ control, name, label, options }: { control: any, name: any, label: string, options: {key: string, label: string}[]}) {
    return (
        <FormField
            control={control}
            name={name}
            render={() => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {options.map((item) => (
                            <FormField
                                key={item.key}
                                control={control}
                                name={name}
                                render={({ field }) => {
                                    return (
                                        <FormItem key={item.key} className="flex flex-row-reverse items-center space-x-2 space-y-0 rounded-md border p-2 justify-end space-x-reverse">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value?.includes(item.key)}
                                                    onCheckedChange={(checked) => {
                                                        const currentValue = field.value || [];
                                                        return checked
                                                            ? field.onChange([...currentValue, item.key])
                                                            : field.onChange(currentValue?.filter((value: string) => value !== item.key));
                                                    }}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal cursor-pointer text-right w-full">{item.label}</FormLabel>
                                        </FormItem>
                                    )
                                }}
                            />
                        ))}
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function BooleanField({ control, name, label }: { control: any, name: any, label: string }) {
    return (
        <FormField control={control} name={name} render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <FormLabel className="flex-1 cursor-pointer">{label}</FormLabel>
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
        )}/>
    );
}

export default function BrokerFormPage() {
    const router = useRouter();
    const params = useParams();
    const brokerId = params.brokerId as string;
    const isNew = brokerId === 'new';

    const [isLoading, setIsLoading] = useState(!isNew);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<BrokerFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: getSafeDefaultValues(null),
    });

    useEffect(() => {
        if (!isNew) {
            const fetchBroker = async () => {
                setIsLoading(true);
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('brokers')
                    .select('*')
                    .eq('id', brokerId)
                    .single();
                
                if (error || !data) {
                    notFound();
                } else {
                    form.reset(getSafeDefaultValues({ id: data.id, ...data } as Broker));
                }
                setIsLoading(false);
            };
            fetchBroker();
        }
    }, [brokerId, isNew, form]);
    
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "regulation.licenses",
    });

    const onSubmit = async (values: BrokerFormValues) => {
        setIsSubmitting(true);
        try {
            const legacyData = {
                name: values.basicInfo.broker_name,
                description: values.instructions.description,
                rating: Math.round(values.reputation.wikifx_score ? values.reputation.wikifx_score / 2 : 0),
                instructions: {
                    description: values.instructions.new_account_instructions,
                    linkText: values.instructions.new_account_link_text,
                    link: values.instructions.new_account_link,
                }
            };
            const payload = { ...values, ...legacyData };

            let result;
            if (isNew) {
                result = await addBroker(payload as Omit<Broker, 'id' | 'order'>);
            } else {
                result = await updateBroker(brokerId, payload);
            }
            
            if (result.success) {
                toast({ title: "نجاح", description: result.message });
                router.push('/admin/manage-brokers');
            } else {
                toast({ variant: "destructive", title: "خطأ", description: result.message });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "خطأ", description: "حدث خطأ غير متوقع." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-4xl py-6 space-y-6">
                <div className="flex justify-between items-center">
                    <Button variant="ghost" type="button" onClick={() => router.back()}><ArrowLeft className="ml-2 h-4 w-4" />العودة</Button>
                    <h1 className="text-2xl font-bold font-headline">{isNew ? "إضافة وسيط جديد" : "تعديل الوسيط"}</h1>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                        {isNew ? 'إنشاء' : 'حفظ'}
                    </Button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <DetailCard title="المعلومات الأساسية" icon={Briefcase}>
                            <FormField control={form.control} name="logoUrl" render={({ field }) => (<FormItem><FormLabel>رابط الشعار</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="basicInfo.broker_name" render={({ field }) => (<FormItem><FormLabel>اسم الوسيط</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="basicInfo.founded_year" render={({ field }) => (<FormItem><FormLabel>سنة التأسيس</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="basicInfo.headquarters" render={({ field }) => (<FormItem><FormLabel>المقر الرئيسي</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="basicInfo.broker_type" render={({ field }) => (<FormItem><FormLabel>نوع الشركة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.brokerType.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        </DetailCard>

                        <DetailCard title="التراخيص" icon={ShieldCheck}>
                            <FormField control={form.control} name="regulation.regulation_status" render={({ field }) => (<FormItem><FormLabel>الحالة التنظيمية</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.regulationStatus.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="regulation.risk_level" render={({ field }) => (<FormItem><FormLabel>مستوى المخاطرة</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            {fields.map((field, index) => (
                                <div key={field.id} className="p-4 border rounded-md relative space-y-2">
                                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 left-2 h-6 w-6 z-10" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                                    <FormField control={form.control} name={`regulation.licenses.${index}.authority`} render={({ field }) => (<FormItem><FormLabel>جهة الترخيص</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.licenseAuthority.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                    <FormField control={form.control} name={`regulation.licenses.${index}.licenseNumber`} render={({ field }) => (<FormItem><FormLabel>رقم الترخيص</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={form.control} name={`regulation.licenses.${index}.status`} render={({ field }) => (<FormItem><FormLabel>حالة الترخيص</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.regulationStatus.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ authority: '', licenseNumber: '', status: '' })}><PlusCircle className="ml-2 h-4 w-4"/>إضافة ترخيص</Button>
                        </DetailCard>

                        <DetailCard title="منصات التداول" icon={Gauge}>
                            <MultiSelectField control={form.control} name="platforms.platforms_supported" label="المنصات المدعومة" options={TermsBank.platforms} />
                            <Separator className="my-4" />
                            <FormField control={form.control} name="platforms.mt4_license_type" render={({ field }) => (<FormItem><FormLabel>ترخيص MT4</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Full License">كامل</SelectItem><SelectItem value="White Label">وايت ليبل</SelectItem><SelectItem value="None">لا يوجد</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="platforms.mt5_license_type" render={({ field }) => (<FormItem><FormLabel>ترخيص MT5</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Full License">كامل</SelectItem><SelectItem value="White Label">وايت ليبل</SelectItem><SelectItem value="None">لا يوجد</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                        </DetailCard>
                        
                        <DetailCard title="الحسابات وأنواعها" icon={Users}>
                            <MultiSelectField control={form.control} name="tradingConditions.account_types" label="أنواع الحسابات" options={TermsBank.accountTypes} />
                            <Separator className="my-4"/>
                            <FormField control={form.control} name="tradingConditions.min_deposit" render={({ field }) => (<FormItem><FormLabel>الحد الأدنى للإيداع ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="tradingConditions.max_leverage" render={({ field }) => (<FormItem><FormLabel>الرافعة المالية</FormLabel><FormControl><Input placeholder="e.g. 1:500" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="tradingConditions.spread_type" render={({ field }) => (<FormItem><FormLabel>نوع السبريد</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.spreadType.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="tradingConditions.min_spread" render={({ field }) => (<FormItem><FormLabel>أدنى سبريد (نقاط)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </DetailCard>

                        <DetailCard title="ميزات الحساب" icon={Award}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <BooleanField control={form.control} name="additionalFeatures.welcome_bonus" label="بونص ترحيبي" />
                                <BooleanField control={form.control} name="additionalFeatures.copy_trading" label="نسخ التداول" />
                                <BooleanField control={form.control} name="additionalFeatures.swap_free" label="حسابات إسلامية" />
                                <BooleanField control={form.control} name="additionalFeatures.demo_account" label="حسابات تجريبية" />
                                <BooleanField control={form.control} name="additionalFeatures.education_center" label="مركز تعليمي" />
                                <BooleanField control={form.control} name="additionalFeatures.trading_contests" label="مسابقات تداول" />
                            </div>
                        </DetailCard>
                    </div>

                    <div className="space-y-6">
                        <DetailCard title="المنتجات المالية" icon={BrainCircuit}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <BooleanField control={form.control} name="instruments.forex_pairs" label="فوركس" />
                                <BooleanField control={form.control} name="instruments.stocks" label="أسهم" />
                                <BooleanField control={form.control} name="instruments.commodities" label="سلع" />
                                <BooleanField control={form.control} name="instruments.indices" label="مؤشرات" />
                                <BooleanField control={form.control} name="instruments.crypto_trading" label="عملات مشفرة" />
                            </div>
                        </DetailCard>

                         <DetailCard title="طرق الدفع والسحب" icon={Landmark}>
                            <MultiSelectField control={form.control} name="depositsWithdrawals.payment_methods" label="طرق الدفع" options={TermsBank.depositMethods} />
                            <Separator className="my-4" />
                            <FormField control={form.control} name="depositsWithdrawals.min_withdrawal" render={({ field }) => (<FormItem><FormLabel>الحد الأدنى للسحب ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="depositsWithdrawals.withdrawal_speed" render={({ field }) => (<FormItem><FormLabel>سرعة السحب</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.supportHours.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                             <Separator className="my-4" />
                             <div className="grid grid-cols-2 gap-2">
                                <BooleanField control={form.control} name="depositsWithdrawals.deposit_fees" label="رسوم على الإيداع" />
                                <BooleanField control={form.control} name="depositsWithdrawals.withdrawal_fees" label="رسوم على السحب" />
                             </div>
                        </DetailCard>
                        
                        <DetailCard title="الدعم والخدمة" icon={Globe}>
                            <MultiSelectField control={form.control} name="globalReach.languages_supported" label="اللغات المدعومة" options={TermsBank.languagesSupported} />
                            <Separator className="my-4" />
                            <MultiSelectField control={form.control} name="globalReach.customer_support_channels" label="قنوات الدعم" options={TermsBank.supportChannels} />
                            <Separator className="my-4" />
                            <FormField control={form.control} name="globalReach.global_presence" render={({ field }) => (<FormItem><FormLabel>ساعات الدعم</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.supportHours.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        </DetailCard>
                        
                        <DetailCard title="برامج المكافآت" icon={Coins}>
                            <FormField control={form.control} name="cashback.affiliate_program_link" render={({ field }) => (<FormItem><FormLabel>رابط برنامج الإحالة</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <MultiSelectField control={form.control} name="cashback.cashback_account_type" label="أنواع الحسابات المؤهلة" options={TermsBank.accountTypes} />
                            <Separator className="my-4" />
                            <FormField control={form.control} name="cashback.cashback_frequency" render={({ field }) => (<FormItem><FormLabel>تكرار المكافأة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{TermsBank.cashbackFrequency.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <MultiSelectField control={form.control} name="cashback.rebate_method" label="طريقة دفع المكافأة" options={TermsBank.rebateMethod} />
                            <Separator className="my-4" />
                            <FormField control={form.control} name="cashback.cashback_per_lot" render={({ field }) => (<FormItem><FormLabel>قيمة المكافأة لكل لوت ($)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </DetailCard>

                        <DetailCard title="تقييمات الوسيط" icon={Star}>
                             <FormField control={form.control} name="reputation.wikifx_score" render={({ field }) => (<FormItem><FormLabel>تقييم WikiFX (1-10)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="reputation.trustpilot_rating" render={({ field }) => (<FormItem><FormLabel>تقييم Trustpilot (1-5)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="reputation.reviews_count" render={({ field }) => (<FormItem><FormLabel>عدد المراجعات</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="reputation.verified_users" render={({ field }) => (<FormItem><FormLabel>عدد المستخدمين الموثوقين</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </DetailCard>
                        
                        <DetailCard title="وصف وتعليمات" icon={FileText}>
                             <FormField control={form.control} name="instructions.description" render={({ field }) => (<FormItem><FormLabel>وصف الوسيط</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="instructions.new_account_instructions" render={({ field }) => (<FormItem><FormLabel>تعليمات فتح حساب جديد</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="instructions.new_account_link" render={({ field }) => (<FormItem><FormLabel>رابط فتح الحساب</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="instructions.new_account_link_text" render={({ field }) => (<FormItem><FormLabel>نص رابط فتح الحساب</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="existingAccountInstructions" render={({ field }) => (<FormItem><FormLabel>تعليمات ربط الحساب الحالي</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </DetailCard>
                    </div>
                </div>
            </form>
        </Form>
    );
}

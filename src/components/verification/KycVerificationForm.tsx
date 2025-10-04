'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Upload, Trash2, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadVerificationDocument } from '@/app/actions/upload';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';

const kycSchema = z.object({
  documentType: z.enum(['id_card', 'passport', 'driver_license'], { required_error: 'نوع الوثيقة مطلوب' }),
  nationality: z.string().min(2, 'بلد الإصدار مطلوب'),
  documentNumber: z.string().min(5, 'رقم الوثيقة مطلوب (5 أحرف على الأقل)'),
  fullName: z.string().min(3, 'الاسم الكامل مطلوب'),
  dateOfBirth: z.string().min(1, 'تاريخ الميلاد مطلوب'),
  documentIssueDate: z.string().min(1, 'تاريخ الإصدار مطلوب'),
  documentExpiryDate: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
  gender: z.enum(['male', 'female'], { required_error: 'الجنس مطلوب' }),
  documentFrontFile: z.instanceof(File, { message: 'صورة الوثيقة (الوجه الأمامي) مطلوبة' }),
  documentBackFile: z.instanceof(File).optional(),
});

type KycFormValues = z.infer<typeof kycSchema>;

interface KycVerificationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const countries = [
  { value: 'SA', label: 'السعودية', flag: '🇸🇦' },
  { value: 'AE', label: 'الإمارات', flag: '🇦🇪' },
  { value: 'EG', label: 'مصر', flag: '🇪🇬' },
  { value: 'YE', label: 'اليمن', flag: '🇾🇪' },
  { value: 'JO', label: 'الأردن', flag: '🇯🇴' },
  { value: 'LB', label: 'لبنان', flag: '🇱🇧' },
  { value: 'KW', label: 'الكويت', flag: '🇰🇼' },
  { value: 'QA', label: 'قطر', flag: '🇶🇦' },
  { value: 'BH', label: 'البحرين', flag: '🇧🇭' },
  { value: 'OM', label: 'عمان', flag: '🇴🇲' },
];

export function KycVerificationForm({ onSuccess, onCancel }: KycVerificationFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    mode: 'onChange',
    defaultValues: {
      documentType: undefined,
      nationality: '',
      documentNumber: '',
      fullName: '',
      dateOfBirth: '',
      documentIssueDate: '',
      documentExpiryDate: '',
      gender: undefined,
    },
  });

  const documentType = form.watch('documentType');
  const nationality = form.watch('nationality');

  const handleFileChange = (
    file: File | undefined,
    field: 'documentFrontFile' | 'documentBackFile'
  ) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (field === 'documentFrontFile') {
          setFrontPreview(reader.result as string);
        } else {
          setBackPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
      form.setValue(field, file);
    }
  };

  const handleRemoveFile = (field: 'documentFrontFile' | 'documentBackFile') => {
    if (field === 'documentFrontFile') {
      setFrontPreview(null);
      form.setValue('documentFrontFile', undefined as any);
    } else {
      setBackPreview(null);
      form.setValue('documentBackFile', undefined);
    }
  };

  const onSubmit = async (data: KycFormValues) => {
    setIsSubmitting(true);
    try {
      const frontFormData = new FormData();
      frontFormData.append('file', data.documentFrontFile);
      const frontResult = await uploadVerificationDocument(frontFormData, 'kyc_front');

      if (!frontResult.success) {
        throw new Error(frontResult.error || 'فشل رفع الوثيقة الأمامية');
      }

      let backUrl: string | undefined;
      if (data.documentBackFile) {
        const backFormData = new FormData();
        backFormData.append('file', data.documentBackFile);
        const backResult = await uploadVerificationDocument(backFormData, 'kyc_back');
        
        if (!backResult.success) {
          throw new Error(backResult.error || 'فشل رفع الوثيقة الخلفية');
        }
        backUrl = backResult.url;
      }

      const response = await fetch('/api/verification/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          documentFrontUrl: frontResult.url,
          documentBackUrl: backUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('فشل إرسال بيانات التحقق');
      }

      toast({ title: 'نجاح', description: 'تم إرسال معلومات التحقق للمراجعة' });
      onSuccess();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء الإرسال',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    let isValid = false;
    
    if (step === 1) {
      isValid = await form.trigger(['documentType', 'nationality']);
    } else if (step === 2) {
      isValid = await form.trigger(['fullName', 'dateOfBirth', 'gender', 'documentNumber', 'documentIssueDate', 'documentExpiryDate']);
    }
    
    if (isValid) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const progress = (step / 3) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={onCancel} className="text-primary">
            لاحقاً
          </Button>
          <h2 className="text-xl font-bold">التحقق الكامل</h2>
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">حدد نوع مستند الهوية وبلد إصداره</h3>
              </div>

              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">بلد الإصدار *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-14 text-base">
                          <SelectValue placeholder="اختر الدولة">
                            {field.value && (
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{countries.find(c => c.value === field.value)?.flag}</span>
                                <span>{countries.find(c => c.value === field.value)?.label}</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{country.flag}</span>
                              <span>{country.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base">نوع المستند *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="space-y-3"
                      >
                        <label htmlFor="driver_license" className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${field.value === 'driver_license' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                          <span className="text-base">رخصة القيادة</span>
                          <RadioGroupItem value="driver_license" id="driver_license" />
                        </label>
                        
                        <label htmlFor="id_card" className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${field.value === 'id_card' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">بطاقة الهوية</span>
                            {nationality && <span className="text-xl">{countries.find(c => c.value === nationality)?.flag}</span>}
                          </div>
                          <RadioGroupItem value="id_card" id="id_card" />
                        </label>
                        
                        <label htmlFor="passport" className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${field.value === 'passport' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                          <span className="text-base">جواز السفر</span>
                          <RadioGroupItem value="passport" id="passport" />
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-sm text-destructive text-right">* الحقول مطلوبة</p>

              <Button
                type="button"
                onClick={nextStep}
                className="w-full h-12 text-base bg-primary hover:bg-primary/90"
                disabled={!documentType || !nationality}
              >
                متابعة
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">المعلومات الشخصية</h3>
                <p className="text-muted-foreground">تأكد من أن جميع المعلومات مطابقة للوثيقة</p>
              </div>

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الكامل *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="الاسم كما يظهر في الوثيقة" className="h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الميلاد *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الجنس *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="اختر الجنس" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">ذكر</SelectItem>
                          <SelectItem value="female">أنثى</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="documentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الوثيقة *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="أدخل رقم الوثيقة" className="h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="documentIssueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الإصدار *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="documentExpiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الانتهاء *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={prevStep}
                  variant="outline"
                  className="h-12"
                >
                  <ChevronRight className="h-5 w-5" />
                  السابق
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  className="flex-1 h-12 bg-primary hover:bg-primary/90"
                >
                  متابعة
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">تحميل مستند</h3>
                <p className="text-muted-foreground">تأكد من أن جميع المعلومات الواردة في الصورة مرئية وسهلة القراءة</p>
              </div>

              <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                <span className="text-sm">نوع المستند</span>
                <div className="flex items-center gap-2 mr-auto">
                  {nationality && <span className="text-xl">{countries.find(c => c.value === nationality)?.flag}</span>}
                  <span className="font-medium">
                    {documentType === 'id_card' && 'بطاقة الهوية'}
                    {documentType === 'passport' && 'جواز السفر'}
                    {documentType === 'driver_license' && 'رخصة القيادة'}
                  </span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="documentFrontFile"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
                          onChange={(e) => handleFileChange(e.target.files?.[0], 'documentFrontFile')}
                          className="hidden"
                          id="front-upload"
                          {...field}
                        />
                        <label
                          htmlFor="front-upload"
                          className={`block border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                            frontPreview ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 text-right">
                              <p className="font-medium text-base mb-1">الوجه الأمامي</p>
                              {frontPreview ? (
                                <p className="text-sm text-primary">تم التحميل</p>
                              ) : (
                                <p className="text-sm text-primary">اختر من جهازك</p>
                              )}
                            </div>
                            
                            {frontPreview ? (
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                                <Image src={frontPreview} alt="Front" fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </label>
                        {frontPreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 left-2"
                            onClick={() => handleRemoveFile('documentFrontFile')}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {documentType === 'id_card' && (
                <FormField
                  control={form.control}
                  name="documentBackFile"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
                            onChange={(e) => handleFileChange(e.target.files?.[0], 'documentBackFile')}
                            className="hidden"
                            id="back-upload"
                            {...field}
                          />
                          <label
                            htmlFor="back-upload"
                            className={`block border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                              backPreview ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 text-right">
                                <p className="font-medium text-base mb-1">الوجه الخلفي</p>
                                {backPreview ? (
                                  <p className="text-sm text-primary">تم التحميل</p>
                                ) : (
                                  <p className="text-sm text-primary">اختر من جهازك</p>
                                )}
                              </div>
                              
                              {backPreview ? (
                                <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                                  <Image src={backPreview} alt="Back" fill className="object-cover" />
                                </div>
                              ) : (
                                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                                  <Upload className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </label>
                          {backPreview && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 left-2"
                              onClick={() => handleRemoveFile('documentBackFile')}
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <p className="text-xs text-muted-foreground text-center">
                JPG, PNG, HEIC, WEBP أو PDF (الحد الأقصى 50 MB)
              </p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={prevStep}
                  variant="outline"
                  className="h-12"
                  disabled={isSubmitting}
                >
                  <ChevronRight className="h-5 w-5" />
                  السابق
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-primary hover:bg-primary/90"
                  disabled={isSubmitting || !frontPreview}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    'إرسال للمراجعة'
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}

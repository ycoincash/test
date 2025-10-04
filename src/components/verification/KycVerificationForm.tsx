'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadVerificationDocument } from '@/app/actions/upload';

const kycSchema = z.object({
  documentType: z.enum(['id_card', 'passport'], { required_error: 'نوع الوثيقة مطلوب' }),
  documentNumber: z.string().min(5, 'رقم الوثيقة مطلوب (5 أحرف على الأقل)'),
  fullName: z.string().min(3, 'الاسم الكامل مطلوب'),
  dateOfBirth: z.string().min(1, 'تاريخ الميلاد مطلوب'),
  nationality: z.string().min(2, 'الجنسية مطلوبة'),
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

export function KycVerificationForm({ onSuccess, onCancel }: KycVerificationFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      documentType: undefined,
      documentNumber: '',
      fullName: '',
      dateOfBirth: '',
      nationality: '',
      documentIssueDate: '',
      documentExpiryDate: '',
      gender: undefined,
    },
  });

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

  const onSubmit = async (data: KycFormValues) => {
    setIsSubmitting(true);
    try {
      // Upload front document
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

      // Submit KYC data
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

  const documentType = form.watch('documentType');
  const needsBackSide = documentType === 'id_card';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= num
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-muted-foreground text-muted-foreground'
                }`}
              >
                {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
              </div>
              {num < 3 && (
                <div className={`h-0.5 w-12 ${step > num ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Personal Information */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>المعلومات الشخصية</CardTitle>
              <CardDescription>أدخل معلوماتك كما تظهر في وثيقة الهوية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع الوثيقة *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع الوثيقة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="id_card">بطاقة الهوية الوطنية</SelectItem>
                        <SelectItem value="passport">جواز السفر</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الكامل *</FormLabel>
                    <FormControl>
                      <Input placeholder="كما يظهر في الوثيقة" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الجنس *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
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

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الميلاد *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الجنسية *</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: سعودي، مصري، إماراتي" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 2: Document Details */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الوثيقة</CardTitle>
              <CardDescription>أدخل معلومات الوثيقة بدقة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="documentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الوثيقة *</FormLabel>
                    <FormControl>
                      <Input placeholder="أدخل رقم الوثيقة" {...field} />
                    </FormControl>
                    <FormDescription>
                      الرقم المطبوع على {documentType === 'passport' ? 'جواز السفر' : 'بطاقة الهوية'}
                    </FormDescription>
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
                        <Input type="date" {...field} />
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
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  تأكد من صحة التواريخ وأن الوثيقة غير منتهية الصلاحية
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Upload Documents */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>رفع صور الوثيقة</CardTitle>
              <CardDescription>
                يرجى رفع صور واضحة للوثيقة (JPEG، PNG، أو PDF - حتى 10MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Front Side */}
              <FormField
                control={form.control}
                name="documentFrontFile"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>صورة الوثيقة - الوجه الأمامي *</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              {frontPreview ? 'تم الرفع - انقر للتغيير' : 'انقر لرفع الصورة'}
                            </p>
                          </div>
                          <Input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFileChange(e.target.files?.[0], 'documentFrontFile')}
                            {...field}
                          />
                        </label>
                        {frontPreview && (
                          <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                            <img src={frontPreview} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Back Side (only for ID cards) */}
              {needsBackSide && (
                <FormField
                  control={form.control}
                  name="documentBackFile"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>صورة الوثيقة - الوجه الخلفي {needsBackSide && '*'}</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                {backPreview ? 'تم الرفع - انقر للتغيير' : 'انقر لرفع الصورة'}
                              </p>
                            </div>
                            <Input
                              type="file"
                              className="hidden"
                              accept="image/*,application/pdf"
                              onChange={(e) => handleFileChange(e.target.files?.[0], 'documentBackFile')}
                              {...field}
                            />
                          </label>
                          {backPreview && (
                            <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                              <img src={backPreview} alt="Preview" className="w-full h-full object-contain" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  • تأكد من وضوح الصورة وإمكانية قراءة جميع المعلومات<br />
                  • تجنب الانعكاسات الضوئية والظلال<br />
                  • قم بتصوير الوثيقة بالكامل بدون قص
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (step === 1) {
                onCancel();
              } else {
                setStep(step - 1);
              }
            }}
            disabled={isSubmitting}
          >
            {step === 1 ? 'إلغاء' : 'السابق'}
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              onClick={async () => {
                const fields = step === 1
                  ? ['documentType', 'fullName', 'gender', 'dateOfBirth', 'nationality']
                  : ['documentNumber', 'documentIssueDate', 'documentExpiryDate'];

                const valid = await form.trigger(fields as any);
                if (valid) setStep(step + 1);
              }}
            >
              التالي
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                'إرسال للمراجعة'
              )}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

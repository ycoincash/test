'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface KycSimpleUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function KycSimpleUpload({ onSuccess, onCancel }: KycSimpleUploadProps) {
  const [documentType, setDocumentType] = useState<'id_card' | 'passport' | 'driver_license' | null>(null);
  const [nationality, setNationality] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.size);
    setFrontFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFrontPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!frontFile || !documentType || !nationality) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول'
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', frontFile);
      formData.append('documentType', 'kyc_front');

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentage = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentage);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const uploadResult = JSON.parse(xhr.responseText);
          
          const response = await fetch('/api/verification/kyc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentType,
              nationality,
              documentFrontUrl: uploadResult.url,
            }),
          });

          if (response.ok) {
            toast({ title: 'نجاح', description: 'تم رفع الوثيقة بنجاح' });
            onSuccess();
          }
        }
      });

      xhr.addEventListener('error', () => {
        toast({
          variant: 'destructive',
          title: 'خطأ',
          description: 'فشل الرفع'
        });
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'حدث خطأ أثناء الرفع'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-center">رفع وثيقة الهوية</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">نوع الوثيقة</label>
          <div className="grid grid-cols-1 gap-2">
            {(['driver_license', 'id_card', 'passport'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDocumentType(type)}
                className={`p-4 border-2 rounded-lg text-right ${
                  documentType === type ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                {type === 'driver_license' && 'رخصة القيادة'}
                {type === 'id_card' && 'بطاقة الهوية'}
                {type === 'passport' && 'جواز السفر'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">بلد الإصدار</label>
          <input
            type="text"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="مثال: YE"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-6 border-2 border-dashed rounded-lg"
          >
            {frontPreview ? (
              <div className="flex items-center justify-center gap-4">
                <Image src={frontPreview} alt="Preview" width={100} height={100} className="rounded" />
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <p>اضغط لاختيار الصورة</p>
              </div>
            )}
          </button>
        </div>

        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} disabled={uploading}>
            إلغاء
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!frontFile || !documentType || !nationality || uploading}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                جاري الرفع... {uploadProgress}%
              </>
            ) : (
              'رفع الوثيقة'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

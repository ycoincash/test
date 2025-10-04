import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = 'verification-documents';

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Generating pre-signed upload URL');
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ User not authenticated');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('👤 User authenticated:', user.id);

    const body = await request.json();
    const { fileName, fileType, documentType } = body;

    if (!fileName || !fileType || !documentType) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(fileType)) {
      console.error('❌ Invalid file type:', fileType);
      return NextResponse.json(
        { success: false, error: 'نوع الملف غير مدعوم. الرجاء استخدام JPG, PNG, WEBP أو PDF' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop();
    const key = `${user.id}/${documentType}_${timestamp}.${fileExtension}`;

    console.log('🔑 Generating signed URL for key:', key);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const fileUrl = `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`;

    console.log('✅ Pre-signed URL generated successfully');

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileUrl,
      key,
    });
  } catch (error) {
    console.error('❌ Error generating pre-signed URL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

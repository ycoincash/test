import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = 'verification-documents';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadDocument(
  file: File,
  userId: string,
  documentType: 'kyc_front' | 'kyc_back' | 'address_proof'
): Promise<UploadResult> {
  try {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const key = `${userId}/${documentType}_${timestamp}.${fileExtension}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const url = `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`;
    return { success: true, url };
  } catch (error) {
    console.error('Error uploading document:', error);
    return { success: false, error: 'Failed to upload document' };
  }
}

export async function deleteDocument(url: string): Promise<boolean> {
  try {
    const key = url.split(`/${BUCKET_NAME}/`)[1];
    if (!key) return false;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, WEBP, and PDF files are allowed' };
  }

  return { valid: true };
}

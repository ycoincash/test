# S3 Bucket Setup for Document Uploads

## Required Environment Variables

Add these to **Replit Secrets**:

```bash
S3_ENDPOINT=https://[your-s3-endpoint]
S3_ACCESS_KEY_ID=[your-access-key]
S3_SECRET_ACCESS_KEY=[your-secret-key]
```

## S3 Bucket Configuration

### 1. Create Bucket
- Name: `verification-documents`
- Region: Your preferred region

### 2. Configure Public Read Access

Add this bucket policy to allow public read access to uploaded files:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::verification-documents/*"
    }
  ]
}
```

### 3. Enable CORS (for browser uploads)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Architecture

✅ **Serverless Design** - Uses Next.js API Routes (no custom backend)
✅ **Public URLs** - Generated URLs are publicly accessible
✅ **Upload Progress** - Real-time progress tracking with XMLHttpRequest
✅ **Database Storage** - URLs saved to PostgreSQL users table

## File Upload Flow

1. User selects files in browser
2. Files uploaded via `/api/upload` with progress tracking
3. S3 generates public URLs: `https://[endpoint]/verification-documents/[userId]/[file]`
4. URLs saved to database: `kyc_document_front_url`, `kyc_document_back_url`, `kyc_selfie_url`
5. Admin can view documents via public URLs

## Testing

```bash
# Test upload API
curl -X POST http://localhost:5000/api/upload \
  -F "file=@test-image.jpg" \
  -F "documentType=kyc_front" \
  -H "Cookie: [auth-cookie]"
```

## Supported Document Types

- `kyc_front` - Front of ID/passport/driver's license
- `kyc_back` - Back of ID/driver's license
- `kyc_selfie` - Selfie for identity verification
- `address_proof` - Utility bill, bank statement, etc.

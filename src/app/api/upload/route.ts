import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadDocument, validateDocumentFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    console.log('📥 API Upload route called');
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ Upload failed: User not authenticated');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('👤 User authenticated:', user.id);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as 'kyc_front' | 'kyc_back' | 'kyc_selfie' | 'address_proof';

    if (!file) {
      console.error('❌ Upload failed: No file provided');
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!documentType) {
      console.error('❌ Upload failed: No document type provided');
      return NextResponse.json(
        { success: false, error: 'Document type required' },
        { status: 400 }
      );
    }

    console.log('📁 File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
      documentType
    });

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      console.error('❌ Validation failed:', validation.error);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    console.log('✅ File validation passed');

    const result = await uploadDocument(file, user.id, documentType);
    
    if (result.success) {
      console.log('✅ Upload completed successfully:', result.url);
      return NextResponse.json(result);
    } else {
      console.error('❌ Upload failed:', result.error);
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in upload API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

'use server';

import { uploadDocument, validateDocumentFile } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

export async function uploadVerificationDocument(
  formData: FormData,
  documentType: 'kyc_front' | 'kyc_back' | 'address_proof'
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const result = await uploadDocument(file, user.id, documentType);
    return result;
  } catch (error) {
    console.error('Error in uploadVerificationDocument:', error);
    return { success: false, error: 'Failed to upload document' };
  }
}

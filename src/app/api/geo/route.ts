import { NextResponse } from 'next/server';
import { getCountryFromHeaders } from '@/lib/server-geo';

export async function GET() {
    try {
        const country = await getCountryFromHeaders();
        
        return NextResponse.json({ 
            country: country || 'SA'
        });
    } catch (error) {
        console.error('Error in /api/geo:', error);
        return NextResponse.json({ country: 'SA' }, { status: 200 });
    }
}

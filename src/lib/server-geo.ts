import { headers } from 'next/headers';

export async function getCountryFromHeaders(): Promise<string | null> {
    try {
        const headersList = await headers();
        const forwarded = headersList.get('x-forwarded-for');
        const realIp = headersList.get('x-real-ip');
        
        const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || null;
        
        if (!ip || ip === 'localhost' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            return null;
        }

        const token = process.env.IPINFO_TOKEN;
        
        if (token) {
            const response = await fetch(`https://ipinfo.io/${ip}/country?token=${token}`, {
                next: { revalidate: 3600 }
            });
            
            if (response.ok) {
                const country = await response.text();
                return country.trim().toUpperCase();
            }
        }
        
        const fallbackResponse = await fetch(`https://ipapi.co/${ip}/country_code/`, {
            next: { revalidate: 3600 }
        });
        
        if (fallbackResponse.ok) {
            const country = await fallbackResponse.text();
            return country.trim().toUpperCase();
        }
        
        return null;
    } catch (error) {
        console.error('Error detecting country from IP:', error);
        return null;
    }
}

export async function getGeoFromHeaders(): Promise<{ country: string | null; ip: string | null; city?: string }> {
    try {
        const headersList = await headers();
        const forwarded = headersList.get('x-forwarded-for');
        const realIp = headersList.get('x-real-ip');
        
        const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || null;
        
        if (!ip || ip === 'localhost' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            console.log('Private/local IP detected, skipping geo lookup');
            return { country: null, ip: null };
        }

        const token = process.env.IPINFO_TOKEN;
        
        if (token) {
            try {
                const response = await fetch(`https://ipinfo.io/${ip}?token=${token}`, {
                    next: { revalidate: 3600 }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('IPinfo data:', { ip, country: data.country, city: data.city });
                    return {
                        country: data.country?.toUpperCase() || null,
                        city: data.city || undefined,
                        ip: data.ip || ip
                    };
                }
            } catch (err) {
                console.error('IPinfo fetch error:', err);
            }
        }
        
        try {
            const fallbackResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
                next: { revalidate: 3600 }
            });
            
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                console.log('IPapi data:', { ip, country: data.country_code, city: data.city });
                return {
                    country: data.country_code?.toUpperCase() || null,
                    city: data.city || undefined,
                    ip: data.ip || ip
                };
            }
        } catch (err) {
            console.error('IPapi fetch error:', err);
        }
        
        return { country: null, ip };
    } catch (error) {
        console.error('Error detecting geo from IP:', error);
        return { country: null, ip: null };
    }
}

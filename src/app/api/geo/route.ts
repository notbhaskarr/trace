import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const city = request.headers.get('x-vercel-ip-city');
  const region = request.headers.get('x-vercel-ip-country-region');
  
  // If we are in production on Vercel, these headers will exist
  if (city) {
    return NextResponse.json({ city, region });
  }

  // Fallback for local development
  try {
    const res = await fetch('https://ipinfo.io/json');
    const data = await res.json();
    return NextResponse.json({ city: data.city, region: data.region });
  } catch (e) {
    return NextResponse.json({ city: 'UNKNOWN', region: '' });
  }
}

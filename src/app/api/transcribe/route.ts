import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SARVAM_API_KEY is not set' }, { status: 500 });
    }

    // Prepare the form data for Sarvam API
    const sarvamFormData = new FormData();
    sarvamFormData.append('file', file, 'audio.webm'); // Web browsers usually record in webm
    sarvamFormData.append('model', 'saaras:v3');
    sarvamFormData.append('mode', 'translit'); // Using transliteration for code-mixed Hindi/English in Latin script

    // Call Sarvam API
    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        // Do NOT set Content-Type manually, fetch will auto-set it with boundary for FormData
      },
      body: sarvamFormData as any,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Sarvam API Error:', data);
      return NextResponse.json(
        { error: data.message || 'Failed to transcribe audio' },
        { status: response.status }
      );
    }

    return NextResponse.json({ transcript: data.transcript });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

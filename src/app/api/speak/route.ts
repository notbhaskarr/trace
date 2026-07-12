import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SARVAM_API_KEY is not set' }, { status: 500 });
    }

    const payload = {
      inputs: [text],
      target_language_code: "hi-IN",
      speaker: "neha",
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 8000,
      enable_preprocessing: true,
      model: "bulbul:v3"
    };

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Sarvam TTS Error:', data);
      return NextResponse.json(
        { error: data?.error?.message || data.message || 'Failed to generate speech' },
        { status: response.status }
      );
    }

    // Sarvam returns the base64 encoded audio in the `audios` array
    if (data.audios && data.audios.length > 0) {
      return NextResponse.json({ audio: data.audios[0] });
    } else {
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
    }

  } catch (error) {
    console.error('Speech generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

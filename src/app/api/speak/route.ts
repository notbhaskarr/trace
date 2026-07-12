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

    // Split text into chunks of <= 450 characters at punctuation marks to bypass 500 char limit
    const chunks: string[] = [];
    let currentText = text;
    while (currentText.length > 0) {
      if (currentText.length <= 450) {
        chunks.push(currentText);
        break;
      }
      
      let splitIdx = currentText.lastIndexOf('.', 450);
      if (splitIdx === -1) splitIdx = currentText.lastIndexOf('?', 450);
      if (splitIdx === -1) splitIdx = currentText.lastIndexOf('!', 450);
      if (splitIdx === -1) splitIdx = currentText.lastIndexOf(' ', 450);
      if (splitIdx === -1) splitIdx = 450; // hard split if no spaces

      chunks.push(currentText.substring(0, splitIdx + 1).trim());
      currentText = currentText.substring(splitIdx + 1).trim();
    }

    const payload = {
      inputs: chunks,
      target_language_code: "hi-IN",
      speaker: "neha",
      pace: 1.0,
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

    // Sarvam returns an array of base64 encoded audios corresponding to the inputs
    if (data.audios && data.audios.length > 0) {
      return NextResponse.json({ audios: data.audios });
    } else {
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
    }

  } catch (error) {
    console.error('Speech generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

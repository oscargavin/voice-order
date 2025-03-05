// src/app/api/realtime/session/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse request body to get offer
    const body = await req.json();
    const { offer } = body;
    
    if (!offer || !offer.sdp) {
      return NextResponse.json(
        { error: 'WebRTC offer SDP is required' },
        { status: 400 }
      );
    }

    // First, create an ephemeral token using the OpenAI API
    // Since the SDK doesn't have direct Realtime API support yet, we'll use fetch
    const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17", // Use the appropriate model from the documentation
        voice: "ash", // The voice used for audio responses
      }),
    });
    
    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error("Error from OpenAI Sessions API:", errorText);
      return NextResponse.json(
        { error: 'Failed to create session with OpenAI', details: errorText },
        { status: sessionResponse.status }
      );
    }
    
    const sessionData = await sessionResponse.json();

    // Use the ephemeral token to connect to the OpenAI Realtime API
    const ephemeralKey = sessionData.client_secret.value;
    
    // Send the offer to OpenAI Realtime API
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17"; // Same as above
    
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      },
    });

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text();
      console.error("Error from OpenAI Realtime API:", errorText);
      return NextResponse.json(
        { error: 'Failed to get SDP answer from OpenAI', details: errorText },
        { status: sdpResponse.status }
      );
    }

    const answerSdp = await sdpResponse.text();

    // Return the SDP answer from OpenAI
    return NextResponse.json({
      answer: {
        type: "answer",
        sdp: answerSdp
      },
      ephemeralKey,
      sessionId: sessionData.id
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Realtime session route:', error);
    return NextResponse.json(
      { error: 'Failed to process WebRTC connection', details: (error as Error).message },
      { status: 500 }
    );
  }
}
// src/app/api/realtime/session/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse request body to get offer and voice ID
    const body = await req.json();
    const { offer } = body;
    
    if (!offer || !offer.sdp) {
      return NextResponse.json(
        { error: 'WebRTC offer SDP is required' },
        { status: 400 }
      );
    }

    // Define the exact system prompt to use
    const systemPrompt = `
    You are a friendly and professional order-taking assistant for OpenInfo Foodservice, a food distribution company.
    
    Your task is to help customers place orders for food products and ingredients. Follow these steps:
    
    1. Ask for and collect the customer's name or account code. Example: "What's your name?" or "What account is this for?"
    
    2. Ask for and collect the delivery date. Example: "When would you like this delivered?" Confirm the exact date: "So that's Wednesday, March 12th."
    
    3. Ask for and collect product information. Example: "What products would you like to order?" Listen carefully for product names and quantities.
    
    4. After collecting all the information, summarize the order: "Let me confirm your order: [CUSTOMER] has ordered [PRODUCTS] for delivery on [DATE]."
    
    5. Ask if the information is correct. Example: "Is that correct?" If yes, confirm the order. If no, ask what needs to be corrected.
    
    6. When the order is complete, end with this exact message:
       "Great, order received - we'll let you know once this is confirmed by the team and send a confirmation to this number and the email address we have on record. Have a nice day!"
    
    YOU MUST BEGIN THE CONVERSATION IMMEDIATELY with a greeting like "Hi, you've reached orders at OpenInfo Foodservice, where are you calling from today?"
    Do not wait for the user to speak first.
    Be patient and helpful. Keep responses concise and professional.
    Clearly identify exactly what fields you're collecting at each step, and confirm them before moving to the next step.
    `;

    // Create a session with ElevenLabs API
    const sessionResponse = await fetch("https://api.elevenlabs.io/v1/conversation", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: "eleven_flash_v2_5",
        voice_id: "jobi", // Using Jobi voice
        system_prompt: systemPrompt,
        initial_message: "Hi, you've reached orders at OpenInfo Foodservice, where are you calling from today?",
        output_format: "pcm_16000",
      }),
    });
    
    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error("Error from ElevenLabs API:", errorText);
      return NextResponse.json(
        { error: 'Failed to create session with ElevenLabs', details: errorText },
        { status: sessionResponse.status }
      );
    }
    
    const sessionData = await sessionResponse.json();

    // Get the WebRTC connection details from ElevenLabs
    const rtcResponse = await fetch(`https://api.elevenlabs.io/v1/conversation/${sessionData.conversation_id}/webrtc`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sdp: offer.sdp,
        type: offer.type,
      }),
    });

    if (!rtcResponse.ok) {
      const errorText = await rtcResponse.text();
      console.error("Error from ElevenLabs WebRTC API:", errorText);
      return NextResponse.json(
        { error: 'Failed to get SDP answer from ElevenLabs', details: errorText },
        { status: rtcResponse.status }
      );
    }

    const rtcData = await rtcResponse.json();

    // Return the SDP answer from ElevenLabs
    return NextResponse.json({
      answer: {
        type: "answer",
        sdp: rtcData.sdp
      },
      conversationId: sessionData.conversation_id,
      systemPrompt: true
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Realtime session route:', error);
    return NextResponse.json(
      { error: 'Failed to process WebRTC connection', details: (error as Error).message },
      { status: 500 }
    );
  }
}
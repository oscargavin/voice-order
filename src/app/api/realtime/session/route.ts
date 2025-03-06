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

    // First, create an ephemeral token using the OpenAI API
    const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17", // Use the appropriate model from the documentation
        voice: "alloy", // The voice used for audio responses
        instructions: systemPrompt, // Set the system prompt here directly
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
      sessionId: sessionData.id,
      systemPrompt: true // Signal to the frontend that we've set the system prompt
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Realtime session route:', error);
    return NextResponse.json(
      { error: 'Failed to process WebRTC connection', details: (error as Error).message },
      { status: 500 }
    );
  }
}
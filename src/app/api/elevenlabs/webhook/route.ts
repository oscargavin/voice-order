import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Get the ElevenLabs signature from headers
    const signature = req.headers.get('elevenlabs-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing ElevenLabs signature' },
        { status: 401 }
      );
    }

    // Verify the webhook signature
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    if (calculatedSignature !== signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Handle different webhook event types
    switch (body.type) {
      case 'conversation.started':
        console.log('Conversation started:', body.conversation_id);
        break;
      case 'conversation.message':
        console.log('New message in conversation:', body.message);
        break;
      case 'conversation.ended':
        console.log('Conversation ended:', body.conversation_id);
        break;
      default:
        console.log('Unknown webhook event:', body.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
} 
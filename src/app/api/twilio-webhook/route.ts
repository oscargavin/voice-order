// src/app/api/twilio-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure the route is not cached

export async function POST(request: NextRequest) {
  try {
    // Get current date information
    const now = new Date();
    
    // Format today's date in ISO format (YYYY-MM-DD)
    const today = now.toISOString().split('T')[0];
    
    // Get day of week for reference in the prompt
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 
                      'August', 'September', 'October', 'November', 'December'][now.getMonth()];
    
    // Create a human-readable date for the prompt
    const formattedDate = `${dayOfWeek}, ${monthName} ${now.getDate()}, ${now.getFullYear()}`;
    
    // Parse the request body
    const body = await request.json();
    const { caller_id, agent_id, called_number, call_sid } = body;
    
    console.log('Webhook called with:', { caller_id, agent_id, called_number, call_sid, today });
    
    // Create response with only today's date as a dynamic variable
    const response = {
      "dynamic_variables": {
        "today": today
      },
      "conversation_config_override": {
        "agent": {
          "prompt": {
            "prompt": `Today is ${formattedDate}. Use this information when discussing delivery dates with the customer.`
          }
        }
      }
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
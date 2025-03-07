// src/app/api/twilio-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure the route is not cached

// Helper function to generate date response
function generateDateResponse(callerInfo = {}) {
  // Get current date information
  const now = new Date();
  
  // Format today's date in ISO format (YYYY-MM-DD)
  const today = now.toISOString().split('T')[0];
  
  // Get day of week
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 
                    'August', 'September', 'October', 'November', 'December'][now.getMonth()];
  
  // Create a human-readable date for the prompt
  const formattedDate = `${dayOfWeek}, ${monthName} ${now.getDate()}, ${now.getFullYear()}`;
  
  // Calculate tomorrow and its day of the week
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrow.getDay()];
  const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
  
  // Create response with expanded date variables
  return {
    "dynamic_variables": {
      "today": today,
      "day_of_week": dayOfWeek,
      "tomorrow": tomorrowFormatted,
      "tomorrow_day": tomorrowDayOfWeek
    },
    "conversation_config_override": {
      "agent": {
        "prompt": {
          "prompt": `Today is ${formattedDate} and tomorrow is ${tomorrowDayOfWeek}, ${monthName} ${tomorrow.getDate()}, ${tomorrow.getFullYear()}. Use this information when discussing delivery dates with the customer.`
        }
      }
    }
  };
}

// Handle GET requests (no body parameters)
export async function GET(request: NextRequest) {
  try {
    console.log('GET webhook called');
    
    // Generate response with date information
    const response = generateDateResponse();
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle POST requests (with body parameters)
export async function POST(request: NextRequest) {
  try {
    // Parse the request body if available
    let callerInfo = {};
    
    try {
      const body = await request.json();
      const { caller_id, agent_id, called_number, call_sid } = body;
      callerInfo = { caller_id, agent_id, called_number, call_sid };
      console.log('POST webhook called with:', callerInfo);
    } catch (e) {
      console.log('POST webhook called with no body or invalid JSON');
    }
    
    // Generate response with date information
    const response = generateDateResponse(callerInfo);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
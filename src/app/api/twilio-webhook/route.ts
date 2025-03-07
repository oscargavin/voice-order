// src/app/api/twilio-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure the route is not cached

// Helper function to generate date response
function generateDateResponse(callerInfo = {}) {
  // Get current date information
  const now = new Date();
  
  // Get day of week and month names
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 
                    'August', 'September', 'October', 'November', 'December'][now.getMonth()];
  
  // Format today's readable date with ordinal suffix for the day
  const getDaySuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  const todayDate = now.getDate();
  const todaySuffix = getDaySuffix(todayDate);
  const todayFormatted = `${dayOfWeek}, ${monthName} ${todayDate}${todaySuffix}, ${now.getFullYear()}`;
  
  // Calculate tomorrow's date
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Format tomorrow's readable date
  const tomorrowDayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrow.getDay()];
  const tomorrowMonth = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 
                        'August', 'September', 'October', 'November', 'December'][tomorrow.getMonth()];
  const tomorrowDate = tomorrow.getDate();
  const tomorrowSuffix = getDaySuffix(tomorrowDate);
  const tomorrowFormatted = `${tomorrowDayOfWeek}, ${tomorrowMonth} ${tomorrowDate}${tomorrowSuffix}, ${tomorrow.getFullYear()}`;
  
  // For variable substitution (in ISO format)
  const todayISO = now.toISOString().split('T')[0];
  const tomorrowISO = tomorrow.toISOString().split('T')[0];
  
  // Create response with dynamic variables
  return {
    "dynamic_variables": {
      // Date information in various formats
      "today_iso": todayISO,
      "today_day": dayOfWeek,
      "today_date": `${monthName} ${todayDate}${todaySuffix}`,
      "today_full": todayFormatted,
      
      "tomorrow_iso": tomorrowISO,
      "tomorrow_day": tomorrowDayOfWeek,
      "tomorrow_date": `${tomorrowMonth} ${tomorrowDate}${tomorrowSuffix}`,
      "tomorrow_full": tomorrowFormatted,
      
      // Current year
      "current_year": now.getFullYear().toString(),
      
      // Any caller info passed in
      ...callerInfo
    },
    "conversation_config_override": {
      "agent": {
        "prompt": {
          "prompt": `Today is ${todayFormatted} and tomorrow is ${tomorrowFormatted}. When discussing dates with customers, always use these exact dates rather than placeholder variables. For example, if a customer asks for delivery "tomorrow", confirm with "So that's ${tomorrowFormatted}" rather than using variable placeholders.`
        }
      }
    }
  };
}

// Handle GET requests (no body parameters)
export async function GET(request: NextRequest) {
  try {
    console.log('GET webhook called for date information');
    
    // Generate response with date information
    const response = generateDateResponse();
    
    // Log the dynamic variables provided for debugging
    console.log('Providing dynamic variables:', Object.keys(response.dynamic_variables));
    
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
      console.log('POST webhook called with caller info:', callerInfo);
    } catch (e) {
      console.log('POST webhook called with no body or invalid JSON');
    }
    
    // Generate response with date information
    const response = generateDateResponse(callerInfo);
    
    // Log the dynamic variables provided for debugging
    console.log('Providing dynamic variables:', Object.keys(response.dynamic_variables));
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
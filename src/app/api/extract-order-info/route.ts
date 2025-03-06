// src/app/api/extract-order-info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the response type
export interface ExtractedOrderInfo {
  customer: string;
  deliveryDate: string;
  products: Array<{ name: string; quantity: number }>;
  currentStep: 'idle' | 'customer' | 'deliveryDate' | 'products' | 'confirmation';
  confirmed: boolean;
}

export async function POST(req: NextRequest) {
  try {
    
    // Parse the request body
    const body = await req.json();
    const { conversationHistory } = body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      console.log("[API-DIAG] Missing or invalid conversation history");
      return NextResponse.json(
        { error: 'Missing or invalid conversation history' },
        { status: 400 }
      );
    }

    // Format the conversation history for the API call
    const messages = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Add a system message with instructions on how to extract the information
    messages.unshift({
      role: "system",
      content: `
        You are an expert system designed to extract order information from a conversation between a customer and a food service agent.
        
        The conversation follows this flow:
        1. Customer provides their name or account code
        2. Customer specifies a delivery date
        3. Customer lists products they want to order
        4. The order is confirmed
        
        For each field, only extract what has been EXPLICITLY mentioned in the conversation.
        DO NOT make assumptions or invent information not present in the conversation.
        If a field doesn't have information yet, leave it as an empty string or appropriate default.
        
        Extract the following information and format it as a JSON object:
        - customer: The customer's name or account code from the conversation (string, empty if not mentioned)
        - deliveryDate: The delivery date as specified by the customer, formatted clearly (string, empty if not mentioned)
        - products: An array of objects with {name: string, quantity: number} for each product ordered (empty array if none mentioned)
        - currentStep: The current step in the order process based on what information has been collected:
          * "idle" - initial state or if no information has been collected yet
          * "customer" - if only customer information is available
          * "deliveryDate" - if customer and delivery date information are available
          * "products" - if customer, delivery date, and products information are available
          * "confirmation" - if all information is available or if the agent has said "Great, order received" or similar confirmation language
        - confirmed: Boolean indicating if the order has been explicitly confirmed (true if the agent has said "Great, order received" or similar confirmation language, otherwise false)
        
        IMPORTANT: Look for specific confirmation phrases like "Great, order received" or "send a confirmation" in the agent's messages to determine if the order is confirmed.
        
        For products, combine similar items and be precise about quantities.
        For example, "3 boxes of apples" and "2 more boxes of apples" should be merged as 5 boxes of apples.
        
        Here is an example of expected output:
        {
          "customer": "John Smith",
          "deliveryDate": "Wednesday, March 12th",
          "products": [
            {"name": "Apples", "quantity": 5},
            {"name": "Bananas", "quantity": 2}
          ],
          "currentStep": "products",
          "confirmed": false
        }
        
        Pay special attention to extracting the customer name, delivery date, and products accurately. 
        Always return complete structured data even if some fields are empty.
        Return ONLY the JSON object without any additional text or explanation.
      `
    });

    // Call the OpenAI API to extract information
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Using a more powerful model for better extraction
      response_format: { type: "json_object" },
      messages: messages as ChatCompletionMessageParam[],
      temperature: 0.2, // Lower temperature for more deterministic outputs
    });

    // Parse the response
    const content = completion.choices[0].message.content || '{}';
    
    try {
      const extractedInfo = JSON.parse(content);
      
      // Validate the structure of the extracted info
      if (typeof extractedInfo !== 'object') {
        throw new Error("Extracted info is not an object");
      }
      
      // Ensure the object has the expected structure with default values if missing
      const normalizedResponse = {
        customer: extractedInfo.customer || "",
        accountCode: extractedInfo.accountCode || "",
        deliveryDate: extractedInfo.deliveryDate || "",
        products: Array.isArray(extractedInfo.products) ? extractedInfo.products : [],
        currentStep: (() => {
          // Validate and normalize currentStep value
          const validSteps = ["idle", "customer", "deliveryDate", "products", "confirmation"];
          if (extractedInfo.currentStep && validSteps.includes(extractedInfo.currentStep)) {
            return extractedInfo.currentStep;
          }
          
          // Infer step based on filled fields
          if (extractedInfo.customer && extractedInfo.deliveryDate && 
              Array.isArray(extractedInfo.products) && extractedInfo.products.length > 0) {
            return "products";
          } else if (extractedInfo.customer && extractedInfo.deliveryDate) {
            return "deliveryDate";
          } else if (extractedInfo.customer) {
            return "customer";
          }
          return "idle";
        })(),
        confirmed: extractedInfo.confirmed === true
      };
      
      console.log("[API-DIAG] Returning normalized response:", JSON.stringify(normalizedResponse));
      
      // Return the extracted information
      return NextResponse.json(normalizedResponse, { status: 200 });
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Failed to parse extracted order information', details: (jsonError as Error).message, rawContent: content },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error extracting order information:', error);
    return NextResponse.json(
      { error: 'Failed to extract order information', details: (error as Error).message },
      { status: 500 }
    );
  }
}
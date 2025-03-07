// src/components/VoiceOrderSystem.tsx
/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import {
  MessageSquare,
  Phone,
  Info,
  Clock,
  ArrowRight,
  History,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define the conversation message type
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Define the conversation list item type
interface ConversationListItem {
  id: string;
  start_time: Date;
  duration_secs: number;
  title: string;
}

// Define the processed order type
interface ProcessedOrder {
  id: string;
  conversationId: string;
  customerName: string;
  deliveryDate: string;
  products: Array<{
    name: string;
    quantity: number;
    unit?: string;
  }>;
  processedAt: Date;
}

// Modal component for showing processing state and results
const ProcessingModal = ({
  isOpen,
  onClose,
  isProcessing,
  processingError,
  processedOrder,
}: {
  isOpen: boolean;
  onClose: () => void;
  isProcessing: boolean;
  processingError: string | null;
  processedOrder: ProcessedOrder | null;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            Order Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-700">
                Processing your order...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Analyzing conversation to extract order details.
              </p>
            </div>
          )}

          {processingError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-medium">Error processing order</p>
              <p className="text-sm mt-1">{processingError}</p>
            </div>
          )}

          {!isProcessing && !processingError && processedOrder && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                <p className="font-medium">Order successfully processed!</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Customer Name</p>
                    <p className="font-medium text-gray-800">
                      {processedOrder.customerName}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Delivery Date</p>
                    <p className="font-medium text-gray-800">
                      {processedOrder.deliveryDate}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Products</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 text-left">
                        <tr>
                          <th className="p-3 text-sm font-medium text-gray-700">
                            Product
                          </th>
                          <th className="p-3 text-sm font-medium text-gray-700">
                            Quantity
                          </th>
                          <th className="p-3 text-sm font-medium text-gray-700">
                            Unit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {processedOrder.products.map((product, idx) => (
                          <tr key={idx} className="bg-white">
                            <td className="p-3 text-sm text-gray-700">
                              {product.name}
                            </td>
                            <td className="p-3 text-sm text-gray-700">
                              {product.quantity}
                            </td>
                            <td className="p-3 text-sm text-gray-700">
                              {product.unit || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-6">
                <p className="text-xs text-gray-500">
                  Order ID: {processedOrder.id.substring(0, 8)}...
                </p>
                <p className="text-xs text-gray-500">
                  Processed at: {processedOrder.processedAt.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const VoiceOrderSystem = () => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<
    string | null
  >(null);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null
  );
  const [widgetError, setWidgetError] = useState<string | null>(null);

  // Modal and processing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [processedOrder, setProcessedOrder] = useState<ProcessedOrder | null>(
    null
  );
  const [processedOrders, setProcessedOrders] = useState<ProcessedOrder[]>([]);
  const [selectedProcessedOrder, setSelectedProcessedOrder] =
    useState<ProcessedOrder | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add error handling for widget initialization
  useEffect(() => {
    if (isScriptLoaded) {
      const handleError = (event: ErrorEvent) => {
        if (event.message.includes("ConversationalAI")) {
          console.error("ElevenLabs Widget Error:", event);
          setWidgetError(
            "Failed to initialize the voice assistant. Please check your connection and try again."
          );
        }
      };

      window.addEventListener("error", handleError);
      return () => window.removeEventListener("error", handleError);
    }
  }, [isScriptLoaded]);

  const fetchConversationDetails = async (conversationId: string) => {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        console.log(
          `Fetching conversation details (attempt ${retries + 1}/${maxRetries})`
        );

        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
          {
            headers: {
              "xi-api-key": process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "",
              "Cache-Control": "no-cache",
            },
            // Adding timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000),
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          console.error(`API error (${response.status}):`, errorText);

          if (response.status === 429) {
            // Rate limiting - wait and retry
            const waitTime = (retries + 1) * 1000;
            console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            retries++;
            continue;
          }

          throw new Error(
            `Failed to fetch conversation details: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        console.log("Conversation details:", data);

        if (data.transcript && Array.isArray(data.transcript)) {
          const conversationHistory = data.transcript.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.message,
            timestamp: new Date(
              (data.metadata?.start_time_unix_secs || 0) * 1000 +
                (msg.time_in_call_secs || 0) * 1000
            ),
          }));
          setMessages((prevMessages) => [
            ...prevMessages,
            ...conversationHistory,
          ]);
        } else {
          console.warn(
            "No transcript found in response or invalid format:",
            data
          );
        }

        // Success - exit retry loop
        return;
      } catch (error) {
        console.error("Error fetching conversation details:", error);
        retries++;

        if (retries >= maxRetries) {
          setWidgetError(
            `Failed to fetch conversation details after ${maxRetries} attempts. Please try again.`
          );
        } else {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, retries * 1000));
        }
      }
    }
  };

  // Function to handle new messages from the widget
  useEffect(() => {
    if (isScriptLoaded) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && typeof event.data === "object") {
          console.log("Received message:", event.data);

          if (event.data.type === "elevenlabs-conversation") {
            const newMessage: ConversationMessage = {
              role: event.data.source === "user" ? "user" : "assistant",
              content: event.data.message,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, newMessage]);
          } else if (event.data.type === "transcript") {
            const newMessage: ConversationMessage = {
              role: "user",
              content: event.data.text,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, newMessage]);
          } else if (event.data.type === "response") {
            const newMessage: ConversationMessage = {
              role: "assistant",
              content: event.data.text,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, newMessage]);
          } else if (event.data.type === "postcall") {
            console.log("Postcall data:", event.data);
            if (event.data.conversation_id) {
              // Handle postcall in a non-async way to avoid linter errors
              fetchConversationDetails(event.data.conversation_id)
                .then(() => {
                  // Refresh the conversations list after a new conversation
                  return fetchConversations();
                })
                .then(() => {
                  // Set this as the current conversation ID
                  setCurrentConversationId(event.data.conversation_id);
                })
                .catch((error) => {
                  console.error("Error handling postcall event:", error);
                  setWidgetError(
                    "Failed to process conversation after call ended. Please try refreshing the page."
                  );
                });
            } else {
              console.warn(
                "Postcall event received but no conversation ID was provided:",
                event.data
              );
            }
          }
        }
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [isScriptLoaded]);

  // Fetch list of conversations
  const fetchConversations = async () => {
    setIsLoadingConversations(true);
    setConversationsError(null);

    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        console.log(
          `Fetching conversations list (attempt ${retries + 1}/${maxRetries})`
        );

        // Adding query parameter for agent ID to restrict to our agent
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${
            process.env.ELEVENLABS_AGENT_ID || "O9eDVur3VAuMyoTOPKN7"
          }`,
          {
            headers: {
              "xi-api-key": process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "",
              "Cache-Control": "no-cache",
            },
            // Adding timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000),
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          console.error(`API error (${response.status}):`, errorText);

          if (response.status === 429) {
            // Rate limiting - wait and retry
            const waitTime = (retries + 1) * 1000;
            console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            retries++;
            continue;
          }

          throw new Error(
            `Failed to fetch conversations list: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        console.log("Conversations data:", data);

        // Transform data to match our interface
        if (data.conversations && Array.isArray(data.conversations)) {
          const conversationList: ConversationListItem[] =
            data.conversations.map((conv: any) => ({
              id: conv.conversation_id,
              start_time: new Date(conv.start_time_unix_secs * 1000),
              duration_secs: conv.duration_secs || 0,
              title:
                conv.title ||
                `Conversation ${new Date(
                  conv.start_time_unix_secs * 1000
                ).toLocaleDateString()}`,
            }));

          setConversations(conversationList);
        } else {
          console.warn(
            "No conversations found in response or invalid format:",
            data
          );
          setConversations([]);
        }

        // Success - exit retry loop
        setIsLoadingConversations(false);
        return;
      } catch (error) {
        console.error("Error fetching conversations:", error);
        retries++;

        if (retries >= maxRetries) {
          setConversationsError(
            `Failed to fetch conversation list after ${maxRetries} attempts. Please try again.`
          );
          setIsLoadingConversations(false);
        } else {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, retries * 1000));
        }
      }
    }

    // Make sure loading state is cleared if all retries fail
    setIsLoadingConversations(false);
  };

  // Load conversations when component mounts
  useEffect(() => {
    if (isScriptLoaded) {
      fetchConversations();
    }
  }, [isScriptLoaded]);

  // Load a specific conversation
  const loadConversation = async (conversationId: string) => {
    // Clear current messages
    setMessages([]);
    // Set loading state
    setLoadingConversationId(conversationId);
    // Set current conversation ID for order processing
    setCurrentConversationId(conversationId);
    // Fetch and load the selected conversation
    try {
      await fetchConversationDetails(conversationId);
    } finally {
      // Clear loading state
      setLoadingConversationId(null);
    }
  };

  // Process an order using OpenAI
  const processOrder = async (conversationId: string) => {
    // Reset state
    setIsModalOpen(true);
    setIsProcessing(true);
    setProcessingError(null);
    setProcessedOrder(null);
    setCurrentConversationId(conversationId);

    // Debug environment variables (don't log the actual key values)
    console.log("Environment variables check:", {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasNextPublicOpenAIKey: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      nextPublicOpenAIKeyLength:
        process.env.NEXT_PUBLIC_OPENAI_API_KEY?.length || 0,
    });

    try {
      // Ensure we have conversation messages to process
      if (messages.length === 0) {
        await fetchConversationDetails(conversationId);
      }

      // Check if we have enough messages to process
      if (messages.length === 0) {
        throw new Error(
          "No conversation data available to process this order."
        );
      }

      // Format conversation messages for OpenAI
      const formattedMessages = messages.map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      }));

      // Examples for few-shot learning
      const fewShotExamples = `
Here are a few examples of properly formatted order extractions:

Example 1:
Conversation: 
User: Hi, this is Brian Samuels. I'd like to place an order for delivery on the 15th of August.
Assistant: Hello Brian, I'd be happy to help with your order for August 15th. What would you like to order?
User: I need 5 kg of potatoes, 2 cartons of milk, and a dozen eggs.
Assistant: I've got 5 kg of potatoes, 2 cartons of milk, and a dozen eggs for delivery on August 15th. Anything else?
User: No, that's all for now.

Output:
{
  "customerName": "Brian Samuels",
  "deliveryDate": "15/08/2023",
  "products": [
    { "name": "Potatoes", "quantity": 5, "unit": "kg" },
    { "name": "Milk", "quantity": 2, "unit": "cartons" },
    { "name": "Eggs", "quantity": 12, "unit": "pieces" }
  ]
}

Example 2:
Conversation:
User: Hello, Sarah Johnson here. I want to place an order for next Monday, that's the 3rd of July.
Assistant: Hi Sarah, I'll help you with your order for Monday, July 3rd. What items would you like?
User: I'd like 3 loaves of sourdough bread, 500g of cheddar cheese, and 1 kg of apples.
Assistant: Got it. 3 sourdough loaves, 500g cheddar cheese, and 1 kg of apples for July 3rd. Is there anything else you need?
User: Yes, actually. Add 2 bottles of orange juice please.
Assistant: Added 2 bottles of orange juice. Your order now includes 3 sourdough loaves, 500g cheddar cheese, 1 kg of apples, and 2 bottles of orange juice for delivery on July 3rd.

Output:
{
  "customerName": "Sarah Johnson",
  "deliveryDate": "03/07/2023",
  "products": [
    { "name": "Sourdough Bread", "quantity": 3, "unit": "loaves" },
    { "name": "Cheddar Cheese", "quantity": 500, "unit": "g" },
    { "name": "Apples", "quantity": 1, "unit": "kg" },
    { "name": "Orange Juice", "quantity": 2, "unit": "bottles" }
  ]
}

Example 3:
Conversation:
User: Good morning, I'm calling from Abbotsfield Hotel & Spa. We need to place our weekly delivery for next Thursday, the 12th.
Assistant: Good morning! I'd be happy to help with your weekly delivery for Abbotsfield Hotel & Spa for Thursday, the 12th. What items do you need?
User: We need 10 kg of rice, 5 kg of chicken breasts, 3 cases of bottled water, and 20 avocados.
Assistant: I have 10 kg of rice, 5 kg of chicken breasts, 3 cases of bottled water, and 20 avocados. Is there anything else for your delivery?
User: Yes, please add 2 kg of coffee beans as well.
Assistant: Added 2 kg of coffee beans. Your order for Abbotsfield Hotel & Spa now includes 10 kg of rice, 5 kg of chicken breasts, 3 cases of bottled water, 20 avocados, and 2 kg of coffee beans for delivery on Thursday the 12th.

Output:
{
  "customerName": "Abbotsfield Hotel & Spa",
  "deliveryDate": "12/07/2023",
  "products": [
    { "name": "Rice", "quantity": 10, "unit": "kg" },
    { "name": "Chicken Breasts", "quantity": 5, "unit": "kg" },
    { "name": "Bottled Water", "quantity": 3, "unit": "cases" },
    { "name": "Avocados", "quantity": 20, "unit": "pieces" },
    { "name": "Coffee Beans", "quantity": 2, "unit": "kg" }
  ]
}
`;

      // Call OpenAI API
      const apiKey =
        process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error(
          "OpenAI API key is not configured. Please check your environment variables."
        );
      }

      console.log("Using API key prefix:", apiKey.substring(0, 10) + "...");

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an order processing assistant. Your task is to extract order details from a conversation between a customer and an assistant. 
              Extract the following information:
              1. Customer name
              2. Delivery date (format as DD/MM/YYYY)
              3. Product list with quantities and units
              
              Format your response as a JSON object with the following structure:
              {
                "customerName": "Customer Name",
                "deliveryDate": "DD/MM/YYYY",
                "products": [
                  { "name": "Product Name", "quantity": number, "unit": "unit" }
                ]
              }
              
              If any information is missing, make your best guess based on context. If you cannot determine a value, use null.
              Respond ONLY with the JSON object, nothing else.
              
              ${fewShotExamples}`,
              },
              {
                role: "user",
                content: `Extract order details from the following conversation:\n\n${formattedMessages
                  .map(
                    (m) =>
                      `${m.role === "user" ? "User" : "Assistant"}: ${
                        m.content
                      }`
                  )
                  .join("\n")}`,
              },
            ],
            temperature: 0.2,
            max_tokens: 800,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("OpenAI API error response:", errorData);

        if (response.status === 401) {
          throw new Error(
            `Authentication error: The OpenAI API key is invalid or missing (status ${response.status})`
          );
        } else if (response.status === 429) {
          throw new Error(
            `Rate limit error: Too many requests to the OpenAI API (status ${response.status})`
          );
        } else {
          throw new Error(
            `API error: ${response.status} - ${
              errorData?.error?.message || "Unknown error"
            }`
          );
        }
      }

      const result = await response.json();

      // Validate response structure
      if (
        !result.choices ||
        !result.choices[0] ||
        !result.choices[0].message ||
        !result.choices[0].message.content
      ) {
        throw new Error("Invalid response format from OpenAI API");
      }

      try {
        const responseContent = result.choices[0].message.content.trim();

        // Try to extract JSON content if there are additional characters
        let jsonContent = responseContent;

        // Check if the content starts with a code block marker
        if (responseContent.includes("```json")) {
          // Extract content between ```json and ``` markers
          const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonContent = jsonMatch[1].trim();
          }
        } else if (responseContent.includes("```")) {
          // Extract content between ``` and ``` markers (generic code block)
          const jsonMatch = responseContent.match(/```\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonContent = jsonMatch[1].trim();
          }
        }

        console.log("Extracted JSON content:", jsonContent);
        const orderData = JSON.parse(jsonContent);

        // Create a new processed order
        const newOrder: ProcessedOrder = {
          id: crypto.randomUUID(),
          conversationId,
          customerName: orderData.customerName || "Unknown Customer",
          deliveryDate: orderData.deliveryDate || "Unknown Date",
          products: orderData.products || [],
          processedAt: new Date(),
        };

        // Update state with the new processed order
        setProcessedOrder(newOrder);
        setProcessedOrders((prev) => [newOrder, ...prev]);
      } catch (parseError) {
        console.error(
          "Error parsing OpenAI response:",
          parseError,
          "Response content:",
          result.choices[0].message.content
        );
        throw new Error(
          "Failed to parse the order data from the response. The format may be incorrect."
        );
      }
    } catch (error) {
      console.error("Error processing order:", error);
      setProcessingError(
        error instanceof Error ? error.message : "Failed to process order"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 via-white to-white">
      <Script
        src="https://elevenlabs.io/convai-widget/index.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("ElevenLabs widget script loaded successfully");
          setIsScriptLoaded(true);
          setWidgetError(null);
          // Force a refresh of conversations after script is loaded
          setTimeout(() => {
            fetchConversations();
          }, 1000);
        }}
        onError={(e) => {
          console.error("Failed to load ElevenLabs widget script:", e);
          setWidgetError(
            "Failed to load the voice assistant. Please refresh the page or check your connection."
          );
        }}
      />

      {/* Show error message if widget fails to load */}
      {widgetError && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium">{widgetError}</p>
              <p className="text-sm mt-1">
                Try these solutions:
                <button
                  onClick={() => window.location.reload()}
                  className="underline ml-1 hover:text-red-800"
                >
                  Refresh page
                </button>
                {" | "}
                <button
                  onClick={() => {
                    setWidgetError(null);
                    fetchConversations();
                  }}
                  className="underline hover:text-red-800"
                >
                  Retry fetching conversations
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="w-full py-4 px-4 bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl">
          {/* Mobile layout */}
          <div className="md:hidden flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Open Info
              </h1>
              <a
                href="tel:+443331880332"
                className="flex items-center text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-full"
              >
                <Phone className="w-4 h-4 mr-1.5" />
                <span className="font-medium">Call Us</span>
              </a>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600 font-medium">
                Voice Order Assistant
              </p>
              <a
                href="tel:+443331880332"
                className="text-sm text-blue-600 font-semibold"
              >
                +44 333 188 0332
              </a>
            </div>
          </div>

          {/* Desktop layout - unchanged */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Open Info
                </h1>
                <p className="text-sm text-gray-600 font-medium">
                  Voice Order Assistant
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Phone className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-700">
                Need help? Call us at
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="tel:+443331880332"
                      className="font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      +44 333 188 0332
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Tap to call on mobile devices. Our support team is
                      available 24/7.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Bento Grid Layout */}
      <main className="flex-grow container mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
          {/* Chat History */}
          <div className="md:col-span-8 bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Conversation Transcripts
                  </h3>
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={() =>
                      currentConversationId &&
                      processOrder(currentConversationId)
                    }
                    className="flex items-center px-3 py-1.5 text-sm bg-green-100 text-green-800 hover:bg-green-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Process Order
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 h-[450px] overflow-y-auto space-y-4 bg-gradient-to-b from-white to-gray-50 flex-grow">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white ml-12 shadow-blue-100"
                        : "bg-white border border-gray-200 mr-12 text-gray-800"
                    } shadow-lg`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                    <span
                      className={`text-xs mt-2 block ${
                        message.role === "user"
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="w-16 h-16 text-blue-100 mx-auto mb-4" />
                  <p className="text-base text-gray-500 font-medium">
                    Your conversation will appear here
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Start speaking to begin your order
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Previous Conversations and Processed Orders */}
          <div className="md:col-span-4 md:row-span-2 grid grid-cols-1 gap-6">
            {/* Previous Conversations */}
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg flex flex-col">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <History className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Previous Conversations
                    </h3>
                  </div>
                  <button
                    onClick={() => fetchConversations()}
                    className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full transition-colors"
                    disabled={isLoadingConversations}
                    aria-label="Refresh conversations"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`${
                        isLoadingConversations ? "animate-spin" : ""
                      }`}
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4 h-[220px] overflow-y-auto bg-gradient-to-b from-white to-gray-50 flex-grow">
                {isLoadingConversations ? (
                  <div className="text-center p-6 bg-white/80 rounded-xl border border-gray-100 shadow-sm">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent"></div>
                    <p className="mt-3 text-gray-600 font-medium">
                      Loading conversations...
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      This may take a moment
                    </p>
                  </div>
                ) : conversationsError ? (
                  <div className="text-center py-6 bg-red-50/80 rounded-xl border border-red-100 shadow-sm">
                    <svg
                      className="w-12 h-12 text-red-300 mx-auto mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-base text-red-700 font-medium">
                      {conversationsError}
                    </p>
                    <button
                      onClick={() => fetchConversations()}
                      className="mt-3 px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-blue-100 mx-auto mb-4" />
                    <p className="text-base text-gray-500 font-medium">
                      No previous conversations found
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Start a new conversation to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`bg-white hover:bg-blue-50 transition-colors duration-200 border border-gray-100 rounded-xl p-3 cursor-pointer shadow-sm ${
                          loadingConversationId === conversation.id
                            ? "border-blue-300 bg-blue-50"
                            : ""
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <h4
                            onClick={() => loadConversation(conversation.id)}
                            className="font-medium text-gray-800 truncate max-w-[60%] hover:underline"
                          >
                            {conversation.title}
                          </h4>
                          <div className="flex items-center space-x-1">
                            {loadingConversationId === conversation.id ? (
                              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-r-transparent"></div>
                            ) : (
                              <>
                                <button
                                  onClick={() => processOrder(conversation.id)}
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50 p-1.5 rounded transition-colors cursor-pointer"
                                  title="Process Order"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    loadConversation(conversation.id)
                                  }
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                  title="View Conversation"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                          <span className="truncate mr-1">
                            {conversation.start_time.toLocaleDateString()} at{" "}
                            {conversation.start_time.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="mx-1 flex-shrink-0">•</span>
                          <span className="flex-shrink-0">
                            {Math.floor(conversation.duration_secs / 60)}m{" "}
                            {conversation.duration_secs % 60}s
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Processed Orders */}
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg flex flex-col">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Processed Orders
                    </h3>
                  </div>
                </div>
              </div>
              <div className="p-4 h-[220px] overflow-y-auto bg-gradient-to-b from-white to-gray-50 flex-grow">
                {processedOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-green-100 mx-auto mb-4" />
                    <p className="text-base text-gray-500 font-medium">
                      No processed orders yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Process a conversation to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {processedOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => {
                          setProcessedOrder(order);
                          setIsModalOpen(true);
                        }}
                        className="bg-white hover:bg-green-50 transition-colors duration-200 border border-gray-100 rounded-xl p-3 cursor-pointer shadow-sm"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-800 truncate max-w-[80%]">
                            {order.customerName}
                          </h4>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                            Order
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          <span className="flex items-center">
                            <svg
                              className="w-3 h-3 mr-1 text-gray-400"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="3"
                                y="4"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                              ></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            Delivery: {order.deliveryDate}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {order.products.length}{" "}
                          {order.products.length === 1 ? "product" : "products"}{" "}
                          • {order.processedAt.toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="md:col-span-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100 shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <Info className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Quick Tips
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center bg-white/80 rounded-xl p-3 shadow-sm border border-blue-100/50">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-4 flex-shrink-0"></span>
                <p className="text-gray-700 text-sm">
                  Start by saying your name or account number
                </p>
              </div>
              <div className="flex items-center bg-white/80 rounded-xl p-3 shadow-sm border border-blue-100/50">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-4 flex-shrink-0"></span>
                <p className="text-gray-700 text-sm">
                  Specify your desired delivery date
                </p>
              </div>
              <div className="flex items-center bg-white/80 rounded-xl p-3 shadow-sm border border-blue-100/50">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-4 flex-shrink-0"></span>
                <p className="text-gray-700 text-sm">
                  List the products and quantities you need
                </p>
              </div>
            </div>
          </div>

          {/* Order Stats - Bento Box Element */}
          <div className="md:col-span-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100 shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <svg
                className="w-5 h-5 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">
                Order Stats
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/80 rounded-xl p-3 shadow-sm border border-green-100/50 text-center">
                <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                <p className="text-2xl font-bold text-gray-800">
                  {processedOrders.length}
                </p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 shadow-sm border border-green-100/50 text-center">
                <p className="text-xs text-gray-500 mb-1">
                  Total Conversations
                </p>
                <p className="text-2xl font-bold text-gray-800">
                  {conversations.length}
                </p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 shadow-sm border border-green-100/50 text-center">
                <p className="text-xs text-gray-500 mb-1">Latest Order</p>
                <p className="text-sm font-medium text-gray-800">
                  {processedOrders.length > 0
                    ? new Date(
                        processedOrders[0].processedAt
                      ).toLocaleDateString()
                    : "No orders yet"}
                </p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 shadow-sm border border-green-100/50 text-center">
                <p className="text-xs text-gray-500 mb-1">
                  Avg. Products/Order
                </p>
                <p className="text-sm font-medium text-gray-800">
                  {processedOrders.length > 0
                    ? (
                        processedOrders.reduce(
                          (sum, order) => sum + order.products.length,
                          0
                        ) / processedOrders.length
                      ).toFixed(1)
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 bg-gradient-to-t from-gray-50 to-white border-t border-gray-100 mt-auto">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center text-sm text-gray-600">
            © 2025 OpenInfo Foodservice. All rights reserved.
          </div>
          <div className="text-center text-xs text-gray-400 mt-1">
            Powered by ElevenLabs Conversational AI
          </div>
        </div>
      </footer>

      {/* Voice assistant widget */}
      <div
        className="elevenlabs-widget-container"
        dangerouslySetInnerHTML={{
          __html: `<elevenlabs-convai 
            agent-id="${
              process.env.ELEVENLABS_AGENT_ID || "O9eDVur3VAuMyoTOPKN7"
            }"
          ></elevenlabs-convai>`,
        }}
      />

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isProcessing={isProcessing}
        processingError={processingError}
        processedOrder={processedOrder}
      />
    </div>
  );
};

export default VoiceOrderSystem;

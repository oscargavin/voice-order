"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MediaRecorderButton } from "./MediaRecorderButton";

// Order state interface
interface OrderState {
  customer: string;
  accountCode: string;
  deliveryDate: string;
  products: Array<{ name: string; quantity: number }>;
  currentStep:
    | "idle"
    | "customer"
    | "deliveryDate"
    | "products"
    | "confirmation";
  confirmed: boolean;
}

const VoiceOrderSystem = () => {
  // State for the WebRTC connection and data channel
  const [connection, setConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assistantResponse, setAssistantResponse] = useState("");
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

  // Order state
  const [order, setOrder] = useState<OrderState>({
    customer: "",
    accountCode: "",
    deliveryDate: "",
    products: [],
    currentStep: "idle",
    confirmed: false,
  });

  // Reference to store messages for debugging
  const messagesRef = useRef<
    Array<{ type: string; content: Record<string, unknown> }>
  >([]);

  // Initialize WebRTC connection
  const initializeConnection = async () => {
    // Check if required browser APIs are available
    if (
      typeof window === "undefined" ||
      !window.RTCPeerConnection ||
      !window.MediaRecorder
    ) {
      console.error("Required browser APIs are not available");
      return;
    }

    if (isConnecting) return;
    setIsConnecting(true);

    try {
      // Create a new peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Set up data channel for sending/receiving JSON messages
      const channel = pc.createDataChannel("events");
      channel.onmessage = handleChannelMessage;
      channel.onopen = () => {
        console.log("Data channel is open");
        // Initialize the session once the channel is open
        initializeSession(channel);
      };

      // Set up audio element for playing model responses
      const audioEl = new Audio();
      audioEl.autoplay = true;
      setAudioElement(audioEl);

      // Handle incoming audio stream from the model
      pc.ontrack = (event) => {
        console.log("Received remote track", event);
        if (audioEl) {
          audioEl.srcObject = event.streams[0];
        }
      };

      // Create offer and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send the offer to your server, which will forward it to OpenAI
      // This is a simplified example - you would need a server endpoint to handle this
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer: pc.localDescription }),
      });

      const { answer } = await response.json();

      // Set the remote description with the answer from OpenAI
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Store the connection and data channel
      setConnection(pc);
      setDataChannel(channel);
      setIsConnecting(false);

      // Update order state to the first step
      setOrder((prev) => ({ ...prev, currentStep: "customer" }));
    } catch (error) {
      console.error("Error initializing connection:", error);
      setIsConnecting(false);
    }
  };

  // Initialize the session with OpenAI Realtime API
  const initializeSession = (channel: RTCDataChannel) => {
    const systemPrompt = `
      You are a helpful order-taking assistant for OpenInfo Foodservice. 
      Follow this pattern for taking orders:
      
      1. First, ask for the customer name or account code with: "Hi, you've reached orders at OpenInfo Foodservice, where are you calling from today?"
      2. Once you have the customer information, ask for the delivery date with: "When would you like this delivered for?"
      3. Confirm the date in a clear format, like "So that's Wednesday 12th March".
      4. Ask for products they want to order with: "And what would you like?"
      5. After they list products, summarize the order and confirm with: "Great, order received - we'll let you know once this is confirmed by the team and send a confirmation to this number and the email address we have on record. Have a nice day!"
      
      Keep responses concise and professional. Extract customer name, account code (if provided), delivery date, and product information throughout the conversation.
    `;

    const event = {
      type: "session.update",
      session: {
        instructions: systemPrompt,
        voice: "nova",
      },
    };

    channel.send(JSON.stringify(event));

    // Add a slight delay before sending first message to start the conversation
    setTimeout(() => {
      const startEvent = {
        type: "response.create",
      };
      channel.send(JSON.stringify(startEvent));
    }, 1000);
  };

  // Handle messages from the data channel
  const handleChannelMessage = (event: MessageEvent) => {
    try {
      const serverEvent = JSON.parse(event.data);

      // Store message for debugging
      messagesRef.current.push({ type: "received", content: serverEvent });

      // Handle different event types
      switch (serverEvent.type) {
        case "session.created":
          console.log("Session created:", serverEvent.session.id);
          break;

        case "response.created":
          console.log("Response started");
          break;

        case "response.text.delta":
          // Append text delta to the transcript
          setAssistantResponse((prev) => prev + serverEvent.delta.text);
          break;

        case "response.done":
          console.log("Response complete");
          // Extract information from the response to update order state
          updateOrderFromResponse(serverEvent.response.output[0]?.text || "");
          break;

        case "input_audio_buffer.speech_started":
          console.log("User started speaking");
          setIsListening(true);
          break;

        case "input_audio_buffer.speech_stopped":
          console.log("User stopped speaking");
          setIsListening(false);
          break;

        default:
          // Other event types can be handled as needed
          break;
      }
    } catch (error) {
      console.error("Error handling channel message:", error);
    }
  };

  // Update order state based on assistant's response
  const updateOrderFromResponse = (text: string) => {
    // This is a simplified implementation - a more robust version would use
    // function calling or more advanced parsing techniques

    const newOrder = { ...order };

    // Try to extract customer information
    if (order.currentStep === "customer" && order.customer === "") {
      // Simple extraction looking for common patterns
      const customerMatch = text.match(/calling from ([\w\s&]+)/i);
      if (customerMatch && customerMatch[1]) {
        newOrder.customer = customerMatch[1].trim();
        newOrder.currentStep = "deliveryDate";
      }
    }

    // Try to extract delivery date
    else if (
      order.currentStep === "deliveryDate" &&
      order.deliveryDate === ""
    ) {
      // Look for date confirmation patterns
      const dateMatch = text.match(/that's ([\w\s\d]+)(\.|\?)/i);
      if (dateMatch && dateMatch[1]) {
        newOrder.deliveryDate = dateMatch[1].trim();
        newOrder.currentStep = "products";
      }
    }

    // Check for order confirmation
    else if (text.includes("order received") || text.includes("confirmation")) {
      newOrder.currentStep = "confirmation";
      newOrder.confirmed = true;
    }

    // Update the order state
    setOrder(newOrder);
  };

  // Send user speech as text
  const sendUserMessage = (text: string) => {
    if (dataChannel && dataChannel.readyState === "open") {
      setTranscript(text);

      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: text,
            },
          ],
        },
      };

      dataChannel.send(JSON.stringify(event));

      const responseEvent = {
        type: "response.create",
      };

      dataChannel.send(JSON.stringify(responseEvent));
    }
  };

  // Effect to initialize connection when component mounts
  useEffect(() => {
    return () => {
      // Clean up resources when component unmounts
      if (connection) {
        connection.close();
      }
      if (audioElement) {
        audioElement.srcObject = null;
      }
    };
  }, [connection, audioElement]);

  // Determine step indicators
  const steps = [
    { id: "customer", label: "Customer" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "products", label: "Products" },
    { id: "confirmation", label: "Confirmation" },
  ];

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card className="w-full shadow-lg border-gray-200">
        <CardHeader className="border-b pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">
              Voice Order Entry
            </CardTitle>

            {!connection ? (
              <Button
                onClick={initializeConnection}
                disabled={isConnecting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Start Order"
                )}
              </Button>
            ) : (
              <MediaRecorderButton
                onRecordingChange={(recording) => {
                  setIsListening(recording);
                  if (!recording) {
                    // When recording stops, clear the transcript
                    setTranscript("");
                  }
                }}
              />
            )}
          </div>
          <CardDescription>
            Follow the prompts to complete your food service order
          </CardDescription>
        </CardHeader>

        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 
                    ${
                      order.currentStep === step.id
                        ? "bg-blue-600 text-white"
                        : order.currentStep === "idle" ||
                          steps.findIndex((s) => s.id === order.currentStep) <
                            index
                        ? "bg-gray-200 text-gray-500 dark:bg-gray-700"
                        : "bg-green-500 text-white"
                    }`}
                >
                  {steps.findIndex((s) => s.id === order.currentStep) > index
                    ? "✓"
                    : index + 1}
                </div>
                <span className="text-xs">{step.label}</span>
                {index < steps.length - 1 && (
                  <div className="absolute h-0.5 w-16 bg-gray-200 dark:bg-gray-700 mt-4 ml-12"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-900 min-h-40 max-h-60 overflow-y-auto">
              {assistantResponse ? (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Assistant
                  </p>
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg text-gray-800 dark:text-gray-200">
                    {assistantResponse}
                  </div>
                </div>
              ) : connection ? (
                <div className="flex items-center justify-center h-32">
                  {isListening ? (
                    <div className="flex flex-col items-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      <span className="text-sm text-blue-500">
                        Listening...
                      </span>
                    </div>
                  ) : (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  Click &quot;Start Order&quot; to begin
                </div>
              )}

              {transcript && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500 mb-1">You</p>
                  <div className="bg-gray-200 dark:bg-gray-800 p-3 rounded-lg text-gray-800 dark:text-gray-200">
                    {transcript}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Customer</p>
                <div className="p-3 min-h-10 border rounded-md bg-white dark:bg-gray-950">
                  {order.customer || "-"}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">
                  Delivery Date
                </p>
                <div className="p-3 min-h-10 border rounded-md bg-white dark:bg-gray-950">
                  {order.deliveryDate || "-"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Products</p>
              <div className="p-3 min-h-20 border rounded-md bg-white dark:bg-gray-950">
                {order.products.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {order.products.map((product, index) => (
                      <li key={index}>
                        {product.quantity} × {product.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "-"
                )}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t pt-4 pb-4 flex justify-between">
          {order.confirmed ? (
            <Badge className="px-3 py-1 bg-green-500 text-white">
              Order Confirmed
            </Badge>
          ) : (
            <span className="text-sm text-gray-500">
              {connection
                ? "Speak clearly into your microphone"
                : "Start the order process to begin"}
            </span>
          )}

          {connection && (
            <Button
              onClick={() =>
                sendUserMessage("I need to finish this order now.")
              }
              variant="outline"
              disabled={order.confirmed}
            >
              <Send className="mr-2 h-4 w-4" />
              Finish Order
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default VoiceOrderSystem;

// src/components/VoiceOrderSystem.tsx
/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send,
  Loader2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Check,
  ChevronDown,
  FileText,
  Bug,
  Settings,
} from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIVoiceInput } from "@/components/ui/ai-voice-input";
import { useConversation } from "@11labs/react";

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

// Add voice model type and options
type VoiceModel = {
  id: string;
  name: string;
  description?: string;
};

const voiceModels: VoiceModel[] = [
  { id: "alloy", name: "Alloy" },
  { id: "ash", name: "Ash" },
  { id: "ballad", name: "Ballad" },
  { id: "coral", name: "Coral" },
  { id: "sage", name: "Sage" },
  { id: "verse", name: "Verse" },
];

// Define types for ElevenLabs messages
interface ElevenLabsMessage {
  message: string;
  source: "ai" | "user";
}

// Define types for conversation status
type ConversationStatus = "disconnected" | "connected" | "connecting";

interface ConversationHook {
  startSession: (options: { url: string }) => Promise<string>;
  endSession: () => Promise<void>;
  setVolume: ({ volume }: { volume: number }) => void;
  getInputByteFrequencyData: () => Uint8Array | undefined;
  status: ConversationStatus;
  isSpeaking: boolean;
}

const VoiceOrderSystem = () => {
  // State for the conversation
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assistantResponse, setAssistantResponse] = useState("");
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isProcessingConversation, setIsProcessingConversation] =
    useState(false);

  // Initialize ElevenLabs conversation
  const conversation = useConversation({
    apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
    onMessage: (message: { message: string; source: "ai" | "user" }) => {
      const { message: text, source } = message;
      if (source === "user") {
        setCurrentUserTranscript(text);
        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: text },
        ]);
        conversationHistoryRef.current = [
          ...conversationHistoryRef.current,
          { role: "user", content: text },
        ];
      } else {
        setCurrentAssistantResponse(text);
        setIsAssistantSpeaking(true);
        setConversationHistory((prev) => [
          ...prev,
          { role: "assistant", content: text },
        ]);
        conversationHistoryRef.current = [
          ...conversationHistoryRef.current,
          { role: "assistant", content: text },
        ];
        extractOrderInfo();
      }
    },
    onError: (error: string) => {
      console.error("Conversation error:", error);
    },
    onConnect: () => {
      console.log("Connected to ElevenLabs");
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs");
      setIsAssistantSpeaking(false);
    },
  }) as ConversationHook;

  // Order state
  const [order, setOrder] = useState<OrderState>({
    customer: "",
    accountCode: "",
    deliveryDate: "",
    products: [],
    currentStep: "idle",
    confirmed: false,
  });

  // Reference to store conversation history
  const conversationHistoryRef = useRef<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);

  // Add state for real-time display
  const [currentUserTranscript, setCurrentUserTranscript] = useState("");
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState("");
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);

  // Update displayedConversation to include real-time updates
  const displayedConversation = useMemo(() => {
    const messages = [...conversationHistory];

    if (currentUserTranscript) {
      messages.push({ role: "user", content: currentUserTranscript });
    }
    if (currentAssistantResponse) {
      messages.push({ role: "assistant", content: currentAssistantResponse });
    }

    return messages;
  }, [conversationHistory, currentUserTranscript, currentAssistantResponse]);

  // Add state for auto-listening
  const [autoListen, setAutoListen] = useState(true);

  // Effect to handle auto-listening
  useEffect(() => {
    if (
      autoListen &&
      !conversation.isSpeaking &&
      conversation.status === "disconnected"
    ) {
      const timer = setTimeout(async () => {
        try {
          // Get the signed URL from your backend
          const response = await fetch("/api/elevenlabs/get-signed-url");
          const { url } = await response.json();

          // Start the session with the signed URL
          await conversation.startSession({ url });
        } catch (error) {
          console.error("Failed to start session:", error);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [autoListen, conversation.isSpeaking, conversation.status]);

  // Throttled function to extract order information
  const extractOrderInfo = async () => {
    setIsProcessingConversation(true);

    try {
      const conversationCopy = JSON.parse(
        JSON.stringify(conversationHistoryRef.current)
      );

      const response = await fetch("/api/extract-order-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationHistory: conversationCopy,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error extracting order info: ${response.status}`);
      }

      const extractedInfo = await response.json();

      if (!extractedInfo || typeof extractedInfo !== "object") {
        throw new Error("Invalid response format from extraction API");
      }

      const newOrderState = {
        customer: extractedInfo.customer || "",
        accountCode: extractedInfo.accountCode || "",
        deliveryDate: extractedInfo.deliveryDate || "",
        products: Array.isArray(extractedInfo.products)
          ? extractedInfo.products
          : [],
        currentStep: extractedInfo.currentStep || "idle",
        confirmed: extractedInfo.confirmed === true,
      };

      setOrder(newOrderState);
    } catch (error) {
      console.error("Failed to extract order information:", error);
    } finally {
      setIsProcessingConversation(false);
    }
  };

  // Toggle microphone
  const toggleMicrophone = async () => {
    try {
      if (conversation.status === "connected") {
        await conversation.endSession();
      } else {
        // Get the signed URL from your backend
        const response = await fetch("/api/elevenlabs/get-signed-url");
        const { url } = await response.json();

        // Start the session with the signed URL
        await conversation.startSession({ url });
      }
    } catch (error) {
      console.error("Failed to toggle microphone:", error);
    }
  };

  // Toggle speaker mute
  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
  };

  // Test function to manually set order values - for debugging
  const testOrderUpdate = () => {
    const testData = {
      customer: "Test Customer",
      deliveryDate: "Next Monday",
      products: [{ name: "Test Product", quantity: 5 }],
      currentStep: "products",
      confirmed: false,
    };

    setOrder((prev) => ({
      ...prev,
      customer: testData.customer,
      deliveryDate: testData.deliveryDate,
      products: testData.products,
      currentStep: testData.currentStep as OrderState["currentStep"],
      confirmed: testData.confirmed,
    }));
  };

  // Function to check if conversation is complete
  const checkConversationCompletion = (message: string) => {
    const completionPhrases = [
      "Great, order received",
      "confirmation to this number",
      "Have a nice day",
      "send a confirmation",
    ];

    const isCompletionMessage = completionPhrases.some((phrase) =>
      message.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isCompletionMessage) {
      setOrder((prev) => {
        if (!prev.confirmed) {
          return {
            ...prev,
            currentStep: "confirmation",
            confirmed: true,
          };
        }
        return prev;
      });

      return true;
    }

    return false;
  };

  return (
    <div className="container mx-auto max-w-2xl">
      <Card className="w-full shadow-xl border-2 border-gray-200/20 dark:border-gray-700/20 overflow-hidden rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <div className="w-full rounded-t-xl pt-0 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900">
          <CardHeader className="border-b-0 pb-6 pt-6 text-white relative">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Voice Order Entry
              </CardTitle>
            </div>
            <CardDescription className="text-gray-300 mt-2">
              Follow the prompts to complete your food service order
            </CardDescription>
          </CardHeader>
        </div>

        <CardContent className="pt-6 px-8 bg-white dark:bg-gray-900">
          <div className="space-y-6">
            {conversation.status === "disconnected" ? (
              <div className="flex justify-center py-8">
                <Button
                  onClick={toggleMicrophone}
                  disabled={conversation.status !== "disconnected"}
                  size="lg"
                  className="bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white shadow-lg transform transition-all duration-200 hover:scale-105"
                >
                  {conversation.status !== "disconnected" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4" />
                      Start Voice Order
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                {/* Audio Controls with Auto-Listen Toggle */}
                <div className="flex items-center justify-between p-3 bg-secondary/70 border-2 border-border rounded-base mb-4 shadow-md">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="default"
                      size="icon"
                      onClick={toggleMute}
                      className={isMuted ? "opacity-50" : ""}
                    >
                      {isMuted ? <VolumeX /> : <Volume2 />}
                    </Button>
                    <div className="w-32">
                      <Slider
                        value={[volume * 100]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(vals) => {
                          const newVolume = vals[0] / 100;
                          setVolume(newVolume);
                          conversation.setVolume({ volume: newVolume });
                        }}
                        disabled={isMuted}
                        className={isMuted ? "opacity-50" : ""}
                      />
                    </div>
                    <Button
                      variant={autoListen ? "default" : "neutral"}
                      size="sm"
                      onClick={() => setAutoListen(!autoListen)}
                      className="ml-2"
                    >
                      {autoListen ? "Auto-Listen On" : "Auto-Listen Off"}
                    </Button>
                  </div>

                  {conversation.isSpeaking && (
                    <Badge variant="default" className="animate-pulse">
                      Assistant speaking...
                    </Badge>
                  )}
                </div>

                {/* Conversation Area */}
                <div className="space-y-4">
                  {/* Voice Input Status */}
                  <div className="flex justify-center">
                    <Button
                      variant={
                        conversation.status === "connected"
                          ? "default"
                          : "neutral"
                      }
                      size="lg"
                      onClick={toggleMicrophone}
                      className={`relative ${
                        conversation.status === "connected"
                          ? "bg-red-500 hover:bg-red-600"
                          : ""
                      }`}
                    >
                      {conversation.status === "connected" ? (
                        <>
                          <MicOff className="mr-2 h-4 w-4" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="mr-2 h-4 w-4" />
                          Start Recording
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Conversation Display */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/80 dark:to-gray-800 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 h-[400px] overflow-y-auto mb-4 shadow-consistent relative z-10">
                    <div className="space-y-4">
                      {displayedConversation.map((message, i) => {
                        const isUser = message.role === "user";
                        return (
                          <div
                            key={i}
                            className={`flex items-start ${
                              isUser ? "" : "flex-row-reverse"
                            } group animate-slideRight`}
                          >
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full ${
                                isUser
                                  ? "bg-blue-100 dark:bg-blue-900"
                                  : "bg-green-100 dark:bg-green-900"
                              } flex items-center justify-center ${
                                isUser ? "mr-2" : "ml-2"
                              } shadow-sm`}
                            >
                              <span
                                className={`text-xs font-medium ${
                                  isUser
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-green-700 dark:text-green-300"
                                }`}
                              >
                                {isUser ? "You" : "AI"}
                              </span>
                            </div>
                            <div
                              className={`${
                                isUser
                                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200/50 dark:border-blue-700/30"
                                  : "bg-green-50 dark:bg-green-900/30 border-green-200/50 dark:border-green-700/30"
                              } p-3 rounded-xl border max-w-[80%] shadow-sm transform transition-all duration-200 hover:translate-y-[-2px] hover:shadow-md relative z-10`}
                            >
                              <p
                                className={`${
                                  isUser
                                    ? "text-blue-800 dark:text-blue-100"
                                    : "text-green-800 dark:text-green-100"
                                } ${
                                  (isUser &&
                                    i === displayedConversation.length - 1 &&
                                    conversation.status === "connected") ||
                                  (!isUser &&
                                    i === displayedConversation.length - 1 &&
                                    conversation.isSpeaking)
                                    ? "animate-pulse"
                                    : ""
                                }`}
                              >
                                {message.content}
                                {((isUser &&
                                  i === displayedConversation.length - 1 &&
                                  conversation.status === "connected") ||
                                  (!isUser &&
                                    i === displayedConversation.length - 1 &&
                                    conversation.isSpeaking)) && (
                                  <span className="inline-block w-1 h-4 ml-1 bg-current animate-blink" />
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Order Details Section */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="order-details" className="border-0">
                    <AccordionTrigger className="py-3 px-4 bg-gray-700 border border-gray-200 dark:border-gray-700/50 rounded-xl hover:no-underline hover:shadow-sm transition-all duration-200 relative z-20">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          Order Details
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                              Customer
                            </h3>
                            <div className="p-3 bg-white/70 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 min-h-12 shadow-sm">
                              {order.customer || "-"}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                              Delivery Date
                            </h3>
                            <div className="p-3 bg-white/70 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 min-h-12 shadow-sm">
                              {order.deliveryDate || "-"}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Products
                          </h3>
                          <div className="p-3 bg-white/70 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 min-h-36 shadow-sm">
                            {order.products.length > 0 ? (
                              <ul className="space-y-2">
                                {order.products.map((product, index) => (
                                  <li
                                    key={index}
                                    className="flex justify-between items-center"
                                  >
                                    <span>{product.name}</span>
                                    <Badge
                                      variant="default"
                                      className="bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                                    >
                                      {product.quantity}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              "-"
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Debug Info Accordion - Only visible in development mode */}
                  {process.env.NODE_ENV === "development" && (
                    <AccordionItem value="debug-info" className="border-0 mt-4">
                      <AccordionTrigger className="py-3 px-4 bg-gray-700 border border-gray-200 dark:border-gray-700/50 rounded-xl hover:no-underline hover:shadow-sm transition-all duration-200 relative z-20">
                        <div className="flex items-center">
                          <Bug className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Debug Info
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="p-3 bg-white/70 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 text-xs font-mono shadow-sm">
                          <div className="font-bold mb-1 text-gray-700 dark:text-gray-300">
                            Debug Info:
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Customer: "{order.customer}"
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Delivery Date: "{order.deliveryDate}"
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Products: {JSON.stringify(order.products)}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Current Step: {order.currentStep}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Confirmed: {order.confirmed ? "Yes" : "No"}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Status: {conversation.status}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Is Recording:{" "}
                            {conversation.status === "connected" ? "Yes" : "No"}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            Is Speaking:{" "}
                            {conversation.isSpeaking ? "Yes" : "No"}
                          </div>

                          {/* Debug button for testing order updates */}
                          <Button
                            onClick={testOrderUpdate}
                            variant="default"
                            size="sm"
                            className="mt-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                          >
                            Test Update Order
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceOrderSystem;

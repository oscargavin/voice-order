// src/components/VoiceOrderSystem.tsx
/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { MessageSquare, Phone, Info } from "lucide-react";

// Define the conversation message type
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const VoiceOrderSystem = () => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [widgetError, setWidgetError] = useState<string | null>(null);
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
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        {
          headers: {
            "xi-api-key": process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch conversation details");
      }

      const data = await response.json();

      if (data.transcript) {
        const conversationHistory = data.transcript.map((msg: any) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.message,
          timestamp: new Date(
            data.metadata.start_time_unix_secs * 1000 +
              msg.time_in_call_secs * 1000
          ),
        }));
        setMessages((prevMessages) => [
          ...prevMessages,
          ...conversationHistory,
        ]);
      }
    } catch (error) {
      console.error("Error fetching conversation details:", error);
      setWidgetError("Failed to fetch conversation details. Please try again.");
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
              fetchConversationDetails(event.data.conversation_id);
            }
          }
        }
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [isScriptLoaded]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 via-white to-white">
      <Script
        src="https://elevenlabs.io/convai-widget/index.js"
        strategy="afterInteractive"
        onLoad={() => {
          setIsScriptLoaded(true);
          setWidgetError(null);
        }}
        onError={() => {
          setWidgetError(
            "Failed to load the voice assistant. Please refresh the page."
          );
        }}
      />

      {/* Show error message if widget fails to load */}
      {widgetError && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
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
            {widgetError}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="w-full py-6 px-4 bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl flex items-center justify-between">
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
            <span className="font-bold text-blue-600">0800 1111</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto max-w-5xl px-4 py-12">
        <div className="space-y-8">
          {/* Chat History */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Conversation History
                </h3>
              </div>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto space-y-6 bg-gradient-to-b from-white to-gray-50">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-5 ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white ml-12 shadow-blue-100"
                        : "bg-white border border-gray-200 mr-12"
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

          {/* Quick Tips */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100 shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <Info className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Quick Tips
              </h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center bg-white/80 rounded-xl p-4 shadow-sm border border-blue-100/50">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-4"></span>
                <p className="text-gray-700">
                  Start by saying your name or account number
                </p>
              </div>
              <div className="flex items-center bg-white/80 rounded-xl p-4 shadow-sm border border-blue-100/50">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-4"></span>
                <p className="text-gray-700">
                  Specify your desired delivery date
                </p>
              </div>
              <div className="flex items-center bg-white/80 rounded-xl p-4 shadow-sm border border-blue-100/50">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-4"></span>
                <p className="text-gray-700">
                  List the products and quantities you need
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 bg-gradient-to-t from-gray-50 to-white border-t border-gray-100">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center text-sm text-gray-600">
            © 2024 OpenInfo Foodservice. All rights reserved.
          </div>
          <div className="text-center text-xs text-gray-400 mt-2">
            Powered by ElevenLabs Conversational AI
          </div>
        </div>
      </footer>
      <div
        dangerouslySetInnerHTML={{
          __html: `<elevenlabs-convai 
            agent-id="O9eDVur3VAuMyoTOPKN7"
            data-loading="eager"
            data-timeout="10000"
          ></elevenlabs-convai>`,
        }}
      />
    </div>
  );
};

export default VoiceOrderSystem;

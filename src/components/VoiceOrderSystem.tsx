// src/components/VoiceOrderSystem.tsx
/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, Volume2, VolumeX, Mic, MicOff } from "lucide-react";
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
  const [audioTracks, setAudioTracks] = useState<MediaStreamTrack[]>([]);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [ephemeralKey, setEphemeralKey] = useState<string | null>(null);

  // Refs for audio element and remote stream
  const audioRef = useRef<HTMLAudioElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

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
      // Initialize connection with ICE servers
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Set up data channel for sending/receiving JSON messages
      const channel = pc.createDataChannel("oai-events");
      channel.onmessage = handleChannelMessage;
      channel.onopen = () => {
        console.log("Data channel is open and ready");
      };

      // Set up audio track handling for remote (assistant) audio
      pc.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);

        if (event.track.kind === "audio") {
          // Store the remote stream for audio output
          remoteStreamRef.current = event.streams[0];

          // Connect the stream to the audio element
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
            console.log("Remote audio connected to audio element");
          }
        }
      };

      // Request access to the microphone and add the audio track to the peer connection
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const tracks = mediaStream.getAudioTracks();
      setAudioTracks(tracks);

      tracks.forEach((track) => {
        console.log(
          "Adding audio track to peer connection:",
          track.label,
          track.enabled,
          track.readyState
        );
        pc.addTrack(track, mediaStream);
      });

      // Create offer and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Ensure that the local description is set before proceeding
      await new Promise<void>((resolve) => {
        if (pc.localDescription) {
          resolve();
        } else {
          pc.addEventListener("icecandidate", () => {
            if (pc.localDescription) resolve();
          });
        }
      });

      // Send the offer to your server, which will forward it to OpenAI
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer: pc.localDescription }),
      });

      const data = await response.json();

      if (!data.answer || !data.answer.sdp) {
        throw new Error("Invalid response from server: missing SDP answer");
      }

      console.log("Received answer:", data);

      // Store ephemeral key for later use
      if (data.ephemeralKey) {
        setEphemeralKey(data.ephemeralKey);
      }

      // Set the remote description with the answer from OpenAI
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

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

  // Handle messages from the data channel
  const handleChannelMessage = (event: MessageEvent) => {
    try {
      const serverEvent = JSON.parse(event.data);
      console.log("Received event from server:", serverEvent);

      // Store message for debugging
      messagesRef.current.push({ type: "received", content: serverEvent });

      // Handle different event types
      switch (serverEvent.type) {
        case "session.created":
          console.log("Session created:", serverEvent.session.id);
          break;

        case "response.created":
          console.log("Response started");
          setAssistantResponse("");
          setIsAssistantSpeaking(true);
          break;

        // Handle audio transcript from the realtime API
        case "response.audio_transcript.delta":
          // Append text delta to the transcript
          setAssistantResponse((prev) => prev + (serverEvent.delta || ""));
          break;

        case "response.text.delta":
          // Some versions might use this event type
          setAssistantResponse(
            (prev) => prev + (serverEvent.delta?.text || "")
          );
          break;

        case "response.audio.delta":
          // This event contains audio chunks, but we're using WebRTC for audio playback
          // No need to handle this directly as the audio will flow through the peer connection
          break;

        case "response.done":
          console.log("Response complete");
          setIsAssistantSpeaking(false);
          // Extract information from the response to update order state
          updateOrderFromResponse(assistantResponse);
          break;

        case "input_audio_buffer.speech_started":
          console.log("User started speaking");
          setIsListening(true);
          break;

        case "input_audio_buffer.speech_stopped":
          console.log("User stopped speaking");
          setIsListening(false);
          break;

        // Handle user speech transcript from conversation items
        case "conversation.item.created":
          if (
            serverEvent.item?.role === "user" &&
            serverEvent.item?.content?.[0]?.type === "text"
          ) {
            setTranscript(serverEvent.item.content[0].text);
          }
          break;

        case "error":
          console.error("Error from OpenAI:", serverEvent);
          break;

        default:
          // Other event types can be handled as needed
          break;
      }
    } catch (error) {
      console.error("Error handling channel message:", error);
    }
  };

  // Function to start the conversation once connected
  const startConversation = () => {
    if (dataChannel && dataChannel.readyState === "open") {
      // Set the system instructions
      const systemPrompt = `
      You are a helpful order-taking assistant for OpenInfo Foodservice. 
      Follow this pattern for taking orders:
    
      1. First, ask for the customer name or account code with: &quot;Hi, you've reached orders at OpenInfo Foodservice, where are you calling from today?&quot;
      2. Once you have the customer information, ask for the delivery date with: &quot;When would you like this delivered for?&quot;
      3. Confirm the date in a clear format, like &quot;So that's Wednesday 12th March&quot;.
      4. Ask for products they want to order with: &quot;And what would you like?&quot;
      5. After they list products, summarize the order and confirm with: &quot;Great, order received - we'll let you know once this is confirmed by the team and send a confirmation to this number and the email address we have on record. Have a nice day!&quot;
      
      Keep responses concise and professional. Extract customer name, account code (if provided), delivery date, and product information throughout the conversation.
    `;

      // Update the session with our system instructions and voice settings
      const sessionUpdateEvent = {
        type: "session.update",
        session: {
          instructions: systemPrompt,
          // Enable both text and audio modalities
          modalities: ["text", "audio"],
          // Specify voice settings
          voice: "alloy", // You can use: alloy, echo, fable, onyx, nova, shimmer
        },
      };

      console.log("Sending session update:", sessionUpdateEvent);
      dataChannel.send(JSON.stringify(sessionUpdateEvent));

      // Wait a moment for the session update to take effect
      setTimeout(() => {
        // Create an initial response to start the conversation
        const responseCreateEvent = {
          type: "response.create",
          response: {
            // Ensure both text and audio in the response
            modalities: ["text", "audio"],
          },
        };

        console.log("Sending response create:", responseCreateEvent);
        dataChannel.send(JSON.stringify(responseCreateEvent));
      }, 1000);
    }
  };

  // Effect to initialize the conversation once data channel is set
  useEffect(() => {
    if (dataChannel && dataChannel.readyState === "open") {
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataChannel]);

  // Effect to update audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Toggle microphone
  const toggleMicrophone = () => {
    const newState = !isListening;
    setIsListening(newState);

    // Enable/disable the audio tracks
    audioTracks.forEach((track) => {
      track.enabled = newState;
    });

    if (!newState) {
      // When turning off the microphone, clear the transcript
      setTranscript("");
    }
  };

  // Toggle speaker mute
  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);

    // Update the audio element volume
    if (audioRef.current) {
      audioRef.current.volume = newMuteState ? 0 : volume;
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

    // Check for product mentions
    else if (order.currentStep === "products") {
      // Very simple product extraction - a real implementation would be more robust
      const productMatches = text.match(
        /(\d+)\s+(box(?:es)?|of)\s+([\w\s]+)/gi
      );
      if (productMatches) {
        const extractedProducts = productMatches
          .map((match) => {
            const parts = match.match(/(\d+)\s+(box(?:es)?|of)\s+([\w\s]+)/i);
            if (parts && parts.length >= 4) {
              return {
                quantity: parseInt(parts[1], 10),
                name: parts[3].trim(),
              };
            }
            return null;
          })
          .filter(Boolean) as Array<{ name: string; quantity: number }>;

        if (extractedProducts.length > 0) {
          newOrder.products = [...newOrder.products, ...extractedProducts];
        }
      }
    }

    // Check for order confirmation
    if (text.includes("order received") || text.includes("confirmation")) {
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

      console.log("Sending user message:", event);
      dataChannel.send(JSON.stringify(event));

      const responseEvent = {
        type: "response.create",
        response: {
          modalities: ["text", "audio"],
        },
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

      // Disable audio tracks
      audioTracks.forEach((track) => {
        track.enabled = false;
      });
    };
  }, [connection, audioTracks]);

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
              <div className="flex space-x-2">
                <Button
                  onClick={toggleMicrophone}
                  variant={isListening ? "destructive" : "default"}
                  className={
                    isListening
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-600 hover:bg-green-700"
                  }
                >
                  {isListening ? (
                    <>
                      <MicOff className="mr-2 h-4 w-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4" />
                      Speak
                    </>
                  )}
                </Button>
              </div>
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
            {/* Hidden audio element for playing GPT-4o's voice response */}
            <audio ref={audioRef} autoPlay playsInline className="hidden" />

            {/* Audio Controls */}
            {connection && (
              <div className="flex items-center space-x-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className={isMuted ? "text-gray-400" : "text-blue-600"}
                >
                  {isMuted ? <VolumeX /> : <Volume2 />}
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[volume * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(values) => setVolume(values[0] / 100)}
                    disabled={isMuted}
                  />
                </div>
                {isAssistantSpeaking && (
                  <div className="flex items-center">
                    <span className="text-sm text-blue-600 animate-pulse">
                      Speaking...
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-900 min-h-40 max-h-60 overflow-y-auto">
              <div className="flex flex-col space-y-4">
                {/* Conversation Transcript Section */}
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conversation Transcript:
                </div>

                {/* Always display this section when a connection exists */}
                {connection ? (
                  <div className="flex flex-col space-y-3">
                    {assistantResponse && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">
                          Assistant:
                        </div>
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-gray-800 dark:text-gray-200">
                          {assistantResponse}
                        </div>
                      </div>
                    )}

                    {transcript && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">You:</div>
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg text-gray-800 dark:text-gray-200">
                          {transcript}
                        </div>
                      </div>
                    )}

                    {isListening && (
                      <div className="flex items-center text-blue-500">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm">Listening...</span>
                      </div>
                    )}

                    {!assistantResponse && !transcript && !isListening && (
                      <div className="text-gray-500 italic text-sm">
                        When you speak or the assistant responds, the transcript
                        will appear here.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 text-gray-500">
                    Click "Start Order" to begin the conversation
                  </div>
                )}
              </div>
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

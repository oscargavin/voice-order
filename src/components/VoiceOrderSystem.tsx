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
  const [isProcessingConversation, setIsProcessingConversation] =
    useState(false);

  // Refs for audio element and remote stream
  const audioRef = useRef<HTMLAudioElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const debouncedExtractRef = useRef<NodeJS.Timeout | undefined>(undefined);

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

  // For displaying conversation in the UI, we'll create a derived value
  const displayedConversation = useMemo(() => {
    return conversationHistoryRef.current
      .map(
        (msg) => `${msg.role === "user" ? "You" : "Assistant"}: ${msg.content}`
      )
      .join("\n");
  }, [conversationHistoryRef.current.length]);

  // Add state for selected voice
  const [selectedVoice, setSelectedVoice] = useState<string>("ballad");

  // Throttled function to extract order information
  const extractOrderInfo = async () => {
    setIsProcessingConversation(true);

    try {
      // Make a deep copy of the conversation history to avoid any reference issues
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

      // Check if we got valid data back
      if (!extractedInfo || typeof extractedInfo !== "object") {
        throw new Error("Invalid response format from extraction API");
      }

      // Log current state before update
      console.log(JSON.stringify(order));

      // Update order state with extracted information
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

      // Add a timeout to check if state was actually updated
      setTimeout(() => {}, 1000);
    } catch (error) {
      console.error("Failed to extract order information:", error);
    } finally {
      setIsProcessingConversation(false);
    }
  };

  // Debounce function for extracting order info
  useEffect(() => {
    // Clear any existing timeout
    if (debouncedExtractRef.current) {
      clearTimeout(debouncedExtractRef.current);
    }

    debouncedExtractRef.current = setTimeout(() => {
      if (conversationHistoryRef.current.length >= 2) {
        console.log("Debounce timer expired, triggering order info extraction");
        extractOrderInfo();
      }
    }, 3000); // Increased to 3 seconds to allow for more complete responses and processing

    return () => {
      if (debouncedExtractRef.current) {
        clearTimeout(debouncedExtractRef.current);
      }
    };
  }, [transcript, assistantResponse]); // Trigger on both transcript and assistantResponse changes

  // Log order state changes
  useEffect(() => {
    console.log(
      "[ORDER-DIAG] Form values will be: Customer:",
      order.customer,
      "| Delivery Date:",
      order.deliveryDate,
      "| Products:",
      JSON.stringify(order.products),
      "| Current Step:",
      order.currentStep
    );
  }, [order]);

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

      // Send the offer to your server with the selected voice model
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer: pc.localDescription,
          voiceId: selectedVoice,
        }),
      });

      const data = await response.json();

      if (!data.answer || !data.answer.sdp) {
        throw new Error("Invalid response from server: missing SDP answer");
      }

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

      // If we've set the system prompt in the API, we don't need to set it again
      // but we still need to trigger the assistant to start speaking
      // We'll wait a moment for the connection to stabilize
      if (data.systemPrompt && channel.readyState === "open") {
        setTimeout(() => {
          // Just create a response request to get the assistant to start speaking
          const responseCreateEvent = {
            type: "response.create",
            response: {
              modalities: ["text", "audio"],
            },
          };
          channel.send(JSON.stringify(responseCreateEvent));
        }, 2000);
      }
    } catch (error) {
      console.error("Error initializing connection:", error);
      setIsConnecting(false);
    }
  };

  // Handle messages from the data channel
  const handleChannelMessage = (event: MessageEvent) => {
    try {
      const serverEvent = JSON.parse(event.data);

      // Handle different event types
      switch (serverEvent.type) {
        case "session.created":
          break;

        case "response.created":
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
          setIsAssistantSpeaking(false);

          // Store assistant response in conversation history
          if (assistantResponse) {
            conversationHistoryRef.current.push({
              role: "assistant",
              content: assistantResponse,
            });

            // Check for order completion
            checkConversationCompletion(assistantResponse);

            // Cancel any pending debounced extraction
            clearTimeout(debouncedExtractRef.current);
            // Short delay to ensure UI is updated
            setTimeout(() => {
              extractOrderInfo();
            }, 500);
          }
          break;

        case "input_audio_buffer.speech_started":
          setIsListening(true);
          break;

        case "input_audio_buffer.speech_stopped":
          setIsListening(false);
          break;

        // Handle user speech transcript from conversation items
        case "conversation.item.created":
          if (
            serverEvent.item?.role === "user" &&
            serverEvent.item?.content?.[0]?.type === "text"
          ) {
            const userText = serverEvent.item.content[0].text;
            setTranscript(userText);

            // Store user message in conversation history
            conversationHistoryRef.current.push({
              role: "user",
              content: userText,
            });

            // Cancel any pending debounced extraction
            if (debouncedExtractRef.current) {
              clearTimeout(debouncedExtractRef.current);
            }
            // Short delay to ensure conversation history is updated
            setTimeout(() => {
              extractOrderInfo();
            }, 500);
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
      // Set the system instructions to follow the exact waterfall approach
      const systemPrompt = `
      You are an order-taking assistant for OpenInfo Foodservice. 
      Follow this EXACT waterfall approach for taking orders:
    
      1. Start by asking for customer name or account code with EXACTLY:
         "Hi, you've reached orders at OpenInfo Foodservice, where are you calling from today?"
      
      2. Once you have the customer name/account code, ask about delivery date with EXACTLY:
         "When would you like this delivered for?"
      
      3. Confirm the date in format like:
         "So that's Wednesday 12th March"
      
      4. Ask for products with EXACTLY:
         "And what would you like?"
      
      5. After they list products, end with EXACTLY:
         "Great, order received - we'll let you know once this is confirmed by the team and send a confirmation to this number and the email address we have on record. Have a nice day!"
      
      IMPORTANT: You must begin the conversation immediately with the exact greeting without waiting for the user to speak first.
      Do not deviate from this script or allow the conversation to go off-track.
      Extract customer name, account code (if provided), delivery date, and product information carefully.
      Keep responses concise and professional.
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

      dataChannel.send(JSON.stringify(sessionUpdateEvent));

      // Wait a moment for the session update to take effect
      setTimeout(() => {
        // Create an initial message to explicitly start the conversation
        const initialMessageEvent = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "start order process",
              },
            ],
          },
        };

        dataChannel.send(JSON.stringify(initialMessageEvent));

        // Then create a response to get the assistant to speak
        setTimeout(() => {
          const responseCreateEvent = {
            type: "response.create",
            response: {
              // Ensure both text and audio in the response
              modalities: ["text", "audio"],
            },
          };

          dataChannel.send(JSON.stringify(responseCreateEvent));
        }, 500);
      }, 1000);
    }
  };

  // Effect to initialize the conversation once data channel is set
  useEffect(() => {
    if (dataChannel && dataChannel.readyState === "open") {
      startConversation();

      // Add event listener for data channel state changes
      dataChannel.onopen = () => {
        startConversation();
      };
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

      // Store user message in conversation history
      conversationHistoryRef.current.push({
        role: "user",
        content: text,
      });

      // Trigger a response from the assistant
      const responseEvent = {
        type: "response.create",
        response: {
          modalities: ["text", "audio"],
        },
      };

      dataChannel.send(JSON.stringify(responseEvent));

      // Cancel any pending debounced extraction
      if (debouncedExtractRef.current) {
        clearTimeout(debouncedExtractRef.current);
      }
      // Short delay to ensure conversation history is updated
      setTimeout(() => {
        extractOrderInfo();
      }, 500);
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
      // Set the order as completed
      setOrder((prev) => {
        // Only update if not already confirmed
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
              {!connection && (
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="w-[180px] bg-white/10 border-gray-700 text-white">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {voiceModels.map((voice) => (
                      <SelectItem
                        key={voice.id}
                        value={voice.id}
                        className="flex flex-col items-start"
                      >
                        <span className="font-medium">{voice.name}</span>
                        {voice.description && (
                          <span className="text-xs text-gray-500">
                            {voice.description}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <CardDescription className="text-gray-300 mt-2">
              Follow the prompts to complete your food service order
            </CardDescription>
          </CardHeader>
        </div>
        <div className="px-8 py-6 bg-card">
          <div className="flex justify-between relative">
            {/* Background connector line */}
            <div
              className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full"
              style={{ width: "90%", margin: "0 auto" }}
            />

            {/* Progress connector line */}
            {order.currentStep !== "idle" && (
              <div
                className="absolute top-5 left-0 h-1 bg-gray-600 dark:bg-gray-500 rounded-full pointer-events-none"
                style={{
                  width: `${
                    order.confirmed
                      ? 90
                      : (steps.findIndex((s) => s.id === order.currentStep) /
                          (steps.length - 1)) *
                        90
                  }%`,
                  margin: "0 auto 0 5%",
                  transition: "width 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
                }}
              />
            )}

            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-md step-transition ${
                    order.currentStep === step.id
                      ? "bg-gray-700 text-white scale-110 animate-scaleIn"
                      : order.currentStep === "idle"
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-800"
                      : steps.findIndex((s) => s.id === order.currentStep) <=
                        index
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-800"
                      : "bg-gray-600 text-white animate-fadeIn"
                  }`}
                >
                  {steps.findIndex((s) => s.id === order.currentStep) > index ||
                  (order.currentStep === "confirmation" &&
                    step.id === "confirmation" &&
                    order.confirmed) ? (
                    <Check className="h-5 w-5 animate-scaleIn" />
                  ) : (
                    <span className="font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-sm font-medium step-transition ${
                    order.currentStep === step.id
                      ? "text-gray-700 dark:text-gray-300"
                      : steps.findIndex((s) => s.id === order.currentStep) >
                        index
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <CardContent className="pt-6 px-8 bg-white dark:bg-gray-900">
          <div className="space-y-6">
            {/* Hidden audio element for playing GPT-4o's voice response */}
            <audio ref={audioRef} autoPlay playsInline className="hidden" />

            {/* Audio Controls */}
            {connection && (
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
                      onValueChange={(vals) => setVolume(vals[0] / 100)}
                      disabled={isMuted}
                      className={isMuted ? "opacity-50" : ""}
                    />
                  </div>
                </div>

                {isAssistantSpeaking && (
                  <Badge variant="default" className="animate-pulse">
                    Assistant speaking...
                  </Badge>
                )}
              </div>
            )}

            {/* Start Voice Order - Present before conversation */}
            {!connection && (
              <div className="w-full flex flex-col items-center justify-center py-10 mb-6">
                <div className="mb-3 text-center max-w-md mx-auto">
                  <div className="relative w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl flex items-center justify-center mx-auto mb-8 shadow-consistent overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2)_0%,rgba(0,0,0,0)_70%)] opacity-80 pointer-events-none"></div>
                    <Mic className="w-10 h-10 text-gray-700 dark:text-gray-300 relative z-10" />
                  </div>
                  <h3 className="text-2xl font-medium mb-3 text-foreground">
                    Start your voice order
                  </h3>
                  <p className="text-foreground/80 mb-8 leading-relaxed max-w-sm mx-auto">
                    Click the button below to begin. You'll be guided through
                    placing your order using voice recognition.
                  </p>
                  <Button
                    onClick={initializeConnection}
                    disabled={isConnecting}
                    className="px-8 py-6 h-auto text-lg shadow-consistent transition-all duration-200 cursor-pointer rounded-xl hover:translate-y-[-2px] relative z-20"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Start Voice Order"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Conversation Transcript with Waveform */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">
                Conversation:
              </h3>
              <div className="mb-4">
                {connection && (
                  <div className="mb-4 rounded-base overflow-hidden">
                    <div
                      className={`p-4 ${
                        isListening
                          ? "bg-main text-mtext border-2 border-border"
                          : "bg-bw text-text border-2 border-border"
                      } rounded-base shadow-shadow transition-all duration-200`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Button
                            onClick={toggleMicrophone}
                            variant={isListening ? "neutral" : "default"}
                            size="sm"
                            className={
                              isListening
                                ? "mr-3 transition-all duration-200 cursor-pointer"
                                : "mr-3 transition-all duration-200 cursor-pointer"
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
                          <span className="text-sm font-medium">You</span>
                        </div>
                        <Badge
                          variant="default"
                          className={isListening ? "animate-pulse" : ""}
                        >
                          {isListening ? "Listening..." : "Click Speak"}
                        </Badge>
                      </div>
                      {isListening && (
                        <div className="flex items-center justify-center h-6 overflow-hidden mt-2">
                          <div className="flex space-x-1">
                            {[...Array(12)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 h-1 bg-border rounded-full"
                                style={{
                                  animation: `pulseUpDown 1s ease-in-out infinite`,
                                  animationDelay: `${i * 0.1}s`,
                                  transform: "translateY(0)",
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-base overflow-hidden mt-3">
                  <div
                    className={`p-4 ${
                      isAssistantSpeaking
                        ? "bg-main text-mtext border-2 border-border"
                        : "bg-bw text-text border-2 border-border"
                    } rounded-base shadow-shadow transition-all duration-200`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Assistant</span>
                      {isAssistantSpeaking && (
                        <Badge variant="default" className="animate-pulse">
                          Speaking...
                        </Badge>
                      )}
                    </div>
                    {isAssistantSpeaking && (
                      <div className="flex items-center justify-center h-6 overflow-hidden mt-2">
                        <div className="flex space-x-1">
                          {[...Array(12)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1 h-1 bg-border rounded-full"
                              style={{
                                animation: `pulseUpDown 1s ease-in-out infinite`,
                                animationDelay: `${i * 0.1}s`,
                                transform: "translateY(0)",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/80 dark:to-gray-800 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 h-60 overflow-y-auto mb-4 shadow-consistent relative z-10">
                {displayedConversation ? (
                  <div className="space-y-4">
                    {displayedConversation
                      .split("\n")
                      .filter((line) => line.trim() !== "")
                      .map((line, i) => {
                        if (line.startsWith("You: ")) {
                          return (
                            <div
                              key={i}
                              className="flex items-start animate-slideRight"
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center mr-2 shadow-sm">
                                <span className="text-xs font-medium">You</span>
                              </div>
                              <div className="bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 max-w-[80%] shadow-sm transform transition-all duration-200 hover:translate-y-[-2px] hover:shadow-md relative z-10">
                                {line.replace("You: ", "")}
                              </div>
                            </div>
                          );
                        } else if (line.startsWith("Assistant: ")) {
                          return (
                            <div
                              key={i}
                              className="flex items-start flex-row-reverse animate-slideRight"
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center ml-2 shadow-sm">
                                <span className="text-xs font-medium">AI</span>
                              </div>
                              <div className="bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 max-w-[80%] shadow-sm transform transition-all duration-200 hover:translate-y-[-2px] hover:shadow-md relative z-10">
                                {line.replace("Assistant: ", "")}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-foreground">
                    <p className="text-center border border-gray-200 dark:border-gray-700 p-4 rounded-xl bg-white/50 dark:bg-gray-700/30 shadow-sm transform transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md">
                      {connection
                        ? "Conversation will appear here..."
                        : 'Click "Start Voice Order" to begin the conversation'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Details Section in Accordion */}
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
          </div>
        </CardContent>
        <CardFooter className="pt-4 pb-6 px-8 flex flex-col bg-white dark:bg-gray-900">
          {order.confirmed ? (
            <div className="w-full bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center animate-fadeIn shadow-consistent relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,rgba(0,0,0,0)_70%)] opacity-50 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-4">
                  <Check className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Order Confirmed!
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-sm mx-auto">
                  Your order has been successfully placed and a confirmation
                  will be sent to you.
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white border-0 px-6 py-3 shadow-consistent hover:translate-y-[-2px] transition-all duration-200"
                >
                  Place Another Order
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-white text-sm bg-gray-700 border border-gray-200 dark:border-gray-700/50 rounded-md py-3 px-5 shadow-sm">
              {order.currentStep === "idle" ? (
                "Start the order process to begin"
              ) : (
                <>
                  {order.currentStep === "customer" &&
                    "Please provide customer name and account details"}
                  {order.currentStep === "deliveryDate" &&
                    "Please specify the delivery date"}
                  {order.currentStep === "products" &&
                    "Please add products to your order"}
                  {order.currentStep === "confirmation" &&
                    "Please confirm your order to complete the process"}
                </>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default VoiceOrderSystem;

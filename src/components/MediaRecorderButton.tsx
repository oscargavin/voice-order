"use client";

import React, { useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// Client-side only recorder component
const ClientMediaRecorder = ({
  onRecordingChange,
}: {
  onRecordingChange: (isRecording: boolean) => void;
}) => {
  // Import the hook directly here - this component only runs on client
  const { useReactMediaRecorder } = require("react-media-recorder");

  const { status, startRecording, stopRecording, mediaBlobUrl } =
    useReactMediaRecorder({
      audio: true,
      blobPropertyBag: { type: "audio/webm" },
      onStop: (blobUrl: any, blob: { size: any }) => {
        console.log("Recording stopped, blob URL:", blobUrl);
        console.log("Blob size:", blob?.size);
      },
    });
  const handleClick = () => {
    if (status === "recording") {
      console.log("Stopping recording");
      stopRecording();
      onRecordingChange(false);
    } else {
      console.log("Starting recording");
      startRecording();
      onRecordingChange(true);
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant={status === "recording" ? "destructive" : "default"}
      className={
        status === "recording"
          ? "bg-red-500 hover:bg-red-600"
          : "bg-green-600 hover:bg-green-700"
      }
    >
      {status === "recording" ? (
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
  );
};

interface MediaRecorderProps {
  onRecordingChange: (isRecording: boolean) => void;
}

export const MediaRecorderButton: React.FC<MediaRecorderProps> = ({
  onRecordingChange,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Return a placeholder button while on server or before mounting
    return (
      <Button disabled className="bg-green-600 hover:bg-green-700">
        <Mic className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  // Only render the actual recorder component on the client after mounting
  return <ClientMediaRecorder onRecordingChange={onRecordingChange} />;
};

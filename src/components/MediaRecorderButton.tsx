"use client";

import React from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaRecorderProps {
  onRecordingChange: (isRecording: boolean) => void;
}

export const MediaRecorderButton: React.FC<MediaRecorderProps> = ({
  onRecordingChange,
}) => {
  const { status, startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    blobPropertyBag: { type: "audio/webm" },
  });

  return (
    <Button
      onClick={() => {
        if (status === "recording") {
          stopRecording();
          onRecordingChange(false);
        } else {
          startRecording();
          onRecordingChange(true);
        }
      }}
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

// src/components/AudioDebugHelper.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

interface AudioDebugHelperProps {
  audioElement: HTMLAudioElement | null;
}

const AudioDebugHelper: React.FC<AudioDebugHelperProps> = ({
  audioElement,
}) => {
  const [debugInfo, setDebugInfo] = useState<string>("");

  // Function to force audio playback
  const forcePlayAudio = () => {
    if (audioElement) {
      // Unmute and set volume to max
      audioElement.muted = false;
      audioElement.volume = 1.0;

      // Try to play the audio
      audioElement
        .play()
        .then(() => {
          setDebugInfo("Audio playback started successfully");
        })
        .catch((error) => {
          setDebugInfo(`Audio playback failed: ${error.message}`);
        });
    } else {
      setDebugInfo("Audio element not available");
    }
  };

  // Function to test audio using a test tone
  const playTestTone = () => {
    try {
      // Create an audio context
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      setDebugInfo("AudioContext created");

      // Create an oscillator for a test tone
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // 440 Hz - A4 note

      // Create a gain node to control volume
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Start and stop the tone after 1 second
      oscillator.start();
      setDebugInfo("Test tone playing...");

      setTimeout(() => {
        oscillator.stop();
        setDebugInfo("Test tone completed");
      }, 1000);
    } catch (error) {
      setDebugInfo(`Test tone failed: ${(error as Error).message}`);
    }
  };

  // Check audio capabilities on mount
  useEffect(() => {
    if (!audioElement) {
      setDebugInfo("Audio element not initialized");
      return;
    }

    const info = [
      `Audio element ready: ${audioElement ? "Yes" : "No"}`,
      `Autoplay: ${audioElement.autoplay ? "Yes" : "No"}`,
      `Muted: ${audioElement.muted ? "Yes" : "No"}`,
      `Volume: ${audioElement.volume}`,
      `Has source: ${audioElement.srcObject ? "Yes" : "No"}`,
    ].join("\n");

    setDebugInfo(info);
  }, [audioElement]);

  return (
    <div className="p-3 border border-orange-300 bg-orange-50 rounded-md my-2">
      <h3 className="font-bold text-orange-700 mb-2">Audio Debug Panel</h3>
      <pre className="text-xs bg-white p-2 rounded mb-2 overflow-auto max-h-20">
        {debugInfo}
      </pre>
      <div className="flex space-x-2">
        <Button
          size="sm"
          onClick={forcePlayAudio}
          className="bg-blue-500 text-white"
        >
          <Volume2 className="w-4 h-4 mr-1" /> Force Audio
        </Button>
        <Button
          size="sm"
          onClick={playTestTone}
          className="bg-green-500 text-white"
        >
          Play Test Tone
        </Button>
      </div>
    </div>
  );
};

export default AudioDebugHelper;

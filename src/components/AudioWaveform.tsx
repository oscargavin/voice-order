"use client";

import React, { useEffect, useRef } from "react";

interface AudioWaveformProps {
  isActive: boolean;
  color: string;
  isSpeaking?: boolean;
  height?: number;
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isActive,
  color,
  isSpeaking = false,
  height = 40,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const barWidth = 3;
    const gap = 2;
    const totalBars = Math.floor(width / (barWidth + gap));
    const maxHeight = height;

    // Apple-like design with smoother transitions
    const barHeights = Array(totalBars).fill(0);

    // Target heights that we'll animate towards
    const targetHeights = Array(totalBars).fill(0);

    // Smoothing factor (lower = smoother transitions)
    const smoothingFactor = 0.2;

    // Update target heights periodically
    const updateTargetHeights = () => {
      for (let i = 0; i < totalBars; i++) {
        if (!isActive) {
          targetHeights[i] = 0;
          continue;
        }

        // Create a softer curved pattern for the waves
        const baseHeight = isSpeaking ? maxHeight * 0.6 : maxHeight * 0.3;
        const variance = isSpeaking ? maxHeight * 0.4 : maxHeight * 0.2;

        // Add some variation based on position to create a wave pattern
        const patternFactor =
          Math.sin(i * 0.3 + Date.now() * 0.003) * 0.5 + 0.5;

        targetHeights[i] =
          baseHeight + variance * patternFactor * Math.random();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Set color with alpha
      ctx.fillStyle = isActive ? color : `${color}30`;

      // Smooth transition to target heights
      for (let i = 0; i < totalBars; i++) {
        barHeights[i] += (targetHeights[i] - barHeights[i]) * smoothingFactor;

        const barHeight = barHeights[i];
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        // Draw with rounded caps for a more polished look
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      // Schedule the next frame
      animationRef.current = requestAnimationFrame(draw);
    };

    // Update target heights periodically
    const intervalId = setInterval(updateTargetHeights, 100);

    // Start the animation
    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      clearInterval(intervalId);
    };
  }, [isActive, isSpeaking, color, height]);

  return (
    <canvas ref={canvasRef} width={200} height={height} className="w-full" />
  );
};

export default AudioWaveform;

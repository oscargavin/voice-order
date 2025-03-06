"use client";

import dynamic from "next/dynamic";

const VoiceOrderSystem = dynamic(
  () => import("@/components/VoiceOrderSystem"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen">
      <VoiceOrderSystem />
    </div>
  );
}

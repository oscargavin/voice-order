"use client";

import dynamic from "next/dynamic";

const VoiceOrderSystem = dynamic(
  () => import("@/components/VoiceOrderSystem"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="py-6 bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            OpenInfo Foodservice
          </h1>
          <p className="text-gray-600 dark:text-gray-300">Voice Order System</p>
        </div>
      </header>

      <main>
        <VoiceOrderSystem />
      </main>
    </div>
  );
}

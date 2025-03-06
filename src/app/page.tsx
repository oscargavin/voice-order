"use client";

import dynamic from "next/dynamic";

const VoiceOrderSystem = dynamic(
  () => import("@/components/VoiceOrderSystem"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-800 text-foreground">
      <header className="sticky top-0 z-50 w-full backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/80 dark:border-gray-800/30 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              OpenInfo Foodservice
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Voice Order System
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-600 dark:text-gray-300"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <main className="py-10 px-4">
        <VoiceOrderSystem />
      </main>
    </div>
  );
}

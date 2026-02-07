"use client";

import React from "react";
import { NeynarContextProvider, Theme } from "@neynar/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NeynarContextProvider
      settings={{
        clientId: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || "83749266-9041-4541-a675-9c94625574e4", // Replace with your actual Client ID from Neynar
        defaultTheme: Theme.Light,
        eventsCallbacks: {
          onAuthSuccess: () => {},
          onSignout: () => {},
        },
      }}
    >
      {children}
    </NeynarContextProvider>
  );
} 
 


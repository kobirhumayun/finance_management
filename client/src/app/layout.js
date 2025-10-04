// File: src/app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from "@/components/ui/sonner";
import ThemeProvider from "@/components/shared/theme-provider";
import SessionRefresher from "@/components/shared/session-refresher";

// Configure the Geist fonts used across the entire application.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Application-wide metadata describing the product.
export const metadata = {
  title: "FinTrack",
  description: "Financial management platform with advanced analytics and plan management.",
};

export const revalidate = 0;

// Root layout wraps every route with providers and shared UI primitives.
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>
          <ThemeProvider>
            <SessionRefresher />
            {children}
            <Toaster richColors closeButton />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}

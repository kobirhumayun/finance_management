// File: src/app/layout.js
import "./globals.css";
import Providers from "./providers";
import { Toaster } from "@/components/ui/sonner";
import ThemeProvider from "@/components/shared/theme-provider";
import SessionRefresher from "@/components/shared/session-refresher";

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
      <body className="font-sans antialiased">
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

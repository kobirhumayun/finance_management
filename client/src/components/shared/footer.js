// File: src/components/shared/footer.js
"use client";

import Link from "next/link";
import { Facebook, Github, Linkedin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Marketing footer displayed on all public pages.
export default function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            © 2025 FinTrack. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Link href="https://facebook.com" aria-label="Facebook" className="hover:text-foreground">
              <Facebook className="h-4 w-4" />
            </Link>
            <Link href="https://github.com" aria-label="GitHub" className="hover:text-foreground">
              <Github className="h-4 w-4" />
            </Link>
            <Link href="https://linkedin.com" aria-label="LinkedIn" className="hover:text-foreground">
              <Linkedin className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <Separator className="my-6" />
        <p className="text-sm text-muted-foreground">
          FinTrack empowers teams to master budgeting, track spending, and uncover financial insights with ease.
        </p>
      </div>
    </footer>
  );
}

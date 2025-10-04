// File: src/components/shared/header.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/shared/theme-toggle";
import UserNav from "@/components/shared/user-nav";
import Logo from "@/components/shared/logo";
import { cn } from "@/lib/utils";

// Primary header component with public and dashboard variants.
export default function Header({ variant = "public", onMenuClick }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAuthenticated = Boolean(session?.user);

  if (variant === "dashboard") {
    return (
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background px-4 shadow-sm">
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="relative hidden max-w-sm flex-1 items-center gap-2 md:flex">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search..." aria-label="Search dashboard" />
          </div>
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="View notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <UserNav />
        </div>
      </header>
    );
  }

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "/(public)/pricing".replace("/(public)", ""), label: "Pricing" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-foreground",
                pathname === link.href ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle size="icon" />
          {isAuthenticated ? (
            <Button asChild variant="outline" size="sm">
              <Link href={session?.user?.role === "admin" ? "/admin/dashboard" : "/dashboard"}>
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

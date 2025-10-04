// File: src/app/(user)/layout.js
"use client";

import { useState } from "react";
import Header from "@/components/shared/header";
import Sidebar from "@/components/shared/sidebar";
import { Separator } from "@/components/ui/separator";
import { Home, Layers, PieChart, CreditCard, ListChecks } from "lucide-react";

const userLinks = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Projects", href: "/projects", icon: Layers },
  { label: "Reports", href: "/reports", icon: PieChart },
  { label: "My Plan", href: "/my-plan", icon: CreditCard },
  { label: "Summary", href: "/summary", icon: ListChecks },
];

// Layout wrapping all authenticated user pages with sidebar navigation.
export default function UserLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar
        links={userLinks}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        footer={<div className="px-4 pb-4 text-xs text-muted-foreground">Need more features? Visit the Pricing page.</div>}
      />
      <div className="flex flex-1 flex-col">
        <Header variant="dashboard" onMenuClick={() => setMobileOpen(true)} />
        <Separator className="hidden lg:block" />
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

// File: src/app/(admin)/layout.js
"use client";

import { useState } from "react";
import Header from "@/components/shared/header";
import Sidebar from "@/components/shared/sidebar";
import { Separator } from "@/components/ui/separator";
import { Home, ClipboardList, Users, DollarSign, SlidersHorizontal } from "lucide-react";

const adminLinks = [
  { label: "Dashboard", href: "/admin/dashboard", icon: Home },
  { label: "Plan Management", href: "/admin/plan-management", icon: ClipboardList },
  { label: "User Management", href: "/admin/user-management", icon: Users },
  { label: "Payments", href: "/admin/payments", icon: DollarSign },
  { label: "App Settings", href: "/admin/settings", icon: SlidersHorizontal },
];

// Layout for administrative pages with dedicated navigation.
export default function AdminLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar
        links={adminLinks}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        footer={<div className="px-4 pb-4 text-xs text-muted-foreground">Administrative access only.</div>}
      />
      <div className="flex flex-1 flex-col">
        <Header variant="dashboard" onMenuClick={() => setMobileOpen(true)} />
        <Separator className="hidden lg:block" />
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

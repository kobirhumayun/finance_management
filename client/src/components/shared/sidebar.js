// File: src/components/shared/sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import Logo from "@/components/shared/logo";
import { cn } from "@/lib/utils";

// Reusable navigation sidebar with desktop and mobile variants.
export default function Sidebar({ links = [], mobileOpen, onMobileOpenChange, footer }) {
  const pathname = usePathname();

  const renderLinks = () => (
    <nav className="mt-6 space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3">
              <Logo />
            </div>
            <Separator />
            <div className="flex-1 overflow-y-auto px-4 pb-6">{renderLinks()}</div>
            {footer}
          </div>
        </SheetContent>
      </Sheet>

      <aside className="hidden w-64 flex-shrink-0 border-r bg-muted/40 lg:flex lg:flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <Logo />
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto px-4 pb-6">{renderLinks()}</div>
        {footer}
      </aside>
    </>
  );
}

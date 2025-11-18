// File: src/components/shared/user-nav.js
"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { resolveAssetUrl } from "@/lib/utils";
import { selfProfileQueryOptions } from "@/lib/queries/self";

// Dropdown menu surfaced from the dashboard header to expose account actions.
export default function UserNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const profileQuery = useQuery({ ...selfProfileQueryOptions(), enabled: Boolean(session?.user) });
  const profile = profileQuery.data ?? session?.user ?? null;

  const initials =
    profile?.username?.slice(0, 2)?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U";

  const avatarUrl = profile?.profilePictureUrl
    ? resolveAssetUrl(profile.profilePictureUrl)
    : profile?.profileImage?.url
      ? resolveAssetUrl(profile.profileImage.url)
      : "";

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    toast.success("Signed out successfully");
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile?.username || profile?.email || "Profile photo"} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {profile?.username || profile?.email || "Account"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-semibold">{profile?.username || "Signed in"}</div>
          <div className="text-xs text-muted-foreground">{profile?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push("/profile")}>
          <User className="mr-2 h-4 w-4" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/utils";

const formatTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export default function ProfileAvatarUploader({
  avatarUrl,
  displayName,
  username,
  lastUpdated,
  onSelectFile,
  onRemove,
  isUploading,
  isRemoving,
  disabled,
}) {
  const fileInputRef = useRef(null);
  const rawAvatarUrl = typeof avatarUrl === "string" ? avatarUrl : "";
  const resolvedAvatarUrl = rawAvatarUrl.startsWith("/api/")
    ? resolveAssetUrl(rawAvatarUrl)
    : rawAvatarUrl;
  const initialsSource = displayName || username || "User";
  const initials = initialsSource
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hasAvatar = Boolean(resolvedAvatarUrl);
  const lastUpdatedLabel = formatTimestamp(lastUpdated);

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile?.(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center">
      <Avatar className="h-20 w-20">
        <AvatarImage src={hasAvatar ? resolvedAvatarUrl : undefined} alt={displayName || username || "Profile photo"} />
        <AvatarFallback>{initials || "?"}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handleSelectClick} disabled={disabled || isUploading}>
            {isUploading ? "Uploading..." : "Upload photo"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRemove}
            disabled={disabled || isRemoving || !hasAvatar}
          >
            {isRemoving ? "Removing..." : "Remove photo"}
          </Button>
        </div>
        {lastUpdatedLabel ? (
          <p className="text-xs text-muted-foreground">Last updated on {lastUpdatedLabel}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          PNG, JPG, or WebP up to 5&nbsp;MB. Images stay on this server—no third-party processing.
        </p>
      </div>
    </div>
  );
}

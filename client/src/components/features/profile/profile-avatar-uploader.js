"use client";

import { useMemo, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatFileSize, resolveAssetUrl } from "@/lib/utils";

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const resolveMaxUploadBytes = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_UPLOAD_BYTES;
};

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
  maxUploadBytes,
  errorMessage,
}) {
  const fileInputRef = useRef(null);
  const rawAvatarUrl = typeof avatarUrl === "string" ? avatarUrl : "";
  const resolvedAvatarUrl = resolveAssetUrl(rawAvatarUrl, lastUpdated);
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
  const resolvedMaxUploadBytes = useMemo(
    () => resolveMaxUploadBytes(maxUploadBytes),
    [maxUploadBytes]
  );

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
          PNG, JPG, or WebP up to {formatFileSize(resolvedMaxUploadBytes, { fallback: "5 MB" })}. Images stay on this
          server—no third-party processing.
        </p>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </div>
    </div>
  );
}

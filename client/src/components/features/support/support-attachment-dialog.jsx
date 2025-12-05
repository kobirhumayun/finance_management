/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatFileSize, resolveAssetUrl } from "@/lib/utils";

const formatDateTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
};

export default function SupportAttachmentDialog({ open, onOpenChange, attachment }) {
    const isPending = Boolean(attachment?.isPending);
    const attachmentUrl = attachment?.url ?? "";
    const resolvedAttachmentUrl = resolveAssetUrl(
        attachmentUrl,
        attachment?.uploadedAt ?? attachment?.updatedAt
    );
    // If the attachment object already has a resolvedUrl property (from ticket-detail-page hydration), use it.
    // Otherwise resolve it here.
    const finalUrl = attachment?.resolvedUrl || resolvedAttachmentUrl;
    const resolvedUrl = isPending ? "" : finalUrl;

    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [resolvedUrl, attachment?.id]);

    const filename = attachment?.filename || "Attachment";
    const mimeType = attachment?.mimeType || "";
    const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

    const uploadedAtLabel = isPending ? "Processing..." : formatDateTime(attachment?.uploadedAt);
    const sizeLabel = isPending ? "Processing..." : formatFileSize(attachment?.size, { fallback: "—" });
    const dimensionsLabel = attachment?.width && attachment?.height
        ? `${attachment.width} × ${attachment.height}px`
        : "—";

    const showDialog = open && Boolean(attachment);

    return (
        <Dialog open={showDialog} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{filename}</DialogTitle>
                    <DialogDescription>
                        Preview the attachment.
                    </DialogDescription>
                </DialogHeader>
                {attachment ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <dl className="grid gap-2 sm:grid-cols-2">
                                <div>
                                    <dt className="text-muted-foreground">Filename</dt>
                                    <dd className="font-medium">{filename}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Size</dt>
                                    <dd className="font-medium">{sizeLabel}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Dimensions</dt>
                                    <dd className="font-medium">{dimensionsLabel}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Uploaded</dt>
                                    <dd className="font-medium">{uploadedAtLabel ?? "—"}</dd>
                                </div>
                            </dl>
                        </div>
                        {isPending ? (
                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                This attachment is still processing. Once it finishes uploading you can view or download it here.
                            </div>
                        ) : resolvedUrl && !imageError ? (
                            isPdf ? (
                                <iframe
                                    src={resolvedUrl}
                                    className="h-[600px] w-full rounded-lg border bg-white"
                                    title={filename}
                                />
                            ) : (
                                <img
                                    src={resolvedUrl}
                                    alt={filename}
                                    className="max-h-[600px] w-full rounded-lg border bg-black/5 object-contain"
                                    onError={() => setImageError(true)}
                                />
                            )
                        ) : (
                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                {imageError
                                    ? "Unable to load the stored file. Try downloading it instead."
                                    : "No preview available."}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {resolvedUrl ? (
                                <Button asChild size="sm">
                                    <a href={resolvedUrl} target="_blank" rel="noreferrer" download>
                                        Download file
                                    </a>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No attachment available.</p>
                )}
            </DialogContent>
        </Dialog>
    );
}

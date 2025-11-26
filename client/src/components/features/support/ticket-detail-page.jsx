// File: src/components/features/support/ticket-detail-page.jsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Files, Loader2, Paperclip, Send, X } from "lucide-react";
import PageHeader from "@/components/shared/page-header";
import { TicketConversation, TicketSummary } from "@/components/features/support/ticket-activity";
import { TicketStatusBadge } from "@/components/features/support/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { qk } from "@/lib/query-keys";
import { addTicketComment, fetchTicketDetail, updateTicketStatus } from "@/lib/queries/tickets";
import { formatDate } from "@/lib/formatters";
import { formatFileSize, resolveAssetUrl } from "@/lib/utils";
import { resolveMaxAttachmentBytes } from "@/lib/attachments";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (error.body) {
    if (typeof error.body === "string") return error.body;
    if (typeof error.body?.message === "string") return error.body.message;
    if (Array.isArray(error.body?.errors) && error.body.errors.length > 0) {
      const [first] = error.body.errors;
      if (first?.msg) return first.msg;
      if (first?.message) return first.message;
    }
  }
  return error.message || fallback;
};

export default function TicketDetailPage({ backHref = "/support/tickets" }) {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ticketId = useMemo(() => (Array.isArray(params?.ticketId) ? params.ticketId[0] : params?.ticketId), [params]);

  const [comment, setComment] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState(null);
  const fileInputRef = useRef(null);

  const ticketQuery = useQuery({
    queryKey: qk.tickets.detail(ticketId),
    queryFn: ({ signal }) => fetchTicketDetail({ ticketId, signal }),
    enabled: Boolean(ticketId),
  });

  const ticketResponse = ticketQuery.data;
  const ticket = ticketResponse?.ticket ?? ticketResponse;
  const users = ticketResponse?.users || {};
  const isLoading = ticketQuery.isLoading;
  const isFetching = ticketQuery.isFetching;
  const resolvedMaxAttachmentBytes = useMemo(
    () => resolveMaxAttachmentBytes(ticketResponse?.attachmentLimitBytes),
    [ticketResponse?.attachmentLimitBytes]
  );

  const invalidateTicketQueries = () => {
    queryClient.invalidateQueries({ queryKey: qk.tickets.detail(ticketId) });
    queryClient.invalidateQueries({ queryKey: ["tickets", "list"], exact: false });
  };

  const commentMutation = useMutation({
    mutationFn: async ({ message, attachments }) => {
      if ((!message || !message.trim()) && (!attachments || attachments.length === 0)) {
        throw new Error("Comment cannot be empty");
      }
      return addTicketComment({ ticketId, comment: message, attachments });
    },
    onSuccess: () => {
      toast.success("Comment added");
      setComment("");
      setPendingAttachments([]);
      setAttachmentError(null);
      invalidateTicketQueries();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Unable to add comment"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status) => updateTicketStatus({ ticketId, status }),
    onSuccess: () => {
      toast.success("Status updated");
      invalidateTicketQueries();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Unable to update status"));
    },
  });

  const validateAttachment = (file) => {
    if (resolvedMaxAttachmentBytes && file.size > resolvedMaxAttachmentBytes) {
      return `Attachments must be smaller than ${formatFileSize(resolvedMaxAttachmentBytes, { fallback: "the limit" })}.`;
    }
    return null;
  };

  const attachmentLabel = useMemo(() => {
    if (!pendingAttachments.length) return "No files selected";
    if (pendingAttachments.length === 1) {
      const [file] = pendingAttachments;
      return `${file.name} (${formatFileSize(file.size, { fallback: "unknown size" })})`;
    }
    const totalSize = pendingAttachments.reduce((sum, file) => sum + (file?.size || 0), 0);
    return `${pendingAttachments.length} files selected (${formatFileSize(totalSize, { fallback: "unknown size" })})`;
  }, [pendingAttachments]);

  const attachments = useMemo(() => {
    if (!Array.isArray(ticket?.attachments)) return [];
    return ticket.attachments.map((attachment) => ({
      ...attachment,
      resolvedUrl: resolveAssetUrl(attachment?.url, attachment?.uploadedAt ?? attachment?.updatedAt),
    }));
  }, [ticket?.attachments]);

  const handleViewAttachment = (attachment) => {
    const url = attachment?.resolvedUrl || attachment?.url;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownloadAttachment = (attachment) => {
    const url = attachment?.resolvedUrl || attachment?.url;
    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (attachment?.filename) {
      link.download = attachment.filename;
    }
    link.click();
  };

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    const existing = Array.isArray(pendingAttachments) ? [...pendingAttachments] : [];

    if (!files.length && !existing.length) {
      setPendingAttachments([]);
      setAttachmentError(null);
      return;
    }

    const firstErrorRef = { current: null };
    const dedupeKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;
    const seen = new Set(existing.map(dedupeKey));

    const validatedExisting = existing.filter((file) => {
      const error = validateAttachment(file);
      if (error && !firstErrorRef.current) {
        firstErrorRef.current = error;
      }
      return !error;
    });

    const validNewFiles = files.reduce((list, file) => {
      const key = dedupeKey(file);
      if (seen.has(key)) return list;
      const error = validateAttachment(file);
      if (error && !firstErrorRef.current) {
        firstErrorRef.current = error;
      }
      if (!error) {
        seen.add(key);
        list.push(file);
      }
      return list;
    }, []);

    setPendingAttachments([...validatedExisting, ...validNewFiles]);
    setAttachmentError(firstErrorRef.current);

    if (event.target) {
      event.target.value = "";
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setPendingAttachments((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const conversation = useMemo(() => {
    if (!ticket) return [];

    const events = Array.isArray(ticket?.activityLog) ? [...ticket.activityLog] : [];
    const parseTimestamp = (value) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.getTime();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed)) return parsed;

        const numericFallback = Number(trimmed);
        if (Number.isFinite(numericFallback)) return numericFallback;
      }
      return 0;
    };

    const resolveUser = (userId) => {
      if (!userId) return null;
      const id = typeof userId === "object" && userId.id ? userId.id : userId;
      return users?.[id] || null;
    };

    const assignedAttachmentIds = new Set();
    const hydrateAttachment = (attachment) => {
      if (!attachment) return null;
      const hydrated = {
        ...attachment,
        resolvedUrl: resolveAssetUrl(attachment?.url, attachment?.uploadedAt ?? attachment?.updatedAt),
      };
      if (hydrated.id) {
        assignedAttachmentIds.add(hydrated.id);
      }
      return hydrated;
    };

    const matchAttachments = (event) => {
      const timestamp = parseTimestamp(event?.at);
      const normalizedMessage = event?.message?.toLowerCase?.().trim?.() || "";
      return attachments.filter((attachment) => {
        if (!attachment || assignedAttachmentIds.has(attachment.id)) return false;
        const uploadedAt = parseTimestamp(attachment.uploadedAt);
        const nameMatch =
          normalizedMessage && attachment.filename?.toLowerCase?.() === normalizedMessage;
        const timeMatch =
          uploadedAt && timestamp && Math.abs(uploadedAt - timestamp) <= 5 * 60 * 1000;

        if (nameMatch || timeMatch) {
          assignedAttachmentIds.add(attachment.id);
          return true;
        }
        return false;
      });
    };

    const eventsWithActors = events.map((entry) => ({
      ...entry,
      actorDetails: entry.actorDetails || resolveUser(entry.actor),
    }));

    const sortedEvents = eventsWithActors
      .sort((a, b) => parseTimestamp(a?.at) - parseTimestamp(b?.at))
      .map((entry) => {
        const providedAttachments = Array.isArray(entry.attachments)
          ? entry.attachments.map(hydrateAttachment).filter(Boolean)
          : [];

        const resolvedAttachments = providedAttachments.length
          ? providedAttachments
          : matchAttachments(entry);

        return { ...entry, attachments: resolvedAttachments };
      });

    const unassignedAttachments = attachments.filter(
      (attachment) => attachment && !assignedAttachmentIds.has(attachment.id)
    );

    return [
      {
        id: "description",
        action: "description",
        actor: ticket.requester,
        actorDetails: resolveUser(ticket.requester),
        at: ticket.createdAt,
        message: ticket.description || "No description provided.",
        attachments: unassignedAttachments,
      },
      ...sortedEvents,
    ];
  }, [attachments, ticket, ticket?.activityLog, ticket?.createdAt, ticket?.description, ticket?.requester, users]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={ticket?.subject || "Support ticket"}
        description={ticket ? `Created ${formatDate(ticket.createdAt)}` : ""}
        actions={ticket ? <TicketStatusBadge status={ticket.status} /> : null}
      />

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading ticket...
          </CardContent>
        </Card>
      ) : null}

      {ticketQuery.isError ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">Unable to load ticket details.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push(backHref)}>
              Back to tickets
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ticket ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-col gap-2">
                <CardTitle className="text-lg">Conversation</CardTitle>
                <p className="text-sm text-muted-foreground">Share updates or clarifications with our support team.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <TicketConversation
                  activity={conversation}
                  ticket={ticket}
                  onViewAttachment={handleViewAttachment}
                  onDownloadAttachment={handleDownloadAttachment}
                />
                <div className="space-y-3 border-t pt-4">
                  <Label htmlFor="comment">Reply</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Type your reply"
                    rows={4}
                  />
                  <div className="space-y-2">
                    <Label className="text-sm">Attachments (optional)</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        id="reply-attachments"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleAttachmentChange}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2"
                      >
                        <Paperclip className="h-4 w-4" aria-hidden />
                        <span>Add files</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="sm:hidden"
                        aria-label="Attach multiple files"
                      >
                        <Files className="h-4 w-4" aria-hidden />
                      </Button>
                      <p className="text-xs text-muted-foreground">{attachmentLabel}</p>
                    </div>
                    {pendingAttachments.length ? (
                      <ul className="space-y-2 text-sm">
                        {pendingAttachments.map((file, index) => (
                          <li
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size, { fallback: "unknown size" })}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveAttachment(index)}
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      You can attach multiple files (images, PDFs, docs) up to {formatFileSize(resolvedMaxAttachmentBytes, {
                        fallback: "the upload limit",
                      })}{" "}
                      each.
                    </p>
                    {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setComment("")}
                      disabled={commentMutation.isPending}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        commentMutation.isPending || (!comment.trim() && pendingAttachments.length === 0)
                      }
                      onClick={() =>
                        commentMutation.mutate({ message: comment, attachments: pendingAttachments })
                      }
                    >
                      {commentMutation.isPending ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Sending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Post comment
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <TicketSummary ticket={ticket} />

            <Card>
              <CardHeader className="flex flex-col gap-1">
                <CardTitle className="text-base">Status</CardTitle>
                <p className="text-sm text-muted-foreground">Update how this ticket should be tracked.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select
                  value={ticket.status}
                  onValueChange={(value) => statusMutation.mutate(value)}
                  disabled={statusMutation.isPending || isFetching}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">All changes are logged to the activity history.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

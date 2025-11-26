// File: src/components/features/support/ticket-detail-page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Send } from "lucide-react";
import PageHeader from "@/components/shared/page-header";
import { TicketActivity, TicketAttachmentList, TicketSummary } from "@/components/features/support/ticket-activity";
import { TicketStatusBadge } from "@/components/features/support/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { qk } from "@/lib/query-keys";
import { addTicketComment, fetchTicketDetail, updateTicketStatus, uploadTicketAttachment } from "@/lib/queries/tickets";
import { formatDate } from "@/lib/formatters";
import { formatFileSize, resolveAssetUrl } from "@/lib/utils";
import TransactionAttachmentDialog from "@/components/features/projects/transaction-attachment-dialog";
import { IMAGE_ATTACHMENT_TYPES, resolveMaxAttachmentBytes, validateImageAttachment } from "@/lib/attachments";

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
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);

  const ticketQuery = useQuery({
    queryKey: qk.tickets.detail(ticketId),
    queryFn: ({ signal }) => fetchTicketDetail({ ticketId, signal }),
    enabled: Boolean(ticketId),
  });

  const ticketResponse = ticketQuery.data;
  const ticket = ticketResponse?.ticket ?? ticketResponse;
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
    mutationFn: async (message) => {
      if (!message || !message.trim()) {
        throw new Error("Comment cannot be empty");
      }
      return addTicketComment({ ticketId, comment: message });
    },
    onSuccess: () => {
      toast.success("Comment added");
      setComment("");
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

  const validateAttachment = (file) =>
    validateImageAttachment(
      file,
      resolvedMaxAttachmentBytes,
      (value) => formatFileSize(value, { fallback: "unknown size" })
    );

  const attachmentMutation = useMutation({
    mutationFn: (file) => uploadTicketAttachment({ ticketId, file }),
    onSuccess: () => {
      toast.success("Attachment uploaded");
      setAttachmentFile(null);
      setAttachmentError(null);
      invalidateTicketQueries();
    },
    onError: (error) => {
      setAttachmentError(getErrorMessage(error, "Unable to upload attachment"));
    },
  });

  const attachments = useMemo(() => {
    if (!Array.isArray(ticket?.attachments)) return [];
    return ticket.attachments.map((attachment) => ({
      ...attachment,
      resolvedUrl: resolveAssetUrl(attachment?.url, attachment?.uploadedAt ?? attachment?.updatedAt),
    }));
  }, [ticket?.attachments]);

  const handleViewAttachment = (attachment) => {
    if (!attachment) return;
    setSelectedAttachment({
      id: attachment.id,
      subcategory: ticket?.subject || "Support ticket",
      description: ticket?.description || "",
      attachment: {
        ...attachment,
        url: attachment.resolvedUrl || attachment.url || "",
      },
    });
    setIsAttachmentDialogOpen(true);
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachmentFile(null);
      setAttachmentError(null);
      return;
    }
    const error = validateAttachment(file);
    if (error) {
      setAttachmentFile(null);
      setAttachmentError(error);
      return;
    }
    setAttachmentFile(file);
    setAttachmentError(null);
  };

  const handleUpload = () => {
    if (!attachmentFile) {
      setAttachmentError("Select a file to upload");
      return;
    }
    attachmentMutation.mutate(attachmentFile);
  };

  useEffect(() => {
    if (!isAttachmentDialogOpen) {
      setSelectedAttachment(null);
    }
  }, [isAttachmentDialogOpen]);

  const activity = useMemo(() => {
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

    return events.sort((a, b) => parseTimestamp(a?.at) - parseTimestamp(b?.at));
  }, [ticket?.activityLog]);

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
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {ticket.description || "No description provided."}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium">Category: {ticket.category || "Not set"}</span>
                    <span className="font-medium">Priority: {ticket.priority}</span>
                    <span>Last updated {formatDate(ticket.updatedAt)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment">Add a comment</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Type your reply"
                    rows={4}
                  />
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
                      disabled={commentMutation.isPending || !comment.trim()}
                      onClick={() => commentMutation.mutate(comment)}
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

                <TicketActivity activity={activity} />
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

            <TicketAttachmentList
              attachments={attachments}
              onView={handleViewAttachment}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUpload}
                  disabled={attachmentMutation.isPending || !attachmentFile}
                >
                  {attachmentMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <UploadIcon />
                      Upload
                    </span>
                  )}
                </Button>
              }
            />
            <Card>
              <CardContent className="space-y-2">
                <Label htmlFor="ticket-attachment" className="text-sm">Attach a file</Label>
                <Input
                  id="ticket-attachment"
                  type="file"
                  accept={IMAGE_ATTACHMENT_TYPES.join(",")}
                  onChange={handleAttachmentChange}
                />
                <p className="text-xs text-muted-foreground">
                  {attachmentFile
                    ? `${attachmentFile.name} (${formatFileSize(attachmentFile.size, { fallback: "unknown size" })})`
                    : "No file selected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Accepted: PNG, JPG, or WebP images up to {formatFileSize(resolvedMaxAttachmentBytes)}.
                </p>
                {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <TransactionAttachmentDialog
        open={isAttachmentDialogOpen}
        onOpenChange={setIsAttachmentDialogOpen}
        transaction={selectedAttachment}
      />
    </div>
  );
}

function UploadIcon() {
  return <Paperclip className="h-4 w-4" />;
}


// File: src/app/(user)/support/tickets/[ticketId]/page.js
"use client";

import { useMemo, useState } from "react";
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
import {
  addTicketComment,
  fetchTicketDetail,
  updateTicketStatus,
  uploadTicketAttachment,
} from "@/lib/queries/tickets";
import { formatDate } from "@/lib/formatters";
import { formatFileSize } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ticketId = useMemo(() => (Array.isArray(params?.ticketId) ? params.ticketId[0] : params?.ticketId), [params]);

  const [comment, setComment] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);

  const ticketQuery = useQuery({
    queryKey: qk.tickets.detail(ticketId),
    queryFn: ({ signal }) => fetchTicketDetail({ ticketId, signal }),
    enabled: Boolean(ticketId),
  });

  const ticket = ticketQuery.data;
  const isLoading = ticketQuery.isLoading;
  const isFetching = ticketQuery.isFetching;

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

  const validateAttachment = (file) => {
    if (!file) return null;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return `File is too large. Max size is ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`;
    }
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      return "Unsupported file type. Upload an image or PDF.";
    }
    return null;
  };

  const attachmentMutation = useMutation({
    mutationFn: (file) => uploadTicketAttachment({ ticketId, file }),
    onSuccess: () => {
      toast.success("Attachment uploaded");
      setAttachmentFile(null);
      setAttachmentError(null);
      invalidateTicketQueries();
    },
    onError: (error) => {
      const message = getErrorMessage(error, "Unable to upload attachment");
      setAttachmentError(message);
      toast.error(message);
    },
  });

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

  const activity = useMemo(() => {
    const events = Array.isArray(ticket?.activityLog) ? [...ticket.activityLog] : [];
    return events.sort((a, b) => {
      const aTime = a?.at ? new Date(a.at).getTime() : 0;
      const bTime = b?.at ? new Date(b.at).getTime() : 0;
      return bTime - aTime;
    });
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
            <Button variant="outline" className="mt-4" onClick={() => router.push("/support/tickets")}>Back to tickets</Button>
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
              attachments={ticket.attachments}
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
                <Input id="ticket-attachment" type="file" accept={ACCEPTED_TYPES.join(",")} onChange={handleAttachmentChange} />
                <p className="text-xs text-muted-foreground">
                  {attachmentFile
                    ? `${attachmentFile.name} (${formatFileSize(attachmentFile.size, { fallback: "unknown size" })})`
                    : "No file selected"}
                </p>
                <p className="text-xs text-muted-foreground">Accepted: images or PDF up to {formatFileSize(MAX_ATTACHMENT_BYTES)}.</p>
                {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UploadIcon() {
  return <Paperclip className="h-4 w-4" />;
}

// File: src/components/features/support/ticket-activity.jsx
import { MessageSquare, Paperclip, RefreshCcw, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/formatters";
import { formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TicketStatusBadge } from "./ticket-status-badge";

const actionLabels = {
  created: "Ticket created",
  comment: "Commented",
  status_change: "Status updated",
  assignee_change: "Assignee updated",
  attachment_added: "Attachment added",
  attachment_removed: "Attachment removed",
};

const actionIcons = {
  created: UserRound,
  comment: MessageSquare,
  status_change: RefreshCcw,
  assignee_change: RefreshCcw,
  attachment_added: Paperclip,
  attachment_removed: Paperclip,
};

export function TicketActivity({ activity = [] }) {
  if (!activity.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activity.map((item, index) => {
          const Icon = actionIcons[item.action] || MessageSquare;
          const label = actionLabels[item.action] || "Update";
          const showDivider = index < activity.length - 1;

          return (
            <div key={`${item.action}-${item.at}-${index}`} className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">{label}</p>
                  {item.message ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{item.message}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                </div>
              </div>
              {showDivider ? <Separator /> : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function TicketAttachmentList({ attachments = [], onView, actions = null }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Attachments</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="space-y-3">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {attachments.map((attachment) => (
              <li
                key={attachment.id || attachment.url}
                className="flex items-center justify-between gap-4 rounded-md border bg-card px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{attachment.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size, { fallback: "" }) || "Unknown size"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dimensions: {attachment.width && attachment.height ? `${attachment.width} × ${attachment.height}px` : "—"}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap"
                  disabled={!attachment.url && !attachment.resolvedUrl}
                  onClick={(event) => {
                    event.preventDefault();
                    onView?.(attachment);
                  }}
                >
                  View image
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function TicketSummary({ ticket }) {
  if (!ticket) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Status</span>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Priority</span>
          <span className="font-medium capitalize">{ticket.priority}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Category</span>
          <span className="font-medium">{ticket.category || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Created</span>
          <span className="font-medium">{formatDate(ticket.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Updated</span>
          <span className="font-medium">{formatDate(ticket.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

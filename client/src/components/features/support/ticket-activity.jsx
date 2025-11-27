// File: src/components/features/support/ticket-activity.jsx
import {
  CalendarClock,
  Download,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  RefreshCcw,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/formatters";
import { formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TicketStatusBadge } from "./ticket-status-badge";

const actionLabels = {
  description: "Ticket details",
  created: "Ticket created",
  comment: "Comment",
  status_change: "Status updated",
  assignee_change: "Assignee updated",
  attachment_added: "Attachment added",
  attachment_removed: "Attachment removed",
};

const actionIcons = {
  description: UserRound,
  created: UserRound,
  comment: MessageSquare,
  status_change: RefreshCcw,
  assignee_change: RefreshCcw,
  attachment_added: Paperclip,
  attachment_removed: Paperclip,
};

const getInitials = (value) => {
  if (!value) return "?";
  const [first = "", second = ""] = value.split(" ");
  return `${first[0] || ""}${second[0] || ""}`.toUpperCase() || "?";
};

const rolePalettes = {
  Requester: { color: "var(--primary)", alignRight: true },
  Support: { color: "var(--chart-2)" },
  Admin: { color: "var(--chart-5)" },
};

const buildToneStyles = (color) => {
  const baseColor = color || "var(--muted-foreground)";
  return {
    text: baseColor,
    surface: `color-mix(in oklab, ${baseColor} 12%, transparent)`,
    surfaceStrong: `color-mix(in oklab, ${baseColor} 18%, transparent)`,
    border: `color-mix(in oklab, ${baseColor} 28%, transparent)`,
  };
};

const getRoleTheme = (roleLabel) => {
  const palette = rolePalettes[roleLabel] || { color: "var(--muted-foreground)" };
  const tone = buildToneStyles(palette.color);

  return {
    container: palette.alignRight ? "flex-row-reverse text-right" : "",
    contentAlignment: palette.alignRight ? "items-end text-right" : "",
    avatar: "ring-2 ring-transparent",
    avatarStyle: {
      color: tone.text,
      backgroundColor: tone.surface,
      boxShadow: `0 0 0 2px ${tone.border}`,
    },
    badge: "border",
    badgeStyle: {
      color: tone.text,
      borderColor: tone.border,
      backgroundColor: tone.surface,
    },
    bubble: "border",
    bubbleStyle: {
      borderColor: tone.border,
      backgroundColor: tone.surfaceStrong,
    },
    iconStyle: { color: tone.text },
    attachment: "border",
    attachmentStyle: {
      borderColor: tone.border,
      backgroundColor: tone.surface,
    },
    attachmentIconStyle: { color: tone.text },
  };
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDayLabel = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getFileIcon = (attachment) => {
  if (attachment?.mimeType?.startsWith("image/")) return ImageIcon;
  if (attachment?.mimeType === "application/pdf") return FileText;
  return File;
};

const buildRoleLabel = (event, ticket) => {
  if (!event?.actor && event?.action !== "comment") return "System";
  if (ticket?.requester && ticket.requester === event.actor) return "Requester";
  if (ticket?.assignee && ticket.assignee === event.actor) return "Assignee";
  const role = event.actorDetails?.role?.toLowerCase?.() || "";
  if (role.includes("support")) return "Support";
  if (role.includes("admin")) return "Admin";
  return "Collaborator";
};

const AttachmentCard = ({ attachment, onDownload, onView, compact = false, tone = null }) => {
  const Icon = getFileIcon(attachment);
  const url = attachment?.resolvedUrl || attachment?.url || "";

  const handleDownload = () => {
    if (!url) return;
    onDownload?.(attachment);
  };

  const handleView = () => {
    if (!url) return;
    onView?.(attachment);
  };

  const attachmentClasses = ["flex gap-3 rounded-md border p-3", tone?.attachment || "bg-card/60"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={attachmentClasses} style={tone?.attachmentStyle}>
      <div className="mt-0.5">
        <Icon
          className={`h-5 w-5 ${tone?.attachmentIcon || "text-muted-foreground"}`}
          style={tone?.attachmentIconStyle}
        />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium leading-none">
          <span className="break-all">{attachment.filename || "Attachment"}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size, { fallback: "Unknown size" })}
          {attachment.uploadedByName || attachment.uploadedByDetails?.displayName
            ? ` • Uploaded by ${attachment.uploadedByName || attachment.uploadedByDetails?.displayName}`
            : ""}
          {attachment.uploadedAt ? ` • ${formatDateTime(attachment.uploadedAt)}` : ""}
        </p>
        {attachment.width && attachment.height ? (
          <p className="text-xs text-muted-foreground">{attachment.width} × {attachment.height}px</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!url}
            onClick={(event) => {
              event.preventDefault();
              handleView();
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!url}
            onClick={(event) => {
              event.preventDefault();
              handleDownload();
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
};

const ConversationMessage = ({ event, ticket, onDownloadAttachment, onViewAttachment }) => {
  const Icon = actionIcons[event.action] || MessageSquare;
  const label = actionLabels[event.action] || "Update";
  const actorName = event.actorDetails?.displayName || event.actorName || (event.actor ? "User" : "System");
  const roleLabel = buildRoleLabel(event, ticket);
  const attachments = Array.isArray(event.attachments) ? event.attachments : [];
  const roleTheme = getRoleTheme(roleLabel);

  return (
    <div className={`flex gap-3 ${roleTheme.container}`}>
      <Avatar className={`mt-1 h-9 w-9 ${roleTheme.avatar}`} style={roleTheme.avatarStyle}>
        <AvatarFallback>{getInitials(actorName)}</AvatarFallback>
      </Avatar>
      <div className={`flex-1 space-y-3 ${roleTheme.contentAlignment}`}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold leading-none text-foreground">{actorName}</p>
          <Badge
            variant="outline"
            className={`text-[11px] capitalize ${roleTheme.badge}`}
            style={roleTheme.badgeStyle}
          >
            {roleLabel}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDateTime(event.at)}
          </span>
        </div>
        <div className={`rounded-lg p-3 ${roleTheme.bubble}`} style={roleTheme.bubbleStyle}>
          <div
            className={`mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground ${roleTheme.contentAlignment}`}
          >
            <Icon className="h-4 w-4" style={roleTheme.iconStyle} />
            {label}
          </div>
          {event.message ? (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{event.message}</p>
          ) : null}
          {event.action === "description" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Category: {ticket?.category || "Not set"} • Priority: {ticket?.priority || "Unknown"}
              {ticket?.updatedAt ? ` • Last updated ${formatDate(ticket.updatedAt)}` : ""}
            </p>
          ) : null}
        </div>
        {attachments.length ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id || attachment.url}
                attachment={attachment}
                onDownload={onDownloadAttachment}
                onView={onViewAttachment}
                tone={roleTheme}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export function TicketConversation({
  activity = [],
  ticket,
  onDownloadAttachment,
  onViewAttachment,
}) {
  if (!activity.length) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }

  const groupedByDay = activity.reduce((groups, event) => {
    const dateKey = event.at ? new Date(event.at).toDateString() : "Unknown";
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(event);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groupedByDay).map(([dateKey, items]) => (
        <div key={dateKey} className="space-y-3">
          <div className="relative flex items-center justify-center">
            <Separator className="absolute inset-x-0 top-1/2 -translate-y-1/2" />
            <span className="relative z-10 bg-card px-3 text-xs font-semibold uppercase text-muted-foreground">
              {dateKey === "Unknown" ? "Updates" : formatDayLabel(items[0]?.at || dateKey)}
            </span>
          </div>
          <div className="space-y-5">
            {items.map((event) => (
              <ConversationMessage
                key={`${event.action}-${event.at}-${event.actor}-${event.message}`}
                event={event}
                ticket={ticket}
                onDownloadAttachment={onDownloadAttachment}
                onViewAttachment={onViewAttachment}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const TicketActivity = TicketConversation;

export function TicketAttachmentList({ attachments = [], onDownload, onView, actions = null }) {
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
              <li key={attachment.id || attachment.url}>
                <AttachmentCard
                  attachment={attachment}
                  onDownload={onDownload}
                  onView={onView}
                  compact
                />
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

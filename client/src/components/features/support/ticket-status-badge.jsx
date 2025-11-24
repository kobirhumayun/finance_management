// File: src/components/features/support/ticket-status-badge.jsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_VARIANTS = {
  open: "secondary",
  pending: "outline",
  resolved: "default",
  closed: "destructive",
};

export function TicketStatusBadge({ status, className }) {
  const normalized = (status || "").toLowerCase();
  const label = STATUS_LABELS[normalized] || status || "Unknown";
  const variant = STATUS_VARIANTS[normalized] || "outline";

  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {label}
    </Badge>
  );
}

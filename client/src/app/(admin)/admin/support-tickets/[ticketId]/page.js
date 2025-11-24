// File: src/app/(admin)/admin/support-tickets/[ticketId]/page.js
"use client";

import TicketDetailPage from "@/components/features/support/ticket-detail-page";

export default function AdminTicketDetailPage() {
  return <TicketDetailPage backHref="/admin/support-tickets" />;
}


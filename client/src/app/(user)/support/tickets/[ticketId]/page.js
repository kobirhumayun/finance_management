// File: src/app/(user)/support/tickets/[ticketId]/page.js
"use client";

import TicketDetailPage from "@/components/features/support/ticket-detail-page";

export default function UserTicketDetailPage() {
  return <TicketDetailPage backHref="/support/tickets" />;
}


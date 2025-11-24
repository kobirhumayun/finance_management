// File: src/app/(admin)/admin/support-tickets/page.js
"use client";

import TicketListPage from "@/components/features/support/ticket-list-page";

export default function AdminSupportTicketsPage() {
  return (
    <TicketListPage
      title="Support Tickets"
      description="Monitor and manage all customer support requests."
      ticketLinkPrefix="/admin/support-tickets"
      createLink="/support/tickets/new"
    />
  );
}


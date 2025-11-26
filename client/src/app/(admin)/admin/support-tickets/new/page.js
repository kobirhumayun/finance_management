// File: src/app/(admin)/admin/support-tickets/new/page.js
"use client";

import TicketCreateForm from "@/components/features/support/ticket-create-form";

export default function AdminNewTicketPage() {
  return (
    <TicketCreateForm
      pageTitle="Create a support ticket"
      pageDescription="Open a ticket on behalf of a customer or team member."
      successRedirectBase="/admin/support-tickets"
      cancelHref="/admin/support-tickets"
      showRequesterSelector
    />
  );
}

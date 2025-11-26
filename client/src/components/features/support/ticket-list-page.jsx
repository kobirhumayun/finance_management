// File: src/components/features/support/ticket-list-page.jsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare, Paperclip, Plus } from "lucide-react";
import PageHeader from "@/components/shared/page-header";
import { TicketStatusBadge } from "@/components/features/support/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { qk } from "@/lib/query-keys";
import { fetchTickets } from "@/lib/queries/tickets";
import { formatDate } from "@/lib/formatters";

const PAGE_SIZE = 10;
const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];
const priorityOptions = [
  { label: "All priorities", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

function TicketListItem({ ticket, ticketLinkPrefix }) {
  const attachmentCount =
    typeof ticket.attachmentsCount === "number"
      ? ticket.attachmentsCount
      : ticket.attachments?.length || 0;

  return (
    <Link
      href={`${ticketLinkPrefix}/${ticket.id}`}
      className="block rounded-lg border bg-card p-4 transition hover:border-primary/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold leading-tight text-foreground line-clamp-1">{ticket.subject}</p>
            <TicketStatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description || "No description provided."}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium capitalize">Priority: {ticket.priority}</span>
            {ticket.category ? <span>Category: {ticket.category}</span> : null}
            <span>Updated {formatDate(ticket.updatedAt)}</span>
            {attachmentCount ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TicketListPage({
  title = "Support tickets",
  description = "View and track support requests.",
  ticketLinkPrefix = "/support/tickets",
  createLink = "/support/tickets/new",
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      status: status !== "all" ? status : undefined,
      priority: priority !== "all" ? priority : undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [search, status, priority, page],
  );

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: qk.tickets.list(filters),
    queryFn: ({ signal }) => fetchTickets({ ...filters, signal }),
    keepPreviousData: true,
  });

  const tickets = data?.tickets ?? [];
  const pagination = data?.pagination ?? { page, totalPages: 1 };
  const isInitialLoading = isLoading && !data;

  const handleNextPage = () => {
    if (pagination.page >= (pagination.totalPages || 1)) return;
    setPage((prev) => prev + 1);
  };

  const handlePreviousPage = () => {
    if (pagination.page <= 1) return;
    setPage((prev) => Math.max(1, prev - 1));
  };

  const showEmptyState = !isInitialLoading && tickets.length === 0 && !isError;

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        description={description}
        actions={
          createLink ? (
            <Button asChild>
              <Link href={createLink} className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New ticket
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ticket-search">Search</Label>
            <div className="relative">
              <Input
                id="ticket-search"
                placeholder="Search by subject"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
              <MessageSquare className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger id="ticket-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => {
                setPriority(value);
                setPage(1);
              }}
            >
              <SelectTrigger id="ticket-priority">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isError ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-destructive">Unable to load tickets right now.</p>
            </CardContent>
          </Card>
        ) : null}

        {isInitialLoading ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tickets...
            </CardContent>
          </Card>
        ) : null}

        {tickets.map((ticket) => (
          <TicketListItem key={ticket.id} ticket={ticket} ticketLinkPrefix={ticketLinkPrefix} />
        ))}

        {showEmptyState ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">No tickets found. Adjust your filters to see more.</p>
            </CardContent>
          </Card>
        ) : null}

        {tickets.length > 0 ? (
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handlePreviousPage} disabled={pagination.page <= 1 || isFetching}>
              Previous
            </Button>
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages || 1}
            </p>
            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={pagination.page >= (pagination.totalPages || 1) || isFetching}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


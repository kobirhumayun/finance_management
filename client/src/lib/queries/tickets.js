// File: src/lib/queries/tickets.js
import { apiJSON } from "@/lib/api";

const TICKETS_ENDPOINT = "/api/tickets";

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const normalizeAttachment = (attachment) => {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  return {
    id: attachment._id || attachment.id || null,
    filename: attachment.filename || "Attachment",
    url: attachment.url || "",
    mimeType: attachment.mimeType || attachment.contentType || "",
    contentType: attachment.contentType || "",
    size: typeof attachment.size === "number" ? attachment.size : null,
    width: typeof attachment.width === "number" ? attachment.width : null,
    height: typeof attachment.height === "number" ? attachment.height : null,
    uploadedAt: attachment.uploadedAt || attachment.createdAt || null,
    uploadedBy: attachment.uploadedBy || null,
  };
};

const normalizeActivity = (activity) => {
  if (!activity || typeof activity !== "object") {
    return null;
  }

  return {
    actor: activity.actor || null,
    action: activity.action || "comment",
    message: activity.message || "",
    at: activity.at || activity.createdAt || null,
  };
};

const normalizeTicket = (ticket) => {
  if (!ticket || typeof ticket !== "object") {
    return null;
  }

  return {
    id: ticket._id || ticket.id || null,
    subject: ticket.subject || "(no subject)",
    description: ticket.description || "",
    category: ticket.category || "",
    priority: ticket.priority || "medium",
    status: ticket.status || "open",
    requester: ticket.requester || null,
    assignee: ticket.assignee || null,
    createdAt: ticket.createdAt || null,
    updatedAt: ticket.updatedAt || null,
    attachments: Array.isArray(ticket.attachments)
      ? ticket.attachments.map(normalizeAttachment).filter(Boolean)
      : [],
    activityLog: Array.isArray(ticket.activityLog)
      ? ticket.activityLog.map(normalizeActivity).filter(Boolean)
      : [],
  };
};

export async function fetchTickets({ status, priority, category, search, page, limit, signal } = {}) {
  const queryString = buildQueryString({ status, priority, category, search, page, limit });
  const response = await apiJSON(`${TICKETS_ENDPOINT}${queryString}`, { method: "GET", signal });

  const tickets = Array.isArray(response?.tickets)
    ? response.tickets.map(normalizeTicket).filter(Boolean)
    : [];

  const pagination = {
    page: response?.pagination?.page ?? (Number(page) || 1),
    limit: response?.pagination?.limit ?? (Number(limit) || 10),
    total: response?.pagination?.total ?? tickets.length,
    totalPages: response?.pagination?.totalPages ?? 1,
  };

  const attachmentLimitBytes =
    typeof response?.attachmentLimitBytes === "number" ? response.attachmentLimitBytes : null;

  return { tickets, pagination, attachmentLimitBytes };
}

export async function fetchTicketDetail({ ticketId, signal }) {
  if (!ticketId) {
    throw new Error("ticketId is required to fetch ticket details");
  }

  const response = await apiJSON(`${TICKETS_ENDPOINT}/${ticketId}`, { method: "GET", signal });
  const ticket = normalizeTicket(response?.ticket);
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  const attachmentLimitBytes =
    typeof response?.attachmentLimitBytes === "number" ? response.attachmentLimitBytes : null;
  return { ticket, attachmentLimitBytes };
}

export async function createTicket(input, { signal } = {}) {
  const body = {
    subject: input?.subject?.trim() || "",
    description: input?.description?.trim() || "",
    category: input?.category?.trim() || undefined,
    priority: input?.priority || undefined,
  };

  const response = await apiJSON(TICKETS_ENDPOINT, { method: "POST", body, signal });
  return { ticket: normalizeTicket(response?.ticket) };
}

export async function addTicketComment({ ticketId, comment }, { signal } = {}) {
  if (!ticketId) {
    throw new Error("ticketId is required to comment on a ticket");
  }
  const body = { comment: comment?.toString() || "" };
  const response = await apiJSON(`${TICKETS_ENDPOINT}/${ticketId}/comments`, { method: "POST", body, signal });
  return { ticket: normalizeTicket(response?.ticket) };
}

export async function updateTicketStatus({ ticketId, status }, { signal } = {}) {
  if (!ticketId) {
    throw new Error("ticketId is required to update status");
  }
  const body = { status };
  const response = await apiJSON(`${TICKETS_ENDPOINT}/${ticketId}/status`, { method: "PATCH", body, signal });
  return { ticket: normalizeTicket(response?.ticket) };
}

export async function uploadTicketAttachment({ ticketId, file }, { signal } = {}) {
  if (!ticketId) {
    throw new Error("ticketId is required to upload an attachment");
  }
  if (!file) {
    throw new Error("file is required to upload an attachment");
  }

  const formData = new FormData();
  formData.append("attachment", file);

  const response = await apiJSON(`${TICKETS_ENDPOINT}/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
    signal,
  });
  return { attachment: normalizeAttachment(response?.attachment) };
}

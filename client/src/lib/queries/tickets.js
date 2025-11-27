// File: src/lib/queries/tickets.js
import { apiJSON } from "@/lib/api";

const TICKETS_ENDPOINT = "/api/tickets";

const normalizeUserLookup = (users) => {
  if (!users || typeof users !== "object") {
    return {};
  }

  return Object.entries(users).reduce((lookup, [key, user]) => {
    const id = user?.id || key;
    if (!id) return lookup;

    lookup[id] = {
      id,
      displayName: user?.displayName || user?.name || user?.username || "",
      email: user?.email || "",
      role: user?.role || "",
    };
    return lookup;
  }, {});
};

const resolveUserDetails = (userId, users = {}) => {
  if (!userId) return null;
  const id = typeof userId === "object" && userId.id ? userId.id : userId;
  return users[id] || null;
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const normalizeAttachment = (attachment, users) => {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  const uploadedBy =
    typeof attachment.uploadedBy === "object" && attachment.uploadedBy !== null
      ? attachment.uploadedBy.id || attachment.uploadedBy._id || attachment.uploadedBy
      : attachment.uploadedBy || null;
  const uploaderDetails = resolveUserDetails(uploadedBy, users);

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
    uploadedBy,
    uploadedByName: uploaderDetails?.displayName || null,
    uploadedByDetails: uploaderDetails,
  };
};

const normalizeActivity = (activity, users) => {
  if (!activity || typeof activity !== "object") {
    return null;
  }

  const actor =
    typeof activity.actor === "object" && activity.actor !== null
      ? activity.actor.id || activity.actor._id || activity.actor
      : activity.actor;
  const actorDetails = resolveUserDetails(actor, users);

  const attachments = Array.isArray(activity.attachments)
    ? activity.attachments.map((item) => normalizeAttachment(item, users)).filter(Boolean)
    : [];

  return {
    actor: actor || null,
    actorName: actorDetails?.displayName || null,
    actorDetails,
    action: activity.action || "comment",
    message: activity.message || "",
    at: activity.at || activity.createdAt || null,
    attachments,
  };
};

const normalizeTicket = (ticket, users = {}) => {
  if (!ticket || typeof ticket !== "object") {
    return null;
  }

  const requester = ticket.requester || null;
  const assignee = ticket.assignee || null;
  const requesterDetails = resolveUserDetails(requester, users);
  const assigneeDetails = resolveUserDetails(assignee, users);

  const attachmentCount =
    typeof ticket.attachmentCount === "number"
      ? ticket.attachmentCount
      : Array.isArray(ticket.attachments)
        ? ticket.attachments.length
        : 0;

  return {
    id: ticket._id || ticket.id || null,
    subject: ticket.subject || "(no subject)",
    description: ticket.description || "",
    category: ticket.category || "",
    priority: ticket.priority || "medium",
    status: ticket.status || "open",
    requester,
    requesterName: requesterDetails?.displayName || null,
    assignee,
    assigneeName: assigneeDetails?.displayName || null,
    createdAt: ticket.createdAt || null,
    updatedAt: ticket.updatedAt || null,
    attachmentCount,
    attachments: Array.isArray(ticket.attachments)
      ? ticket.attachments.map((attachment) => normalizeAttachment(attachment, users)).filter(Boolean)
      : [],
    activityLog: Array.isArray(ticket.activityLog)
      ? ticket.activityLog.map((entry) => normalizeActivity(entry, users)).filter(Boolean)
      : [],
    users,
  };
};

export async function fetchTickets({ status, priority, category, search, page, limit, signal } = {}) {
  const queryString = buildQueryString({ status, priority, category, search, page, limit });
  const response = await apiJSON(`${TICKETS_ENDPOINT}${queryString}`, { method: "GET", signal });

  const users = normalizeUserLookup(response?.users);

  const tickets = Array.isArray(response?.tickets)
    ? response.tickets.map((ticket) => normalizeTicket(ticket, users)).filter(Boolean)
    : [];

  const pagination = {
    page: response?.pagination?.page ?? (Number(page) || 1),
    limit: response?.pagination?.limit ?? (Number(limit) || 10),
    total: response?.pagination?.total ?? tickets.length,
    totalPages: response?.pagination?.totalPages ?? 1,
  };

  const attachmentLimitBytes =
    typeof response?.attachmentLimitBytes === "number" ? response.attachmentLimitBytes : null;

  return { tickets, pagination, attachmentLimitBytes, users };
}

export async function fetchTicketDetail({ ticketId, signal }) {
  if (!ticketId) {
    throw new Error("ticketId is required to fetch ticket details");
  }

  const response = await apiJSON(`${TICKETS_ENDPOINT}/${ticketId}`, { method: "GET", signal });
  const users = normalizeUserLookup(response?.users);
  const ticket = normalizeTicket(response?.ticket, users);
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  const attachmentLimitBytes =
    typeof response?.attachmentLimitBytes === "number" ? response.attachmentLimitBytes : null;
  return { ticket, attachmentLimitBytes, users };
}

export async function createTicket(input, { signal } = {}) {
  const hasAttachments = Array.isArray(input?.attachments) && input.attachments.length > 0;
  const body = hasAttachments
    ? new FormData()
    : {
        subject: input?.subject?.trim() || "",
        description: input?.description?.trim() || "",
        category: input?.category?.trim() || undefined,
        priority: input?.priority || undefined,
        requester: input?.requester || undefined,
      };

  if (hasAttachments) {
    body.append("subject", input?.subject?.trim() || "");
    body.append("description", input?.description?.trim() || "");
    if (input?.category) body.append("category", input.category.trim());
    if (input?.priority) body.append("priority", input.priority);
    if (input?.requester) body.append("requester", input.requester);
    input.attachments.forEach((file) => body.append("attachments", file));
  }

  const response = await apiJSON(TICKETS_ENDPOINT, { method: "POST", body, signal });
  const users = normalizeUserLookup(response?.users);
  return { ticket: normalizeTicket(response?.ticket, users), users };
}

export async function addTicketComment({ ticketId, comment, attachments }, { signal } = {}) {
  if (!ticketId) {
    throw new Error("ticketId is required to comment on a ticket");
  }
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const body = hasAttachments ? new FormData() : { comment: comment?.toString() || "" };

  if (hasAttachments) {
    body.append("comment", comment?.toString() || "");
    attachments.forEach((file) => body.append("attachments", file));
  }

  const response = await apiJSON(`${TICKETS_ENDPOINT}/${ticketId}/comments`, {
    method: "POST",
    body,
    signal,
  });
  const users = normalizeUserLookup(response?.users);
  return { ticket: normalizeTicket(response?.ticket, users), users };
}

export async function updateTicketStatus({ ticketId, status }, { signal } = {}) {
  if (!ticketId) {
    throw new Error("ticketId is required to update status");
  }
  const body = { status };
  const response = await apiJSON(`${TICKETS_ENDPOINT}/${ticketId}/status`, { method: "PATCH", body, signal });
  const users = normalizeUserLookup(response?.users);
  return { ticket: normalizeTicket(response?.ticket, users), users };
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
  const users = normalizeUserLookup(response?.users);
  return { attachment: normalizeAttachment(response?.attachment, users), users };
}

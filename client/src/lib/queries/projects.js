// File: src/lib/queries/projects.js
import { apiJSON } from "@/lib/api";

const PROJECTS_ENDPOINT = "/api/projects";

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const normalizeProject = (project) => {
  if (!project || typeof project !== "object") {
    return null;
  }

  return {
    id: project.id ?? "",
    name: project.name ?? "",
    description: project.description ?? "",
    currency: project.currency ?? "",
    createdAt: project.createdAt ?? null,
    updatedAt: project.updatedAt ?? null,
  };
};

const normalizeTransaction = (transaction) => {
  if (!transaction || typeof transaction !== "object") {
    return null;
  }

  return {
    id: transaction.id ?? "",
    projectId: transaction.projectId ?? "",
    date: transaction.date ?? null,
    type: transaction.type ?? "Expense",
    amount: transaction.amount ?? 0,
    subcategory: transaction.subcategory ?? "",
    description: transaction.description ?? "",
    createdAt: transaction.createdAt ?? null,
    updatedAt: transaction.updatedAt ?? null,
  };
};

const mapProjectInput = (input = {}) => ({
  name: input.name?.trim() ?? "",
  description: input.description?.trim() ?? "",
  currency: input.currency?.trim() ?? undefined,
});

const mapTransactionInput = (input = {}) => ({
  date: input.date,
  type: input.type,
  amount: input.amount,
  subcategory: input.subcategory?.trim() ?? "",
  description: input.description?.trim() ?? "",
});

export async function listProjects({ search, sort, limit, cursor, signal } = {}) {
  const queryString = buildQueryString({ search, sort, limit, cursor });
  const response = await apiJSON(`${PROJECTS_ENDPOINT}${queryString}`, { method: "GET", signal });

  const projects = Array.isArray(response?.projects)
    ? response.projects.map(normalizeProject).filter(Boolean)
    : [];

  const pageInfo = {
    hasNextPage: Boolean(response?.pageInfo?.hasNextPage),
    nextCursor: response?.pageInfo?.nextCursor ?? null,
    limit: response?.pageInfo?.limit ?? limit ?? 20,
  };

  const totalCount = typeof response?.totalCount === "number" ? response.totalCount : projects.length;

  return { projects, pageInfo, totalCount };
}

export async function listProjectTransactions({
  projectId,
  search,
  sort,
  limit,
  cursor,
  signal,
} = {}) {
  if (!projectId) {
    throw new Error("projectId is required to load transactions");
  }

  const queryString = buildQueryString({ search, sort, limit, cursor });
  const response = await apiJSON(`${PROJECTS_ENDPOINT}/${projectId}/transactions${queryString}`, {
    method: "GET",
    signal,
  });

  const transactions = Array.isArray(response?.transactions)
    ? response.transactions.map(normalizeTransaction).filter(Boolean)
    : [];

  const pageInfo = {
    hasNextPage: Boolean(response?.pageInfo?.hasNextPage),
    nextCursor: response?.pageInfo?.nextCursor ?? null,
    limit: response?.pageInfo?.limit ?? limit ?? 20,
  };

  const summary = {
    income: Number(response?.summary?.income) || 0,
    expense: Number(response?.summary?.expense) || 0,
    balance: Number(response?.summary?.balance) || 0,
  };

  const project = response?.project ? normalizeProject(response.project) : null;

  return { project, transactions, summary, pageInfo };
}

export async function createProject(input, { signal } = {}) {
  const body = mapProjectInput(input);
  return apiJSON(PROJECTS_ENDPOINT, { method: "POST", body, signal });
}

export async function updateProject({ projectId, ...input }, { signal } = {}) {
  if (!projectId) {
    throw new Error("projectId is required to update a project");
  }
  const body = mapProjectInput(input);
  return apiJSON(`${PROJECTS_ENDPOINT}/${projectId}`, { method: "PUT", body, signal });
}

export async function deleteProject({ projectId }, { signal } = {}) {
  if (!projectId) {
    throw new Error("projectId is required to delete a project");
  }
  return apiJSON(`${PROJECTS_ENDPOINT}/${projectId}`, { method: "DELETE", signal });
}

export async function createTransaction({ projectId, ...input }, { signal } = {}) {
  if (!projectId) {
    throw new Error("projectId is required to create a transaction");
  }
  const body = mapTransactionInput(input);
  return apiJSON(`${PROJECTS_ENDPOINT}/${projectId}/transactions`, { method: "POST", body, signal });
}

export async function updateTransaction({ projectId, transactionId, ...input }, { signal } = {}) {
  if (!projectId || !transactionId) {
    throw new Error("projectId and transactionId are required to update a transaction");
  }
  const body = mapTransactionInput(input);
  return apiJSON(`${PROJECTS_ENDPOINT}/${projectId}/transactions/${transactionId}`, {
    method: "PUT",
    body,
    signal,
  });
}

export async function deleteTransaction({ projectId, transactionId }, { signal } = {}) {
  if (!projectId || !transactionId) {
    throw new Error("projectId and transactionId are required to delete a transaction");
  }
  return apiJSON(`${PROJECTS_ENDPOINT}/${projectId}/transactions/${transactionId}`, {
    method: "DELETE",
    signal,
  });
}

// File: src/lib/query-keys.js
const normalizeParams = (params) => {
  if (!params || typeof params !== "object") {
    return {};
  }

  return Object.keys(params)
    .filter((key) => params[key] !== undefined)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
};

export const qk = {
  orders: {
    list: (params) => ["orders", "list", params || {}],
    byId: (id) => ["orders", "byId", String(id)],
  },
  analytics: {
    summary: () => ["analytics", "summary"],
    slowReport: () => ["analytics", "slow-report"],
  },
  dashboard: {
    overview: () => ["dashboard", "overview"],
    summary: () => ["dashboard", "summary"],
    recentTransactions: () => ["dashboard", "recent-transactions"],
  },
  projects: {
    list: (params) => ["projects", "list", normalizeParams(params)],
    detail: (id, params) => ["projects", "detail", String(id), normalizeParams(params)],
  },
  reports: {
    filters: () => ["reports", "overview", "filters"],
    charts: (params) => ["reports", "overview", "charts", normalizeParams(params)],
    summaryFilters: () => ["reports", "summary", "filters"],
    summaryTable: (params) => ["reports", "summary-table", normalizeParams(params)],
  },
  plans: {
    all: () => ["plans", "all"],
    current: () => ["plans", "current"],
  },
  admin: {
    plans: () => ["admin", "plans"],
    orders: {
      root: () => ["admin", "orders"],
      list: (filters) => {
        const normalized = normalizeParams(filters);
        if (Object.keys(normalized).length === 0) {
          return ["admin", "orders", "list"];
        }
        return ["admin", "orders", "list", normalized];
      },
      summary: (filters) => {
        const normalized = normalizeParams(filters);
        if (Object.keys(normalized).length === 0) {
          return ["admin", "orders", "summary"];
        }
        return ["admin", "orders", "summary", normalized];
      },
      summaryByUser: (filters) => {
        const normalized = normalizeParams(filters);
        if (Object.keys(normalized).length === 0) {
          return ["admin", "orders", "summary", "by-user"];
        }
        return ["admin", "orders", "summary", "by-user", normalized];
      },
      paymentSummary: (filters) => {
        const normalized = normalizeParams(filters);
        if (Object.keys(normalized).length === 0) {
          return ["admin", "orders", "payments", "summary"];
        }
        return ["admin", "orders", "payments", "summary", normalized];
      },
      detail: (orderNumber) => [
        "admin",
        "orders",
        "detail",
        orderNumber ? String(orderNumber) : "unknown",
      ],
    },
    invoices: {
      root: () => ["admin", "invoices"],
      list: (filters) => {
        const normalized = normalizeParams(filters);
        if (Object.keys(normalized).length === 0) {
          return ["admin", "invoices", "list"];
        }
        return ["admin", "invoices", "list", normalized];
      },
      summary: (filters) => {
        const normalized = normalizeParams(filters);
        if (Object.keys(normalized).length === 0) {
          return ["admin", "invoices", "summary"];
        }
        return ["admin", "invoices", "summary", normalized];
      },
      detail: (invoiceNumber) => [
        "admin",
        "invoices",
        "detail",
        invoiceNumber ? String(invoiceNumber) : "unknown",
      ],
    },
    payments: (filters) => {
      if (!filters || (typeof filters === "object" && Object.keys(filters).length === 0)) {
        return ["admin", "payments"];
      }
      if (typeof filters === "string") {
        return ["admin", "payments", filters];
      }
      if (typeof filters === "object") {
        const normalized = Object.keys(filters)
          .sort()
          .reduce((acc, key) => {
            acc[key] = filters[key];
            return acc;
          }, {});
        return ["admin", "payments", normalized];
      }
      return ["admin", "payments", filters];
    },
    users: (filters) => {
      if (!filters || (typeof filters === "object" && Object.keys(filters).length === 0)) {
        return ["admin", "users"];
      }
      if (typeof filters === "string") {
        return ["admin", "users", filters];
      }
      if (typeof filters === "object") {
        const normalized = Object.keys(filters)
          .sort()
          .reduce((acc, key) => {
            const value = filters[key];
            if (value === undefined) return acc;
            acc[key] = value;
            return acc;
          }, {});
        if (Object.keys(normalized).length === 0) {
          return ["admin", "users"];
        }
        return ["admin", "users", normalized];
      }
      return ["admin", "users", filters];
    },
    userProfile: (id) => ["admin", "users", String(id)],
  },
};

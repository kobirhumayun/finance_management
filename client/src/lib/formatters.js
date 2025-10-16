const FALLBACK_DISPLAY = "--";

const toNumeric = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
};

export const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const numberFormatter = new Intl.NumberFormat("en-IN", {
  style: "decimal",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value, { fallback = FALLBACK_DISPLAY } = {}) => {
  const numericValue = toNumeric(value);
  if (numericValue === null) {
    return fallback;
  }

  return currencyFormatter.format(numericValue);
};

export const formatNumber = (value, { fallback = FALLBACK_DISPLAY } = {}) => {
  const numericValue = toNumeric(value);
  if (numericValue === null) {
    return fallback;
  }

  return numberFormatter.format(numericValue);
};

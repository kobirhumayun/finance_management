const FALLBACK_DISPLAY = "--";

const toNumeric = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (value && typeof value === "object") {
    if (typeof value.$numberDecimal === "string") {
      const numericValue = Number(value.$numberDecimal);
      return Number.isFinite(numericValue) ? numericValue : null;
    }

    if (typeof value.valueOf === "function") {
      const candidate = value.valueOf();
      if (typeof candidate === "number") {
        return Number.isFinite(candidate) ? candidate : null;
      }
      if (typeof candidate === "string" && candidate.trim() !== "") {
        const numericValue = Number(candidate);
        return Number.isFinite(numericValue) ? numericValue : null;
      }
    }
  }

  if (typeof value === "bigint") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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

export const currencySymbol =
  currencyFormatter
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value ?? "৳";

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

export const resolveNumericValue = (value) => toNumeric(value);

export const formatPlanAmount = (
  value,
  currency,
  { fallback = null, zeroLabel = "Free" } = {}
) => {
  const numericValue = toNumeric(value);

  if (numericValue === null) {
    if (fallback !== null && fallback !== undefined) {
      return fallback;
    }
    return formatNumber(value);
  }

  if (numericValue === 0) {
    return zeroLabel;
  }

  const normalizedCurrency =
    typeof currency === "string" ? currency.trim().toUpperCase() : "";

  if (!normalizedCurrency || normalizedCurrency === "BDT") {
    return currencyFormatter.format(numericValue);
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: normalizedCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch (error) {
    const formattedNumber = numberFormatter.format(numericValue);
    return normalizedCurrency
      ? `${normalizedCurrency} ${formattedNumber}`
      : formattedNumber;
  }
};

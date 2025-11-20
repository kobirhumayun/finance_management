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

const resolveNumberFormatOptions = (minimumFractionDigits) => {
  if (typeof minimumFractionDigits === "number" && !Number.isNaN(minimumFractionDigits)) {
    const normalizedMinimum = Math.max(0, minimumFractionDigits);
    return {
      style: "decimal",
      minimumFractionDigits: normalizedMinimum,
      maximumFractionDigits: Math.max(normalizedMinimum, 2),
    };
  }

  return {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
};

export const numberFormatter = ({ minimumFractionDigits } = {}) =>
  new Intl.NumberFormat("en-IN", resolveNumberFormatOptions(minimumFractionDigits));

const defaultNumberFormatter = numberFormatter();

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

export const formatNumber = (
  value,
  { fallback = FALLBACK_DISPLAY, minimumFractionDigits } = {}
) => {
  const numericValue = toNumeric(value);
  if (numericValue === null) {
    return fallback;
  }

  const formatter =
    typeof minimumFractionDigits === "number"
      ? numberFormatter({ minimumFractionDigits })
      : defaultNumberFormatter;

  return formatter.format(numericValue);
};

export const resolveNumericValue = (value) => toNumeric(value);

export const formatCurrencyWithCode = (
  value,
  currency,
  { fallback = FALLBACK_DISPLAY } = {}
) => {
  const numericValue = toNumeric(value);
  if (numericValue === null) {
    return fallback;
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
    const formattedNumber = defaultNumberFormatter.format(numericValue);
    return normalizedCurrency
      ? `${normalizedCurrency} ${formattedNumber}`
      : formattedNumber;
  }
};

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
    if (zeroLabel !== null && zeroLabel !== undefined) {
      return zeroLabel;
    }
    return formatCurrencyWithCode(0, currency, {
      fallback: fallback ?? FALLBACK_DISPLAY,
    });
  }

  return formatCurrencyWithCode(numericValue, currency, {
    fallback: fallback ?? FALLBACK_DISPLAY,
  });
};

export const formatDate = (value, { fallback = FALLBACK_DISPLAY } = {}) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    const isoLikeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLikeMatch) {
      const [, year, month, day] = isoLikeMatch;
      return `${day}-${month}-${year}`;
    }

    return trimmed || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  }

  return String(value);
};

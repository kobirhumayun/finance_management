// Utility helpers for coercing backend numeric payloads into safe JavaScript numbers.

function isCallable(value) {
  return typeof value === "function";
}

function isPlainObject(value) {
  return value !== null && typeof value === "object";
}

function extractBSONNumeric(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const decimal =
    value.$numberDecimal ?? value.$numberDouble ?? value.$numberInt ?? value.$numberLong ?? null;

  if (typeof decimal === "string" && decimal.trim().length > 0) {
    return decimal;
  }

  if (isCallable(value.toString) && value.toString !== Object.prototype.toString) {
    const stringified = value.toString();
    if (typeof stringified === "string" && stringified.trim().length > 0) {
      return stringified;
    }
  }

  return null;
}

export function toNumeric(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const extracted = extractBSONNumeric(value);
  if (extracted !== null) {
    const numeric = Number(extracted);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const fallback = Number(value);
  return Number.isFinite(fallback) ? fallback : 0;
}


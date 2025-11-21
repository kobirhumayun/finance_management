"use client";

import { useEffect, useRef, useState } from "react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { formatCurrency, formatCurrencyWithCode } from "@/lib/formatters";

const clamp = (value, min, max) => {
  if (Number.isNaN(value)) {
    return value;
  }
  return Math.min(Math.max(value, min), max);
};

export const formatStatusLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) return "Unknown";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return date.toLocaleString();
  }
};

export const formatDateOnly = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return date.toLocaleDateString();
  }
};

export const formatAmount = (amount, currency) => {
  if (amount == null) {
    return "—";
  }
  const fallback = formatCurrency(amount, { fallback: "—" });
  return formatCurrencyWithCode(amount, currency || "BDT", { fallback });
};

export function OrderDetailPopover({
  anchorElement,
  detail,
  isLoading,
  isError,
  selectedOrderNumber,
  onClose,
}) {
  const bodyRef = useRef(null);
  const lastMeasuredRectRef = useRef(null);
  const popoverSideRef = useRef("right");
  const [virtualAnchorRef, setVirtualAnchorRef] = useState({ current: null });
  const [popoverSide, setPopoverSide] = useState("right");
  const isOpen = Boolean(selectedOrderNumber && anchorElement);

  useEffect(() => {
    if (!isOpen && bodyRef.current) {
      bodyRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (anchorElement && !anchorElement.isConnected) {
      onClose?.();
    }
  }, [anchorElement, onClose]);

  useEffect(() => {
    if (!isOpen || !anchorElement) {
      setVirtualAnchorRef({ current: null });
      lastMeasuredRectRef.current = null;
      return;
    }

    if (typeof window === "undefined" || typeof anchorElement.getBoundingClientRect !== "function") {
      return;
    }

    const measure = () => {
      if (!anchorElement || typeof anchorElement.getBoundingClientRect !== "function") {
        return;
      }

      const rect = anchorElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || rect.right || 0;
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || rect.bottom || 0;
      const margin = 16;

      const availableRight = Math.max(0, viewportWidth - margin - rect.right);
      const availableLeft = Math.max(0, rect.left - margin);
      const prefersVertical = viewportWidth < 640;
      const nextSide = prefersVertical
        ? "bottom"
        : availableRight >= availableLeft
          ? "right"
          : "left";

      const anchorX = clamp(
        nextSide === "right"
          ? rect.right
          : nextSide === "left"
            ? rect.left
            : rect.left + rect.width / 2,
        margin,
        Math.max(margin, viewportWidth - margin),
      );
      const anchorY = clamp(
        nextSide === "bottom"
          ? rect.bottom
          : nextSide === "top"
            ? rect.top
            : rect.top + rect.height / 2,
        margin,
        Math.max(margin, viewportHeight - margin),
      );

      const sanitizedRect = {
        width: 0,
        height: 0,
        top: anchorY,
        bottom: anchorY,
        left: anchorX,
        right: anchorX,
        x: anchorX,
        y: anchorY,
      };

      const previousRect = lastMeasuredRectRef.current;
      const rectChanged =
        !previousRect ||
        ["top", "bottom", "left", "right", "x", "y"].some(
          (key) => previousRect[key] !== sanitizedRect[key],
        );
      const sideChanged = popoverSideRef.current !== nextSide;

      if (!rectChanged && !sideChanged) {
        return;
      }

      lastMeasuredRectRef.current = sanitizedRect;

      if (sideChanged) {
        popoverSideRef.current = nextSide;
        setPopoverSide(nextSide);
      }

      setVirtualAnchorRef({
        current: {
          getBoundingClientRect: () => sanitizedRect,
          contextElement: anchorElement,
        },
      });
    };

    let frameId;
    const scheduleMeasure = () => {
      if (frameId != null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    scheduleMeasure();

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(document.body);

    const scrollListener = () => scheduleMeasure();
    window.addEventListener("scroll", scrollListener, { passive: true });

    return () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scrollListener);
    };
  }, [anchorElement, isOpen]);

  let content;

  if (isLoading) {
    content = (
      <p className="text-sm text-muted-foreground">Loading order {selectedOrderNumber}…</p>
    );
  } else if (isError) {
    content = (
      <p className="text-sm text-destructive">Unable to load order {selectedOrderNumber}.</p>
    );
  } else if (!detail) {
    content = <p className="text-sm text-muted-foreground">No additional details available.</p>;
  } else {
    const metadataRows = [
      { key: "order-number", label: "Order number", value: detail.orderNumber ?? detail.id },
      { key: "status", label: "Order status", value: detail.statusLabel || formatStatusLabel(detail.status) },
      { key: "created", label: "Created", value: formatDateTime(detail.createdAt) },
      { key: "start", label: "Start", value: formatDateTime(detail.startDate) },
      { key: "end", label: "End", value: formatDateTime(detail.endDate) },
      { key: "renewal", label: "Renewal", value: formatDateTime(detail.renewalDate) },
      { key: "plan", label: "Plan", value: detail.planName || detail.planSlug || "—" },
      { key: "amount", label: "Order amount", value: formatAmount(detail.amount, detail.currency) },
    ];

    const customerRows = [
      { key: "customer", label: "Customer", value: detail.userName || "Unknown" },
      { key: "email", label: "Email", value: detail.userEmail || "—" },
      { key: "username", label: "Username", value: detail.username || "—" },
    ];

    const paymentRows = [
      {
        key: "payment-status",
        label: "Payment status",
        value: detail.paymentStatusLabel || formatStatusLabel(detail.paymentStatus),
      },
      { key: "gateway", label: "Gateway", value: detail.paymentGateway || "—" },
      { key: "reference", label: "Reference", value: detail.paymentReference || "—" },
      { key: "payment-amount", label: "Captured", value: formatAmount(detail.paymentAmount, detail.paymentCurrency) },
      {
        key: "payment-refunded",
        label: "Refunded",
        value: formatAmount(detail.paymentRefundedAmount, detail.paymentCurrency),
      },
      { key: "processed", label: "Processed", value: formatDateTime(detail.paymentProcessedAt || detail.paymentUpdatedAt) },
      { key: "purpose", label: "Purpose", value: detail.paymentPurpose || "—" },
    ];

    const invoiceRows = detail.invoiceNumber
      ? [
          { key: "invoice-number", label: "Invoice number", value: detail.invoiceNumber },
          {
            key: "invoice-status",
            label: "Invoice status",
            value: detail.invoiceStatusLabel || formatStatusLabel(detail.invoiceStatus),
          },
          { key: "invoice-amount", label: "Amount", value: formatAmount(detail.invoiceAmount, detail.invoiceCurrency) },
          { key: "invoice-issued", label: "Issued", value: formatDateTime(detail.invoiceIssuedDate) },
          { key: "invoice-due", label: "Due", value: formatDateTime(detail.invoiceDueDate) },
          {
            key: "invoice-subscription",
            label: "Subscription",
            value: `${formatDateOnly(detail.invoiceSubscriptionStart)} → ${formatDateOnly(detail.invoiceSubscriptionEnd)}`,
          },
        ]
      : [];

    const renderRows = (rows) => (
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-right">{row.value}</span>
          </div>
        ))}
      </div>
    );

    content = (
      <div className="space-y-4 text-sm">
        <section aria-labelledby="order-detail-metadata" className="space-y-2">
          <h3 id="order-detail-metadata" className="text-sm font-semibold text-muted-foreground">
            Order metadata
          </h3>
          {renderRows(metadataRows)}
        </section>
        <section aria-labelledby="order-detail-customer" className="space-y-2">
          <h3 id="order-detail-customer" className="text-sm font-semibold text-muted-foreground">
            Customer
          </h3>
          {renderRows(customerRows)}
        </section>
        <section aria-labelledby="order-detail-payment" className="space-y-2">
          <h3 id="order-detail-payment" className="text-sm font-semibold text-muted-foreground">
            Payment
          </h3>
          {renderRows(paymentRows)}
        </section>
        {invoiceRows.length ? (
          <section aria-labelledby="order-detail-invoice" className="space-y-2">
            <h3 id="order-detail-invoice" className="text-sm font-semibold text-muted-foreground">
              Invoice
            </h3>
            {renderRows(invoiceRows)}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <PopoverAnchor virtualRef={virtualAnchorRef} />
      <PopoverContent
        align={popoverSide === "bottom" ? "center" : "start"}
        side={popoverSide}
        sideOffset={12}
        collisionPadding={16}
        className="z-50 w-[28rem] max-h-[calc(100vh-4rem)] max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto p-0 shadow-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          bodyRef.current?.focus();
        }}
      >
        <div ref={bodyRef} tabIndex={-1} className="flex flex-col gap-4 p-4 focus:outline-none">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Order detail</h2>
            <p className="text-sm text-muted-foreground">
              Reference information for order {selectedOrderNumber}.
            </p>
          </div>
          {content}
        </div>
      </PopoverContent>
    </Popover>
  );
}

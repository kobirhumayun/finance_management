"use client";

export function ChartLoadingOverlay({ label, color }) {
  const spinnerColor = color || "var(--ring)";

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 text-sm text-muted-foreground backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        style={{
          borderTopColor: "transparent",
          borderRightColor: spinnerColor,
          borderBottomColor: spinnerColor,
          borderLeftColor: spinnerColor,
        }}
        aria-hidden
      />
      <span className="font-medium text-foreground">{label}</span>
    </div>
  );
}

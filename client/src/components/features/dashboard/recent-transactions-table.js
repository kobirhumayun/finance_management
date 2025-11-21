"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";

// Small table summarizing the latest transactions across projects.
export default function RecentTransactionsTable({ transactions = [], isLoading }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!transactions.length) {
    return <p className="text-sm text-muted-foreground">No recent transactions available.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:hidden">
        {transactions.map((transaction) => {
          const projectLabel = transaction.projectName || transaction.projectId || "—";
          const dateLabel = formatDate(transaction.date, { fallback: "—" });

          let parsedAmount = null;
          if (typeof transaction.amount === "number" && Number.isFinite(transaction.amount)) {
            parsedAmount = transaction.amount;
          } else if (typeof transaction.amount === "string" && transaction.amount.trim() !== "") {
            const numericValue = Number(transaction.amount);
            if (Number.isFinite(numericValue)) {
              parsedAmount = numericValue;
            }
          }

          const isExpense = transaction.type === "Expense";
          const formattedAmount =
            parsedAmount === null
              ? formatCurrency(null)
              : `${isExpense ? "-" : "+"}${formatCurrency(Math.abs(parsedAmount))}`;

          return (
            <div key={transaction.id} className="space-y-3 rounded-lg border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{projectLabel}</p>
                  <p className="text-xs text-muted-foreground">{dateLabel}</p>
                </div>
                <Badge variant={isExpense ? "destructive" : "secondary"} className="shrink-0">
                  {transaction.type}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span
                  className={
                    isExpense
                      ? "text-sm font-semibold text-rose-600"
                      : "text-sm font-semibold text-emerald-600"
                  }
                >
                  {formattedAmount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const projectLabel = transaction.projectName || transaction.projectId || "—";
              const dateLabel = formatDate(transaction.date, { fallback: "—" });

              let parsedAmount = null;
              if (typeof transaction.amount === "number" && Number.isFinite(transaction.amount)) {
                parsedAmount = transaction.amount;
              } else if (typeof transaction.amount === "string" && transaction.amount.trim() !== "") {
                const numericValue = Number(transaction.amount);
                if (Number.isFinite(numericValue)) {
                  parsedAmount = numericValue;
                }
              }

              const isExpense = transaction.type === "Expense";
              const formattedAmount =
                parsedAmount === null
                  ? formatCurrency(null)
                  : `${isExpense ? "-" : "+"}${formatCurrency(Math.abs(parsedAmount))}`;
              return (
                <TableRow key={transaction.id}>
                  <TableCell>{dateLabel}</TableCell>
                  <TableCell>{projectLabel}</TableCell>
                  <TableCell>{transaction.type}</TableCell>
                  <TableCell className="text-right font-medium">{formattedAmount}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

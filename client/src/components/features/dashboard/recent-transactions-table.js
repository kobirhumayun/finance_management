"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

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
    <div className="rounded-lg border">
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
                <TableCell>{transaction.date}</TableCell>
                <TableCell>{projectLabel}</TableCell>
                <TableCell>{transaction.type}</TableCell>
                <TableCell className="text-right font-medium">{formattedAmount}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

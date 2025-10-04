// File: src/components/features/dashboard/recent-transactions-table.js
"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
            const formattedAmount = `${transaction.type === "Expense" ? "-" : "+"}$${transaction.amount.toLocaleString()}`;
            return (
              <TableRow key={transaction.id}>
                <TableCell>{transaction.date}</TableCell>
                <TableCell>{transaction.projectId}</TableCell>
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

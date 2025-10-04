// File: src/components/features/projects/transaction-table.js
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Responsive table displaying transactions for the currently selected project.
export default function TransactionTable({
  project,
  transactions = [],
  isLoading,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const getTimestamp = (value) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return transactions
      .filter((transaction) => {
        const description = typeof transaction?.description === "string" ? transaction.description : "";
        const subcategory = typeof transaction?.subcategory === "string" ? transaction.subcategory : "";
        return `${description} ${subcategory}`.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aTime = getTimestamp(a?.date);
        const bTime = getTimestamp(b?.date);
        return sort === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [transactions, search, sort]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Transactions</h2>
          <p className="text-xs text-muted-foreground">{project ? `Showing activity for ${project.name}` : "Select a project to begin."}</p>
        </div>
        <Button onClick={onAddTransaction} size="sm" className="hidden md:inline-flex">
          Add Transaction
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="transaction-search" className="text-xs uppercase tracking-wide text-muted-foreground">
            Search
          </Label>
          <Input
            id="transaction-search"
            placeholder="Search by description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sort by</Label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger>
              <SelectValue placeholder="Sort transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="hidden flex-1 flex-col overflow-hidden rounded-lg border md:flex">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : filteredTransactions.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Subcategory</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction, index) => {
                const transactionId = transaction?.id ?? `transaction-${index}`;
                const amountValue = Number.isFinite(Number(transaction?.amount)) ? Number(transaction.amount) : 0;
                const formattedAmount = `${transaction?.type === "Expense" ? "-" : "+"}$${amountValue.toLocaleString()}`;
                const transactionType = transaction?.type === "Income" ? "Income" : "Expense";
                const description =
                  typeof transaction?.description === "string" && transaction.description.trim().length
                    ? transaction.description
                    : "No description provided.";
                const subcategory =
                  typeof transaction?.subcategory === "string" && transaction.subcategory.trim().length
                    ? transaction.subcategory
                    : "Uncategorized";
                const dateLabel = transaction?.date || "—";
                return (
                  <TableRow key={transactionId}>
                    <TableCell>{dateLabel}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        transactionType === "Income" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      )}>
                        {transactionType}
                      </span>
                    </TableCell>
                    <TableCell>{description}</TableCell>
                    <TableCell>{subcategory}</TableCell>
                    <TableCell className="text-right font-medium">{formattedAmount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => transaction?.id && onEditTransaction?.(transaction)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => transaction?.id && onDeleteTransaction?.(transaction)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            No transactions logged yet.
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 md:hidden">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : filteredTransactions.length ? (
          filteredTransactions.map((transaction, index) => {
            const transactionId = transaction?.id ?? `transaction-${index}`;
            const amountValue = Number.isFinite(Number(transaction?.amount)) ? Number(transaction.amount) : 0;
            const formattedAmount = `${transaction?.type === "Expense" ? "-" : "+"}$${amountValue.toLocaleString()}`;
            const transactionType = transaction?.type === "Income" ? "Income" : "Expense";
            const description =
              typeof transaction?.description === "string" && transaction.description.trim().length
                ? transaction.description
                : "No description provided.";
            const subcategory =
              typeof transaction?.subcategory === "string" && transaction.subcategory.trim().length
                ? transaction.subcategory
                : "Uncategorized";
            const dateLabel = transaction?.date || "—";
            return (
              <div key={transactionId} className="rounded-lg border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{description}</p>
                    <p className="text-xs text-muted-foreground">{dateLabel}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-1 text-xs font-semibold",
                    transactionType === "Income" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                  )}>
                    {transactionType}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{subcategory}</span>
                  <span className="font-semibold">{formattedAmount}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => transaction?.id && onEditTransaction?.(transaction)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => transaction?.id && onDeleteTransaction?.(transaction)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No transactions logged yet.
          </div>
        )}
      </div>

      <div className="sticky bottom-4 md:hidden">
        <Button className="h-12 w-full" size="lg" onClick={onAddTransaction}>
          Add Transaction
        </Button>
      </div>
    </div>
  );
}

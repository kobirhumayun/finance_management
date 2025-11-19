// File: src/components/features/projects/transaction-table.js
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import TransactionAttachmentDialog from "@/components/features/projects/transaction-attachment-dialog";

// Responsive table displaying transactions for the currently selected project.
export default function TransactionTable({
  project,
  transactions = [],
  isLoading,
  isLoadingMore,
  hasNextPage,
  onLoadMore,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  searchValue = "",
  onSearchChange,
  sortValue = "newest",
  onSortChange,
  attachmentsAllowed = true,
}) {
  const displayTransactions = Array.isArray(transactions) ? transactions : [];
  const [attachmentDialogState, setAttachmentDialogState] = useState({ open: false, transaction: null });
  const attachmentsFeatureEnabled = attachmentsAllowed !== false;

  const handleSearchChange = (event) => {
    onSearchChange?.(event.target.value);
  };

  const handleSortChange = (value) => {
    onSortChange?.(value);
  };

  const openAttachmentDialog = (transaction) => {
    if (!attachmentsFeatureEnabled || !transaction?.attachment) return;
    setAttachmentDialogState({ open: true, transaction });
  };

  const closeAttachmentDialog = () => {
    setAttachmentDialogState({ open: false, transaction: null });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Transactions</h2>
          <p className="text-xs text-muted-foreground">{project ? `Showing activity for ${project.name}` : "Select a project to begin."}</p>
        </div>
        <Button onClick={onAddTransaction} size="sm" className="hidden md:inline-flex" disabled={!project}>
          Add Transaction
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="transaction-search" className="text-xs uppercase tracking-wide text-muted-foreground">
            Search transactions
          </Label>
          <Input
            id="transaction-search"
            placeholder="Search by description or subcategory"
            value={searchValue}
            onChange={handleSearchChange}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sort by</Label>
          <Select value={sortValue} onValueChange={handleSortChange}>
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
        ) : displayTransactions.length ? (
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
              {displayTransactions.map((transaction, index) => {
                const transactionId = transaction?.id ?? `transaction-${index}`;

                let parsedAmount = null;
                if (typeof transaction?.amount === "number" && Number.isFinite(transaction.amount)) {
                  parsedAmount = transaction.amount;
                } else if (typeof transaction?.amount === "string" && transaction.amount.trim() !== "") {
                  const numericValue = Number(transaction.amount);
                  if (Number.isFinite(numericValue)) {
                    parsedAmount = numericValue;
                  }
                }

                const normalizedType = typeof transaction?.type === "string" ? transaction.type.toLowerCase() : "";
                const isExpense = normalizedType === "expense";
                const transactionType = normalizedType === "income" ? "Income" : "Expense";
                const formattedAmount =
                  parsedAmount === null
                    ? formatCurrency(null)
                    : `${isExpense ? "-" : "+"}${formatCurrency(Math.abs(parsedAmount))}`;
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
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => openAttachmentDialog(transaction)}
                          disabled={!attachmentsFeatureEnabled || !transaction?.attachment}
                        >
                          {transaction?.attachment?.isPending ? "Processing..." : "View image"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => transaction?.id && onEditTransaction?.(transaction)}
                          disabled={!transaction?.id}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => transaction?.id && onDeleteTransaction?.(transaction)}
                          disabled={!transaction?.id}
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
        ) : displayTransactions.length ? (
          displayTransactions.map((transaction, index) => {
            const transactionId = transaction?.id ?? `transaction-${index}`;

            let parsedAmount = null;
            if (typeof transaction?.amount === "number" && Number.isFinite(transaction.amount)) {
              parsedAmount = transaction.amount;
            } else if (typeof transaction?.amount === "string" && transaction.amount.trim() !== "") {
              const numericValue = Number(transaction.amount);
              if (Number.isFinite(numericValue)) {
                parsedAmount = numericValue;
              }
            }

            const normalizedType = typeof transaction?.type === "string" ? transaction.type.toLowerCase() : "";
            const isExpense = normalizedType === "expense";
            const transactionType = normalizedType === "income" ? "Income" : "Expense";
            const formattedAmount =
              parsedAmount === null
                ? formatCurrency(null)
                : `${isExpense ? "-" : "+"}${formatCurrency(Math.abs(parsedAmount))}`;
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
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="col-span-2"
                    onClick={() => openAttachmentDialog(transaction)}
                    disabled={!attachmentsFeatureEnabled || !transaction?.attachment}
                  >
                    {transaction?.attachment?.isPending ? "Processing attachment" : "View image"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => transaction?.id && onEditTransaction?.(transaction)}
                    disabled={!transaction?.id}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => transaction?.id && onDeleteTransaction?.(transaction)}
                    disabled={!transaction?.id}
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
        <Button className="h-12 w-full" size="lg" onClick={onAddTransaction} disabled={!project}>
          Add Transaction
        </Button>
      </div>
      {hasNextPage && (
        <div className="md:mt-2">
          <Button
            variant="outline"
            className="h-11 w-full md:w-auto"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
      <TransactionAttachmentDialog
        open={attachmentDialogState.open}
        transaction={attachmentDialogState.transaction}
        onOpenChange={(open) => {
          if (!open) {
            closeAttachmentDialog();
          } else {
            setAttachmentDialogState((prev) => ({ ...prev, open: true }));
          }
        }}
      />
    </div>
  );
}

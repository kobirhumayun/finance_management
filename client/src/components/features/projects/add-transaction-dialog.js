// File: src/components/features/projects/add-transaction-dialog.js
"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  type: z.enum(["income", "expense"], { required_error: "Choose a transaction type" }),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  subcategory: z.string().min(2, "Subcategory is required"),
  description: z.string().min(3, "Provide a short description"),
});

// Dialog used to capture transaction details.
export default function AddTransactionDialog({ open, onOpenChange, onSubmit, projectName, initialData }) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { date: "", type: "income", amount: 0, subcategory: "", description: "" },
  });
  const typeValue = form.watch("type");
  const isEditMode = Boolean(initialData);

  useEffect(() => {
    if (open) {
      form.reset(
        initialData
          ? {
              date: initialData.date || "",
              type: (initialData.type || "Income").toLowerCase(),
              amount: Number(initialData.amount) || 0,
              subcategory: initialData.subcategory || "",
              description: initialData.description || "",
            }
          : { date: "", type: "income", amount: 0, subcategory: "", description: "" }
      );
    }
  }, [open, initialData, form]);

  const handleSubmit = async (values) => {
    setIsSaving(true);
    try {
      await onSubmit?.(values);
      toast.success(isEditMode ? "Transaction updated" : "Transaction recorded");
      form.reset({ date: "", type: "income", amount: 0, subcategory: "", description: "" });
      onOpenChange(false);
    } catch (error) {
      toast.error("Unable to save transaction");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Adjust the transaction details to keep reporting accurate."
              : `Log income or expenses for ${projectName || "the selected project"}.`}
          </DialogDescription>
        </DialogHeader>
        <form id="add-transaction-form" className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="transaction-date">Date</Label>
            <Input id="transaction-date" type="date" disabled={isSaving} {...form.register("date")} />
            {form.formState.errors.date && <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={typeValue}
              onValueChange={(value) => form.setValue("type", value)}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.type && <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-amount">Amount</Label>
            <Input id="transaction-amount" type="number" step="0.01" disabled={isSaving} {...form.register("amount", { valueAsNumber: true })} />
            {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-subcategory">Subcategory</Label>
            <Input id="transaction-subcategory" placeholder="Software" disabled={isSaving} {...form.register("subcategory")} />
            {form.formState.errors.subcategory && (
              <p className="text-sm text-destructive">{form.formState.errors.subcategory.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-description">Description</Label>
            <Textarea
              id="transaction-description"
              placeholder="Describe the purpose of this transaction"
              rows={3}
              disabled={isSaving}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>
        </form>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="add-transaction-form" className="w-full sm:w-auto" disabled={isSaving}>
            {isSaving ? "Saving..." : isEditMode ? "Update Transaction" : "Save Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

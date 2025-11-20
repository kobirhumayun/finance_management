// File: src/components/features/projects/add-transaction-dialog.js
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { cn, formatFileSize, resolveAssetUrl } from "@/lib/utils";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  type: z.enum(["income", "expense"], { required_error: "Choose a transaction type" }),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  subcategory: z.string().min(2, "Subcategory is required"),
  description: z.string().min(3, "Provide a short description"),
});

const ACCEPTED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DEFAULT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES =
  Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_BYTES) > 0
    ? Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_BYTES)
    : DEFAULT_MAX_ATTACHMENT_BYTES;

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (error.body) {
    if (typeof error.body === "string") return error.body;
    if (typeof error.body?.message === "string") return error.body.message;
    if (Array.isArray(error.body?.errors) && error.body.errors.length > 0) {
      const [first] = error.body.errors;
      if (first?.msg) return first.msg;
      if (first?.message) return first.message;
    }
  }
  return error.message || fallback;
};

const validateAttachment = (file) => {
  if (!file) return null;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `File is too large. Max size is ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`;
  }
  if (file.type && !ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    return "Unsupported image format. Upload a PNG, JPG, or WebP file.";
  }
  return null;
};

// Dialog used to capture transaction details.
export default function AddTransactionDialog({
  open,
  onOpenChange,
  onSubmit,
  projectName,
  initialData,
  attachmentsAllowed = true,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const fileInputRef = useRef(null);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { date: "", type: "income", amount: 0, subcategory: "", description: "" },
  });
  const typeValue = form.watch("type");
  const isEditMode = Boolean(initialData);
  const existingAttachment = initialData?.attachment || null;
  const existingAttachmentUrl = resolveAssetUrl(
    existingAttachment?.url,
    existingAttachment?.uploadedAt ?? existingAttachment?.updatedAt
  );
  const attachmentsFeatureEnabled = attachmentsAllowed !== false;

  const replaceAttachmentPreview = useCallback((nextUrl) => {
    setAttachmentPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return nextUrl;
    });
  }, []);

  useEffect(() => () => {
    replaceAttachmentPreview(null);
  }, [replaceAttachmentPreview]);

  const resetAttachmentState = useCallback(() => {
    setAttachmentFile(null);
    replaceAttachmentPreview(null);
    setAttachmentError(null);
    setRemoveExistingAttachment(false);
  }, [replaceAttachmentPreview]);

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
      resetAttachmentState();
    }
  }, [open, initialData, form, resetAttachmentState]);

  const handleAttachmentChange = (event) => {
    if (!attachmentsFeatureEnabled) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const errorMessage = validateAttachment(file);
    if (errorMessage) {
      setAttachmentError(errorMessage);
      replaceAttachmentPreview(null);
      setAttachmentFile(null);
      return;
    }
    setAttachmentFile(file);
    replaceAttachmentPreview(URL.createObjectURL(file));
    setAttachmentError(null);
    setRemoveExistingAttachment(false);
  };

  const handleRemoveSelectedFile = () => {
    setAttachmentFile(null);
    replaceAttachmentPreview(null);
    setAttachmentError(null);
  };

  const handleRemoveStoredAttachment = () => {
    if (!attachmentsFeatureEnabled || !existingAttachment) return;
    setAttachmentFile(null);
    replaceAttachmentPreview(null);
    setAttachmentError(null);
    setRemoveExistingAttachment(true);
  };

  const handleSubmit = async (values) => {
    setIsSaving(true);
    setAttachmentError(null);
    try {
      await onSubmit?.({
        ...values,
        attachmentFile: attachmentsFeatureEnabled ? attachmentFile ?? undefined : undefined,
        removeAttachment:
          attachmentsFeatureEnabled && removeExistingAttachment && !attachmentFile ? true : undefined,
      });
      toast.success(isEditMode ? "Transaction updated" : "Transaction recorded");
      form.reset({ date: "", type: "income", amount: 0, subcategory: "", description: "" });
      resetAttachmentState();
      onOpenChange(false);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to save transaction");
      setAttachmentError(message);
      toast.error(message);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
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
          <div className="grid gap-2">
            <Label>Attachment (optional)</Label>
            {!attachmentsFeatureEnabled && (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary">
                <p>Your current plans do not include access to attachment features.</p>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href="/pricing">See Plans</Link>
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_TYPES.join(",")}
              className="hidden"
              onChange={handleAttachmentChange}
              disabled={isSaving || !attachmentsFeatureEnabled}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => attachmentsFeatureEnabled && fileInputRef.current?.click()}
                className={cn("disabled:pointer-events-auto", !attachmentsFeatureEnabled && "cursor-not-allowed")}
                aria-disabled={!attachmentsFeatureEnabled}
                disabled={isSaving || !attachmentsFeatureEnabled}
              >
                {attachmentFile ? "Change image" : "Upload image"}
              </Button>
              {attachmentFile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveSelectedFile}
                  className={cn("disabled:pointer-events-auto", !attachmentsFeatureEnabled && "cursor-not-allowed")}
                  aria-disabled={!attachmentsFeatureEnabled}
                  disabled={isSaving || !attachmentsFeatureEnabled}
                >
                  Clear selection
                </Button>
              ) : null}
              {existingAttachment && !attachmentFile && !removeExistingAttachment ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveStoredAttachment}
                  className={cn("disabled:pointer-events-auto", !attachmentsFeatureEnabled && "cursor-not-allowed")}
                  aria-disabled={!attachmentsFeatureEnabled}
                  disabled={isSaving || !attachmentsFeatureEnabled}
                >
                  Remove stored image
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {attachmentFile
                ? `${attachmentFile.name} (${formatFileSize(attachmentFile.size, { fallback: "unknown size" })})`
                : existingAttachment && !removeExistingAttachment
                ? `Currently stored: ${existingAttachment.filename || "Attachment"} (${formatFileSize(existingAttachment.size, {
                    fallback: "unknown size",
                  })})`
                : `PNG, JPG, or WebP up to ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`}
            </p>
            {removeExistingAttachment && !attachmentFile ? (
              <p className="text-xs text-muted-foreground">The current attachment will be removed when you save.</p>
            ) : null}
            {attachmentError ? <p className="text-sm text-destructive">{attachmentError}</p> : null}
            {(attachmentPreview || (existingAttachmentUrl && !attachmentFile && !removeExistingAttachment)) && (
              <div className="overflow-hidden rounded-lg border bg-muted/20">
                {attachmentPreview ? (
                  <img src={attachmentPreview} alt="Selected transaction attachment" className="max-h-48 w-full object-contain" />
                ) : (
                  <img
                    src={existingAttachmentUrl}
                    alt={existingAttachment?.filename || "Stored attachment"}
                    className="max-h-48 w-full object-contain"
                  />
                )}
              </div>
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

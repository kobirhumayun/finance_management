// File: src/components/features/support/ticket-create-form.jsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/page-header";
import { toast } from "@/components/ui/sonner";
import { useForm } from "react-hook-form";
import { TicketStatusBadge } from "@/components/features/support/ticket-status-badge";
import { formatFileSize } from "@/lib/utils";
import { createTicket, fetchTickets, uploadTicketAttachment } from "@/lib/queries/tickets";
import { IMAGE_ATTACHMENT_TYPES, resolveMaxAttachmentBytes, validateImageAttachment } from "@/lib/attachments";
import { qk } from "@/lib/query-keys";
import { adminUsersOptions } from "@/lib/queries/admin-users";

const REQUESTER_SELF_VALUE = "__self";

const baseSchema = {
  subject: z.string().trim().min(3, "Subject must be at least 3 characters"),
  description: z.string().trim().min(10, "Describe the issue with at least 10 characters"),
  category: z.string().trim().optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high", "urgent"], { required_error: "Choose a priority" }),
};

const schemaWithRequester = z.object({ ...baseSchema, requester: z.string().trim().optional().or(z.literal("")) });
const schemaWithoutRequester = z.object(baseSchema);

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

export default function TicketCreateForm({
  pageTitle = "Create a support ticket",
  pageDescription = "Tell us what you need help with and we'll follow up.",
  successRedirectBase = "/support/tickets",
  cancelHref = "/support/tickets",
  showRequesterSelector = false,
  defaultRequester = "",
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);

  const ticketMetaQuery = useQuery({
    queryKey: qk.tickets.list({ limit: 1 }),
    queryFn: ({ signal }) => fetchTickets({ limit: 1, signal }),
    staleTime: 5 * 60 * 1000,
  });

  const requesterQuery = useQuery({
    ...adminUsersOptions({ limit: 50 }),
    enabled: showRequesterSelector,
  });

  const resolvedMaxAttachmentBytes = useMemo(
    () => resolveMaxAttachmentBytes(ticketMetaQuery.data?.attachmentLimitBytes),
    [ticketMetaQuery.data?.attachmentLimitBytes]
  );

  const form = useForm({
    resolver: zodResolver(showRequesterSelector ? schemaWithRequester : schemaWithoutRequester),
    defaultValues: {
      subject: "",
      description: "",
      category: "",
      priority: "medium",
      requester: defaultRequester || REQUESTER_SELF_VALUE,
    },
  });

  const attachmentLabel = useMemo(() => {
    if (!attachmentFile) return "No file selected";
    return `${attachmentFile.name} (${formatFileSize(attachmentFile.size, { fallback: "unknown size" })})`;
  }, [attachmentFile]);

  const createTicketMutation = useMutation({
    mutationFn: async (values) => {
      const requesterValue = values.requester === REQUESTER_SELF_VALUE ? "" : values.requester;
      const payload = showRequesterSelector
        ? { ...values, requester: requesterValue || undefined }
        : values;
      const { ticket } = await createTicket(payload);
      if (!ticket?.id) {
        throw new Error("Ticket could not be created");
      }
      if (attachmentFile) {
        await uploadTicketAttachment({ ticketId: ticket.id, file: attachmentFile });
      }
      return ticket;
    },
    onSuccess: (ticket) => {
      toast.success("Support ticket created");
      queryClient.invalidateQueries({ queryKey: ["tickets", "list"], exact: false });
      router.push(`${successRedirectBase}/${ticket.id}`);
    },
    onError: (error) => {
      const message = getErrorMessage(error, "Unable to create ticket");
      setAttachmentError(message);
      toast.error(message);
    },
  });

  const validateAttachment = (file) =>
    validateImageAttachment(
      file,
      resolvedMaxAttachmentBytes,
      (value) => formatFileSize(value, { fallback: "unknown size" })
    );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachmentFile(null);
      setAttachmentError(null);
      return;
    }
    const error = validateAttachment(file);
    if (error) {
      setAttachmentFile(null);
      setAttachmentError(error);
      return;
    }
    setAttachmentFile(file);
    setAttachmentError(null);
  };

  const handleSubmit = async (values) => {
    setAttachmentError(null);
    try {
      await createTicketMutation.mutateAsync(values);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to create ticket");
      setAttachmentError(message);
    }
  };

  const requesterOptions = useMemo(() => {
    if (!showRequesterSelector) return [];
    const items = requesterQuery.data?.items ?? [];
    return items
      .map((user) => ({
        value: user.id || "",
        label: user.fullName || user.email || user.username || "Unnamed user",
      }))
      .filter((option) => Boolean(option.value));
  }, [requesterQuery.data?.items, showRequesterSelector]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={<TicketStatusBadge status="open" className="text-xs" />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Ticket details</CardTitle>
          <CardDescription>Provide as much information as possible for faster resolution.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Brief summary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {showRequesterSelector ? (
                <FormField
                  control={form.control}
                  name="requester"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requester (optional)</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={(value) => field.onChange(value || REQUESTER_SELF_VALUE)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a requester" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={REQUESTER_SELF_VALUE}>Use my account</SelectItem>
                          {requesterOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={6}
                        placeholder="Describe what happened, what you expected, and any steps to reproduce."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Billing, integrations, onboarding..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <FormLabel>Attachment (optional)</FormLabel>
                  <Input type="file" accept={IMAGE_ATTACHMENT_TYPES.join(",")} onChange={handleFileChange} />
                  <p className="text-xs text-muted-foreground">{attachmentLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Accepted: PNG, JPG, or WebP images up to {formatFileSize(resolvedMaxAttachmentBytes)}.
                  </p>
                  {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(cancelHref)}
                  disabled={createTicketMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTicketMutation.isPending}>
                  {createTicketMutation.isPending ? "Submitting..." : "Submit ticket"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

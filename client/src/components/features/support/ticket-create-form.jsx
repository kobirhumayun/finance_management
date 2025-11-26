// File: src/components/features/support/ticket-create-form.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PageHeader from "@/components/shared/page-header";
import { toast } from "@/components/ui/sonner";
import { useForm } from "react-hook-form";
import { TicketStatusBadge } from "@/components/features/support/ticket-status-badge";
import { formatFileSize } from "@/lib/utils";
import { createTicket, fetchTickets } from "@/lib/queries/tickets";
import { resolveMaxAttachmentBytes } from "@/lib/attachments";
import { qk } from "@/lib/query-keys";
import { adminUsersOptions } from "@/lib/queries/admin-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Files, Paperclip, X } from "lucide-react";

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
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [attachmentError, setAttachmentError] = useState(null);
  const fileInputRef = useRef(null);
  const [requesterPopoverOpen, setRequesterPopoverOpen] = useState(false);
  const [requesterSearch, setRequesterSearch] = useState("");

  const debouncedRequesterSearch = useDebouncedValue(requesterSearch, 300);

  const ticketMetaQuery = useQuery({
    queryKey: qk.tickets.list({ limit: 1 }),
    queryFn: ({ signal }) => fetchTickets({ limit: 1, signal }),
    staleTime: 5 * 60 * 1000,
  });

  const requesterQuery = useQuery({
    ...adminUsersOptions({ limit: 20, search: debouncedRequesterSearch || undefined }),
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
    if (!attachmentFiles.length) return "No files selected";
    if (attachmentFiles.length === 1) {
      const [file] = attachmentFiles;
      return `${file.name} (${formatFileSize(file.size, { fallback: "unknown size" })})`;
    }
    const totalSize = attachmentFiles.reduce((sum, file) => sum + (file?.size || 0), 0);
    return `${attachmentFiles.length} files selected (${formatFileSize(totalSize, { fallback: "unknown size" })})`;
  }, [attachmentFiles]);

  const createTicketMutation = useMutation({
    mutationFn: async (values) => {
      const requesterValue = values.requester === REQUESTER_SELF_VALUE ? "" : values.requester;
      const payload = showRequesterSelector
        ? { ...values, requester: requesterValue || undefined }
        : values;
      const { ticket } = await createTicket({ ...payload, attachments: attachmentFiles });
      if (!ticket?.id) {
        throw new Error("Ticket could not be created");
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

  const validateAttachment = (file) => {
    if (!file) return null;
    if (resolvedMaxAttachmentBytes && file.size > resolvedMaxAttachmentBytes) {
      return `File is too large. Max size is ${formatFileSize(resolvedMaxAttachmentBytes, { fallback: "the upload limit" })}.`;
    }
    return null;
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const existing = Array.isArray(attachmentFiles) ? [...attachmentFiles] : [];

    if (!files.length && !existing.length) {
      setAttachmentFiles([]);
      setAttachmentError(null);
      return;
    }

    const firstErrorRef = { current: null };
    const dedupeKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;
    const seen = new Set(existing.map(dedupeKey));

    const validatedExisting = existing.filter((file) => {
      const error = validateAttachment(file);
      if (error && !firstErrorRef.current) {
        firstErrorRef.current = error;
      }
      return !error;
    });

    const validNewFiles = files.reduce((list, file) => {
      const key = dedupeKey(file);
      if (seen.has(key)) return list;
      const error = validateAttachment(file);
      if (error && !firstErrorRef.current) {
        firstErrorRef.current = error;
      }
      if (!error) {
        seen.add(key);
        list.push(file);
      }
      return list;
    }, []);

    setAttachmentFiles([...validatedExisting, ...validNewFiles]);
    setAttachmentError(firstErrorRef.current);

    if (event.target) {
      event.target.value = "";
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachmentFiles((current) => current.filter((_, index) => index !== indexToRemove));
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
        label: user.fullName || user.username || user.email || "Unnamed user",
        meta: user.email && user.email !== user.fullName ? user.email : user.username || null,
      }))
      .filter((option) => Boolean(option.value));
  }, [requesterQuery.data?.items, showRequesterSelector]);

  useEffect(() => {
    if (!requesterPopoverOpen) {
      setRequesterSearch("");
    }
  }, [requesterPopoverOpen]);

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
                      <Popover open={requesterPopoverOpen} onOpenChange={setRequesterPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                              aria-expanded={requesterPopoverOpen}
                            >
                              <span className="truncate text-left">
                                {field.value === REQUESTER_SELF_VALUE || !field.value
                                  ? "Use my account"
                                  : requesterOptions.find((option) => option.value === field.value)?.label ||
                                    "Select a requester"}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">Search</span>
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[420px] p-0" align="start">
                          <div className="border-b p-3">
                            <Input
                              placeholder="Search by name or email"
                              value={requesterSearch}
                              onChange={(event) => setRequesterSearch(event.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="max-h-64 space-y-1 overflow-y-auto p-1">
                            <Button
                              type="button"
                              variant={field.value === REQUESTER_SELF_VALUE ? "secondary" : "ghost"}
                              className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
                              onClick={() => {
                                field.onChange(REQUESTER_SELF_VALUE);
                                setRequesterPopoverOpen(false);
                              }}
                            >
                              <div>
                                <p className="font-medium">Use my account</p>
                                <p className="text-xs text-muted-foreground">Submit ticket as yourself</p>
                              </div>
                            </Button>
                            {requesterQuery.isFetching ? (
                              <p className="px-3 py-2 text-sm text-muted-foreground">Searching users…</p>
                            ) : null}
                            {!requesterQuery.isFetching && requesterOptions.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-muted-foreground">
                                {requesterSearch ? "No users match your search" : "No users available"}
                              </p>
                            ) : null}
                            {requesterOptions.map((option) => (
                              <Button
                                key={option.value}
                                type="button"
                                variant={field.value === option.value ? "secondary" : "ghost"}
                                className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
                                onClick={() => {
                                  field.onChange(option.value);
                                  setRequesterPopoverOpen(false);
                                }}
                              >
                                <div>
                                  <p className="font-medium">{option.label}</p>
                                  {option.meta ? (
                                    <p className="text-xs text-muted-foreground">{option.meta}</p>
                                  ) : null}
                                </div>
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
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
                <FormLabel>Attachments (optional)</FormLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="ticket-attachments"
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2"
                  >
                    <Paperclip className="h-4 w-4" aria-hidden />
                    <span>Add files</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="sm:hidden"
                    aria-label="Attach multiple files"
                  >
                    <Files className="h-4 w-4" aria-hidden />
                  </Button>
                  <p className="text-xs text-muted-foreground">{attachmentLabel}</p>
                </div>
                {attachmentFiles.length ? (
                  <ul className="space-y-2 text-sm">
                    {attachmentFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size, { fallback: "unknown size" })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveAttachment(index)}
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  You can attach multiple files (images, PDFs, docs) up to {formatFileSize(resolvedMaxAttachmentBytes, {
                    fallback: "the upload limit",
                  })}
                  {" "}
                  each.
                </p>
                {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}
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

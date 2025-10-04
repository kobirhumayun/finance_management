// File: src/components/features/projects/add-project-dialog.js
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

const schema = z.object({
  name: z.string().min(2, "Project name is required"),
  description: z.string().min(5, "Description should provide more context"),
});

// Modal dialog for creating or editing a project entity.
export default function AddProjectDialog({ open, onOpenChange, onSubmit, initialData }) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  const isEditMode = Boolean(initialData);

  useEffect(() => {
    if (open) {
      form.reset(
        initialData
          ? { name: initialData.name || "", description: initialData.description || "" }
          : { name: "", description: "" }
      );
    }
  }, [open, initialData, form]);

  const handleSubmit = async (values) => {
    setIsSaving(true);
    try {
      await onSubmit?.(values);
      toast.success(isEditMode ? "Project updated" : "Project created");
      form.reset({ name: "", description: "" });
      onOpenChange(false);
    } catch (error) {
      toast.error("Unable to save project");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit project" : "Create a new project"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the details below to keep everyone aligned on this project."
              : "Organize transactions by grouping them into projects."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(handleSubmit)}
          id="add-project-form"
        >
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input id="project-name" placeholder="Marketing Revamp" disabled={isSaving} {...form.register("name")} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Add a brief summary of the project's goals."
              rows={4}
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
          <Button type="submit" form="add-project-form" className="w-full sm:w-auto" disabled={isSaving}>
            {isSaving ? "Saving..." : isEditMode ? "Update Project" : "Save Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

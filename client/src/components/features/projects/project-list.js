// File: src/components/features/projects/project-list.js
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Sidebar list rendering all projects with search and sorting controls.
export default function ProjectList({
  projects = [],
  isLoading,
  selectedProjectId,
  onSelect,
  onAddProject,
  onEditProject,
  onDeleteProject,
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const getTimestamp = (value) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return projects
      .filter((project) => {
        const name = typeof project?.name === "string" ? project.name : "";
        return name.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aTime = getTimestamp(a?.createdAt);
        const bTime = getTimestamp(b?.createdAt);
        return sort === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [projects, search, sort]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-xs text-muted-foreground">Select a project to view its transactions.</p>
        </div>
        <Button onClick={onAddProject} size="sm" className="hidden md:inline-flex">
          Add New Project
        </Button>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="project-search" className="text-xs uppercase tracking-wide text-muted-foreground">
            Search projects
          </Label>
          <Input
            id="project-search"
            placeholder="Search by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sort by</Label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger>
              <SelectValue placeholder="Sort projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-2">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : filteredProjects.length ? (
          filteredProjects.map((project, index) => {
            const projectId = project?.id;
            const projectName = typeof project?.name === "string" && project.name.trim().length ? project.name : "Untitled project";
            const projectDescription =
              typeof project?.description === "string" && project.description.trim().length
                ? project.description
                : "No description available.";
            const createdLabel = project?.createdAt || "—";
            const isActive = selectedProjectId === projectId;
            const handleSelect = () => {
              if (projectId) {
                onSelect?.(project);
              }
            };
            return (
              <div
                key={projectId ?? `project-${index}`}
                role="button"
                tabIndex={projectId ? 0 : -1}
                aria-disabled={!projectId}
                onClick={handleSelect}
                onKeyDown={(event) => {
                  if (!projectId) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect();
                  }
                }}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive ? "border-primary bg-primary/5" : "border-transparent bg-muted/40",
                  projectId ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                )}
                data-state={isActive ? "active" : "inactive"}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{projectName}</p>
                    <p className="text-xs text-muted-foreground">{projectDescription}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{createdLabel}</span>
                </div>
                {isActive && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (projectId) {
                          onEditProject?.(project);
                        }
                      }}
                      disabled={!projectId}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (projectId) {
                          onDeleteProject?.(project);
                        }
                      }}
                      disabled={!projectId}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No projects created yet. Click “Add New Project” to start.
          </div>
        )}
      </div>
      <div className="sticky bottom-4 md:hidden">
        <Button className="h-12 w-full" size="lg" onClick={onAddProject}>
          Add New Project
        </Button>
      </div>
    </div>
  );
}

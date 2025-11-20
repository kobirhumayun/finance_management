// File: src/app/(user)/projects/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import ProjectList from "@/components/features/projects/project-list";
import TransactionTable from "@/components/features/projects/transaction-table";
import AddProjectDialog from "@/components/features/projects/add-project-dialog";
import AddTransactionDialog from "@/components/features/projects/add-transaction-dialog";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { qk } from "@/lib/query-keys";
import {
  createProject,
  createTransaction,
  deleteProject,
  deleteTransaction,
  listProjectTransactions,
  listProjects,
  updateProject,
  updateTransaction,
} from "@/lib/queries/projects";
import { toast } from "@/components/ui/sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { myPlanQueryOptions } from "@/lib/queries/plans";

const PROJECTS_PAGE_SIZE = 10;
const TRANSACTIONS_PAGE_SIZE = 10;

const buildPendingAttachmentDescriptor = (file) => {
  if (!file) return null;
  const size = typeof file.size === "number" ? file.size : Number(file.size);
  return {
    filename: file.name || "Attachment",
    mimeType: file.type || "image/*",
    size: Number.isFinite(size) ? size : null,
    width: null,
    height: null,
    url: "",
    uploadedAt: new Date().toISOString(),
    isPending: true,
  };
};

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (error.body) {
    if (typeof error.body === "string") return error.body;
    if (error.body?.message) return error.body.message;
    if (Array.isArray(error.body?.errors) && error.body.errors.length > 0) {
      const [first] = error.body.errors;
      if (first?.message) return first.message;
    }
  }
  return error.message || fallback;
};

// Projects workspace featuring list and transaction management.
export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const planQuery = useQuery(myPlanQueryOptions());
  const planLimits = planQuery.data?.plan?.limits ?? {};
  const planTransactionLimits = planLimits.transactions ?? {};
  const attachmentsAllowed = planTransactionLimits.allowAttachments !== false;

  const [projectSearch, setProjectSearch] = useState("");
  const [projectSort, setProjectSort] = useState("newest");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionSort, setTransactionSort] = useState("newest");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDialogState, setProjectDialogState] = useState({ open: false, project: null });
  const [transactionDialogState, setTransactionDialogState] = useState({ open: false, transaction: null });
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  const debouncedProjectSearch = useDebouncedValue(projectSearch, 300);
  const debouncedTransactionSearch = useDebouncedValue(transactionSearch, 300);

  const projectListFilters = useMemo(
    () => ({
      search: debouncedProjectSearch || undefined,
      sort: projectSort || undefined,
      limit: PROJECTS_PAGE_SIZE,
    }),
    [debouncedProjectSearch, projectSort]
  );

  const transactionListFilters = useMemo(
    () => ({
      search: debouncedTransactionSearch || undefined,
      sort: transactionSort || undefined,
      limit: TRANSACTIONS_PAGE_SIZE,
    }),
    [debouncedTransactionSearch, transactionSort]
  );

  const projectsQuery = useInfiniteQuery({
    queryKey: qk.projects.list(projectListFilters),
    queryFn: ({ pageParam, signal }) =>
      listProjects({ ...projectListFilters, cursor: pageParam ?? undefined, signal }),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage?.pageInfo?.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
  });

  const projectPages = useMemo(
    () => projectsQuery.data?.pages ?? [],
    [projectsQuery.data]
  );
  const projects = useMemo(
    () =>
      projectPages.flatMap((page) =>
        Array.isArray(page?.projects) ? page.projects : []
      ),
    [projectPages]
  );

  useEffect(() => {
    if (!projects.length) {
      if (selectedProjectId !== null) {
        setSelectedProjectId(null);
      }
      return;
    }

    if (!selectedProjectId) {
      setSelectedProjectId(projects[0]?.id ?? null);
      return;
    }

    const hasSelectedProject = projects.some((project) => project?.id === selectedProjectId);
    if (!hasSelectedProject) {
      setSelectedProjectId(projects[0]?.id ?? null);
    }
  }, [projects, selectedProjectId]);

  const transactionQueryKey = selectedProjectId
    ? qk.projects.detail(selectedProjectId, transactionListFilters)
    : qk.projects.detail("none", transactionListFilters);

  const transactionsQuery = useInfiniteQuery({
    queryKey: transactionQueryKey,
    queryFn: ({ pageParam, signal }) =>
      listProjectTransactions({
        projectId: selectedProjectId,
        ...transactionListFilters,
        cursor: pageParam ?? undefined,
        signal,
      }),
    enabled: Boolean(selectedProjectId),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage?.pageInfo?.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
  });

  const transactionPages = useMemo(
    () => transactionsQuery.data?.pages ?? [],
    [transactionsQuery.data]
  );
  const transactions = useMemo(
    () =>
      transactionPages.flatMap((page) =>
        Array.isArray(page?.transactions) ? page.transactions : []
      ),
    [transactionPages]
  );

  const detailProject = transactionPages[0]?.project ?? null;
  const selectedProject = useMemo(() => {
    const fromList = projects.find((project) => project?.id === selectedProjectId);
    if (fromList) return fromList;
    if (detailProject && detailProject.id === selectedProjectId) {
      return detailProject;
    }
    return null;
  }, [projects, selectedProjectId, detailProject]);

  const projectsLoading = projectsQuery.isLoading || (projectsQuery.isFetching && projects.length === 0);
  const transactionsLoading = Boolean(selectedProjectId) && (
    transactionsQuery.isLoading || (transactionsQuery.isFetching && transactions.length === 0)
  );

  const createProjectMutation = useMutation({
    mutationFn: (values) => createProject(values),
    onMutate: async (values) => {
      const listKey = qk.projects.list(projectListFilters);
      await queryClient.cancelQueries({ queryKey: ["projects", "list"] });
      const previousData = queryClient.getQueryData(listKey);

      const optimisticProject = {
        id: `optimistic-${Date.now()}`,
        name: values.name,
        description: values.description,
        currency: "BDT",
        createdAt: new Date().toISOString().slice(0, 10),
      };

      queryClient.setQueryData(listKey, (current) => {
        if (!current) {
          return {
            pageParams: [null],
            pages: [
              {
                projects: [optimisticProject],
                pageInfo: {
                  hasNextPage: false,
                  nextCursor: null,
                  limit: projectListFilters.limit ?? PROJECTS_PAGE_SIZE,
                },
                totalCount: 1,
              },
            ],
          };
        }

        const pages = current.pages ? [...current.pages] : [];
        if (pages.length === 0) {
          pages.push({
            projects: [optimisticProject],
            pageInfo: {
              hasNextPage: false,
              nextCursor: null,
              limit: projectListFilters.limit ?? PROJECTS_PAGE_SIZE,
            },
            totalCount: 1,
          });
        } else {
          const first = pages[0] ?? {};
          const existing = Array.isArray(first.projects) ? first.projects : [];
          const updatedProjects = [optimisticProject, ...existing];
          pages[0] = {
            ...first,
            projects: updatedProjects,
            totalCount:
              typeof first.totalCount === "number" ? first.totalCount + 1 : updatedProjects.length,
          };
        }

        return {
          ...current,
          pages,
        };
      });

      return { previousData, listKey, optimisticProject };
    },
    onError: (error, _values, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.listKey, context.previousData);
      }
      toast.error(getErrorMessage(error, "Unable to create project."));
    },
    onSuccess: (data, values, context) => {
      const project = data?.project;
      if (project && context?.listKey && context.optimisticProject) {
        queryClient.setQueryData(context.listKey, (current) => {
          if (!current) return current;
          const pages = current.pages?.map((page) => {
            if (!Array.isArray(page?.projects)) return page;
            return {
              ...page,
              projects: page.projects.map((item) =>
                item.id === context.optimisticProject.id ? project : item
              ),
            };
          });
          return { ...current, pages };
        });
      }
      const name = project?.name || values?.name || "Project";
      toast.success(`Project "${name}" created.`);
      if (project?.id) {
        setSelectedProjectId(project.id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", "list"] });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, values }) => updateProject({ projectId, ...values }),
    onMutate: async ({ projectId, values }) => {
      const listKey = qk.projects.list(projectListFilters);
      await queryClient.cancelQueries({ queryKey: ["projects", "list"] });
      const previousList = queryClient.getQueryData(listKey);

      queryClient.setQueryData(listKey, (current) => {
        if (!current) return current;
        const pages = current.pages?.map((page) => {
          if (!Array.isArray(page?.projects)) return page;
          return {
            ...page,
            projects: page.projects.map((project) =>
              project.id === projectId
                ? { ...project, name: values.name, description: values.description }
                : project
            ),
          };
        });
        return { ...current, pages };
      });

      const detailKey = qk.projects.detail(projectId, transactionListFilters);
      const previousDetail = queryClient.getQueryData(detailKey);

      queryClient.setQueryData(detailKey, (current) => {
        if (!current) return current;
        const pages = current.pages?.map((page, index) => {
          if (index !== 0) return page;
          if (!page?.project) return page;
          return {
            ...page,
            project: {
              ...page.project,
              name: values.name,
              description: values.description,
            },
          };
        });
        return { ...current, pages };
      });

      return { listKey, previousList, detailKey, previousDetail };
    },
    onError: (error, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(context.listKey, context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
      toast.error(getErrorMessage(error, "Unable to update project."));
    },
    onSuccess: (data, variables) => {
      const name = data?.project?.name || variables?.values?.name || "Project";
      toast.success(`Project "${name}" updated.`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: ({ projectId }) => deleteProject({ projectId }),
    onMutate: async ({ projectId }) => {
      const listKey = qk.projects.list(projectListFilters);
      await queryClient.cancelQueries({ queryKey: ["projects", "list"] });
      const previousList = queryClient.getQueryData(listKey);
      let nextSelectedId = null;

      queryClient.setQueryData(listKey, (current) => {
        if (!current) return current;
        const pages = current.pages?.map((page) => {
          if (!Array.isArray(page?.projects)) return page;
          const filtered = page.projects.filter((project) => project.id !== projectId);
          if (nextSelectedId === null && filtered.length > 0) {
            nextSelectedId = filtered[0].id;
          }
          return {
            ...page,
            projects: filtered,
            totalCount:
              typeof page.totalCount === "number"
                ? Math.max(page.totalCount - (page.projects.length - filtered.length), 0)
                : filtered.length,
          };
        });
        return { ...current, pages };
      });

      const wasSelected = selectedProjectId === projectId;
      return { listKey, previousList, wasSelected, nextSelectedId, projectId };
    },
    onError: (error, variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(context.listKey, context.previousList);
      }
      toast.error(getErrorMessage(error, `Unable to delete ${variables?.projectName || "project"}.`));
    },
    onSuccess: (_data, variables, context) => {
      const name = variables?.projectName || "Project";
      toast.success(`Project "${name}" removed.`);
      if (context?.wasSelected) {
        setSelectedProjectId(context.nextSelectedId ?? null);
      }
      if (context?.projectId) {
        queryClient.removeQueries({ queryKey: ["projects", "detail", String(context.projectId)] });
      }
      setProjectToDelete(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", "list"] });
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: ({ projectId, values, attachmentFile }) => createTransaction({ projectId, attachmentFile, ...values }),
    onMutate: async ({ projectId, values, attachmentFile }) => {
      const detailKey = qk.projects.detail(projectId, transactionListFilters);
      await queryClient.cancelQueries({ queryKey: ["projects", "detail", String(projectId)] });
      const previousDetail = queryClient.getQueryData(detailKey);

      const optimisticTransaction = {
        id: `optimistic-${Date.now()}`,
        projectId,
        date: values.date,
        type: values.type === "income" ? "Income" : "Expense",
        amount: Number(values.amount) || 0,
        subcategory: values.subcategory,
        description: values.description,
        attachment: attachmentFile ? buildPendingAttachmentDescriptor(attachmentFile) : null,
      };

      queryClient.setQueryData(detailKey, (current) => {
        if (!current) {
          return {
            pageParams: [null],
            pages: [
              {
                project: selectedProject,
                transactions: [optimisticTransaction],
                summary: { income: 0, expense: 0, balance: 0 },
                pageInfo: {
                  hasNextPage: false,
                  nextCursor: null,
                  limit: transactionListFilters.limit ?? TRANSACTIONS_PAGE_SIZE,
                },
              },
            ],
          };
        }

        const pages = current.pages ? [...current.pages] : [];
        if (pages.length === 0) {
          pages.push({
            project: selectedProject ?? current.project ?? null,
            transactions: [optimisticTransaction],
            summary: current.summary ?? { income: 0, expense: 0, balance: 0 },
            pageInfo: current.pageInfo ?? {
              hasNextPage: false,
              nextCursor: null,
              limit: transactionListFilters.limit ?? TRANSACTIONS_PAGE_SIZE,
            },
          });
        } else {
          const first = pages[0] ?? {};
          const existing = Array.isArray(first.transactions) ? first.transactions : [];
          pages[0] = {
            ...first,
            project: first.project ?? selectedProject ?? null,
            transactions: [optimisticTransaction, ...existing],
          };
        }

        return { ...current, pages };
      });

      return { detailKey, previousDetail, optimisticId: optimisticTransaction.id, projectId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
      toast.error(getErrorMessage(error, "Unable to save transaction."));
    },
    onSuccess: (data, _variables, context) => {
      const transaction = data?.transaction;
      if (transaction && context?.detailKey && context.optimisticId) {
        queryClient.setQueryData(context.detailKey, (current) => {
          if (!current) return current;
          const pages = current.pages?.map((page) => {
            if (!Array.isArray(page?.transactions)) return page;
            return {
              ...page,
              transactions: page.transactions.map((item) =>
                item.id === context.optimisticId ? transaction : item
              ),
            };
          });
          return { ...current, pages };
        });
      }
      toast.success("Transaction recorded.");
    },
    onSettled: (_data, _error, variables, context) => {
      const projectId = variables?.projectId ?? context?.projectId ?? selectedProjectId;
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", "detail", String(projectId)] });
      }
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: ({ projectId, transactionId, values, attachmentFile, removeAttachment }) =>
      updateTransaction({ projectId, transactionId, attachmentFile, removeAttachment, ...values }),
    onMutate: async ({ projectId, transactionId, values, attachmentFile, removeAttachment }) => {
      const detailKey = qk.projects.detail(projectId, transactionListFilters);
      await queryClient.cancelQueries({ queryKey: ["projects", "detail", String(projectId)] });
      const previousDetail = queryClient.getQueryData(detailKey);

      queryClient.setQueryData(detailKey, (current) => {
        if (!current) return current;
        const pages = current.pages?.map((page) => {
          if (!Array.isArray(page?.transactions)) return page;
          return {
            ...page,
            transactions: page.transactions.map((transaction) => {
              if (transaction.id !== transactionId) return transaction;
              const nextAttachment = attachmentFile
                ? buildPendingAttachmentDescriptor(attachmentFile)
                : removeAttachment
                ? null
                : transaction.attachment;
              return {
                ...transaction,
                date: values.date,
                description: values.description,
                subcategory: values.subcategory,
                type: values.type === "income" ? "Income" : "Expense",
                amount: Number(values.amount) || transaction.amount,
                attachment: nextAttachment,
              };
            }),
          };
        });
        return { ...current, pages };
      });

      return { detailKey, previousDetail, projectId, transactionId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
      toast.error(getErrorMessage(error, "Unable to update transaction."));
    },
    onSuccess: (data, _variables, context) => {
      const transaction = data?.transaction;
      if (transaction && context?.detailKey) {
        queryClient.setQueryData(context.detailKey, (current) => {
          if (!current) return current;
          const pages = current.pages?.map((page) => {
            if (!Array.isArray(page?.transactions)) return page;
            return {
              ...page,
              transactions: page.transactions.map((item) => (item.id === transaction.id ? transaction : item)),
            };
          });
          return { ...current, pages };
        });
      }
      toast.success("Transaction updated.");
    },
    onSettled: (_data, _error, variables, context) => {
      const projectId = variables?.projectId ?? context?.projectId ?? selectedProjectId;
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", "detail", String(projectId)] });
      }
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: ({ projectId, transactionId }) =>
      deleteTransaction({ projectId, transactionId }),
    onMutate: async ({ projectId, transactionId }) => {
      const detailKey = qk.projects.detail(projectId, transactionListFilters);
      await queryClient.cancelQueries({ queryKey: ["projects", "detail", String(projectId)] });
      const previousDetail = queryClient.getQueryData(detailKey);

      queryClient.setQueryData(detailKey, (current) => {
        if (!current) return current;
        const pages = current.pages?.map((page) => {
          if (!Array.isArray(page?.transactions)) return page;
          return {
            ...page,
            transactions: page.transactions.filter((transaction) => transaction.id !== transactionId),
          };
        });
        return { ...current, pages };
      });

      return { detailKey, previousDetail, projectId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
      toast.error(getErrorMessage(error, "Unable to delete transaction."));
    },
    onSuccess: () => {
      toast.success("Transaction removed.");
      setTransactionToDelete(null);
    },
    onSettled: (_data, _error, variables, context) => {
      const projectId = variables?.projectId ?? context?.projectId ?? selectedProjectId;
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", "detail", String(projectId)] });
      }
    },
  });

  const handleProjectSubmit = async (values) => {
    const editingProject = projectDialogState.project;
    if (editingProject?.id) {
      await updateProjectMutation.mutateAsync({ projectId: editingProject.id, values });
    } else {
      await createProjectMutation.mutateAsync(values);
    }
  };

  const handleDeleteProject = (project) => {
    if (!project?.id || deleteProjectMutation.isPending) return;
    setProjectToDelete(project);
  };

  const handleEditProject = (project) => {
    setProjectDialogState({ open: true, project });
  };

  const handleTransactionSubmit = async (values) => {
    if (!selectedProjectId) return;
    const editingTransaction = transactionDialogState.transaction;
    const { attachmentFile, removeAttachment, ...payload } = values || {};
    const attachmentFileInput = attachmentsAllowed ? attachmentFile : undefined;
    const removeAttachmentInput = attachmentsAllowed ? removeAttachment : undefined;
    if (editingTransaction?.id) {
      await updateTransactionMutation.mutateAsync({
        projectId: selectedProjectId,
        transactionId: editingTransaction.id,
        values: payload,
        attachmentFile: attachmentFileInput,
        removeAttachment: removeAttachmentInput,
      });
    } else {
      await createTransactionMutation.mutateAsync({
        projectId: selectedProjectId,
        values: payload,
        attachmentFile: attachmentFileInput,
      });
    }
  };

  const handleDeleteTransaction = (transaction) => {
    if (!selectedProjectId || !transaction?.id || deleteTransactionMutation.isPending) return;
    setTransactionToDelete({
      projectId: selectedProjectId,
      projectName: selectedProject?.name,
      transaction,
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects & Transactions"
        description="Manage projects and review income or expense items without leaving this view."
      />
      <Card className="grid gap-6 p-4 md:p-6 lg:grid-cols-[1fr_2fr]">
        <div className="min-h-[400px]">
          <ProjectList
            projects={projects}
            isLoading={projectsLoading}
            isLoadingMore={projectsQuery.isFetchingNextPage}
            hasNextPage={Boolean(projectsQuery.hasNextPage)}
            selectedProjectId={selectedProjectId}
            onSelect={(project) => project?.id && setSelectedProjectId(project.id)}
            onAddProject={() => setProjectDialogState({ open: true, project: null })}
            onDeleteProject={handleDeleteProject}
            onEditProject={handleEditProject}
            onLoadMore={() => projectsQuery.fetchNextPage()}
            searchValue={projectSearch}
            sortValue={projectSort}
            onSearchChange={setProjectSearch}
            onSortChange={setProjectSort}
          />
        </div>
        <div className="min-h-[400px]">
          <TransactionTable
            project={selectedProject}
            transactions={transactions}
            isLoading={transactionsLoading}
            isLoadingMore={transactionsQuery.isFetchingNextPage}
            hasNextPage={Boolean(transactionsQuery.hasNextPage)}
            onLoadMore={() => transactionsQuery.fetchNextPage()}
            onAddTransaction={() => setTransactionDialogState({ open: true, transaction: null })}
            onEditTransaction={(transaction) =>
              transaction?.id && setTransactionDialogState({ open: true, transaction })
            }
            onDeleteTransaction={handleDeleteTransaction}
            searchValue={transactionSearch}
            onSearchChange={setTransactionSearch}
            sortValue={transactionSort}
            onSortChange={setTransactionSort}
            attachmentsAllowed={attachmentsAllowed}
          />
        </div>
      </Card>

      <AlertDialog
        open={Boolean(projectToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteProjectMutation.isPending) {
            setProjectToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete the project "${projectToDelete?.name || "this project"}"? This will permanently remove all associated transactions.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProjectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteProjectMutation.isPending || !projectToDelete?.id}
              onClick={(event) => {
                event.preventDefault();
                if (!projectToDelete?.id || deleteProjectMutation.isPending) return;
                deleteProjectMutation.mutate({
                  projectId: projectToDelete.id,
                  projectName: projectToDelete.name,
                });
              }}
            >
              {deleteProjectMutation.isPending &&
              deleteProjectMutation.variables?.projectId === projectToDelete?.id
                ? "Removing..."
                : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(transactionToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteTransactionMutation.isPending) {
            setTransactionToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete this transaction${
                transactionToDelete?.transaction?.description
                  ? ` "${transactionToDelete.transaction.description}"`
                  : ""
              }? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTransactionMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                deleteTransactionMutation.isPending || !transactionToDelete?.transaction?.id
              }
              onClick={(event) => {
                event.preventDefault();
                if (!transactionToDelete?.transaction?.id || deleteTransactionMutation.isPending) return;
                deleteTransactionMutation.mutate({
                  projectId: transactionToDelete.projectId,
                  transactionId: transactionToDelete.transaction.id,
                });
              }}
            >
              {deleteTransactionMutation.isPending &&
              deleteTransactionMutation.variables?.transactionId === transactionToDelete?.transaction?.id
                ? "Removing..."
                : "Delete transaction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddProjectDialog
        open={projectDialogState.open}
        initialData={projectDialogState.project}
        onOpenChange={(open) => {
          if (!open) {
            setProjectDialogState({ open: false, project: null });
          } else {
            setProjectDialogState((prev) => ({ ...prev, open: true }));
          }
        }}
        onSubmit={handleProjectSubmit}
      />
      <AddTransactionDialog
        open={transactionDialogState.open}
        initialData={transactionDialogState.transaction}
        onOpenChange={(open) => {
          if (!open) {
            setTransactionDialogState({ open: false, transaction: null });
          } else {
            setTransactionDialogState((prev) => ({ ...prev, open: true }));
          }
        }}
        onSubmit={handleTransactionSubmit}
        projectName={selectedProject?.name}
        attachmentsAllowed={attachmentsAllowed}
      />
    </div>
  );
}

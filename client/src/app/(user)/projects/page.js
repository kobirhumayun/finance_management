// File: src/app/(user)/projects/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import ProjectList from "@/components/features/projects/project-list";
import TransactionTable from "@/components/features/projects/transaction-table";
import AddProjectDialog from "@/components/features/projects/add-project-dialog";
import AddTransactionDialog from "@/components/features/projects/add-transaction-dialog";
import { Card } from "@/components/ui/card";
import { qk } from "@/lib/query-keys";
import { fetchProjects, fetchTransactionsByProject } from "@/lib/mock-data";
import { toast } from "@/components/ui/sonner";

// Projects workspace featuring list and transaction management.
export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const { data: projectsData = [], isLoading: projectsLoading } = useQuery({
    queryKey: qk.projects.list(),
    queryFn: fetchProjects,
  });

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDialogState, setProjectDialogState] = useState({ open: false, project: null });
  const [transactionDialogState, setTransactionDialogState] = useState({ open: false, transaction: null });

  const projects = useMemo(() => projectsData ?? [], [projectsData]);

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

  const selectedProject = useMemo(
    () => projects.find((project) => project?.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: qk.projects.detail(selectedProjectId || "none"),
    queryFn: () => fetchTransactionsByProject(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const handleProjectSubmit = async (values) => {
    const editingProject = projectDialogState.project;
    const currentProjects = queryClient.getQueryData(qk.projects.list()) || [];

    if (editingProject) {
      const updatedProject = {
        ...editingProject,
        name: values.name,
        description: values.description,
      };
      queryClient.setQueryData(
        qk.projects.list(),
        currentProjects.map((project) => (project.id === updatedProject.id ? updatedProject : project))
      );
      return;
    }

    const newProject = {
      id: `proj-${Date.now()}`,
      name: values.name,
      description: values.description,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    queryClient.setQueryData(qk.projects.list(), [newProject, ...currentProjects]);
    setSelectedProjectId(newProject.id);
  };

  const handleDeleteProject = (project) => {
    const currentProjects = queryClient.getQueryData(qk.projects.list()) || [];
    const nextProjects = currentProjects.filter((item) => item.id !== project.id);
    queryClient.setQueryData(qk.projects.list(), nextProjects);
    if (selectedProjectId === project.id) {
      setSelectedProjectId(nextProjects[0]?.id || null);
    }
    queryClient.removeQueries({ queryKey: qk.projects.detail(project.id) });
    toast.success(`Project "${project.name}" removed.`);
  };

  const handleEditProject = (project) => {
    setProjectDialogState({ open: true, project });
  };

  const handleTransactionSubmit = async (values) => {
    if (!selectedProjectId) return;
    const editingTransaction = transactionDialogState.transaction;
    const baseTransaction = {
      date: values.date,
      type: values.type === "income" ? "Income" : "Expense",
      description: values.description,
      subcategory: values.subcategory,
      amount: Number(values.amount),
    };

    if (editingTransaction) {
      const updatedTransaction = { ...editingTransaction, ...baseTransaction };
      queryClient.setQueryData(qk.projects.detail(selectedProjectId), (prev = []) =>
        prev.map((transaction) => (transaction.id === updatedTransaction.id ? updatedTransaction : transaction))
      );
      return;
    }

    const newTransaction = { id: `txn-${Date.now()}`, ...baseTransaction };
    queryClient.setQueryData(qk.projects.detail(selectedProjectId), (prev = []) => [newTransaction, ...(prev || [])]);
  };

  const handleDeleteTransaction = (transaction) => {
    if (!selectedProjectId) return;
    queryClient.setQueryData(qk.projects.detail(selectedProjectId), (prev = []) =>
      prev.filter((item) => item.id !== transaction.id)
    );
    toast.success("Transaction removed.");
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
            selectedProjectId={selectedProjectId}
            onSelect={(project) => setSelectedProjectId(project.id)}
            onAddProject={() => setProjectDialogState({ open: true, project: null })}
            onDeleteProject={handleDeleteProject}
            onEditProject={handleEditProject}
          />
        </div>
        <div className="min-h-[400px]">
          <TransactionTable
            project={selectedProject}
            transactions={transactions}
            isLoading={transactionsLoading}
            onAddTransaction={() => setTransactionDialogState({ open: true, transaction: null })}
            onEditTransaction={(transaction) => setTransactionDialogState({ open: true, transaction })}
            onDeleteTransaction={handleDeleteTransaction}
          />
        </div>
      </Card>

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
      />
    </div>
  );
}

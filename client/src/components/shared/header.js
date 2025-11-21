// File: src/components/shared/header.js
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, FileText, Folder, Loader2, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ThemeToggle from "@/components/shared/theme-toggle";
import UserNav from "@/components/shared/user-nav";
import Logo from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/query-keys";
import { listProjects, searchGlobalTransactions } from "@/lib/queries/projects";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

// Primary header component with public and dashboard variants.
export default function Header({ variant = "public", onMenuClick }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = Boolean(session?.user);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const hasSearchTerm = debouncedSearch.trim().length > 0;

  const projectsQuery = useQuery({
    queryKey: qk.projects.list({ search: debouncedSearch || undefined, limit: 5 }),
    queryFn: ({ signal }) =>
      listProjects({ search: debouncedSearch || undefined, limit: 5, signal }),
    enabled: isAuthenticated && hasSearchTerm,
  });

  const transactionsQuery = useQuery({
    queryKey: ["projects", "global-transactions", debouncedSearch],
    queryFn: ({ signal }) =>
      searchGlobalTransactions({ search: debouncedSearch || undefined, limit: 8, signal }),
    enabled: isAuthenticated && hasSearchTerm,
  });

  const projectResults = useMemo(
    () => projectsQuery.data?.projects ?? [],
    [projectsQuery.data]
  );

  const transactionResults = useMemo(
    () => transactionsQuery.data?.transactions ?? [],
    [transactionsQuery.data]
  );

  const isLoadingResults = projectsQuery.isFetching || transactionsQuery.isFetching;
  const hasResults = projectResults.length > 0 || transactionResults.length > 0;

  useEffect(() => {
    if (!searchTerm.trim()) {
      setIsSearchOpen(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (hasSearchTerm) {
      setIsSearchOpen(true);
      projectsQuery.refetch();
      transactionsQuery.refetch();
    }
  }, [hasSearchTerm, projectsQuery, transactionsQuery]);

  useEffect(() => {
    if (isSearchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isSearchOpen]);

  const handleProjectSelect = (projectId) => {
    if (!projectId) return;
    const params = new URLSearchParams({ projectId });
    router.push(`/projects?${params.toString()}`);
    setIsSearchOpen(false);
    setSearchTerm("");
  };

  const handleTransactionSelect = (transaction) => {
    if (!transaction?.projectId || !transaction?.id) return;
    const params = new URLSearchParams({
      projectId: transaction.projectId,
      transactionId: transaction.id,
    });
    router.push(`/projects?${params.toString()}`);
    setIsSearchOpen(false);
    setSearchTerm("");
  };

  const renderProjects = () => {
    if (!projectResults.length) return null;

    return (
      <div className="space-y-1">
        <p className="px-2 text-xs font-semibold uppercase text-muted-foreground">Projects</p>
        {projectResults.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => handleProjectSelect(project.id)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Folder className="h-4 w-4" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
              <p className="truncate text-xs text-muted-foreground">{project.currency || ""}</p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderTransactions = () => {
    if (!transactionResults.length) return null;

    return (
      <div className="space-y-1">
        <p className="px-2 text-xs font-semibold uppercase text-muted-foreground">Transactions</p>
        {transactionResults.map((transaction) => {
          const isIncome = transaction.type === "Income";

          return (
            <button
              key={transaction.id}
              type="button"
              onClick={() => handleTransactionSelect(transaction)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-foreground">
                  {transaction.description || transaction.subcategory}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {transaction.projectName || "Project"}
                </p>
              </div>
              <span
                className={cn(
                  "text-sm font-semibold",
                  isIncome ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {isIncome ? "+" : "-"}
                {Number(transaction.amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  if (variant === "dashboard") {
    return (
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background px-4 shadow-sm">
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <div
                className="relative hidden max-w-sm flex-1 items-center gap-2 md:flex"
                role="combobox"
                aria-expanded={isSearchOpen}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setIsSearchOpen(true);
                  requestAnimationFrame(() => {
                    searchInputRef.current?.focus();
                  });
                }}
              >
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search projects or transactions..."
                  aria-label="Search dashboard"
                  value={searchTerm}
                  ref={searchInputRef}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(event) => {
                    setIsSearchOpen(true);
                    setSearchTerm(event.target.value);
                  }}
                />
                {isLoadingResults ? (
                  <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="end">
              <div className="max-h-[420px] space-y-3 overflow-y-auto p-3">
                {!hasSearchTerm && (
                  <p className="px-2 text-sm text-muted-foreground">
                    Start typing to search across projects and transactions.
                  </p>
                )}
                {renderProjects()}
                {renderTransactions()}
                {hasSearchTerm && !hasResults && !isLoadingResults && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No results found.
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="View notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <UserNav />
        </div>
      </header>
    );
  }

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "/(public)/pricing".replace("/(public)", ""), label: "Pricing" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-foreground",
                pathname === link.href ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle size="icon" />
          {isAuthenticated ? (
            <Button asChild variant="outline" size="sm">
              <Link href={session?.user?.role === "admin" ? "/admin/dashboard" : "/dashboard"}>
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

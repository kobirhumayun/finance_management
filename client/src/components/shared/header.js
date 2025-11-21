// File: src/components/shared/header.js
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Menu, Search, Briefcase, FileText, Folder, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/shared/theme-toggle";
import UserNav from "@/components/shared/user-nav";
import Logo from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listProjects, searchGlobalTransactions } from "@/lib/queries/projects";

// Primary header component with public and dashboard variants.
export default function Header({ variant = "public", onMenuClick }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = Boolean(session?.user);

  // Search state
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [loading, setLoading] = React.useState(false);
  const [projects, setProjects] = React.useState([]);
  const [transactions, setTransactions] = React.useState([]);

  React.useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedSearch) {
        setProjects([]);
        setTransactions([]);
        return;
      }

      setLoading(true);
      try {
        const [projectsRes, transactionsRes] = await Promise.all([
          listProjects({ search: debouncedSearch, limit: 5 }),
          searchGlobalTransactions({ search: debouncedSearch }),
        ]);

        setProjects(projectsRes.projects || []);
        setTransactions(transactionsRes.transactions || []);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedSearch]);

  const handleSelectProject = (projectId) => {
    setOpen(false);
    router.push(`/projects/${projectId}`);
  };

  const handleSelectTransaction = (transaction) => {
    setOpen(false);
    router.push(`/projects/${transaction.projectId}?highlight=${transaction.id}`);
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
          <div className="relative hidden max-w-sm flex-1 items-center gap-2 md:flex">
             <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[300px] justify-between text-muted-foreground font-normal px-3"
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 shrink-0 opacity-50" />
                    <span>Search projects & transactions...</span>
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      className={cn(
                        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                      placeholder="Type to search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                     {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <CommandList>
                    {!loading && projects.length === 0 && transactions.length === 0 && debouncedSearch && (
                        <CommandEmpty>No results found.</CommandEmpty>
                    )}
                    {projects.length > 0 && (
                      <CommandGroup heading="Projects">
                        {projects.map((project) => (
                          <CommandItem
                            key={project.id}
                            value={project.name}
                            onSelect={() => handleSelectProject(project.id)}
                          >
                            <Folder className="mr-2 h-4 w-4" />
                            <div className="flex flex-col">
                                <span>{project.name}</span>
                                <span className="text-xs text-muted-foreground">{project.currency}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {projects.length > 0 && transactions.length > 0 && <CommandSeparator />}
                    {transactions.length > 0 && (
                      <CommandGroup heading="Transactions">
                        {transactions.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={t.description}
                            onSelect={() => handleSelectTransaction(t)}
                          >
                             {t.type === 'Income' ? <CreditCard className="mr-2 h-4 w-4 text-green-500" /> : <FileText className="mr-2 h-4 w-4 text-red-500" />}
                             <div className="flex flex-col w-full">
                                <div className="flex justify-between w-full">
                                    <span className="truncate max-w-[150px]">{t.description || "No description"}</span>
                                    <span className={t.type === 'Income' ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                        {t.amount}
                                    </span>
                                </div>
                                <div className="flex justify-between w-full text-xs text-muted-foreground">
                                    <span>{t.project?.name}</span>
                                    <span>{t.date}</span>
                                </div>
                             </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
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

// File: src/app/(admin)/admin/settings/page.js
"use client";

import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

// Administrative actions for platform maintenance.
export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="App settings"
        description="Trigger maintenance tasks and configure system-wide policies."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reload policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Refresh Casbin policies to ensure new permissions are immediately applied.
            </p>
            <Button onClick={() => toast.success("Policies reloaded (mock).")}>Reload policies</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sync plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pull the latest plan catalog from the backend service to keep pricing up to date.
            </p>
            <Button variant="outline" onClick={() => toast.info("Plan sync scheduled.")}>Sync now</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Export audit log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a CSV snapshot of recent admin changes for compliance review.
            </p>
            <Button variant="outline" onClick={() => toast.info("Audit log export queued.")}>Export log</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Toggle maintenance mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Temporarily disable user access while performing upgrades.
            </p>
            <Button variant="destructive" onClick={() => toast.warning("Maintenance mode activated (mock).")}>Activate</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { z } from "zod";
import { AppShell, type View } from "./app-shell";
import { WorkspaceProvider, useWorkspace } from "./workspace-provider";
import { ProjectsView, ScopeView } from "./project-views";
import { RequestsView } from "./request-list";
import { ComparisonView } from "./request-comparison";
import { QuoteView } from "./quote-view";
import { DecisionLog } from "./decision-log";
import { SettingsView } from "./settings-view";
import { EmptyState } from "./shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function App({ view }: { view: View }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const routeViews: Record<string, View> = {
    "/": "projects",
    "/requests": "requests",
    "/scope": "scope",
    "/compare": "compare",
    "/quote": "quote",
    "/decisions": "decisions",
    "/settings": "settings",
  };
  const currentView = routeViews[pathname.replace(/\/$/, "") || "/"] ?? view;
  const mode = params.get("workspace") ?? "demo";
  const projectId = params.get("projectId") ?? undefined;
  const requestId = params.get("requestId") ?? undefined;
  const revisionId = params.get("revisionId") ?? undefined;
  const invalid =
    (mode !== "demo" && mode !== "personal") ||
    (projectId && !z.uuid().safeParse(projectId).success) ||
    (requestId &&
      requestId !== "new" &&
      !z.uuid().safeParse(requestId).success) ||
    (revisionId && !z.uuid().safeParse(revisionId).success);
  if (invalid)
    return (
      <main className="invalid-link">
        <h1>This workspace link is invalid.</h1>
        <p>Open SpecScope again to choose a local workspace.</p>
        <Link href="/" prefetch={false}>
          Open SpecScope
        </Link>
      </main>
    );
  return (
    <WorkspaceProvider mode={mode as "demo" | "personal"} key={mode}>
      <Content
        view={currentView}
        projectId={projectId}
        requestId={requestId}
        revisionId={revisionId}
      />
    </WorkspaceProvider>
  );
}

function Content({
  view,
  projectId,
  requestId,
  revisionId,
}: {
  view: View;
  projectId?: string;
  requestId?: string;
  revisionId?: string;
}) {
  const context = useWorkspace();
  const request = context.workspace.requests.find(
    (item) => item.id === requestId,
  );
  let content: React.ReactNode;
  switch (view) {
    case "projects":
      content = <ProjectsView />;
      break;
    case "requests":
      content = <RequestsView projectId={projectId} />;
      break;
    case "scope":
      content = <ScopeView projectId={projectId} revisionId={revisionId} />;
      break;
    case "compare":
      content = <ComparisonView projectId={projectId} requestId={requestId} />;
      break;
    case "quote":
      content = <QuoteView requestId={requestId} />;
      break;
    case "decisions":
      content = <DecisionLog projectId={projectId} />;
      break;
    case "settings":
      content = <SettingsView />;
      break;
    default:
      content = (
        <EmptyState
          title="Screen not found"
          description="Choose a screen from the navigation."
        >
          <Button onClick={() => context.navigate(context.href("/"))}>
            Go to projects
          </Button>
        </EmptyState>
      );
  }
  return (
    <AppShell view={view} projectId={projectId ?? request?.projectId}>
      {content}
    </AppShell>
  );
}

export function AppPage({ view }: { view: View }) {
  return (
    <Suspense
      fallback={
        <div className="initial-loading" role="status">
          <h1>SpecScope</h1>
          <p>Opening your local workspace…</p>
          <Skeleton className="h-48 w-full max-w-lg" />
        </div>
      }
    >
      <App view={view} />
    </Suspense>
  );
}

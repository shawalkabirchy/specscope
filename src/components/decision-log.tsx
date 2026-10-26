"use client";

import { ArrowRight, GitBranch } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import {
  calendarDate,
  dateTime,
  EmptyState,
  PageHeading,
  ProjectSelect,
  StatusBadge,
} from "./shared";
import { statusLabels } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

export function DecisionLog({ projectId }: { projectId?: string }) {
  const context = useWorkspace();
  const { workspace } = context;
  const requests = new Map(
    workspace.requests.map((request) => [request.id, request]),
  );
  const projects = new Map(
    workspace.projects.map((project) => [project.id, project]),
  );
  const events = workspace.events
    .filter(
      (event) =>
        !projectId || requests.get(event.requestId)?.projectId === projectId,
    )
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <PageHeading
        title="A history you can stand behind."
        description="Every published quote and recorded decision, kept together with its context."
      />
      <div className="section-heading">
        <h2>
          Decision log <span className="subtle-count">{events.length}</span>
        </h2>
        <ProjectSelect
          value={projectId ?? ""}
          projects={workspace.projects}
          includeAll
          onChange={(id) =>
            context.navigate(context.href("/decisions/", { projectId: id }))
          }
        />
      </div>
      {events.length ? (
        <div className="decision-log">
          {events.map((event) => {
            const request = requests.get(event.requestId)!;
            const project = projects.get(request.projectId)!;
            return (
              <article className="surface decision-entry" key={event.id}>
                <div className="decision-entry-marker" aria-hidden="true">
                  <GitBranch />
                </div>
                <div className="decision-entry-body">
                  <div className="decision-entry-top">
                    <span className="muted">{project.name}</span>
                    <time dateTime={event.createdAt}>
                      {dateTime(
                        event.createdAt,
                        workspace.settings.timeZone,
                        true,
                      )}
                    </time>
                  </div>
                  <h3>{request.title}</h3>
                  <div className="decision-transition">
                    <span>{statusLabels[event.fromStatus]}</span>
                    <ArrowRight aria-hidden="true" />
                    <StatusBadge status={event.toStatus} />
                  </div>
                  <p className="preserve-text">
                    {event.note || "No additional note recorded."}
                  </p>
                  {event.toStatus === "accepted" ? (
                    <div className="decision-approval">
                      <strong>Approval recorded manually</strong>
                      <span>
                        {calendarDate(event.approvedOn!)} ·{" "}
                        {event.approvalReference}
                      </span>
                    </div>
                  ) : null}
                  <Button
                    variant="link"
                    onClick={() =>
                      context.navigate(
                        context.href("/quote/", { requestId: request.id }),
                      )
                    }
                  >
                    View frozen quote
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="The story starts with a published quote"
          description="Publishing a quote creates the first event. Acceptances, rejections, and deferrals will follow here."
        >
          <Button onClick={() => context.navigate(context.href("/requests/"))}>
            Review requests
            <ArrowRight data-icon="inline-end" />
          </Button>
        </EmptyState>
      )}
    </>
  );
}

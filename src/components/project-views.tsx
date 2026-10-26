"use client";

import { useState } from "react";
import {
  Archive,
  ArrowRight,
  FilePlus2,
  FolderOpen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import {
  dateTime,
  EmptyState,
  fieldError,
  FormField,
  PageHeading,
  ProjectSelect,
} from "./shared";
import { RequestTable } from "./request-list";
import { useLocalForm } from "@/hooks/use-local-form";
import { type Deliverable, type Project } from "@/lib/schema";
import { moneyInput, parseMoney, formatMoney } from "@/lib/money";
import { archiveProject, saveProject, saveScope } from "@/lib/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export function ProjectsView() {
  const context = useWorkspace();
  const { workspace, saving } = context;
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const projects = workspace.projects.filter(
    (project) => project.archived === showArchived,
  );
  const recent = workspace.requests
    .filter(
      (request) =>
        !workspace.projects.find((project) => project.id === request.projectId)
          ?.archived,
    )
    .slice(0, 5);
  return (
    <>
      <PageHeading
        title="Good work starts with clear scope."
        description="Keep your agreements, requests, and next steps in one thoughtful workspace."
        action={
          <Button
            size="lg"
            onClick={() => setEditing("new")}
            disabled={saving || workspace.projects.length >= 50}
          >
            <Plus data-icon="inline-start" />
            New project
          </Button>
        }
      />
      {context.mode === "demo" ? (
        <div className="demo-feature">
          <div className="feature-icon" aria-hidden="true">
            <FolderOpen />
          </div>
          <div>
            <h2>A small request. A bigger conversation.</h2>
            <p>
              See how an extra dashboard becomes a clear decision and a
              documented quote.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              context.navigate(
                context.href("/compare/", {
                  requestId: "10000000-0000-4000-8000-000000000101",
                }),
              )
            }
          >
            Explore the example
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
      <section className="section-block" aria-labelledby="projects-title">
        <div className="section-heading">
          <h2 id="projects-title">
            Your projects{" "}
            <span className="subtle-count">{projects.length}</span>
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Show active" : "View archived"}
          </Button>
        </div>
        {projects.length ? (
          <div className="project-grid">
            {projects.map((project) => {
              const requests = workspace.requests.filter(
                (request) => request.projectId === project.id,
              );
              const scopes = workspace.scopes.filter(
                (scope) => scope.projectId === project.id,
              );
              return (
                <article className="project-panel" key={project.id}>
                  <div className="project-panel-top">
                    <span className="project-initial" aria-hidden="true">
                      {project.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="inline-actions">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={"Edit " + project.name}
                        onClick={() => setEditing(project)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={
                          (project.archived ? "Restore " : "Archive ") +
                          project.name
                        }
                        disabled={saving}
                        onClick={async () => {
                          if (
                            await context.confirm({
                              title: project.archived
                                ? "Restore this project?"
                                : "Archive this project?",
                              description: project.archived
                                ? "You will be able to add scope revisions and requests again."
                                : "Its scope, quotes, and decision history will be preserved. You can restore it later.",
                              action: project.archived
                                ? "Restore project"
                                : "Archive project",
                            })
                          )
                            await context.commit((current) =>
                              archiveProject(current, project.id),
                            );
                        }}
                      >
                        {project.archived ? <RotateCcw /> : <Archive />}
                      </Button>
                    </div>
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.clientAlias}</p>
                  <div className="project-meta">
                    <span>
                      {requests.length} request
                      {requests.length === 1 ? "" : "s"}
                    </span>
                    <span>
                      {scopes.length
                        ? "Scope revision " +
                          Math.max(...scopes.map((scope) => scope.revision))
                        : "Scope not added"}
                    </span>
                  </div>
                  <Separator />
                  <div className="project-panel-bottom">
                    <span>
                      {formatMoney(project.hourlyRateMinor, project.currency)}
                      <small> / hour</small>
                    </span>
                    <Button
                      variant="link"
                      onClick={() =>
                        context.navigate(
                          context.href(
                            scopes.length ? "/requests/" : "/scope/",
                            { projectId: project.id },
                          ),
                        )
                      }
                    >
                      Open project
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={
              showArchived
                ? "No archived projects"
                : "A clean start for your next project"
            }
            description={
              showArchived
                ? "Archived projects will appear here with their full history."
                : "Add a project and its agreed deliverables, then bring in your first client request."
            }
          >
            {!showArchived ? (
              <Button onClick={() => setEditing("new")}>
                <Plus data-icon="inline-start" />
                Create your first project
              </Button>
            ) : null}
          </EmptyState>
        )}
      </section>
      {recent.length && !showArchived ? (
        <section className="section-block">
          <div className="section-heading">
            <h2>Recent requests</h2>
            <Button
              variant="link"
              onClick={() => context.navigate(context.href("/requests/"))}
            >
              View all requests
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <RequestTable requests={recent} />
        </section>
      ) : null}
      <Dialog
        open={editing !== null}
        onOpenChange={async (open) => {
          if (!open) {
            if (
              await context.confirm({
                title: "Close project editor?",
                description:
                  "Unsaved fields stay in this tab until you return, or you can save the project first.",
                action: "Close editor",
              })
            )
              setEditing(null);
          }
        }}
      >
        <DialogContent className="project-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Start a new project" : "Edit project"}
            </DialogTitle>
            <DialogDescription>
              Set the project details before documenting requests.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <ProjectForm
              key={typeof editing === "string" ? "new" : editing.id}
              project={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectForm({
  project,
  onDone,
}: {
  project?: Project;
  onDone: () => void;
}) {
  const context = useWorkspace();
  const [id] = useState(() => project?.id ?? crypto.randomUUID());
  const form = useLocalForm(
    context.mode + ":project:" + (project?.id ?? "new"),
    {
      name: project?.name ?? "",
      clientAlias: project?.clientAlias ?? "",
      currency: project?.currency ?? ("USD" as "USD" | "BDT"),
      rate: project ? moneyInput(project.hourlyRateMinor) : "60.00",
    },
    context.workspace.revision,
  );
  const value = form.value;
  const props = (field: string) => ({
    "aria-invalid": !!fieldError(context.error, field),
    "aria-describedby": fieldError(context.error, field)
      ? "project-" + field + "-error"
      : undefined,
  });
  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await context.commit(
          (current) =>
            saveProject(current, {
              id,
              name: value.name,
              clientAlias: value.clientAlias,
              currency: value.currency,
              hourlyRateMinor: parseMoney(value.rate),
            }),
          form.revision,
        );
        if (result) {
          form.saved(value, result.revision);
          onDone();
        }
      }}
    >
      <FieldGroup>
        <FormField
          id="project-name"
          label="Project name"
          error={fieldError(context.error, "name")}
        >
          <Input
            id="project-name"
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. Meridian website"
            value={value.name}
            onChange={(event) =>
              form.update({ ...value, name: event.target.value })
            }
            {...props("name")}
          />
        </FormField>
        <FormField
          id="project-clientAlias"
          label="Client alias"
          hint="Use an alias rather than private contact details."
          error={fieldError(context.error, "clientAlias")}
        >
          <Input
            id="project-clientAlias"
            maxLength={80}
            value={value.clientAlias}
            onChange={(event) =>
              form.update({ ...value, clientAlias: event.target.value })
            }
            {...props("clientAlias")}
          />
        </FormField>
        <div className="form-columns">
          <FormField
            id="project-currency"
            label="Currency"
            hint={
              project
                ? "Locked after project creation."
                : "Choose before adding financial records."
            }
          >
            <NativeSelect
              id="project-currency"
              value={value.currency}
              disabled={!!project}
              onChange={(event) =>
                form.update({
                  ...value,
                  currency: event.target.value as "USD" | "BDT",
                })
              }
            >
              <NativeSelectOption value="USD">
                USD — US dollar
              </NativeSelectOption>
              <NativeSelectOption value="BDT">
                BDT — Bangladeshi taka
              </NativeSelectOption>
            </NativeSelect>
          </FormField>
          <FormField
            id="project-hourlyRateMinor"
            label="Hourly rate"
            hint="Future drafts use the current rate."
            error={fieldError(context.error, "hourlyRateMinor")}
          >
            <Input
              id="project-hourlyRateMinor"
              inputMode="decimal"
              value={value.rate}
              onChange={(event) =>
                form.update({ ...value, rate: event.target.value })
              }
              {...props("hourlyRateMinor")}
            />
          </FormField>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (
                !form.dirty ||
                (await context.confirm({
                  title: "Close without saving?",
                  description:
                    "Your unsaved project fields will stay in this tab. Return to this editor to continue.",
                  action: "Close editor",
                }))
              )
                onDone();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={context.saving}>
            {context.saving
              ? "Saving…"
              : project
                ? "Save project"
                : "Create project"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

export function ScopeView({
  projectId,
  revisionId,
}: {
  projectId?: string;
  revisionId?: string;
}) {
  const context = useWorkspace();
  const { workspace } = context;
  const [editing, setEditing] = useState(false);
  const project =
    workspace.projects.find((item) => item.id === projectId) ??
    (!projectId ? workspace.projects[0] : undefined);
  if (!project)
    return (
      <>
        <PageHeading
          title="Scope history"
          description="A clear record of what was agreed, and when."
        />
        <EmptyState
          title={projectId ? "Project not found" : "Start with a project"}
          description="Create a project before recording its agreed scope."
        >
          <Button onClick={() => context.navigate(context.href("/"))}>
            Go to projects
          </Button>
        </EmptyState>
      </>
    );
  const scopes = workspace.scopes
    .filter((scope) => scope.projectId === project.id)
    .toSorted((a, b) => b.revision - a.revision);
  const selected = scopes.find((scope) => scope.id === revisionId) ?? scopes[0];
  return (
    <>
      <PageHeading
        title="An agreement you can come back to."
        description="Each saved revision preserves the scope exactly as it was recorded."
        action={
          <Button
            disabled={project.archived || scopes.length >= 20}
            onClick={() => setEditing(true)}
          >
            <Plus data-icon="inline-start" />
            {scopes.length ? "New scope revision" : "Add agreed scope"}
          </Button>
        }
      />
      <div className="context-strip">
        <div>
          <strong>{project.name}</strong>
          <span>Client: {project.clientAlias}</span>
        </div>
        <ProjectSelect
          value={project.id}
          projects={workspace.projects}
          onChange={(id) => {
            setEditing(false);
            void context.navigate(context.href("/scope/", { projectId: id }));
          }}
        />
      </div>
      {editing || !selected ? (
        <ScopeForm
          key={project.id + ":" + (selected?.id ?? "first")}
          project={project}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="history-layout">
          <aside className="revision-list" aria-label="Scope revisions">
            {scopes.map((scope) => (
              <button
                key={scope.id}
                className={
                  scope.id === selected.id
                    ? "revision-item selected"
                    : "revision-item"
                }
                onClick={() =>
                  context.navigate(
                    context.href("/scope/", {
                      projectId: project.id,
                      revisionId: scope.id,
                    }),
                  )
                }
              >
                <span>
                  Revision {scope.revision}
                  {scope.id === scopes[0]?.id ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : null}
                </span>
                <small>
                  {dateTime(scope.createdAt, workspace.settings.timeZone)}
                </small>
                <small>{scope.deliverables.length} deliverables</small>
              </button>
            ))}
          </aside>
          <article className="surface scope-document">
            <div className="section-heading">
              <div>
                <h2>Scope revision {selected.revision}</h2>
                <p className="muted">
                  Saved{" "}
                  {dateTime(selected.createdAt, workspace.settings.timeZone)}
                </p>
              </div>
              <Badge variant="outline">Immutable revision</Badge>
            </div>
            <h3>Agreed deliverables</h3>
            <div className="scope-deliverables">
              {selected.deliverables.map((item, index) => (
                <div key={item.id} className="scope-deliverable">
                  <span className="deliverable-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>
                      {item.description || "No further description recorded."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <h3>Original agreed scope</h3>
            <p className="preserve-text original-scope">
              {selected.originalScopeText || "No original scope text recorded."}
            </p>
            <div className="inline-actions">
              <Button
                variant="outline"
                onClick={() =>
                  context.navigate(
                    context.href("/requests/", { projectId: project.id }),
                  )
                }
              >
                <FilePlus2 data-icon="inline-start" />
                Review requests
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </article>
        </div>
      )}
    </>
  );
}

function ScopeForm({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const context = useWorkspace();
  const latest = context.workspace.scopes
    .filter((scope) => scope.projectId === project.id)
    .toSorted((a, b) => b.revision - a.revision)[0];
  const [initial] = useState(() => ({
    originalScopeText: latest?.originalScopeText ?? "",
    deliverables: structuredClone(
      latest?.deliverables ?? [
        { id: crypto.randomUUID(), title: "", description: "" },
      ],
    ),
  }));
  const form = useLocalForm(
    context.mode + ":scope:" + project.id,
    initial,
    context.workspace.revision,
  );
  const value = form.value;
  function updateDeliverable(
    id: string,
    field: "title" | "description",
    text: string,
  ) {
    form.update({
      ...value,
      deliverables: value.deliverables.map((item) =>
        item.id === id ? { ...item, [field]: text } : item,
      ),
    });
  }
  return (
    <form
      className="surface scope-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await context.commit(
          (current) =>
            saveScope(
              current,
              project.id,
              value.originalScopeText,
              value.deliverables,
            ),
          form.revision,
        );
        if (result) {
          form.saved(value, result.revision);
          onDone();
        }
      }}
    >
      <div className="section-heading">
        <div>
          <h2>
            {latest
              ? "Create scope revision " + (latest.revision + 1)
              : "Record the agreed scope"}
          </h2>
          <p className="muted">
            {latest
              ? "Earlier revisions and their requests will stay unchanged."
              : "Break the agreement into deliverables you can reference later."}
          </p>
        </div>
        {form.dirty ? <Badge variant="outline">Not saved</Badge> : null}
      </div>
      <FieldGroup>
        <FormField
          id="scope-original"
          label="Original agreed scope"
          hint="Paste or write the agreement in your own words. Up to 10,000 characters."
          error={fieldError(context.error, "originalScopeText")}
        >
          <Textarea
            id="scope-original"
            rows={5}
            maxLength={10_000}
            value={value.originalScopeText}
            onChange={(event) =>
              form.update({ ...value, originalScopeText: event.target.value })
            }
            aria-invalid={!!fieldError(context.error, "originalScopeText")}
          />
        </FormField>
        <section className="editable-deliverables">
          <div className="section-heading">
            <h3>Deliverables</h3>
            <span className="muted">{value.deliverables.length} / 50</span>
          </div>
          {value.deliverables.map((item, index) => {
            const titleError =
              context.error?.fieldErrors["deliverables." + index + ".title"];
            const descriptionError =
              context.error?.fieldErrors[
                "deliverables." + index + ".description"
              ];
            return (
              <div className="editable-deliverable" key={item.id}>
                <span className="deliverable-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <FieldGroup>
                  <FormField
                    id={"delivery-title-" + item.id}
                    label={"Deliverable " + (index + 1) + " title"}
                    error={titleError}
                  >
                    <Input
                      id={"delivery-title-" + item.id}
                      maxLength={80}
                      value={item.title}
                      placeholder="e.g. Marketing website"
                      onChange={(event) =>
                        updateDeliverable(item.id, "title", event.target.value)
                      }
                      aria-invalid={!!titleError}
                      aria-describedby={
                        titleError
                          ? "delivery-title-" + item.id + "-error"
                          : undefined
                      }
                    />
                  </FormField>
                  <FormField
                    id={"delivery-description-" + item.id}
                    label="Description"
                    error={descriptionError}
                  >
                    <Textarea
                      id={"delivery-description-" + item.id}
                      maxLength={500}
                      rows={2}
                      value={item.description}
                      onChange={(event) =>
                        updateDeliverable(
                          item.id,
                          "description",
                          event.target.value,
                        )
                      }
                      aria-invalid={!!descriptionError}
                    />
                  </FormField>
                </FieldGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={"Remove deliverable " + (index + 1)}
                  disabled={value.deliverables.length <= 1}
                  onClick={() =>
                    form.update({
                      ...value,
                      deliverables: value.deliverables.filter(
                        (delivery) => delivery.id !== item.id,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            disabled={value.deliverables.length >= 50}
            onClick={() => {
              const delivery: Deliverable = {
                id: crypto.randomUUID(),
                title: "",
                description: "",
              };
              form.update({
                ...value,
                deliverables: [...value.deliverables, delivery],
              });
            }}
          >
            <Plus data-icon="inline-start" />
            Add deliverable
          </Button>
        </section>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => context.navigate(context.href("/"))}
          >
            Back to projects
          </Button>
          <Button type="submit" disabled={context.saving || project.archived}>
            {context.saving ? "Saving…" : "Save scope revision"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

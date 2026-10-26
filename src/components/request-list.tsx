"use client";

import { useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import { type ChangeRequest } from "@/lib/schema";
import { classificationLabels } from "@/lib/workspace";
import { estimateFee, formatMoney } from "@/lib/money";
import { useWorkspace } from "./workspace-provider";
import {
  dateTime,
  EmptyState,
  PageHeading,
  ProjectSelect,
  StatusBadge,
} from "./shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function NewRequestButton({ projectId }: { projectId?: string }) {
  const context = useWorkspace();
  const projects = context.workspace.projects.filter(
    (project) => !project.archived,
  );
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(projectId ?? projects[0]?.id ?? "");
  const hasScope = context.workspace.scopes.some(
    (scope) => scope.projectId === selected,
  );
  function create(id: string) {
    setOpen(false);
    void context.navigate(
      context.href("/compare/", { requestId: "new", projectId: id }),
    );
  }
  return (
    <>
      <Button
        disabled={
          context.saving ||
          context.workspace.requests.length >= 1_000 ||
          !projects.length ||
          (!!projectId && !projects.some((project) => project.id === projectId))
        }
        onClick={() => {
          if (
            projectId &&
            context.workspace.scopes.some(
              (scope) => scope.projectId === projectId,
            )
          )
            create(projectId);
          else setOpen(true);
        }}
      >
        <Plus data-icon="inline-start" />
        New request
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which project is this for?</DialogTitle>
            <DialogDescription>
              Every request is compared with an agreed scope revision.
            </DialogDescription>
          </DialogHeader>
          <ProjectSelect
            label="Project for new request"
            projects={projects}
            value={selected}
            onChange={setSelected}
          />
          {hasScope ? (
            <Button onClick={() => create(selected)}>
              Continue
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <>
              <p className="muted">
                Add this project’s agreed scope before creating a request.
              </p>
              <Button
                onClick={() => {
                  setOpen(false);
                  void context.navigate(
                    context.href("/scope/", { projectId: selected }),
                  );
                }}
              >
                Add agreed scope
                <ArrowRight data-icon="inline-end" />
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RequestTable({ requests }: { requests: ChangeRequest[] }) {
  const context = useWorkspace();
  const { workspace } = context;
  const projects = new Map(
    workspace.projects.map((project) => [project.id, project]),
  );
  const quotes = new Map(
    workspace.quotes.map((quote) => [quote.requestId, quote]),
  );
  return (
    <div className="surface request-table">
      <Table>
        <caption className="sr-only">
          Change requests with their human scope decisions, proposed fees, and
          current status.
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead>Scope decision</TableHead>
            <TableHead>Additional fee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>
              <span className="sr-only">Open request</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => {
            const project = projects.get(request.projectId)!;
            const quote = quotes.get(request.id);
            let fee =
              request.classification === "within"
                ? formatMoney(0, project.currency)
                : "Not quoted";
            if (quote) fee = formatMoney(quote.feeMinor, quote.currency);
            else if (
              request.classification === "additional" &&
              request.estimatedMinutes
            )
              fee = formatMoney(
                estimateFee(
                  "additional",
                  request.estimatedMinutes,
                  project.hourlyRateMinor,
                ).feeMinor,
                project.currency,
              );
            const href = context.href(
              request.status === "draft" ? "/compare/" : "/quote/",
              { requestId: request.id },
            );
            return (
              <TableRow key={request.id}>
                <TableCell>
                  <a
                    tabIndex={0}
                    href={href}
                    className="request-title"
                    onClick={(event) => {
                      event.preventDefault();
                      void context.navigate(href);
                    }}
                  >
                    {request.title}
                  </a>
                  <span className="table-secondary">
                    {project.name}
                    {request.supersedesRequestId ? " · revised request" : ""}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className="classification-label"
                    data-classification={request.classification}
                  >
                    <span className="classification-dot" aria-hidden="true" />
                    {classificationLabels[request.classification]}
                  </span>
                </TableCell>
                <TableCell className="fee-cell">{fee}</TableCell>
                <TableCell>
                  <StatusBadge status={request.status} />
                </TableCell>
                <TableCell>
                  <span className="muted">
                    {dateTime(request.updatedAt, workspace.settings.timeZone)}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={"Open " + request.title}
                    onClick={() => context.navigate(href)}
                  >
                    <ArrowRight />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function RequestsView({ projectId }: { projectId?: string }) {
  const context = useWorkspace();
  const { workspace } = context;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const project = workspace.projects.find((item) => item.id === projectId);
  if (projectId && !project)
    return (
      <EmptyState
        title="Project not found"
        description="This link does not point to a project in this browser’s workspace."
      >
        <Button onClick={() => context.navigate(context.href("/"))}>
          Go to projects
        </Button>
      </EmptyState>
    );
  const all = workspace.requests
    .filter(
      (request) =>
        (!projectId || request.projectId === projectId) &&
        (status === "all" || request.status === status) &&
        (request.title + " " + request.requestText)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    )
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pageCount = Math.max(1, Math.ceil(all.length / 25));
  const currentPage = Math.min(page, pageCount);
  const requests = all.slice((currentPage - 1) * 25, currentPage * 25);
  return (
    <>
      <PageHeading
        title={
          project ? project.name : "Every request deserves a clear answer."
        }
        description={
          project
            ? "Client: " +
              project.clientAlias +
              ". Compare requests, prepare quotes, and keep the agreement clear."
            : "Bring the request into focus, then decide the right next step."
        }
        action={<NewRequestButton projectId={projectId} />}
      />
      <div className="request-toolbar">
        <div className="search-control">
          <Search aria-hidden="true" />
          <Input
            aria-label="Search requests"
            placeholder="Search requests…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="filter-controls">
          <ProjectSelect
            value={projectId ?? ""}
            projects={workspace.projects}
            includeAll
            onChange={(id) =>
              context.navigate(context.href("/requests/", { projectId: id }))
            }
          />
          <NativeSelect
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <NativeSelectOption value="all">All statuses</NativeSelectOption>
            {["draft", "quoted", "accepted", "rejected", "deferred"].map(
              (value) => (
                <NativeSelectOption key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </div>
      </div>
      {requests.length ? (
        <>
          <RequestTable requests={requests} />
          <div className="pagination">
            <span>
              {all.length} request{all.length === 1 ? "" : "s"} · Page{" "}
              {currentPage} of {pageCount}
            </span>
            <div className="inline-actions">
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Next page"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title={
            search || status !== "all"
              ? "No matching requests"
              : "Your next clear conversation starts here"
          }
          description={
            search || status !== "all"
              ? "Try another search or status filter."
              : "Add a client request and compare it with the deliverables you agreed."
          }
        >
          {!workspace.projects.length ? (
            <Button onClick={() => context.navigate(context.href("/"))}>
              Create a project first
            </Button>
          ) : null}
        </EmptyState>
      )}
      <div className="quiet-note">
        Scope decisions are always yours. SpecScope records your reasoning and
        keeps the history intact.
      </div>
    </>
  );
}

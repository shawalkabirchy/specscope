import { AppError, readableError } from "./errors";
import { estimateFee } from "./money";
import { backupSchema, workspaceSchema, type Workspace } from "./schema";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function backupEnvelope(
  workspace: Workspace,
  exportedAt = new Date().toISOString(),
) {
  return {
    appId: "P06" as const,
    formatVersion: 1 as const,
    exportedAt,
    payload: workspace,
  };
}

export function backupBytes(workspace: Workspace): number {
  return new TextEncoder().encode(JSON.stringify(backupEnvelope(workspace)))
    .byteLength;
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AppError("VALIDATION_ERROR", message);
}

function uniqueIds(records: { id: string }[], label: string) {
  invariant(
    new Set(records.map((record) => record.id)).size === records.length,
    "Duplicate " + label + " identifiers.",
  );
}

function checkRecordCounts(input: unknown) {
  if (!input || typeof input !== "object") return;
  const raw = input as Record<string, unknown>;
  const limit = (value: unknown, maximum: number, label: string) => {
    if (Array.isArray(value) && value.length > maximum)
      throw new AppError(
        "VALIDATION_ERROR",
        "The maximum number of " +
          label +
          " is " +
          maximum.toLocaleString("en-US") +
          ".",
      );
  };
  limit(raw.projects, 50, "projects");
  limit(raw.scopes, 1_000, "scope revisions");
  limit(raw.requests, 1_000, "requests");
  limit(raw.quotes, 1_000, "quote snapshots");
  limit(raw.events, 2_000, "decision events");
  if (Array.isArray(raw.scopes))
    for (const scope of raw.scopes)
      if (scope && typeof scope === "object")
        limit(scope.deliverables, 50, "deliverables per scope revision");
  if (Array.isArray(raw.requests))
    for (const request of raw.requests)
      if (request && typeof request === "object")
        limit(request.linkedDeliverableIds, 50, "linked deliverables");
  if (Array.isArray(raw.quotes))
    for (const quote of raw.quotes)
      if (quote && typeof quote === "object")
        limit(quote.deliverableSnapshots, 50, "frozen deliverables");
}

export function validateWorkspace(
  input: unknown,
  enforceSize = true,
): Workspace {
  // Reject excessive arrays before deep parsing can allocate an error for every item.
  checkRecordCounts(input);
  const workspace = workspaceSchema.parse(input);
  const { projects, scopes, requests, quotes, events } = workspace;
  uniqueIds(projects, "project");
  uniqueIds(scopes, "scope revision");
  uniqueIds(requests, "request");
  uniqueIds(events, "decision event");
  const allIds = [...projects, ...scopes, ...requests, ...events].map(
    (record) => record.id,
  );
  invariant(
    new Set(allIds).size === allIds.length,
    "Entity identifiers must be unique throughout the workspace.",
  );
  invariant(
    new Set(quotes.map((quote) => quote.requestId)).size === quotes.length,
    "A request can have only one quote snapshot.",
  );
  const projectMap = new Map(projects.map((record) => [record.id, record]));
  const scopeMap = new Map(scopes.map((record) => [record.id, record]));
  const requestMap = new Map(requests.map((record) => [record.id, record]));
  const quoteMap = new Map(quotes.map((record) => [record.requestId, record]));
  const scopeCounts = new Map<string, number>();
  const scopeVersions = new Set<string>();
  const history = new Map<string, typeof events>();
  for (const event of events) {
    const list = history.get(event.requestId) ?? [];
    list.push(event);
    history.set(event.requestId, list);
  }
  for (const project of projects)
    invariant(
      project.createdAt <= project.updatedAt,
      "Project timestamps are out of order.",
    );
  for (const scope of scopes) {
    invariant(
      projectMap.has(scope.projectId),
      "A scope revision references a missing project.",
    );
    uniqueIds(scope.deliverables, "deliverable");
    const key = scope.projectId + ":" + scope.revision;
    invariant(
      !scopeVersions.has(key),
      "Scope revision numbers must be unique within a project.",
    );
    scopeVersions.add(key);
    const count = (scopeCounts.get(scope.projectId) ?? 0) + 1;
    invariant(count <= 20, "A project can have at most 20 scope revisions.");
    scopeCounts.set(scope.projectId, count);
  }
  for (const request of requests) {
    invariant(
      projectMap.has(request.projectId),
      "A request references a missing project.",
    );
    const scope = scopeMap.get(request.scopeRevisionId);
    invariant(
      scope && scope.projectId === request.projectId,
      "A request must reference a scope in its own project.",
    );
    const deliverables = new Set(scope.deliverables.map((item) => item.id));
    invariant(
      new Set(request.linkedDeliverableIds).size ===
        request.linkedDeliverableIds.length,
      "Linked deliverables must be unique.",
    );
    invariant(
      request.linkedDeliverableIds.every((id) => deliverables.has(id)),
      "A linked deliverable is not in the selected scope revision.",
    );
    invariant(
      request.createdAt <= request.updatedAt,
      "Request timestamps are out of order.",
    );
    if (request.supersedesRequestId) {
      const original = requestMap.get(request.supersedesRequestId);
      invariant(
        original &&
          original.projectId === request.projectId &&
          original.status !== "draft" &&
          original.id !== request.id &&
          original.createdAt <= request.createdAt,
        "A revision must supersede an earlier published request in the same project.",
      );
      invariant(
        (quoteMap.get(original.id)?.quotedAt ?? "") <= request.createdAt &&
          quoteMap.has(original.id),
        "A revision must be created after its original quote was published.",
      );
      const seen = new Set([request.id]);
      let ancestor = original;
      while (ancestor) {
        invariant(
          !seen.has(ancestor.id),
          "Request revisions cannot form a cycle.",
        );
        seen.add(ancestor.id);
        if (!ancestor.supersedesRequestId) break;
        ancestor = requestMap.get(ancestor.supersedesRequestId)!;
      }
    }
    const quote = quoteMap.get(request.id);
    const requestEvents = (history.get(request.id) ?? []).toSorted(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        (a.fromStatus === "draft" ? -1 : 1),
    );
    if (request.status === "draft") {
      invariant(
        !quote && requestEvents.length === 0,
        "A draft cannot contain published quote evidence.",
      );
      continue;
    }
    invariant(quote, "Every published request must have a quote snapshot.");
    invariant(
      request.classification !== "clarify" &&
        request.reason.trim().length > 0 &&
        request.requestText.trim().length > 0,
      "A published request needs a classification, request text, and decision reason.",
    );
    invariant(
      quote.scopeRevisionId === request.scopeRevisionId &&
        quote.requestText === request.requestText &&
        quote.classification === request.classification &&
        quote.reason === request.reason &&
        quote.responseText === request.responseText &&
        quote.requestTitle === request.title &&
        quote.estimatedMinutes === request.estimatedMinutes,
      "A published request differs from its frozen quote snapshot.",
    );
    invariant(
      quote.currency === projectMap.get(request.projectId)!.currency,
      "A quote currency must match its project.",
    );
    const linkedSnapshots = request.linkedDeliverableIds.map((id) =>
      scope.deliverables.find((item) => item.id === id),
    );
    invariant(
      JSON.stringify(linkedSnapshots) ===
        JSON.stringify(quote.deliverableSnapshots),
      "The frozen deliverables do not match the selected scope.",
    );
    const expected = estimateFee(
      quote.classification,
      quote.estimatedMinutes,
      quote.hourlyRateMinor,
    );
    invariant(
      quote.billableMinutes === expected.billableMinutes &&
        quote.feeMinor === expected.feeMinor,
      "A quote has inconsistent rounded minutes or fee.",
    );
    invariant(
      quote.quotedAt >= request.createdAt &&
        quote.quotedAt <= request.updatedAt,
      "Quote timestamps are inconsistent.",
    );
    invariant(
      requestEvents.length === (request.status === "quoted" ? 1 : 2),
      "The decision history does not match the request status.",
    );
    const published = requestEvents[0];
    invariant(
      published.fromStatus === "draft" &&
        published.toStatus === "quoted" &&
        published.createdAt === quote.quotedAt,
      "The quote publication event is missing or inconsistent.",
    );
    if (request.status !== "quoted") {
      const terminal = requestEvents[1];
      invariant(
        terminal.fromStatus === "quoted" &&
          terminal.toStatus === request.status &&
          terminal.createdAt >= published.createdAt &&
          terminal.createdAt <= request.updatedAt,
        "The final decision event is inconsistent.",
      );
    }
  }
  for (const quote of quotes)
    invariant(
      requestMap.has(quote.requestId),
      "A quote references a missing request.",
    );
  for (const event of events) {
    invariant(
      requestMap.has(event.requestId),
      "A decision references a missing request.",
    );
    invariant(
      (event.fromStatus === "draft" && event.toStatus === "quoted") ||
        (event.fromStatus === "quoted" &&
          ["accepted", "rejected", "deferred"].includes(event.toStatus)),
      "The decision history contains an invalid transition.",
    );
    if (event.toStatus === "accepted")
      invariant(
        event.approvalReference && event.approvedOn,
        "Acceptance requires an approval reference and date.",
      );
    else
      invariant(
        !event.approvalReference && !event.approvedOn,
        "Approval fields belong only to an acceptance event.",
      );
  }
  if (enforceSize && backupBytes(workspace) > MAX_BACKUP_BYTES) {
    throw new AppError(
      "WORKSPACE_LIMIT",
      "This change would exceed the 10 MiB workspace and backup limit. Your previous data is safe. Copy your unsaved text before reducing it.",
    );
  }
  return workspace;
}

export function parseBackup(text: string): Workspace {
  try {
    if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
      throw new Error("The backup exceeds 10 MiB.");
    const backup = backupSchema.parse(JSON.parse(text));
    return validateWorkspace(backup.payload);
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "This file is not valid JSON."
        : error instanceof AppError
          ? error.message
          : error instanceof Error &&
              error.message === "The backup exceeds 10 MiB."
            ? error.message
            : "The backup has an unsupported app/version or invalid records.";
    throw new AppError(
      "IMPORT_INVALID",
      message,
      error instanceof AppError
        ? error.fieldErrors
        : readableError(error).fieldErrors,
    );
  }
}

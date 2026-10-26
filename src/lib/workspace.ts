import { AppError } from "./errors";
import { estimateFee, formatMinutes, formatMoney } from "./money";
import {
  decisionSchema,
  projectSchema,
  requestSchema,
  scopeSchema,
  type ChangeRequest,
  type Classification,
  type Deliverable,
  type Project,
  type RequestStatus,
  type Workspace,
} from "./schema";

export function emptyWorkspace(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Workspace {
  return {
    revision: 0,
    projects: [],
    scopes: [],
    requests: [],
    quotes: [],
    events: [],
    settings: { timeZone },
  };
}

export function getProject(workspace: Workspace, id: string): Project {
  const project = workspace.projects.find((item) => item.id === id);
  if (!project)
    throw new AppError("VALIDATION_ERROR", "This project no longer exists.");
  return project;
}

export function saveProject(
  workspace: Workspace,
  input: Pick<
    Project,
    "id" | "name" | "clientAlias" | "currency" | "hourlyRateMinor"
  >,
): Workspace {
  const next = structuredClone(workspace);
  const existing = next.projects.find((item) => item.id === input.id);
  if (existing && existing.currency !== input.currency)
    throw new AppError(
      "VALIDATION_ERROR",
      "Project currency is locked because its hourly rate is a financial record.",
    );
  if (!existing && next.projects.length >= 50)
    throw new AppError(
      "VALIDATION_ERROR",
      "The workspace limit is 50 projects.",
    );
  const at = new Date().toISOString();
  const project = projectSchema.parse({
    ...input,
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  });
  if (existing)
    next.projects = next.projects.map((item) =>
      item.id === project.id ? project : item,
    );
  else next.projects.push(project);
  return next;
}

export function archiveProject(workspace: Workspace, id: string): Workspace {
  const next = structuredClone(workspace);
  const project = getProject(next, id);
  project.archived = !project.archived;
  project.updatedAt = new Date().toISOString();
  return next;
}

export function saveScope(
  workspace: Workspace,
  projectId: string,
  originalScopeText: string,
  deliverables: Deliverable[],
): Workspace {
  const project = getProject(workspace, projectId);
  if (project.archived)
    throw new AppError(
      "VALIDATION_ERROR",
      "Unarchive the project before adding scope.",
    );
  const revisions = workspace.scopes.filter(
    (scope) => scope.projectId === projectId,
  );
  if (revisions.length >= 20)
    throw new AppError(
      "VALIDATION_ERROR",
      "This project has reached its 20-revision limit.",
    );
  const revision = scopeSchema.parse({
    id: crypto.randomUUID(),
    projectId,
    revision: Math.max(0, ...revisions.map((item) => item.revision)) + 1,
    originalScopeText,
    deliverables,
    createdAt: new Date().toISOString(),
  });
  return { ...workspace, scopes: [...workspace.scopes, revision] };
}

export function newRequest(
  workspace: Workspace,
  projectId: string,
): ChangeRequest {
  const project = getProject(workspace, projectId);
  if (project.archived)
    throw new AppError(
      "VALIDATION_ERROR",
      "Unarchive the project before adding requests.",
    );
  const scope = workspace.scopes
    .filter((item) => item.projectId === projectId)
    .toSorted((a, b) => b.revision - a.revision)[0];
  if (!scope)
    throw new AppError(
      "VALIDATION_ERROR",
      "Add an agreed scope before creating a request.",
    );
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    scopeRevisionId: scope.id,
    title: "",
    requestText: "",
    linkedDeliverableIds: [],
    classification: "clarify",
    reason: "",
    responseText: "",
    status: "draft",
    createdAt: at,
    updatedAt: at,
  };
}

export function saveRequest(
  workspace: Workspace,
  input: ChangeRequest,
): Workspace {
  const next = structuredClone(workspace);
  const existing = next.requests.find((item) => item.id === input.id);
  if (existing && existing.status !== "draft")
    throw new AppError(
      "INVALID_TRANSITION",
      "Published requests are frozen. Create a revision to make changes.",
    );
  if (
    existing &&
    (existing.projectId !== input.projectId ||
      existing.createdAt !== input.createdAt ||
      existing.supersedesRequestId !== input.supersedesRequestId)
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "The request identity cannot be changed.",
    );
  if (input.status !== "draft")
    throw new AppError(
      "INVALID_TRANSITION",
      "Use quote publishing to leave the draft state.",
    );
  if (getProject(next, input.projectId).archived)
    throw new AppError(
      "VALIDATION_ERROR",
      "Unarchive this project before editing a draft.",
    );
  if (!existing && next.requests.length >= 1_000)
    throw new AppError(
      "VALIDATION_ERROR",
      "The workspace limit is 1,000 requests.",
    );
  const request = requestSchema.parse({
    ...input,
    reason: input.reason.trim(),
    updatedAt: new Date().toISOString(),
  });
  if (existing)
    next.requests = next.requests.map((item) =>
      item.id === input.id ? request : item,
    );
  else next.requests.push(request);
  return next;
}

export function publishQuote(
  workspace: Workspace,
  requestId: string,
  at = new Date().toISOString(),
): Workspace {
  const next = structuredClone(workspace);
  const request = next.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "draft")
    throw new AppError(
      "INVALID_TRANSITION",
      "Only a saved draft can be published.",
    );
  const project = getProject(next, request.projectId);
  if (project.archived)
    throw new AppError(
      "VALIDATION_ERROR",
      "Unarchive the project before publishing.",
    );
  if (request.classification === "clarify")
    throw new AppError(
      "VALIDATION_ERROR",
      "Classify the request as within scope or additional scope before quoting.",
      { classification: "Needs clarification cannot be quoted." },
    );
  const fields: Record<string, string> = {};
  if (!request.reason.trim())
    fields.reason = "Explain your decision before quoting.";
  if (!request.requestText.trim())
    fields.requestText = "Add the client's request before quoting.";
  if (Object.keys(fields).length)
    throw new AppError(
      "VALIDATION_ERROR",
      "Complete the request and decision reason before quoting.",
      fields,
    );
  const scope = next.scopes.find((item) => item.id === request.scopeRevisionId);
  if (!scope)
    throw new AppError(
      "VALIDATION_ERROR",
      "The selected scope revision is missing.",
    );
  const amounts = estimateFee(
    request.classification,
    request.estimatedMinutes,
    project.hourlyRateMinor,
  );
  next.quotes.push({
    requestId,
    projectName: project.name,
    clientAlias: project.clientAlias,
    currency: project.currency,
    requestTitle: request.title,
    ...(request.estimatedMinutes !== undefined
      ? { estimatedMinutes: request.estimatedMinutes }
      : {}),
    ...amounts,
    hourlyRateMinor: project.hourlyRateMinor,
    scopeRevisionId: scope.id,
    deliverableSnapshots: request.linkedDeliverableIds.map((id) => {
      const item = scope.deliverables.find(
        (deliverable) => deliverable.id === id,
      );
      if (!item)
        throw new AppError(
          "VALIDATION_ERROR",
          "Review the linked deliverables for this scope revision.",
        );
      return structuredClone(item);
    }),
    requestText: request.requestText,
    classification: request.classification,
    reason: request.reason,
    responseText: request.responseText,
    quotedAt: at,
  });
  request.status = "quoted";
  request.updatedAt = at;
  next.events.push({
    id: crypto.randomUUID(),
    requestId,
    fromStatus: "draft",
    toStatus: "quoted",
    note: "Quote published. Scope, response, and pricing frozen.",
    createdAt: at,
  });
  return next;
}

export function recordDecision(
  workspace: Workspace,
  requestId: string,
  toStatus: "accepted" | "rejected" | "deferred",
  note: string,
  approvalReference?: string,
  approvedOn?: string,
  at = new Date().toISOString(),
): Workspace {
  const next = structuredClone(workspace);
  const request = next.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "quoted")
    throw new AppError(
      "INVALID_TRANSITION",
      "Only a quoted request can receive a decision. Recorded decisions cannot reopen.",
    );
  if (toStatus === "accepted" && (!approvalReference?.trim() || !approvedOn))
    throw new AppError(
      "VALIDATION_ERROR",
      "Acceptance needs an approval reference and date.",
      {
        approvalReference: !approvalReference?.trim()
          ? "Add the external approval reference."
          : "",
        approvedOn: !approvedOn ? "Choose the approval date." : "",
      },
    );
  const event = decisionSchema.parse({
    id: crypto.randomUUID(),
    requestId,
    fromStatus: "quoted",
    toStatus,
    note,
    ...(toStatus === "accepted" ? { approvalReference, approvedOn } : {}),
    createdAt: at,
  });
  next.events.push(event);
  request.status = toStatus;
  request.updatedAt = at;
  return next;
}

export function reviseRequest(workspace: Workspace, id: string): Workspace {
  const original = workspace.requests.find((item) => item.id === id);
  if (!original || original.status === "draft")
    throw new AppError(
      "INVALID_TRANSITION",
      "Create revisions from published requests.",
    );
  const at = new Date().toISOString();
  return saveRequest(workspace, {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    status: "draft",
    supersedesRequestId: original.id,
    createdAt: at,
    updatedAt: at,
  });
}

export function deleteDraft(workspace: Workspace, id: string): Workspace {
  const request = workspace.requests.find((item) => item.id === id);
  if (!request || request.status !== "draft")
    throw new AppError("INVALID_TRANSITION", "Only drafts can be deleted.");
  return {
    ...workspace,
    requests: workspace.requests.filter((item) => item.id !== id),
  };
}

export type ResponseVariant = "quote" | "clarification" | "defer";
export function responseTemplate(
  variant: ResponseVariant,
  project: Project,
  request: ChangeRequest,
): string {
  const intro =
    "Hi " +
    project.clientAlias +
    ",\n\nThanks for your request: “" +
    request.title +
    "”.";
  if (variant === "clarification")
    return (
      intro +
      "\n\nBefore we confirm the scope, could you clarify the following?\n" +
      (request.reason.trim() || "[Add the details you need clarified.]") +
      "\n\nOnce these details are clear, we can confirm the next steps."
    );
  if (variant === "defer")
    return (
      intro +
      "\n\nI suggest keeping the current agreed deliverables as our focus and deferring this request for a separate discussion." +
      (request.reason.trim() ? "\n\n" + request.reason : "") +
      "\n\nPlease let me know whether you would like to revisit this separately."
    );
  if (request.classification === "clarify")
    throw new AppError(
      "VALIDATION_ERROR",
      "Choose a scope decision before generating a quote response.",
    );
  if (request.classification === "within")
    return (
      intro +
      "\n\nI have reviewed this against the agreed scope and recorded it as within scope, with no additional fee.\n\n" +
      request.reason +
      "\n\nPlease let me know if the request needs any further clarification."
    );
  const estimate = estimateFee(
    request.classification,
    request.estimatedMinutes,
    project.hourlyRateMinor,
  );
  return (
    intro +
    "\n\nI have reviewed this against the agreed scope and recorded it as additional scope.\n\n" +
    request.reason +
    "\n\nThe estimate is " +
    formatMinutes(request.estimatedMinutes!) +
    ", rounded to " +
    formatMinutes(estimate.billableMinutes) +
    " at " +
    formatMoney(project.hourlyRateMinor, project.currency) +
    " per hour. The proposed additional fee is " +
    formatMoney(estimate.feeMinor, project.currency) +
    ".\n\nPlease confirm whether you would like to proceed. Delivery timing will need to be agreed separately."
  );
}

export const classificationLabels: Record<Classification, string> = {
  within: "Within scope",
  clarify: "Needs clarification",
  additional: "Additional scope",
};
export const statusLabels: Record<RequestStatus, string> = {
  draft: "Draft",
  quoted: "Quoted",
  accepted: "Accepted",
  rejected: "Rejected",
  deferred: "Deferred",
};

"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  FileCheck2,
  GitBranch,
  Info,
  LockKeyhole,
  Printer,
} from "lucide-react";
import { type ChangeRequest } from "@/lib/schema";
import {
  classificationLabels,
  publishQuote,
  recordDecision,
  reviseRequest,
} from "@/lib/workspace";
import { formatMinutes, formatMoney } from "@/lib/money";
import { readableError } from "@/lib/errors";
import { useWorkspace } from "./workspace-provider";
import {
  calendarDate,
  dateTime,
  EmptyState,
  fieldError,
  FormField,
  PageHeading,
  StatusBadge,
  todayInZone,
} from "./shared";
import { useLocalForm } from "@/hooks/use-local-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";

export function QuoteView({ requestId }: { requestId?: string }) {
  const context = useWorkspace();
  const request = context.workspace.requests.find(
    (item) => item.id === requestId,
  );
  if (!request)
    return (
      <EmptyState
        title="Quote not found"
        description="Open a saved request to preview or view its quote."
      >
        <Button onClick={() => context.navigate(context.href("/requests/"))}>
          Go to requests
        </Button>
      </EmptyState>
    );
  return <QuoteDocument key={request.id} request={request} />;
}

function QuoteDocument({ request }: { request: ChangeRequest }) {
  const context = useWorkspace();
  const { workspace } = context;
  const [decision, setDecision] = useState<
    "accepted" | "rejected" | "deferred" | null
  >(null);
  const result = useMemo(() => {
    try {
      const quote =
        workspace.quotes.find((item) => item.requestId === request.id) ??
        publishQuote(workspace, request.id).quotes.at(-1)!;
      return { quote, error: null };
    } catch (error) {
      return { quote: null, error: readableError(error) };
    }
  }, [workspace, request.id]);
  const project = workspace.projects.find(
    (item) => item.id === request.projectId,
  )!;
  const scope = workspace.scopes.find(
    (item) => item.id === request.scopeRevisionId,
  )!;
  const accepted = workspace.events.find(
    (event) => event.requestId === request.id && event.toStatus === "accepted",
  );
  const history = workspace.events
    .filter((event) => event.requestId === request.id)
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  const draft = request.status === "draft";
  if (!result.quote)
    return (
      <>
        <PageHeading
          title="This request needs a little more detail."
          description="Complete the scope decision and estimate before preparing a quote."
        />
        <Alert variant="destructive">
          <Info />
          <AlertTitle>Quote not ready</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
        <Button
          className="mt-6"
          onClick={() =>
            context.navigate(
              context.href("/compare/", { requestId: request.id }),
            )
          }
        >
          <ArrowLeft data-icon="inline-start" />
          Back to request
        </Button>
      </>
    );
  const quote = result.quote;
  async function publish() {
    if (
      !(await context.confirm({
        title: "Publish this quote?",
        description:
          "This freezes the project details, request, scope, response, and pricing. Later changes require a linked draft revision.",
        action: "Publish quote",
      }))
    )
      return;
    await context.commit((current) => publishQuote(current, request.id));
  }
  async function revise() {
    const next = await context.commit((current) =>
      reviseRequest(current, request.id),
    );
    if (next)
      await context.navigate(
        context.href("/compare/", { requestId: next.requests.at(-1)!.id }),
      );
  }
  return (
    <>
      <div className="no-print">
        <PageHeading
          title={
            draft ? "Ready for a clearer next step." : "A decision, documented."
          }
          description={
            draft
              ? "Review the exact scope, response, and fee before publishing your quote."
              : "The published agreement is frozen. Its decision history stays with it."
          }
          back={{
            label: "All requests",
            href: context.href("/requests/", { projectId: request.projectId }),
          }}
          action={
            <Button variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              Print / Save PDF
            </Button>
          }
        />
      </div>
      <div className="quote-layout">
        <article
          className="quote-document"
          aria-label={draft ? "Draft change order" : "Published change order"}
        >
          <div className="document-brand">
            <span>
              <span className="document-brackets" aria-hidden="true">
                [ ]
              </span>{" "}
              SpecScope
            </span>
            <span>{draft ? "DRAFT PREVIEW" : "CHANGE ORDER"}</span>
          </div>
          <div className="document-heading">
            <h1 className="print-title">
              {draft ? "Draft change order" : "Change order"}
            </h1>
            <h2>{quote.requestTitle}</h2>
            <p>
              {quote.projectName} <span aria-hidden="true">/</span>{" "}
              {quote.clientAlias}
            </p>
          </div>
          <dl className="document-meta">
            <div>
              <dt>Prepared</dt>
              <dd>{dateTime(quote.quotedAt, workspace.settings.timeZone)}</dd>
            </div>
            <div>
              <dt>Scope reference</dt>
              <dd>Revision {scope.revision}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{quote.currency}</dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>{classificationLabels[quote.classification]}</dd>
            </div>
          </dl>
          {draft ? (
            <p className="draft-stamp">
              <Info aria-hidden="true" />
              Draft preview — this quote has not been published.
            </p>
          ) : null}
          <section className="document-section">
            <h3>The request</h3>
            <p className="preserve-text">{quote.requestText}</p>
          </section>
          <section className="document-section">
            <h3>Scope decision & assumptions</h3>
            <p className="preserve-text">{quote.reason}</p>
            <p className="document-note">
              Classification recorded by the agency user.
            </p>
          </section>
          <section className="document-section">
            <h3>Relevant agreed deliverables</h3>
            {quote.deliverableSnapshots.length ? (
              <ul className="document-deliverables">
                {quote.deliverableSnapshots.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    {item.description ? <p>{item.description}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No existing deliverables linked. This request introduces new
                work.
              </p>
            )}
          </section>
          <section className="document-section pricing-section">
            <h3>Estimate & additional fee</h3>
            <table className="pricing-table">
              <caption className="sr-only">
                Exact estimate and additional fee, with the rounding policy.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Original estimated time</td>
                  <td>
                    {quote.classification === "within"
                      ? "Included in agreed scope"
                      : formatMinutes(quote.estimatedMinutes!) +
                        " (" +
                        quote.estimatedMinutes +
                        " min)"}
                  </td>
                </tr>
                <tr>
                  <td>Billable time</td>
                  <td>
                    {formatMinutes(quote.billableMinutes)} (
                    {quote.billableMinutes} min)
                  </td>
                </tr>
                <tr>
                  <td>Hourly rate</td>
                  <td>
                    {formatMoney(quote.hourlyRateMinor, quote.currency)} / hour
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Additional fee</th>
                  <td>{formatMoney(quote.feeMinor, quote.currency)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="document-note">
              Time rounds upward to 15-minute increments. The final fee rounds
              to the nearest minor unit, with ties upward. No automatic tax or
              multiplier is applied.
            </p>
          </section>
          <section className="document-section">
            <h3>Response to the client</h3>
            <p className="preserve-text">
              {quote.responseText || "No response recorded."}
            </p>
          </section>
          {accepted ? (
            <section className="approval-record">
              <div>
                <FileCheck2 aria-hidden="true" />
                <h3>Approval recorded manually</h3>
              </div>
              <dl>
                <div>
                  <dt>Approval date</dt>
                  <dd>{calendarDate(accepted.approvedOn!)}</dd>
                </div>
                <div>
                  <dt>External reference</dt>
                  <dd className="preserve-text">
                    {accepted.approvalReference}
                  </dd>
                </div>
              </dl>
              <p>
                The agency user recorded an external approval. SpecScope did not
                obtain a signature.
              </p>
            </section>
          ) : null}
          <footer className="document-footer">
            <p>
              This change order documents a human scope decision. It is not
              presented as a legally binding agreement.
            </p>
            <span>Prepared with SpecScope · ConsoleLog Studio</span>
          </footer>
        </article>
        <aside className="quote-sidebar no-print">
          <section className="surface quote-actions">
            <div className="section-heading">
              <h2>{draft ? "Before you publish" : "Quote status"}</h2>
              <StatusBadge status={request.status} />
            </div>
            <p className="muted">
              {draft
                ? "Publishing keeps an immutable record of the scope and price you reviewed."
                : "The original quote stays unchanged as its status moves forward."}
            </p>
            <div className="sidebar-fee">
              <span>Additional fee</span>
              <strong>{formatMoney(quote.feeMinor, quote.currency)}</strong>
            </div>
            {draft ? (
              <>
                <Button
                  size="lg"
                  onClick={publish}
                  disabled={context.saving || project.archived}
                >
                  <LockKeyhole data-icon="inline-start" />
                  Publish quote
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    context.navigate(
                      context.href("/compare/", { requestId: request.id }),
                    )
                  }
                >
                  <ArrowLeft data-icon="inline-start" />
                  Keep editing
                </Button>
              </>
            ) : (
              <>
                {request.status === "quoted" ? (
                  <>
                    <Button
                      onClick={() => setDecision("accepted")}
                      disabled={context.saving}
                    >
                      <Check data-icon="inline-start" />
                      Record acceptance
                    </Button>
                    <div className="split-actions">
                      <Button
                        variant="outline"
                        onClick={() => setDecision("rejected")}
                        disabled={context.saving}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDecision("deferred")}
                        disabled={context.saving}
                      >
                        Defer
                      </Button>
                    </div>
                  </>
                ) : null}
                <Button
                  variant="outline"
                  disabled={
                    context.saving ||
                    project.archived ||
                    workspace.requests.length >= 1_000
                  }
                  onClick={revise}
                >
                  <GitBranch data-icon="inline-start" />
                  Create linked revision
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() =>
                context.copy(
                  quote.responseText,
                  "Response copied. Nothing was sent.",
                )
              }
              disabled={!quote.responseText.trim()}
            >
              <Copy data-icon="inline-start" />
              Copy response
            </Button>
          </section>
          <section className="surface quote-history">
            <h2>Decision history</h2>
            {history.length ? (
              <ol>
                {history.map((event) => (
                  <li key={event.id}>
                    <span className="timeline-dot" aria-hidden="true" />
                    <div>
                      <StatusBadge status={event.toStatus} />
                      <time dateTime={event.createdAt}>
                        {dateTime(
                          event.createdAt,
                          workspace.settings.timeZone,
                          true,
                        )}
                      </time>
                      <p>{event.note || "No additional note recorded."}</p>
                      {event.toStatus === "accepted" ? (
                        <small>Approval recorded manually</small>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                History begins when this draft is published.
              </p>
            )}
          </section>
          <p className="small-note">
            <Info aria-hidden="true" />
            Acceptance records an approval you received elsewhere. It never
            sends a message or requests a signature.
          </p>
        </aside>
      </div>
      <Dialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
      >
        <DialogContent className="decision-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {decision === "accepted"
                ? "Record external approval"
                : decision === "rejected"
                  ? "Record a rejection"
                  : "Defer this request"}
            </DialogTitle>
            <DialogDescription>
              {decision === "accepted"
                ? "Record where and when the client approved. SpecScope does not obtain signatures."
                : "This is a final status for this request. Further changes need a linked revision."}
            </DialogDescription>
          </DialogHeader>
          {decision ? (
            <DecisionForm
              key={decision}
              request={request}
              status={decision}
              onDone={() => setDecision(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DecisionForm({
  request,
  status,
  onDone,
}: {
  request: ChangeRequest;
  status: "accepted" | "rejected" | "deferred";
  onDone: () => void;
}) {
  const context = useWorkspace();
  const form = useLocalForm(
    context.mode + ":decision:" + request.id + ":" + status,
    {
      note: "",
      approvalReference: "",
      approvedOn: todayInZone(context.workspace.settings.timeZone),
    },
    context.workspace.revision,
  );
  const value = form.value;
  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await context.commit(
          (current) =>
            recordDecision(
              current,
              request.id,
              status,
              value.note,
              value.approvalReference,
              value.approvedOn,
            ),
          form.revision,
        );
        if (result) {
          form.saved(value, result.revision);
          onDone();
        }
      }}
    >
      <FieldGroup>
        {status === "accepted" ? (
          <>
            <FormField
              id="decision-approvalReference"
              label="Approval reference"
              hint="For example: email subject, meeting note, or message reference."
              error={fieldError(context.error, "approvalReference")}
            >
              <Input
                id="decision-approvalReference"
                maxLength={1_000}
                value={value.approvalReference}
                onChange={(event) =>
                  form.update({
                    ...value,
                    approvalReference: event.target.value,
                  })
                }
                aria-invalid={!!fieldError(context.error, "approvalReference")}
                aria-describedby={
                  fieldError(context.error, "approvalReference")
                    ? "decision-approvalReference-error"
                    : "decision-approvalReference-hint"
                }
              />
            </FormField>
            <FormField
              id="decision-approvedOn"
              label="Approval date"
              error={fieldError(context.error, "approvedOn")}
            >
              <Input
                id="decision-approvedOn"
                type="date"
                value={value.approvedOn}
                onChange={(event) =>
                  form.update({ ...value, approvedOn: event.target.value })
                }
                aria-invalid={!!fieldError(context.error, "approvedOn")}
                aria-describedby={
                  fieldError(context.error, "approvedOn")
                    ? "decision-approvedOn-error"
                    : undefined
                }
              />
            </FormField>
          </>
        ) : null}
        <FormField
          id="decision-note"
          label="Decision note (optional)"
          error={fieldError(context.error, "note")}
        >
          <Textarea
            id="decision-note"
            rows={3}
            maxLength={1_000}
            value={value.note}
            onChange={(event) =>
              form.update({ ...value, note: event.target.value })
            }
            aria-invalid={!!fieldError(context.error, "note")}
          />
        </FormField>
        {context.error ? (
          <p className="form-error" role="alert">
            {context.error.message}
          </p>
        ) : null}
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={context.saving}>
            {context.saving
              ? "Saving…"
              : status === "accepted"
                ? "Record acceptance"
                : status === "rejected"
                  ? "Record rejection"
                  : "Record deferral"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

"use client";

import { useState } from "react";
import { ArrowRight, Copy, Info, Save, Trash2 } from "lucide-react";
import { estimateFee, formatMinutes, formatMoney } from "@/lib/money";
import { type ChangeRequest, type Classification } from "@/lib/schema";
import {
  classificationLabels,
  deleteDraft,
  newRequest,
  publishQuote,
  responseTemplate,
  saveRequest,
  type ResponseVariant,
} from "@/lib/workspace";
import { useLocalForm } from "@/hooks/use-local-form";
import { useWorkspace } from "./workspace-provider";
import {
  dateTime,
  EmptyState,
  fieldError,
  FormField,
  PageHeading,
} from "./shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export function ComparisonView({
  requestId,
  projectId,
}: {
  requestId?: string;
  projectId?: string;
}) {
  const context = useWorkspace();
  const request = context.workspace.requests.find(
    (item) => item.id === requestId,
  );
  const project = context.workspace.projects.find(
    (item) => item.id === projectId,
  );
  if (
    requestId === "new" &&
    project &&
    !project.archived &&
    context.workspace.scopes.some((scope) => scope.projectId === project.id)
  )
    return (
      <RequestEditor
        key={context.mode + ":new:" + project.id}
        projectId={project.id}
      />
    );
  if (!request)
    return (
      <EmptyState
        title="Request not found"
        description="Choose a request from your workspace, or create a new one after adding agreed scope."
      >
        <Button onClick={() => context.navigate(context.href("/requests/"))}>
          Go to requests
        </Button>
      </EmptyState>
    );
  if (request.status !== "draft")
    return (
      <>
        <PageHeading
          title={request.title}
          description="This published request is frozen. View its quote or create a linked revision."
        />
        <Button
          onClick={() =>
            context.navigate(context.href("/quote/", { requestId: request.id }))
          }
        >
          View quote
          <ArrowRight data-icon="inline-end" />
        </Button>
      </>
    );
  return (
    <RequestEditor
      key={request.id}
      projectId={request.projectId}
      request={request}
    />
  );
}

function RequestEditor({
  projectId,
  request,
}: {
  projectId: string;
  request?: ChangeRequest;
}) {
  const context = useWorkspace();
  const { workspace } = context;
  const project = workspace.projects.find((item) => item.id === projectId)!;
  const [initial] = useState(() => request ?? newRequest(workspace, projectId));
  const form = useLocalForm(
    context.mode + ":request:" + (request?.id ?? "new:" + projectId),
    initial,
    workspace.revision,
  );
  const value = form.value;
  const scope = workspace.scopes.find(
    (item) => item.id === value.scopeRevisionId,
  )!;
  const revisions = workspace.scopes
    .filter((item) => item.projectId === projectId)
    .toSorted((a, b) => b.revision - a.revision);
  const [variant, setVariant] = useState<ResponseVariant>(
    value.classification === "clarify" ? "clarification" : "quote",
  );
  let estimate: ReturnType<typeof estimateFee> | null = null;
  try {
    estimate = estimateFee(
      value.classification,
      value.estimatedMinutes,
      project.hourlyRateMinor,
    );
  } catch {
    /* Invalid drafts remain editable until their estimate is complete. */
  }

  const errorProps = (key: string) => ({
    "aria-invalid": !!fieldError(context.error, key),
    "aria-describedby": fieldError(context.error, key)
      ? "request-" + key + "-error"
      : undefined,
  });
  async function save(navigateToSaved = false) {
    const committed = await context.commit(
      (current) => saveRequest(current, value),
      form.revision,
    );
    if (committed) {
      form.saved(
        committed.requests.find((item) => item.id === value.id)!,
        committed.revision,
      );
      if (navigateToSaved && !request)
        await context.navigate(
          context.href("/compare/", { requestId: value.id }),
        );
    }
    return committed;
  }
  async function preview() {
    try {
      const candidate = saveRequest(workspace, value);
      publishQuote(candidate, value.id);
    } catch (error) {
      context.fail(error);
      return;
    }
    const committed = !request || form.dirty ? await save() : workspace;
    if (committed)
      await context.navigate(context.href("/quote/", { requestId: value.id }));
  }
  async function generateResponse() {
    try {
      if (
        value.responseText.trim() &&
        !(await context.confirm({
          title: "Replace your response?",
          description:
            "Generating a template replaces the current response. Copy any edits you want to keep first.",
          action: "Replace response",
        }))
      )
        return;
      const saved = form.dirty || !request ? await save() : workspace;
      if (!saved) return;
      const savedRequest = saved.requests.find((item) => item.id === value.id)!;
      const text = responseTemplate(
        variant,
        saved.projects.find((item) => item.id === projectId)!,
        savedRequest,
      );
      form.update({ ...savedRequest, responseText: text });
    } catch (error) {
      context.fail(error);
    }
  }
  return (
    <>
      <PageHeading
        title="A clearer scope. A better conversation."
        description="Compare the request, document your decision, and keep the project moving."
        back={{
          label: "All requests",
          href: context.href("/requests/", { projectId }),
        }}
        action={
          <div className="inline-actions">
            <Badge variant={form.dirty || !request ? "outline" : "secondary"}>
              {form.dirty || !request ? "Not saved" : "Saved draft"}
            </Badge>
            <Button
              variant="outline"
              onClick={() => save(true)}
              disabled={context.saving || project.archived}
            >
              <Save data-icon="inline-start" />
              {context.saving ? "Saving…" : "Save draft"}
            </Button>
          </div>
        }
      />
      <div className="context-strip">
        <div>
          <strong>{project.name}</strong>
          <span>Client: {project.clientAlias}</span>
          <Badge variant="secondary">Scope revision {scope.revision}</Badge>
        </div>
        {value.supersedesRequestId ? (
          <Button
            size="sm"
            variant="link"
            onClick={() =>
              context.navigate(
                context.href("/quote/", {
                  requestId: value.supersedesRequestId,
                }),
              )
            }
          >
            View original quote
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
      {project.archived ? (
        <Alert>
          <Info />
          <AlertDescription>
            This project is archived. Restore it from Projects before editing or
            publishing.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="comparison-layout">
        <section
          className="surface comparison-scope"
          aria-labelledby="agreed-scope-title"
        >
          <div className="panel-heading">
            <h2 id="agreed-scope-title">Agreed scope</h2>
            <p>Select the relevant deliverables from the agreed scope.</p>
          </div>
          <FieldGroup>
            <FormField
              id="request-scopeRevisionId"
              label="Scope revision"
              error={fieldError(context.error, "scopeRevisionId")}
            >
              <NativeSelect
                id="request-scopeRevisionId"
                value={value.scopeRevisionId}
                onChange={async (event) => {
                  const id = event.target.value;
                  if (id === value.scopeRevisionId) return;
                  if (
                    await context.confirm({
                      title: "Compare with another scope revision?",
                      description:
                        "Your linked deliverables will be cleared. Review and select the relevant items from the new revision.",
                      action: "Change revision",
                    })
                  )
                    form.update({
                      ...value,
                      scopeRevisionId: id,
                      linkedDeliverableIds: [],
                    });
                }}
                {...errorProps("scopeRevisionId")}
              >
                {revisions.map((revision) => (
                  <NativeSelectOption key={revision.id} value={revision.id}>
                    Revision {revision.revision} ·{" "}
                    {dateTime(revision.createdAt, workspace.settings.timeZone)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FieldSet>
              <FieldLegend className="sr-only">
                Relevant deliverables
              </FieldLegend>
              <FieldGroup className="deliverable-choices">
                {scope.deliverables.map((item) => (
                  <FieldLabel
                    key={item.id}
                    className="deliverable-choice"
                    htmlFor={"link-" + item.id}
                  >
                    <Field orientation="horizontal">
                      <Checkbox
                        id={"link-" + item.id}
                        checked={value.linkedDeliverableIds.includes(item.id)}
                        onCheckedChange={(checked) =>
                          form.update({
                            ...value,
                            linkedDeliverableIds: checked
                              ? [...value.linkedDeliverableIds, item.id]
                              : value.linkedDeliverableIds.filter(
                                  (id) => id !== item.id,
                                ),
                          })
                        }
                      />
                      <FieldContent>
                        <strong>{item.title}</strong>
                        <FieldDescription>
                          {item.description ||
                            "No further description recorded."}
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </FieldGroup>
              <FieldDescription>
                A completely new feature can have no linked deliverables.
              </FieldDescription>
            </FieldSet>
            <Separator />
            <div>
              <h3 className="small-heading">Original agreed scope</h3>
              <p className="original-scope preserve-text">
                {scope.originalScopeText || "No original scope text recorded."}
              </p>
            </div>
          </FieldGroup>
        </section>
        <section
          className="surface comparison-request"
          aria-labelledby="client-request-title"
        >
          <div className="panel-heading">
            <h2 id="client-request-title">Client request</h2>
          </div>
          <FieldGroup>
            <FormField
              id="request-title"
              label="Request title"
              error={fieldError(context.error, "title")}
            >
              <Input
                id="request-title"
                maxLength={80}
                value={value.title}
                placeholder="e.g. Add an analytics dashboard"
                onChange={(event) =>
                  form.update({ ...value, title: event.target.value })
                }
                {...errorProps("title")}
              />
            </FormField>
            <FormField
              id="request-requestText"
              label="Describe the request"
              error={fieldError(context.error, "requestText")}
            >
              <Textarea
                id="request-requestText"
                rows={4}
                maxLength={5_000}
                placeholder="Paste or summarize the client's request…"
                value={value.requestText}
                onChange={(event) =>
                  form.update({ ...value, requestText: event.target.value })
                }
                {...errorProps("requestText")}
              />
            </FormField>
            <FieldSet
              data-invalid={!!fieldError(context.error, "classification")}
            >
              <FieldLegend variant="label">Your scope decision</FieldLegend>
              <RadioGroup
                className="classification-options"
                value={value.classification}
                onValueChange={(classification) => {
                  const next = {
                    ...value,
                    classification: classification as Classification,
                  };
                  if (classification !== "additional")
                    delete next.estimatedMinutes;
                  setVariant(
                    classification === "clarify" ? "clarification" : "quote",
                  );
                  form.update(next);
                }}
                aria-describedby="classification-help"
              >
                {(["within", "clarify", "additional"] as const).map(
                  (classification) => (
                    <FieldLabel
                      key={classification}
                      className="classification-option"
                      htmlFor={"classification-" + classification}
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem
                          id={"classification-" + classification}
                          value={classification}
                          aria-label={classificationLabels[classification]}
                        />
                        <FieldContent>
                          <strong>
                            {classificationLabels[classification]}
                          </strong>
                          <FieldDescription>
                            {classification === "within"
                              ? "Covered by the agreed scope."
                              : classification === "clarify"
                                ? "More information needed."
                                : "Work beyond the agreement."}
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ),
                )}
              </RadioGroup>
              <FieldDescription id="classification-help">
                Your decision. No automatic classification.
              </FieldDescription>
            </FieldSet>
            <FormField
              id="request-reason"
              label="Why this decision?"
              error={fieldError(context.error, "reason")}
              hint="Record your reasoning and any assumptions. Required before quoting."
            >
              <Textarea
                id="request-reason"
                rows={3}
                maxLength={1_000}
                value={value.reason}
                onChange={(event) =>
                  form.update({ ...value, reason: event.target.value })
                }
                {...errorProps("reason")}
              />
            </FormField>
            {value.classification === "additional" ? (
              <FormField
                id="request-estimatedMinutes"
                label="Estimated time (minutes)"
                error={fieldError(context.error, "estimatedMinutes")}
                hint="Whole minutes, from 1 to 10,000. Rounded up to the next 15 minutes."
              >
                <Input
                  id="request-estimatedMinutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10_000}
                  step={1}
                  value={value.estimatedMinutes ?? ""}
                  onChange={(event) => {
                    const next = { ...value };
                    if (event.target.value === "") delete next.estimatedMinutes;
                    else next.estimatedMinutes = Number(event.target.value);
                    form.update(next);
                  }}
                  {...errorProps("estimatedMinutes")}
                />
              </FormField>
            ) : null}
            {value.classification !== "clarify" ? (
              <div className="estimate-strip">
                <div>
                  <small>Estimated time</small>
                  <strong>
                    {value.classification === "within"
                      ? "Included"
                      : value.estimatedMinutes
                        ? formatMinutes(value.estimatedMinutes)
                        : "—"}
                  </strong>
                </div>
                <ArrowRight aria-hidden="true" />
                <div>
                  <small>Billable time</small>
                  <strong>
                    {estimate ? formatMinutes(estimate.billableMinutes) : "—"}
                  </strong>
                </div>
                <div className="estimate-total">
                  <strong>
                    {estimate
                      ? formatMoney(estimate.feeMinor, project.currency)
                      : "—"}
                  </strong>
                  <small>
                    {value.classification === "within"
                      ? "No additional fee"
                      : formatMoney(project.hourlyRateMinor, project.currency) +
                        " / hour · 15-minute increments"}
                  </small>
                </div>
              </div>
            ) : (
              <Alert>
                <Info />
                <AlertDescription>
                  Clarify the request before preparing a quote. You can still
                  save it and draft a clarification response.
                </AlertDescription>
              </Alert>
            )}
            <div className="inline-actions">
              <Button
                size="lg"
                onClick={preview}
                disabled={context.saving || project.archived}
              >
                {form.dirty || !request
                  ? "Save & preview quote"
                  : "Preview quote"}
                <ArrowRight data-icon="inline-end" />
              </Button>
              <span className="small-note">
                <Info aria-hidden="true" />
                No hidden multiplier or tax.
              </span>
            </div>
          </FieldGroup>
        </section>
      </div>
      <section
        className="surface response-editor"
        aria-labelledby="response-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="response-title">Make the conversation easier.</h2>
            <p className="muted">
              Start with a template, then put it in your own words.
            </p>
          </div>
          <div className="inline-actions">
            <NativeSelect
              aria-label="Response template"
              value={variant}
              onChange={(event) =>
                setVariant(event.target.value as ResponseVariant)
              }
            >
              <NativeSelectOption value="quote">
                Quote for work
              </NativeSelectOption>
              <NativeSelectOption value="clarification">
                Ask for clarification
              </NativeSelectOption>
              <NativeSelectOption value="defer">
                Defer or decline
              </NativeSelectOption>
            </NativeSelect>
            <Button
              variant="outline"
              onClick={generateResponse}
              disabled={context.saving}
            >
              {form.dirty || !request
                ? "Save & generate response"
                : "Generate response"}
            </Button>
          </div>
        </div>
        <FieldGroup>
          <FormField
            id="request-responseText"
            label="Your response"
            error={fieldError(context.error, "responseText")}
            hint="Copying never sends a message. Save the draft to preserve your edits."
          >
            <Textarea
              id="request-responseText"
              rows={8}
              maxLength={5_000}
              value={value.responseText}
              onChange={(event) =>
                form.update({ ...value, responseText: event.target.value })
              }
              {...errorProps("responseText")}
            />
          </FormField>
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() =>
                context.copy(
                  value.responseText,
                  "Response copied. Nothing was sent.",
                )
              }
              disabled={!value.responseText.trim()}
            >
              <Copy data-icon="inline-start" />
              Copy response
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={context.saving || project.archived}
            >
              <Save data-icon="inline-start" />
              Save draft
            </Button>
          </div>
        </FieldGroup>
      </section>
      {request ? (
        <div className="request-danger">
          <span>
            Drafts can be deleted. Published quotes keep their history.
          </span>
          <Button
            variant="ghost"
            disabled={context.saving}
            onClick={async () => {
              if (
                !(await context.confirm({
                  title: "Delete this draft?",
                  description:
                    "This draft and its saved response will be permanently removed. Published evidence is never deleted here.",
                  action: "Delete draft",
                  destructive: true,
                }))
              )
                return;
              const result = await context.commit(
                (current) => deleteDraft(current, request.id),
                form.revision,
              );
              if (result) {
                form.saved(value, result.revision);
                await context.navigate(
                  context.href("/requests/", { projectId }),
                );
              }
            }}
          >
            <Trash2 data-icon="inline-start" />
            Delete draft
          </Button>
        </div>
      ) : null}
    </>
  );
}

import { z } from "zod";
import { MAX_AMOUNT_MINOR } from "./money";

// Keep schema validation compatible with the app's no-eval content security policy.
z.config({ jitless: true });

const id = z.uuid();
const timestamp = z.iso.datetime({ precision: 3 });
const name = z
  .string()
  .trim()
  .min(1, "This field is required.")
  .max(80, "Use at most 80 characters.");
const note = z.string().max(1_000);
export const classificationSchema = z.enum(["within", "clarify", "additional"]);
export const statusSchema = z.enum([
  "draft",
  "quoted",
  "accepted",
  "rejected",
  "deferred",
]);
export const currencySchema = z.enum(["USD", "BDT"]);
export const deliverableSchema = z.strictObject({
  id,
  title: name,
  description: z.string().max(500),
});
export const projectSchema = z.strictObject({
  id,
  name,
  clientAlias: name,
  currency: currencySchema,
  hourlyRateMinor: z
    .number()
    .int()
    .positive("The hourly rate must be positive.")
    .max(MAX_AMOUNT_MINOR),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const scopeSchema = z.strictObject({
  id,
  projectId: id,
  revision: z.number().int().min(1).max(20),
  originalScopeText: z.string().max(10_000),
  deliverables: z
    .array(deliverableSchema)
    .min(1, "Add at least one deliverable.")
    .max(50),
  createdAt: timestamp,
});
export const requestSchema = z.strictObject({
  id,
  projectId: id,
  scopeRevisionId: id,
  title: name,
  requestText: z.string().max(5_000),
  linkedDeliverableIds: z.array(id).max(50),
  classification: classificationSchema,
  reason: note,
  estimatedMinutes: z.number().int().min(1).max(10_000).optional(),
  responseText: z.string().max(5_000),
  status: statusSchema,
  supersedesRequestId: id.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const quoteSchema = z.strictObject({
  requestId: id,
  projectName: name,
  clientAlias: name,
  currency: currencySchema,
  requestTitle: name,
  estimatedMinutes: z.number().int().min(1).max(10_000).optional(),
  billableMinutes: z.number().int().min(0).max(10_005),
  hourlyRateMinor: z.number().int().positive().max(MAX_AMOUNT_MINOR),
  feeMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  scopeRevisionId: id,
  deliverableSnapshots: z.array(deliverableSchema).max(50),
  requestText: z.string().max(5_000),
  classification: z.enum(["within", "additional"]),
  reason: z.string().trim().min(1).max(1_000),
  responseText: z.string().max(5_000),
  quotedAt: timestamp,
});
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const date = new Date(value + "T00:00:00.000Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export const decisionSchema = z.strictObject({
  id,
  requestId: id,
  fromStatus: statusSchema,
  toStatus: statusSchema,
  note,
  approvalReference: z.string().trim().min(1).max(1_000).optional(),
  approvedOn: z
    .string()
    .refine(isCalendarDate, "Choose a real calendar date.")
    .optional(),
  createdAt: timestamp,
});
export const settingsSchema = z.strictObject({
  timeZone: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid IANA time zone."),
});
export const workspaceSchema = z.strictObject({
  revision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  projects: z.array(projectSchema).max(50),
  scopes: z.array(scopeSchema).max(1_000),
  requests: z.array(requestSchema).max(1_000),
  quotes: z.array(quoteSchema).max(1_000),
  events: z.array(decisionSchema).max(2_000),
  settings: settingsSchema,
});
export const backupSchema = z.strictObject({
  appId: z.literal("P06"),
  formatVersion: z.literal(1),
  exportedAt: timestamp,
  payload: z.unknown(),
});

export type Project = z.infer<typeof projectSchema>;
export type ScopeRevision = z.infer<typeof scopeSchema>;
export type Deliverable = z.infer<typeof deliverableSchema>;
export type ChangeRequest = z.infer<typeof requestSchema>;
export type QuoteSnapshot = z.infer<typeof quoteSchema>;
export type DecisionEvent = z.infer<typeof decisionSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceMode = "demo" | "personal";
export type Classification = ChangeRequest["classification"];
export type RequestStatus = ChangeRequest["status"];

import { describe, expect, it } from "vitest";
import { estimateFee, moneyInput, parseMoney } from "../src/lib/money";
import { sampleId, sampleWorkspace } from "../src/lib/sample";
import { isCalendarDate, type Workspace } from "../src/lib/schema";
import {
  backupBytes,
  backupEnvelope,
  MAX_BACKUP_BYTES,
  parseBackup,
  validateWorkspace,
} from "../src/lib/validation";
import {
  archiveProject,
  deleteDraft,
  newRequest,
  publishQuote,
  recordDecision,
  responseTemplate,
  reviseRequest,
  saveProject,
  saveRequest,
  saveScope,
} from "../src/lib/workspace";
import { maximumWorkspace } from "./reference-fixture.mjs";

describe("exact pricing", () => {
  it.each([
    [1, 15, 1500],
    [15, 15, 1500],
    [16, 30, 3000],
    [20, 30, 3000],
    [60, 60, 6000],
    [10_000, 10_005, 1_000_500],
  ])("rounds %i minutes up to %i", (input, billableMinutes, feeMinor) => {
    expect(estimateFee("additional", input, 6000)).toEqual({
      billableMinutes,
      feeMinor,
    });
  });
  it("rounds a half minor unit upward and keeps tiny fees honest", () => {
    expect(estimateFee("additional", 15, 2).feeMinor).toBe(1);
    expect(estimateFee("additional", 15, 1).feeMinor).toBe(0);
  });
  it("has no hidden fee for within scope or clarification", () => {
    expect(estimateFee("within", undefined, 6000)).toEqual({
      billableMinutes: 0,
      feeMinor: 0,
    });
    expect(estimateFee("clarify", undefined, 6000).feeMinor).toBe(0);
  });
  it.each([0, -1, 1.5, 10_001, NaN, Infinity, undefined])(
    "rejects invalid additional estimates: %s",
    (value) => {
      expect(() => estimateFee("additional", value, 6000)).toThrow();
    },
  );
  it("handles the maximum amount without unsafe arithmetic", () => {
    expect(estimateFee("additional", 10_000, 1_000_000_000).feeMinor).toBe(
      166_750_000_000,
    );
  });
  it.each([
    ["0.29", 29],
    ["60.00", 6000],
    ["0.01", 1],
    ["10000000.00", 1_000_000_000],
  ])("parses decimals exactly", (text, expected) => {
    expect(parseMoney(text)).toBe(expected);
    expect(parseMoney(moneyInput(expected))).toBe(expected);
  });
  it.each(["1.001", "-1", "1e4", "", "Infinity", "1,000", "10000000.01"])(
    "rejects invalid input %s",
    (text) => {
      expect(() => parseMoney(text)).toThrow();
    },
  );
});

describe("scope, requests, and immutable evidence", () => {
  it("starts new requests as human clarification drafts", () => {
    const workspace = sampleWorkspace();
    const request = newRequest(workspace, sampleId(1));
    expect(request.classification).toBe("clarify");
    expect(request.status).toBe("draft");
    expect(request.scopeRevisionId).toBe(sampleId(12));
    expect(request.linkedDeliverableIds).toEqual([]);
  });
  it("validates all sample states and preserves them in a complete backup", () => {
    const workspace = validateWorkspace(sampleWorkspace());
    expect(parseBackup(JSON.stringify(backupEnvelope(workspace)))).toEqual(
      workspace,
    );
    expect(new Set(workspace.requests.map((item) => item.status)).size).toBe(5);
  });
  it("blocks clarification, missing estimates, and blank reasons", () => {
    const workspace = sampleWorkspace();
    expect(() => publishQuote(workspace, sampleId(103))).toThrow(/Classify/);
    workspace.requests[0].estimatedMinutes = undefined;
    expect(() => publishQuote(workspace, sampleId(101))).toThrow(/estimate/);
    workspace.requests[0].estimatedMinutes = 20;
    workspace.requests[0].reason = " ";
    expect(() => publishQuote(workspace, sampleId(101))).toThrow(/reason/);
  });
  it("publishes zero-fee within-scope requests", () => {
    const result = validateWorkspace(
      publishQuote(sampleWorkspace(), sampleId(107)),
    );
    expect(
      result.quotes.find((item) => item.requestId === sampleId(107))?.feeMinor,
    ).toBe(0);
  });
  it("allows new features with no linked deliverables", () => {
    const workspace = sampleWorkspace();
    workspace.requests[0].linkedDeliverableIds = [];
    expect(
      validateWorkspace(publishQuote(workspace, sampleId(101))).quotes.at(-1)
        ?.deliverableSnapshots,
    ).toEqual([]);
  });
  it("freezes the complete quote when project names, rates, and scope change", () => {
    let workspace = publishQuote(sampleWorkspace(), sampleId(101));
    const frozen = structuredClone(workspace.quotes.at(-1));
    workspace = saveProject(workspace, {
      ...workspace.projects[0],
      name: "Renamed project",
      clientAlias: "Updated client",
      hourlyRateMinor: 12000,
    });
    workspace = saveScope(workspace, sampleId(1), "Updated scope", [
      { id: crypto.randomUUID(), title: "New delivery", description: "" },
    ]);
    workspace = validateWorkspace(workspace);
    expect(workspace.quotes.at(-1)).toEqual(frozen);
    workspace = reviseRequest(workspace, sampleId(101));
    const revision = workspace.requests.at(-1)!;
    expect(revision.supersedesRequestId).toBe(sampleId(101));
    expect(revision.scopeRevisionId).toBe(sampleId(12));
    expect(
      estimateFee(
        revision.classification,
        revision.estimatedMinutes,
        workspace.projects[0].hourlyRateMinor,
      ).feeMinor,
    ).toBe(42000);
  });
  it("requires a reference and real approval date and refuses duplicate decisions", () => {
    const workspace = sampleWorkspace();
    expect(() =>
      recordDecision(workspace, sampleId(104), "accepted", ""),
    ).toThrow(/reference and date/);
    expect(() =>
      recordDecision(
        workspace,
        sampleId(104),
        "accepted",
        "",
        "Email",
        "2026-02-30",
      ),
    ).toThrow();
    const accepted = validateWorkspace(
      recordDecision(
        workspace,
        sampleId(104),
        "accepted",
        "",
        "Email approval",
        "2026-10-26",
      ),
    );
    expect(() =>
      recordDecision(
        accepted,
        sampleId(104),
        "accepted",
        "",
        "Email approval",
        "2026-10-26",
      ),
    ).toThrow(/cannot reopen/);
    expect(
      accepted.events.filter((event) => event.requestId === sampleId(104)),
    ).toHaveLength(2);
  });
  it("refuses to edit or delete published evidence", () => {
    const workspace = sampleWorkspace();
    expect(() =>
      saveRequest(workspace, { ...workspace.requests[1], title: "Changed" }),
    ).toThrow(/frozen/);
    expect(() => deleteDraft(workspace, sampleId(102))).toThrow(/drafts/);
    expect(() => publishQuote(workspace, sampleId(104))).toThrow();
  });
  it("archives rather than deleting and blocks new work until restored", () => {
    const workspace = archiveProject(sampleWorkspace(), sampleId(1));
    expect(workspace.projects).toHaveLength(2);
    expect(() => newRequest(workspace, sampleId(1))).toThrow(/Unarchive/);
    expect(() => saveScope(workspace, sampleId(1), "", [])).toThrow(
      /Unarchive/,
    );
  });
  it("locks a project's currency and enforces revision and request limits", () => {
    let workspace = sampleWorkspace();
    expect(() =>
      saveProject(workspace, { ...workspace.projects[0], currency: "BDT" }),
    ).toThrow(/currency is locked/);
    while (
      workspace.scopes.filter((item) => item.projectId === sampleId(1)).length <
      20
    ) {
      workspace = saveScope(workspace, sampleId(1), "", [
        { id: crypto.randomUUID(), title: "Deliverable", description: "" },
      ]);
    }
    expect(() => saveScope(workspace, sampleId(1), "", [])).toThrow(
      /20-revision/,
    );
  });
  it("preserves editable responses and generates only supplied facts", () => {
    let workspace = sampleWorkspace();
    const edited = {
      ...workspace.requests[0],
      responseText: "My carefully edited response.\nNo promised date.",
    };
    workspace = saveRequest(workspace, edited);
    expect(
      parseBackup(JSON.stringify(backupEnvelope(workspace))).requests[0]
        .responseText,
    ).toBe(edited.responseText);
    const text = responseTemplate("quote", workspace.projects[0], edited);
    expect(text).toContain("$210.00");
    expect(text).toContain(
      "Delivery timing will need to be agreed separately.",
    );
    expect(text).not.toContain("approved");
    expect(
      responseTemplate(
        "clarification",
        workspace.projects[0],
        workspace.requests[2],
      ),
    ).toContain(workspace.requests[2].reason);
    expect(responseTemplate("defer", workspace.projects[0], edited)).toContain(
      "deferring",
    );
  });
});

describe("strict recovery validation", () => {
  it("rejects excessive record arrays before inspecting their items", () => {
    const record = {
      get id() {
        throw new Error("Items should not be inspected.");
      },
    };
    expect(() =>
      validateWorkspace({
        ...sampleWorkspace(),
        requests: Array(1_001).fill(record),
      }),
    ).toThrow("The maximum number of requests is 1,000.");
  });
  it("bounds nested arrays before deep backup validation", () => {
    const workspace = sampleWorkspace();
    const raw = JSON.parse(JSON.stringify(backupEnvelope(workspace)));
    raw.payload.scopes[0].deliverables = Array(50_000).fill(null);
    expect(() => parseBackup(JSON.stringify(raw))).toThrow(
      "The maximum number of deliverables per scope revision is 50.",
    );
  });
  it("rejects a linked revision dated before its source quote was published", () => {
    const workspace = reviseRequest(sampleWorkspace(), sampleId(104));
    workspace.requests.at(-1)!.createdAt = "2026-10-20T10:00:00.000Z";
    expect(() => validateWorkspace(workspace)).toThrow(
      "after its original quote was published",
    );
  });
  it("accepts the maximum record counts and the exact 10 MiB boundary, rejecting one byte more", () => {
    const workspace = maximumWorkspace();
    const base = backupBytes(workspace);
    const perScope = Math.floor(
      (MAX_BACKUP_BYTES - base) / workspace.scopes.length,
    );
    expect(perScope).toBeGreaterThan(0);
    expect(perScope).toBeLessThan(9_000);
    workspace.scopes.forEach((scope) => {
      scope.originalScopeText = "x".repeat(perScope);
    });
    workspace.scopes[0].originalScopeText += "x".repeat(
      MAX_BACKUP_BYTES - backupBytes(workspace),
    );
    expect(backupBytes(workspace)).toBe(MAX_BACKUP_BYTES);
    expect(() => validateWorkspace(workspace)).not.toThrow();
    workspace.scopes[0].originalScopeText += "x";
    expect(() => validateWorkspace(workspace)).toThrow(/10 MiB/);
  });
  it.each(["2024-02-29", "2026-10-26"])(
    "accepts real calendar dates %s",
    (date) => expect(isCalendarDate(date)).toBe(true),
  );
  it.each([
    "2026-02-29",
    "2026-04-31",
    "2026-2-03",
    "2026-01-01T00:00:00Z",
    "0000-01-01",
  ])("rejects invalid dates %s", (date) =>
    expect(isCalendarDate(date)).toBe(false),
  );
  it.each([
    (workspace: Workspace) => {
      workspace.projects[1].id = workspace.projects[0].id;
    },
    (workspace: Workspace) => {
      workspace.requests[0].scopeRevisionId = crypto.randomUUID();
    },
    (workspace: Workspace) => {
      workspace.requests[0].linkedDeliverableIds = [sampleId(34)];
    },
    (workspace: Workspace) => {
      workspace.requests[0].linkedDeliverableIds = [sampleId(31), sampleId(31)];
    },
    (workspace: Workspace) => {
      workspace.quotes[0].feeMinor = 12345;
    },
    (workspace: Workspace) => {
      workspace.quotes[0].requestText = "Tampered";
    },
    (workspace: Workspace) => {
      workspace.quotes[0].deliverableSnapshots[0].title = "Tampered";
    },
    (workspace: Workspace) => {
      workspace.events = [];
    },
    (workspace: Workspace) => {
      delete workspace.events.find((event) => event.toStatus === "accepted")!
        .approvalReference;
    },
    (workspace: Workspace) => {
      workspace.requests[0].supersedesRequestId = workspace.requests[0].id;
    },
  ])("rejects broken or inconsistent evidence %#", (mutate) => {
    const workspace = sampleWorkspace();
    mutate(workspace);
    expect(() =>
      parseBackup(JSON.stringify(backupEnvelope(workspace))),
    ).toThrow();
  });
  it("rejects unknown backup versions, apps, fields, and malformed JSON", () => {
    const backup = backupEnvelope(sampleWorkspace());
    for (const invalid of [
      { ...backup, appId: "P05" },
      { ...backup, formatVersion: 2 },
      { ...backup, unexpected: true },
    ])
      expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
    expect(() => parseBackup("{")).toThrow(/valid JSON/);
  });
  it("enforces the aggregate UTF-8 backup limit even below entity count limits", () => {
    const workspace = sampleWorkspace();
    workspace.requests = [];
    workspace.quotes = [];
    workspace.events = [];
    workspace.scopes = [];
    workspace.projects = Array.from({ length: 30 }, (_, index) => ({
      ...workspace.projects[0],
      id: sampleId(1000 + index),
    }));
    workspace.scopes = workspace.projects.flatMap((project, projectIndex) =>
      Array.from({ length: 20 }, (_, index) => ({
        id: sampleId(2000 + projectIndex * 20 + index),
        projectId: project.id,
        revision: index + 1,
        originalScopeText: "🔒".repeat(5_000),
        deliverables: [
          { id: crypto.randomUUID(), title: "Delivery", description: "" },
        ],
        createdAt: project.createdAt,
      })),
    );
    expect(backupBytes(workspace)).toBeGreaterThan(MAX_BACKUP_BYTES);
    expect(() => validateWorkspace(workspace, false)).not.toThrow();
    expect(() => validateWorkspace(workspace)).toThrow(/10 MiB/);
  });
});

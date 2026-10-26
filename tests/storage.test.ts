import "fake-indexeddb/auto";
import { deleteDB, openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleId, sampleWorkspace } from "../src/lib/sample";
import {
  commitWorkspace,
  exportBackup,
  loadWorkspace,
} from "../src/lib/storage";
import { parseBackup } from "../src/lib/validation";
import {
  emptyWorkspace,
  publishQuote,
  recordDecision,
  saveRequest,
} from "../src/lib/workspace";

beforeEach(async () => {
  await Promise.all([
    deleteDB("specscope-demo"),
    deleteDB("specscope-personal"),
  ]);
});
afterEach(() => vi.restoreAllMocks());

describe("atomic local persistence", () => {
  it("never replaces unreadable existing records with a fallback workspace", async () => {
    const workspace = await loadWorkspace("demo");
    const db = await openDB("specscope-demo", 1);
    const corrupted = { ...workspace, projects: [] };
    await db.put("workspace", corrupted, "current");
    db.close();
    await expect(loadWorkspace("demo")).rejects.toThrow();
    await expect(commitWorkspace("demo", 0, workspace)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
    const inspect = await openDB("specscope-demo", 1);
    expect(await inspect.get("workspace", "current")).toEqual(corrupted);
    inspect.close();
  });
  it("seeds demo once and keeps personal records separate", async () => {
    const demo = await loadWorkspace("demo");
    expect(demo.projects.length).toBeGreaterThan(0);
    expect((await loadWorkspace("personal")).projects).toEqual([]);
    await commitWorkspace("demo", demo.revision, {
      ...demo,
      projects: demo.projects.map((item) => ({
        ...item,
        name: "Edited sample",
      })),
    });
    expect((await loadWorkspace("demo")).projects[0].name).toBe(
      "Edited sample",
    );
    expect((await loadWorkspace("personal")).projects).toEqual([]);
  });
  it("persists a draft response through a fresh load", async () => {
    const workspace = await loadWorkspace("demo");
    await commitWorkspace(
      "demo",
      0,
      saveRequest(workspace, {
        ...workspace.requests[0],
        responseText: "Keep this edit.",
      }),
    );
    expect((await loadWorkspace("demo")).requests[0].responseText).toBe(
      "Keep this edit.",
    );
  });
  it("rejects a stale tab without overwriting newer data", async () => {
    const workspace = await loadWorkspace("demo");
    await commitWorkspace("demo", 0, {
      ...workspace,
      settings: { timeZone: "UTC" },
    });
    await expect(commitWorkspace("demo", 0, workspace)).rejects.toMatchObject({
      code: "STALE_LOCAL_STATE",
    });
    expect((await loadWorkspace("demo")).settings.timeZone).toBe("UTC");
  });
  it("allows exactly one concurrent commit for a shared expected revision", async () => {
    const workspace = await loadWorkspace("demo");
    const results = await Promise.allSettled([
      commitWorkspace("demo", 0, workspace),
      commitWorkspace("demo", 0, workspace),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect((await loadWorkspace("demo")).revision).toBe(1);
  });
  it("commits quote, status, and publication event together", async () => {
    const workspace = await loadWorkspace("demo");
    await commitWorkspace("demo", 0, publishQuote(workspace, sampleId(101)));
    const loaded = await loadWorkspace("demo");
    expect(loaded.requests[0].status).toBe("quoted");
    expect(
      loaded.quotes.find((quote) => quote.requestId === sampleId(101)),
    ).toBeDefined();
    expect(
      loaded.events.filter((event) => event.requestId === sampleId(101)),
    ).toHaveLength(1);
  });
  it("prevents duplicate acceptance on concurrent clicks", async () => {
    const workspace = await loadWorkspace("demo");
    const candidate = recordDecision(
      workspace,
      sampleId(104),
      "accepted",
      "",
      "Email",
      "2026-10-26",
    );
    const results = await Promise.allSettled([
      commitWorkspace("demo", 0, candidate),
      commitWorkspace("demo", 0, candidate),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await loadWorkspace("demo")).events.filter(
        (event) =>
          event.requestId === sampleId(104) && event.toStatus === "accepted",
      ),
    ).toHaveLength(1);
  });
  it("preserves the complete prior state when a quota write aborts", async () => {
    const workspace = await loadWorkspace("demo");
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    await expect(
      commitWorkspace("demo", 0, publishQuote(workspace, sampleId(101))),
    ).rejects.toMatchObject({ code: "STORAGE_FULL" });
    expect(await loadWorkspace("demo")).toEqual(workspace);
  });
  it("validates replacements before any write and keeps revisions monotonic", async () => {
    const workspace = await loadWorkspace("demo");
    const bad = structuredClone(workspace);
    bad.projects = [];
    await expect(commitWorkspace("demo", 0, bad)).rejects.toThrow();
    expect(await loadWorkspace("demo")).toEqual(workspace);
    await commitWorkspace("demo", 0, emptyWorkspace("UTC"));
    const empty = await loadWorkspace("demo");
    expect(empty.revision).toBe(1);
    await commitWorkspace(
      "demo",
      1,
      parseBackup(exportBackup(sampleWorkspace())),
    );
    expect((await loadWorkspace("demo")).revision).toBe(2);
    await expect(commitWorkspace("demo", 0, workspace)).rejects.toMatchObject({
      code: "STALE_LOCAL_STATE",
    });
  });
});

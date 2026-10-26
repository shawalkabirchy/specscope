import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sampleId, sampleWorkspace } from "../src/lib/sample";
import { backupEnvelope } from "../src/lib/validation";
import { saveProject, saveRequest, saveScope } from "../src/lib/workspace";

const compare = "/compare/?workspace=demo&requestId=" + sampleId(101);
const published = "/quote/?workspace=demo&requestId=" + sampleId(104);

async function saveDraft(page: Page) {
  await page
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  await expect(page.getByText("Saved draft", { exact: true })).toBeVisible();
}

async function committedState(page: Page, mode = "demo") {
  return page.evaluate(async (workspaceMode) => {
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const opening = indexedDB.open("specscope-" + workspaceMode, 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const transaction = db.transaction("workspace", "readonly");
        const reading = transaction.objectStore("workspace").get("current");
        reading.onsuccess = () => resolve(reading.result);
        reading.onerror = () => reject(reading.error);
        transaction.oncomplete = () => db.close();
      };
    });
  }, mode);
}

test("opens meaningful demo screens with no app errors or framework overlay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const route of [
    "/",
    "/requests/",
    "/scope/",
    compare,
    published,
    "/decisions/",
    "/settings/",
  ]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("#main-content h1").first()).not.toBeEmpty();
    await expect(page.locator("nextjs-portal")).toHaveCount(0);
    await expect(page.locator(".error-notice")).toHaveCount(0);
  }
  await expect(page).toHaveTitle(/SpecScope/);
  expect(errors).toEqual([]);
});

test("keeps personal data separate and creates a project, scope, request, quote, and acceptance", async ({
  page,
}) => {
  await page.goto("/?workspace=personal");
  await expect(
    page.getByText("A clean start for your next project"),
  ).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", {
    name: "Start a new project",
  });
  await projectDialog.getByLabel("Project name").fill("Harbor launch");
  await projectDialog.getByLabel("Client alias").fill("Harbor Team");
  await projectDialog
    .getByLabel("Currency", { exact: true })
    .selectOption("BDT");
  await projectDialog.getByLabel("Hourly rate").fill("60.00");
  await projectDialog
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(projectDialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Harbor launch" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await page
    .getByLabel("Original agreed scope")
    .fill("One responsive marketing website and a contact form.");
  await page.getByLabel("Deliverable 1 title").fill("Marketing website");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Home, about, services, and contact.");
  await page.getByRole("button", { name: "Save scope revision" }).click();
  await expect(page.getByText("Immutable revision")).toBeVisible();
  await page.getByRole("button", { name: "Review requests" }).click();
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await page.getByLabel("Request title", { exact: true }).fill("Add reporting");
  await page
    .getByLabel("Describe the request")
    .fill("Please add a dashboard for inquiries.");
  await page
    .getByRole("radio", { name: "Additional scope", exact: true })
    .check();
  await page
    .getByLabel("Why this decision?")
    .fill("Reporting is outside the marketing website deliverables.");
  await page.getByLabel("Estimated time (minutes)").fill("20");
  await expect(page.locator(".estimate-total")).toContainText("BDT");
  await expect(page.locator(".estimate-total")).toContainText("30.00");
  await page.getByRole("button", { name: "Save & generate response" }).click();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveValue(
    /30\.00/,
  );
  await page
    .getByLabel("Your response", { exact: true })
    .fill("An edited, clear proposal for BDT 30.00.");
  await saveDraft(page);
  await expect(page).toHaveURL(/requestId=.{36}/);
  await page.reload();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveValue(
    "An edited, clear proposal for BDT 30.00.",
  );
  await page
    .getByRole("button", { name: "Preview quote", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Draft change order" }),
  ).toContainText("30.00");
  await page
    .getByRole("button", { name: "Publish quote", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Publish this quote?" })
    .getByRole("button", { name: "Publish quote", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Published change order" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record acceptance", exact: true })
    .click();
  const approval = page.getByRole("dialog", {
    name: "Record external approval",
  });
  await approval
    .getByRole("button", { name: "Record acceptance", exact: true })
    .click();
  await expect(
    approval.getByText("Acceptance needs an approval reference and date."),
  ).toBeVisible();
  await approval
    .getByLabel("Approval reference")
    .fill("Email — approved change order");
  await approval.getByLabel("Approval date").fill("2026-10-26");
  await approval
    .getByRole("button", { name: "Record acceptance", exact: true })
    .click();
  await expect(approval).toBeHidden();
  await expect(page.locator(".approval-record")).toContainText(
    "Approval recorded manually",
  );
  const personal = await committedState(page, "personal");
  expect((personal.projects as unknown[]).length).toBe(1);
  expect((personal.events as unknown[]).length).toBe(2);
  await page.getByLabel("Workspace", { exact: true }).selectOption("demo");
  await expect(
    page.getByRole("heading", { name: "Meridian website", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Harbor launch", exact: true }),
  ).toHaveCount(0);
});

test("shows exact rounding, saves edited responses, and warns before replacing them", async ({
  page,
}) => {
  await page.goto(compare);
  await page.getByLabel("Estimated time (minutes)").fill("20");
  await expect(page.locator(".estimate-total")).toContainText("$30.00");
  await expect(page.locator(".estimate-strip")).toContainText("30m");
  await page
    .getByLabel("Your response", { exact: true })
    .fill("My edited response.");
  await saveDraft(page);
  await page.reload();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveValue(
    "My edited response.",
  );
  await page
    .getByRole("button", { name: "Generate response", exact: true })
    .click();
  const confirm = page.getByRole("dialog", { name: "Replace your response?" });
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveValue(
    "My edited response.",
  );
  await expect(
    page.getByRole("button", { name: "Generate response", exact: true }),
  ).toBeFocused();
});

test("blocks clarification and incomplete quotes, with a human decision", async ({
  page,
}) => {
  await page.goto("/compare/?workspace=demo&requestId=" + sampleId(103));
  await expect(
    page.getByRole("radio", { name: "Needs clarification", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Preview quote", exact: true })
    .click();
  await expect(page.locator(".error-notice")).toContainText(
    "Classify the request",
  );
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page
    .getByRole("radio", { name: "Additional scope", exact: true })
    .check();
  await page.getByLabel("Why this decision?").fill("");
  await page
    .getByRole("button", { name: "Save & preview quote", exact: true })
    .click();
  await expect(page.getByLabel("Why this decision?")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Why this decision?")).toBeFocused();
  await expect(page).toHaveURL(/\/compare\//);
});

test("changing scope clears linked deliverables after explicit confirmation", async ({
  page,
}) => {
  await page.goto(compare);
  await expect(
    page.getByRole("checkbox", { name: /Marketing website/ }),
  ).toBeChecked();
  await page
    .getByLabel("Scope revision", { exact: true })
    .selectOption(sampleId(11));
  await page
    .getByRole("dialog", { name: "Compare with another scope revision?" })
    .getByRole("button", { name: "Change revision", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Marketing website/ }),
  ).not.toBeChecked();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await saveDraft(page);
  await page.reload();
  await expect(page.getByLabel("Scope revision", { exact: true })).toHaveValue(
    sampleId(11),
  );
});

test("protects unsaved edits during navigation", async ({ page }) => {
  await page.goto(compare);
  await page.getByLabel("Request title", { exact: true }).fill("Unsaved title");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Leave without saving?",
  });
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Request title", { exact: true })).toHaveValue(
    "Unsaved title",
  );
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Leave without saving?" })
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good work starts with clear scope." }),
  ).toBeVisible();
});

test("rejects a stale tab without losing unsaved text", async ({
  page,
  context,
}) => {
  await page.goto(compare);
  const second = await context.newPage();
  await second.goto(compare);
  await second
    .getByLabel("Request title", { exact: true })
    .fill("Unsaved in second tab");
  await page
    .getByLabel("Request title", { exact: true })
    .fill("Committed in first tab");
  await saveDraft(page);
  await second
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  await expect(second.locator(".error-notice")).toContainText(
    "This workspace changed in another tab",
  );
  await expect(second.getByLabel("Request title", { exact: true })).toHaveValue(
    "Unsaved in second tab",
  );
  const stored = await committedState(page);
  expect((stored.requests as { title: string }[])[0].title).toBe(
    "Committed in first tab",
  );
});

test("storage failure keeps pending text, previous data, and a recoverable backup", async ({
  page,
}) => {
  await page.goto(compare);
  await expect(page.getByLabel("Request title", { exact: true })).toHaveValue(
    "Add an analytics dashboard",
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page
    .getByLabel("Request title", { exact: true })
    .fill("A title that cannot be saved");
  await page
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  await expect(page.locator(".error-notice")).toContainText(
    "Browser storage is full",
  );
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Request title", { exact: true })).toHaveValue(
    "A title that cannot be saved",
  );
  const stored = await committedState(page);
  expect((stored.requests as { title: string }[])[0].title).toBe(
    "Add an analytics dashboard",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export recovery", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain("recovery.json");
});

test("a blocked storage startup is explicit and permits recovery without claiming saved", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.goto(compare);
  await expect(page.locator(".storage-banner")).toContainText(
    "changes are not saved",
  );
  await page
    .getByLabel("Request title", { exact: true })
    .fill("Still editable");
  await page
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Request title", { exact: true })).toHaveValue(
    "Still editable",
  );
  await expect(page.locator(".save-announcement")).not.toContainText(
    "Saved in this browser",
  );
});

test("validates imports before replacement, offers a backup, and isolates demo reset", async ({
  page,
}) => {
  await page.goto("/settings/?workspace=demo");
  await page.getByLabel("Import workspace backup").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"appId":"wrong"}'),
  });
  await expect(page.locator(".error-notice")).toContainText(
    "unsupported app/version",
  );
  expect(((await committedState(page)).projects as unknown[]).length).toBe(2);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByLabel("Import workspace backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backupEnvelope(sampleWorkspace()))),
  });
  const confirmation = page.getByRole("dialog", {
    name: "Replace this workspace with the backup?",
  });
  await expect(
    confirmation.getByText("Quote snapshots", { exact: true }),
  ).toBeVisible();
  await expect(
    confirmation.getByRole("button", {
      name: "Back up current workspace first",
    }),
  ).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore sample data", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Restore original sample data?" })
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good work starts with clear scope." }),
  ).toBeVisible();
  expect((await committedState(page)).revision).toBe(1);
  await page.getByLabel("Workspace", { exact: true }).selectOption("personal");
  await expect(
    page.getByText("A clean start for your next project"),
  ).toBeVisible();
  expect(
    ((await committedState(page, "personal")).projects as unknown[]).length,
  ).toBe(0);
});

test("frozen quotes survive a project-rate change and create linked drafts", async ({
  page,
}) => {
  await page.goto(published);
  await expect(page.locator(".pricing-table tfoot")).toContainText("$135.00");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Meridian website", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Edit project",
    exact: true,
  });
  await dialog.getByLabel("Project name").fill("Meridian updated");
  await dialog.getByLabel("Client alias").fill("New client label");
  await dialog.getByLabel("Hourly rate").fill("120.00");
  await dialog
    .getByRole("button", { name: "Save project", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Meridian updated", exact: true }),
  ).toBeVisible();
  await page.goto(published);
  await expect(page.locator(".document-heading")).toContainText(
    "Meridian website",
  );
  await expect(page.locator(".document-heading")).toContainText(
    "Meridian Studio",
  );
  await expect(page.locator(".pricing-table tfoot")).toContainText("$135.00");
  await page
    .getByRole("button", { name: "Create linked revision", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "View original quote" }),
  ).toBeVisible();
  await expect(page.locator(".estimate-total")).toContainText("$270.00");
});

test("records final rejection and deferral without reopening", async ({
  page,
}) => {
  await page.goto(published);
  await page.getByRole("button", { name: "Defer", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Defer this request" })
    .getByRole("button", { name: "Record deferral" })
    .click();
  await expect(page.locator(".quote-actions")).toContainText("Deferred");
  await expect(
    page.getByRole("button", { name: "Record acceptance", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reject", exact: true }),
  ).toHaveCount(0);
});

test("never uploads request text, response text, or backup filenames", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(
      request.url() + " " + request.method() + " " + (request.postData() ?? ""),
    ),
  );
  await page.goto(compare);
  await page
    .getByLabel("Describe the request")
    .fill("PRIVATE_REQUEST_SENTINEL_398741");
  await page
    .getByLabel("Your response", { exact: true })
    .fill("PRIVATE_RESPONSE_SENTINEL_398741");
  await saveDraft(page);
  await page
    .getByRole("button", { name: "Copy response", exact: true })
    .click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Settings & backups" })
    .click();
  await page.getByLabel("Import workspace backup").setInputFiles({
    name: "PRIVATE_FILENAME_398741.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backupEnvelope(sampleWorkspace()))),
  });
  await expect(
    page.getByRole("dialog", {
      name: "Replace this workspace with the backup?",
    }),
  ).toBeVisible();
  expect(
    requests.every((request) => request.startsWith("http://127.0.0.1:4173/")),
  ).toBe(true);
  expect(requests.join("\n")).not.toMatch(
    /PRIVATE_(REQUEST|RESPONSE|FILENAME)_SENTINEL|PRIVATE_FILENAME_398741/,
  );
  expect(
    requests.some((request) => / (POST|PUT|PATCH|DELETE) /.test(request)),
  ).toBe(false);
});

test("copy uses the real browser clipboard when permissions are supported", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "The other engines do not expose the same automation clipboard permissions.",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(compare);
  const text = await page
    .getByLabel("Your response", { exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: "Copy response", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Nothing was sent");
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      "\n",
    ),
  ).toBe(text);
});

test("all main screens fit phone and desktop widths with keyboard navigation", async ({
  page,
}) => {
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/requests/",
      "/scope/",
      compare,
      published,
      "/decisions/",
      "/settings/",
    ]) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.goto(compare);
  await expect(page.getByLabel("Request title", { exact: true })).toHaveValue(
    "Add an analytics dashboard",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("radio", { name: "Within scope", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("radio", { name: "Within scope", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".estimate-total")).toContainText("$0.00");
});

test("core screens and approval dialog pass automated accessibility checks", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const route of ["/", compare, published, "/settings/"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  }
  await page.goto(published);
  await page
    .getByRole("button", { name: "Record acceptance", exact: true })
    .click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test("print layout preserves exact fees, manual-approval wording, and removes chrome", async ({
  page,
}) => {
  await page.goto("/quote/?workspace=demo&requestId=" + sampleId(102));
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".quote-sidebar")).toBeHidden();
  await expect(page.locator(".print-title")).toBeVisible();
  await expect(page.locator(".approval-record")).toContainText(
    "Approval recorded manually",
  );
  await expect(page.locator(".pricing-table tfoot")).toContainText("$0.00");
  expect(
    await page
      .locator(".quote-document")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test("the loaded workspace can save, navigate, and quote without a network connection", async ({
  page,
  context,
}) => {
  await page.goto(compare);
  await expect(page.getByLabel("Request title", { exact: true })).toHaveValue(
    "Add an analytics dashboard",
  );
  await context.setOffline(true);
  await page.getByLabel("Estimated time (minutes)").fill("20");
  await saveDraft(page);
  await page
    .getByRole("button", { name: "Preview quote", exact: true })
    .click();
  await expect(page.locator(".pricing-table tfoot")).toContainText("$30.00");
  await page
    .getByRole("button", { name: "Publish quote", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Publish this quote?" })
    .getByRole("button", { name: "Publish quote", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Published change order" }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Decision log", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A history you can stand behind." }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("maximum-length labels and the largest permitted fee remain readable on phones", async ({
  page,
}) => {
  let workspace = sampleWorkspace();
  workspace = saveProject(workspace, {
    ...workspace.projects[0],
    name: "N".repeat(80),
    clientAlias: "C".repeat(80),
    hourlyRateMinor: 1_000_000_000,
  });
  workspace = saveScope(workspace, sampleId(1), "Agreed scope ".repeat(100), [
    {
      id: crypto.randomUUID(),
      title: "D".repeat(80),
      description: "E".repeat(500),
    },
  ]);
  const scope = workspace.scopes.at(-1)!;
  workspace = saveRequest(workspace, {
    ...workspace.requests[0],
    title: "R".repeat(80),
    scopeRevisionId: scope.id,
    linkedDeliverableIds: [scope.deliverables[0].id],
    estimatedMinutes: 10_000,
    requestText: "Q".repeat(5_000),
    reason: "A".repeat(1_000),
    responseText: "S".repeat(5_000),
  });
  await page.goto("/settings/?workspace=demo");
  await expect(page.locator("#main-content")).toBeVisible();
  await page.getByLabel("Import workspace backup").setInputFiles({
    name: "bounded-long-content.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backupEnvelope(workspace))),
  });
  await page
    .getByRole("dialog", { name: "Replace this workspace with the backup?" })
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good work starts with clear scope." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    "/",
    "/scope/?workspace=demo&projectId=" + sampleId(1),
    compare,
    "/quote/?workspace=demo&requestId=" + sampleId(101),
  ]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator(".pricing-table tfoot")).toContainText(
    "1,667,500,000.00",
  );
});

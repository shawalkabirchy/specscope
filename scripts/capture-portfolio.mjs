import { chromium, expect } from "@playwright/test";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "docs/evidence");
const url = "http://127.0.0.1:" + (process.env.SPECSCOPE_PORT || "4173");
await mkdir(output, { recursive: true });
let preview;
let browser;
const errors = [];
async function ready(page) {
  await expect(page.locator("#main-content")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function shot(page, name, fullPage = false) {
  await ready(page);
  await page.screenshot({ path: resolve(output, name), fullPage });
}
const pause = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
try {
  try {
    if (!(await fetch(url)).ok) throw new Error("Preview not ready");
  } catch {
    preview = spawn(process.execPath, ["scripts/preview.mjs"], {
      cwd: root,
      stdio: "pipe",
      windowsHide: true,
    });
    let available = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      await pause(100);
      try {
        if ((await fetch(url)).ok) {
          available = true;
          break;
        }
      } catch {
        /* Wait for the local preview to start listening. */
      }
    }
    if (!available)
      throw new Error(
        "Build the app first, then start the production preview.",
      );
  }
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await shot(page, "projects-desktop.png");
  await page.getByRole("button", { name: "Explore the example" }).click();
  await expect(page.getByLabel("Request title", { exact: true })).toHaveValue(
    "Add an analytics dashboard",
  );
  await shot(page, "comparison-desktop.png");
  await shot(page, "comparison-full.png", true);
  await page.goto(url + "/scope/?workspace=demo");
  await shot(page, "scope-history-desktop.png");
  await page.goto(
    url +
      "/quote/?workspace=demo&requestId=10000000-0000-4000-8000-000000000102",
  );
  await shot(page, "quote-desktop.png", true);
  await page.pdf({
    path: resolve(output, "change-order-a4.pdf"),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.pdf({
    path: resolve(output, "change-order-letter.pdf"),
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.goto(url + "/decisions/?workspace=demo");
  await shot(page, "decision-log-desktop.png");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(url);
  await shot(page, "projects-mobile.png", true);
  await page.goto(
    url +
      "/compare/?workspace=demo&requestId=10000000-0000-4000-8000-000000000101",
  );
  await shot(page, "comparison-mobile.png", true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByLabel("Request title", { exact: true })
    .fill("Long-document print fixture");
  await page
    .getByLabel("Describe the request")
    .fill(
      "A detailed fictional request with long supporting context for the agreed change. "
        .repeat(80)
        .slice(0, 5000),
    );
  await page
    .getByLabel("Why this decision?")
    .fill(
      "The additional work extends beyond the agreed deliverables. "
        .repeat(20)
        .slice(0, 1000),
    );
  await page
    .getByLabel("Your response", { exact: true })
    .fill(
      "This is a long, explicitly supplied response for print verification. "
        .repeat(90)
        .slice(0, 5000),
    );
  await page
    .getByRole("button", { name: "Save & preview quote", exact: true })
    .click();
  await expect(page.locator(".pricing-table tfoot")).toContainText("$210.00");
  await page.pdf({
    path: resolve(output, "change-order-long-a4.pdf"),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await context.close();

  const videoContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
    reducedMotion: "reduce",
  });
  const videoPage = await videoContext.newPage();
  const video = videoPage.video();
  const videoStarted = Date.now();
  videoPage.on("pageerror", (error) => errors.push(error.message));
  await videoPage.goto(url);
  await ready(videoPage);
  await pause(3500);
  await videoPage.getByRole("button", { name: "Explore the example" }).click();
  await expect(
    videoPage.getByLabel("Request title", { exact: true }),
  ).toBeVisible();
  await pause(3500);
  await videoPage.getByLabel("Estimated time (minutes)").fill("20");
  await videoPage.locator(".estimate-strip").scrollIntoViewIfNeeded();
  await expect(videoPage.locator(".estimate-total")).toContainText("$30.00");
  await pause(3000);
  await videoPage.getByRole("button", { name: /generate response/i }).click();
  await videoPage
    .getByRole("dialog", { name: "Replace your response?" })
    .getByRole("button", { name: "Replace response", exact: true })
    .click();
  await expect(
    videoPage.getByLabel("Your response", { exact: true }),
  ).toHaveValue(/30\.00/);
  await videoPage
    .getByLabel("Your response", { exact: true })
    .scrollIntoViewIfNeeded();
  await pause(3500);
  await videoPage
    .getByRole("button", { name: "Save draft", exact: true })
    .last()
    .click();
  await expect(
    videoPage.getByText("Saved draft", { exact: true }),
  ).toBeVisible();
  await videoPage
    .getByRole("button", { name: "Preview quote", exact: true })
    .click();
  await expect(videoPage.locator(".pricing-table tfoot")).toContainText(
    "$30.00",
  );
  await pause(4500);
  await videoPage
    .getByRole("button", { name: "Publish quote", exact: true })
    .click();
  await pause(1500);
  await videoPage
    .getByRole("dialog", { name: "Publish this quote?" })
    .getByRole("button", { name: "Publish quote", exact: true })
    .click();
  await expect(
    videoPage.getByRole("article", { name: "Published change order" }),
  ).toBeVisible();
  await pause(2500);
  await videoPage
    .getByRole("button", { name: "Record acceptance", exact: true })
    .click();
  const approval = videoPage.getByRole("dialog", {
    name: "Record external approval",
  });
  await approval
    .getByLabel("Approval reference")
    .fill("Sample email approval — demonstration only");
  await approval.getByLabel("Approval date").fill("2026-10-26");
  await pause(2500);
  await approval
    .getByRole("button", { name: "Record acceptance", exact: true })
    .click();
  await expect(approval).toBeHidden();
  await videoPage.locator(".approval-record").scrollIntoViewIfNeeded();
  await pause(3500);
  await videoPage
    .locator(".sidebar")
    .getByRole("link", { name: "Decision log", exact: true })
    .click();
  await expect(
    videoPage.getByRole("heading", { name: "A history you can stand behind." }),
  ).toBeVisible();
  await pause(3500);
  const durationSeconds = (Date.now() - videoStarted) / 1000;
  expect(durationSeconds).toBeGreaterThanOrEqual(30);
  expect(durationSeconds).toBeLessThanOrEqual(60);
  await videoContext.close();
  await rename(
    await video.path(),
    resolve(output, "specscope-walkthrough.webm"),
  );
  expect(errors).toEqual([]);
  await writeFile(
    resolve(output, "capture-environment.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url,
        browser: "Chromium " + browser.version(),
        desktop: "1440x1000",
        mobile: "360x800",
        walkthroughSeconds: durationSeconds,
        platform: os.platform(),
        osRelease: os.release(),
        cpu: os.cpus()[0].model,
        logicalCpus: os.cpus().length,
        memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
        node: process.version,
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Captured desktop/mobile screens, A4/Letter reports, and a " +
      durationSeconds.toFixed(1) +
      "s walkthrough in docs/evidence.\n",
  );
} finally {
  await browser?.close();
  preview?.kill();
}

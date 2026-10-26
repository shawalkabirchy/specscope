import { chromium, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { maximumWorkspace } from "../tests/reference-fixture.mjs";

const output = fileURLToPath(new URL("../docs/evidence/", import.meta.url));
const url = "http://127.0.0.1:" + (process.env.SPECSCOPE_PORT || "4173");
const workspace = maximumWorkspace();
const json = JSON.stringify({
  appId: "P06",
  formatVersion: 1,
  exportedAt: new Date().toISOString(),
  payload: workspace,
});
expect(Buffer.byteLength(json)).toBeLessThanOrEqual(10 * 1024 * 1024);
expect((await fetch(url)).ok).toBe(true);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await page.goto(url + "/settings/?workspace=demo");
  await expect(page.locator("#main-content")).toBeVisible();
  await page.getByLabel("Import workspace backup").setInputFiles({
    name: "synthetic-reference.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await page
    .getByRole("dialog", { name: "Replace this workspace with the backup?" })
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good work starts with clear scope." }),
  ).toBeVisible();
  await page.goto(
    url + "/compare/?workspace=demo&requestId=" + workspace.requests[0].id,
  );
  await expect(page.getByLabel("Estimated time (minutes)")).toBeVisible();
  await page.evaluate(() => {
    window.__specscopeMeasurements = [];
    document
      .querySelector("#request-estimatedMinutes")
      .addEventListener("input", (event) => {
        const started = performance.now();
        const minutes = Number(event.target.value);
        const expectedFee = "$" + (Math.ceil(minutes / 15) * 15).toFixed(2);
        requestAnimationFrame(() =>
          window.__specscopeMeasurements.push({
            milliseconds: performance.now() - started,
            correct: document
              .querySelector(".estimate-total")
              .textContent.includes(expectedFee),
          }),
        );
      });
  });
  for (let index = 0; index < 20; index++) {
    await page
      .getByLabel("Estimated time (minutes)")
      .fill(String(16 + index * 15));
    await expect
      .poll(() => page.evaluate(() => window.__specscopeMeasurements.length))
      .toBe(index + 1);
  }
  const measurements = await page.evaluate(
    () => window.__specscopeMeasurements,
  );
  expect(measurements.every((item) => item.correct)).toBe(true);
  const ordered = measurements
    .map((item) => item.milliseconds)
    .sort((a, b) => a - b);
  const maximum = ordered.at(-1);
  expect(maximum).toBeLessThan(200);
  const result = {
    measuredAt: new Date().toISOString(),
    url,
    browser: "Chromium " + browser.version(),
    viewport: "1440x1000",
    platform: os.platform(),
    osRelease: os.release(),
    cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
    counts: {
      projects: 50,
      requests: 1000,
      revisionsPerProject: 20,
      deliverablesPerRevision: 50,
    },
    backupBytes: Buffer.byteLength(json),
    operation:
      "Input event to next animation frame containing the correct live fee",
    samples: measurements.length,
    medianMilliseconds: (ordered[9] + ordered[10]) / 2,
    p95Milliseconds: ordered[18],
    maximumMilliseconds: maximum,
    targetMilliseconds: 200,
    measurements,
    limitations:
      "Reference desktop measurement with synthetic records; does not benchmark a cold load, full-workspace save, phone hardware, or a service-level guarantee.",
  };
  await mkdir(output, { recursive: true });
  await writeFile(
    output + "/performance.json",
    JSON.stringify(result, null, 2),
  );
  process.stdout.write(
    JSON.stringify({
      samples: result.samples,
      p95Milliseconds: result.p95Milliseconds,
      maximumMilliseconds: result.maximumMilliseconds,
      targetMilliseconds: result.targetMilliseconds,
    }) + "\n",
  );
} finally {
  await browser.close();
}

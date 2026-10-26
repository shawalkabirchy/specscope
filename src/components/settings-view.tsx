"use client";

import { useRef, useState } from "react";
import {
  Database,
  Download,
  HardDrive,
  Info,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { fieldError, FormField, PageHeading } from "./shared";
import { discardUnsavedForms, useLocalForm } from "@/hooks/use-local-form";
import { type Workspace } from "@/lib/schema";
import { emptyWorkspace } from "@/lib/workspace";
import { sampleWorkspace } from "@/lib/sample";
import { backupBytes, MAX_BACKUP_BYTES } from "@/lib/validation";
import { downloadText, exportBackup, readBackupFile } from "@/lib/storage";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";

export function SettingsView() {
  const context = useWorkspace();
  const { workspace, mode } = context;
  const form = useLocalForm(
    mode + ":settings",
    { timeZone: workspace.settings.timeZone },
    workspace.revision,
  );
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [replacement, setReplacement] = useState<{
    data: Workspace;
    revision: number;
    kind: "import" | "reset";
  } | null>(null);
  const bytes = backupBytes(workspace);

  function backup() {
    try {
      downloadText(
        exportBackup(workspace),
        "specscope-" + mode + "-backup.json",
      );
      context.notify(
        "Backup prepared. Keep the downloaded file somewhere safe.",
      );
    } catch (error) {
      context.fail(error);
    }
  }
  async function read(file: File) {
    setReading(true);
    const revision = workspace.revision;
    try {
      setReplacement({
        data: await readBackupFile(file),
        revision,
        kind: "import",
      });
    } catch (error) {
      context.fail(error);
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <PageHeading
        title="Private by default. Backed up by you."
        description="Your work stays on this device. A downloaded backup keeps it in your hands."
      />
      <div className="settings-layout">
        <div className="settings-main">
          <section className="surface settings-section">
            <div className="section-icon-heading">
              <Download aria-hidden="true" />
              <div>
                <h2>Keep a copy of your work</h2>
                <p>
                  Export all saved projects, revisions, requests, quotes, and
                  decisions.
                </p>
              </div>
            </div>
            <div className="backup-actions">
              <Button onClick={backup} disabled={context.saving}>
                <Download data-icon="inline-start" />
                Export workspace backup
              </Button>
              <Button
                variant="outline"
                onClick={() => input.current?.click()}
                disabled={reading || context.saving}
              >
                <Upload data-icon="inline-start" />
                {reading ? "Validating backup…" : "Import backup"}
              </Button>
              <input
                className="sr-only"
                ref={input}
                aria-label="Import workspace backup"
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void read(file);
                }}
              />
            </div>
            <p className="muted small-copy">
              JSON format · 10 MiB maximum · Imports replace this workspace
              after validation and confirmation. Unsaved form edits are not
              included in a regular backup.
            </p>
          </section>
          <section className="surface settings-section">
            <div className="section-icon-heading">
              <Database aria-hidden="true" />
              <div>
                <h2>Workspace details</h2>
                <p>
                  {mode === "demo"
                    ? "Sample data is separate from your personal records."
                    : "These records belong to your personal workspace in this browser."}
                </p>
              </div>
            </div>
            <dl className="workspace-facts">
              <div>
                <dt>Projects</dt>
                <dd>{workspace.projects.length} / 50</dd>
              </div>
              <div>
                <dt>Requests</dt>
                <dd>{workspace.requests.length} / 1,000</dd>
              </div>
              <div>
                <dt>Published quotes</dt>
                <dd>{workspace.quotes.length}</dd>
              </div>
              <div>
                <dt>Decision events</dt>
                <dd>{workspace.events.length}</dd>
              </div>
              <div>
                <dt>Workspace size</dt>
                <dd>
                  {(bytes / 1024).toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  KiB / 10 MiB
                </dd>
              </div>
              <div>
                <dt>Saved revision</dt>
                <dd>{workspace.revision}</dd>
              </div>
            </dl>
            <meter
              className="storage-meter"
              min={0}
              max={MAX_BACKUP_BYTES}
              value={bytes}
              aria-label="Workspace storage used"
            />
            <p className="muted small-copy">
              The aggregate limit also covers the complete backup. Larger
              changes are rejected before overwriting saved data.
            </p>
          </section>
          <section className="surface settings-section">
            <h2>Dates & time zone</h2>
            <p className="muted">
              Use this zone when displaying saved timestamps. Approval calendar
              dates never shift between zones.
            </p>
            <form
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                const committed = await context.commit(
                  (current) => ({
                    ...current,
                    settings: { timeZone: form.value.timeZone.trim() },
                  }),
                  form.revision,
                );
                if (committed)
                  form.saved(
                    { timeZone: committed.settings.timeZone },
                    committed.revision,
                  );
              }}
            >
              <FieldGroup>
                <FormField
                  id="settings-timeZone"
                  label="Display time zone"
                  hint="An IANA name, such as Asia/Dhaka, UTC, or America/New_York."
                  error={fieldError(context.error, "timeZone")}
                >
                  <Input
                    id="settings-timeZone"
                    value={form.value.timeZone}
                    onChange={(event) =>
                      form.update({ timeZone: event.target.value })
                    }
                    aria-invalid={!!fieldError(context.error, "timeZone")}
                    aria-describedby={
                      fieldError(context.error, "timeZone")
                        ? "settings-timeZone-error"
                        : "settings-timeZone-hint"
                    }
                  />
                </FormField>
                <div>
                  <Button
                    variant="outline"
                    type="submit"
                    disabled={context.saving}
                  >
                    Save time zone
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </section>
          <section className="surface settings-section reset-section">
            <h2>
              {mode === "demo"
                ? "Restore the sample workspace"
                : "Reset personal workspace"}
            </h2>
            <p className="muted">
              {mode === "demo"
                ? "Replace edited demo records with the original synthetic examples. Personal data stays untouched."
                : "Remove all personal records from this browser. Export a backup first if you want to keep them."}
            </p>
            <Button
              variant="destructive"
              disabled={context.saving}
              onClick={() =>
                setReplacement({
                  data:
                    mode === "demo"
                      ? sampleWorkspace()
                      : emptyWorkspace(workspace.settings.timeZone),
                  revision: workspace.revision,
                  kind: "reset",
                })
              }
            >
              <RotateCcw data-icon="inline-start" />
              {mode === "demo"
                ? "Restore sample data"
                : "Reset personal workspace"}
            </Button>
          </section>
        </div>
        <aside className="surface privacy-panel">
          <ShieldCheck aria-hidden="true" />
          <h2>Your workspace, on your device.</h2>
          <p>
            SpecScope stores records in this browser’s IndexedDB. There are no
            accounts, uploads, analytics, or cloud copies of your content.
          </p>
          <Separator />
          <h3>A browser is not a backup service.</h3>
          <p>
            Clearing site data, private browsing, device loss, or browser
            eviction can remove these records. Download backups regularly.
          </p>
          <p>
            Separate browsers, devices, and website addresses have separate
            storage. Export and import a backup when moving your work.
          </p>
          <Alert>
            <Info />
            <AlertDescription>
              Sample records are fictional. Quotes document your decisions;
              approvals are recorded manually.
            </AlertDescription>
          </Alert>
          <a
            href="https://consolelog.studio/"
            target="_blank"
            rel="noreferrer"
            tabIndex={0}
          >
            A self-initiated project by ConsoleLog Studio
            <HardDrive aria-hidden="true" />
          </a>
          <a
            href="/third-party-notices.txt"
            target="_blank"
            rel="noreferrer"
            tabIndex={0}
          >
            Open-source licenses & font attribution
          </a>
        </aside>
      </div>
      <Dialog
        open={replacement !== null}
        onOpenChange={(open) => {
          if (!open) setReplacement(null);
        }}
      >
        <DialogContent className="replacement-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {replacement?.kind === "import"
                ? "Replace this workspace with the backup?"
                : mode === "demo"
                  ? "Restore original sample data?"
                  : "Reset your personal workspace?"}
            </DialogTitle>
            <DialogDescription>
              This replaces all records in the{" "}
              {mode === "demo" ? "sample" : "personal"} workspace. The other
              workspace is not changed. Download your current backup first if
              you need it.
            </DialogDescription>
          </DialogHeader>
          {replacement ? (
            <>
              <dl className="replacement-counts">
                <div>
                  <dt>Projects in replacement</dt>
                  <dd>{replacement.data.projects.length}</dd>
                </div>
                <div>
                  <dt>Requests</dt>
                  <dd>{replacement.data.requests.length}</dd>
                </div>
                <div>
                  <dt>Quote snapshots</dt>
                  <dd>{replacement.data.quotes.length}</dd>
                </div>
                <div>
                  <dt>Decision events</dt>
                  <dd>{replacement.data.events.length}</dd>
                </div>
              </dl>
              <Button variant="outline" onClick={backup}>
                <Download data-icon="inline-start" />
                Back up current workspace first
              </Button>
              {context.error ? (
                <p role="alert" className="form-error">
                  {context.error.message}
                </p>
              ) : null}
              <div className="form-actions">
                <Button variant="outline" onClick={() => setReplacement(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={context.saving}
                  onClick={async () => {
                    const committed = await context.commit(
                      replacement.data,
                      replacement.revision,
                    );
                    if (committed) {
                      discardUnsavedForms(mode);
                      setReplacement(null);
                      await context.navigate(context.href("/"));
                    }
                  }}
                >
                  {context.saving ? "Replacing…" : "Replace current workspace"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

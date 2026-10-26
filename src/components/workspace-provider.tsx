"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { AppError, readableError } from "@/lib/errors";
import { type Workspace, type WorkspaceMode } from "@/lib/schema";
import { sampleWorkspace } from "@/lib/sample";
import {
  commitWorkspace,
  downloadText,
  exportBackup,
  loadWorkspace,
} from "@/lib/storage";
import { emptyWorkspace } from "@/lib/workspace";
import {
  discardUnsavedForms,
  hasUnsavedForms,
  unsavedText,
} from "@/hooks/use-local-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Confirmation = {
  title: string;
  description: string;
  action?: string;
  destructive?: boolean;
};
type WorkspaceContext = {
  mode: WorkspaceMode;
  workspace: Workspace;
  saving: boolean;
  error: AppError | null;
  commit: (
    change: Workspace | ((current: Workspace) => Workspace),
    expectedRevision?: number,
  ) => Promise<Workspace | null>;
  confirm: (options: Confirmation) => Promise<boolean>;
  navigate: (href: string) => Promise<void>;
  href: (path: string, values?: Record<string, string | undefined>) => string;
  fail: (error: unknown) => void;
  notify: (message: string) => void;
  copy: (text: string, message?: string) => Promise<void>;
};
const Context = createContext<WorkspaceContext | null>(null);

export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace provider is missing.");
  return context;
}

export function WorkspaceProvider({
  mode,
  children,
}: {
  mode: WorkspaceMode;
  children: React.ReactNode;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationResult = useRef<((value: boolean) => void) | null>(null);
  const busy = useRef(false);
  const pending = useRef<Workspace | null>(null);
  const confirmationFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    loadWorkspace(mode)
      .then((loaded) => {
        if (active) setWorkspace(loaded);
      })
      .catch((reason) => {
        if (!active) return;
        setWorkspace(mode === "demo" ? sampleWorkspace() : emptyWorkspace());
        setStorageUnavailable(true);
        setError(readableError(reason));
      });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedForms(mode) || pending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      active = false;
      window.removeEventListener("beforeunload", beforeUnload);
      confirmationResult.current?.(false);
    };
  }, [mode]);

  function fail(reason: unknown) {
    setMessage("");
    setError(readableError(reason));
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    });
  }

  async function commit(
    change: Workspace | ((current: Workspace) => Workspace),
    expectedRevision = workspace?.revision,
  ): Promise<Workspace | null> {
    if (!workspace || expectedRevision === undefined || busy.current)
      return null;
    busy.current = true;
    setSaving(true);
    setMessage("");
    setError(null);
    try {
      const candidate =
        typeof change === "function" ? change(workspace) : change;
      pending.current = candidate;
      const committed = await commitWorkspace(
        mode,
        expectedRevision,
        candidate,
      );
      setWorkspace(committed);
      pending.current = null;
      setStorageUnavailable(false);
      setMessage("Saved in this browser.");
      return committed;
    } catch (reason) {
      fail(reason);
      return null;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function confirm(options: Confirmation): Promise<boolean> {
    if (confirmationResult.current) return Promise.resolve(false);
    confirmationFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmation(options);
    return new Promise((resolve) => {
      confirmationResult.current = resolve;
    });
  }
  function resolveConfirmation(value: boolean) {
    confirmationResult.current?.(value);
    confirmationResult.current = null;
    setConfirmation(null);
    requestAnimationFrame(() => confirmationFocus.current?.focus());
  }
  async function navigate(href: string) {
    if (saving) return;
    if (hasUnsavedForms(mode) || pending.current) {
      if (
        !(await confirm({
          title: "Leave without saving?",
          description:
            "This screen has changes that are not saved. Stay here to save or copy them before leaving.",
          action: "Discard changes",
          destructive: true,
        }))
      )
        return;
      discardUnsavedForms(mode);
      pending.current = null;
    }
    setError(null);
    setMessage("");
    // All views are local; native history keeps navigation independent of the network.
    window.history.pushState(null, "", href);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function href(path: string, values: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams({ workspace: mode });
    for (const [key, value] of Object.entries(values))
      if (value) params.set(key, value);
    return path + (path.endsWith("/") ? "" : "/") + "?" + params.toString();
  }
  async function copy(text: string, success = "Copied to clipboard.") {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(success);
    } catch {
      setError(
        new AppError(
          "CLIPBOARD_UNAVAILABLE",
          "Clipboard access was blocked. Select the text and copy it manually.",
        ),
      );
    }
  }
  async function reload() {
    if (hasUnsavedForms(mode) || pending.current) {
      if (
        !(await confirm({
          title: "Reload the latest workspace?",
          description:
            "Copy or export your unsaved changes first. Reloading discards them and reads the latest committed data.",
          action: "Discard and reload",
          destructive: true,
        }))
      )
        return;
    }
    discardUnsavedForms(mode);
    pending.current = null;
    window.location.reload();
  }
  function exportRecovery() {
    try {
      const recovery = pending.current ?? workspace;
      if (recovery)
        downloadText(
          exportBackup(recovery),
          "specscope-" + mode + "-recovery.json",
        );
    } catch (reason) {
      fail(reason);
    }
  }

  if (!workspace)
    return (
      <div className="initial-loading" role="status">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            [ ]
          </span>
          SpecScope
        </span>
        <p>Opening your local workspace…</p>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full max-w-lg" />
      </div>
    );

  return (
    <Context.Provider
      value={{
        mode,
        workspace,
        saving,
        error,
        commit,
        confirm,
        navigate,
        href,
        fail,
        notify: setMessage,
        copy,
      }}
    >
      {storageUnavailable ? (
        <Alert variant="destructive" className="storage-banner">
          <AlertCircle />
          <AlertTitle>Storage unavailable · changes are not saved</AlertTitle>
          <AlertDescription>
            Stored records could not be loaded and have been preserved. Copy
            your unsaved text or export the in-memory recovery workspace before
            closing this tab.
          </AlertDescription>
        </Alert>
      ) : null}
      {children}
      {error ? (
        <div className="error-notice no-print">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>
              {error.code === "STALE_LOCAL_STATE"
                ? "This workspace changed in another tab"
                : "This action did not finish"}
            </AlertTitle>
            <AlertDescription>
              <p>{error.message}</p>
              <div className="inline-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copy(unsavedText(mode), "Unsaved fields copied.")
                  }
                >
                  <Copy data-icon="inline-start" />
                  Copy unsaved text
                </Button>
                <Button variant="outline" size="sm" onClick={exportRecovery}>
                  <Download data-icon="inline-start" />
                  Export recovery
                </Button>
                <Button variant="outline" size="sm" onClick={reload}>
                  <RefreshCw data-icon="inline-start" />
                  Reload latest
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div
        className="save-announcement no-print"
        role="status"
        aria-live="polite"
      >
        {saving ? (
          <>
            <LoaderCircle aria-hidden="true" className="spin" />
            Saving…
          </>
        ) : message ? (
          <>
            <Check aria-hidden="true" />
            {message}
          </>
        ) : null}
      </div>
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) resolveConfirmation(false);
        }}
      >
        <DialogContent showCloseButton={false} finalFocus={confirmationFocus}>
          <DialogHeader>
            <DialogTitle>{confirmation?.title}</DialogTitle>
            <DialogDescription>{confirmation?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => resolveConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              variant={confirmation?.destructive ? "destructive" : "default"}
              onClick={() => resolveConfirmation(true)}
            >
              {confirmation?.action ?? "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}

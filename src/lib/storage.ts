import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { AppError, readableError } from "./errors";
import { type Workspace, type WorkspaceMode } from "./schema";
import {
  backupEnvelope,
  MAX_BACKUP_BYTES,
  parseBackup,
  validateWorkspace,
} from "./validation";
import { emptyWorkspace } from "./workspace";
import { sampleWorkspace } from "./sample";

interface WorkspaceDatabase extends DBSchema {
  workspace: { key: string; value: Workspace };
}

async function openWorkspace(
  mode: WorkspaceMode,
): Promise<IDBPDatabase<WorkspaceDatabase>> {
  const connection = await openDB<WorkspaceDatabase>("specscope-" + mode, 1, {
    upgrade(db) {
      db.createObjectStore("workspace");
    },
    blocking() {
      connection?.close();
    },
    blocked() {
      /* Existing data stays intact; another open tab must close before upgrades. */
    },
  });
  return connection;
}

export async function loadWorkspace(mode: WorkspaceMode): Promise<Workspace> {
  let db: IDBPDatabase<WorkspaceDatabase> | undefined;
  try {
    db = await openWorkspace(mode);
    const existing = await db.get("workspace", "current");
    if (existing) return validateWorkspace(existing);
    const initial = mode === "demo" ? sampleWorkspace() : emptyWorkspace();
    validateWorkspace(initial);
    const tx = db.transaction("workspace", "readwrite");
    const concurrent = await tx.store.get("current");
    if (!concurrent) await tx.store.put(initial, "current");
    await tx.done;
    return validateWorkspace(concurrent ?? initial);
  } catch (error) {
    throw readableError(error);
  } finally {
    db?.close();
  }
}

export async function commitWorkspace(
  mode: WorkspaceMode,
  expectedRevision: number,
  candidate: Workspace,
): Promise<Workspace> {
  let db: IDBPDatabase<WorkspaceDatabase> | undefined;
  try {
    const next = validateWorkspace({
      ...candidate,
      revision: expectedRevision + 1,
    });
    db = await openWorkspace(mode);
    const tx = db.transaction("workspace", "readwrite");
    try {
      const existing = await tx.store.get("current");
      if (!existing || existing.revision !== expectedRevision)
        throw new AppError(
          "STALE_LOCAL_STATE",
          "Another tab changed this workspace. Reload the latest data or copy your unsaved text.",
        );
      try {
        validateWorkspace(existing);
      } catch {
        throw new AppError(
          "STORAGE_UNAVAILABLE",
          "Existing stored records could not be validated and have been preserved. Copy or export your pending changes before closing this tab.",
        );
      }
      await tx.store.put(next, "current");
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The transaction may have already aborted. */
      }
      await tx.done.catch(() => {});
      throw error;
    }
    return next;
  } catch (error) {
    throw readableError(error);
  } finally {
    db?.close();
  }
}

export function exportBackup(workspace: Workspace): string {
  validateWorkspace(workspace);
  const text = JSON.stringify(backupEnvelope(workspace));
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new AppError(
      "WORKSPACE_LIMIT",
      "The backup exceeds the 10 MiB limit.",
    );
  return text;
}

export async function readBackupFile(file: File): Promise<Workspace> {
  if (file.size > MAX_BACKUP_BYTES)
    throw new AppError(
      "IMPORT_INVALID",
      "The backup exceeds the 10 MiB limit.",
    );
  return parseBackup(await file.text());
}

export function downloadText(
  text: string,
  filename: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

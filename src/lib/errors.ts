import { z } from "zod";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function readableError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      fields[path] ??= issue.message;
    }
    return new AppError(
      "VALIDATION_ERROR",
      "Check the highlighted fields and try again.",
      fields,
    );
  }
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return new AppError(
      "STORAGE_FULL",
      "Browser storage is full. Your changes are not saved. Export a recovery copy before closing this tab.",
    );
  }
  return new AppError(
    "STORAGE_UNAVAILABLE",
    "Local storage could not complete this operation. Keep this tab open and export your changes.",
  );
}

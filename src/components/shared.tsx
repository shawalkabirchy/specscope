"use client";

import { ArrowLeft, FileText } from "lucide-react";
import { type AppError } from "@/lib/errors";
import { type Project, type RequestStatus } from "@/lib/schema";
import { statusLabels } from "@/lib/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useWorkspace } from "./workspace-provider";

export function PageHeading({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  back?: { label: string; href: string };
}) {
  const context = useWorkspace();
  return (
    <header className="page-heading">
      {back ? (
        <Button
          variant="link"
          className="back-link"
          onClick={() => context.navigate(back.href)}
        >
          <ArrowLeft data-icon="inline-start" />
          {back.label}
        </Button>
      ) : null}
      <div className="heading-row">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action ? <div className="heading-actions">{action}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge
      variant={
        status === "accepted"
          ? "default"
          : status === "rejected"
            ? "destructive"
            : "secondary"
      }
      data-status={status}
    >
      {statusLabels[status]}
    </Badge>
  );
}

export function fieldError(
  error: AppError | null,
  field: string,
): string | undefined {
  return Object.entries(error?.fieldErrors ?? {}).find(
    ([path, message]) =>
      message && (path === field || path.endsWith("." + field)),
  )?.[1];
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {hint ? (
        <FieldDescription id={id + "-hint"}>{hint}</FieldDescription>
      ) : null}
      {error ? <FieldError id={id + "-error"}>{error}</FieldError> : null}
    </Field>
  );
}

export function ProjectSelect({
  value,
  onChange,
  projects,
  label = "Project",
  includeAll = false,
}: {
  value: string;
  onChange: (id: string) => void;
  projects: Project[];
  label?: string;
  includeAll?: boolean;
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {includeAll ? (
        <NativeSelectOption value="">All projects</NativeSelectOption>
      ) : null}
      {projects.map((project) => (
        <NativeSelectOption key={project.id} value={project.id}>
          {project.name}
          {project.archived ? " (archived)" : ""}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function dateTime(value: string, timeZone: string, withTime = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone,
  }).format(new Date(value));
}

export function calendarDate(value: string) {
  return dateTime(value + "T00:00:00.000Z", "UTC");
}

export function todayInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)?.value)
    .join("-");
}

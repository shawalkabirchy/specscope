"use client";

import { useState } from "react";
import {
  BookOpen,
  Brackets,
  ChevronRight,
  FileText,
  Folder,
  History,
  Info,
  Menu,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";

export type View =
  | "projects"
  | "requests"
  | "scope"
  | "compare"
  | "quote"
  | "decisions"
  | "settings";
const navigation = [
  { view: "projects", label: "Projects", icon: Folder, path: "/" },
  { view: "requests", label: "Requests", icon: FileText, path: "/requests/" },
  { view: "scope", label: "Scope history", icon: History, path: "/scope/" },
  {
    view: "decisions",
    label: "Decision log",
    icon: BookOpen,
    path: "/decisions/",
  },
] as const;

export function AppShell({
  view,
  projectId,
  children,
}: {
  view: View;
  projectId?: string;
  children: React.ReactNode;
}) {
  const context = useWorkspace();
  const { workspace, mode } = context;
  const [menuOpen, setMenuOpen] = useState(false);
  const project = workspace.projects.find((item) => item.id === projectId);
  const selected = view === "compare" || view === "quote" ? "requests" : view;

  function go(path: string) {
    setMenuOpen(false);
    void context.navigate(context.href(path));
  }
  const nav = (
    <nav aria-label="Main navigation" className="main-navigation">
      {navigation.map((item) => (
        <a
          key={item.view}
          tabIndex={0}
          href={context.href(item.path)}
          aria-current={selected === item.view ? "page" : undefined}
          className={cn("nav-item", selected === item.view && "is-active")}
          onClick={(event) => {
            event.preventDefault();
            go(item.path);
          }}
        >
          <item.icon aria-hidden="true" />
          <span>{item.label}</span>
          {item.view === "requests" ? (
            <span className="nav-count">
              {
                workspace.requests.filter(
                  (request) => request.status === "draft",
                ).length
              }
            </span>
          ) : null}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content" tabIndex={0}>
        Skip to content
      </a>
      <aside className="sidebar no-print">
        <a
          className="brand"
          tabIndex={0}
          href={context.href("/")}
          onClick={(event) => {
            event.preventDefault();
            go("/");
          }}
        >
          <Brackets className="brand-symbol" aria-hidden="true" />
          SpecScope
        </a>
        {nav}
        <div className="sidebar-bottom">
          <a
            className={cn("nav-item", view === "settings" && "is-active")}
            aria-current={view === "settings" ? "page" : undefined}
            href={context.href("/settings/")}
            tabIndex={0}
            onClick={(event) => {
              event.preventDefault();
              go("/settings/");
            }}
          >
            <Settings aria-hidden="true" />
            Settings & backups
          </a>
          <Separator />
          <div className="studio-credit">
            <span className="studio-monogram" aria-hidden="true">
              CL
            </span>
            <div>
              <a
                href="https://consolelog.studio/"
                tabIndex={0}
                target="_blank"
                rel="noreferrer"
              >
                ConsoleLog Studio
              </a>
              <span>Self-initiated studio project</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="utility-bar no-print">
          <div className="utility-left">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              className="mobile-menu-button"
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </Button>
            <span className="mobile-brand">SpecScope</span>
            <span className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight aria-hidden="true" />
              <strong>
                {project?.name ??
                  (mode === "demo" ? "Sample projects" : "Your projects")}
              </strong>
            </span>
          </div>
          <div className="utility-right">
            <span className="privacy-note">
              <ShieldCheck aria-hidden="true" />
              Stored on your device
            </span>
            <NativeSelect
              aria-label="Workspace"
              value={mode}
              onChange={(event) => {
                void context.navigate("/?workspace=" + event.target.value);
              }}
            >
              <NativeSelectOption value="demo">
                Sample workspace
              </NativeSelectOption>
              <NativeSelectOption value="personal">
                Personal workspace
              </NativeSelectOption>
            </NativeSelect>
          </div>
        </header>
        {mode === "demo" ? (
          <div className="demo-banner no-print">
            <span>
              <Info aria-hidden="true" />
              You’re exploring sample data. Everything stays in this browser.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => context.navigate("/?workspace=personal")}
            >
              Start your workspace
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        ) : (
          <div className="personal-banner no-print">
            <ShieldCheck aria-hidden="true" />
            <span>
              Your private workspace. Back up your records regularly from
              Settings.
            </span>
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="page-content">
          {children}
        </main>
        <footer className="app-footer no-print">
          <span>Clear decisions. Shared expectations.</span>
          <span>Local-first, by design.</span>
        </footer>
      </div>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="mobile-navigation">
          <DialogHeader>
            <DialogTitle>SpecScope</DialogTitle>
            <DialogDescription>
              Your scope and change-order workspace.
            </DialogDescription>
          </DialogHeader>
          {nav}
          <Button variant="outline" onClick={() => go("/settings/")}>
            <Settings data-icon="inline-start" />
            Settings & backups
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

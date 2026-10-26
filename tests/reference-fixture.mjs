/** @returns {import("../src/lib/schema").Workspace} */
export function maximumWorkspace() {
  const workspace = {
    revision: 0,
    settings: { timeZone: "Asia/Dhaka" },
    projects: [],
    scopes: [],
    requests: [],
    quotes: [],
    events: [],
  };
  const at = "2026-10-20T09:00:00.000Z";
  workspace.projects = Array.from({ length: 50 }, (_, index) => ({
    id: crypto.randomUUID(),
    name: "Reference project " + (index + 1),
    clientAlias: "Synthetic client " + (index + 1),
    currency: "USD",
    hourlyRateMinor: 6000,
    archived: false,
    createdAt: at,
    updatedAt: at,
  }));
  workspace.scopes = workspace.projects.flatMap((project) =>
    Array.from({ length: 20 }, (_, revision) => ({
      id: crypto.randomUUID(),
      projectId: project.id,
      revision: revision + 1,
      originalScopeText: "",
      deliverables: Array.from({ length: 50 }, (_, index) => ({
        id: crypto.randomUUID(),
        title: "Deliverable " + (index + 1),
        description:
          "Synthetic agreed deliverable for the reference measurement.",
      })),
      createdAt: at,
    })),
  );
  workspace.requests = Array.from({ length: 1000 }, (_, index) => {
    const project = workspace.projects[Math.floor(index / 20)];
    const scope = workspace.scopes[Math.floor(index / 20) * 20 + 19];
    return {
      id: crypto.randomUUID(),
      projectId: project.id,
      scopeRevisionId: scope.id,
      title: "Reference change request " + (index + 1),
      requestText: "Please add a reporting dashboard.",
      linkedDeliverableIds: [scope.deliverables[0].id],
      classification: "additional",
      reason: "This reporting feature is outside the agreed deliverables.",
      estimatedMinutes: 20,
      responseText: "",
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
  });
  return workspace;
}

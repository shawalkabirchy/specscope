import { type ChangeRequest, type Workspace } from "./schema";
import { publishQuote, recordDecision, responseTemplate } from "./workspace";

export function sampleId(value: number): string {
  return "10000000-0000-4000-8000-" + String(value).padStart(12, "0");
}

export function sampleWorkspace(): Workspace {
  const createdAt = "2026-10-16T09:00:00.000Z";
  const requestAt = "2026-10-20T10:00:00.000Z";
  let workspace: Workspace = {
    revision: 0,
    settings: { timeZone: "Asia/Dhaka" },
    projects: [
      {
        id: sampleId(1),
        name: "Meridian website",
        clientAlias: "Meridian Studio",
        currency: "USD",
        hourlyRateMinor: 6_000,
        archived: false,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: sampleId(2),
        name: "Northstar brand launch",
        clientAlias: "Northstar Goods",
        currency: "USD",
        hourlyRateMinor: 9_000,
        archived: false,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    scopes: [
      {
        id: sampleId(11),
        projectId: sampleId(1),
        revision: 1,
        originalScopeText:
          "Design and build a responsive marketing website with home, about, services, and contact pages. Includes a validated inquiry form and two rounds of copy revisions.",
        deliverables: [
          {
            id: sampleId(31),
            title: "Marketing website",
            description:
              "A responsive four-page website: home, about, services, and contact.",
          },
          {
            id: sampleId(32),
            title: "Contact & inquiry form",
            description:
              "A validated inquiry form with an accessible confirmation state.",
          },
        ],
        createdAt,
      },
      {
        id: sampleId(12),
        projectId: sampleId(1),
        revision: 2,
        originalScopeText:
          "A marketing website for Meridian Studio including a responsive design, core pages (home, about, services, contact), a validated contact form, and a content management system so the team can manage site content without code. Includes two rounds of copy revisions. Dashboards, member accounts, and integrations are excluded.",
        deliverables: [
          {
            id: sampleId(31),
            title: "Marketing website",
            description:
              "Design and build a responsive marketing website with home, about, services, and contact pages.",
          },
          {
            id: sampleId(32),
            title: "Contact & inquiry form",
            description:
              "Build and configure a validated inquiry form with an accessible confirmation state.",
          },
          {
            id: sampleId(33),
            title: "Content management",
            description:
              "Set up a CMS for pages, blog posts, and basic site content so the team can manage content without code.",
          },
        ],
        createdAt: "2026-10-18T09:00:00.000Z",
      },
      {
        id: sampleId(13),
        projectId: sampleId(2),
        revision: 1,
        originalScopeText:
          "A brand launch website with a product introduction, brand story, and newsletter signup. Includes responsive implementation and one round of content updates.",
        deliverables: [
          {
            id: sampleId(34),
            title: "Brand launch website",
            description: "A responsive product introduction and brand story.",
          },
          {
            id: sampleId(35),
            title: "Newsletter signup",
            description: "A newsletter signup form and confirmation message.",
          },
        ],
        createdAt,
      },
    ],
    requests: [],
    quotes: [],
    events: [],
  };
  const request = (
    number: number,
    title: string,
    requestText: string,
    classification: ChangeRequest["classification"],
    reason: string,
    estimatedMinutes?: number,
    linkedDeliverableIds: string[] = [],
  ): ChangeRequest => ({
    id: sampleId(number),
    projectId: sampleId(1),
    scopeRevisionId: sampleId(12),
    title,
    requestText,
    classification,
    reason,
    linkedDeliverableIds,
    ...(estimatedMinutes === undefined ? {} : { estimatedMinutes }),
    responseText: "",
    status: "draft",
    createdAt: requestAt,
    updatedAt: requestAt,
  });
  workspace.requests = [
    request(
      101,
      "Add an analytics dashboard",
      "Could we add a dashboard so our team can track inquiries and see which pages are performing best?",
      "additional",
      "A reporting dashboard adds a new authenticated interface and reporting features beyond the agreed marketing website.",
      200,
      [sampleId(31)],
    ),
    request(
      102,
      "Update the homepage copy",
      "Can we replace the homepage headline and update the service descriptions for our launch?",
      "within",
      "This is part of the two agreed rounds of copy revisions.",
      undefined,
      [sampleId(31), sampleId(33)],
    ),
    request(
      103,
      "Add multi-language pages",
      "Could the site also work for our international audience?",
      "clarify",
      "Which languages and pages need translation, and who will supply the translated copy?",
    ),
    request(
      104,
      "Route inquiries by service",
      "Can inquiry submissions route to different teams based on the selected service?",
      "additional",
      "Conditional routing is a new integration beyond the agreed contact form.",
      135,
      [sampleId(32)],
    ),
    request(
      105,
      "Create a member area",
      "Could clients log in and download their project files from a private area?",
      "additional",
      "Member authentication and private file access are excluded from the agreed marketing website.",
      480,
    ),
    request(
      106,
      "Connect a CRM",
      "Could we send all inquiries to our CRM automatically?",
      "additional",
      "CRM integration is outside the original form delivery and needs separate configuration.",
      360,
      [sampleId(32)],
    ),
    {
      ...request(
        107,
        "Refresh the product introduction",
        "Could we shorten the product introduction before launch?",
        "within",
        "The agreed round of content updates includes this request.",
      ),
      projectId: sampleId(2),
      scopeRevisionId: sampleId(13),
      linkedDeliverableIds: [sampleId(34)],
    },
  ];
  workspace.requests = workspace.requests.map((item) => ({
    ...item,
    responseText: responseTemplate(
      item.classification === "clarify" ? "clarification" : "quote",
      workspace.projects.find((project) => project.id === item.projectId)!,
      item,
    ),
  }));
  for (const id of [102, 104, 105, 106])
    workspace = publishQuote(
      workspace,
      sampleId(id),
      "2026-10-21T09:00:00.000Z",
    );
  workspace = recordDecision(
    workspace,
    sampleId(102),
    "accepted",
    "Sample decision for the portfolio demonstration.",
    "Sample email — homepage copy approved",
    "2026-10-22",
    "2026-10-22T14:00:00.000Z",
  );
  workspace = recordDecision(
    workspace,
    sampleId(105),
    "rejected",
    "Sample decision: keep the launch focused on the marketing website.",
    undefined,
    undefined,
    "2026-10-22T14:15:00.000Z",
  );
  workspace = recordDecision(
    workspace,
    sampleId(106),
    "deferred",
    "Sample decision: revisit CRM integration after launch.",
    undefined,
    undefined,
    "2026-10-22T14:30:00.000Z",
  );
  return workspace;
}

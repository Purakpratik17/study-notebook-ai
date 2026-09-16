import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import { chatCompletion } from "./ai";
import { api } from "./_generated/api";

export type ProjectSection = {
  id: string;
  kind: string;
  heading: string;
  body: string;
};

export type ProjectMeta = {
  topic: string;
  subject: string;
  course?: string;
  studentName?: string;
  rollNumber?: string;
  institution?: string;
  teacher?: string;
  pages: number;
  instructions?: string;
};

async function sectionText(prompt: string, maxTokens: number): Promise<string> {
  return await chatCompletion(
    [
      {
        role: "system",
        content:
          "You are an expert academic project writer. Produce clean plain-text content with short headings and paragraphs. No markdown symbols. Use simple inline tables written as 'Label: value' lines when tabular data helps.",
      },
      { role: "user", content: prompt },
    ],
    0.5,
    maxTokens,
  );
}

function planSections(pages: number): Array<{ id: string; kind: string; heading: string }> {
  const core = [
    { id: "front", kind: "front", heading: "Front Page" },
    { id: "ack", kind: "text", heading: "Acknowledgement" },
    { id: "index", kind: "index", heading: "Index" },
    { id: "intro", kind: "text", heading: "Introduction" },
    { id: "objectives", kind: "text", heading: "Objectives" },
  ];
  const chapters = Math.max(2, Math.min(5, Math.round(pages / 3)));
  const chapterList = Array.from({ length: chapters }, (_, i) => ({
    id: `ch${i + 1}`,
    kind: "chapter",
    heading: `Chapter ${i + 1}`,
  }));
  const tail =
    pages >= 8
      ? [
          { id: "cases", kind: "text", heading: "Case Studies / Examples" },
          { id: "data", kind: "table", heading: "Data & Findings" },
        ]
      : [];
  return [
    ...core,
    ...chapterList,
    ...tail,
    { id: "conclusion", kind: "text", heading: "Conclusion" },
    { id: "bibliography", kind: "bibliography", heading: "Bibliography" },
  ];
}

export const generate = action({
  args: {
    topic: v.string(),
    subject: v.string(),
    course: v.optional(v.string()),
    studentName: v.optional(v.string()),
    rollNumber: v.optional(v.string()),
    institution: v.optional(v.string()),
    teacher: v.optional(v.string()),
    pages: v.number(),
    instructions: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ projectId: string; title: string; sections: ProjectSection[] }> => {
    await requireUserId(ctx);
    const topic = args.topic.trim().slice(0, 150);
    if (topic.length < 3) throw new Error("Please enter a project topic");
    const pages = Math.max(3, Math.min(30, Math.floor(args.pages)));
    const plan = planSections(pages);
    const meta = { ...args, pages, topic };

    const sections: ProjectSection[] = [];
    for (const s of plan) {
      const body = await sectionText(
        buildSectionPrompt(meta, s.heading, s.kind),
        s.kind === "front" || s.kind === "index" ? 800 : 2200,
      );
      sections.push({
        id: s.id,
        kind: s.kind,
        heading: s.heading,
        body: body.trim().slice(0, 12_000),
      });
    }

    const title = `${topic} — ${args.subject || "Project"}`;
    const projectId = await ctx.runMutation(api.projects.save, {
      title: title.slice(0, 140),
      meta: meta as unknown as Record<string, unknown>,
      sections,
    });
    return { projectId, title, sections };
  },
});

function buildSectionPrompt(
  meta: ProjectMeta,
  heading: string,
  kind: string,
): string {
  const base = `Project: "${meta.topic}" (Subject: ${meta.subject}${meta.course ? `, Course: ${meta.course}` : ""}). Pages target: ~${meta.pages}. ${meta.instructions ? `Instructions: ${meta.instructions}.` : ""}`;
  switch (kind) {
    case "front":
      return `${base}\nWrite the front-page details as labelled lines exactly in this order (no extra prose):\nTitle:\nSubject:\nSubmitted by:\nClass/Course:\nRoll Number:\nInstitution:\nSubmitted to:\nAcademic Year:`;
    case "index":
      return `${base}\nWrite an Index (table of contents) listing the project sections with realistic page numbers, one per line as '1. Introduction .......... 3'. Use the standard project structure: Introduction, Objectives, Chapters, Conclusion, Bibliography.`;
    case "bibliography":
      return `${base}\nWrite a Bibliography with 6-10 realistic-looking references (books/websites) relevant to the topic, one per line.`;
    case "table":
      return `${base}\nWrite a 'Data & Findings' section containing one small table rendered as aligned 'Label: value' lines (6-10 rows) and 2-3 sentences interpreting the data.`;
    default:
      return `${base}\nWrite the '${heading}' section of this project: 2-4 clear paragraphs, factual and curriculum-appropriate.`;
  }
}

/** Regenerate a single section. */
export const regenerateSection = action({
  args: {
    projectId: v.id("projects"),
    sectionId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ heading: string; body: string }> => {
    await requireUserId(ctx);
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });
    if (!project) throw new Error("Project not found");
    const section = project.sections.find((s) => s.id === args.sectionId);
    if (!section) throw new Error("Section not found");
    const meta = project.meta as unknown as ProjectMeta;
    const body = await sectionText(
      buildSectionPrompt(meta, section.heading, section.kind),
      2200,
    );
    await ctx.runMutation(api.projects.updateSection, {
      projectId: args.projectId,
      sectionId: args.sectionId,
      body: body.trim().slice(0, 12_000),
    });
    return { heading: section.heading, body: body.trim() };
  },
});

export const save = mutation({
  args: {
    title: v.string(),
    meta: v.any(),
    sections: v.array(
      v.object({ id: v.string(), kind: v.string(), heading: v.string(), body: v.string() }),
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("projects", {
      userId,
      title: args.title,
      meta: args.meta,
      sections: args.sections,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSection = mutation({
  args: {
    projectId: v.id("projects"),
    sectionId: v.string(),
    body: v.string(),
    heading: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    const sections = project.sections.map((s) =>
      s.id === args.sectionId
        ? {
            ...s,
            body: args.body.slice(0, 12_000),
            heading: args.heading?.slice(0, 120) ?? s.heading,
          }
        : s,
    );
    await ctx.db.patch(args.projectId, { sections, updatedAt: Date.now() });
    return true;
  },
});

export const addSection = mutation({
  args: {
    projectId: v.id("projects"),
    afterId: v.string(),
    heading: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    const id = `custom-${Date.now().toString(36)}`;
    const idx = project.sections.findIndex((s) => s.id === args.afterId);
    const next = [...project.sections];
    next.splice(idx + 1, 0, {
      id,
      kind: "text",
      heading: args.heading.slice(0, 120),
      body: "(Write your content here, or tap Regenerate.)",
    });
    await ctx.db.patch(args.projectId, { sections: next, updatedAt: Date.now() });
    return id;
  },
});

export const removeSection = mutation({
  args: { projectId: v.id("projects"), sectionId: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    if (project.sections.length <= 1) throw new Error("Cannot remove the last section");
    await ctx.db.patch(args.projectId, {
      sections: project.sections.filter((s) => s.id !== args.sectionId),
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("projects")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) return null;
    return project;
  },
});

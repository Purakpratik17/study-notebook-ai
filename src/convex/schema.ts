import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(v.string()), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // One row of gamification stats per user.
    stats: defineTable({
      userId: v.string(), // Clerk user id
      xp: v.number(),
      level: v.number(),
      streak: v.number(),
      lastStudyDate: v.optional(v.string()), // YYYY-MM-DD of the last XP earning day
      bestStreak: v.number(),
      totalTasksCompleted: v.number(),
      totalQuizzesCompleted: v.number(),
      totalQuizPoints: v.number(),
      totalQuizQuestions: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // Every XP grant is journaled here so rewards can never be duplicated.
    xpEvents: defineTable({
      userId: v.string(),
      amount: v.number(),
      reason: v.string(),
      ref: v.string(), // idempotency key, e.g. "task:<id>" or "quiz:<attemptId>"
      createdAt: v.number(),
    })
      .index("by_user_ref", ["userId", "ref"])
      .index("by_user_created", ["userId", "createdAt"]),

    timetableEntries: defineTable({
      userId: v.string(),
      subject: v.string(),
      date: v.string(), // YYYY-MM-DD
      startTime: v.string(), // HH:MM
      endTime: v.string(), // HH:MM
      notes: v.optional(v.string()),
      completed: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user_date", ["userId", "date"])
      .index("by_user", ["userId"]),

    // A rotation of active quests per user, regenerated when exhausted.
    quests: defineTable({
      userId: v.string(),
      questId: v.string(), // template id from questsCatalog
      title: v.string(),
      description: v.string(),
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard"),
      ),
      xp: v.number(),
      target: v.number(),
      metric: v.union(
        v.literal("quiz_completed"),
        v.literal("task_completed"),
        v.literal("minutes_studied"),
        v.literal("notes_generated"),
        v.literal("quiz_score"),
      ),
      progress: v.number(),
      status: v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("claimed"),
      ),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    // Journal of finished quests; the XP ref uses this id for idempotency.
    questCompletions: defineTable({
      userId: v.string(),
      questKey: v.string(), // quest row id + template id
      questId: v.string(),
      title: v.string(),
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard"),
      ),
      xp: v.number(),
      completedAt: v.number(),
    }).index("by_user", ["userId"]),

    // AI generated notes for a topic.
    notes: defineTable({
      userId: v.string(),
      topic: v.string(),
      notes: v.any(),
      quiz: v.array(
        v.object({
          question: v.string(),
          options: v.array(v.string()),
          correctIndex: v.number(),
          explanation: v.string(),
        }),
      ),
      model: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user_topic", ["userId", "topic"])
      .index("by_user_created", ["userId", "createdAt"]),

    // One row per quiz attempt.
    quizAttempts: defineTable({
      userId: v.string(),
      noteId: v.id("notes"),
      topic: v.string(),
      score: v.number(),
      total: v.number(),
      createdAt: v.number(),
    }).index("by_user_created", ["userId", "createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

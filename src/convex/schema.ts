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
      minutesStudiedToday: v.optional(v.number()),
      minutesDay: v.optional(v.string()), // YYYY-MM-DD the minute counter belongs to
      bestStreak: v.number(),
      totalTasksCompleted: v.number(),
      totalQuizzesCompleted: v.number(),
      totalQuizPoints: v.number(),
      totalQuizQuestions: v.number(),
      totalMinutesStudied: v.optional(v.number()), // lifetime focused-study minutes
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // Editable public profile (never contains email or private ids).
    profiles: defineTable({
      userId: v.string(), // Clerk user id — one profile per identity
      displayName: v.optional(v.string()),
      username: v.optional(v.string()),
      bio: v.optional(v.string()),
      avatar: v.optional(v.string()), // data URL, small (≤ ~200KB)
      school: v.optional(v.string()),
      course: v.optional(v.string()),
      interests: v.optional(v.string()),
      tetrisHighScore: v.optional(v.number()),
      beeHighScore: v.optional(v.number()),
      // Permanent arcade unlocks, e.g. { blocks: true, bee: true }
      arcadeUnlocks: v.optional(v.object({
        blocks: v.optional(v.boolean()),
        bee: v.optional(v.boolean()),
      })),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // Unlocked achievements, one row per (user, achievementId).
    achievements: defineTable({
      userId: v.string(),
      achievementId: v.string(),
      unlockedAt: v.number(),
    }).index("by_user", ["userId"]),

    // AI essays.
    essays: defineTable({
      userId: v.string(),
      title: v.string(),
      topic: v.string(),
      subject: v.optional(v.string()),
      content: v.string(),
      wordCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user_created", ["userId", "createdAt"]),

    // AI school/college projects, stored section-by-section for editing.
    projects: defineTable({
      userId: v.string(),
      title: v.string(),
      meta: v.any(), // form inputs (topic, subject, pages, names, …)
      sections: v.array(
        v.object({
          id: v.string(),
          kind: v.string(),
          heading: v.string(),
          body: v.string(),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user_created", ["userId", "createdAt"]),

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
        v.literal("flashcards_reviewed"),
        v.literal("revision_done"),
        v.literal("focus_completed"),
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
      // User's edited rich-text version — kept SEPARATE from the original
      // AI content so editing never regenerates or clobbers it.
      editedContent: v.optional(v.string()),
      folderId: v.optional(v.id("folders")),
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

    // One row per AI practice session (MCQ drill on a topic).
    practiceSessions: defineTable({
      userId: v.string(),
      subject: v.string(),
      topic: v.string(),
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard"),
      ),
      questions: v.array(
        v.object({
          question: v.string(),
          options: v.array(v.string()),
          correctIndex: v.number(),
          explanation: v.string(),
        }),
      ),
      answers: v.optional(v.array(v.number())), // index-aligned; -1 = unanswered
      score: v.optional(v.number()),
      total: v.number(),
      status: v.union(v.literal("in_progress"), v.literal("completed")),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    }).index("by_user_created", ["userId", "createdAt"]),

    // One row per quiz attempt.
    quizAttempts: defineTable({
      userId: v.string(),
      noteId: v.id("notes"),
      topic: v.string(),
      score: v.number(),
      total: v.number(),
      createdAt: v.number(),
    }).index("by_user_created", ["userId", "createdAt"]),

    // ─── Snap & Solve / AI Tutor ─────────────────────────────────────

    // A solved question (photo or typed) with its AI solution and chat.
    // The tutor conversation lives here so it can always be reopened.
    tutorSessions: defineTable({
      userId: v.string(),
      subject: v.optional(v.string()),
      topic: v.optional(v.string()),
      questionText: v.optional(v.string()), // typed question, if any
      image: v.optional(v.string()), // data URL of the snapped photo (small)
      solution: v.string(),
      messages: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
      status: v.union(v.literal("active"), v.literal("closed")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_user_updated", ["userId", "updatedAt"]),

    // Bookmarked/saved questions (from Practice, Important Questions or
    // Snap & Solve) for later review.
    savedQuestions: defineTable({
      userId: v.string(),
      source: v.string(), // "practice" | "important" | "snap"
      sourceId: v.optional(v.string()),
      subject: v.optional(v.string()),
      topic: v.optional(v.string()),
      question: v.string(),
      answer: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      correctIndex: v.optional(v.number()),
      tutorSessionId: v.optional(v.id("tutorSessions")),
      createdAt: v.number(),
    })
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_user_subject", ["userId", "subject"]),

    // AI-generated "Important Questions" for a topic.
    importantQuestions: defineTable({
      userId: v.string(),
      subject: v.string(),
      topic: v.string(),
      questions: v.array(
        v.object({
          question: v.string(),
          answer: v.string(),
          difficulty: v.string(),
        }),
      ),
      createdAt: v.number(),
    }).index("by_user_topic", ["userId", "topic"]),

    // Remember where a user left off in Subject → Chapter → Topic paths.
    studyPositions: defineTable({
      userId: v.string(),
      subject: v.string(),
      chapter: v.string(),
      topic: v.string(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // ─── Flashcards + spaced repetition revision ─────────────────

    // One flashcard. `nextDue` drives the revision queue.
    flashcards: defineTable({
      userId: v.string(),
      topic: v.string(),
      subject: v.optional(v.string()),
      noteId: v.optional(v.id("notes")), // when generated from a note
      front: v.string(),
      back: v.string(),
      // Simple SM-2-lite state:
      intervalDays: v.number(), // current interval
      ease: v.number(), // multiplier (1.3–2.5)
      nextDue: v.number(), // epoch ms when the card is due again
      reviews: v.number(), // total times reviewed
      lapses: v.number(), // times marked "Again"
      lastReviewedAt: v.optional(v.number()),
      source: v.union(v.literal("manual"), v.literal("ai")),
      dedupeKey: v.optional(v.string()), // ai:<noteId>:<idx> — prevents duplicates
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_due", ["userId", "nextDue"])
      .index("by_dedupe", ["userId", "dedupeKey"]),

    // Log of individual flashcard reviews (for history/stats).
    flashcardReviews: defineTable({
      userId: v.string(),
      cardId: v.id("flashcards"),
      rating: v.union(
        v.literal("again"),
        v.literal("hard"),
        v.literal("good"),
        v.literal("easy"),
      ),
      createdAt: v.number(),
    }).index("by_user_created", ["userId", "createdAt"]),

    // ─── Friends & Chat ──────────────────────────────────────────

    // A friend/chat request. `status`: pending → accepted | declined.
    // Only an accepted request creates a friendship + conversation.
    friendRequests: defineTable({
      fromId: v.string(), // Clerk subject of sender
      toId: v.string(), // Clerk subject of receiver
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
      ),
      createdAt: v.number(),
      respondedAt: v.optional(v.number()),
    })
      .index("by_to_status", ["toId", "status"])
      .index("by_from_status", ["fromId", "status"]),

    // An accepted, mutual friendship (userA < userB, normalized).
    friendships: defineTable({
      userA: v.string(),
      userB: v.string(),
      createdAt: v.number(),
    })
      .index("by_userA", ["userA"])
      .index("by_userB", ["userB"]),

    // One private conversation per accepted friendship (same pair rule).
    // Per-side preferences: userA's flags apply to userA's view, userB's to userB.
    conversations: defineTable({
      userA: v.string(),
      userB: v.string(),
      mutedByUserA: v.optional(v.boolean()),
      mutedByUserB: v.optional(v.boolean()),
      blockedByUserA: v.optional(v.boolean()), // userA blocked userB
      blockedByUserB: v.optional(v.boolean()), // userB blocked userA
      createdAt: v.number(),
    })
      .index("by_pair", ["userA", "userB"])
      .index("by_userA", ["userA"])
      .index("by_userB", ["userB"]),

    messages: defineTable({
      conversationId: v.id("conversations"),
      senderId: v.string(),
      body: v.string(), // text content; "" for pure media messages
      readAt: v.optional(v.number()), // set when the OTHER participant reads it
      // Optional chat attachment (image / video / Chat+ file) in Convex storage.
      // Access is mediated through chat.getMediaUrl — participants only.
      kind: v.optional(
        v.union(v.literal("image"), v.literal("video"), v.literal("file")),
      ),
      storageId: v.optional(v.id("_storage")),
      mediaType: v.optional(v.string()), // MIME type, e.g. image/jpeg
      durationSec: v.optional(v.number()), // video duration (client-reported)
      fileName: v.optional(v.string()), // Chat+ file attachments
      fileSize: v.optional(v.number()),
      shareId: v.optional(v.id("shares")), // study-material share card
      createdAt: v.number(),
    }).index("by_conversation", ["conversationId", "createdAt"]),

    // Incorrect quiz questions saved for revision.
    quizMistakes: defineTable({
      userId: v.string(),
      noteId: v.id("notes"),
      topic: v.string(),
      question: v.string(),
      options: v.array(v.string()),
      correctIndex: v.number(),
      explanation: v.optional(v.string()),
      resolved: v.boolean(), // cleared once answered correctly in revision
      createdAt: v.number(),
    })
      .index("by_user_unresolved", ["userId", "resolved"])
      .index("by_user", ["userId"]),

    // ─── Chat+ subscription ─────────────────────────────────────

    // One row per Google Play purchase. The backend verifies purchases via
    // the Google Play Developer API (server credentials, never the client)
    // before granting the entitlement. `expiresAt` drives expiry: benefits
    // stop automatically once it passes, without deleting any chat data.
    chatPurchases: defineTable({
      userId: v.string(), // Clerk subject
      productId: v.string(), // Google Play product id, e.g. "chat_plus_monthly"
      purchaseToken: v.string(), // unique per purchase (idempotency key)
      orderId: v.optional(v.string()),
      status: v.union(
        v.literal("active"),
        v.literal("expired"),
        v.literal("canceled"),
      ),
      expiresAt: v.number(),
      verifiedAt: v.number(),
      autoRenewing: v.optional(v.boolean()),
      // Admin-granted subscriptions (source = "admin"). Payment rows omit
      // these — source lets future payment/promo flows coexist cleanly.
      grantedBy: v.optional(v.string()), // Clerk subject of granting admin
      source: v.optional(v.string()), // "admin" | "payment" | "promotional"
    })
      .index("by_user", ["userId"])
      .index("by_token", ["purchaseToken"]),

    // Per-user Chat+ customization (theme/wallpaper, sounds, notification,
    // auto-download prefs). Rendered client-side; harmless to keep after
    // expiry (free users keep their messages/conversations regardless).
    chatSettings: defineTable({
      userId: v.string(), // Clerk subject
      bubbleColor: v.optional(v.string()), // "default" | purple shades | ...
      wallpaper: v.optional(v.string()), // "none" | gradient id
      messageSound: v.optional(v.boolean()),
      notifyNewMessages: v.optional(v.boolean()),
      autoDownloadMedia: v.optional(v.boolean()),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // ─── Group chats ───────────────────────────────────────────

    // A group chat. `members` are Clerk subjects; owner created the group.
    groups: defineTable({
      name: v.string(),
      ownerId: v.string(),
      members: v.array(v.string()),
      mutedBy: v.optional(v.array(v.string())), // member ids who muted
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    groupMessages: defineTable({
      groupId: v.id("groups"),
      senderId: v.string(),
      body: v.string(), // "" for pure media messages
      kind: v.optional(
        v.union(v.literal("image"), v.literal("video"), v.literal("file")),
      ),
      storageId: v.optional(v.id("_storage")),
      mediaType: v.optional(v.string()),
      durationSec: v.optional(v.number()),
      fileName: v.optional(v.string()), // Chat+ file attachments
      fileSize: v.optional(v.number()),
      readBy: v.optional(v.array(v.string())),
      createdAt: v.number(),
    }).index("by_group_created", ["groupId", "createdAt"]),
    // Every admin XP action is journaled here: who did it, to whom,
    // what changed (previous → new), and when.
    adminAudit: defineTable({
      adminId: v.string(), // Clerk subject of the admin who acted
      targetUserId: v.string(), // Clerk subject of the affected user
      action: v.string(), // "add" | "remove" | "set" | "reset"
      amount: v.optional(v.number()), // delta (add/remove) or null
      previousXp: v.number(),
      newXp: v.number(),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // ─── Study Library: folders, personal notes, sharing ─────────

    // A user-created folder. Materials reference a folder by id — folders
    // never copy content, and deleting a folder only clears the references.
    folders: defineTable({
      userId: v.string(), // Clerk subject — owner
      name: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // Self-created personal notes (rich text authored from scratch).
    // Content is an HTML string produced by the My Notes editor.
    myNotes: defineTable({
      userId: v.string(), // Clerk subject — owner
      title: v.string(),
      content: v.string(), // rich text (sanitized HTML)
      folderId: v.optional(v.id("folders")),
      template: v.optional(v.string()), // visual style/template id
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user_updated", ["userId", "updatedAt"])
      .index("by_user", ["userId"]),

    // A chat share of study material. The material content stays in its
    // owner-scoped table (notes / whiteboards / myNotes); this row only
    // records WHO shared WHAT into WHICH conversation/group. Access is
    // granted exclusively to conversation participants / group members,
    // checked server-side on every open.
    shares: defineTable({
      senderId: v.string(), // Clerk subject of the sharer
      targetType: v.union(
        v.literal("ai_note"),
        v.literal("my_note"),
        v.literal("whiteboard"),
        v.literal("quiz"),
      ),
      targetId: v.string(), // _id in the owning table (string form)
      title: v.string(), // denormalized for the card preview
      conversationId: v.optional(v.id("conversations")),
      groupId: v.optional(v.id("groups")),
      messageId: v.optional(v.id("messages")), // chat message the card is attached to
      createdAt: v.number(),
    }).index("by_sender", ["senderId", "createdAt"])
      .index("by_message", ["messageId"]),

    // ─── Whiteboards ─────────────────────────────────────────────
    // Infinite-canvas study boards. Each board belongs to exactly one
    // authenticated user (Clerk subject); elements are stored as a JSON
    // document (strokes, shapes, text) rendered client-side on canvas.
    whiteboards: defineTable({
      userId: v.string(), // Clerk subject — owner
      title: v.string(),
      folderId: v.optional(v.id("folders")),
      elements: v.array(
        v.object({
          id: v.string(),
          type: v.string(), // "path" | "line" | "arrow" | "rect" | "ellipse" | "text"
          points: v.optional(v.array(v.array(v.number()))), // path points [x,y]
          x: v.optional(v.number()),
          y: v.optional(v.number()),
          x2: v.optional(v.number()),
          y2: v.optional(v.number()),
          color: v.string(),
          size: v.number(),
          text: v.optional(v.string()),
          fontSize: v.optional(v.number()),
          opacity: v.optional(v.number()),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_updated", ["userId", "updatedAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

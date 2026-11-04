import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["owner", "partner"]);
export const iconEnum = pgEnum("icon", [
  "car",
  "job",
  "home",
  "plane",
  "people",
  "star",
]);
export const goalCategoryEnum = pgEnum("goal_category", [
  "travel",
  "home",
  "career",
  "finance",
  "life",
]);
// What kind of event it is. "checkin" is only for the weekly check-in.
export const eventKindEnum = pgEnum("event_kind", [
  "appointment",
  "work",
  "travel",
  "date",
  "family",
  "other",
  "checkin",
]);

const id = () => uuid("id").primaryKey().defaultRandom();
const spaceId = () =>
  uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const spaces = pgTable("spaces", {
  id: id(),
  name: text("name").notNull(),
  focus: text("focus"),
  checkInDay: text("check_in_day").notNull().default("Sunday"),
  // How often: 'weekly' | 'biweekly' (every other week, counted from the week
  // the space was created) | 'monthly' (the first checkInDay of each month).
  checkInEvery: text("check_in_every").notNull().default("weekly"),
  onboarded: boolean("onboarded").notNull().default(false),
  // How shared costs split "by income": the owner's share in percent (60 = 60/40).
  incomeSplitOwner: integer("income_split_owner").notNull().default(50),
  createdAt: createdAt(),
});

export const members = pgTable(
  "members",
  {
    spaceId: spaceId(),
    clerkUserId: text("clerk_user_id").notNull(),
    displayName: text("display_name"),
    role: roleEnum("role").notNull(),
    // When they last opened Recent activity; newer entries count as new.
    lastSeenActivityAt: timestamp("last_seen_activity_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.clerkUserId] }),
    index("members_user_idx").on(t.clerkUserId),
  ],
);

export const invites = pgTable("invites", {
  code: text("code").primaryKey(),
  spaceId: spaceId(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const milestones = pgTable(
  "milestones",
  {
    id: id(),
    spaceId: spaceId(),
    title: text("title").notNull(),
    icon: iconEnum("icon").notNull().default("home"),
    emoji: text("emoji"), // chosen in the emoji picker; shown instead of `icon` when set
    // 'Done' | 'In progress' | 'Up next' | 'Planning' | 'Date to decide'
    status: text("status").notNull().default("Planning"),
    whenText: text("when_text"), // free text, e.g. "Spring 2027"
    position: integer("position").notNull().default(0),
  },
  (t) => [index("milestones_space_idx").on(t.spaceId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    spaceId: spaceId(),
    title: text("title").notNull(),
    ownerUserId: text("owner_user_id"), // null = both of you
    status: text("status").notNull().default("To do"), // 'To do' | 'In progress' | 'Done'
    done: boolean("done").notNull().default(false),
    dueAt: timestamp("due_at", { withTimezone: true }), // null = no set day
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdBy: text("created_by"), // Clerk user id; null for tasks made before this column
    doneAt: timestamp("done_at", { withTimezone: true }), // when it was ticked off
    createdAt: createdAt(),
  },
  (t) => [
    index("tasks_space_idx").on(t.spaceId),
    index("tasks_space_due_idx").on(t.spaceId, t.dueAt),
  ],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    spaceId: spaceId(),
    title: text("title").notNull(),
    kind: eventKindEnum("kind").notNull().default("other"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(), // local midnight when all day
    allDay: boolean("all_day").notNull().default(false),
    ownerUserId: text("owner_user_id"), // who's going; null = both of you
    notes: text("notes"),
    createdBy: text("created_by"), // Clerk user id; null for events made before this column
    createdAt: createdAt(),
  },
  (t) => [index("events_space_starts_idx").on(t.spaceId, t.startsAt)],
);

export const plans = pgTable("plans", {
  id: id(),
  spaceId: spaceId(),
  label: text("label").notNull(), // 'Plan A', 'Plan B'
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
});

// Every goal tracks steps; savings goals also set targetCents.
export const goals = pgTable(
  "goals",
  {
    id: id(),
    spaceId: spaceId(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    category: goalCategoryEnum("category").notNull().default("life"),
    ownerUserId: text("owner_user_id"), // null = both of you
    stepsDone: integer("steps_done").notNull().default(0),
    stepsTotal: integer("steps_total").notNull().default(0),
    nextStep: text("next_step"),
    imageUrl: text("image_url"),
    targetDate: date("target_date", { mode: "string" }), // calendar day, drives the Home countdown
    savedCents: integer("saved_cents").notNull().default(0),
    targetCents: integer("target_cents"), // null = not a savings goal
    featured: boolean("featured").notNull().default(false), // the "next adventure" card on Home
    createdAt: createdAt(),
  },
  (t) => [
    index("goals_space_idx").on(t.spaceId),
    uniqueIndex("goals_one_featured_idx")
      .on(t.spaceId)
      .where(sql`${t.featured}`),
  ],
);

// What each of you did, for Recent activity on Home. Entries keep the title
// as it was then, so they still read right after a rename or a delete.
export const activity = pgTable(
  "activity",
  {
    id: id(),
    spaceId: spaceId(),
    actorUserId: text("actor_user_id").notNull(), // Clerk user id
    // 'task_added' | 'step_added' | 'task_done' | 'goal_added' | 'goal_completed'
    // | 'goal_photo' | 'event_added' | 'expense_added' | 'savings_added' | 'settled'
    // | 'win_added' | 'checkin_done'
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    taskId: uuid("task_id"), // no foreign key: the entry outlives a deleted task
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    whenAt: timestamp("when_at", { withTimezone: true }), // a new task's day or event's start
    createdAt: createdAt(),
  },
  (t) => [index("activity_space_created_idx").on(t.spaceId, t.createdAt)],
);

export const decisions = pgTable("decisions", {
  id: id(),
  spaceId: spaceId(),
  question: text("question").notNull(),
  resolved: boolean("resolved").notNull().default(false),
});

export const wins = pgTable("wins", {
  id: id(),
  spaceId: spaceId(),
  text: text("text").notNull(),
  userId: text("user_id"), // Clerk user id of who added it
  cheers: jsonb("cheers").$type<string[]>().notNull().default([]), // Clerk user ids
  createdAt: createdAt(),
});

// A finished weekly check-in: each person's mood and answers, by role.
export type CheckInAnswers = Partial<
  Record<"owner" | "partner", { mood: string; good: string; hard: string; next: string }>
>;
export const checkins = pgTable(
  "checkins",
  {
    id: id(),
    spaceId: spaceId(),
    answers: jsonb("answers").$type<CheckInAnswers>().notNull(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("checkins_space_created_idx").on(t.spaceId, t.createdAt)],
);

// Finances. Amounts are whole cents (euros).

// A pot you're saving into together, optionally for one of your goals.
export const funds = pgTable(
  "funds",
  {
    id: id(),
    spaceId: spaceId(),
    name: text("name").notNull(),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    targetCents: integer("target_cents").notNull(),
    monthlyCents: integer("monthly_cents").notNull().default(0), // what you plan to add each month
    createdAt: createdAt(),
  },
  (t) => [index("funds_space_idx").on(t.spaceId)],
);

// Money one of you put into a fund (negative = taken out).
export const contributions = pgTable(
  "contributions",
  {
    id: id(),
    spaceId: spaceId(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk user id
    cents: integer("cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("contributions_fund_idx").on(t.fundId)],
);

// A shared cost: who paid, and how much of it is the owner's (the rest is the partner's).
export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    spaceId: spaceId(),
    title: text("title").notNull(),
    cents: integer("cents").notNull(),
    // 'home' (rent) | 'utilities' | 'subscriptions' | 'transport' | 'health' | 'food' | 'out' | 'travel' | 'other'
    category: text("category").notNull().default("other"),
    paidBy: text("paid_by").notNull(), // Clerk user id
    split: text("split").notNull().default("equal"), // 'equal' | 'income' | 'owner' | 'partner'
    ownerShare: integer("owner_share").notNull().default(50), // percent, fixed when saved
    day: date("day", { mode: "string" }).notNull(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_space_day_idx").on(t.spaceId, t.day)],
);

// One of you paying the other back.
export const settlements = pgTable("settlements", {
  id: id(),
  spaceId: spaceId(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  cents: integer("cents").notNull(),
  createdAt: createdAt(),
});

// Monthly shared budget per expense category.
export const budgets = pgTable(
  "budgets",
  {
    spaceId: spaceId(),
    category: text("category").notNull(),
    cents: integer("cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.category] })],
);

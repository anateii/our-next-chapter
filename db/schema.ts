import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "partner"]);
export const iconEnum = pgEnum("icon", [
  "car",
  "job",
  "home",
  "plane",
  "people",
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
  onboarded: boolean("onboarded").notNull().default(false),
  createdAt: createdAt(),
});

export const members = pgTable(
  "members",
  {
    spaceId: spaceId(),
    clerkUserId: text("clerk_user_id").notNull(),
    displayName: text("display_name"),
    role: roleEnum("role").notNull(),
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
    status: text("status").notNull().default("Planning"),
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
    status: text("status").notNull().default("To do"),
    done: boolean("done").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_space_idx").on(t.spaceId)],
);

export const plans = pgTable("plans", {
  id: id(),
  spaceId: spaceId(),
  label: text("label").notNull(), // 'Plan A', 'Plan B'
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
});

export const goals = pgTable("goals", {
  id: id(),
  spaceId: spaceId(),
  name: text("name").notNull(),
  savedCents: integer("saved_cents").notNull().default(0),
  targetCents: integer("target_cents"),
});

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
  createdAt: createdAt(),
});

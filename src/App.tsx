import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Show, SignIn, useAuth } from "@clerk/react";
import type { CalendarEvent, Goal, Task } from "./types";
import { goalProgress, goalStatus, goalSteps } from "./goals";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Goals from "./pages/Goals";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import type { NewEvent } from "./components/EventDialog";
import Onboarding from "./pages/Onboarding";
import type { GoalEdits } from "./components/NewGoalDialog";
import { Check, CircleAlert, LoaderCircle, Undo2 } from "lucide-react";
import TaskDialog, {
  type NewTask,
  type TaskDraft,
} from "./components/TaskDialog";
import "./App.css";
import { useApi } from "./helpers/api";
import {
  fromApiGoal,
  toApiNewGoal,
  toPerson,
  toUserId,
  type ApiGoal,
  type ApiMember,
} from "./helpers/goals";
import { homeQuery, type ApiHome } from "./helpers/home";
import {
  applyEventEdits,
  checkIns,
  fromApiEvent,
  toApiEventEdits,
  type ApiEvent,
  type EventEdits,
} from "./helpers/events";
import { activitySince, type ApiActivity } from "./helpers/activity";
import { PeopleContext, peopleFrom } from "./helpers/people";
import {
  applyEdits,
  byDue,
  daysFromToday,
  fromApiTask,
  groupLabels,
  taskGroup,
  toApiEdits,
  type ApiTask,
  type TaskEdits,
} from "./helpers/tasks";

// Tiny hash router: #goals, #tasks and #calendar open their pages; any other
// hash stays on Home.
type Page = "home" | "goals" | "tasks" | "calendar";
const pages: Record<string, Page> = {
  "#goals": "goals",
  "#tasks": "tasks",
  "#calendar": "calendar",
};
const activeLabel: Record<Page, string> = {
  home: "Home",
  goals: "Our Goals",
  tasks: "Tasks",
  calendar: "Calendar",
};

// How long an Undo toast stays up; deletes wait this long before reaching the API.
const UNDO_MS = 5000;
// How often to check for the other partner's changes while the app is showing.
const REFRESH_MS = 30_000;
function usePage() {
  const read = (): Page =>
    pages[globalThis.location.hash] ?? "home";
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onHash = () => setPage(read());
    globalThis.addEventListener("hashchange", onHash);
    return () => globalThis.removeEventListener("hashchange", onHash);
  }, []);
  return page;
}

export default function App() {
  const page = usePage();
  const request = useApi();

  // Our own changes in flight. While any are, background refreshes hold off
  // so they can't put back what was there before.
  const writes = useRef({ started: 0, pending: 0 });
  const holdRefresh = <T,>(p: Promise<T>) => {
    writes.current.started += 1;
    writes.current.pending += 1;
    return p.finally(() => {
      writes.current.pending -= 1;
      // Our change is saved: pull the feed so it shows up in Recent activity.
      if (writes.current.pending === 0) {
        clearTimeout(activityTimer.current);
        activityTimer.current = setTimeout(reloadActivity, 300);
      }
    });
  };
  const activityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Every write (anything but a GET) holds refreshes until it's done.
  const api = <T,>(path: string, init: RequestInit = {}) =>
    !init.method || init.method === "GET"
      ? request<T>(path, init)
      : holdRefresh(request<T>(path, init));
  // Tasks added in this session keep their temporary id on screen: server id -> it.
  const localIds = useRef(new Map<string, string>());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  // Per goal, how many linked tasks were finished before the loaded window.
  const [olderDone, setOlderDone] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // The space's weekly check-in day ("Sunday"), shown on the calendar.
  const [checkInDay, setCheckInDay] = useState("Sunday");
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [spaceName, setSpaceName] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  // Recent activity, and when I last opened it.
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  type ActivityRes = { activity: ApiActivity[]; lastSeenAt: string | null };
  const loadActivity = () =>
    request<ActivityRes>(
      `/activity?since=${encodeURIComponent(activitySince().toISOString())}`,
    );
  const showActivity = (res: ActivityRes) => {
    setActivity(res.activity);
    setLastSeenAt(res.lastSeenAt);
  };
  const reloadActivity = () =>
    loadActivity()
      .then(showActivity)
      .catch((err) => console.warn("Loading activity failed:", err));

  // Opening the feed: everything so far is seen (on every device).
  const markActivitySeen = () => {
    setLastSeenAt(new Date().toISOString());
    api<{ lastSeenAt: string }>("/activity", { method: "POST" })
      .then((res) => setLastSeenAt(res.lastSeenAt))
      .catch((err) => console.warn("Marking activity seen failed:", err));
  };

  // Move focus to the new page's heading for keyboard and screen reader users.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    globalThis.scrollTo({ top: 0 });
    document.getElementById("page-title")?.focus();
  }, [page]);

  const { isSignedIn, userId } = useAuth();

  // Does the signed-in user have a space yet? New users go through onboarding.
  const [spaceState, setSpaceState] = useState<
    "checking" | "none" | "ready" | "error"
  >("checking");
  const [retry, setRetry] = useState(0);

  // Dev only: localhost:3000/?onboarding previews onboarding with faked requests.
  const [previewOnboarding, setPreviewOnboarding] = useState(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(globalThis.location.search).has("onboarding"),
  );
  const endPreview = () => {
    const url = new URL(globalThis.location.href);
    url.searchParams.delete("onboarding");
    globalThis.history.replaceState(null, "", url);
    setPreviewOnboarding(false);
  };
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    api<{ space: unknown }>("/me")
      .then(
        ({ space }) => !cancelled && setSpaceState(space ? "ready" : "none"),
      )
      .catch(() => !cancelled && setSpaceState("error"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `api` is a new function each render
  }, [isSignedIn, retry]);

  // Everything the app shows. Open tasks, plus the ones done in the last
  // 7 days (from local midnight).
  const loadAll = () => {
    const now = new Date();
    const doneSince = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
    );
    return Promise.all([
      api<ApiHome>(`/home?${homeQuery()}`),
      api<{ goals: ApiGoal[] }>("/goals"),
      api<{ tasks: ApiTask[]; olderDone: Record<string, number> }>(
        `/tasks?doneSince=${encodeURIComponent(doneSince.toISOString())}`,
      ),
      api<{ events: ApiEvent[] }>("/events"),
      // The feed is extra: if it fails, show the rest without it.
      loadActivity().catch((err): ActivityRes => {
        console.warn("Loading activity failed:", err);
        return { activity: [], lastSeenAt: null };
      }),
    ]);
  };
  const showAll = ([home, res, all, cal, feed]: Awaited<
    ReturnType<typeof loadAll>
  >) => {
    showActivity(feed);
    setMembers(home.members);
    setSpaceName(home.space.name);
    setGoals(res.goals.map((g) => fromApiGoal(g, home.members)));
    setTasks(
      all.tasks.map((t) => ({
        ...fromApiTask(t, home.members, userId),
        id: localIds.current.get(t.id) ?? t.id,
      })),
    );
    setOlderDone(all.olderDone);
    setEvents(
      cal.events.map((e) => ({
        ...fromApiEvent(e, home.members),
        id: localIds.current.get(e.id) ?? e.id,
      })),
    );
    setCheckInDay(home.space.checkInDay);
  };

  // Load the space's data once there is a space.
  useEffect(() => {
    if (spaceState !== "ready") return;
    let cancelled = false;
    loadAll()
      .then((data) => {
        if (cancelled) return;
        showAll(data);
        setDataLoaded(true);
      })
      .catch((err) => {
        console.error("Loading data failed:", err);
        if (!cancelled) setSpaceState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `api` is a new function each render
  }, [spaceState]);

  // Pick up the other partner's changes: when the app comes back into view,
  // and every 30 seconds while it's showing. A refresh is skipped, or its
  // result dropped, while one of our own changes is still being saved.
  useEffect(() => {
    if (!dataLoaded) return;
    let cancelled = false;
    let loading = false;
    const refresh = () => {
      if (
        loading ||
        document.visibilityState !== "visible" ||
        writes.current.pending
      )
        return;
      loading = true;
      const startedAt = writes.current.started;
      loadAll()
        .then((data) => {
          const changedMeanwhile =
            writes.current.pending > 0 || writes.current.started !== startedAt;
          if (!cancelled && !changedMeanwhile) showAll(data);
        })
        .catch((err) => console.warn("Refreshing data failed:", err))
        .finally(() => {
          loading = false;
        });
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `api` is a new function each render
  }, [dataLoaded]);

  // Short confirmation in the corner, e.g. "Added to Today", with Undo when
  // the action can be taken back.
  const [toast, setToast] = useState<{
    message: string;
    ok: boolean;
    undo?: () => void;
  } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.undo ? UNDO_MS : 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Task dialog, opened from Today's "+" with today as the default day.
  const taskDialogRef = useRef<HTMLDialogElement>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({ day: "" });
  const openTaskDialog = () => {
    const now = new Date();
    const day = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    flushSync(() => setTaskDraft({ day }));
    taskDialogRef.current?.showModal();
  };

  // A task added here keeps its temporary id in the UI, so an open panel or
  // row doesn't remount when the save lands. API calls for it wait for the
  // save and use the id the server gave it (undefined if the save failed).
  const savedIds = useRef(new Map<string, Promise<string | undefined>>());
  const serverId = (id: string) =>
    savedIds.current.get(id) ?? Promise.resolve<string | undefined>(id);

  // Show it now, save in the background, take it away again if that fails.
  const createTask = (t: NewTask) => {
    const id = `new-${crypto.randomUUID()}`;
    const ownerUserId = toUserId(t.owner, members);
    const created = fromApiTask(
      {
        id,
        title: t.title,
        ownerUserId,
        status: "To do",
        done: false,
        dueAt: t.dueAt,
        goalId: t.goalId,
        notes: null,
        createdBy: userId ?? null,
        createdAt: new Date().toISOString(),
        doneAt: null,
      },
      members,
      userId,
    );
    setTasks((ts) => [...ts, created]);
    setToast({
      message: `Added to ${groupLabels[taskGroup(created)]}`,
      ok: true,
    });
    savedIds.current.set(
      id,
      api<{ task: ApiTask }>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: t.title,
          ownerUserId,
          dueAt: t.dueAt,
          goalId: t.goalId,
        }),
      })
        .then(({ task }) => {
          localIds.current.set(task.id, id);
          return task.id;
        })
        .catch((err) => {
          console.error("Adding task failed:", err);
          setTasks((ts) => ts.filter((x) => x.id !== id));
          setToast({
            message: `Couldn't add “${t.title}”. Try again.`,
            ok: false,
          });
          return undefined;
        }),
    );
    return Promise.resolve(created);
  };

  // Change immediately, save in the background, put it back if the save fails.
  // Resolves true once saved.
  const updateTask = (id: string, edits: TaskEdits) => {
    const before = tasks.find((t) => t.id === id);
    if (!before) return Promise.resolve(false);
    const replace = (task: Task) =>
      setTasks((ts) => ts.map((t) => (t.id === id ? task : t)));
    replace(applyEdits(before, edits));
    return holdRefresh(serverId(id))
      .then(async (savedId) => {
        if (!savedId) return false; // its add failed, and it's already gone
        const { task } = await api<{ task: ApiTask }>("/tasks", {
          method: "PATCH",
          body: JSON.stringify({ id: savedId, ...toApiEdits(edits, members) }),
        });
        replace({ ...fromApiTask(task, members, userId), id });
        return true;
      })
      .catch((err) => {
        console.error("Saving task failed:", err);
        replace(before);
        setToast({
          message: "Couldn't save that change. Try again.",
          ok: false,
        });
        return false;
      });
  };

  // An update with an Undo toast; Undo puts back the fields it changed.
  const changeTask = (id: string, edits: TaskEdits, message: string) => {
    const before = tasks.find((t) => t.id === id);
    if (!before) return;
    const previous = Object.fromEntries(
      Object.keys(edits).map((k) => [k, before[k as keyof TaskEdits] ?? null]),
    ) as TaskEdits;
    void updateTask(id, edits);
    setToast({ message, ok: true, undo: () => void updateTask(id, previous) });
  };

  const toggleTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.done) changeTask(id, { status: "To do" }, "Moved back to to do");
    else changeTask(id, { status: "Done" }, `Done: ${task.title}`);
  };

  // Hide it now and delete it once the Undo window has passed.
  const deleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const restore = () => setTasks((ts) => [...ts, task]);
    setTasks((ts) => ts.filter((t) => t.id !== id));
    // Hold refreshes through the Undo window too, or one would bring it back.
    let release = () => {};
    void holdRefresh(new Promise<void>((resolve) => (release = resolve)));
    const timer = setTimeout(() => {
      serverId(id)
        .then(
          (savedId) =>
            savedId &&
            api(`/tasks?id=${encodeURIComponent(savedId)}`, {
              method: "DELETE",
            }),
        )
        .catch((err) => {
          console.error("Deleting task failed:", err);
          restore();
          setToast({
            message: "Couldn't delete the task. Try again.",
            ok: false,
          });
        })
        .finally(release);
    }, UNDO_MS);
    setToast({
      message: `Deleted “${task.title}”`,
      ok: true,
      undo: () => {
        clearTimeout(timer);
        restore();
        release();
      },
    });
  };

  // Events work like tasks: shown at once, saved in the background, put back
  // if the save fails. New ones keep their temporary id on screen too.
  const createEvent = (e: NewEvent) => {
    const id = `new-${crypto.randomUUID()}`;
    const ownerUserId = toUserId(e.owner, members);
    const created = fromApiEvent({ id, ...e, ownerUserId, notes: e.notes ?? null }, members);
    setEvents((es) => [...es, created]);
    setToast({ message: `Added “${e.title}” to the calendar`, ok: true });
    savedIds.current.set(
      id,
      api<{ event: ApiEvent }>("/events", {
        method: "POST",
        body: JSON.stringify({ ...e, owner: undefined, ownerUserId }),
      })
        .then(({ event }) => {
          localIds.current.set(event.id, id);
          return event.id;
        })
        .catch((err) => {
          console.error("Adding event failed:", err);
          setEvents((es) => es.filter((x) => x.id !== id));
          setToast({ message: `Couldn't add “${e.title}”. Try again.`, ok: false });
          return undefined;
        }),
    );
  };

  const updateEvent = (id: string, edits: EventEdits) => {
    const before = events.find((e) => e.id === id);
    if (!before) return Promise.resolve(false);
    const replace = (ev: CalendarEvent) =>
      setEvents((es) => es.map((e) => (e.id === id ? ev : e)));
    replace(applyEventEdits(before, edits));
    return holdRefresh(serverId(id))
      .then(async (savedId) => {
        if (!savedId) return false;
        const { event } = await api<{ event: ApiEvent }>("/events", {
          method: "PATCH",
          body: JSON.stringify({ id: savedId, ...toApiEventEdits(edits, members) }),
        });
        replace({ ...fromApiEvent(event, members), id });
        return true;
      })
      .catch((err) => {
        console.error("Saving event failed:", err);
        replace(before);
        setToast({ message: "Couldn't save that change. Try again.", ok: false });
        return false;
      });
  };

  // An update with an Undo toast; Undo puts back the fields it changed.
  const changeEvent = (id: string, edits: EventEdits, message: string) => {
    const before = events.find((e) => e.id === id);
    if (!before) return;
    const previous = Object.fromEntries(
      Object.keys(edits).map((k) => [k, before[k as keyof EventEdits] ?? null]),
    ) as EventEdits;
    void updateEvent(id, edits);
    setToast({ message, ok: true, undo: () => void updateEvent(id, previous) });
  };

  // Hide it now and delete it once the Undo window has passed.
  const deleteEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const restore = () => setEvents((es) => [...es, ev]);
    setEvents((es) => es.filter((e) => e.id !== id));
    let release = () => {};
    void holdRefresh(new Promise<void>((resolve) => (release = resolve)));
    const timer = setTimeout(() => {
      serverId(id)
        .then(
          (savedId) =>
            savedId &&
            api(`/events?id=${encodeURIComponent(savedId)}`, { method: "DELETE" }),
        )
        .catch((err) => {
          console.error("Deleting event failed:", err);
          restore();
          setToast({ message: "Couldn't delete the event. Try again.", ok: false });
        })
        .finally(release);
    }, UNDO_MS);
    setToast({
      message: `Deleted “${ev.title}”`,
      ok: true,
      undo: () => {
        clearTimeout(timer);
        restore();
        release();
      },
    });
  };

  // Home's "Upcoming this week": this week's events (Monday to Sunday) and the check-in.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekEvents = [
    ...events.filter((e) => e.date >= weekStart && e.date < weekEnd),
    ...checkIns(checkInDay, weekStart, new Date(weekEnd.getTime() - 1)),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcomingEvents = events.filter(
    (e) => e.date >= new Date() && e.date < weekEnd,
  ).length;

  // Home shows what's due today; "Tasks to do" counts every open task.
  const todayTasks = tasks
    .filter((t) => t.dueAt && daysFromToday(t.dueAt) === 0)
    .sort(byDue);
  const tasksLeft = tasks.filter((t) => !t.done).length;
  const me = toPerson(userId ?? null, members);
  const steps = goalSteps(tasks, olderDone);

  // Save to the API, then add the stored goal (with its real id) to the list.
  const createGoal = (g: Omit<Goal, "id">) =>
    api<{ goal: ApiGoal }>("/goals", {
      method: "POST",
      body: JSON.stringify(toApiNewGoal(g, members)),
    })
      .then(({ goal }) => setGoals((gs) => [...gs, fromApiGoal(goal, members)]))
      .catch((err) => console.error("Creating goal failed:", err));

  // Show it on Home immediately, save in the background, undo if the save fails.
  const featureGoal = (id: string) => {
    const previous = goals.find((g) => g.featured)?.id;
    if (previous === id) return;
    const setFeatured = (featuredId?: string) =>
      setGoals((gs) =>
        gs.map((g) => ({ ...g, featured: g.id === featuredId })),
      );
    setFeatured(id);
    api("/goals", {
      method: "PATCH",
      body: JSON.stringify({ id, featured: true }),
    }).catch((err) => {
      console.error("Featuring goal failed:", err);
      setFeatured(previous);
    });
  };

  // Save the edits, then show the goal as the API stored it.
  // Cleared fields are sent as null so the API removes them. nextStep isn't
  // sent, so a goal's stored next step is kept for when Tasks arrives.
  const editGoal = (id: string, edits: GoalEdits) =>
    api<{ goal: ApiGoal }>("/goals", {
      method: "PATCH",
      body: JSON.stringify({
        id,
        ...toApiNewGoal({ ...edits, stepsDone: 0, stepsTotal: 0 }, members),
        targetDate: edits.targetDate ?? null,
        imageUrl: edits.image ?? null,
      }),
    })
      .then(({ goal }) =>
        setGoals((gs) =>
          gs.map((g) => (g.id === id ? fromApiGoal(goal, members) : g)),
        ),
      )
      .catch((err) => console.error("Saving goal failed:", err));

  // A step is a task linked to the goal, with no day: it waits under Someday.
  const addStep = (goal: Goal, title: string) =>
    createTask({ title, owner: goal.owner, dueAt: null, goalId: goal.id });

  // A goal with steps completes by finishing the open ones (with Undo).
  // Otherwise: complete immediately, save in the background, restore if it fails.
  const completeGoal = (id: string) => {
    const open = steps.get(id)?.open ?? [];
    if (open.length) {
      for (const t of open) void updateTask(t.id, { status: "Done" });
      setToast({
        message: `Finished ${open.length} ${open.length === 1 ? "step" : "steps"}`,
        ok: true,
        undo: () => {
          for (const t of open) void updateTask(t.id, { status: t.status });
        },
      });
      return;
    }
    const before = goals.find((g) => g.id === id);
    if (!before) return;
    const replace = (goal: Goal) =>
      setGoals((gs) => gs.map((g) => (g.id === id ? goal : g)));
    // Same rule as the API: a goal with no steps counts as one step, done.
    const total = Math.max(before.stepsTotal, 1);
    replace({
      ...before,
      stepsTotal: total,
      stepsDone: total,
      nextStep: undefined,
    });
    api("/goals", {
      method: "PATCH",
      body: JSON.stringify({ id, completed: true }),
    }).catch((err) => {
      console.error("Completing goal failed:", err);
      replace(before);
    });
  };

  const featured = goals.find((g) => g.featured);

  const signedIn = () => {
    const loading =
      spaceState === "checking" ||
      (spaceState === "ready" && !dataLoaded && !previewOnboarding);
    if (loading)
      return (
        <output className="auth-screen">
          <LoaderCircle
            className="spin"
            aria-hidden="true"
            size={28}
            color="var(--accent)"
          />
          <span className="sr-only">Loading your space…</span>
        </output>
      );
    if (spaceState === "error")
      return (
        <div className="auth-screen">
          <div className="load-error" role="alert">
            <p>
              We couldn't load your space. Check your connection and try again.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSpaceState("checking");
                setRetry((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    if (previewOnboarding) return <Onboarding preview onDone={endPreview} />;
    if (spaceState === "none")
      return <Onboarding onDone={() => setSpaceState("ready")} />;
    return (
      <PeopleContext.Provider value={peopleFrom(members)}>
        <div className="layout">
          <Sidebar active={activeLabel[page]} />
          <main id="main" className="main">
            {page === "goals" && (
              <Goals
                goals={goals}
                steps={steps}
                onCreate={createGoal}
                onAddStep={addStep}
                onToggleStep={toggleTask}
                onEdit={editGoal}
                onFeature={featureGoal}
                onComplete={completeGoal}
              />
            )}
            {page === "tasks" && (
              <Tasks
                tasks={tasks}
                goals={goals}
                me={me}
                onAdd={openTaskDialog}
                onUpdate={updateTask}
                onChange={changeTask}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            )}
            {page === "calendar" && (
              <Calendar
                events={events}
                checkInDay={checkInDay}
                tasks={tasks}
                goals={goals}
                me={me}
                onCreate={createEvent}
                onUpdate={updateEvent}
                onChange={changeEvent}
                onDelete={deleteEvent}
                onToggleTask={toggleTask}
                onChangeTask={changeTask}
              />
            )}
            {page === "home" && (
              <Home
                tasks={todayTasks}
                events={weekEvents}
                tasksLeft={tasksLeft}
                upcomingEvents={upcomingEvents}
                onToggleTask={toggleTask}
                onAddTask={openTaskDialog}
                activeGoals={
                  // Active = not finished yet (not started or in progress)
                  goals.filter(
                    (g) => goalStatus(g, steps.get(g.id)) !== "Completed",
                  ).length
                }
                goalCount={goals.length}
                spaceName={spaceName}
                adventure={
                  featured
                    ? {
                        title: featured.title,
                        subtitle: featured.subtitle,
                        progress: goalProgress(
                          featured,
                          steps.get(featured.id),
                        ),
                        image: featured.image,
                        targetDate: featured.targetDate,
                      }
                    : null
                }
                activity={activity}
                lastSeenAt={lastSeenAt}
                members={members}
                myUserId={userId}
                goals={goals}
                onSeenActivity={markActivitySeen}
              />
            )}
          </main>
          <TaskDialog
            ref={taskDialogRef}
            draft={taskDraft}
            goals={goals}
            onCreate={createTask}
          />
          <div role="status" aria-live="polite">
            {toast && (
              <div className={`toast${toast.undo ? " has-action" : ""}`}>
                {toast.ok ? (
                  <Check aria-hidden="true" size={18} strokeWidth={2.6} />
                ) : (
                  <CircleAlert aria-hidden="true" size={18} />
                )}
                {toast.message}
                {toast.undo && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.undo?.();
                      setToast(null);
                    }}
                  >
                    <Undo2 aria-hidden="true" size={16} /> Undo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </PeopleContext.Provider>
    );
  };

  return (
    <>
      <Show when="signed-out">
        <div className="auth-screen">
          <SignIn routing="hash" />
        </div>
      </Show>
      <Show when="signed-in">{signedIn()}</Show>
    </>
  );
}

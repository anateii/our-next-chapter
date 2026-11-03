import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Show, SignIn, useAuth } from "@clerk/react";
import type { CalendarEvent, Goal, Task } from "./types";
import { goalProgress, goalStatus } from "./goals";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Goals from "./pages/Goals";
import Onboarding from "./pages/Onboarding";
import type { GoalEdits } from "./components/NewGoalDialog";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import TaskDialog, {
  type NewTask,
  type TaskDraft,
} from "./components/TaskDialog";
import "./App.css";
import { useApi } from "./helpers/api";
import {
  fromApiGoal,
  toApiNewGoal,
  toUserId,
  type ApiGoal,
  type ApiMember,
} from "./helpers/goals";
import {
  fromApiEvent,
  fromApiTask,
  homeQuery,
  type ApiHome,
} from "./helpers/home";

// Tiny hash router: #goals opens Our Goals; any other hash stays on Home
// (Home uses #tasks / #calendar as in-page anchors).
function usePage() {
  const read = () => (globalThis.location.hash === "#goals" ? "goals" : "home");
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
  const api = useApi();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasksLeft, setTasksLeft] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [spaceName, setSpaceName] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

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

  const { isSignedIn } = useAuth();

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

  // Load the space's data once there is a space.
  useEffect(() => {
    if (spaceState !== "ready") return;
    let cancelled = false;
    Promise.all([
      api<ApiHome>(`/home?${homeQuery()}`),
      api<{ goals: ApiGoal[] }>("/goals"),
    ])
      .then(([home, res]) => {
        if (cancelled) return;
        setMembers(home.members);
        setSpaceName(home.space.name);
        setGoals(res.goals.map((g) => fromApiGoal(g, home.members)));
        setTasks(home.today.map((t) => fromApiTask(t, home.members)));
        setEvents(home.week.events.map(fromApiEvent));
        setTasksLeft(home.stats.tasksLeft);
        setUpcomingEvents(home.stats.upcomingEvents);
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

  // Tick immediately, save in the background, undo if the save fails.
  // Short confirmation in the corner, e.g. after adding a task from Goals.
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(
    null,
  );
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
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

  // Save, then add it to Today if it's due today. Tasks to do counts every open task.
  const createTask = (t: NewTask) =>
    api<{ task: ApiHome["today"][number] }>("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: t.title,
        ownerUserId: toUserId(t.owner, members),
        dueAt: t.dueAt,
      }),
    })
      .then(({ task }) => {
        const dueToday =
          !!task.dueAt &&
          new Date(task.dueAt).toDateString() === new Date().toDateString();
        if (dueToday) setTasks((ts) => [...ts, fromApiTask(task, members)]);
        setTasksLeft((n) => n + 1);
        setToast({
          message: dueToday ? "Added to today's tasks" : "Added to tasks",
          ok: true,
        });
      })
      .catch((err) => {
        console.error("Adding task failed:", err);
        setToast({ message: "Couldn't add the task. Try again.", ok: false });
      });

  const toggleTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const setDone = (done: boolean) => {
      setTasks((ts) =>
        ts.map((t) =>
          t.id === id ? { ...t, done, status: done ? "Done" : "To do" } : t,
        ),
      );
      setTasksLeft((n) => n + (done ? -1 : 1));
    };
    setDone(!task.done);
    api("/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id, done: !task.done }),
    }).catch((err) => {
      console.error("Saving task failed:", err);
      setDone(task.done);
    });
  };

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
      setGoals((gs) => gs.map((g) => ({ ...g, featured: g.id === featuredId })));
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

  // Complete immediately, save in the background, restore the goal if it fails.
  const completeGoal = (id: string) => {
    const before = goals.find((g) => g.id === id);
    if (!before) return;
    const replace = (goal: Goal) =>
      setGoals((gs) => gs.map((g) => (g.id === id ? goal : g)));
    // Same rule as the API: a goal with no steps counts as one step, done.
    const total = Math.max(before.stepsTotal, 1);
    replace({ ...before, stepsTotal: total, stepsDone: total, nextStep: undefined });
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
        <div className="auth-screen" role="status">
          <LoaderCircle
            className="spin"
            aria-hidden="true"
            size={28}
            color="var(--accent)"
          />
          <span className="sr-only">Loading your space…</span>
        </div>
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
      <div className="layout">
        <Sidebar active={page === "goals" ? "Our Goals" : "Home"} />
        <main id="main" className="main">
          {page === "goals" ? (
            <Goals
              goals={goals}
              onCreate={createGoal}
              onEdit={editGoal}
              onFeature={featureGoal}
              onComplete={completeGoal}
            />
          ) : (
            <Home
              tasks={tasks}
              events={events}
              tasksLeft={tasksLeft}
              upcomingEvents={upcomingEvents}
              onToggleTask={toggleTask}
              onAddTask={openTaskDialog}
              activeGoals={
                // Active = not finished yet (not started or in progress)
                goals.filter((g) => goalStatus(g) !== "Completed").length
              }
              goalCount={goals.length}
              spaceName={spaceName}
              adventure={
                featured
                  ? {
                      title: featured.title,
                      subtitle: featured.subtitle,
                      progress: goalProgress(featured),
                      image: featured.image,
                      targetDate: featured.targetDate,
                    }
                  : null
              }
            />
          )}
        </main>
        <TaskDialog
          ref={taskDialogRef}
          draft={taskDraft}
          onCreate={createTask}
        />
        <div role="status" aria-live="polite">
          {toast && (
            <div className="toast">
              {toast.ok ? (
                <Check aria-hidden="true" size={18} strokeWidth={2.6} />
              ) : (
                <CircleAlert aria-hidden="true" size={18} />
              )}
              {toast.message}
            </div>
          )}
        </div>
      </div>
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

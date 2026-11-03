import { useEffect, useRef, useState } from "react";
import { Show, SignIn, useAuth } from "@clerk/react";
import { initialTasks, initialLifeGoals } from "./data";
import type { Goal, Task } from "./types";
import { goalProgress, goalStatus } from "./goals";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Goals from "./pages/Goals";
import "./App.css";
import { useApi } from "./helpers/api";
import {
  fromApiGoal,
  toApiNewGoal,
  type ApiGoal,
  type ApiMember,
} from "./helpers/goals";

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
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [goals, setGoals] = useState<Goal[]>(initialLifeGoals);
  const [members, setMembers] = useState<ApiMember[]>([]);

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

  // Load the space's data once the user is signed in.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    Promise.all([
      api<{ members: ApiMember[] }>("/home"),
      api<{ goals: ApiGoal[] }>("/goals"),
    ])
      .then(([home, res]) => {
        if (cancelled) return;
        setMembers(home.members);
        setGoals(res.goals.map((g) => fromApiGoal(g, home.members)));
      })
      .catch((err) => console.error("Loading data failed:", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `api` is a new function each render
  }, [isSignedIn]);

  const toggleTask = (id: string) =>
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        return { ...t, done, status: done ? "Done" : "To do" };
      }),
    );

  // Save to the API, then add the stored goal (with its real id) to the list.
  const createGoal = (g: Omit<Goal, "id">) =>
    api<{ goal: ApiGoal }>("/goals", {
      method: "POST",
      body: JSON.stringify(toApiNewGoal(g, members)),
    })
      .then(({ goal }) =>
        setGoals((gs) => [...gs, fromApiGoal(goal, members)]),
      )
      .catch((err) => console.error("Creating goal failed:", err));

  const featureGoal = (id: string) =>
    setGoals((gs) => gs.map((g) => ({ ...g, featured: g.id === id })));

  const completeGoal = (id: string) =>
    setGoals((gs) =>
      gs.map((g) =>
        g.id === id
          ? { ...g, stepsDone: g.stepsTotal, nextStep: undefined }
          : g,
      ),
    );

  const featured = goals.find((g) => g.featured);

  return (
    <>
      <Show when="signed-out">
        <div className="auth-screen">
          <SignIn routing="hash" />
        </div>
      </Show>
      <Show when="signed-in">
        <div className="layout">
          <Sidebar active={page === "goals" ? "Our Goals" : "Home"} />
          <main id="main" className="main">
            {page === "goals" ? (
              <Goals
                goals={goals}
                onCreate={createGoal}
                onFeature={featureGoal}
                onComplete={completeGoal}
              />
            ) : (
              <Home
                tasks={tasks}
                onToggleTask={toggleTask}
                activeGoals={
                  goals.filter((g) => goalStatus(g) === "In progress").length
                }
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
        </div>
      </Show>
    </>
  );
}

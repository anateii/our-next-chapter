import { useState } from "react";
import { Show, SignIn } from "@clerk/react";
import { initialTasks, initialGoals } from "./data";
import type { Task, MoneyGoal, Win } from "./types";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import FocusBanner from "./components/FocusBanner";
import Roadmap from "./components/Roadmap";
import NextSteps from "./components/NextSteps";
import Plans from "./components/Plans";
import MoneyGoals from "./components/MoneyGoals";
import Wins from "./components/Wins";
import Decisions from "./components/Decisions";
import "./App.css";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [goals, setGoals] = useState<MoneyGoal[]>(initialGoals);
  const [wins, setWins] = useState<Win[]>([]);

  const toggleTask = (id: string) => {
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        if (done)
          setWins((w) => [
            {
              id: crypto.randomUUID(),
              text: t.title,
              date: new Date().toLocaleDateString(),
            },
            ...w,
          ]);
        return { ...t, done, status: done ? "Done" : "To do" };
      }),
    );
  };

  const setTarget = (id: string, target: number) =>
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, target } : g)));

  const logWin = (text: string) =>
    setWins((w) => [
      { id: crypto.randomUUID(), text, date: new Date().toLocaleDateString() },
      ...w,
    ]);

  return (
    <>
      <Show when="signed-out">
        <div className="auth-screen">
          <SignIn routing="hash" />
        </div>
      </Show>
      <Show when="signed-in">
        <div className="layout">
          <Sidebar />
          <main className="main">
            <Header />
            <FocusBanner />
            <Roadmap />
            <div className="row two">
              <NextSteps tasks={tasks} onToggle={toggleTask} />
              <Plans />
            </div>
            <div className="row three">
              <MoneyGoals goals={goals} onSetTarget={setTarget} />
              <Wins wins={wins} onLog={logWin} />
              <Decisions />
            </div>
          </main>
        </div>
      </Show>
    </>
  );
}

import { useState } from "react";
import { Show, SignIn } from "@clerk/react";
import { initialTasks, initialGoals, adventure, sampleEvents } from "./data";
import type { Task } from "./types";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatCards from "./components/StatCards";
import AdventureCard from "./components/AdventureCard";
import QuoteCard from "./components/QuoteCard";
import TodayList from "./components/TodayList";
import WeekAhead from "./components/WeekAhead";
import "./App.css";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = (id: string) =>
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        return { ...t, done, status: done ? "Done" : "To do" };
      }),
    );

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
          <main id="home" className="main">
            <Header />
            <StatCards
              activeGoals={initialGoals.length}
              tasksLeft={tasks.filter((t) => !t.done).length}
              upcomingEvents={sampleEvents.length}
              adventureTitle={adventure.title}
              adventureProgress={adventure.progress}
            />
            <div className="hero-row">
              <AdventureCard adventure={adventure} />
              <QuoteCard />
            </div>
            <div className="panels">
              <TodayList tasks={tasks.filter((t) => t.time)} onToggle={toggleTask} />
              <WeekAhead events={sampleEvents} />
            </div>
          </main>
        </div>
      </Show>
    </>
  );
}

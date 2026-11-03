import type { Adventure, Task } from "../types";
import { sampleEvents } from "../data";
import Header from "../components/Header";
import StatCards from "../components/StatCards";
import AdventureCard from "../components/AdventureCard";
import Countdown from "../components/Countdown";
import TodayList from "../components/TodayList";
import WeekAhead from "../components/WeekAhead";

export default function Home({
  tasks,
  onToggleTask,
  activeGoals,
  adventure,
}: Readonly<{
  tasks: readonly Task[];
  onToggleTask: (id: string) => void;
  activeGoals: number;
  adventure: Adventure | null;
}>) {
  return (
    <>
      <Header />
      <StatCards
        activeGoals={activeGoals}
        tasksLeft={tasks.filter((t) => !t.done).length}
        upcomingEvents={sampleEvents.length}
        adventure={adventure}
      />
      {adventure && (
        <div className="hero-row">
          <AdventureCard adventure={adventure} />
          <Countdown adventure={adventure} />
        </div>
      )}
      <div className="panels">
        <TodayList tasks={tasks.filter((t) => t.time)} onToggle={onToggleTask} />
        <WeekAhead events={sampleEvents} />
      </div>
    </>
  );
}

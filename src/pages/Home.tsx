import type { Adventure, CalendarEvent, Task } from "../types";
import Header from "../components/Header";
import StatCards from "../components/StatCards";
import AdventureCard from "../components/AdventureCard";
import Countdown from "../components/Countdown";
import AdventureEmpty from "../components/AdventureEmpty";
import TodayList from "../components/TodayList";
import WeekAhead from "../components/WeekAhead";

export default function Home({
  tasks,
  events,
  tasksLeft,
  upcomingEvents,
  onToggleTask,
  onAddTask,
  activeGoals,
  goalCount,
  spaceName,
  adventure,
}: Readonly<{
  tasks: readonly Task[];
  events: readonly CalendarEvent[];
  tasksLeft: number;
  upcomingEvents: number;
  onToggleTask: (id: string) => void;
  onAddTask: () => void;
  activeGoals: number;
  goalCount: number;
  spaceName: string;
  adventure: Adventure | null;
}>) {
  return (
    <>
      <Header />
      <StatCards
        activeGoals={activeGoals}
        tasksLeft={tasksLeft}
        upcomingEvents={upcomingEvents}
        adventure={adventure}
      />
      {adventure ? (
        <div className="hero-row">
          <AdventureCard adventure={adventure} />
          <Countdown adventure={adventure} />
        </div>
      ) : (
        <AdventureEmpty goalCount={goalCount} spaceName={spaceName} />
      )}
      <div className="panels">
        <TodayList tasks={tasks} onToggle={onToggleTask} onAdd={onAddTask} />
        <WeekAhead events={events} />
      </div>
    </>
  );
}

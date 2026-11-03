import { useState } from "react";
import type { Adventure, CalendarEvent, Goal, Task } from "../types";
import { newCount, type ApiActivity } from "../helpers/activity";
import type { ApiMember } from "../helpers/goals";
import Header, { type HomeView } from "../components/Header";
import RecentActivity from "../components/RecentActivity";
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
  activity,
  lastSeenAt,
  members,
  myUserId,
  goals,
  onSeenActivity,
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
  activity: readonly ApiActivity[];
  lastSeenAt: string | null; // when I last opened Recent activity
  members: readonly ApiMember[];
  myUserId: string | null | undefined;
  goals: readonly Goal[];
  onSeenActivity: () => void;
}>) {
  const [view, setView] = useState<HomeView>("Overview");
  // When I'd last looked before this visit, so new entries stay marked while
  // I read, even though opening the feed marks it seen straight away.
  const [newSince, setNewSince] = useState<string | null>(null);
  const showView = (v: HomeView) => {
    if (v === "Recent activity" && view !== v) {
      setNewSince(lastSeenAt);
      onSeenActivity();
    }
    setView(v);
  };

  const header = (
    <Header
      view={view}
      onView={showView}
      newCount={view === "Recent activity" ? 0 : newCount(activity, myUserId, lastSeenAt)}
    />
  );

  if (view === "Recent activity")
    return (
      <>
        {header}
        <RecentActivity
          activity={activity}
          members={members}
          myUserId={myUserId}
          goals={goals}
          newSince={newSince}
        />
      </>
    );

  return (
    <>
      {header}
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

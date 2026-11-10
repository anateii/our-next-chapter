import { useState } from "react";
import type { Adventure, CalendarEvent, Goal, Task } from "../types";
import { newCount, type ApiActivity } from "../helpers/activity";
import type { ApiMember } from "../helpers/goals";
import Header, { type HomeView } from "../components/Header";
import RecentActivity from "../components/RecentActivity";
import StatCards from "../components/StatCards";
import AdventureCard from "../components/AdventureCard";
import AdventureEmpty from "../components/AdventureEmpty";
import Upcoming from "../components/Upcoming";
import type { CheckInSchedule } from "../helpers/checkins";
import { smoothly } from "../helpers/motion";

export default function Home({
  tasks,
  events,
  checkIn,
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
  tasks: readonly Task[]; // every task, for the Coming up agenda
  events: readonly CalendarEvent[]; // every stored event, for the Coming up agenda
  checkIn: CheckInSchedule;
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
    smoothly(() => setView(v));
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

  // Overview: stats, the featured adventure, then Next up, the two-week strip
  // and the Coming up agenda (which also holds today's items and slipped tasks).
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
        <AdventureCard adventure={adventure} />
      ) : (
        <AdventureEmpty goalCount={goalCount} spaceName={spaceName} />
      )}
      <Upcoming
        tasks={tasks}
        events={events}
        checkIn={checkIn}
        goals={goals}
        onToggleTask={onToggleTask}
        onAddTask={onAddTask}
      />
    </>
  );
}

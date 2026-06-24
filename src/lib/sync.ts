// Firebase Firestore sync — last-write-wins, local-first
import { syncCollection, fetchCollection, getCurrentUser, signInAnon } from './firebase';
import type {
  Phase,
  Task,
  Habit,
  TimeBlock,
  DayOverride,
} from '../db/queries';

type AnyRow = Record<string, unknown>;

async function ensureAuth(): Promise<string | null> {
  try {
    let user = getCurrentUser();
    if (!user) {
      user = await signInAnon();
    }
    return user.uid;
  } catch {
    return null;
  }
}

export async function pushToCloud(data: {
  phases: Phase[];
  tasks: Task[];
  habits: Habit[];
  timeBlocks: TimeBlock[];
  dayOverrides: DayOverride[];
}): Promise<void> {
  const uid = await ensureAuth();
  if (!uid) return; // offline — skip silently

  await Promise.all([
    syncCollection(uid, 'phases', data.phases as unknown as AnyRow[]),
    syncCollection(uid, 'tasks', data.tasks as unknown as AnyRow[]),
    syncCollection(uid, 'habits', data.habits as unknown as AnyRow[]),
    syncCollection(uid, 'timeBlocks', data.timeBlocks as unknown as AnyRow[]),
    syncCollection(uid, 'dayOverrides', data.dayOverrides as unknown as AnyRow[]),
  ]);
}

export async function pullFromCloud(): Promise<{
  phases: Phase[];
  tasks: Task[];
  habits: Habit[];
  timeBlocks: TimeBlock[];
  dayOverrides: DayOverride[];
} | null> {
  const uid = await ensureAuth();
  if (!uid) return null;

  const [phases, tasks, habits, timeBlocks, dayOverrides] = await Promise.all([
    fetchCollection(uid, 'phases'),
    fetchCollection(uid, 'tasks'),
    fetchCollection(uid, 'habits'),
    fetchCollection(uid, 'timeBlocks'),
    fetchCollection(uid, 'dayOverrides'),
  ]);

  return {
    phases: phases as unknown as Phase[],
    tasks: tasks as unknown as Task[],
    habits: habits as unknown as Habit[],
    timeBlocks: timeBlocks as unknown as TimeBlock[],
    dayOverrides: dayOverrides as unknown as DayOverride[],
  };
}

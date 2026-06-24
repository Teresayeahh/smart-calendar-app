import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

// ─── Types ─────────────────────────────────────────────────────────────────

export type DayType = 'workday' | 'holiday';
export type TaskStatus = 'active' | 'completed' | 'cancelled';
export type HabitStatus = 'active' | 'expired' | 'cancelled';
export type BlockStatus = 'pending' | 'done' | 'postponed';
export type SourceType = 'task' | 'habit';

export interface Phase {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  workdayFreeStart: string;
  workdayFreeEnd: string;
  holidayFreeStart: string;
  holidayFreeEnd: string;
}

export interface DayOverride {
  date: string;
  type: DayType;
}

export interface Task {
  id: string;
  parentId: string | null;
  name: string;
  totalDuration: number | null;
  blockDuration: number | null;
  deadline: string | null;
  status: TaskStatus;
}

export interface Habit {
  id: string;
  name: string;
  durationPerSession: number;
  timesPerWeek: number;
  cycleStart: string;
  cycleEnd: string;
  status: HabitStatus;
}

export interface TimeBlock {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  date: string;
  startTime: string;
  endTime: string;
  status: BlockStatus;
  notificationId: string | null;
}

// ─── Phases ────────────────────────────────────────────────────────────────

export async function getPhases(db: SQLite.SQLiteDatabase): Promise<Phase[]> {
  return db.getAllAsync<Phase>('SELECT * FROM phases ORDER BY startDate ASC');
}

export async function upsertPhase(
  db: SQLite.SQLiteDatabase,
  phase: Omit<Phase, 'id'> & { id?: string }
): Promise<Phase> {
  const id = phase.id ?? randomUUID();
  await db.runAsync(
    `INSERT OR REPLACE INTO phases (id, name, startDate, endDate, workdayFreeStart, workdayFreeEnd, holidayFreeStart, holidayFreeEnd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    phase.name,
    phase.startDate,
    phase.endDate ?? null,
    phase.workdayFreeStart,
    phase.workdayFreeEnd,
    phase.holidayFreeStart,
    phase.holidayFreeEnd
  );
  return { ...phase, id };
}

export async function deletePhase(db: SQLite.SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM phases WHERE id = ?', id);
}

// ─── Day Overrides ─────────────────────────────────────────────────────────

export async function getDayOverrides(db: SQLite.SQLiteDatabase): Promise<DayOverride[]> {
  return db.getAllAsync<DayOverride>('SELECT * FROM day_overrides');
}

export async function setDayOverride(
  db: SQLite.SQLiteDatabase,
  date: string,
  type: DayType
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO day_overrides (date, type) VALUES (?, ?)',
    date,
    type
  );
}

export async function removeDayOverride(db: SQLite.SQLiteDatabase, date: string): Promise<void> {
  await db.runAsync('DELETE FROM day_overrides WHERE date = ?', date);
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export async function getTasks(
  db: SQLite.SQLiteDatabase,
  status?: TaskStatus
): Promise<Task[]> {
  if (status) {
    return db.getAllAsync<Task>('SELECT * FROM tasks WHERE status = ? ORDER BY createdAt DESC', status);
  }
  return db.getAllAsync<Task>('SELECT * FROM tasks ORDER BY createdAt DESC');
}

export async function getTask(db: SQLite.SQLiteDatabase, id: string): Promise<Task | null> {
  return db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', id);
}

export async function getChildTasks(db: SQLite.SQLiteDatabase, parentId: string): Promise<Task[]> {
  return db.getAllAsync<Task>('SELECT * FROM tasks WHERE parentId = ? ORDER BY createdAt ASC', parentId);
}

export async function isLeafTask(db: SQLite.SQLiteDatabase, taskId: string): Promise<boolean> {
  const children = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM tasks WHERE parentId = ?',
    taskId
  );
  return (children?.count ?? 0) === 0;
}

export async function createTask(
  db: SQLite.SQLiteDatabase,
  task: Omit<Task, 'id' | 'status'>
): Promise<Task> {
  const id = randomUUID();
  await db.runAsync(
    `INSERT INTO tasks (id, parentId, name, totalDuration, blockDuration, deadline, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    id,
    task.parentId ?? null,
    task.name,
    task.totalDuration ?? null,
    task.blockDuration ?? null,
    task.deadline ?? null
  );
  return { ...task, id, status: 'active' };
}

export async function updateTask(
  db: SQLite.SQLiteDatabase,
  id: string,
  updates: Partial<Omit<Task, 'id'>>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value as string | number | null);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteTask(db: SQLite.SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

// ─── Habits ────────────────────────────────────────────────────────────────

export async function getHabits(
  db: SQLite.SQLiteDatabase,
  status?: HabitStatus
): Promise<Habit[]> {
  if (status) {
    return db.getAllAsync<Habit>('SELECT * FROM habits WHERE status = ? ORDER BY createdAt DESC', status);
  }
  return db.getAllAsync<Habit>('SELECT * FROM habits ORDER BY createdAt DESC');
}

export async function getHabit(db: SQLite.SQLiteDatabase, id: string): Promise<Habit | null> {
  return db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', id);
}

export async function createHabit(
  db: SQLite.SQLiteDatabase,
  habit: Omit<Habit, 'id' | 'status'>
): Promise<Habit> {
  const id = randomUUID();
  await db.runAsync(
    `INSERT INTO habits (id, name, durationPerSession, timesPerWeek, cycleStart, cycleEnd, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    id,
    habit.name,
    habit.durationPerSession,
    habit.timesPerWeek,
    habit.cycleStart,
    habit.cycleEnd
  );
  return { ...habit, id, status: 'active' };
}

export async function updateHabit(
  db: SQLite.SQLiteDatabase,
  id: string,
  updates: Partial<Omit<Habit, 'id'>>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value as string | number | null);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE habits SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteHabit(db: SQLite.SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM habits WHERE id = ?', id);
}

// ─── Time Blocks ────────────────────────────────────────────────────────────

export async function getTimeBlocksForDate(
  db: SQLite.SQLiteDatabase,
  date: string
): Promise<TimeBlock[]> {
  return db.getAllAsync<TimeBlock>(
    'SELECT * FROM time_blocks WHERE date = ? ORDER BY startTime ASC',
    date
  );
}

export async function getTimeBlocksForSource(
  db: SQLite.SQLiteDatabase,
  sourceId: string
): Promise<TimeBlock[]> {
  return db.getAllAsync<TimeBlock>(
    "SELECT * FROM time_blocks WHERE sourceId = ? AND status != 'done' ORDER BY date ASC, startTime ASC",
    sourceId
  );
}

export async function getPendingTimeBlocks(
  db: SQLite.SQLiteDatabase,
  fromDate: string
): Promise<TimeBlock[]> {
  return db.getAllAsync<TimeBlock>(
    "SELECT * FROM time_blocks WHERE date >= ? AND status = 'pending' ORDER BY date ASC, startTime ASC",
    fromDate
  );
}

export async function getTimeBlocksInRange(
  db: SQLite.SQLiteDatabase,
  fromDate: string,
  toDate: string
): Promise<TimeBlock[]> {
  return db.getAllAsync<TimeBlock>(
    'SELECT * FROM time_blocks WHERE date >= ? AND date <= ? ORDER BY date ASC, startTime ASC',
    fromDate,
    toDate
  );
}

export async function insertTimeBlocks(
  db: SQLite.SQLiteDatabase,
  blocks: Omit<TimeBlock, 'id' | 'notificationId'>[]
): Promise<TimeBlock[]> {
  const result: TimeBlock[] = [];
  for (const block of blocks) {
    const id = randomUUID();
    await db.runAsync(
      'INSERT INTO time_blocks (id, sourceId, sourceType, date, startTime, endTime, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      block.sourceId,
      block.sourceType,
      block.date,
      block.startTime,
      block.endTime,
      block.status
    );
    result.push({ ...block, id, notificationId: null });
  }
  return result;
}

export async function updateTimeBlock(
  db: SQLite.SQLiteDatabase,
  id: string,
  updates: Partial<Omit<TimeBlock, 'id'>>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(updates)) {
    const col = key === 'notificationId' ? 'notificationId' : key;
    fields.push(`${col} = ?`);
    values.push(value as string | number | null);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE time_blocks SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteTimeBlocksForSource(
  db: SQLite.SQLiteDatabase,
  sourceId: string
): Promise<void> {
  await db.runAsync(
    "DELETE FROM time_blocks WHERE sourceId = ? AND status = 'pending'",
    sourceId
  );
}

export async function deleteTimeBlock(db: SQLite.SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM time_blocks WHERE id = ?', id);
}

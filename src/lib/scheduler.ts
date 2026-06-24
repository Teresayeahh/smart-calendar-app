import { getDayType } from './holidays';
import type {
  Phase,
  DayOverride,
  Task,
  Habit,
  TimeBlock,
} from '../db/queries';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function getWeekday(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun..6=Sat
}

// Returns YYYY-MM-DD of the Monday that starts the calendar week containing dateStr
function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun..6=Sat
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysToMonday);
  const y = monday.getFullYear();
  const mo = String(monday.getMonth() + 1).padStart(2, '0');
  const da = String(monday.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// ─── Phase resolution ────────────────────────────────────────────────────────

function getPhaseForDate(phases: Phase[], dateStr: string): Phase | null {
  for (const phase of phases) {
    const after = dateStr >= phase.startDate;
    const before = !phase.endDate || dateStr <= phase.endDate;
    if (after && before) return phase;
  }
  return null;
}

// ─── Free slots ──────────────────────────────────────────────────────────────

interface FreeSlot {
  date: string;
  start: number; // minutes from midnight
  end: number;
}

export interface ScheduledBlock {
  sourceId: string;
  sourceType: 'task' | 'habit';
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending';
}

function getFreeSlotsForDate(
  dateStr: string,
  phases: Phase[],
  overrides: DayOverride[],
  existingBlocks: TimeBlock[]
): FreeSlot[] {
  const phase = getPhaseForDate(phases, dateStr);
  if (!phase) return [];

  const override = overrides.find(o => o.date === dateStr);
  const dayType = override ? override.type : getDayType(dateStr);

  const freeStart =
    dayType === 'workday'
      ? timeToMinutes(phase.workdayFreeStart)
      : timeToMinutes(phase.holidayFreeStart);
  const freeEnd =
    dayType === 'workday'
      ? timeToMinutes(phase.workdayFreeEnd)
      : timeToMinutes(phase.holidayFreeEnd);

  if (freeStart >= freeEnd) return [];

  // Collect busy intervals from existing blocks on this date
  const busy = existingBlocks
    .filter(b => b.date === dateStr && b.status !== 'done')
    .map(b => ({ s: timeToMinutes(b.startTime), e: timeToMinutes(b.endTime) }))
    .sort((a, b) => a.s - b.s);

  // Subtract busy from [freeStart, freeEnd]
  const free: FreeSlot[] = [];
  let cursor = freeStart;
  for (const b of busy) {
    if (b.s > cursor) {
      free.push({ date: dateStr, start: cursor, end: b.s });
    }
    cursor = Math.max(cursor, b.e);
  }
  if (cursor < freeEnd) {
    free.push({ date: dateStr, start: cursor, end: freeEnd });
  }
  return free;
}

// ─── Task scheduler ──────────────────────────────────────────────────────────

export interface ScheduleResult {
  blocks: ScheduledBlock[];
  conflict: boolean;
  conflictMessage?: string;
}

export function scheduleTask(
  task: Task,
  phases: Phase[],
  overrides: DayOverride[],
  existingBlocks: TimeBlock[],
  today: string
): ScheduleResult {
  if (!task.totalDuration || !task.blockDuration || !task.deadline) {
    return { blocks: [], conflict: true, conflictMessage: '任务缺少必填字段（时长、块时长、截止日期）' };
  }

  const totalBlocks = Math.ceil(task.totalDuration / task.blockDuration);
  const blockMins = task.blockDuration;
  const deadline = task.deadline;

  const dates = dateRange(today, deadline);
  const scheduled: ScheduledBlock[] = [];
  const allBlocks = [...existingBlocks];

  for (const date of dates) {
    if (scheduled.length >= totalBlocks) break;

    const slots = getFreeSlotsForDate(date, phases, overrides, allBlocks);
    for (const slot of slots) {
      if (scheduled.length >= totalBlocks) break;
      if (slot.end - slot.start >= blockMins) {
        const block: ScheduledBlock = {
          sourceId: task.id,
          sourceType: 'task',
          date,
          startTime: minutesToTime(slot.start),
          endTime: minutesToTime(slot.start + blockMins),
          status: 'pending',
        };
        scheduled.push(block);
        // Add to allBlocks so next iteration respects this slot
        allBlocks.push({
          id: `tmp-${scheduled.length}`,
          sourceId: task.id,
          sourceType: 'task',
          date,
          startTime: block.startTime,
          endTime: block.endTime,
          status: 'pending',
          notificationId: null,
        });
      }
    }
  }

  if (scheduled.length < totalBlocks) {
    return {
      blocks: scheduled,
      conflict: true,
      conflictMessage: `截止日期前只能排 ${scheduled.length}/${totalBlocks} 个时间块，请调整截止日期或减少总时长`,
    };
  }

  return { blocks: scheduled, conflict: false };
}

// ─── Habit scheduler ────────────────────────────────────────────────────────

export function scheduleHabit(
  habit: Habit,
  phases: Phase[],
  overrides: DayOverride[],
  existingBlocks: TimeBlock[],
  today: string
): ScheduleResult {
  const start = today > habit.cycleStart ? today : habit.cycleStart;
  const end = habit.cycleEnd;
  const allDates = dateRange(start, end);
  const blockMins = habit.durationPerSession;

  // Group dates into Mon-Sun calendar weeks (in chronological order).
  // Since allDates is sequential, consecutive same-weekKey entries form one group.
  const weekGroups: string[][] = [];
  let lastKey = '';
  for (const date of allDates) {
    const wk = getWeekKey(date);
    if (wk !== lastKey) {
      weekGroups.push([]);
      lastKey = wk;
    }
    weekGroups[weekGroups.length - 1].push(date);
  }

  const targetTotal = weekGroups.length * habit.timesPerWeek;
  const scheduled: ScheduledBlock[] = [];
  const allBlocks = [...existingBlocks];
  let totalMissed = 0;

  for (const weekDates of weekGroups) {
    let countThisWeek = 0;

    for (const date of weekDates) {
      // Hard cap: stop as soon as we hit the weekly quota
      if (countThisWeek >= habit.timesPerWeek) break;

      const slots = getFreeSlotsForDate(date, phases, overrides, allBlocks);
      for (const slot of slots) {
        if (slot.end - slot.start >= blockMins) {
          const block: ScheduledBlock = {
            sourceId: habit.id,
            sourceType: 'habit',
            date,
            startTime: minutesToTime(slot.start),
            endTime: minutesToTime(slot.start + blockMins),
            status: 'pending',
          };
          scheduled.push(block);
          // Mark the slot busy so subsequent days/weeks respect it
          allBlocks.push({
            id: `tmp-${scheduled.length}`,
            sourceId: habit.id,
            sourceType: 'habit',
            date,
            startTime: block.startTime,
            endTime: block.endTime,
            status: 'pending',
            notificationId: null,
          });
          countThisWeek++;
          break; // one session per day
        }
      }
    }

    totalMissed += habit.timesPerWeek - countThisWeek;
  }

  if (totalMissed > 0) {
    return {
      blocks: scheduled,
      conflict: true,
      conflictMessage: `周期内只能排 ${scheduled.length}/${targetTotal} 次习惯，请检查可用时间或减少频次`,
    };
  }

  return { blocks: scheduled, conflict: false };
}

// ─── Postpone ────────────────────────────────────────────────────────────────

export function findNextSlot(
  block: TimeBlock,
  phases: Phase[],
  overrides: DayOverride[],
  existingBlocks: TimeBlock[],
  today: string
): { date: string; startTime: string; endTime: string } | null {
  const blockMins = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
  const startSearch = addDays(today, 1);
  // Search up to 30 days ahead
  const endSearch = addDays(today, 30);
  const dates = dateRange(startSearch, endSearch);

  for (const date of dates) {
    const slots = getFreeSlotsForDate(date, phases, overrides, existingBlocks);
    for (const slot of slots) {
      if (slot.end - slot.start >= blockMins) {
        return {
          date,
          startTime: minutesToTime(slot.start),
          endTime: minutesToTime(slot.start + blockMins),
        };
      }
    }
  }
  return null;
}

export { addDays, dateRange, timeToMinutes, minutesToTime };

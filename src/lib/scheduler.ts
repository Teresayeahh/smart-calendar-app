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
  outsidePreference?: boolean; // true when placed outside the user's preferred window
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

// Clip free slots to the intersection with [windowStart, windowEnd]
function clipSlots(slots: FreeSlot[], windowStart: number, windowEnd: number): FreeSlot[] {
  const result: FreeSlot[] = [];
  for (const s of slots) {
    const start = Math.max(s.start, windowStart);
    const end = Math.min(s.end, windowEnd);
    if (end > start) result.push({ date: s.date, start, end });
  }
  return result;
}

// Remove [windowStart, windowEnd] from free slots, keeping the parts outside
function excludeWindow(slots: FreeSlot[], windowStart: number, windowEnd: number): FreeSlot[] {
  const result: FreeSlot[] = [];
  for (const s of slots) {
    if (s.end <= windowStart || s.start >= windowEnd) {
      result.push(s);
    } else {
      if (s.start < windowStart) result.push({ date: s.date, start: s.start, end: windowStart });
      if (s.end > windowEnd) result.push({ date: s.date, start: windowEnd, end: s.end });
    }
  }
  return result;
}

// Place as many blockMins-sized blocks as possible from slots, up to maxToPlace.
// Uses a cursor within each slot so consecutive blocks pack tightly without gaps.
function placeBlocks(
  date: string,
  slots: FreeSlot[],
  blockMins: number,
  maxToPlace: number,
  allBlocks: TimeBlock[],
  sourceId: string,
  sourceType: 'task' | 'habit',
  outsidePreference: boolean
): ScheduledBlock[] {
  const placed: ScheduledBlock[] = [];
  for (const slot of slots) {
    let cursor = slot.start;
    while (cursor + blockMins <= slot.end && placed.length < maxToPlace) {
      const block: ScheduledBlock = {
        sourceId, sourceType, date,
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(cursor + blockMins),
        status: 'pending',
        ...(outsidePreference ? { outsidePreference: true } : {}),
      };
      placed.push(block);
      allBlocks.push({
        id: `tmp-${allBlocks.length}`,
        sourceId, sourceType, date,
        startTime: block.startTime,
        endTime: block.endTime,
        status: 'pending',
        notificationId: null,
      });
      cursor += blockMins;
    }
    if (placed.length >= maxToPlace) break;
  }
  return placed;
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

  const blockMins = task.blockPreferMax ?? task.blockDuration;
  const totalBlocks = Math.ceil(task.totalDuration / blockMins);
  const dates = dateRange(today, task.deadline);
  // Even distribution: each day gets at most this many blocks
  const targetPerDay = Math.ceil(totalBlocks / Math.max(dates.length, 1));

  const preferStart = task.preferredTimeStart ? timeToMinutes(task.preferredTimeStart) : null;
  const preferEnd = task.preferredTimeEnd ? timeToMinutes(task.preferredTimeEnd) : null;
  const hasPreference = preferStart !== null && preferEnd !== null && preferEnd > preferStart;

  const scheduled: ScheduledBlock[] = [];
  const allBlocks = [...existingBlocks];
  // Track how many blocks placed per day (for the per-day cap in pass 2)
  const placedPerDay: Record<string, number> = {};

  if (hasPreference) {
    // Pass 1 — preferred window only, up to targetPerDay per day
    for (const date of dates) {
      if (scheduled.length >= totalBlocks) break;
      const freeSlots = getFreeSlotsForDate(date, phases, overrides, allBlocks);
      const preferSlots = clipSlots(freeSlots, preferStart!, preferEnd!);
      const cap = Math.min(targetPerDay, totalBlocks - scheduled.length);
      const placed = placeBlocks(date, preferSlots, blockMins, cap, allBlocks, task.id, 'task', false);
      placedPerDay[date] = placed.length;
      scheduled.push(...placed);
    }

    // Pass 2 — non-preferred slots for remaining blocks, respecting per-day cap
    for (const date of dates) {
      if (scheduled.length >= totalBlocks) break;
      const alreadyToday = placedPerDay[date] ?? 0;
      const remainingCap = targetPerDay - alreadyToday;
      if (remainingCap <= 0) continue;
      const freeSlots = getFreeSlotsForDate(date, phases, overrides, allBlocks);
      const nonPreferSlots = excludeWindow(freeSlots, preferStart!, preferEnd!);
      const cap = Math.min(remainingCap, totalBlocks - scheduled.length);
      const placed = placeBlocks(date, nonPreferSlots, blockMins, cap, allBlocks, task.id, 'task', true);
      scheduled.push(...placed);
    }
  } else {
    // No preference — single pass, up to targetPerDay per day
    for (const date of dates) {
      if (scheduled.length >= totalBlocks) break;
      const freeSlots = getFreeSlotsForDate(date, phases, overrides, allBlocks);
      const cap = Math.min(targetPerDay, totalBlocks - scheduled.length);
      const placed = placeBlocks(date, freeSlots, blockMins, cap, allBlocks, task.id, 'task', false);
      scheduled.push(...placed);
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
  const preferStart = habit.preferredTimeStart ? timeToMinutes(habit.preferredTimeStart) : null;
  const preferEnd = habit.preferredTimeEnd ? timeToMinutes(habit.preferredTimeEnd) : null;
  const hasPreference = preferStart !== null && preferEnd !== null && preferEnd > preferStart;

  const scheduled: ScheduledBlock[] = [];
  const allBlocks = [...existingBlocks];
  let totalMissed = 0;

  for (const weekDates of weekGroups) {
    let countThisWeek = 0;

    for (const date of weekDates) {
      if (countThisWeek >= habit.timesPerWeek) break;

      const allSlots = getFreeSlotsForDate(date, phases, overrides, allBlocks);
      const preferredSlots = hasPreference
        ? clipSlots(allSlots, preferStart!, preferEnd!)
        : [];
      const candidates = preferredSlots.length > 0 ? preferredSlots : allSlots;
      const outsidePreference = hasPreference && preferredSlots.length === 0;

      for (const slot of candidates) {
        if (slot.end - slot.start >= blockMins) {
          const block: ScheduledBlock = {
            sourceId: habit.id,
            sourceType: 'habit',
            date,
            startTime: minutesToTime(slot.start),
            endTime: minutesToTime(slot.start + blockMins),
            status: 'pending',
            outsidePreference: outsidePreference || undefined,
          };
          scheduled.push(block);
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
          break;
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

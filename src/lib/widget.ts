// Android home screen widget data provider
// Uses react-native-android-widget (requires a native/development build)
// This module prepares the data; actual widget rendering is in widget-component/

import type { TimeBlock } from '../db/queries';

export interface WidgetData {
  currentTask: string | null;
  currentEnd: string | null;
  nextTask: string | null;
  nextStart: string | null;
}

export function buildWidgetData(
  blocks: TimeBlock[],
  nameMap: Record<string, string>
): WidgetData {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  function toMins(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  const pending = blocks.filter(b => b.status === 'pending');

  // Find current block (ongoing right now)
  const current = pending.find(b => {
    const s = toMins(b.startTime);
    const e = toMins(b.endTime);
    return nowMins >= s && nowMins < e;
  });

  // Find next block (upcoming)
  const next = pending
    .filter(b => toMins(b.startTime) > nowMins)
    .sort((a, b) => toMins(a.startTime) - toMins(b.startTime))[0];

  return {
    currentTask: current ? (nameMap[current.sourceId] ?? current.sourceId) : null,
    currentEnd: current?.endTime ?? null,
    nextTask: next ? (nameMap[next.sourceId] ?? next.sourceId) : null,
    nextStart: next?.startTime ?? null,
  };
}

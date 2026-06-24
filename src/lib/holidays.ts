// Chinese legal holidays for 2025 and 2026
// Source: State Council announcements
// Format: YYYY-MM-DD

const HOLIDAYS_2025 = new Set([
  // 元旦 New Year (Jan 1)
  '2025-01-01',
  // 春节 Spring Festival (Jan 28 – Feb 4)
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
  '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
  // 清明节 Qingming (Apr 4–6)
  '2025-04-04', '2025-04-05', '2025-04-06',
  // 劳动节 Labor Day (May 1–5)
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
  // 端午节 Dragon Boat (May 31 – Jun 2)
  '2025-05-31', '2025-06-01', '2025-06-02',
  // 国庆节+中秋节 National Day + Mid-Autumn (Oct 1–8)
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04',
  '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
]);

// Workdays that fall on weekends (makeup days / 调休上班日)
const WORKDAYS_2025 = new Set([
  '2025-01-26', // Sunday (makeup for Spring Festival)
  '2025-02-08', // Saturday (makeup for Spring Festival)
  '2025-04-27', // Sunday (makeup for Labor Day)
  '2025-09-28', // Sunday (makeup for National Day)
  '2025-10-11', // Saturday (makeup for National Day)
]);

const HOLIDAYS_2026 = new Set([
  // 元旦 New Year (Jan 1)
  '2026-01-01',
  // 春节 Spring Festival (Feb 17–23, exact dates TBD, using estimated)
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-02-21', '2026-02-22', '2026-02-23',
  // 清明节 Qingming (Apr 5–7)
  '2026-04-04', '2026-04-05', '2026-04-06',
  // 劳动节 Labor Day (May 1–5)
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  // 端午节 Dragon Boat (Jun 19–21)
  '2026-06-19', '2026-06-20', '2026-06-21',
  // 中秋节 Mid-Autumn (Sep 25–27)
  '2026-09-25', '2026-09-26', '2026-09-27',
  // 国庆节 National Day (Oct 1–7)
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
]);

const WORKDAYS_2026 = new Set([
  '2026-02-15', // Sunday (makeup for Spring Festival)
  '2026-02-28', // Saturday (makeup for Spring Festival)
  '2026-04-12', // Sunday (makeup for Labor Day)
  '2026-09-27', // Sunday (makeup for National Day — estimate)
  '2026-10-10', // Saturday (makeup for National Day — estimate)
]);

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns true if the given date string (YYYY-MM-DD) is a holiday/rest day
 * according to Chinese legal calendar.
 */
export function isHoliday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  // Check makeup workdays first (overrides weekend)
  if (WORKDAYS_2025.has(dateStr) || WORKDAYS_2026.has(dateStr)) {
    return false;
  }
  // Check official holidays
  if (HOLIDAYS_2025.has(dateStr) || HOLIDAYS_2026.has(dateStr)) {
    return true;
  }
  // Fall back to weekend check
  return isWeekend(date);
}

export function getDayType(dateStr: string): 'workday' | 'holiday' {
  return isHoliday(dateStr) ? 'holiday' : 'workday';
}

export { formatDate };

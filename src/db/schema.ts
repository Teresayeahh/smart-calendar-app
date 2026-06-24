export const CREATE_TABLES_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS phases (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT,
    workdayFreeStart TEXT NOT NULL,
    workdayFreeEnd TEXT NOT NULL,
    holidayFreeStart TEXT NOT NULL,
    holidayFreeEnd TEXT NOT NULL,
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS day_overrides (
    date TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('workday','holiday'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    parentId TEXT,
    name TEXT NOT NULL,
    totalDuration INTEGER,
    blockDuration INTEGER,
    deadline TEXT,
    taskVolume TEXT,
    blockPreferMin INTEGER,
    blockPreferMax INTEGER,
    preferredTimeStart TEXT,
    preferredTimeEnd TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (parentId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    durationPerSession INTEGER NOT NULL,
    timesPerWeek INTEGER NOT NULL,
    cycleStart TEXT NOT NULL,
    cycleEnd TEXT NOT NULL,
    preferredTimeStart TEXT,
    preferredTimeEnd TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','cancelled')),
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS time_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    sourceId TEXT NOT NULL,
    sourceType TEXT NOT NULL CHECK(sourceType IN ('task','habit')),
    date TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','postponed')),
    notificationId TEXT,
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON time_blocks(date);
  CREATE INDEX IF NOT EXISTS idx_time_blocks_source ON time_blocks(sourceId, sourceType);
  CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parentId);
`;

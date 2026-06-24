import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';

const MIGRATIONS = [
  'ALTER TABLE tasks ADD COLUMN taskVolume TEXT',
  'ALTER TABLE tasks ADD COLUMN blockPreferMin INTEGER',
  'ALTER TABLE tasks ADD COLUMN blockPreferMax INTEGER',
  'ALTER TABLE tasks ADD COLUMN preferredTimeStart TEXT',
  'ALTER TABLE tasks ADD COLUMN preferredTimeEnd TEXT',
  'ALTER TABLE habits ADD COLUMN preferredTimeStart TEXT',
  'ALTER TABLE habits ADD COLUMN preferredTimeEnd TEXT',
];

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_TABLES_SQL);
  // Add columns for existing databases — silently ignored if already present
  for (const sql of MIGRATIONS) {
    try {
      await db.execAsync(sql);
    } catch {
      // column already exists
    }
  }
}

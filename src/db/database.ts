import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_TABLES_SQL);
}

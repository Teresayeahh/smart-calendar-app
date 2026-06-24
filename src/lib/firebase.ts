import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBDONBBHeBVDGCQjMrdRwbw1qcYYaJFCOs',
  authDomain: 'smart-calendar-app-2880e.firebaseapp.com',
  projectId: 'smart-calendar-app-2880e',
  storageBucket: 'smart-calendar-app-2880e.firebasestorage.app',
  messagingSenderId: '106612027438',
  appId: '1:106612027438:web:bb80f6f21c4910d24b2fbf',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

// ─── Auth ─────────────────────────────────────────────────────────────────

export async function signInAnon(): Promise<User> {
  const { user } = await signInAnonymously(auth);
  return user;
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onUserChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── Sync helpers ─────────────────────────────────────────────────────────

function userCollection(uid: string, name: string) {
  return collection(db, 'users', uid, name);
}

export async function syncCollection(
  uid: string,
  colName: string,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const colRef = userCollection(uid, colName);
  const batch = writeBatch(db);

  // Delete existing docs then re-upload (simple last-write-wins strategy)
  const existing = await getDocs(colRef);
  existing.forEach(d => batch.delete(d.ref));

  for (const row of rows) {
    const ref = doc(colRef, String(row.id));
    batch.set(ref, { ...row, _updatedAt: serverTimestamp() });
  }

  await batch.commit();
}

export async function fetchCollection(
  uid: string,
  colName: string
): Promise<Array<Record<string, unknown>>> {
  const colRef = userCollection(uid, colName);
  const snap = await getDocs(colRef);
  return snap.docs.map(d => d.data() as Record<string, unknown>);
}

// Simple in-memory reactive store using React context
// All data lives in SQLite; this layer caches it for the UI

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Phase, Task, Habit, TimeBlock, DayOverride } from '../db/queries';

interface AppState {
  phases: Phase[];
  tasks: Task[];
  habits: Habit[];
  todayBlocks: TimeBlock[];
  dayOverrides: DayOverride[];
  hasOnboarded: boolean;
}

type Action =
  | { type: 'SET_PHASES'; phases: Phase[] }
  | { type: 'SET_TASKS'; tasks: Task[] }
  | { type: 'SET_HABITS'; habits: Habit[] }
  | { type: 'SET_TODAY_BLOCKS'; blocks: TimeBlock[] }
  | { type: 'SET_DAY_OVERRIDES'; overrides: DayOverride[] }
  | { type: 'SET_ONBOARDED'; value: boolean }
  | { type: 'UPDATE_BLOCK'; block: TimeBlock }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'REMOVE_HABIT'; id: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PHASES':
      return { ...state, phases: action.phases };
    case 'SET_TASKS':
      return { ...state, tasks: action.tasks };
    case 'SET_HABITS':
      return { ...state, habits: action.habits };
    case 'SET_TODAY_BLOCKS':
      return { ...state, todayBlocks: action.blocks };
    case 'SET_DAY_OVERRIDES':
      return { ...state, dayOverrides: action.overrides };
    case 'SET_ONBOARDED':
      return { ...state, hasOnboarded: action.value };
    case 'UPDATE_BLOCK':
      return {
        ...state,
        todayBlocks: state.todayBlocks.map(b =>
          b.id === action.block.id ? action.block : b
        ),
      };
    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) };
    case 'REMOVE_HABIT':
      return { ...state, habits: state.habits.filter(h => h.id !== action.id) };
    default:
      return state;
  }
}

const initialState: AppState = {
  phases: [],
  tasks: [],
  habits: [],
  todayBlocks: [],
  dayOverrides: [],
  hasOnboarded: false,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be inside AppProvider');
  return ctx;
}

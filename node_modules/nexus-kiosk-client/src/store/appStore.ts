import { create } from 'zustand';
import type { AppConfig } from '../types/index';

interface AppState {
  isAuthenticated: boolean;
  isSettingsOpen: boolean;
  isFilesOpen: boolean;
  displayMode: 'day' | 'week' | 'month';
  theme: 'dark' | 'light';
  config: AppConfig | null;
  setIsAuthenticated: (value: boolean) => void;
  setIsSettingsOpen: (value: boolean) => void;
  setIsFilesOpen: (value: boolean) => void;
  setDisplayMode: (mode: 'day' | 'week' | 'month') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setConfig: (config: AppConfig) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  isSettingsOpen: false,
  isFilesOpen: false,
  displayMode: 'week',
  theme: 'dark',
  config: null,
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  setIsSettingsOpen: (value) => set({ isSettingsOpen: value }),
  setIsFilesOpen: (value) => set({ isFilesOpen: value }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setTheme: (theme) => set({ theme: theme }),
  setConfig: (config) => set({ config: config })
}));

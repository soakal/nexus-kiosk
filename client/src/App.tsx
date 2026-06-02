import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStatus } from './hooks/useAuth';
import { useConfig } from './hooks/useConfig';
import { useEvents } from './hooks/useEvents';
import { useRecentFiles } from './hooks/useRecentFiles';
import { useAppStore } from './store/appStore';
import Dashboard from './components/Dashboard';
import AuthSetup from './components/AuthSetup';
import SettingsPanel from './components/SettingsPanel';
import FileBrowserPanel from './components/FileBrowserPanel';
import ErrorBoundary from './components/ErrorBoundary';

const BoardLayout = lazy(() => import('./components/board/BoardLayout'));
const JobListView = lazy(() => import('./components/board/JobListView'));
const UsersView = lazy(() => import('./components/board/UsersView'));

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth — always polling
  const { isAuthenticated, isLoading: authLoading } = useAuthStatus(true);

  // Server config
  const { config } = useConfig();

  // Zustand store
  const {
    isSettingsOpen,
    isFilesOpen,
    displayMode,
    setIsAuthenticated,
    setIsSettingsOpen,
    setIsFilesOpen,
    setDisplayMode,
    setConfig,
  } = useAppStore();

  // Online status
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Data hooks — only active when authenticated
  const { events, dataUpdatedAt } = useEvents(
    config.calendarIds,
    isAuthenticated,
    config.refreshInterval
  );

  const { data: recentFiles, isLoading: recentFilesLoading } = useRecentFiles(
    config.recentFilesCount,
    isAuthenticated && config.showRecentFiles
  );

  // Sync auth state to store and navigate accordingly
  useEffect(() => {
    if (authLoading) return;
    setIsAuthenticated(isAuthenticated);
    if (isAuthenticated) {
      if (!location.pathname.startsWith('/board')) navigate('/');
    } else if (!location.pathname.startsWith('/board')) {
      navigate('/setup');
    }
  }, [isAuthenticated, authLoading, navigate, setIsAuthenticated, location.pathname]);

  // Sync config to store whenever it changes
  useEffect(() => {
    setConfig(config);
  }, [config, setConfig]);

  // Apply dark class to document root
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setIsSettingsOpen(!isSettingsOpen);
        return;
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setIsFilesOpen(!isFilesOpen);
        return;
      }
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsFilesOpen(false);
        return;
      }
      if (e.key === 'd') {
        setDisplayMode('day');
        return;
      }
      if (e.key === 'w') {
        setDisplayMode('week');
        return;
      }
      if (e.key === 'm') {
        setDisplayMode('month');
        return;
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isSettingsOpen, isFilesOpen, setIsSettingsOpen, setIsFilesOpen, setDisplayMode]);

  // Nightly watchdog — reload at 3am
  useEffect(() => {
    const now = new Date();
    const next3am = new Date(now);
    next3am.setHours(3, 0, 0, 0);
    if (next3am.getTime() <= now.getTime()) {
      next3am.setDate(next3am.getDate() + 1);
    }
    const msUntil3am = next3am.getTime() - now.getTime();
    const timer = setTimeout(() => {
      window.location.reload();
    }, msUntil3am);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Dashboard
                events={events}
                recentFiles={recentFiles ?? []}
                recentFilesLoading={recentFilesLoading}
                config={config}
                isOnline={isOnline}
                dataUpdatedAt={dataUpdatedAt}
                displayMode={displayMode}
                onSetDisplayMode={setDisplayMode}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenFiles={() => setIsFilesOpen(true)}
              />
            ) : (
              <Navigate to="/setup" replace />
            )
          }
        />
        <Route
          path="/setup"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <AuthSetup onAuthenticated={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          path="/board"
          element={
            <Suspense fallback={<div className="min-h-screen bg-[#0f1117]" />}>
              <BoardLayout />
            </Suspense>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={null}>
                <JobListView tab="project" />
              </Suspense>
            }
          />
          <Route
            path="spare-parts"
            element={
              <Suspense fallback={null}>
                <JobListView tab="spare-parts" />
              </Suspense>
            }
          />
          <Route
            path="users"
            element={
              <Suspense fallback={null}>
                <UsersView />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Always-rendered slide-over panels, controlled by store */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
      />
      <FileBrowserPanel
        isOpen={isFilesOpen}
        onClose={() => setIsFilesOpen(false)}
        fileOpenMode={config.fileOpenMode}
      />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

export default App;

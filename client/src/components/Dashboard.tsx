import React, { useState, useEffect, useCallback } from "react";
import type { CalendarEvent, AppConfig, SharePointFile } from "../types/index";
import Clock from "./Clock";
import NextEventBadge from "./NextEventBadge";
import WeatherWidget from "./WeatherWidget";
import CalendarView from "./CalendarView";
import AgendaRail from "./AgendaRail";
import RecentFilesWidget from "./RecentFilesWidget";
import StalenessIndicator from "./StalenessIndicator";

interface DashboardProps {
  events: CalendarEvent[];
  recentFiles: SharePointFile[];
  recentFilesLoading?: boolean;
  config: AppConfig;
  isOnline: boolean;
  dataUpdatedAt: number;
  onOpenSettings: () => void;
  onOpenFiles: () => void;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

const Dashboard: React.FC<DashboardProps> = ({
  events,
  recentFiles,
  recentFilesLoading = false,
  config,
  isOnline,
  dataUpdatedAt,
  onOpenSettings,
  onOpenFiles,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sunsetIso, setSunsetIso] = useState<string | null>(null);
  const [isDimmed, setIsDimmed] = useState(false);

  // Tick every minute to re-evaluate staleness and sunset dimming
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Evaluate sunset dimming whenever nowMs or sunsetIso changes
  useEffect(() => {
    if (!sunsetIso) { setIsDimmed(false); return; }
    const sunsetMs = new Date(sunsetIso).getTime();
    setIsDimmed(Date.now() > sunsetMs);
  }, [nowMs, sunsetIso]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); onOpenSettings(); }
      if (e.ctrlKey && e.key === "f") { e.preventDefault(); onOpenFiles(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpenSettings, onOpenFiles]);

  const handleSunsetIso = useCallback((iso: string) => setSunsetIso(iso), []);

  const minutesSinceUpdate = dataUpdatedAt > 0 ? Math.floor((nowMs - dataUpdatedAt) / 60_000) : null;
  const showBanner = !isOnline || (dataUpdatedAt > 0 && nowMs - dataUpdatedAt > STALE_THRESHOLD_MS);

  return (
    <div
      className={`h-screen w-screen flex flex-col bg-[#0f1117] text-slate-200 overflow-hidden transition-[filter] duration-[2000ms] ${isDimmed ? "brightness-[0.65]" : "brightness-100"}`}
    >
      {/* Staleness / offline banner */}
      {showBanner && (
        <StalenessIndicator isOnline={isOnline} minutesSinceUpdate={minutesSinceUpdate} />
      )}

      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center gap-6 px-6 py-3 border-b border-white/5 bg-black/20">
        {/* Clock - left */}
        <div className="flex-shrink-0">
          <Clock timeFormat={config.timeFormat} />
        </div>

        {/* Center spacer + NextEventBadge */}
        <div className="flex flex-1 items-center justify-center">
          {config.showNextEvent && <NextEventBadge events={events} />}
        </div>

        {/* Weather - right */}
        {config.showWeather && (
          <div className="flex-shrink-0">
            <WeatherWidget
              lat={config.weatherLat}
              lon={config.weatherLon}
              tempUnit={config.tempUnit}
              onSunsetIso={handleSunsetIso}
            />
          </div>
        )}
      </header>

      {/* Main content row */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar - grows to fill */}
        <main className="flex-1 overflow-hidden p-3">
          <CalendarView
            events={events}
            displayMode={config.displayMode}
            showWeekends={config.showWeekends}
            startHour={config.startHour}
            endHour={config.endHour}
            className="h-full"
          />
        </main>

        {/* Right panel - w-72 */}
        {(config.showAgendaRail || config.showRecentFiles) && (
          <aside className="flex w-72 flex-shrink-0 flex-col gap-4 overflow-hidden border-l border-white/5 bg-black/10 p-4">
            {config.showAgendaRail && (
              <div className="flex min-h-0 flex-1 flex-col">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Agenda
                </h2>
                <AgendaRail events={events} className="min-h-0 flex-1" />
              </div>
            )}

            {config.showRecentFiles && (
              <div className="flex-shrink-0 border-t border-white/5 pt-4">
                <RecentFilesWidget
                  files={recentFiles.slice(0, config.recentFilesCount)}
                  isLoading={recentFilesLoading}
                  fileOpenMode={config.fileOpenMode}
                />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Status bar */}
      <footer className="flex flex-shrink-0 items-center justify-between border-t border-white/5 bg-black/20 px-5 py-1.5">
        <img src="/logos/vrsi-icon-white.png" alt="VRSI" className="h-4 w-auto opacity-60" />
        <div className="flex items-center gap-4 text-[11px] text-slate-600">
          <button
            type="button"
            onClick={onOpenSettings}
            className="hover:text-slate-400 transition-colors"
            title="Open Settings"
          >
            Ctrl+S Settings
          </button>
          <span>|</span>
          <button
            type="button"
            onClick={onOpenFiles}
            className="hover:text-slate-400 transition-colors"
            title="Open Files"
          >
            Ctrl+F Files
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;

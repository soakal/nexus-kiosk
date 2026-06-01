import React from 'react';
import { CalendarEvent } from '../types/index';

interface AgendaRailProps {
  events: CalendarEvent[];
  className?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

interface GroupedEvent {
  event: CalendarEvent;
  isActive: boolean;
}

const AgendaRail: React.FC<AgendaRailProps> = ({ events, className = '' }) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const tomorrowEnd = addDays(todayStart, 2);

  const todayEvents: GroupedEvent[] = [];
  const tomorrowEvents: GroupedEvent[] = [];

  for (const ev of events) {
    const start = new Date(ev.startDateTime);
    const end = new Date(ev.endDateTime);

    if (isSameDay(start, now) || (ev.isAllDay && start >= todayStart && start < tomorrowStart)) {
      // Today's remaining (include all-day) - skip past non-all-day
      if (ev.isAllDay || end > now) {
        const isActive = !ev.isAllDay && start <= now && end > now;
        todayEvents.push({ event: ev, isActive });
      }
    } else if (start >= tomorrowStart && start < tomorrowEnd) {
      tomorrowEvents.push({ event: ev, isActive: false });
    }
  }

  // Sort: all-day first, then by start time
  const sortGroup = (group: GroupedEvent[]) =>
    group.sort((a, b) => {
      if (a.event.isAllDay && !b.event.isAllDay) return -1;
      if (!a.event.isAllDay && b.event.isAllDay) return 1;
      return new Date(a.event.startDateTime).getTime() - new Date(b.event.startDateTime).getTime();
    });

  sortGroup(todayEvents);
  sortGroup(tomorrowEvents);

  const renderEvent = ({ event, isActive }: GroupedEvent) => (
    <div
      key={event.id}
      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        isActive
          ? 'bg-white/10 ring-1 ring-white/20'
          : 'hover:bg-white/5'
      }`}
    >
      <span
        className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: event.calendarColor || '#3b82f6' }}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm leading-tight ${
            isActive ? 'font-semibold text-white' : 'font-medium text-slate-200'
          }`}
        >
          {event.subject}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {event.isAllDay
            ? 'All day'
            : `${formatTime(event.startDateTime)} – ${formatTime(event.endDateTime)}`}
          {event.location ? ` · ${event.location}` : ''}
        </p>
      </div>
      {isActive && (
        <span className="flex-shrink-0 rounded-full bg-blue-500/30 px-1.5 py-0.5 text-[10px] text-blue-300 font-medium">
          Now
        </span>
      )}
    </div>
  );

  const isEmpty = todayEvents.length === 0 && tomorrowEvents.length === 0;

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      <div className="overflow-y-auto flex-1 space-y-4 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {isEmpty && (
          <p className="text-sm text-slate-500 text-center py-4">No upcoming events</p>
        )}

        {todayEvents.length > 0 && (
          <section>
            <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Today
            </h3>
            <div className="space-y-0.5">
              {todayEvents.map(renderEvent)}
            </div>
          </section>
        )}

        {tomorrowEvents.length > 0 && (
          <section>
            <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Tomorrow
            </h3>
            <div className="space-y-0.5">
              {tomorrowEvents.map(renderEvent)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AgendaRail;

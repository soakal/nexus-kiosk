import React, { useMemo } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  Event as RBCEvent,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEvent } from '../types/index';

const locales = { 'en-US': enUS };

// Two localizers: Sun-start for full week, Mon-start for work_week / no-weekends.
const localizerSun = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const localizerMon = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface RBCCalendarEvent extends RBCEvent {
  resource: CalendarEvent;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  displayMode: 'day' | 'week' | 'month';
  showWeekends: boolean;
  startHour: number;
  endHour: number;
  className?: string;
  onSelectEvent?: (event: CalendarEvent) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  displayMode,
  showWeekends,
  startHour,
  endHour,
  className = '',
  onSelectEvent,
}) => {
  const rbcEvents = useMemo<RBCCalendarEvent[]>(
    () =>
      events.map((ev) => {
        const start = new Date(ev.startDateTime);
        let end = new Date(ev.endDateTime);
        // Graph API all-day events end at 00:00:00 the NEXT day (exclusive).
        // Subtract 1 ms so react-big-calendar keeps them inside the start-day
        // cell instead of bleeding into the following day's column.
        if (ev.isAllDay && end > start && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
          end = new Date(end.getTime() - 1);
        }
        return { title: ev.subject, start, end, allDay: ev.isAllDay, resource: ev };
      }),
    [events]
  );

  const minTime = useMemo(() => {
    const d = new Date();
    d.setHours(startHour, 0, 0, 0);
    return d;
  }, [startHour]);

  const maxTime = useMemo(() => {
    const d = new Date();
    d.setHours(endHour, 0, 0, 0);
    return d;
  }, [endHour]);

  const eventPropGetter = (event: RBCCalendarEvent) => {
    const color = event.resource.calendarColor || '#3b82f6';
    return {
      style: {
        backgroundColor: hexToRgba(color, 0.2),
        borderLeft: `3px solid ${color}`,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderRadius: '4px',
        color: '#e2e8f0',
        fontSize: '12px',
        padding: '1px 4px',
      },
    };
  };

  // In month view, dim (not hide) Sat/Sun so event positioning stays correct.
  // In week view we use work_week which natively excludes weekends — no CSS needed.
  const dayPropGetter = useMemo(
    () => (date: Date) => {
      if (!showWeekends && displayMode === 'month') {
        const day = date.getDay();
        if (day === 0 || day === 6) {
          return { className: 'rbc-weekend-dim' };
        }
      }
      return {};
    },
    [showWeekends, displayMode]
  );

  // Week view: use work_week (built-in 5-day view) when weekends are off.
  // This avoids CSS column-hiding which breaks multi-day event positioning.
  // Month view: always use 'month' — weekends are dimmed but columns stay intact.
  const rbcView: 'day' | 'week' | 'work_week' | 'month' =
    displayMode === 'week' && !showWeekends
      ? 'work_week'
      : displayMode === 'day'
      ? 'day'
      : displayMode === 'month'
      ? 'month'
      : 'week';

  const localizer = showWeekends ? localizerSun : localizerMon;

  // Only the month view dims weekends (week view uses work_week which drops
  // them entirely). When weekends are hidden we use the Mon-start localizer,
  // so the 7 columns are Mon..Sun → Saturday is col 6, Sunday is col 7.
  const weekendsHidden = !showWeekends && displayMode === 'month';

  return (
    <div
      className={`nexus-calendar-wrapper overflow-hidden rounded-xl bg-white/5 ${weekendsHidden ? 'weekends-hidden' : ''} ${className}`}
      style={{ height: '100%' }}
    >
      <style>{`
        .nexus-calendar-wrapper .rbc-calendar {
          background: transparent;
          color: #cbd5e1;
          height: 100%;
          font-size: 13px;
        }
        .nexus-calendar-wrapper .rbc-header {
          background: transparent;
          border-color: rgba(255,255,255,0.08);
          color: #94a3b8;
          font-weight: 500;
          padding: 6px 0;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
        }
        .nexus-calendar-wrapper .rbc-today {
          background: rgba(59,130,246,0.07) !important;
        }
        .nexus-calendar-wrapper .rbc-off-range-bg {
          background: rgba(0,0,0,0.15);
        }
        .nexus-calendar-wrapper .rbc-time-view,
        .nexus-calendar-wrapper .rbc-month-view {
          border-color: rgba(255,255,255,0.08);
          background: transparent;
        }
        .nexus-calendar-wrapper .rbc-time-header {
          background: transparent;
          border-color: rgba(255,255,255,0.08);
        }
        .nexus-calendar-wrapper .rbc-time-content {
          border-color: rgba(255,255,255,0.08);
        }
        .nexus-calendar-wrapper .rbc-time-slot {
          border-color: rgba(255,255,255,0.04);
        }
        .nexus-calendar-wrapper .rbc-timeslot-group {
          border-color: rgba(255,255,255,0.08);
        }
        .nexus-calendar-wrapper .rbc-day-slot .rbc-time-slot {
          border-color: rgba(255,255,255,0.04);
        }
        .nexus-calendar-wrapper .rbc-time-gutter .rbc-label {
          color: #475569;
          font-size: 11px;
        }
        .nexus-calendar-wrapper .rbc-current-time-indicator {
          background-color: #3b82f6;
          height: 2px;
        }
        .nexus-calendar-wrapper .rbc-current-time-indicator::before {
          background-color: #3b82f6;
        }
        .nexus-calendar-wrapper .rbc-event {
          outline: none;
        }
        .nexus-calendar-wrapper .rbc-event:focus {
          outline: none;
        }
        .nexus-calendar-wrapper .rbc-day-bg + .rbc-day-bg {
          border-color: rgba(255,255,255,0.08);
        }
        .nexus-calendar-wrapper .rbc-month-row + .rbc-month-row {
          border-color: rgba(255,255,255,0.08);
        }
        .nexus-calendar-wrapper .rbc-date-cell {
          color: #94a3b8;
          font-size: 12px;
        }
        .nexus-calendar-wrapper .rbc-date-cell.rbc-now {
          color: #60a5fa;
          font-weight: 600;
        }
        .nexus-calendar-wrapper .rbc-show-more {
          color: #60a5fa;
          background: transparent;
          font-size: 11px;
          cursor: pointer;
        }
        .rbc-overlay {
          background: #1e2536 !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 8px !important;
          padding: 8px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
          z-index: 200 !important;
          min-width: 200px !important;
          max-width: 320px !important;
        }
        .rbc-overlay-header {
          color: #94a3b8 !important;
          border-bottom: 1px solid rgba(255,255,255,0.08) !important;
          padding-bottom: 6px !important;
          margin-bottom: 6px !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          background: transparent !important;
        }
        .rbc-overlay .rbc-event {
          margin-bottom: 3px !important;
          cursor: pointer !important;
          color: #e2e8f0 !important;
          font-size: 12px !important;
        }
        .nexus-calendar-wrapper .rbc-toolbar {
          display: none;
        }
        .nexus-calendar-wrapper .rbc-allday-cell {
          border-color: rgba(255,255,255,0.08);
        }
        .nexus-calendar-wrapper .rbc-header + .rbc-header {
          border-color: rgba(255,255,255,0.08);
        }
        /* Month view: dim (not hide) weekend background cells.
           Hiding would shift multi-day event left/width calculations
           because RBC computes positions based on 7 columns. */
        .nexus-calendar-wrapper .rbc-day-bg.rbc-weekend-dim {
          background: rgba(0,0,0,0.35) !important;
        }
        /* Also dim the date number in weekend cells — only when weekends are
           hidden (month view). The Mon-start localizer used in that mode puts
           Saturday in column 6 and Sunday in column 7. The background dim is
           gated the same way via dayPropGetter's rbc-weekend-dim. */
        .weekends-hidden .rbc-month-row .rbc-date-cell:nth-child(6),
        .weekends-hidden .rbc-month-row .rbc-date-cell:nth-child(7) {
          opacity: 0.35;
        }
      `}</style>
      <Calendar
        key={`${showWeekends}-${displayMode}`}
        localizer={localizer}
        events={rbcEvents}
        view={rbcView}
        onView={() => {}}
        eventPropGetter={eventPropGetter}
        dayPropGetter={dayPropGetter}
        min={minTime}
        max={maxTime}
        style={{ height: '100%' }}
        popup
        onSelectEvent={(ev: RBCCalendarEvent) => onSelectEvent?.(ev.resource)}
        formats={{
          timeGutterFormat: (date: Date) =>
            format(date, 'h a').toLowerCase(),
          dayFormat: (date: Date) =>
            format(date, 'EEE d'),
          weekdayFormat: (date: Date) =>
            format(date, 'EEE'),
        }}
      />
    </div>
  );
};

export default CalendarView;

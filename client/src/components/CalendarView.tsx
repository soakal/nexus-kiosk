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

// When weekends are hidden we start the week on Monday (weekStartsOn: 1) so
// the calendar anchors correctly and Saturday/Sunday columns don't appear at
// the edges.  Both localizers are pre-built to avoid re-construction on render.
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
      events.map((ev) => ({
        title: ev.subject,
        start: new Date(ev.startDateTime),
        end: new Date(ev.endDateTime),
        allDay: ev.isAllDay,
        resource: ev,
      })),
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

  // Mark Sat (0=Sun,6=Sat in getDay) and Sun columns so the CSS rule below
  // can collapse them when showWeekends is false.
  const dayPropGetter = useMemo(
    () => (date: Date) => {
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      if (!showWeekends && (day === 0 || day === 6)) {
        return { className: 'rbc-hidden-weekend' };
      }
      return {};
    },
    [showWeekends]
  );

  const localizer = showWeekends ? localizerSun : localizerMon;

  const viewMap: Record<'day' | 'week' | 'month', 'day' | 'week' | 'month'> = {
    day: 'day',
    week: 'week',
    month: 'month',
  };

  return (
    <div
      className={`nexus-calendar-wrapper overflow-hidden rounded-xl bg-white/5 ${!showWeekends ? 'nexus-hide-weekends' : ''} ${className}`}
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
        /* Hide Saturday and Sunday columns when showWeekends=false.
           dayPropGetter injects rbc-hidden-weekend into rbc-day-bg and
           rbc-day-slot cells, but react-big-calendar does NOT propagate
           dayPropGetter className to the rbc-header row.  We scope the
           nth-child header rule to the nexus-hide-weekends wrapper class so
           it is only active when showWeekends is false.  Column order when
           the week starts on Monday: Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
           Sun=7. */
        .nexus-calendar-wrapper .rbc-day-bg.rbc-hidden-weekend,
        .nexus-calendar-wrapper .rbc-day-slot.rbc-hidden-weekend,
        .nexus-calendar-wrapper .rbc-time-column.rbc-hidden-weekend {
          display: none !important;
        }
        /* Header nth-child — scoped to .nexus-hide-weekends set on the
           wrapper when showWeekends=false */
        .nexus-hide-weekends .rbc-header:nth-child(6),
        .nexus-hide-weekends .rbc-header:nth-child(7) {
          display: none !important;
        }
      `}</style>
      <Calendar
        localizer={localizer}
        events={rbcEvents}
        view={viewMap[displayMode]}
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

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, addDays, formatISO } from 'date-fns';
import { getEvents } from '../api/calendarApi';
import type { CalendarEvent } from '../types/index';

export function useEvents(
  calendarIds: string[],
  enabled: boolean,
  refreshSec: number
): { events: CalendarEvent[]; isLoading: boolean; dataUpdatedAt: number } {
  const { weekStart, weekEnd } = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 0 });
    const end = addDays(start, 14);
    return {
      weekStart: formatISO(start),
      weekEnd: formatISO(end),
    };
  }, []);

  // Allow calendarIds to be empty — the server will fall back to all available
  // calendars. Guarding on length > 0 prevents events from ever loading when
  // the user hasn't explicitly picked calendars yet (the default config state).
  const safeCalendarIds = Array.isArray(calendarIds) ? calendarIds : [];

  const q = useQuery({
    queryKey: ['events', safeCalendarIds, weekStart],
    queryFn: () => getEvents(safeCalendarIds, new Date(weekStart), new Date(weekEnd)),
    enabled: enabled,
    refetchInterval: refreshSec * 1000,
  });

  return {
    // Ensure we always return an array even if the query returns something unexpected
    events: Array.isArray(q.data) ? q.data : [],
    isLoading: q.isLoading,
    dataUpdatedAt: q.dataUpdatedAt ?? 0,
  };
}

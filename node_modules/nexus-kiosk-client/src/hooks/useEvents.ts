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

  const q = useQuery({
    queryKey: ['events', calendarIds, weekStart],
    queryFn: () => getEvents(calendarIds, new Date(weekStart), new Date(weekEnd)),
    enabled: enabled && calendarIds.length > 0,
    refetchInterval: refreshSec * 1000,
  });

  return {
    events: q.data ?? [],
    isLoading: q.isLoading,
    dataUpdatedAt: q.dataUpdatedAt ?? 0,
  };
}

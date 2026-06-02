import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBoardJobs,
  getBoardConfig,
  updateBoardConfig,
  getBoardUsers,
  importJobsFile,
  importJobsJson,
  setJobStatus,
  setJobShipDate,
  addJobNote,
  deleteJobNote,
  getPresence,
  type PresenceMap,
} from '../api/boardApi';
import { DEFAULT_BOARD_CONFIG, Job, JobStatus, Actor } from '../types/board';

export function useBoardJobs() {
  const q = useQuery({
    queryKey: ['board', 'jobs'],
    queryFn: getBoardJobs,
    staleTime: 30000,
  });

  return {
    jobs: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error,
    refetch: q.refetch,
  };
}

export function useBoardConfig() {
  const q = useQuery({
    queryKey: ['board', 'config'],
    queryFn: getBoardConfig,
    staleTime: 60000,
  });

  return {
    config: q.data ?? DEFAULT_BOARD_CONFIG,
    isLoading: q.isLoading,
  };
}

export function useUpdateBoardConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateBoardConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', 'config'] }),
  });
}

export function useBoardUsers() {
  const q = useQuery({
    queryKey: ['board', 'users'],
    queryFn: getBoardUsers,
    staleTime: 60000,
  });

  return {
    users: q.data ?? [],
    isLoading: q.isLoading,
  };
}

export function useImportJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: File | Job[]) => {
      if (arg instanceof File) {
        return importJobsFile(arg);
      }
      return importJobsJson(arg);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['board', 'users'] });
    },
  });
}

export function useSetJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobNumber, status, actor }: { jobNumber: string; status: JobStatus; actor: Actor }) =>
      setJobStatus(jobNumber, status, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useSetJobShipDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobNumber, shipDateOverride, actor }: { jobNumber: string; shipDateOverride: string | null; actor: Actor }) =>
      setJobShipDate(jobNumber, shipDateOverride, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useAddJobNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobNumber, text, actor }: { jobNumber: string; text: string; actor: Actor }) =>
      addJobNote(jobNumber, text, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', 'jobs'] }),
    onError: () => {
      console.error('Failed to save note — server may be unavailable')
    },
  });
}

export function usePresence(): PresenceMap {
  const q = useQuery({
    queryKey: ['board', 'presence'],
    queryFn: getPresence,
    refetchInterval: 10000,
    staleTime: 0,
  });
  return q.data ?? {};
}

export function useDeleteJobNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobNumber, noteId, actor }: { jobNumber: string; noteId: string; actor: Actor }) =>
      deleteJobNote(jobNumber, noteId, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', 'jobs'] }),
    onError: () => {
      console.error('Failed to save note — server may be unavailable')
    },
  });
}

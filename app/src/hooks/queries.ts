// InfiniDrive — Centralized server-state via TanStack Query.
// Replaces the manual fetchData() + 4s polling loop in App.tsx with
// cacheable, refetchable queries. Mutations still live in the UI layer
// (they need toast feedback) and simply invalidate these queries on success.
import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AppConfig, BandwidthStats, BotStatus, FileItem, FolderGroup, FolderItem, StorageStats } from '../types';

export const queryKeys = {
  health: ['health'] as const,
  config: ['config'] as const,
  stats: ['stats'] as const,
  files: ['files'] as const,
  folders: ['folders'] as const,
  lockedFolders: ['lockedFolders'] as const,
  bots: ['bots'] as const,
  bandwidth: ['bandwidth'] as const,
  folderGroups: ['folderGroups'] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.getHealth(),
    retry: 4,
    retryDelay: 800,
    staleTime: 4000,
    refetchInterval: 5000, // keep sidecar liveness visible in the title bar
  });
}

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: () => api.getConfig(),
    enabled: true,
    staleTime: 10_000,
  });
}

export function useStats(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => api.getStats(),
    enabled,
    staleTime: 4000,
    refetchInterval: 8000,
  });
}

export function useFiles(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.files,
    queryFn: async (): Promise<FileItem[]> => {
      const res = await api.getFiles();
      return res.files ?? [];
    },
    enabled,
    staleTime: 4000,
  });
}

export function useFolders(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.folders,
    queryFn: async (): Promise<FolderItem[]> => {
      const res = await api.getFolders();
      return res.folders ?? [{ path: '/', name: 'Root' }];
    },
    enabled,
    staleTime: 4000,
  });
}

export function useLockedFolders(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.lockedFolders,
    queryFn: async (): Promise<string[]> => {
      const res = await api.getLockedFolders();
      return res.locked_folders ?? [];
    },
    enabled,
    staleTime: 4000,
  });
}

export function useBots(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bots,
    queryFn: async (): Promise<BotStatus[]> => {
      const res = await api.getBotsStatus();
      return res.bots ?? [];
    },
    enabled,
    staleTime: 4000,
  });
}

/** Daily bandwidth quota usage (Phase 6). */
export function useBandwidth(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.bandwidth,
    queryFn: (): Promise<BandwidthStats> => api.getBandwidth(),
    enabled,
    staleTime: 4000,
    refetchInterval: 10_000,
  });
}

/** User-defined folder groups (Phase 7). */
export function useFolderGroups(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.folderGroups,
    queryFn: async (): Promise<FolderGroup[]> => {
      const res = await api.listFolderGroups();
      return res.groups ?? [];
    },
    enabled,
    staleTime: 4000,
  });
}

/** Invalidate every cached query (used by pull-to-refresh / after mutations). */export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

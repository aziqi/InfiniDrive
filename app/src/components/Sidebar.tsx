// InfiniDrive - Sidebar navigation with folder groups, folder tree and storage stats
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquaresFour,
  FolderSimple,
  CloudArrowUp,
  Cpu,
  Gear,
  HardDrives,
  CheckCircle,
  Plus,
  Folders,
  FolderOpen,
  CaretDown,
  CaretRight,
  Trash,
  X
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { StorageStats } from '../types';
import { api } from '../api/client';
import { queryKeys, useFolderGroups } from '../hooks/queries';
import { useTranslation } from '../i18n/LanguageContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenUploadModal: () => void;
  stats: StorageStats | null;
  activeUploadsCount: number;
  authMode?: string;
  userConnected?: boolean;
  /** Folder Groups (Phase 7) - optional so existing usages keep working. */
  currentFolder?: string;
  onSelectFolder?: (folderPath: string) => void;
  onToast?: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

const GROUP_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenUploadModal,
  stats,
  activeUploadsCount,
  authMode = 'smart',
  userConnected = false,
  currentFolder = '/',
  onSelectFolder,
  onToast
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Folder Groups state (Phase 7)
  const groupsQuery = useFolderGroups(true);
  const groups = groupsQuery.data ?? [];
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  const normalizedCurrentFolder =
    !currentFolder || currentFolder === 'all' ? '/' : currentFolder;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const folderLabel = (path: string) => {
    if (!path || path === '/') return t('fm_breadcrumb_root');
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name || isSubmittingGroup) return;

    setIsSubmittingGroup(true);
    try {
      const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
      const res = await api.createFolderGroup(name, [normalizedCurrentFolder], color);
      setNewGroupName('');
      setIsCreatingGroup(false);
      if (res?.group?.id) {
        setExpandedGroups((prev) => ({ ...prev, [res.group.id]: true }));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderGroups });
      onToast?.('success', t('toast_group_created'), t('toast_group_created_msg', { name }));
    } catch (err: any) {
      onToast?.('error', 'Failed', err.response?.data?.detail || err.message);
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    try {
      await api.deleteFolderGroup(groupId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderGroups });
      onToast?.('info', t('toast_group_deleted'), t('toast_group_deleted_msg', { name: groupName }));
    } catch (err: any) {
      onToast?.('error', 'Failed', err.response?.data?.detail || err.message);
    }
  };

  const handleSelectFolder = (folderPath: string) => {
    if (onSelectFolder) {
      onSelectFolder(folderPath);
      onSelectTab('files');
    }
  };

  const navItems: { id: string; label: string; icon: any; badge?: any; badgeColor?: string }[] = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: SquaresFour },
    { id: 'files', label: t('nav_files'), icon: FolderSimple, badge: stats?.count },
    { 
      id: 'uploads', 
      label: t('nav_transfers'), 
      icon: CloudArrowUp, 
      badge: activeUploadsCount > 0 ? activeUploadsCount : undefined,
      badgeColor: 'bg-blue-500 text-white'
    },
    { 
      id: 'bots', 
      label: t('nav_bots'), 
      icon: Cpu,
      badge: stats ? `${stats.healthy_bot_count}/${stats.bot_count}` : undefined,
      badgeColor: stats && stats.healthy_bot_count > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
    },
    { id: 'settings', label: t('nav_settings'), icon: Gear }
  ];

  return (
    <aside className="w-60 h-full bg-[#090c15] border-r border-white/[0.06] flex flex-col justify-between select-none">
      {/* Upper Navigation */}
      <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto">
        {/* Upload Action Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenUploadModal}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white font-semibold text-xs tracking-tight shadow-lg shadow-blue-500/20 border border-white/10 cursor-pointer"
        >
          <Plus weight="bold" className="w-4 h-4" />
          <span>{t('nav_upload_btn')}</span>
        </motion.button>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarPill"
                    className="absolute inset-0 bg-blue-500/15 border border-blue-500/30 rounded-xl"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-2.5">
                  <Icon weight={isActive ? "fill" : "regular"} className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className={isActive ? 'font-semibold text-white' : ''}>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`relative z-10 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ${item.badgeColor || 'bg-white/10 text-slate-300'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Folder Groups (Phase 7) */}
        <div className="pt-3 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Folders weight="duotone" className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t('sidebar_groups')}
              </span>
            </div>
            <button
              onClick={() => {
                setIsCreatingGroup((prev) => !prev);
                setNewGroupName('');
              }}
              title={t('sidebar_new_group')}
              className="p-1 rounded-md text-slate-500 hover:text-blue-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              {isCreatingGroup ? <X className="w-3 h-3" /> : <Plus weight="bold" className="w-3 h-3" />}
            </button>
          </div>

          {/* Inline "New Group" form */}
          <AnimatePresence initial={false}>
            {isCreatingGroup && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateGroup();
                      if (e.key === 'Escape') setIsCreatingGroup(false);
                    }}
                    placeholder={t('sidebar_group_name')}
                    className="w-full bg-[#0a0c12] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:border-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 leading-snug">
                    {t('sidebar_group_add_current', { folder: folderLabel(normalizedCurrentFolder) })}
                  </p>
                  <button
                    onClick={handleCreateGroup}
                    disabled={!newGroupName.trim() || isSubmittingGroup}
                    className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {t('sidebar_new_group')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsible group list */}
          {groups.length === 0 ? (
            !isCreatingGroup && (
              <p className="px-1 text-[10px] text-slate-600 leading-snug">
                {t('sidebar_groups_empty')}
              </p>
            )
          ) : (
            <div className="space-y-1">
              {groups.map((group) => {
                const isExpanded = Boolean(expandedGroups[group.id]);
                return (
                  <div key={group.id} className="rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        {isExpanded
                          ? <CaretDown weight="bold" className="w-3 h-3 text-slate-500 shrink-0" />
                          : <CaretRight weight="bold" className="w-3 h-3 text-slate-500 shrink-0" />}
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: group.color || '#3b82f6' }}
                        />
                        <span className="text-[11px] font-semibold text-slate-300 truncate">{group.name}</span>
                        <span className="text-[9px] font-mono text-slate-600 shrink-0">
                          {group.folder_paths?.length || 0}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        title={t('sidebar_delete_group')}
                        className="p-1 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2 pb-2 space-y-0.5">
                            {(group.folder_paths?.length || 0) === 0 ? (
                              <p className="text-[10px] text-slate-600 pl-4">{t('sidebar_group_empty')}</p>
                            ) : (
                              group.folder_paths.map((path) => {
                                const isCurrent = normalizedCurrentFolder === path && currentTab === 'files';
                                return (
                                  <button
                                    key={`${group.id}-${path}`}
                                    onClick={() => handleSelectFolder(path)}
                                    title={path}
                                    className={`w-full flex items-center gap-1.5 pl-4 pr-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                                      isCurrent
                                        ? 'bg-blue-500/15 text-blue-300'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                                    }`}
                                  >
                                    <FolderOpen
                                      weight={isCurrent ? 'fill' : 'regular'}
                                      className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-blue-400' : 'text-slate-500'}`}
                                    />
                                    <span className="truncate">{folderLabel(path)}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Storage & Telegram info widget */}
      <div className="p-3.5 border-t border-white/[0.06] space-y-3">
        {/* Cloud Info Card */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HardDrives weight="duotone" className="w-4 h-4 text-blue-400" />
              <span className="text-[11px] font-semibold text-slate-300">Telegram Cloud</span>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              Infinite
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Total Uploaded:</span>
              <span className="text-white font-mono font-semibold">{formatBytes(stats?.total_size || 0)}</span>
            </div>
            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full w-[100%] rounded-full animate-pulse-glow" />
            </div>
          </div>
        </div>

        {/* Security and Mode badge */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle weight="fill" className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">
              {authMode === 'smart' 
                ? 'Dual Turbo Engine' 
                : authMode === 'personal_only' 
                ? 'MTProto Direct' 
                : 'Bot Cluster'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">v2.0</span>
        </div>
      </div>
    </aside>
  );
};
// InfiniDrive — Sidebar navigation with folder tree and storage stats
import React from 'react';
import { motion } from 'framer-motion';
import { 
  SquaresFour, 
  FolderSimple, 
  CloudArrowUp, 
  Cpu, 
  Gear, 
  HardDrives, 
  CheckCircle, 
  Plus
} from '@phosphor-icons/react';
import { StorageStats } from '../types';
import { useTranslation, TranslationKey } from '../i18n/LanguageContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenUploadModal: () => void;
  stats: StorageStats | null;
  activeUploadsCount: number;
  authMode?: string;
  userConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenUploadModal,
  stats,
  activeUploadsCount,
  authMode = 'smart',
  userConnected = false
}) => {
  const { t } = useTranslation();

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      <div className="p-3.5 space-y-3.5">
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

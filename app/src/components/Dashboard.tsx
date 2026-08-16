import React from 'react';
import { motion } from 'framer-motion';
import { 
  HardDrives, 
  Files, 
  Eye, 
  Cpu, 
  CloudArrowUp, 
  FileText, 
  FilmStrip, 
  MusicNotes, 
  Image as ImageIcon, 
  Archive, 
  ArrowUpRight, 
  Clock, 
  DownloadSimple, 
  Lightning,
  ShieldCheck,
  Globe,
  Sparkle
} from '@phosphor-icons/react';
import { FileItem, StorageStats, BotStatus } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface DashboardProps {
  stats: StorageStats | null;
  recentFiles: FileItem[];
  bots: BotStatus[];
  onOpenUpload: () => void;
  onNavigate: (tab: string) => void;
  onPreviewFile: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  recentFiles,
  bots,
  onOpenUpload,
  onNavigate,
  onPreviewFile,
  onDownloadFile
}) => {
  const { t } = useTranslation();

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mime: string, name: string) => {
    const lower = name.toLowerCase();
    if (mime.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(lower)) {
      return <ImageIcon weight="duotone" className="w-5 h-5 text-emerald-400" />;
    }
    if (mime.includes('video') || /\.(mp4|mkv|avi|mov|webm)$/i.test(lower)) {
      return <FilmStrip weight="duotone" className="w-5 h-5 text-blue-400" />;
    }
    if (mime.includes('audio') || /\.(mp3|wav|ogg|flac|m4a)$/i.test(lower)) {
      return <MusicNotes weight="duotone" className="w-5 h-5 text-purple-400" />;
    }
    if (mime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/i.test(lower)) {
      return <Archive weight="duotone" className="w-5 h-5 text-amber-400" />;
    }
    return <FileText weight="duotone" className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 bg-[#07090f]">
      {/* Top Banner / Welcome */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans">
              {t('dash_welcome_title')}
            </h1>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Lightning weight="fill" className="w-3 h-3 text-blue-400 animate-pulse" />
              Turbo MTProto
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('dash_welcome_sub')}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenUpload}
          className="btn-primary text-xs shadow-lg shadow-blue-500/25 cursor-pointer flex items-center gap-2 px-4 py-2.5"
        >
          <CloudArrowUp weight="bold" className="w-4 h-4" />
          <span>{t('dash_btn_upload')}</span>
        </motion.button>
      </div>

      {/* Bento 2.0 Grid Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        
        {/* Bento Item 1: Large Storage Radial Arc Gauge (Span 2) */}
        <div className="md:col-span-2 p-5 rounded-2xl glass-card relative overflow-hidden flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <HardDrives weight="duotone" className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400">{t('dash_total_storage')}</span>
                <div className="text-xl font-bold font-mono text-white tracking-tight">
                  {formatBytes(stats?.total_size || 0)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                Infinite Capacity
              </span>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                {stats?.count || 0} files indexed
              </div>
            </div>
          </div>

          {/* Animated Infinite Gradient Progress Track */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Telegram DC Storage
              </span>
              <span className="text-slate-300 font-semibold">0% Local Disk Used</span>
            </div>
            <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden p-[1px]">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                style={{ width: '100%', backgroundSize: '200% 200%' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.05] text-[11px]">
            <div className="p-2 rounded-lg bg-white/[0.02]">
              <span className="text-slate-500 block text-[10px]">{t('dash_active_cluster')}</span>
              <span className="font-mono font-bold text-slate-200">{stats?.healthy_bot_count || 0} / {stats?.bot_count || 0}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02]">
              <span className="text-slate-500 block text-[10px]">MTProto User</span>
              <span className="font-mono font-bold text-slate-200 truncate block">
                {stats?.user_account_connected ? `@${stats.user_profile?.username || 'Connected'}` : 'Offline'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02]">
              <span className="text-slate-500 block text-[10px]">{t('dash_bandwidth_views')}</span>
              <span className="font-mono font-bold text-slate-200">{stats?.total_views || 0}</span>
            </div>
          </div>
        </div>

        {/* Bento Item 2: Live Speed & Parallel Engine Status */}
        <div className="p-5 rounded-2xl glass-card flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Turbo Engine</span>
            <Lightning weight="fill" className="w-4 h-4 text-amber-400" />
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-extrabold font-mono text-white tracking-tight">
              12 Streams
            </div>
            <div className="text-[11px] text-slate-400">
              512KB MTProto Parallel Pipeline
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-2">
            <Sparkle weight="fill" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Zero TCP Stall · Zero-Copy Slicing</span>
          </div>

          <button
            onClick={() => onNavigate('settings')}
            className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            {t('nav_settings')} <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Bento Item 3: Quick Drag & Drop Action Card */}
        <div 
          onClick={onOpenUpload}
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[#0e1220] to-[#090c15] border border-blue-500/20 hover:border-blue-400/50 transition-all cursor-pointer group flex flex-col items-center justify-center text-center space-y-2.5"
        >
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/20"
          >
            <CloudArrowUp weight="duotone" className="w-6 h-6" />
          </motion.div>
          <div>
            <h3 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
              {t('fm_drop_title')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {t('fm_drop_sub')}
            </p>
          </div>
          <div className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Encrypted MTProto Transport
          </div>
        </div>
      </div>

      {/* Recent Files Section with Staggered Framer Motion Animation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock weight="duotone" className="w-4 h-4 text-blue-400" />
            {t('dash_recent_uploads')}
          </h2>
          <button
            onClick={() => onNavigate('files')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
          >
            {t('dash_view_all')} ({stats?.count || 0}) <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentFiles.length === 0 ? (
          <div className="p-10 rounded-2xl glass-card text-center space-y-2">
            <Files weight="duotone" className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">{t('dash_no_recent')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {recentFiles.slice(0, 8).map((file, index) => (
              <motion.div
                key={file.file_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.2 }}
                onClick={() => onPreviewFile(file)}
                className="glass-card p-3.5 rounded-xl cursor-pointer group flex flex-col justify-between space-y-3 spotlight-card"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] group-hover:border-blue-500/30 transition-colors shrink-0">
                    {getFileIcon(file.mime_type, file.file_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                      {file.file_name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {formatBytes(file.file_size)} · {new Date(file.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Eye className="w-3 h-3 text-slate-500" />
                    {file.view_count} views
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadFile(file);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                    title="Download"
                  >
                    <DownloadSimple weight="bold" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

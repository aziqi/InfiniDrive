// InfiniDrive  Custom draggable Windows 11 title bar with window controls
import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { useTranslation } from '../i18n/LanguageContext';

interface TitleBarProps {
  sidecarReady: boolean;
  activeBotsCount: number;
  userConnected?: boolean;
  userName?: string;
  authMode?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ 
  sidecarReady, 
  activeBotsCount,
  userConnected,
  userName,
  authMode = 'smart'
}) => {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setIsMaximized);
      const unsubscribe = window.electronAPI.onWindowStateChange((state) => {
        setIsMaximized(state.isMaximized);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = async () => {
    if (window.electronAPI) {
      const state = await window.electronAPI.maximizeWindow();
      setIsMaximized(state);
    }
  };
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <div className="h-10 w-full flex items-center justify-between px-3 bg-[#080b12] border-b border-white/[0.06] app-drag-region select-none z-50">
      {/* App Brand & Status */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center shadow-md shadow-blue-500/20 border border-white/10">
          <img src={logoImg} alt="InfiniDrive" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-tight text-white font-sans">
            Infini<span className="text-blue-400">Drive</span>
          </span>
          <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Turbo
          </span>
        </div>

        <div className="h-3.5 w-px bg-white/10 mx-1" />

        {/* Backend & Bot Status Pill */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px]">
          <span className={`w-2 h-2 rounded-full ${sidecarReady ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-slate-300 font-medium">
            {sidecarReady ? (
              <span className="flex items-center gap-1">
                {t('cluster_bots', { count: activeBotsCount, plural: activeBotsCount !== 1 ? 's' : '' })}
              </span>
            ) : (
              t('initializing_engine')
            )}
          </span>
        </div>

        {/* MTProto User Pill if connected */}
        {userConnected && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.7)]" />
            <span className="font-medium truncate max-w-[120px]">
              @{userName || 'Account'} (MTProto)
            </span>
          </div>
        )}
      </div>

      {/* Center status mode */}
      <div className="hidden md:flex items-center text-xs text-slate-400 font-medium tracking-tight">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2 animate-pulse" />
        <span>
          {authMode === 'smart' && (userConnected || activeBotsCount > 0)
            ? t('hybrid_turbo_active')
            : authMode === 'personal_only'
            ? t('personal_mtproto_mode')
            : t('bot_cluster_mode')}
        </span>
      </div>

      {/* Windows 11 Window Controls */}
      <div className="flex items-center app-no-drag">
        <button
          onClick={handleMinimize}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

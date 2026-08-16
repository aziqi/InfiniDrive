// InfiniDrive — Bot cluster manager: add, remove, and test bots
import React, { useState } from 'react';
import { 
  Cpu, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { BotStatus, AppConfig } from '../types';
import { api } from '../api/client';
import { ConfirmModal } from './ConfirmModal';
import { useTranslation } from '../i18n/LanguageContext';

interface BotManagerProps {
  bots: BotStatus[];
  config: AppConfig | null;
  onRefreshBots: () => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const BotManager: React.FC<BotManagerProps> = ({
  bots,
  config,
  onRefreshBots,
  onToast
}) => {
  const { t } = useTranslation();
  const [newToken, setNewToken] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [botToRemove, setBotToRemove] = useState<BotStatus | null>(null);

  const handleAddBot = async () => {
    const token = newToken.trim();
    if (!token) {
      onToast('warning', 'Token Required', 'Please enter a valid Telegram Bot API token.');
      return;
    }

    setIsAdding(true);
    try {
      const res = await api.addBot(token);
      setNewToken('');
      onToast(
        'success',
        'Bot Detected & Verified!',
        `@${res.bot?.username || 'Bot'} was automatically verified and integrated into the active cluster.`
      );
      onRefreshBots();
    } catch (err: any) {
      onToast('error', 'Auto-Detection Failed', err.response?.data?.detail || err.message || 'Telegram rejected this bot token.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleExecuteRemove = async () => {
    if (!botToRemove) return;
    try {
      await api.removeBot(botToRemove.token_hash || botToRemove.name);
      onToast('info', 'Bot Removed', `@${botToRemove.username || botToRemove.name} removed from cluster.`);
      setBotToRemove(null);
      onRefreshBots();
    } catch (err: any) {
      onToast('error', 'Error', err.message);
    }
  };

  const handleVerifyAll = async () => {
    setIsVerifying(true);
    try {
      const res = await api.verifyBots();
      onRefreshBots();
      const healthyCount = res.bots.filter((b: any) => b.healthy).length;
      onToast('success', 'Cluster Verified', `${healthyCount} of ${res.bots.length} bots are healthy and operational.`);
    } catch (err: any) {
      onToast('error', 'Verification Failed', err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 select-none bg-[#080a10]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            {t('bm_title')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('bm_subtitle')}
          </p>
        </div>

        <button
          onClick={handleVerifyAll}
          disabled={isVerifying}
          className="btn-secondary text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin text-blue-400' : ''}`} />
          <span>{t('bm_btn_verify_all')}</span>
        </button>
      </div>

      {/* Add Bot Card */}
      <div className="p-5 rounded-2xl bg-[#12141d] border border-white/5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-400" />
          {t('bm_card_add_title')}
        </h3>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="Paste bot token from @BotFather (e.g. 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ)"
              className="w-full bg-[#0a0c12] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <button
            onClick={handleAddBot}
            disabled={isAdding || !newToken.trim()}
            className="btn-primary text-xs shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{t('set_btn_add_node')}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{t('bm_admin_notice')}</span>
        </div>
      </div>

      {/* Bot Cluster List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-white">
          {t('set_bot_cluster_title', { count: bots.length, plural: bots.length !== 1 ? 's' : '' })}
        </h3>

        {bots.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#12141d] border border-white/5 text-center space-y-2">
            <Cpu className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">{t('bm_empty_bots')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {bots.map((bot, index) => (
              <div
                key={index}
                className="p-4 rounded-2xl bg-[#12141d] border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 rounded-xl border ${
                      bot.healthy 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white font-mono truncate">
                        @{bot.username || bot.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Token: {bot.token_masked || '******'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    bot.healthy 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {bot.healthy ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {bot.healthy ? 'Healthy' : 'Error'}
                  </span>
                </div>

                {bot.error && (
                  <p className="text-[10px] text-rose-400 bg-rose-950/20 p-2 rounded-lg border border-rose-500/20 truncate" title={bot.error}>
                    {bot.error}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  <span>Total Uploads: <strong className="text-white font-mono">{bot.uploads}</strong></span>
                  <button
                    onClick={() => setBotToRemove(bot)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove from cluster"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Remove Bot Modal */}
      <ConfirmModal
        isOpen={Boolean(botToRemove)}
        onClose={() => setBotToRemove(null)}
        onConfirm={handleExecuteRemove}
        title={t('modal_confirm_remove_bot_title')}
        message={t('modal_confirm_remove_bot_msg', { name: botToRemove?.username || botToRemove?.name || 'Bot' })}
        variant="warning"
        iconType="trash"
      />
    </div>
  );
};

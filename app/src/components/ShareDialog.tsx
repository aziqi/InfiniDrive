// InfiniDrive — Share dialog: create/copy a protected share link, set
// password + expiry, and revoke. Backend already mints share_token on
// upload; this dialog creates a managed share row for direct download links.
import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Share2, Copy, Check, Lock, Trash2, X, Calendar, Link2 } from 'lucide-react';
import { api } from '../api/client';
import { FileItem } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface ShareDialogProps {
  file: FileItem;
  onClose: () => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

interface ShareInfo {
  token: string;
  share_url: string;
  expires_at: string | null;
  is_protected: boolean;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ file, onClose, onToast }) => {
  const { t } = useTranslation();
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [expiresDays, setExpiresDays] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeShare = useCallback(async (args?: { password?: string; expiresDays?: number }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createShare(file.file_id, args);
      setShare({
        token: res.token,
        share_url: res.share_url,
        expires_at: res.expires_at,
        is_protected: res.is_protected,
      });
      setExpiresDays(args?.expiresDays ?? 0);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to create share';
      setError(msg);
      onToast('error', 'Share Failed', msg);
    } finally {
      setBusy(false);
    }
  }, [file.file_id, onToast]);

  useEffect(() => {
    if (file) {
      setShare(null);
      setPassword('');
      makeShare();
    }
  }, [file, makeShare]);

  const applyPassword = async () => {
    if (!share) return;
    if (!password.trim()) {
      onToast('warning', t('share_pw_empty'));
      return;
    }
    try {
      await api.revokeShare(share.token);
    } catch { /* ignore */ }
    await makeShare({ password: password.trim(), expiresDays });
    onToast('success', t('share_pw_set'));
  };

  const applyExpiry = async () => {
    if (!share) return;
    try {
      await api.revokeShare(share.token);
    } catch { /* ignore */ }
    await makeShare({ password: share.is_protected ? password || undefined : undefined, expiresDays });
    onToast('success', t('share_expiry_set'));
  };

  const copyLink = () => {
    if (!share) return;
    navigator.clipboard.writeText(share.share_url);
    setCopied(true);
    onToast('success', t('share_copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async () => {
    if (!share) return;
    try {
      await api.revokeShare(share.token);
      onToast('success', t('share_revoked'));
      onClose();
    } catch (e: any) {
      onToast('error', 'Revoke Failed', e?.message || String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border border-blue-500/25 shadow-2xl p-6 space-y-4 overflow-hidden z-10"
      >
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">{t('share_title')}</h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[240px]">{file.file_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Share link */}
        <div className="space-y-1.5 relative z-10">
          <label className="text-xs font-medium text-slate-300">{t('share_link_label')}</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#121524] border border-white/10 rounded-xl px-3 py-2.5 min-w-0">
              <Link2 className="w-4 h-4 text-blue-400 shrink-0" />
              <input
                readOnly
                value={share?.share_url || ''}
                className="bg-transparent text-xs text-slate-300 outline-none w-full truncate select-text"
              />
            </div>
            <button
              onClick={copyLink}
              disabled={!share}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5 relative z-10">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />{t('share_password_label')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('share_password_ph')}
              className="flex-1 bg-[#121524] border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
            />
            <button
              onClick={applyPassword}
              disabled={busy}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 disabled:opacity-40 cursor-pointer shrink-0"
            >
              {t('share_password_apply')}
            </button>
          </div>
        </div>

        {/* Expiry */}
        <div className="space-y-1.5 relative z-10">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />{t('share_expiry_label')}
          </label>
          <div className="flex items-center gap-2">
            <select
              value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value))}
              className="flex-1 bg-[#121524] border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value={0}>{t('share_expiry_never')}</option>
              <option value={1}>{t('share_expiry_1d')}</option>
              <option value={7}>{t('share_expiry_7d')}</option>
              <option value={30}>{t('share_expiry_30d')}</option>
            </select>
            <button
              onClick={applyExpiry}
              disabled={busy}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 disabled:opacity-40 cursor-pointer shrink-0"
            >
              {t('share_expiry_apply')}
            </button>
          </div>
        </div>

        {error && <p className="text-[11px] text-rose-400 relative z-10">{error}</p>}

        <div className="flex items-center justify-between gap-2.5 pt-2 relative z-10">
          <button
            onClick={revoke}
            disabled={!share || busy}
            className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs font-medium text-rose-300 border border-rose-500/20 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />{t('share_revoke')}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            {t('share_done')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

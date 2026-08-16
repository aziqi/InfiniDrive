import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash, 
  X, 
  Spinner, 
  FileText, 
  Image as ImageIcon, 
  FilmStrip, 
  MusicNotes, 
  Archive, 
  Lock, 
  ShieldWarning
} from '@phosphor-icons/react';
import { FileItem } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  file?: FileItem | null;
  bulkCount?: number;
  bulkFileNames?: string[];
  isDeleting?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mimeType?: string, fileName?: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <ImageIcon weight="duotone" className="w-5 h-5 text-emerald-400" />;
  }
  if (mimeType?.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
    return <FilmStrip weight="duotone" className="w-5 h-5 text-blue-400" />;
  }
  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
    return <MusicNotes weight="duotone" className="w-5 h-5 text-purple-400" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive weight="duotone" className="w-5 h-5 text-amber-400" />;
  }
  return <FileText weight="duotone" className="w-5 h-5 text-slate-400" />;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  file,
  bulkCount,
  bulkFileNames,
  isDeleting = false
}) => {
  const { t } = useTranslation();
  const isBulk = Boolean(bulkCount && bulkCount > 1);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isDeleting ? onClose : undefined}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border border-rose-500/25 shadow-2xl shadow-rose-950/60 p-6 overflow-hidden z-10"
          >
            {/* Ambient Danger Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between relative z-10 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500/20 to-red-600/10 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-900/30 shrink-0">
                  <Trash weight="duotone" className="w-6 h-6 text-rose-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {isBulk 
                      ? t('modal_delete_bulk_title', { count: bulkCount || 0 }) 
                      : t('modal_delete_single_title')}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {t('modal_delete_file_details')}
                  </p>
                </div>
              </div>

              {!isDeleting && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Target File Info Box */}
            <div className="relative z-10 my-4 p-3.5 rounded-xl bg-[#121524]/80 border border-white/5 space-y-2.5">
              {!isBulk && file ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {getFileIcon(file.mime_type, file.file_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 truncate" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatBytes(file.file_size)}
                      </span>
                      <span className="text-slate-600">•</span>
                      {file.upload_source === 'user_account' ? (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9px] font-mono">
                          👤 MTProto User
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[9px] font-mono">
                          🤖 Bot Cluster
                        </span>
                      )}
                      {Boolean(file.is_chunked) && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono">
                          {file.total_chunks || 'Multi'} Parts
                        </span>
                      )}
                      {file.password && (
                        <span className="flex items-center gap-0.5 text-amber-400 text-[10px]">
                          <Lock weight="bold" className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Total Files:</span>
                    <span className="font-bold text-white font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {bulkCount} Files
                    </span>
                  </div>
                  {bulkFileNames && bulkFileNames.length > 0 && (
                    <div className="max-h-24 overflow-y-auto space-y-1 pt-1 pr-1 text-[11px] text-slate-400 font-mono">
                      {bulkFileNames.slice(0, 5).map((name, idx) => (
                        <div key={idx} className="truncate flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400/60 shrink-0" />
                          <span className="truncate">{name}</span>
                        </div>
                      ))}
                      {bulkFileNames.length > 5 && (
                        <p className="text-[10px] text-slate-500 italic pl-3">
                          + {bulkFileNames.length - 5} more files...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Warning Banner */}
            <div className="relative z-10 p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 flex items-start gap-2.5 mb-5">
              <ShieldWarning weight="fill" className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-200/90 leading-relaxed">
                {t('modal_delete_warning')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 relative z-10">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {t('modal_btn_cancel')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={onConfirm}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Spinner weight="bold" className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('modal_deleting_progress')}</span>
                  </>
                ) : (
                  <>
                    <Trash weight="bold" className="w-3.5 h-3.5" />
                    <span>{t('modal_btn_delete_confirm')}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

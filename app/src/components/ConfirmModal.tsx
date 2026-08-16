// InfiniDrive  Dark glassmorphic confirmation modal for destructive actions
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash, 
  Warning, 
  Info, 
  CheckCircle, 
  X, 
  SignOut,
  Spinner
} from '@phosphor-icons/react';
import { useTranslation } from '../i18n/LanguageContext';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  iconType?: 'trash' | 'warning' | 'logout' | 'info' | 'check';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'warning',
  iconType,
  isLoading = false
}) => {
  const { t } = useTranslation();

  const getIcon = () => {
    if (iconType === 'trash' || variant === 'danger') {
      return <Trash weight="duotone" className="w-6 h-6 text-rose-400 animate-pulse" />;
    }
    if (iconType === 'logout') {
      return <SignOut weight="duotone" className="w-6 h-6 text-amber-400" />;
    }
    if (iconType === 'check' || variant === 'success') {
      return <CheckCircle weight="duotone" className="w-6 h-6 text-emerald-400" />;
    }
    if (variant === 'info') {
      return <Info weight="duotone" className="w-6 h-6 text-blue-400" />;
    }
    return <Warning weight="duotone" className="w-6 h-6 text-amber-400" />;
  };

  const getStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          glow: 'bg-rose-600/20 shadow-rose-950/60 border-rose-500/25',
          iconBox: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          btnConfirm: 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30 text-white'
        };
      case 'warning':
        return {
          glow: 'bg-amber-600/20 shadow-amber-950/60 border-amber-500/25',
          iconBox: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          btnConfirm: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/30 text-white'
        };
      case 'success':
        return {
          glow: 'bg-emerald-600/20 shadow-emerald-950/60 border-emerald-500/25',
          iconBox: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          btnConfirm: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30 text-white'
        };
      case 'info':
      default:
        return {
          glow: 'bg-blue-600/20 shadow-blue-950/60 border-blue-500/25',
          iconBox: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
          btnConfirm: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30 text-white'
        };
    }
  };

  const styles = getStyles();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isLoading ? onClose : undefined}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border shadow-2xl p-6 overflow-hidden z-10 space-y-4 ${styles.glow}`}
          >
            {/* Ambient Background Glow */}
            <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${variant === 'danger' ? 'bg-rose-600/15' : 'bg-amber-600/15'}`} />

            {/* Header */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-lg shrink-0 ${styles.iconBox}`}>
                  {getIcon()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{message}</p>
                </div>
              </div>

              {!isLoading && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 relative z-10 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {cancelText || t('modal_btn_cancel')}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-50 ${styles.btnConfirm}`}
              >
                {isLoading ? (
                  <>
                    <Spinner className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmText || t('modal_btn_proceed')}</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

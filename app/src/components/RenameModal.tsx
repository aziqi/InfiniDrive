import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilSimple, X, Check, FileText, Spinner } from '@phosphor-icons/react';
import { FileItem } from '../types';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  onSave: (newName: string) => Promise<void> | void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  file,
  onSave
}) => {
  const [value, setValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (file) {
      setValue(file.file_name);
    }
  }, [file]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || value.trim() === file?.file_name) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(value.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && file && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isSaving ? onClose : undefined}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border border-blue-500/25 shadow-2xl shadow-blue-950/60 p-6 overflow-hidden z-10"
          >
            {/* Ambient Blue Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between relative z-10 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-900/30 shrink-0">
                  <PencilSimple weight="duotone" className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ubah Nama File</h3>
                  <p className="text-xs text-slate-400 font-medium">Ganti nama tampilan file di Telegram Cloud</p>
                </div>
              </div>

              {!isSaving && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Nama File Baru</label>
                <div className="relative">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-[#121524] border border-white/10 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-medium transition-all shadow-inner"
                    autoFocus
                    placeholder="Masukkan nama file baru..."
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Ekstensi file disarankan tetap dipertahankan agar dapat dibuka normal.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !value.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Spinner weight="bold" className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check weight="bold" className="w-3.5 h-3.5" />
                      <span>Simpan Nama</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// InfiniDrive  Turbo Upload Modal with live speedometer and minimizable floating dock
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CloudArrowUp, 
  X, 
  FileText, 
  Lock, 
  Calendar, 
  CheckCircle, 
  WarningCircle, 
  Spinner, 
  Plus, 
  Trash,
  HardDrives,
  Terminal,
  CaretDown,
  CaretUp,
  Pulse,
  Lightning,
  Timer,
  Folder,
  Folders,
  Minus,
  ArrowsOutSimple
} from '@phosphor-icons/react';
import { UploadQueueItem, ActivityLogItem } from '../types';
import { api } from '../api/client';
import { useTranslation } from '../i18n/LanguageContext';
import { scanDataTransferItems, scanSelectedFiles, ScannedFileItem } from '../utils/fileScanner';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  initialFiles?: File[];
  initialItems?: ScannedFileItem[];
  currentFolder?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onToast,
  initialFiles,
  initialItems,
  currentFolder = '/'
}) => {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [targetFolder, setTargetFolder] = useState<string>(currentFolder === 'all' ? '/' : currentFolder);
  const [expirationDays, setExpirationDays] = useState<number | undefined>(undefined);
  const [password, setPassword] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [isLogsExpanded, setIsLogsExpanded] = useState(true);
  const [appConfig, setAppConfig] = useState<any>(null);
  
  // Real-time speedometer state
  const [currentSpeedNum, setCurrentSpeedNum] = useState<number>(0);
  const [currentSpeedStr, setCurrentSpeedStr] = useState<string>('0.00 MB/s');
  const [peakSpeedStr, setPeakSpeedStr] = useState<string>('0.00 MB/s');
  const [currentEtaStr, setCurrentEtaStr] = useState<string>('--');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      api.getConfig().then(cfg => setAppConfig(cfg)).catch(() => {});
    }
  }, [isOpen]);

  // Poll backend activity logs and parse live cloud upload speed & ETA
  useEffect(() => {
    let interval: any = null;
    let lastTimestamp = 0;

    const fetchLogs = async () => {
      try {
        const res = await api.getLogs(lastTimestamp);
        if (res && res.logs && res.logs.length > 0) {
          setLogs(prev => {
            const existingIds = new Set(prev.map(l => l.id));
            const newItems = res.logs.filter((l: any) => !existingIds.has(l.id));
            if (newItems.length === 0) return prev;
            return [...prev, ...newItems].slice(-250);
          });
          lastTimestamp = res.logs[res.logs.length - 1].timestamp;

          for (const log of res.logs) {
            if (log.tag === 'PROGRESS' || log.tag === 'CHUNK') {
              const fileMatch = log.message.match(/\[(.*?)\]\s*(.*)/);
              if (fileMatch) {
                const targetFileName = fileMatch[1];
                const rest = fileMatch[2];

      const speedMatch = rest.match(/([0-9.]+)\s*MB\/s/i);
                if (speedMatch) {
                  const sVal = parseFloat(speedMatch[1]);
                  setCurrentSpeedNum(sVal);
                  setCurrentSpeedStr(`${sVal.toFixed(2)} MB/s`);
                }

                const peakMatch = rest.match(/Peak:\s*([0-9.]+\s*MB\/s)/i);
                if (peakMatch) {
                  setPeakSpeedStr(peakMatch[1]);
                }

                const etaMatch = rest.match(/ETA\s*([0-9a-z\s]+)$/i);
                if (etaMatch) {
                  setCurrentEtaStr(etaMatch[1].trim());
                }

                const progressMatch = rest.match(/([0-9.]+\s*[KMGT]?B\s*\/\s*[0-9.]+\s*[KMGT]?B)\s*\(([0-9]+)%\)/i);
                if (progressMatch) {
                  const transferred = progressMatch[1];
                  const pct = parseInt(progressMatch[2], 10);

                  setQueue(prev => prev.map(q => {
                    if (q.name === targetFileName && q.status === 'uploading') {
                      return {
                        ...q,
                        cloudProgress: pct,
                        cloudSpeed: `${currentSpeedNum.toFixed(2)} MB/s`,
                        cloudEta: currentEtaStr,
                        cloudTransferred: transferred
                      };
                    }
                    return q;
                  }));
                }
              }
            }
          }
        }
      } catch (e) {
        // silent fail
      }
    };

    if (isOpen) {
      fetchLogs();
      interval = setInterval(fetchLogs, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, isUploading, currentSpeedNum, currentEtaStr]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isLogsExpanded]);

  React.useEffect(() => {
    if (isOpen) {
      setTargetFolder(currentFolder === 'all' ? '/' : currentFolder);
      if (initialItems && initialItems.length > 0) {
        const newItems: UploadQueueItem[] = initialItems.map((item) => ({
          id: Math.random().toString(36).substring(2, 9),
          file: item.file,
          name: item.name,
          size: item.size,
          progress: 0,
          status: 'pending',
          relativeFolder: item.relativeFolder
        }));
        setQueue(newItems);
      } else if (initialFiles && initialFiles.length > 0) {
        const newItems: UploadQueueItem[] = initialFiles.map((f) => ({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          name: f.name,
          size: f.size,
          progress: 0,
          status: 'pending'
        }));
        setQueue(newItems);
      }
    } else {
      setQueue([]);
      setCurrentSpeedNum(0);
    }
  }, [isOpen, initialFiles, initialItems, currentFolder]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const addScannedItems = (items: ScannedFileItem[]) => {
    const newItems: UploadQueueItem[] = items.map((item) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: item.file,
      name: item.name,
      size: item.size,
      progress: 0,
      status: 'pending',
      relativeFolder: item.relativeFolder
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      setIsScanning(true);
      try {
        const scanned = await scanDataTransferItems(e.dataTransfer);
        if (scanned.length > 0) {
          addScannedItems(scanned);
          onToast('info', 'Items Added', `Added ${scanned.length} files to queue.`);
        }
      } catch (err: any) {
        onToast('error', 'Drop Error', err.message);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const startUpload = async () => {
    if (queue.length === 0) {
      onToast('warning', 'No Files Selected', 'Please select or drop files/folders to upload.');
      return;
    }

    setIsUploading(true);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === 'completed') continue;

      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading' } : q));

      // Calculate final target folder (including subfolders from dropped directory)
      let destinationFolder = targetFolder === 'all' ? '/' : targetFolder;
      if (item.relativeFolder) {
        destinationFolder = destinationFolder === '/' 
          ? item.relativeFolder 
          : `${destinationFolder}${item.relativeFolder}`;
      }

      try {
        const res = await api.uploadFile(item.file, {
          expirationDays,
          password: password.trim() || undefined,
          folder: destinationFolder,
          onProgress: (percent, speed) => {
            const speedFormatted = speed > 0 ? `${formatBytes(speed)}/s` : '';
            setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: percent, speed: speedFormatted } : q));
          }
        });

        setQueue(prev => prev.map((q, idx) => idx === i ? { 
          ...q, 
          status: 'completed', 
          progress: 100, 
          file_id: res.file_id, 
          direct_link: res.direct_link, 
          share_link: res.share_link 
        } : q));

        // Windows Native Notification
        if (window.electronAPI?.showNotification) {
          window.electronAPI.showNotification({
            title: 'InfiniDrive - Upload Complete',
            body: `"${item.name}" (${formatBytes(item.size)}) saved to Telegram Cloud.`
          });
        }

      } catch (err: any) {
        console.error('Upload failed:', err);
        const errMsg = err.response?.data?.detail || err.message || 'Upload error';
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', error: errMsg } : q));

        if (window.electronAPI?.showNotification) {
          window.electronAPI.showNotification({
            title: 'InfiniDrive - Upload Notice',
            body: `Failed to upload "${item.name}": ${errMsg}`
          });
        }
      }
    }

    setIsUploading(false);
    onUploadSuccess();
    onToast('success', 'Upload Batch Finished', 'All queued items have been processed.');
  };

  const allCompleted = queue.length > 0 && queue.every(q => q.status === 'completed');
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const currentUploadingItem = queue.find(q => q.status === 'uploading') || queue.find(q => q.status === 'pending');
  const totalBytes = queue.reduce((acc, q) => acc + q.size, 0);
  const uploadedBytes = queue.reduce((acc, q) => acc + (q.status === 'completed' ? q.size : q.status === 'uploading' ? (q.size * (q.progress || 0) / 100) : 0), 0);
  const overallProgress = totalBytes > 0 ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)) : 0;

  // SVG Speedometer calculation (0 to 60 MB/s gauge scale)
  const maxScaleMB = 60;
  const speedRatio = Math.min(1, currentSpeedNum / maxScaleMB);

  if (!isOpen && !isUploading && queue.length === 0) {
    return null;
  }

  // Floating Minimized Dock at Bottom Right
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 select-none pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.92 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="w-84 md:w-96 bg-[#0c0f1a]/95 backdrop-blur-2xl border border-blue-500/35 rounded-2xl shadow-2xl shadow-blue-950/80 p-3.5 flex flex-col gap-2.5 overflow-hidden relative"
        >
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />

          {/* Header Row */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                {isUploading ? (
                  <Spinner weight="bold" className="w-4 h-4 text-blue-400 animate-spin" />
                ) : allCompleted ? (
                  <CheckCircle weight="fill" className="w-4 h-4 text-emerald-400" />
                ) : (
                  <CloudArrowUp weight="bold" className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">
                  {currentUploadingItem ? currentUploadingItem.name : allCompleted ? 'Upload Selesai' : 'Upload Queue'}
                </h4>
                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span>{completedCount}/{queue.length} files</span>
                  {isUploading && (
                <span className="text-blue-400 font-semibold">{currentSpeedStr}</span>
                  )}
                  {currentEtaStr !== '--' && isUploading && (
                <span className="text-purple-300 font-semibold">• {currentEtaStr}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 relative z-10">
              <button
                onClick={() => setIsMinimized(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Buka / Maksimalkan Window"
              >
                <ArrowsOutSimple weight="bold" className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (!isUploading || allCompleted) {
                    setIsMinimized(false);
                    onClose();
                  } else {
                    onToast('info', 'Upload Berjalan', 'Upload sedang berlangsung di latar belakang.');
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Tutup Dock"
              >
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 relative z-10">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">
                {isUploading && currentUploadingItem
                  ? `${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)}`
                  : allCompleted
                  ? 'Tersimpan aman di Telegram Cloud'
                  : 'Siap Unggah'}
              </span>
              <span className="text-emerald-400 font-bold">{overallProgress}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                style={{ width: `${overallProgress}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-[#0c0f18] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-[#080b12]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <CloudArrowUp weight="bold" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                InfiniDrive Turbo Transfer
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-semibold border border-blue-500/30">
            {appConfig?.auth_mode === 'personal_only' ? 'MTProto Direct' : 'Bot Cluster'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Destination: <span className="font-mono text-slate-300 font-semibold">{targetFolder === 'all' ? '/' : targetFolder}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Minimize Button */}
            <button 
              onClick={() => {
                setIsMinimized(true);
                if (isUploading) {
                  onToast('info', 'Upload Diminimize', 'Upload tetap berjalan di latar belakang. Klik dock di pojok kanan bawah untuk membuka kembali.');
                }
              }}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Minimize ke Floating Dock"
            >
              <Minus weight="bold" className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button 
              onClick={() => {
                if (isUploading) {
                  setIsMinimized(true);
                  onToast('info', 'Upload Diminimize', 'Upload tetap berjalan di latar belakang.');
                } else {
                  onClose();
                }
              }}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup Window"
            >
              <X weight="bold" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[calc(85vh-130px)]">
          {/* Live Speedometer Widget */}
          {isUploading && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/25 flex items-center justify-between shadow-xl shadow-blue-950/40 relative overflow-hidden"
            >
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-blue-400"
                      strokeDasharray="100, 100"
                      strokeDashoffset={100 - (speedRatio * 100)}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <Lightning weight="fill" className="w-5 h-5 text-blue-400 absolute animate-pulse" />
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Live Throughput</span>
                  <div className="text-xl font-black font-mono text-white tracking-tight text-gradient">
                     {currentSpeedStr}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right">
                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[9px] font-mono uppercase text-slate-500 block">Peak Speed</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{peakSpeedStr}</span>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[9px] font-mono uppercase text-slate-500 block">Est. Time Remaining</span>
                <span className="text-purple-300 font-semibold">• {currentEtaStr}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Dropzone with Folder & File Dual Upload Support */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="p-6 border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-2xl bg-white/[0.02] hover:bg-blue-500/[0.02] flex flex-col items-center justify-center text-center transition-all group"
          >
            {/* Hidden File Input */}
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => e.target.files && addScannedItems(scanSelectedFiles(e.target.files))}
              className="hidden"
            />
            {/* Hidden Folder Input (Directory Picker) */}
            <input
              type="file"
              ref={folderInputRef}
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={(e) => e.target.files && addScannedItems(scanSelectedFiles(e.target.files))}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-3 border border-blue-500/20">
              {isScanning ? (
                <Spinner weight="bold" className="w-6 h-6 animate-spin text-blue-400" />
              ) : (
                <CloudArrowUp weight="bold" className="w-6 h-6" />
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
              {isScanning ? 'Scanning directory structure...' : 'Drag & Drop Files or Entire Folders Here'}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md">
              Full directory tree preservation, unlimited batch uploads, automatic chunking & parallel Telegram streams.
            </p>

            {/* Action Buttons: Browse Files vs Browse Folder */}
            <div className="flex items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Plus weight="bold" className="w-3.5 h-3.5" />
                <span>Select Files</span>
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Folders weight="duotone" className="w-3.5 h-3.5 text-amber-400" />
                <span>Select Folder</span>
              </button>
            </div>
          </div>

          {/* Upload Options: Password & Expiration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock weight="duotone" className="w-3.5 h-3.5 text-amber-400" />
                Password Protection (Optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for public stream"
                className="w-full bg-[#080b12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 outline-none select-text"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Calendar weight="duotone" className="w-3.5 h-3.5 text-rose-400" />
                Auto-Expire (Optional)
              </label>
              <select
                value={expirationDays || ''}
                onChange={(e) => setExpirationDays(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-[#080b12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="">Never Expire (Keep forever)</option>
                <option value="1">1 Day</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
              </select>
            </div>
          </div>

          {/* Queue List */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-slate-300">
                    File Queue ({queue.length})
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Total: {formatBytes(queue.reduce((acc, q) => acc + q.size, 0))}
                  </span>
                </div>
                <button
                  onClick={() => setQueue([])}
                  disabled={isUploading}
                  className="text-[11px] text-rose-400 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  Clear Queue
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {queue.map((item) => {
                  const threshold = (appConfig?.smart_threshold_mb || 20) * 1024 * 1024;
                  const authMode = appConfig?.auth_mode || 'smart';
                  const isPersonal = authMode === 'personal_only' || (authMode === 'smart' && item.size > threshold && appConfig?.has_session);

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs transition-all hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText weight="duotone" className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200 truncate" title={item.name}>{item.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono shrink-0">({formatBytes(item.size)})</span>
                            </div>
                            {item.relativeFolder && (
                              <div className="flex items-center gap-1 text-[10px] text-blue-300/80 font-mono mt-0.5">
                                <Folder weight="duotone" className="w-3 h-3 text-blue-400 shrink-0" />
                                <span className="truncate">{item.relativeFolder}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Engine Route Badge */}
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            isPersonal 
                              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' 
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          }`}>
                            {isPersonal ? 'MTProto' : 'Cluster'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'completed' && (
                            <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                              <CheckCircle weight="fill" className="w-3.5 h-3.5" /> Uploaded
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <div className="flex items-center gap-1.5">
                              <Spinner weight="bold" className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                              <span className="text-[11px] font-bold font-mono text-blue-400">
                                {item.cloudProgress !== undefined && item.cloudProgress > 0 
                                  ? `${item.cloudProgress}%` 
                                  : item.progress < 100 
                                    ? `${item.progress}%` 
                                    : 'Transmitting...'}
                              </span>
                            </div>
                          )}
                          {item.status === 'error' && (
                            <span className="flex items-center gap-1 text-rose-400 text-[11px] bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg" title={item.error}>
                              <WarningCircle weight="fill" className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                          {item.status === 'pending' && !isUploading && (
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                            >
                              <Trash weight="bold" className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Speed Meter & ETA Stats Row */}
                      {item.status === 'uploading' && (
                        <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] flex-wrap">
                          <div className="flex items-center gap-2">
                            {(item.cloudSpeed || item.speed) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[10px]">
                                <Lightning weight="fill" className="w-3 h-3" />
                                {item.cloudSpeed || item.speed}
                              </span>
                            )}
                            {item.cloudEta && item.cloudEta !== '--' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-[10px]">
                                <Timer weight="bold" className="w-3 h-3" />
                                ETA: {item.cloudEta}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.cloudTransferred || (item.progress < 100 ? `${formatBytes(item.size * (item.progress / 100))} / ${formatBytes(item.size)}` : 'Streaming to Telegram...')}
                          </span>
                        </div>
                      )}

                      {/* Progress bar */}
                      {item.status === 'uploading' && (
                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden p-0.5">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"
                            style={{ 
                              width: `${
                                item.cloudProgress !== undefined && item.cloudProgress > 0 
                                  ? Math.max(2, item.cloudProgress) 
                                  : item.progress < 100 
                                    ? Math.max(2, item.progress) 
                                    : 100
                              }%` 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Activity Feed / Console */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal weight="bold" className="w-3.5 h-3.5 text-emerald-400" />
                <h4 className="text-xs font-semibold text-slate-300">
                  Engine Activity Logs
                </h4>
                {isUploading ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 animate-pulse font-mono">
                    LIVE
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">IDLE</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {logs.length > 0 && (
                  <button
                    onClick={async () => {
                      await api.clearLogs();
                      setLogs([]);
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
                >
                  {isLogsExpanded ? <CaretUp weight="bold" className="w-3.5 h-3.5" /> : <CaretDown weight="bold" className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isLogsExpanded && (
              <div
                ref={logContainerRef}
                className="bg-[#05070c] border border-white/[0.08] rounded-xl p-3 max-h-36 min-h-[80px] overflow-y-auto font-mono text-[10.5px] space-y-1.5 select-text"
              >
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-slate-600 text-center gap-1 select-none">
                    <Pulse weight="duotone" className="w-5 h-5 opacity-40 mb-1 text-slate-500" />
                    <p className="text-[11px] text-slate-400">Turbo engine ready</p>
                  </div>
                ) : (
                  logs.map((log) => {
                    let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                    if (log.tag === 'SUCCESS') badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    if (log.tag === 'ERROR') badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    if (log.tag === 'WARN') badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    if (log.tag === 'PROGRESS') badgeColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';

                    return (
                      <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-white/[0.02] p-0.5 rounded transition">
                        <span className="text-slate-600 shrink-0 select-none">[{log.time_str}]</span>
                        <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold tracking-wider shrink-0 ${badgeColor}`}>
                          {log.tag}
                        </span>
                        <span className={`break-all ${
                          log.level === 'success' ? 'text-emerald-300 font-semibold' :
                          log.level === 'error' ? 'text-rose-400 font-semibold' :
                          log.level === 'warning' ? 'text-amber-300' :
                          'text-slate-300'
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/[0.06] bg-[#080b12] flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <HardDrives weight="duotone" className="w-3.5 h-3.5 text-blue-400" />
            <span>InfiniDrive encrypted storage pipeline</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {allCompleted ? 'Close' : 'Cancel'}
            </button>

            <button
              onClick={startUpload}
              disabled={isUploading || queue.length === 0 || allCompleted}
              className="btn-primary text-xs px-5 py-2.5 shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Spinner weight="bold" className="w-4 h-4 animate-spin" />
                  <span>Uploading Queue...</span>
                </>
              ) : allCompleted ? (
                <>
                  <CheckCircle weight="fill" className="w-4 h-4" />
                  <span>All Uploaded</span>
                </>
              ) : (
                <>
                  <CloudArrowUp weight="bold" className="w-4 h-4" />
                  <span>Start Upload ({queue.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

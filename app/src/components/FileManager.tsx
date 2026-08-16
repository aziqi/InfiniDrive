import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  RefreshCw, 
  Trash2, 
  Download, 
  Copy, 
  Eye, 
  MoreVertical, 
  Edit3, 
  FileText, 
  Film, 
  Music, 
  Image as ImageIcon, 
  Archive, 
  Lock, 
  Unlock,
  UploadCloud,
  Check,
  Folder,
  FolderPlus,
  ChevronRight,
  FolderInput,
  X,
  Play,
  Box,
  CheckSquare,
  Square,
  Sparkles,
  Shield,
  Key,
  Layers
} from 'lucide-react';
import { FileCategory, FileItem, FolderItem, SortField, SortOrder } from '../types';
import { api } from '../api/client';
import { useTranslation } from '../i18n/LanguageContext';
import { scanDataTransferItems, ScannedFileItem } from '../utils/fileScanner';
import { ConfirmModal } from './ConfirmModal';

interface FileManagerProps {
  files: FileItem[];
  folders: FolderItem[];
  currentFolder: string;
  lockedFolders?: string[];
  unlockedFolders?: Set<string>;
  onSelectFolder: (folderPath: string) => void;
  onCreateFolder: (folderPath: string) => Promise<void>;
  onLockFolder?: (folderPath: string, password: string) => Promise<void>;
  onUnlockFolder?: (folderPath: string) => Promise<void>;
  onVerifyFolderPassword?: (folderPath: string, password: string) => Promise<boolean>;
  isLoading: boolean;
  onRefresh: () => void;
  onPreview: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onBulkDelete: (fileIds: string[]) => Promise<void>;
  onMoveFiles: (fileIds: string[], targetFolder: string) => Promise<void>;
  onRename: (file: FileItem) => void;
  onOpenUpload: () => void;
  onFilesDropped: (items: ScannedFileItem[]) => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  files,
  folders,
  currentFolder,
  lockedFolders = [],
  unlockedFolders = new Set(),
  onSelectFolder,
  onCreateFolder,
  onLockFolder,
  onUnlockFolder,
  onVerifyFolderPassword,
  isLoading,
  onRefresh,
  onPreview,
  onDownload,
  onDelete,
  onBulkDelete,
  onMoveFiles,
  onRename,
  onOpenUpload,
  onFilesDropped,
  onToast
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeFolderMenuPath, setActiveFolderMenuPath] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedThumbs, setFailedThumbs] = useState<Record<string, boolean>>({});
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Folder Operations
  const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);
  const [isDeletingFolderLoading, setIsDeletingFolderLoading] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<FolderItem | null>(null);
  const [renameFolderInput, setRenameFolderInput] = useState('');

  // Zoom scale state (0: compact, 1: small, 2: default, 3: medium, 4: large)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('infinidrive_zoom');
      if (saved) return parseInt(saved, 10);
    } catch (e) {}
    return 2;
  });
  const [showZoomBadge, setShowZoomBadge] = useState(false);
  const zoomTimeoutRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [targetMoveFolder, setTargetMoveFolder] = useState('/');
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Folder Lock Modals
  const [lockingFolder, setLockingFolder] = useState<string | null>(null);
  const [lockPassword, setLockPassword] = useState('');
  const [lockConfirmPassword, setLockConfirmPassword] = useState('');
  const [isSettingLock, setIsSettingLock] = useState(false);

  // Folder Unlock Prompt Modal
  const [promptUnlockFolder, setPromptUnlockFolder] = useState<string | null>(null);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isVerifyingUnlock, setIsVerifyingUnlock] = useState(false);
  const unlockInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Attach Ctrl + Scroll Wheel Zoom Listener to Container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();

        setZoomLevel(prev => {
          let next = prev;
          if (e.deltaY < 0) {
            next = Math.min(4, prev + 1);
          } else if (e.deltaY > 0) {
            next = Math.max(0, prev - 1);
          }
          try {
            localStorage.setItem('infinidrive_zoom', String(next));
          } catch (err) {}
          return next;
        });

        setShowZoomBadge(true);
        if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = setTimeout(() => setShowZoomBadge(false), 1200);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    };
  }, []);

  // Autofocus folder input when modal opens
  useEffect(() => {
    if (isNewFolderModalOpen) {
      setNewFolderName('');
      const timer = setTimeout(() => {
        newFolderInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isNewFolderModalOpen]);

  // Autofocus unlock password input
  useEffect(() => {
    if (promptUnlockFolder) {
      setUnlockPasswordInput('');
      setUnlockError(null);
      const timer = setTimeout(() => {
        unlockInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [promptUnlockFolder]);

  // Close folder menu on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveFolderMenuPath(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleExecuteDeleteFolder = async () => {
    if (!deletingFolder) return;
    setIsDeletingFolderLoading(true);
    try {
      await api.deleteFolder(deletingFolder.path);
      onToast('success', t('toast_folder_deleted'), t('toast_folder_deleted_msg', { path: deletingFolder.path }));
      setDeletingFolder(null);
      if (currentFolder === deletingFolder.path || currentFolder.startsWith(deletingFolder.path + '/')) {
        onSelectFolder('/');
      }
      onRefresh();
    } catch (err: any) {
      onToast('error', 'Delete Folder Failed', err.message);
    } finally {
      setIsDeletingFolderLoading(false);
    }
  };

  const handleExecuteRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFolder || !renameFolderInput.trim()) return;
    try {
      await api.renameFolder(renamingFolder.path, renameFolderInput.trim());
      onToast('success', t('toast_folder_renamed'), t('toast_folder_renamed_msg', { name: renameFolderInput.trim() }));
      setRenamingFolder(null);
      onRefresh();
    } catch (err: any) {
      onToast('error', 'Rename Folder Failed', err.message);
    }
  };

  const handleSyncCloud = async () => {
    setIsSyncingCloud(true);
    try {
      onToast('info', 'Scanning Telegram Cloud', 'Scanning storage channel for uploaded files...');
      const res = await api.syncChannelLibrary();
      if (res.status === 'success') {
        onToast('success', t('toast_sync_complete'), res.message);
        onRefresh();
      } else {
        onToast('warning', 'Cloud Sync Notice', res.message);
      }
    } catch (e: any) {
      onToast('error', 'Sync Failed', e.response?.data?.detail || e.message || 'Failed to scan channel.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mime: string, name: string) => {
    const lowerName = name.toLowerCase();
    if (mime.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(lowerName)) {
      return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    }
    if (mime.includes('video') || /\.(mp4|mkv|avi|mov|webm|flv)$/i.test(lowerName)) {
      return <Film className="w-4 h-4 text-blue-400" />;
    }
    if (mime.includes('audio') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(lowerName)) {
      return <Music className="w-4 h-4 text-purple-400" />;
    }
    if (mime.includes('zip') || /\.(zip|rar|7z|tar|gz|bz2|xz|zst)$/i.test(lowerName)) {
      return <Archive className="w-4 h-4 text-amber-400" />;
    }
    if (/\.(exe|msi|iso|dmg|apk|bin|appimage|deb|rpm)$/i.test(lowerName)) {
      return <Box className="w-4 h-4 text-violet-400" />;
    }
    if (mime.includes('pdf') || lowerName.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-rose-400" />;
    }
    if (/\.(doc|docx|txt|md|rtf)$/i.test(lowerName)) {
      return <FileText className="w-4 h-4 text-cyan-400" />;
    }
    if (/\.(xls|xlsx|csv)$/i.test(lowerName)) {
      return <FileText className="w-4 h-4 text-emerald-500" />;
    }
    if (/\.(psd|ai|fig|sketch)$/i.test(lowerName)) {
      return <Sparkles className="w-4 h-4 text-pink-400" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  // Filter and Sort Logic
  const filteredFiles = useMemo(() => {
    let result = files.filter(f => {
      // Search filter
      const matchesSearch = f.file_name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Folder filter
      if (currentFolder !== 'all') {
        const fileFolder = f.folder || '/';
        if (fileFolder !== currentFolder) return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const mime = f.mime_type.toLowerCase();
        const name = f.file_name.toLowerCase();
        if (selectedCategory === 'image') {
          return mime.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name);
        }
        if (selectedCategory === 'video') {
          return mime.includes('video') || /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v|ts)$/i.test(name);
        }
        if (selectedCategory === 'audio') {
          return mime.includes('audio') || /\.(mp3|wav|ogg|flac|m4a|aac|opus|wma)$/i.test(name);
        }
        if (selectedCategory === 'document') {
          return mime.includes('pdf') || mime.includes('word') || mime.includes('excel') || mime.includes('text') || /\.(pdf|doc|docx|xls|xlsx|txt|md|json|csv|rtf)$/i.test(name);
        }
        if (selectedCategory === 'archive') {
          return mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || /\.(zip|rar|7z|tar|gz|bz2|xz|zst)$/i.test(name);
        }
        if (selectedCategory === 'executable') {
          return /\.(exe|msi|iso|dmg|apk|bin|appimage|deb|rpm)$/i.test(name);
        }
      }

      return true;
    });

    result.sort((a, b) => {
      let valA: any = a.uploaded_at;
      let valB: any = b.uploaded_at;

      if (sortBy === 'name') {
        valA = a.file_name.toLowerCase();
        valB = b.file_name.toLowerCase();
      } else if (sortBy === 'size') {
        valA = a.file_size;
        valB = b.file_size;
      } else if (sortBy === 'views') {
        valA = a.view_count;
        valB = b.view_count;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [files, searchQuery, currentFolder, selectedCategory, sortBy, sortOrder]);

  // Subfolders under current folder
  const currentSubfolders = useMemo(() => {
    const isTopLevel = currentFolder === 'all' || currentFolder === '/';
    const norm = isTopLevel ? '/' : `${currentFolder}/`;

    return folders.filter(f => {
      if (!f.path || f.path === '/' || f.path === currentFolder) return false;
      if (norm === '/') {
        const withoutLead = f.path.startsWith('/') ? f.path.slice(1) : f.path;
        return withoutLead.length > 0 && withoutLead.indexOf('/') === -1;
      }
      if (f.path.startsWith(norm)) {
        const tail = f.path.slice(norm.length);
        return tail.length > 0 && tail.indexOf('/') === -1;
      }
      return false;
    });
  }, [folders, currentFolder]);

  // Selection with Shift-Click Range & Single Toggle
  const handleItemSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Range select with Shift Key
    if (e?.shiftKey && lastSelectedId && filteredFiles.some(f => f.file_id === lastSelectedId)) {
      const lastIdx = filteredFiles.findIndex(f => f.file_id === lastSelectedId);
      const currentIdx = filteredFiles.findIndex(f => f.file_id === id);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const rangeIds = filteredFiles.slice(start, end + 1).map(f => f.file_id);

        setSelectedIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(fid => next.add(fid));
          return next;
        });
        setLastSelectedId(id);
        return;
      }
    }

    // Individual toggle
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
  };

  const toggleSelect = handleItemSelect;

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.file_id)));
      if (filteredFiles[0]) {
        setLastSelectedId(filteredFiles[0].file_id);
      }
    }
  };

  // Keyboard Shortcuts: Ctrl+A (Select All) & Escape (Deselect)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (filteredFiles.length > 0) {
          setSelectedIds(new Set(filteredFiles.map(f => f.file_id)));
          if (filteredFiles[0]) {
            setLastSelectedId(filteredFiles[0].file_id);
          }
        }
      }

      if (e.key === 'Escape') {
        if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, selectedIds.size]);

  const copyLink = (file: FileItem) => {
    const link = api.getFileDownloadUrl(file.file_id, file.file_name, file.password || undefined);
    navigator.clipboard.writeText(link);
    setCopiedId(file.file_id);
    onToast('success', t('toast_link_copied'), t('toast_link_copied_msg'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;

    if (e.dataTransfer) {
      try {
        const scanned = await scanDataTransferItems(e.dataTransfer);
        if (scanned.length > 0) {
          onFilesDropped(scanned);
        }
      } catch (err: any) {
        onToast('error', 'Drop Error', err.message);
      }
    }
  };

  // Breadcrumb Segments
  const breadcrumbSegments = useMemo(() => {
    if (currentFolder === 'all') return [{ name: t('fm_breadcrumb_all'), path: 'all' }];
    if (currentFolder === '/') return [{ name: t('fm_breadcrumb_root'), path: '/' }];
    
    const parts = currentFolder.split('/').filter(Boolean);
    const segments = [{ name: t('fm_breadcrumb_root'), path: '/' }];
    let accPath = '';
    for (const part of parts) {
      accPath += `/${part}`;
      segments.push({ name: part, path: accPath });
    }
    return segments;
  }, [currentFolder, t]);

  // Navigate folder safely (check locks)
  const handleFolderNavigation = (targetPath: string) => {
    if (targetPath !== 'all' && targetPath !== '/' && lockedFolders.includes(targetPath) && !unlockedFolders.has(targetPath)) {
      setPromptUnlockFolder(targetPath);
      return;
    }
    onSelectFolder(targetPath);
  };

  // Execute unlock verification
  const handleExecuteUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptUnlockFolder || !unlockPasswordInput.trim()) return;

    setIsVerifyingUnlock(true);
    setUnlockError(null);
    try {
      const res = await api.verifyFolderPassword(promptUnlockFolder, unlockPasswordInput.trim());
      if (res.valid) {
        unlockedFolders.add(promptUnlockFolder);
        const target = promptUnlockFolder;
        setPromptUnlockFolder(null);
        setUnlockPasswordInput('');
        onSelectFolder(target);
        onToast('success', 'Folder Unlocked', `Access granted to ${target}`);
      } else {
        setUnlockError(t('modal_err_pw_wrong'));
      }
    } catch (err: any) {
      setUnlockError(t('modal_err_pw_wrong'));
    } finally {
      setIsVerifyingUnlock(false);
    }
  };

  // Bulk Handlers
  const handleExecuteBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    await onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleExecuteBulkMove = async () => {
    await onMoveFiles(Array.from(selectedIds), targetMoveFolder);
    setIsMoveModalOpen(false);
    setSelectedIds(new Set());
  };

  const handleCreateNewFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    const fullPath = currentFolder === '/' || currentFolder === 'all' 
      ? `/${trimmed}` 
      : `${currentFolder}/${trimmed}`;

    try {
      await onCreateFolder(fullPath);
      setNewFolderName('');
      setIsNewFolderModalOpen(false);
      onRefresh();
    } catch (err: any) {
      onToast('error', 'Folder Creation Failed', err.message);
    }
  };

  const handleExecuteSetLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockingFolder || !lockPassword.trim()) return;
    if (lockPassword !== lockConfirmPassword) {
      onToast('error', 'Validation Error', t('modal_err_pw_mismatch'));
      return;
    }

    setIsSettingLock(true);
    try {
      await api.lockFolder(lockingFolder, lockPassword.trim());
      onToast('success', t('toast_folder_locked'), t('toast_folder_locked_msg', { path: lockingFolder }));
      setLockingFolder(null);
      setLockPassword('');
      setLockConfirmPassword('');
      onRefresh();
    } catch (err: any) {
      onToast('error', 'Lock Failed', err.message);
    } finally {
      setIsSettingLock(false);
    }
  };

  const handleExecuteRemoveLock = async (folderPath: string) => {
    try {
      await api.unlockFolder(folderPath);
      unlockedFolders.delete(folderPath);
      onToast('info', t('toast_folder_unlocked'), t('toast_folder_unlocked_msg', { path: folderPath }));
      onRefresh();
    } catch (err: any) {
      onToast('error', 'Unlock Failed', err.message);
    }
  };

  const categories: { id: FileCategory; label: string }[] = [
    { id: 'all', label: t('fm_cat_all') },
    { id: 'image', label: t('fm_cat_image') },
    { id: 'video', label: t('fm_cat_video') },
    { id: 'audio', label: t('fm_cat_audio') },
    { id: 'document', label: t('fm_cat_document') },
    { id: 'archive', label: t('fm_cat_archive') },
    { id: 'executable', label: t('fm_cat_executable') }
  ];

  // Dynamic grid column classes based on zoomLevel
  const gridClasses = useMemo(() => {
    switch (zoomLevel) {
      case 0:
        return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2.5';
      case 1:
        return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3';
      case 3:
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4';
      case 4:
        return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4';
      case 2:
      default:
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5';
    }
  }, [zoomLevel]);

  const zoomPercents = [75, 90, 100, 125, 150];

  return (
    <div 
      ref={containerRef}
      className="flex-1 h-full flex flex-col overflow-hidden bg-[#090a0e] relative select-none" 
      onClick={() => setActiveMenuId(null)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Floating Zoom Indicator Pill */}
      <AnimatePresence>
        {showZoomBadge && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-20 right-6 z-40 px-3.5 py-1.5 rounded-full bg-[#161a28]/90 border border-blue-500/30 text-blue-300 font-mono text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-1.5 pointer-events-none"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('fm_zoom_level', { percent: zoomPercents[zoomLevel] })}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-blue-950/80 backdrop-blur-md border-2 border-dashed border-blue-400 m-3 rounded-2xl flex flex-col items-center justify-center space-y-4 pointer-events-none animate-in fade-in duration-200">
          <div className="w-20 h-20 rounded-3xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 animate-bounce">
            <UploadCloud className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-white tracking-wide">{t('fm_drop_title')}</h3>
            <p className="text-xs text-blue-300 mt-1">{t('fm_drop_sub')}</p>
          </div>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-[#0c0e14]">
        {/* Left: Search & Filter */}
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('fm_search_placeholder')}
              className="w-full bg-[#12141c] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={handleSyncCloud}
            disabled={isSyncingCloud}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer shrink-0"
            title={t('fm_sync_tooltip')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? t('fm_syncing') : t('fm_btn_sync_cloud')}</span>
          </button>
        </div>

        {/* Right: Sort, View Mode, New Folder, Upload */}
        <div className="flex items-center gap-2.5">
          {/* New Folder Button */}
          <button
            onClick={() => setIsNewFolderModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-slate-300 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('fm_btn_new_folder')}</span>
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value="date" className="bg-[#12141c]">{t('fm_sort_date')}</option>
              <option value="name" className="bg-[#12141c]">{t('fm_sort_name')}</option>
              <option value="size" className="bg-[#12141c]">{t('fm_sort_size')}</option>
              <option value="views" className="bg-[#12141c]">{t('fm_sort_views')}</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold ml-1 cursor-pointer"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title={t('fm_view_grid')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title={t('fm_view_list')}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="btn-primary text-xs shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* Category Filter Chips & Breadcrumb Navigation Bar */}
      <div className="px-4 py-2.5 border-b border-white/5 bg-[#0a0b10] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-slate-400 overflow-x-auto py-0.5">
          <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          {breadcrumbSegments.map((seg, idx) => (
            <React.Fragment key={seg.path}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
              <button
                onClick={() => handleFolderNavigation(seg.path)}
                className={`hover:text-blue-400 transition-colors font-medium cursor-pointer ${
                  idx === breadcrumbSegments.length - 1 ? 'text-slate-100 font-semibold' : 'text-slate-400'
                }`}
              >
                {seg.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Right: Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Subfolders + Files */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        {/* Subfolders Section */}
        {currentSubfolders.length > 0 && (
          <div className="mb-5 space-y-2">
            <h4 className="text-[11px] font-semibold text-slate-400 tracking-wide uppercase font-mono">
              Folders ({currentSubfolders.length})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {currentSubfolders.map(f => {
                const isLocked = lockedFolders.includes(f.path);
                const isUnlockedSession = unlockedFolders.has(f.path);

                return (
                  <div
                    key={f.path}
                    onClick={() => handleFolderNavigation(f.path)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group ${
                      isLocked && !isUnlockedSession
                        ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-950/25'
                        : 'bg-[#11131c] border-white/5 hover:border-white/20 hover:bg-[#151824]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-lg ${isLocked ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        <Folder className="w-4 h-4 fill-current" />
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                        {f.name}
                      </span>
                    </div>

                    <div className="relative flex items-center gap-1">
                      {isLocked && (
                        <span className="p-1 rounded bg-amber-500/20 text-amber-300" title={isUnlockedSession ? 'Unlocked Session' : 'Locked'}>
                          {isUnlockedSession ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5" />}
                        </span>
                      )}

                      {/* 3-Dots Menu Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFolderMenuPath(activeFolderMenuPath === f.path ? null : f.path);
                          setActiveMenuId(null);
                        }}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer ${
                          activeFolderMenuPath === f.path ? 'opacity-100 bg-white/10 text-white' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title="Folder Options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Folder Dropdown Menu */}
                      {activeFolderMenuPath === f.path && (
                        <div 
                          className="absolute top-8 right-0 z-50 w-44 rounded-xl bg-[#141724] border border-white/15 shadow-2xl p-1.5 space-y-0.5 text-xs text-slate-200 backdrop-blur-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setActiveFolderMenuPath(null);
                              if (isLocked) {
                                handleExecuteRemoveLock(f.path);
                              } else {
                                setLockingFolder(f.path);
                                setLockPassword('');
                                setLockConfirmPassword('');
                              }
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
                          >
                            {isLocked ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                            <span>{isLocked ? t('fm_menu_unlock_folder') : t('fm_menu_lock_folder')}</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveFolderMenuPath(null);
                              setRenamingFolder(f);
                              setRenameFolderInput(f.name);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                            <span>{t('fm_menu_rename_folder')}</span>
                          </button>

                          <div className="h-px bg-white/5 my-1" />

                          <button
                            onClick={() => {
                              setActiveFolderMenuPath(null);
                              setDeletingFolder(f);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 text-left transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{t('fm_menu_delete_folder')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Files Grid or List */}
        {filteredFiles.length === 0 && currentSubfolders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300">
                {searchQuery ? t('fm_empty_search_title') : t('fm_empty_title')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery ? t('fm_empty_search_sub') : t('fm_empty_sub')}
              </p>
            </div>
            {!searchQuery && (
              <button onClick={onOpenUpload} className="btn-primary text-xs mt-2 cursor-pointer">
                <UploadCloud className="w-4 h-4" />
                <span>Upload Files</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View with Zoom Dynamic Columns */
          <div className={`${gridClasses} pb-24`}>
            {filteredFiles.map((file) => {
              const isSelected = selectedIds.has(file.file_id);
              const isImage = file.mime_type.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(file.file_name);
              const isVideo = file.mime_type.includes('video') || /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v|ts)$/i.test(file.file_name);

              return (
                <div
                  key={file.file_id}
                  onClick={(e) => {
                    if (e.shiftKey || selectedIds.size > 0) {
                      handleItemSelect(file.file_id, e);
                    } else {
                      onPreview(file);
                      setLastSelectedId(file.file_id);
                    }
                  }}
                  className={`group relative rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500 shadow-md shadow-blue-500/10'
                      : 'bg-[#11131a] border-white/5 hover:border-white/20 hover:bg-[#151722]'
                  }`}
                >
                  {/* Selection Checkbox */}
                  <button
                    onClick={(e) => toggleSelect(file.file_id, e)}
                    className={`absolute top-2.5 left-2.5 z-10 p-1 rounded-lg transition-opacity cursor-pointer ${
                      isSelected || selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    } ${isSelected ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4 fill-blue-500/20" /> : <Square className="w-4 h-4" />}
                  </button>

                  {/* Top Right Badges & Context Menu */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
                    {file.password && (
                      <span className="p-1 rounded bg-amber-500/20 text-amber-400" title="Password Protected">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === file.file_id ? null : file.file_id);
                      }}
                      className="p-1 rounded-lg bg-black/40 hover:bg-black/80 text-slate-400 hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Context Menu Dropdown */}
                  {activeMenuId === file.file_id && (
                    <div 
                      className="absolute top-9 right-2 z-30 w-44 rounded-xl bg-[#181a24] border border-white/10 shadow-2xl p-1.5 space-y-0.5 text-xs text-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { onPreview(file); setActiveMenuId(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>{t('fm_menu_preview')}</span>
                      </button>
                      <button
                        onClick={() => { onDownload(file); setActiveMenuId(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('fm_menu_download')}</span>
                      </button>
                      <button
                        onClick={() => { copyLink(file); setActiveMenuId(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-purple-400" />
                        <span>{t('fm_menu_copy_link')}</span>
                      </button>
                      <button
                        onClick={() => { onRename(file); setActiveMenuId(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('fm_menu_rename')}</span>
                      </button>
                      <div className="h-px bg-white/5 my-1" />
                      <button
                        onClick={() => { onDelete(file); setActiveMenuId(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 text-left transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('fm_menu_delete')}</span>
                      </button>
                    </div>
                  )}

                  {/* Thumbnail / Icon Container */}
                  <div className="w-full aspect-square rounded-lg bg-[#181a24]/60 border border-white/5 flex items-center justify-center mb-2.5 overflow-hidden relative select-none">
                    {isImage && !failedThumbs[file.file_id] ? (
                      <img 
                        src={api.getFilePreviewUrl(file.file_id)} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={() => setFailedThumbs(prev => ({ ...prev, [file.file_id]: true }))}
                      />
                    ) : (isVideo || file.has_thumbnail) && !failedThumbs[file.file_id] ? (
                      <div className="w-full h-full relative group/poster flex items-center justify-center bg-[#10121a]">
                        <img 
                          src={api.getThumbnailUrl(file.file_id)} 
                          alt="" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={() => setFailedThumbs(prev => ({ ...prev, [file.file_id]: true }))}
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                          <div className="w-9 h-9 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 ml-0.5 fill-white" />
                          </div>
                        </div>
                      </div>
                    ) : isVideo ? (
                      <div className="w-full h-full bg-gradient-to-br from-[#141828] via-[#0e101b] to-[#161a2c] flex flex-col items-center justify-center border border-white/5 group-hover:border-blue-500/30 transition-all">
                        <div className="w-9 h-9 rounded-full bg-blue-600/80 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 ml-0.5 fill-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                        {getFileIcon(file.mime_type, file.file_name)}
                      </div>
                    )}

                    {Boolean(file.is_chunked) && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-purple-500/80 backdrop-blur-sm text-[9px] font-bold text-white uppercase tracking-wider">
                        {file.total_chunks || 'Multi'} Parts
                      </span>
                    )}

                    {file.upload_source === 'user_account' && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 text-[9px] font-bold text-purple-300">
                        👤 MTProto
                      </span>
                    )}
                  </div>

                  {/* File Metadata */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors" title={file.file_name}>
                      {file.file_name}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{formatBytes(file.file_size)}</span>
                      <span>{file.view_count || 0} views</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-1 pb-24">
            {/* List Header */}
            <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[11px] font-semibold text-slate-500 border-b border-white/5">
              <div className="col-span-6 flex items-center gap-2">
                <button onClick={toggleSelectAll} className="p-0.5 text-slate-400 hover:text-white cursor-pointer">
                  {selectedIds.size === filteredFiles.length && filteredFiles.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
                <span>{t('fm_th_name')}</span>
              </div>
              <div className="col-span-2">{t('fm_th_size')}</div>
              <div className="col-span-2">{t('fm_th_uploaded_at')}</div>
              <div className="col-span-1 text-center">{t('fm_th_views')}</div>
              <div className="col-span-1 text-right">{t('fm_th_actions')}</div>
            </div>

            {/* List Items */}
            {filteredFiles.map((file) => {
              const isSelected = selectedIds.has(file.file_id);

              return (
                <div
                  key={file.file_id}
                  onClick={(e) => {
                    if (e.shiftKey || selectedIds.size > 0) {
                      handleItemSelect(file.file_id, e);
                    } else {
                      onPreview(file);
                      setLastSelectedId(file.file_id);
                    }
                  }}
                  className={`grid grid-cols-12 gap-3 px-3 py-2.5 rounded-xl items-center text-xs transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-600/15 border border-blue-500/30'
                      : 'bg-[#11131a]/60 hover:bg-[#151722] border border-transparent hover:border-white/5'
                  }`}
                >
                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <button
                      onClick={(e) => toggleSelect(file.file_id, e)}
                      className={`p-0.5 rounded cursor-pointer ${isSelected ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    </button>

                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      {getFileIcon(file.mime_type, file.file_name)}
                    </div>

                    <div className="min-w-0 flex items-center gap-2">
                      <span className="font-medium text-slate-200 truncate hover:text-blue-400 transition-colors">
                        {file.file_name}
                      </span>
                      {file.upload_source === 'user_account' ? (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9px] font-mono shrink-0">
                          👤 MTProto
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[9px] font-mono shrink-0">
                          🤖 Bot
                        </span>
                      )}
                      {Boolean(file.is_chunked) && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono shrink-0">
                          {file.total_chunks || 'Multi'} Parts
                        </span>
                      )}
                      {file.password && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                    </div>
                  </div>

                  <div className="col-span-2 text-slate-400 font-mono text-[11px]">
                    {formatBytes(file.file_size)}
                  </div>

                  <div className="col-span-2 text-slate-500 text-[11px]">
                    {file.uploaded_at?.split('T')[0] || file.uploaded_at?.split(' ')[0]}
                  </div>

                  <div className="col-span-1 text-center text-slate-400 text-[11px]">
                    {file.view_count || 0}
                  </div>

                  <div className="col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => copyLink(file)}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                      title={t('fm_menu_copy_link')}
                    >
                      {copiedId === file.file_id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onDownload(file)}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      title={t('fm_menu_download')}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(file)}
                      className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title={t('fm_menu_delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Glassmorphic Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#121520]/90 backdrop-blur-xl border border-blue-500/30 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 border-r border-white/10 pr-4">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span>{t('fm_selected_count', { count: selectedIds.size })}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMoveModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <FolderInput className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('fm_bulk_move')}</span>
            </button>

            <button
              onClick={handleExecuteBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs font-medium text-rose-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('fm_bulk_delete')}</span>
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Clear Selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      <AnimatePresence>
        {isMoveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoveModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border border-amber-500/25 shadow-2xl shadow-amber-950/50 p-6 space-y-4 overflow-hidden z-10"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <FolderInput className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{t('modal_move_title', { count: selectedIds.size, plural: selectedIds.size !== 1 ? 's' : '' })}</h3>
                    <p className="text-[11px] text-slate-400">{t('modal_move_sub')}</p>
                  </div>
                </div>
                <button onClick={() => setIsMoveModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 relative z-10">
                <label className="text-xs font-medium text-slate-300">{t('modal_move_select_label')}</label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {folders.map(f => (
                    <button
                      key={f.path}
                      onClick={() => setTargetMoveFolder(f.path)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-xs transition-all cursor-pointer ${
                        targetMoveFolder === f.path
                          ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300 shadow-md shadow-blue-900/20'
                          : 'bg-[#121524] hover:bg-white/10 text-slate-300 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate font-medium">{f.path}</span>
                      </div>
                      {targetMoveFolder === f.path && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 relative z-10">
                <button
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  {t('modal_btn_cancel')}
                </button>
                <button
                  onClick={handleExecuteBulkMove}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
                >
                  {t('modal_btn_move_confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Folder Modal with Verified Clean State & Autofocus */}
      <AnimatePresence>
        {isNewFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewFolderModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.form
              onSubmit={handleCreateNewFolder}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border border-blue-500/25 shadow-2xl shadow-blue-950/50 p-6 space-y-4 overflow-hidden z-10 select-none"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <FolderPlus className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{t('modal_new_folder_title')}</h3>
                    <p className="text-[11px] text-slate-400">{t('modal_new_folder_sub')}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsNewFolderModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 relative z-10">
                <label className="text-xs font-medium text-slate-300">{t('modal_new_folder_input_label')}</label>
                <input
                  ref={newFolderInputRef}
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={t('modal_new_folder_placeholder')}
                  className="w-full bg-[#121524] border border-white/10 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none transition-all shadow-inner font-medium select-text"
                />
                <p className="text-[10px] text-slate-500">
                  {t('modal_new_folder_path_hint')} <span className="font-mono text-slate-400">{currentFolder === 'all' ? '/' : currentFolder}</span>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  {t('modal_btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {t('modal_btn_create_folder')}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Lock Folder Modal */}
      <AnimatePresence>
        {lockingFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLockingFolder(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.form
              onSubmit={handleExecuteSetLock}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border border-amber-500/30 shadow-2xl shadow-amber-950/60 p-6 space-y-4 overflow-hidden z-10"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{t('modal_lock_folder_title')}</h3>
                    <p className="text-[11px] text-slate-400 font-mono truncate max-w-[240px]">{lockingFolder}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setLockingFolder(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 relative z-10">
                <div>
                  <label className="text-xs font-medium text-slate-300">{t('modal_lock_pw_label')}</label>
                  <input
                    type="password"
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    placeholder={t('modal_lock_pw_placeholder')}
                    autoFocus
                    className="w-full bg-[#121524] border border-white/10 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">{t('modal_lock_confirm_label')}</label>
                  <input
                    type="password"
                    value={lockConfirmPassword}
                    onChange={(e) => setLockConfirmPassword(e.target.value)}
                    placeholder={t('modal_lock_confirm_placeholder')}
                    className="w-full bg-[#121524] border border-white/10 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => setLockingFolder(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  {t('modal_btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!lockPassword.trim() || isSettingLock}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {t('modal_btn_set_lock')}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Unlock Folder Password Modal (PIN/Pass Prompt) */}
      <AnimatePresence>
        {promptUnlockFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPromptUnlockFolder(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.form
              onSubmit={handleExecuteUnlock}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm rounded-2xl bg-[#0c0e17]/95 border border-amber-500/35 shadow-2xl shadow-amber-950/70 p-6 space-y-4 overflow-hidden z-10"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-2 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
                  <Key className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('modal_unlock_prompt_title')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t('modal_unlock_prompt_sub')}</p>
                  <span className="text-[11px] font-mono text-amber-400 font-semibold mt-1 block">{promptUnlockFolder}</span>
                </div>
              </div>

              <div className="space-y-1.5 relative z-10">
                <input
                  ref={unlockInputRef}
                  type="password"
                  value={unlockPasswordInput}
                  onChange={(e) => {
                    setUnlockPasswordInput(e.target.value);
                    if (unlockError) setUnlockError(null);
                  }}
                  placeholder={t('modal_unlock_pw_placeholder')}
                  className={`w-full bg-[#121524] border rounded-xl px-3.5 py-2.5 text-xs text-center font-mono text-white outline-none transition-all shadow-inner ${
                    unlockError ? 'border-rose-500 ring-1 ring-rose-500 animate-shake' : 'border-white/10 focus:border-amber-500'
                  }`}
                />
                {unlockError && (
                  <p className="text-[11px] text-rose-400 text-center font-medium">{unlockError}</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5 pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => setPromptUnlockFolder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  {t('modal_btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!unlockPasswordInput.trim() || isVerifyingUnlock}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isVerifyingUnlock ? '...' : t('modal_btn_unlock_access')}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Folder Glassmorphic Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingFolder)}
        title={t('modal_delete_folder_title', { name: deletingFolder?.name || '' })}
        message={t('modal_delete_folder_msg')}
        confirmText={t('fm_menu_delete_folder')}
        cancelText={t('modal_btn_cancel')}
        variant="danger"
        isLoading={isDeletingFolderLoading}
        onClose={() => setDeletingFolder(null)}
        onConfirm={handleExecuteDeleteFolder}
      />

      {/* Rename Folder Modal */}
      <AnimatePresence>
        {renamingFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRenamingFolder(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.form
              onSubmit={handleExecuteRenameFolder}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md rounded-2xl bg-[#0c0e17]/95 border border-blue-500/25 shadow-2xl shadow-blue-950/50 p-6 space-y-4 overflow-hidden z-10"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Edit3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{t('modal_rename_folder_title')}</h3>
                    <p className="text-[11px] text-slate-400">{renamingFolder.path}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setRenamingFolder(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 relative z-10">
                <label className="text-xs font-medium text-slate-300">{t('modal_rename_folder_input_label')}</label>
                <input
                  autoFocus
                  type="text"
                  value={renameFolderInput}
                  onChange={(e) => setRenameFolderInput(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="w-full bg-[#121524] border border-white/10 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none transition-all shadow-inner font-medium select-text"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => setRenamingFolder(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  {t('modal_btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!renameFolderInput.trim() || renameFolderInput.trim() === renamingFolder.name}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {t('modal_btn_rename_folder')}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// InfiniDrive  Root App component: routing, drag-drop, modal orchestration
import React, { useState, useEffect, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { FileManager } from './components/FileManager';
import { BotManager } from './components/BotManager';
import { SettingsView } from './components/SettingsView';
import { SetupWizard } from './components/SetupWizard';
import { UploadModal } from './components/UploadModal';
import { FilePreviewModal } from './components/FilePreviewModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { RenameModal } from './components/RenameModal';
import { ShareDialog } from './components/ShareDialog';
import { ToastContainer } from './components/Toast';
import { AppConfig, BotStatus, ConnectionStatus, FileItem, FolderItem, StorageStats, ToastMessage } from './types';
import { api } from './api/client';
import { useHealth, useConfig, useStats, useFiles, useFolders, useLockedFolders, useBots, useConnection, useRefreshAll } from './hooks/queries';
import { useTranslation } from './i18n/LanguageContext';
import { ScannedFileItem } from './utils/fileScanner';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [unlockedFolders, setUnlockedFolders] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState<string>('all');

  // Server-state (TanStack Query) - replaces manual fetchData() + 4s polling.
  const health = useHealth();
  const sidecarReady: boolean = health.isSuccess;
  const configQuery = useConfig(sidecarReady);
  const config: AppConfig | null = configQuery.data ?? null;
  const isConfigured: boolean | null = config ? Boolean(config.is_configured) : null;

  const statsQuery = useStats(isConfigured === true);
  const filesQuery = useFiles(isConfigured === true);
  const foldersQuery = useFolders(isConfigured === true);
  const lockedQuery = useLockedFolders(isConfigured === true);
  const botsQuery = useBots(isConfigured === true);
  const refreshAll = useRefreshAll();

  const stats: StorageStats | null = statsQuery.data ?? null;
  const files: FileItem[] = filesQuery.data ?? [];
  const folders: FolderItem[] = foldersQuery.data ?? [{ path: '/', name: 'Root' }];
  const lockedFolders: string[] = lockedQuery.data ?? [];
  const bots: BotStatus[] = botsQuery.data ?? [];
  const connectionQuery = useConnection(sidecarReady);
  const connection: ConnectionStatus | null = connectionQuery.data ?? null;
  const isLoadingFiles: boolean = filesQuery.isFetching;
  
  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [droppedItems, setDroppedItems] = useState<ScannedFileItem[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);
  const [bulkDeletingIds, setBulkDeletingIds] = useState<string[] | null>(null);
  const [isDeletingAction, setIsDeletingAction] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      return window.electronAPI.onTrayOpenUpload(() => {
        setDroppedItems([]);
        setIsUploadOpen(true);
      });
    }
  }, []);

  // Actions
  const handleDownload = async (file: FileItem) => {
    const downloadUrl = api.getFileDownloadUrl(file.file_id, file.file_name, file.password || undefined);
    
    if (window.electronAPI) {
      const savePath = await window.electronAPI.saveFileDialog(file.file_name);
      if (savePath) {
        addToast('info', 'Download Started', `Downloading ${file.file_name}...`);
        try {
          const res = await fetch(downloadUrl);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onload = async () => {
            addToast('success', 'Download Complete', `Saved to ${savePath}`);
          };
          reader.readAsArrayBuffer(blob);
        } catch (e: any) {
          addToast('error', 'Download Failed', e.message);
        }
      }
    } else {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addToast('success', 'Download Triggered', `${file.file_name}`);
    }
  };

  const handleDelete = (file: FileItem) => {
    setDeletingFile(file);
    setBulkDeletingIds(null);
  };

  const handleBulkDelete = async (fileIds: string[]) => {
    setBulkDeletingIds(fileIds);
    setDeletingFile(null);
  };

  const handleConfirmDelete = async () => {
    setIsDeletingAction(true);
    try {
      if (deletingFile) {
        await api.deleteFile(deletingFile.file_id);
        addToast('success', t('toast_file_deleted'), t('toast_file_deleted_msg', { name: deletingFile.file_name }));
        setDeletingFile(null);
        refreshAll();
      } else if (bulkDeletingIds && bulkDeletingIds.length > 0) {
        const res = await api.bulkDeleteFiles(bulkDeletingIds);
        addToast('success', t('toast_bulk_delete_complete'), t('toast_bulk_delete_msg', { count: res.deleted_count }));
        setBulkDeletingIds(null);
        refreshAll();
      }
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message);
    } finally {
      setIsDeletingAction(false);
    }
  };

  const handleMoveFiles = async (fileIds: string[], targetFolder: string) => {
    try {
      const res = await api.moveFiles(fileIds, targetFolder);
      addToast('success', t('toast_files_moved'), t('toast_files_moved_msg', { count: res.moved_count, target: targetFolder }));
      refreshAll();
    } catch (err: any) {
      addToast('error', 'Move Failed', err.message);
    }
  };

  const handleCreateFolder = async (folderPath: string) => {
    try {
      await api.createFolder(folderPath);
      addToast('success', t('toast_folder_created'), t('toast_folder_created_msg', { path: folderPath }));
      refreshAll();
    } catch (err: any) {
      addToast('error', 'Folder Creation Failed', err.message);
    }
  };

  const handleFilesDropped = (dropped: ScannedFileItem[]) => {
    setDroppedItems(dropped);
    setIsUploadOpen(true);
  };

  const handleStartRename = (file: FileItem) => {
    setRenamingFile(file);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0c10] text-slate-100 overflow-hidden select-none">
      {/* Custom Windows 11 TitleBar */}
      <TitleBar 
        sidecarReady={sidecarReady} 
        activeBotsCount={stats?.healthy_bot_count || bots.filter(b => b.healthy).length} 
        userConnected={stats?.user_account_connected}
        userName={stats?.user_profile?.username || stats?.user_profile?.first_name}
        authMode={config?.auth_mode || 'smart'}
        connection={connection}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {isConfigured === null ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Connecting to InfiniDrive engine...</p>
          </div>
        ) : !isConfigured ? (
          <SetupWizard 
              onComplete={() => {
                refreshAll();
              }}
            onToast={addToast}
          />
        ) : (
          <>
            <Sidebar
              currentTab={currentTab}
              onSelectTab={setCurrentTab}
              onOpenUploadModal={() => {
                setDroppedItems([]);
                setIsUploadOpen(true);
              }}
              stats={stats}
              activeUploadsCount={0}
              authMode={config?.auth_mode || 'smart'}
              userConnected={stats?.user_account_connected}
              currentFolder={currentFolder}
              onSelectFolder={(folderPath) => {
                setCurrentFolder(folderPath);
              }}
              onToast={addToast}
            />

            <main className="flex-1 h-full overflow-hidden flex flex-col bg-[#090a0e]">
              {currentTab === 'dashboard' && (
                <Dashboard
                  stats={stats}
                  recentFiles={files}
                  bots={bots}
                  onOpenUpload={() => {
                    setDroppedItems([]);
                    setIsUploadOpen(true);
                  }}
                  onNavigate={setCurrentTab}
                  onPreviewFile={setPreviewFile}
                  onDownloadFile={handleDownload}
                />
              )}

              {currentTab === 'files' && (
                <FileManager
                  files={files}
                  folders={folders}
                  currentFolder={currentFolder}
                  lockedFolders={lockedFolders}
                  unlockedFolders={unlockedFolders}
                  onSelectFolder={setCurrentFolder}
                  onCreateFolder={handleCreateFolder}
                  isLoading={isLoadingFiles}
                  onRefresh={refreshAll}
                  onPreview={setPreviewFile}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onBulkDelete={handleBulkDelete}
                  onMoveFiles={handleMoveFiles}
                  onRename={handleStartRename}
                  onOpenUpload={() => {
                    setDroppedItems([]);
                    setIsUploadOpen(true);
                  }}
                  onFilesDropped={handleFilesDropped}
                  onShare={setShareFile}
                  onToast={addToast}
                />
              )}

              {currentTab === 'uploads' && (
                <div className="flex-1 p-6 space-y-4">
                  <h1 className="text-xl font-bold text-white">Transfers & Uploads</h1>
                  <p className="text-xs text-slate-400">Click below to initiate new batch uploads.</p>
                  <button onClick={() => { setDroppedItems([]); setIsUploadOpen(true); }} className="btn-primary text-xs cursor-pointer">
                    Open Upload Center
                  </button>
                </div>
              )}

              {currentTab === 'bots' && (
                <BotManager
                  bots={bots}
                  config={config}
                  onRefreshBots={refreshAll}
                  onToast={addToast}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsView
                  config={config}
                  onRefreshConfig={refreshAll}
                  onToast={addToast}
                />
              )}
            </main>
          </>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setDroppedItems([]);
        }}
        initialItems={droppedItems}
        currentFolder={currentFolder}
        onUploadSuccess={() => {
          refreshAll();
          setIsUploadOpen(false);
          setDroppedItems([]);
        }}
        onToast={addToast}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
        onToast={addToast}
      />

      {/* Custom Glassmorphic Delete Confirmation Modal (Zero Native Browser Dialogs) */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingFile || (bulkDeletingIds && bulkDeletingIds.length > 0))}
        onClose={() => {
          setDeletingFile(null);
          setBulkDeletingIds(null);
        }}
        onConfirm={handleConfirmDelete}
        file={deletingFile}
        bulkCount={bulkDeletingIds?.length}
        bulkFileNames={bulkDeletingIds ? files.filter(f => bulkDeletingIds.includes(f.file_id)).map(f => f.file_name) : undefined}
        isDeleting={isDeletingAction}
      />

      {/* Rename Dialog Modal */}
      <RenameModal
        isOpen={Boolean(renamingFile)}
        file={renamingFile}
        onClose={() => setRenamingFile(null)}
        onSave={async (newName) => {
          if (!renamingFile) return;
          try {
            await api.renameFile(renamingFile.file_id, newName);
            addToast('success', 'File Renamed', `Renamed to ${newName}`);
            setRenamingFile(null);
            refreshAll();
          } catch (err: any) {
            addToast('error', 'Rename Failed', err.message);
          }
        }}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {shareFile && (
        <ShareDialog file={shareFile} onClose={() => setShareFile(null)} onToast={addToast} />
      )}
    </div>
  );
};

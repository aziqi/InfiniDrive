export interface UserProfile {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  phone: string;
  is_premium: boolean;
  upload_limit_gb: number;
  is_connected: boolean;
}

export type AuthMode = 'smart' | 'bot_only' | 'personal_only';
export type OTPState = 'idle' | 'code_sent' | 'verifying' | 'requires_2fa' | 'authenticated';

export interface FileItem {
  file_id: string;
  message_id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  expiration_date?: string | null;
  share_token?: string | null;
  password?: string | null;
  view_count: number;
  bot_uploader?: string | null;
  upload_source?: 'bot' | 'user_account';
  folder: string;
  is_chunked?: boolean;
  total_chunks?: number;
  has_thumbnail?: boolean;
}

export interface FolderItem {
  path: string;
  name: string;
}

export interface FolderGroup {
  id: number;
  name: string;
  color: string;
  folder_paths: string[];
  created_at?: string;
}

export interface BandwidthStats {
  used_today_bytes: number;
  quota_bytes: number;
  remaining_bytes: number;
  date: string;
  percent: number;
}

export type FileCategory = 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'executable';
export type SortField = 'date' | 'name' | 'size' | 'views';
export type SortOrder = 'asc' | 'desc';

export interface BotStatus {
  name: string;
  username: string;
  healthy: boolean;
  error?: string | null;
  uploads: number;
  token_masked?: string;
  token_hash?: string;
}

export interface StorageStats {
  count: number;
  total_size: number;
  total_views: number;
  bot_count: number;
  healthy_bot_count: number;
  user_account_connected?: boolean;
  auth_mode?: AuthMode;
  smart_threshold_mb?: number;
  upload_limit_gb?: number;
  user_profile?: UserProfile | null;
}

export interface AppConfig {
  bot_tokens: string[];
  channel_id: string;
  admin_api_key: string;
  proxy_url?: string | null;
  base_url: string;
  port: number;
  is_configured: boolean;
  
  // MTProto Personal Account & Dual Engine
  api_id?: number | null;
  auth_mode?: AuthMode;
  smart_threshold_mb?: number;
  user_chunk_mb?: number;
  throttle_delay_sec?: number;
  max_parallel_bot_uploads?: number;
  has_session?: boolean;
  has_api_credentials?: boolean;
  masked_phone?: string;
  user_account_connected?: boolean;
  upload_limit_gb?: number;

  // Bandwidth Manager (Phase 6)
  bandwidth_limit_gb?: number;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  speed?: string;
  cloudProgress?: number;
  cloudSpeed?: string;
  cloudEta?: string;
  cloudTransferred?: string;
  error?: string;
  file_id?: string;
  direct_link?: string;
  share_link?: string;
  engine_route?: 'bot' | 'user_account';
  relativeFolder?: string;
}

export interface ActivityLogItem {
  id: string;
  timestamp: number;
  time_str: string;
  tag: 'START' | 'CHUNKING' | 'CHUNK' | 'BOT' | 'DB' | 'THUMB' | 'TRANSMIT' | 'ROUTE' | 'AUTH' | 'CONFIG' | 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO' | string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      minimizeWindow: () => Promise<void>;
      hideToTray: () => Promise<void>;
      maximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void;
      showNotification: (options: { title?: string; body: string }) => Promise<void>;
      onTrayOpenUpload: (callback: () => void) => () => void;
      openFileDialog: (options?: any) => Promise<string[] | undefined>;
      openDirectoryDialog: (options?: any) => Promise<string[] | undefined>;
      saveFileDialog: (defaultName: string) => Promise<string | undefined>;
      openExternal: (url: string) => Promise<void>;
      showItemInFolder: (filePath: string) => Promise<void>;
      getSidecarStatus: () => Promise<{ running: boolean; port: number; baseUrl: string; logs: string[] }>;
      restartSidecar: () => Promise<{ ready: boolean; port: number; baseUrl: string }>;
      getConfigPath: () => Promise<string>;
      onSidecarLog: (callback: (log: string) => void) => () => void;
    };
  }
}

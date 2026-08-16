import axios, { AxiosInstance } from 'axios';
import { AppConfig, BotStatus, FileCategory, FileItem, FolderItem, SortField, SortOrder, StorageStats } from '../types';

let cachedBaseUrl = 'http://127.0.0.1:8082';

export async function getBaseUrl(): Promise<string> {
  if (window.electronAPI) {
    try {
      const status = await window.electronAPI.getSidecarStatus();
      if (status && status.baseUrl) {
        cachedBaseUrl = status.baseUrl;
      }
    } catch (e) {
      console.warn('Failed to get sidecar status from electronAPI:', e);
    }
  }
  return cachedBaseUrl;
}

export function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: cachedBaseUrl,
    timeout: 300000, // 5 min timeout for large uploads
  });

  instance.interceptors.request.use(async (config) => {
    config.baseURL = await getBaseUrl();
    return config;
  });

  return instance;
}

export const api = {
  async getHealth() {
    const client = createApiClient();
    const res = await client.get('/health');
    return res.data;
  },

  async getConfig(): Promise<AppConfig> {
    const client = createApiClient();
    const res = await client.get('/api/config');
    return res.data;
  },

  async updateConfig(data: Partial<AppConfig>) {
    const client = createApiClient();
    const res = await client.post('/api/config', data);
    return res.data;
  },

  // MTProto Personal Account API
  async sendAuthCode(phone: string, apiId: number, apiHash: string) {
    const client = createApiClient();
    const res = await client.post('/api/user/auth/send-code', {
      phone,
      api_id: apiId,
      api_hash: apiHash
    });
    return res.data;
  },

  async signIn(phone: string, code: string, password?: string) {
    const client = createApiClient();
    const res = await client.post('/api/user/auth/sign-in', {
      phone,
      code,
      password: password || undefined
    });
    return res.data;
  },

  async logoutUserAccount() {
    const client = createApiClient();
    const res = await client.post('/api/user/auth/logout');
    return res.data;
  },

  async getUserProfile() {
    const client = createApiClient();
    const res = await client.get('/api/user/profile');
    return res.data;
  },

  async syncChannelLibrary(): Promise<{ status: string; synced_count: number; message: string }> {
    const client = createApiClient();
    const res = await client.post('/api/sync/channel');
    return res.data;
  },

  async getBotsStatus(): Promise<{ bots: BotStatus[] }> {
    const client = createApiClient();
    const res = await client.get('/api/bots/status');
    return res.data;
  },

  async verifyBots(): Promise<{ bots: any[]; channel: any }> {
    const client = createApiClient();
    const res = await client.post('/api/bots/verify');
    return res.data;
  },

  async getStats(): Promise<StorageStats> {
    const client = createApiClient();
    const res = await client.get('/api/stats');
    return res.data;
  },

  async getFiles(params?: {
    search?: string;
    folder?: string;
    limit?: number;
    offset?: number;
    sort_by?: SortField;
    sort_order?: SortOrder;
    category?: FileCategory;
  }): Promise<{ files: FileItem[] }> {
    const client = createApiClient();
    const res = await client.get('/api/files', { params });
    return res.data;
  },

  async bulkDeleteFiles(fileIds: string[]): Promise<{ status: string; deleted_count: number }> {
    const client = createApiClient();
    const res = await client.post('/api/files/bulk-delete', { file_ids: fileIds });
    return res.data;
  },

  async moveFiles(fileIds: string[], targetFolder: string): Promise<{ status: string; moved_count: number }> {
    const client = createApiClient();
    const res = await client.post('/api/files/move', { file_ids: fileIds, target_folder: targetFolder });
    return res.data;
  },

  async getFolders(): Promise<{ folders: FolderItem[] }> {
    const client = createApiClient();
    const res = await client.get('/api/folders');
    return res.data;
  },

  async createFolder(folderPath: string): Promise<{ status: string; folder_path: string }> {
    const client = createApiClient();
    const res = await client.post('/api/folders', { folder_path: folderPath });
    return res.data;
  },

  async deleteFolder(folderPath: string): Promise<{ status: string; folder_path: string }> {
    const client = createApiClient();
    const res = await client.delete('/api/folders', { params: { folder_path: folderPath } });
    return res.data;
  },

  async renameFolder(folderPath: string, newName: string): Promise<{ status: string; old_path: string; new_path: string }> {
    const client = createApiClient();
    const res = await client.post('/api/folders/rename', { folder_path: folderPath, new_name: newName });
    return res.data;
  },

  async getLockedFolders(): Promise<{ locked_folders: string[] }> {
    const client = createApiClient();
    const res = await client.get('/api/folders/locks');
    return res.data;
  },

  async lockFolder(folderPath: string, password: string): Promise<{ status: string; folder_path: string }> {
    const client = createApiClient();
    const res = await client.post('/api/folders/lock', { folder_path: folderPath, password });
    return res.data;
  },

  async unlockFolder(folderPath: string): Promise<{ status: string; folder_path: string }> {
    const client = createApiClient();
    const res = await client.post('/api/folders/unlock', { folder_path: folderPath });
    return res.data;
  },

  async verifyFolderPassword(folderPath: string, password: string): Promise<{ status: string; valid: boolean }> {
    const client = createApiClient();
    const res = await client.post('/api/folders/verify', { folder_path: folderPath, password });
    return res.data;
  },

  async uploadFile(
    file: File,
    options?: {
      expirationDays?: number;
      password?: string;
      folder?: string;
      onProgress?: (percent: number, speedBytesPerSec: number) => void;
    }
  ) {
    const client = createApiClient();
    const formData = new FormData();
    formData.append('file', file);
    if (options?.expirationDays) formData.append('expiration_days', String(options.expirationDays));
    if (options?.password) formData.append('password', options.password);
    if (options?.folder) formData.append('folder', options.folder);

    let lastLoaded = 0;
    let lastTime = Date.now();

    const res = await client.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          const currentTime = Date.now();
          const timeDiff = (currentTime - lastTime) / 1000;
          let speed = 0;
          if (timeDiff > 0.3) {
            speed = (progressEvent.loaded - lastLoaded) / timeDiff;
            lastLoaded = progressEvent.loaded;
            lastTime = currentTime;
          }
          if (options?.onProgress) {
            options.onProgress(percent, speed);
          }
        }
      }
    });
    return res.data;
  },

  async deleteFile(fileId: string) {
    const client = createApiClient();
    const res = await client.delete(`/file/${fileId}`);
    return res.data;
  },

  async renameFile(fileId: string, newName: string) {
    const client = createApiClient();
    const res = await client.post(`/file/${fileId}/rename`, null, { params: { new_name: newName } });
    return res.data;
  },

  async addBot(token: string) {
    const client = createApiClient();
    const res = await client.post('/api/bots/add', { token });
    return res.data;
  },

  async removeBot(tokenHash: string) {
    const client = createApiClient();
    const res = await client.delete(`/api/bots/${tokenHash}`);
    return res.data;
  },

  getFileDownloadUrl(fileId: string, fileName: string, password?: string): string {
    let url = `${cachedBaseUrl}/dl/${fileId}/${encodeURIComponent(fileName)}`;
    if (password) url += `?password=${encodeURIComponent(password)}`;
    return url;
  },

  getFilePreviewUrl(fileId: string): string {
    return `${cachedBaseUrl}/preview/${fileId}`;
  },

  getThumbnailUrl(fileId: string): string {
    return `${cachedBaseUrl}/thumbnail/${fileId}`;
  },

  async getLogs(since: number = 0): Promise<{ logs: any[] }> {
    const client = createApiClient();
    const res = await client.get('/api/logs', { params: { since } });
    return res.data;
  },

  async clearLogs(): Promise<{ status: string }> {
    const client = createApiClient();
    const res = await client.post('/api/logs/clear');
    return res.data;
  }
};

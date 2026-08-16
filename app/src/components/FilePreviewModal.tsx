// InfiniDrive — In-app file preview for images, video, audio, PDF, and text
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  ExternalLink, 
  FileText, 
  Film, 
  Music, 
  Image as ImageIcon, 
  Lock, 
  Eye, 
  Calendar, 
  HardDrive, 
  Check,
  Maximize2,
  Loader2
} from 'lucide-react';
import { FileItem } from '../types';
import { api } from '../api/client';

interface FilePreviewModalProps {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
  onToast
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);

  useEffect(() => {
    setVideoError(false);
    setVideoLoading(true);
    if (!file) return;

    const isText = file.mime_type.includes('text') || 
      /\.(txt|json|md|py|js|ts|tsx|html|css|yaml|yml|log|csv)$/i.test(file.file_name);

    if (isText) {
      setIsLoadingText(true);
      const url = api.getFileDownloadUrl(file.file_id, file.file_name);
      fetch(url)
        .then(res => res.text())
        .then(text => setTextContent(text))
        .catch(err => setTextContent(`Failed to load text preview: ${err.message}`))
        .finally(() => setIsLoadingText(false));
    } else {
      setTextContent(null);
    }
  }, [file]);

  if (!file) return null;

  const previewUrl = api.getFilePreviewUrl(file.file_id);
  const downloadUrl = api.getFileDownloadUrl(file.file_id, file.file_name);

  const isImage = file.mime_type.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.file_name);
  const isVideo = file.mime_type.includes('video') || /\.(mp4|webm|ogg|mov|mkv)$/i.test(file.file_name);
  const isAudio = file.mime_type.includes('audio') || /\.(mp3|wav|ogg|flac|m4a)$/i.test(file.file_name);
  const isPdf = file.mime_type.includes('pdf') || /\.pdf$/i.test(file.file_name);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    onToast('success', 'Link Copied', 'Direct download link copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(downloadUrl);
    } else {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#0d0f15]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-blue-400">
              {isImage && <ImageIcon className="w-5 h-5" />}
              {isVideo && <Film className="w-5 h-5" />}
              {isAudio && <Music className="w-5 h-5" />}
              {!isImage && !isVideo && !isAudio && <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate" title={file.file_name}>
                {file.file_name}
              </h3>
              <p className="text-xs text-slate-400">
            {formatBytes(file.file_size)} • {file.mime_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="btn-secondary text-xs py-1.5 px-3"
              title="Copy Direct Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
            <button
              onClick={() => onDownload(file)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center bg-[#090a0e] min-h-[360px]">
          {isImage ? (
            <img
              src={previewUrl}
              alt={file.file_name}
              className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg border border-white/5"
            />
          ) : isVideo ? (
            !videoError ? (
              <div className="relative max-h-[60vh] max-w-full flex items-center justify-center">
                {videoLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl z-10 space-y-2 pointer-events-none">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-xs text-slate-300 font-medium">Streaming from Telegram Cloud...</span>
                  </div>
                )}
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[60vh] max-w-full rounded-xl shadow-lg border border-white/5 bg-black"
                  onWaiting={() => setVideoLoading(true)}
                  onPlaying={() => setVideoLoading(false)}
                  onCanPlay={() => setVideoLoading(false)}
                  onError={() => {
                    setVideoLoading(false);
                    setVideoError(true);
                  }}
                />
              </div>
            ) : (
              <div className="text-center space-y-4 p-8 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
                  <Film className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{file.file_name}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Format video ini (seperti MKV/codec khusus) membutuhkan pemutar media desktop eksternal (VLC / PotPlayer) untuk pemutaran langsung.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button onClick={handleOpenExternal} className="btn-primary text-xs py-2 px-4">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Putar di VLC / Default Player</span>
                  </button>
                  <button onClick={() => onDownload(file)} className="btn-secondary text-xs py-2 px-4">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Video</span>
                  </button>
                </div>
              </div>
            )
          ) : isAudio ? (
            <div className="w-full max-w-md p-6 rounded-2xl bg-[#12141c] border border-white/10 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/10">
                <Music className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-white truncate">{file.file_name}</h4>
              <audio src={previewUrl} controls autoPlay className="w-full" />
            </div>
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              className="w-full h-[60vh] rounded-xl border border-white/10"
              title="PDF Preview"
            />
          ) : textContent !== null ? (
            <div className="w-full h-full max-h-[60vh] overflow-auto p-4 rounded-xl bg-[#0d0e14] border border-white/5 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
              {isLoadingText ? 'Loading text preview...' : textContent}
            </div>
          ) : (
            <div className="text-center space-y-3 p-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">No Preview Available</h4>
                <p className="text-xs text-slate-400 mt-1">
                  This file type cannot be previewed directly in the viewer.
                </p>
              </div>
              <button onClick={handleOpenExternal} className="btn-secondary text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open via Browser / External Player</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer / Metadata */}
        <div className="p-4 border-t border-white/5 bg-[#0d0f15] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Size: <strong className="text-white">{formatBytes(file.file_size)}</strong> {file.is_chunked ? `(${file.total_chunks} parts)` : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Date: <strong className="text-white">{new Date(file.uploaded_at).toLocaleDateString()}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>Views: <strong className="text-white">{file.view_count}</strong></span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="truncate flex items-center gap-1.5">
              Engine: 
              {file.upload_source === 'user_account' ? (
                <span className="text-purple-300 font-medium flex items-center gap-1">
              MTProto ({file.bot_uploader || 'Account'})
                </span>
              ) : (
                <span className="text-blue-300 font-mono flex items-center gap-1">
              Bot (@{file.bot_uploader || 'Cluster'})
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Bot, 
  User, 
  Zap, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  Loader2, 
  Key, 
  Hash, 
  ArrowRight,
  Info,
  BookOpen,
  Smartphone,
  Lock,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api/client';
import { AppConfig, AuthMode, OTPState, UserProfile } from '../types';
import { HowToInstallModal } from './HowToInstallModal';

interface SetupWizardProps {
  onComplete: () => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onToast }) => {
  // Mode selection
  const [authMode, setAuthMode] = useState<AuthMode>('smart');
  const [isHowToInstallOpen, setIsHowToInstallOpen] = useState(false);

  // Bot Cluster State
  const [tokensText, setTokensText] = useState('');
  const [channelId, setChannelId] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');

  // MTProto Personal Account State
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [otpState, setOtpState] = useState<OTPState>('idle');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Loading & Execution
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOtp = async () => {
    const cleanPhone = phoneNumber.trim();
    const cleanId = parseInt(apiId.trim(), 10);
    const cleanHash = apiHash.trim();

    if (!cleanId || isNaN(cleanId)) {
      onToast('error', 'API ID Required', 'Please enter a valid numeric App api_id from my.telegram.org.');
      return;
    }
    if (!cleanHash) {
      onToast('error', 'API Hash Required', 'Please enter your App api_hash from my.telegram.org.');
      return;
    }
    if (!cleanPhone) {
      onToast('error', 'Phone Number Required', 'Please enter your phone number with country code (e.g. +628123456789).');
      return;
    }

    setIsSendingOtp(true);
    try {
      await api.sendAuthCode(cleanPhone, cleanId, cleanHash);
      setOtpState('code_sent');
      onToast('success', 'OTP Code Sent!', `Telegram has sent a verification code to your Telegram app.`);
    } catch (err: any) {
      onToast('error', 'Failed to Send Code', err.response?.data?.detail || err.message || 'Telegram rejected code request.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      onToast('warning', 'Code Required', 'Please enter the 5-digit verification code from Telegram.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await api.signIn(
        phoneNumber.trim(),
        otpCode.trim(),
        twoFaPassword.trim() || undefined
      );

      if (res.requires_2fa) {
        setOtpState('requires_2fa');
        onToast('info', '2FA Required', 'Two-factor authentication is active on this account. Please enter your 2FA password.');
        return;
      }

      setOtpState('authenticated');
      setUserProfile(res.profile);
      onToast('success', 'Account Connected!', `Welcome @${res.profile.username || res.profile.first_name}!`);
    } catch (err: any) {
      onToast('error', 'Authentication Failed', err.response?.data?.detail || err.message || 'Verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSaveAndFinish = async () => {
    const rawTokens = tokensText.split('\n').map(t => t.trim()).filter(Boolean);
    const cleanChannel = channelId.trim();

    if (authMode === 'bot_only' || authMode === 'smart') {
      if (rawTokens.length === 0 && authMode === 'bot_only') {
        onToast('error', 'Bot Tokens Required', 'Please enter at least 1 Telegram Bot Token from @BotFather.');
        return;
      }
      if (!cleanChannel) {
        onToast('error', 'Channel ID Required', 'Please enter your Telegram Private Channel ID.');
        return;
      }
    }

    if (authMode === 'personal_only' && otpState !== 'authenticated') {
      onToast('error', 'Login Required', 'Please verify and connect your Personal Account first.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.updateConfig({
        bot_tokens: rawTokens,
        channel_id: cleanChannel,
        proxy_url: proxyUrl.trim() || undefined,
        auth_mode: authMode,
        api_id: apiId.trim() ? parseInt(apiId.trim(), 10) : undefined
      });

      if (rawTokens.length > 0) {
        await api.verifyBots().catch(() => {});
      }

      onToast('success', 'Setup Complete!', 'InfiniDrive is configured and ready to use.');
      setTimeout(() => {
        onComplete();
      }, 900);
    } catch (err: any) {
      onToast('error', 'Setup Error', err.response?.data?.detail || err.message || 'Failed to save configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 sm:p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-6 my-auto">
        
        {/* Header Hero */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-indigo-500/20 border border-white/10 text-white shadow-xl">
            <Zap className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Selamat Datang di <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">InfiniDrive v2.0</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Cloud storage tanpa batas bertenaga <strong>Smart Dual-Engine</strong>. Gabungkan kecepatan Bot Cluster dan kapasitas masif Akun Pribadi Telegram.
          </p>

          <div className="pt-2 flex justify-center">
            <button
              onClick={() => setIsHowToInstallOpen(true)}
              className="btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-2 border-blue-500/30 text-blue-300 hover:text-white cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>Buka Panduan Instalasi & Setup Lengkap</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-2.5 p-1.5 rounded-2xl bg-[#0e1017] border border-white/5">
          <button
            onClick={() => setAuthMode('smart')}
            className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
              authMode === 'smart'
                ? 'bg-gradient-to-b from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold">Dual-Engine</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded">
              Rekomendasi
            </span>
          </button>

          <button
            onClick={() => setAuthMode('personal_only')}
            className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
              authMode === 'personal_only'
                ? 'bg-purple-600/20 border border-purple-500/30 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold">Akun Pribadi</span>
            </div>
            <span className="text-[10px] text-purple-300">File 2GB - 100GB</span>
          </button>

          <button
            onClick={() => setAuthMode('bot_only')}
            className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
              authMode === 'bot_only'
                ? 'bg-blue-600/20 border border-blue-500/30 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold">Bot Cluster</span>
            </div>
            <span className="text-[10px] text-slate-500">File &le; 20 MB</span>
          </button>
        </div>

        {/* Configuration Card */}
        <div className="p-6 rounded-2xl bg-[#12141d] border border-white/10 shadow-2xl space-y-5">
          
          {/* Section: Personal Account MTProto (for smart or personal_only) */}
          {(authMode === 'smart' || authMode === 'personal_only') && (
            <div className="space-y-4 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Akun Telegram Pribadi (MTProto)</span>
                </h3>
                {otpState === 'authenticated' && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Terhubung
                  </span>
                )}
              </div>

              {otpState === 'authenticated' && userProfile ? (
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs">
                      {userProfile.first_name ? userProfile.first_name[0] : 'U'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{userProfile.first_name} {userProfile.last_name || ''}</span>
                        {userProfile.username && <span className="text-slate-400 font-mono">(@{userProfile.username})</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {userProfile.phone} · Limit: <strong className="text-purple-300">{userProfile.upload_limit_gb} GB</strong>/file
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOtpState('idle'); setUserProfile(null); }}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-slate-300">App api_id (my.telegram.org)</label>
                      <input
                        type="number"
                        value={apiId}
                        onChange={(e) => setApiId(e.target.value)}
                        placeholder="Contoh: 12345678"
                        disabled={otpState !== 'idle' && otpState !== 'code_sent'}
                        className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 font-mono mt-1 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-300">App api_hash</label>
                      <input
                        type="password"
                        value={apiHash}
                        onChange={(e) => setApiHash(e.target.value)}
                        placeholder="32 karakter alfanumerik"
                        disabled={otpState !== 'idle' && otpState !== 'code_sent'}
                        className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 font-mono mt-1 focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-300">Nomor HP (Format Internasional)</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+6281234567890"
                        disabled={otpState === 'code_sent' || otpState === 'requires_2fa'}
                        className="flex-1 bg-[#0a0c12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-purple-500 outline-none"
                      />
                      {otpState === 'idle' && (
                        <button
                          onClick={handleSendOtp}
                          disabled={isSendingOtp || !phoneNumber.trim()}
                          className="btn-primary text-xs shrink-0 py-2 px-3.5 cursor-pointer disabled:opacity-50"
                        >
                          {isSendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                          <span>Kirim Kode OTP</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* OTP Input Step */}
                  {(otpState === 'code_sent' || otpState === 'requires_2fa') && (
                    <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-purple-300">Masukkan 5-Digit Kode OTP Telegram</span>
                        <button onClick={() => setOtpState('idle')} className="text-[10px] text-slate-400 hover:underline">
                          Kirim Ulang
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="Kode 5-digit"
                          className="w-36 bg-[#0a0c12] border border-purple-500/40 rounded-xl p-2.5 text-xs text-center font-mono text-white tracking-widest focus:border-purple-400 outline-none"
                        />
                        {otpState === 'requires_2fa' && (
                          <input
                            type="password"
                            value={twoFaPassword}
                            onChange={(e) => setTwoFaPassword(e.target.value)}
                            placeholder="Password 2FA"
                            className="flex-1 bg-[#0a0c12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 focus:border-purple-500 outline-none"
                          />
                        )}
                        <button
                          onClick={handleVerifyOtp}
                          disabled={isVerifyingOtp || !otpCode.trim()}
                          className="btn-primary text-xs py-2 px-4 shrink-0 bg-purple-600 hover:bg-purple-500 cursor-pointer disabled:opacity-50"
                        >
                          {isVerifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Verifikasi</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section: Bot Cluster & Channel (for smart or bot_only) */}
          {(authMode === 'smart' || authMode === 'bot_only') && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-400" />
                <span>Multi-Bot Cluster & Telegram Channel</span>
              </h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-400" />
                    Bot Tokens (@BotFather)
                  </label>
                  <span className="text-[10px] text-slate-500">1 token per baris</span>
                </div>
                <textarea
                  value={tokensText}
                  onChange={(e) => setTokensText(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ&#10;987654321:ZYXwvuTSRqponMLKjihgfeDCBA"
                  rows={2}
                  className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-blue-400" />
                  Channel ID (Private Channel)
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="-1001234567890"
                  className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Section: Optional Proxy */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              Proxy URL (Opsional)
            </label>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="http://127.0.0.1:1080 atau socks5://user:pass@host:port"
              className="w-full bg-[#0a0c12] border border-white/5 rounded-xl p-2.5 text-xs text-slate-300 font-mono focus:border-blue-500 outline-none"
            />
          </div>

          {/* Action Submit */}
          <button
            onClick={handleSaveAndFinish}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan & Memverifikasi Koneksi...</span>
              </>
            ) : (
              <>
                <span>Simpan Konfigurasi & Mulai InfiniDrive</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </div>

      {/* How to Install Modal */}
      <HowToInstallModal
        isOpen={isHowToInstallOpen}
        onClose={() => setIsHowToInstallOpen(false)}
      />
    </div>
  );
};

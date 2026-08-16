// InfiniDrive — Settings view: MTProto engine config, language, bot management
import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Hash, 
  Key, 
  Globe, 
  Terminal, 
  RefreshCw, 
  Save, 
  CheckCircle2, 
  Folder, 
  User, 
  Bot, 
  Zap, 
  BookOpen, 
  Smartphone, 
  Trash2, 
  Plus, 
  HardDrive,
  Loader2,
  Languages,
  Check,
  Gauge
} from 'lucide-react';
import { AppConfig, AuthMode, OTPState, UserProfile } from '../types';
import { api } from '../api/client';
import { HowToInstallModal } from './HowToInstallModal';
import { ConfirmModal } from './ConfirmModal';
import { useTranslation, Language } from '../i18n/LanguageContext';

interface SettingsViewProps {
  config: AppConfig | null;
  onRefreshConfig: () => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

const PROXY_TYPES: { value: 'none' | 'socks5' | 'socks4' | 'http' | 'mtproto'; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'socks4', label: 'SOCKS4' },
  { value: 'http', label: 'HTTP' },
  { value: 'mtproto', label: 'MTProto' },
];

type ProxyParsed = { type: 'none' | 'socks5' | 'socks4' | 'http' | 'mtproto'; host: string; port: string; user: string; pass: string; secret: string };

function parseProxyUrl(raw: string): ProxyParsed {
  const empty: ProxyParsed = { type: 'none', host: '', port: '', user: '', pass: '', secret: '' };
  if (!raw) return empty;
  try {
    const u = new URL(raw);
    const scheme = u.protocol.replace(':', '');
    if (scheme === 'socks5') {
      return { type: 'socks5', host: u.hostname, port: u.port, user: decodeURIComponent(u.username || ''), pass: decodeURIComponent(u.password || ''), secret: '' };
    }
    if (scheme === 'socks4') return { type: 'socks4', host: u.hostname, port: u.port, user: '', pass: '', secret: '' };
    if (scheme === 'http' || scheme === 'https') return { type: 'http', host: u.hostname, port: u.port, user: '', pass: '', secret: '' };
    if (scheme === 'mtproxy') return { type: 'mtproto', host: u.hostname, port: u.port, user: '', pass: '', secret: decodeURIComponent(u.username || '') };
  } catch {
    /* malformed proxy url; fall back to empty */
  }
  return empty;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onRefreshConfig,
  onToast
}) => {
  const { lang, setLang, t } = useTranslation();

  // Modal state
  const [isHowToInstallOpen, setIsHowToInstallOpen] = useState(false);
  const [botToRemove, setBotToRemove] = useState<{ tokenHash: string; name: string } | null>(null);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);

  // Form states
  const [authMode, setAuthMode] = useState<AuthMode>('smart');
  const [smartThresholdMb, setSmartThresholdMb] = useState<number>(20);
  const [throttleDelaySec, setThrottleDelaySec] = useState<number>(1.0);
  const [maxParallelBotUploads, setMaxParallelBotUploads] = useState<number>(4);
  const [userChunkMb, setUserChunkMb] = useState<number>(1900);
  const [bandwidthLimitGb, setBandwidthLimitGb] = useState<string>('250');
  const [isSavingBandwidth, setIsSavingBandwidth] = useState(false);

  const [channelId, setChannelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [proxyType, setProxyType] = useState<'none' | 'socks5' | 'socks4' | 'http' | 'mtproto'>('none');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [proxySecret, setProxySecret] = useState('');

  // MTProto Personal Account state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isUserConnected, setIsUserConnected] = useState<boolean>(false);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [otpState, setOtpState] = useState<OTPState>('idle');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Bot Cluster Management state
  const [bots, setBots] = useState<any[]>([]);
  const [newBotToken, setNewBotToken] = useState('');
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [isVerifyingBots, setIsVerifyingBots] = useState(false);

  // Sidecar & Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [sidecarStatus, setSidecarStatus] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [configPath, setConfigPath] = useState<string>('');

  useEffect(() => {
    if (config) {
      setChannelId(config.channel_id || '');
      setApiKey(config.admin_api_key || '');
      const pp = parseProxyUrl(config.proxy_url || '');
      setProxyType(pp.type);
      setProxyHost(pp.host);
      setProxyPort(pp.port);
      setProxyUser(pp.user);
      setProxyPass(pp.pass);
      setProxySecret(pp.secret);
      setAuthMode(config.auth_mode || 'smart');
      setSmartThresholdMb(config.smart_threshold_mb || 20);
      setThrottleDelaySec(config.throttle_delay_sec || 1.0);
      setMaxParallelBotUploads(config.max_parallel_bot_uploads || 4);
      setUserChunkMb(config.user_chunk_mb || 1900);
      setBandwidthLimitGb(String(config.bandwidth_limit_gb ?? 250));
      if (config.api_id) setApiId(String(config.api_id));
    }
  }, [config]);

  // Load user profile & bots
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const prof = await api.getUserProfile();
        if (prof && prof.is_connected) {
          setUserProfile(prof);
          setIsUserConnected(true);
        } else {
          setUserProfile(null);
          setIsUserConnected(false);
        }
      } catch (e) {
        setUserProfile(null);
        setIsUserConnected(false);
      }

      try {
        const b = await api.getBotsStatus();
        if (b && b.bots) setBots(b.bots);
      } catch (e) {}
    };

    fetchUserData();
  }, [config]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSidecarStatus().then(status => {
        setSidecarStatus(status);
        if (status?.logs) setLogs(status.logs);
      });
      window.electronAPI.getConfigPath().then(setConfigPath);

      const unsubscribe = window.electronAPI.onSidecarLog((log) => {
        setLogs(prev => [...prev.slice(-300), log]);
      });
      return () => unsubscribe();
    }
  }, []);

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
      onToast('success', 'OTP Code Sent!', 'Telegram has dispatched a verification code to your Telegram app.');
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

      setOtpState('idle');
      setUserProfile(res.profile);
      setIsUserConnected(true);
      onToast('success', 'Account Connected!', `Welcome @${res.profile.username || res.profile.first_name}!`);
      onRefreshConfig();
    } catch (err: any) {
      onToast('error', 'Authentication Failed', err.response?.data?.detail || err.message || 'Verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleLogoutUser = async () => {
    try {
      await api.logoutUserAccount();
      setUserProfile(null);
      setIsUserConnected(false);
      setIsConfirmLogoutOpen(false);
      onToast('info', 'Account Disconnected', 'Your Telegram personal account has been disconnected.');
      onRefreshConfig();
    } catch (err: any) {
      onToast('error', 'Logout Error', err.message);
    }
  };

  const handleAddBot = async () => {
    const token = newBotToken.trim();
    if (!token) return;

    setIsAddingBot(true);
    try {
      const res = await api.addBot(token);
      setNewBotToken('');
      onToast('success', 'Bot Added', `@${res.bot?.username || 'Bot'} added to active cluster.`);
      const b = await api.getBotsStatus();
      if (b && b.bots) setBots(b.bots);
      onRefreshConfig();
    } catch (err: any) {
      onToast('error', 'Failed to Add Bot', err.response?.data?.detail || err.message);
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleExecuteRemoveBot = async () => {
    if (!botToRemove) return;
    try {
      await api.removeBot(botToRemove.tokenHash);
      onToast('info', 'Bot Removed', `@${botToRemove.name} removed from cluster.`);
      setBotToRemove(null);
      const b = await api.getBotsStatus();
      if (b && b.bots) setBots(b.bots);
      onRefreshConfig();
    } catch (err: any) {
      onToast('error', 'Error', err.message);
    }
  };

  const handleVerifyAllBots = async () => {
    setIsVerifyingBots(true);
    try {
      const res = await api.verifyBots();
      const healthy = res.bots.filter((b: any) => b.healthy).length;
      onToast('success', 'Cluster Verified', `${healthy} of ${res.bots.length} bots operational.`);
      const b = await api.getBotsStatus();
      if (b && b.bots) setBots(b.bots);
    } catch (err: any) {
      onToast('error', 'Verification Failed', err.message);
    } finally {
      setIsVerifyingBots(false);
    }
  };

  const parseBandwidthLimit = (raw: string): number => {
    const parsed = parseFloat(raw);
    if (!isFinite(parsed) || parsed <= 0) return 250;
    return parsed;
  };

  // Persist the daily bandwidth quota on blur (reuses the shared config endpoint).
  const handleSaveBandwidthLimit = async () => {
    const limit = parseBandwidthLimit(bandwidthLimitGb);
    setBandwidthLimitGb(String(limit));
    if (config && Number(config.bandwidth_limit_gb ?? 250) === limit) return;

    setIsSavingBandwidth(true);
    try {
      await api.updateConfig({ bandwidth_limit_gb: limit });
      onToast('success', t('settings_bandwidth_title'), `${t('settings_bandwidth_label')}: ${limit} GB`);
      onRefreshConfig();
    } catch (err: any) {
      onToast('error', 'Failed to Save', err.response?.data?.detail || err.message);
    } finally {
      setIsSavingBandwidth(false);
    }
  };

  const buildProxyUrl = (): string => {
    const host = proxyHost.trim();
    const port = proxyPort.trim();
    if (proxyType === 'none' || !host || !port) return '';
    if (proxyType === 'socks5') {
      const auth = proxyUser.trim() ? `${encodeURIComponent(proxyUser.trim())}:${encodeURIComponent(proxyPass)}@` : '';
      return `socks5://${auth}${host}:${port}`;
    }
    if (proxyType === 'socks4') return `socks4://${host}:${port}`;
    if (proxyType === 'http') return `http://${host}:${port}`;
    if (proxyType === 'mtproto') {
      const secret = proxySecret.trim();
      if (!secret) return '';
      return `mtproxy://${secret}@${host}:${port}`;
    }
    return '';
  };

  const handleSaveAllSettings = async () => {    setIsSaving(true);
    try {
      await api.updateConfig({
        channel_id: channelId.trim(),
        admin_api_key: apiKey.trim() || 'tgdrive_secret_key',
        proxy_url: buildProxyUrl() || undefined,
        auth_mode: authMode,
        smart_threshold_mb: smartThresholdMb,
        throttle_delay_sec: throttleDelaySec,
        max_parallel_bot_uploads: maxParallelBotUploads,
        user_chunk_mb: userChunkMb,
        bandwidth_limit_gb: parseBandwidthLimit(bandwidthLimitGb),
        api_id: apiId.trim() ? parseInt(apiId.trim(), 10) : undefined
      });
      onToast('success', t('toast_settings_saved'), t('toast_settings_saved_msg'));
      onRefreshConfig();
    } catch (err: any) {
      onToast('error', 'Failed to Save', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestartSidecar = async () => {
    if (!window.electronAPI) return;
    setIsRestarting(true);
    try {
      const res = await window.electronAPI.restartSidecar();
      onToast('info', 'Sidecar Restarted', `Backend is running on port ${res.port}`);
      onRefreshConfig();
    } catch (err: any) {
      onToast('error', 'Restart Error', err.message);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleOpenConfigFolder = () => {
    if (configPath && window.electronAPI) {
      window.electronAPI.showItemInFolder(configPath);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 select-none bg-[#080a10]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            {t('set_title')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('set_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHowToInstallOpen(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 border-blue-500/30 text-blue-300 hover:text-white cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('set_btn_guide')}</span>
          </button>

          <button
            onClick={handleSaveAllSettings}
            disabled={isSaving}
            className="btn-primary text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-600/20"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{t('set_btn_save_all')}</span>
          </button>
        </div>
      </div>

      {/* Grid of Control Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION 0: LANGUAGE & LOCALE SELECTION */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-blue-500/20 space-y-4 shadow-sm relative overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-blue-400" />
              {t('set_lang_section_title')}
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
              {t('set_lang_section_badge')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* English Card */}
            <div
              onClick={() => setLang('en')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                lang === 'en'
                  ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-[#0c0e16] border-white/5 hover:border-white/15 hover:bg-[#10131d]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg shrink-0">
                  EN
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    {t('set_lang_en_title')}
                    {lang === 'en' && <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">Active</span>}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t('set_lang_en_desc')}</p>
                </div>
              </div>

              {lang === 'en' && (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>

            {/* Indonesian Card */}
            <div
              onClick={() => setLang('id')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                lang === 'id'
                  ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-[#0c0e16] border-white/5 hover:border-white/15 hover:bg-[#10131d]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">
                  ID
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    {t('set_lang_id_title')}
                    {lang === 'id' && <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Aktif</span>}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t('set_lang_id_desc')}</p>
                </div>
              </div>

              {lang === 'id' && (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 1: SMART DUAL-ENGINE ROUTING */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-white/5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              {t('set_dual_engine_title')}
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {t('set_dual_engine_badge')}
            </span>
          </div>

          {/* Mode Selector Buttons */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAuthMode('smart')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  authMode === 'smart'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                    : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Smart (Dual)</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthMode('personal_only')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  authMode === 'personal_only'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 border border-purple-400/40'
                    : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                <User className="w-3.5 h-3.5 text-purple-300" />
                <span>MTProto Only</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthMode('bot_only')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  authMode === 'bot_only'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/40'
                    : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-300" />
                <span>Bot Only</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {authMode === 'smart' && t('set_mode_smart_desc', { mb: smartThresholdMb })}
              {authMode === 'personal_only' && t('set_mode_personal_desc')}
              {authMode === 'bot_only' && t('set_mode_bot_desc')}
            </p>
          </div>

          {/* Threshold Sliders */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                <span>{t('set_smart_threshold')}</span>
                <span className="font-mono text-blue-400">{smartThresholdMb} MB</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={smartThresholdMb}
                onChange={(e) => setSmartThresholdMb(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                <span>{t('set_throttle_delay')}</span>
                <span className="font-mono text-amber-400">{throttleDelaySec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={throttleDelaySec}
                onChange={(e) => setThrottleDelaySec(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                <span>{t('set_parallel_workers')}</span>
                <span className="font-mono text-emerald-400">{maxParallelBotUploads} Workers</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={maxParallelBotUploads}
                onChange={(e) => setMaxParallelBotUploads(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PERSONAL MTPROTO USER ACCOUNT */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-white/5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              {t('set_mtproto_account_title')}
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {t('set_mtproto_account_badge')}
            </span>
          </div>

          {isUserConnected && userProfile ? (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center font-bold text-purple-300 text-sm">
                    {userProfile.first_name?.[0] || 'U'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      {userProfile.first_name} {userProfile.last_name || ''}
                      <span className="text-[10px] text-purple-300 font-mono">(@{userProfile.username || 'user'})</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {userProfile.is_premium ? t('set_premium_user') : t('set_standard_user')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsConfirmLogoutOpen(true)}
                  className="btn-danger text-xs py-1.5 px-3 cursor-pointer"
                >
                  {t('set_btn_disconnect')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-300">{t('set_api_id_label')}</label>
                  <input
                    type="number"
                    value={apiId}
                    onChange={(e) => setApiId(e.target.value)}
                    placeholder="my.telegram.org"
                    className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-300">{t('set_api_hash_label')}</label>
                  <input
                    type="password"
                    value={apiHash}
                    onChange={(e) => setApiHash(e.target.value)}
                    placeholder="32 characters"
                    className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300">{t('set_phone_label')}</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+6281234567890"
                    disabled={otpState === 'code_sent' || otpState === 'requires_2fa'}
                    className="flex-1 bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-purple-500 outline-none"
                  />
                  {otpState === 'idle' && (
                    <button
                      onClick={handleSendOtp}
                      disabled={isSendingOtp || !phoneNumber.trim()}
                      className="btn-primary text-xs shrink-0 py-2 px-3.5 bg-purple-600 hover:bg-purple-500 cursor-pointer disabled:opacity-50"
                    >
                      {isSendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                      <span>{t('set_btn_send_code')}</span>
                    </button>
                  )}
                </div>
              </div>

              {(otpState === 'code_sent' || otpState === 'requires_2fa') && (
                <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-300">{t('set_otp_label')}</span>
                    <button onClick={() => setOtpState('idle')} className="text-[10px] text-slate-400 hover:underline">
                      Reset
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="5-digit OTP"
                      className="w-32 bg-[#0a0c12] border border-purple-500/40 rounded-xl p-2 text-xs text-center font-mono text-white tracking-widest outline-none"
                    />
                    {otpState === 'requires_2fa' && (
                      <input
                        type="password"
                        value={twoFaPassword}
                        onChange={(e) => setTwoFaPassword(e.target.value)}
                        placeholder="2FA Password"
                        className="flex-1 bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 outline-none"
                      />
                    )}
                    <button
                      onClick={handleVerifyOtp}
                      disabled={isVerifyingOtp || !otpCode.trim()}
                      className="btn-primary text-xs py-2 px-3.5 bg-purple-600 hover:bg-purple-500 cursor-pointer disabled:opacity-50"
                    >
                      {isVerifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{t('set_btn_verify_code')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: BOT CLUSTER MANAGEMENT */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-white/5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              {t('set_bot_cluster_title', { count: bots.length, plural: bots.length !== 1 ? 's' : '' })}
            </h3>
            <button
              onClick={handleVerifyAllBots}
              disabled={isVerifyingBots}
              className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isVerifyingBots ? 'animate-spin text-blue-400' : ''}`} />
              <span>{t('set_btn_verify_cluster')}</span>
            </button>
          </div>

          {/* Add Bot Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newBotToken}
              onChange={(e) => setNewBotToken(e.target.value)}
              placeholder={t('set_add_bot_placeholder')}
              className="flex-1 bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleAddBot}
              disabled={isAddingBot || !newBotToken.trim()}
              className="btn-primary text-xs py-2 px-3.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isAddingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{t('set_btn_add_node')}</span>
            </button>
          </div>

          {/* Bot Nodes List */}
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {bots.length === 0 ? (
              <div className="text-center p-4 text-xs text-slate-500">{t('bm_empty_bots')}</div>
            ) : (
              bots.map((b, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${b.healthy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className="font-mono font-bold text-slate-200 truncate">@{b.username || b.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({b.uploads || 0} uploads)</span>
                  </div>
                  <button
                    onClick={() => setBotToRemove({ tokenHash: b.token_hash || b.name, name: b.username || b.name })}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 4: TELEGRAM STORAGE & NETWORK */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-white/5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            Telegram Storage
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-blue-400" />
              {t('set_channel_id_label')}
            </label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                {t('set_api_key_label')}
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="tgdrive_secret_key"
                className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                {t('set_proxy_label')}
              </label>
              <select
                value={proxyType}
                onChange={(e) => setProxyType(e.target.value as 'none' | 'socks5' | 'socks4' | 'http' | 'mtproto')}
                className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 focus:border-blue-500 outline-none"
              >
                {PROXY_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>

              {proxyType !== 'none' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">{t('settings_proxy_host')}</label>
                    <input
                      type="text"
                      value={proxyHost}
                      onChange={(e) => setProxyHost(e.target.value)}
                      placeholder="127.0.0.1"
                      className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">{t('settings_proxy_port')}</label>
                    <input
                      type="text"
                      value={proxyPort}
                      onChange={(e) => setProxyPort(e.target.value)}
                      placeholder="1080"
                      className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                    />
                  </div>

                  {proxyType === 'socks5' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-400">{t('settings_proxy_user')}</label>
                        <input
                          type="text"
                          value={proxyUser}
                          onChange={(e) => setProxyUser(e.target.value)}
                          placeholder="user (optional)"
                          className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-400">{t('settings_proxy_pass')}</label>
                        <input
                          type="password"
                          value={proxyPass}
                          onChange={(e) => setProxyPass(e.target.value)}
                          placeholder="password (optional)"
                          className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                        />
                      </div>
                    </>
                  )}

                  {proxyType === 'mtproto' && (
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[11px] font-medium text-slate-400">{t('settings_proxy_secret')}</label>
                      <input
                        type="text"
                        value={proxySecret}
                        onChange={(e) => setProxySecret(e.target.value)}
                        placeholder="MTProto secret (hex or ee-prefixed)"
                        className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bandwidth Manager (Phase 6) */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              {t('settings_bandwidth_label')}
              {isSavingBandwidth && <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />}
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={bandwidthLimitGb}
              onChange={(e) => setBandwidthLimitGb(e.target.value)}
              onBlur={handleSaveBandwidthLimit}
              placeholder={t('settings_bandwidth_placeholder')}
              className="w-full bg-[#0a0c12] border border-white/10 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-cyan-500 outline-none"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {t('settings_bandwidth_hint')}
            </p>
          </div>
        </div>

        {/* SECTION 5: BACKEND SIDECAR & RUNTIME LOGS */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-white/5 space-y-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              {t('set_diagnostics_title')}
            </h3>

            <button
              onClick={handleRestartSidecar}
              disabled={isRestarting}
              className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRestarting ? 'animate-spin text-blue-400' : ''}`} />
              <span>{t('set_btn_restart_sidecar')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between items-center">
              <span className="text-slate-400">{t('set_status_label')}</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Online (v2.0)
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between items-center">
              <span className="text-slate-400">{t('set_endpoint_label')}</span>
              <span className="text-slate-200 font-mono">{sidecarStatus?.baseUrl || 'http://127.0.0.1:8082'}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between items-center">
              <span className="text-slate-400">{t('set_config_folder_label')}</span>
              <button
                onClick={handleOpenConfigFolder}
                className="text-blue-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Folder className="w-3 h-3" />
                <span>{t('set_btn_open_folder')}</span>
              </button>
            </div>
          </div>

          {/* Console Output */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400">{t('set_runtime_logs_label')}</label>
            <div className="h-32 overflow-y-auto p-3 rounded-xl bg-[#090a0e] border border-white/5 font-mono text-[10px] text-slate-400 space-y-0.5 select-text">
              {logs.length === 0 ? (
                <div className="text-slate-600">Waiting for backend logs...</div>
              ) : (
                logs.map((line, idx) => (
                  <div key={idx} className="leading-tight break-all">{line}</div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* How to Install Modal */}
      <HowToInstallModal
        isOpen={isHowToInstallOpen}
        onClose={() => setIsHowToInstallOpen(false)}
      />

      {/* Custom Confirm Modal: Remove Bot */}
      <ConfirmModal
        isOpen={Boolean(botToRemove)}
        onClose={() => setBotToRemove(null)}
        onConfirm={handleExecuteRemoveBot}
        title={t('modal_confirm_remove_bot_title')}
        message={t('modal_confirm_remove_bot_msg', { name: botToRemove?.name || 'Bot' })}
        variant="warning"
        iconType="trash"
      />

      {/* Custom Confirm Modal: Disconnect Account */}
      <ConfirmModal
        isOpen={isConfirmLogoutOpen}
        onClose={() => setIsConfirmLogoutOpen(false)}
        onConfirm={handleLogoutUser}
        title={t('modal_confirm_logout_title')}
        message={t('modal_confirm_logout_msg')}
        variant="danger"
        iconType="logout"
      />
    </div>
  );
};

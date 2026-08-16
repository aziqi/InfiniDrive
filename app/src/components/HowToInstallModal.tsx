import React, { useState } from 'react';
import { 
  X, 
  Bot, 
  User, 
  Zap, 
  HelpCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  ChevronRight, 
  Sparkles,
  ArrowRight,
  Info,
  Server,
  Key,
  Smartphone,
  Hash
} from 'lucide-react';

interface HowToInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToInstallModal: React.FC<HowToInstallModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openUrl = (url: string) => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const tabs = [
    { id: 0, label: 'Bot Cluster (@BotFather)', icon: Bot, badge: 'File Kecil' },
    { id: 1, label: 'Akun Pribadi (my.telegram.org)', icon: User, badge: 'File Besar 2-100GB' },
    { id: 2, label: 'Smart Dual-Engine', icon: Zap, badge: 'Rekomendasi' },
    { id: 3, label: 'FAQ & Keamanan', icon: HelpCircle }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#10121a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-white/5 bg-[#0d0f16] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Panduan Instalasi & Konfigurasi Lengkap
              </h2>
              <p className="text-xs text-slate-400">
                Langkah mudah mengintegrasikan Bot Cluster & Akun Pribadi Telegram ke InfiniDrive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 bg-[#0a0c12] px-4 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-blue-500 text-blue-400 bg-white/[0.02]'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.01]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {t.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                    t.badge === 'Rekomendasi' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-white/10 text-slate-300'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 0: BOT CLUSTER */}
          {activeTab === 0 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
                <div>
                  <strong>Mengapa Memakai Bot Cluster?</strong>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">
                    Bot Cluster memakai Telegram Bot API untuk mengunggah ratusan file kecil (&le; 20 MB) secara paralel dan seimbang (load-balanced), sehingga akun pribadi Anda 100% bebas dari batasan <em>flood limit</em>.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">1</span>
                    <h4 className="text-xs font-bold text-white">Buat Bot Telegram di @BotFather</h4>
                  </div>
                  <button
                    onClick={() => openUrl('https://t.me/BotFather')}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <span>Buka @BotFather</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Kirim perintah <code className="bg-black/40 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[11px]">/newbot</code> ke @BotFather di Telegram, beri nama bot Anda, lalu salin <strong>Bot API Token</strong> yang diberikan (contoh: <code className="text-slate-300 font-mono text-[10px]">123456789:ABCdefGHI...</code>).
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">2</span>
                    <h4 className="text-xs font-bold text-white">Buat Channel Privat & Jadikan Bot sebagai Admin</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Buat Channel Telegram baru (set ke <strong>Private Channel</strong>). Buka <em>Channel Settings &rarr; Administrators &rarr; Add Admin</em>, lalu cari username bot Anda dan jadikan admin dengan izin <strong>Post Messages</strong>.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">3</span>
                    <h4 className="text-xs font-bold text-white">Dapatkan Channel ID Telegram</h4>
                  </div>
                  <button
                    onClick={() => openUrl('https://t.me/JsonDumpBot')}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <span>Buka @JsonDumpBot</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Kirim sembarang pesan ke channel privat Anda, lalu <strong>forward</strong> pesan tersebut ke bot <code className="bg-black/40 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[11px]">@JsonDumpBot</code>. Salin ID channel (biasanya berawalan <code className="text-emerald-400 font-mono text-[11px]">-100...</code>).
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">4</span>
                  <h4 className="text-xs font-bold text-white">Masukkan di Setup Wizard / Settings</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Tempel token bot dan channel ID pada form konfigurasi. Anda bisa menambahkan 2 sampai 10 bot sekaligus untuk mempercepat proses upload paralel!
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: PERSONAL ACCOUNT */}
          {activeTab === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0 text-purple-400 mt-0.5" />
                <div>
                  <strong>Kapasitas Upload Raksasa hingga 100 GB+</strong>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">
                    Integrasi Akun Pribadi Telegram memakai protokol resmi <strong>MTProto</strong>. Mengizinkan upload file berukuran hingga <strong>2 GB</strong> (atau <strong>4 GB</strong> untuk pengguna Telegram Premium) dalam satu file tunggal, serta file raksasa &gt; 2 GB via pemotongan <em>chunk</em> 1.9 GB secara otomatis.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">1</span>
                    <h4 className="text-xs font-bold text-white">Buka my.telegram.org & Login</h4>
                  </div>
                  <button
                    onClick={() => openUrl('https://my.telegram.org')}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <span>Buka my.telegram.org</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Buka portal resmi Telegram di <strong className="text-white">my.telegram.org</strong>, masukkan nomor HP Anda, dan ketik kode konfirmasi login yang dikirimkan ke aplikasi Telegram Anda.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">2</span>
                  <h4 className="text-xs font-bold text-white">Klik "API development tools" & Buat App</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Pilih menu <strong>API development tools</strong>. Isi formulir sederhana (App title & Short name, misal: <em>InfiniDrive</em>), lalu klik <em>Create application</em>.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">3</span>
                  <h4 className="text-xs font-bold text-white">Salin App api_id & App api_hash</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Salin <strong>api_id</strong> (berupa angka) dan <strong>api_hash</strong> (berupa teks alfanumerik 32 karakter).
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">4</span>
                  <h4 className="text-xs font-bold text-white">Masukkan di InfiniDrive & Verifikasi Kode OTP</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">
                  Pada Setup Wizard / Settings InfiniDrive, pilih <strong>Akun Pribadi</strong>, isi API ID, API Hash, dan nomor HP Anda. Klik <em>"Kirim Kode OTP"</em>, masukkan 5 digit kode yang diterima, dan selesai! Sesi tersimpan aman di komputer lokal Anda.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SMART DUAL-ENGINE */}
          {activeTab === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-3">
                <Zap className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong>Arsitektur Dual-Engine: Terbaik dari Kedua Dunia</strong>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">
                    InfiniDrive otomatis memilih rute transmisi terbaik untuk setiap file secara cerdas.
                  </p>
                </div>
              </div>

              {/* Comparison Matrix */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-[#0d0f16]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-300 font-semibold border-b border-white/5">
                    <tr>
                      <th className="p-3">Ukuran File</th>
                      <th className="p-3">Engine yang Dipakai</th>
                      <th className="p-3">Keuntungan Utama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3 font-mono font-bold text-blue-400">&le; 20 MB</td>
                      <td className="p-3 flex items-center gap-1.5 text-blue-300">
                        <Bot className="w-3.5 h-3.5" />
                        <span>Bot Cluster</span>
                      </td>
                      <td className="p-3 text-slate-400">Paralel, super cepat, tanpa menyentuh kuota akun pribadi</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3 font-mono font-bold text-purple-400">&gt; 20 MB s/d 2 GB</td>
                      <td className="p-3 flex items-center gap-1.5 text-purple-300">
                        <User className="w-3.5 h-3.5" />
                        <span>MTProto (Single)</span>
                      </td>
                      <td className="p-3 text-slate-400">1 pesan langsung tanpa dipotong, streaming instan</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3 font-mono font-bold text-amber-400">&gt; 2 GB s/d 100 GB+</td>
                      <td className="p-3 flex items-center gap-1.5 text-amber-300">
                        <Zap className="w-3.5 h-3.5" />
                        <span>MTProto (1.9 GB Chunk)</span>
                      </td>
                      <td className="p-3 text-slate-400">Hanya ~53 part untuk 100GB (vs 5.200 part bot), auto-resume</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Threshold customization hint */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Kustomisasi Batas Ukuran di Menu Settings</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Anda dapat mengubah batas peralihan rute (default: 20 MB) secara bebas antara <strong>5 MB hingga 50 MB</strong> melalui slider interaktif di tab <strong>Settings</strong> kapan saja.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: FAQ & KEAMANAN */}
          {activeTab === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Apakah data login & akun saya aman?</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong>100% Aman.</strong> InfiniDrive Desktop berjalan secara lokal di komputer Anda. Sesi MTProto disimpan dalam format terenkripsi pada folder <code className="text-blue-300 font-mono text-[11px]">%APPDATA%/InfiniDrive</code> dan langsung berkomunikasi dengan server Telegram tanpa perantara pihak ketiga.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Apa itu FloodWait dan bagaimana InfiniDrive menanganinya?</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Telegram memiliki proteksi laju request (Rate Limit). Jika batas tercapai, server Telegram meminta waktu jeda (cooldown). InfiniDrive secara otomatis menangkap sinyal ini, menjeda proses, dan <strong>melanjutkan kembali dari chunk terakhir yang belum selesai</strong> tanpa merusak file Anda.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <span>Berapa kapasitas penyimpanan total Telegram Cloud?</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Telegram menyediakan penyimpanan cloud <strong>tanpa batas (unlimited storage)</strong> pada Private Channel Anda secara gratis.
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0d0f16] flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            InfiniDrive Desktop v2.0 - Turbo Edition
          </span>
          <button
            onClick={onClose}
            className="btn-primary text-xs py-2 px-5 cursor-pointer"
          >
            <span>Tutup Panduan</span>
          </button>
        </div>

      </div>
    </div>
  );
};

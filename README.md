<div align="center">

<img src="assets/logo.png" alt="InfiniDrive Logo" width="128" style="border-radius: 24px; margin-bottom: 8px;" />

# ⚡ InfiniDrive Desktop

### Infinite Telegram Cloud Storage — Powered by Dual-Engine Architecture

[![Platform](https://img.shields.io/badge/Platform-Windows%2011-0078D4?style=for-the-badge&logo=windows11)](https://github.com/aziqi/InfiniDrive/releases)
[![Version](https://img.shields.io/badge/Version-v1.0.0-blue?style=for-the-badge)](https://github.com/aziqi/InfiniDrive/releases/tag/v1.0.0)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Made with Electron](https://img.shields.io/badge/Built%20with-Electron%2033-9feaf9?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![Telegram](https://img.shields.io/badge/Storage-Telegram%20Cloud-2CA5E0?style=for-the-badge&logo=telegram)](https://telegram.org/)

**InfiniDrive** turns your Telegram into unlimited, zero-cost cloud storage with a blazing-fast **Dual-Engine** architecture — run bot clusters for everyday files, or activate your **personal Telegram account via MTProto** for massive files at 100+ MB/s.

[📥 Download Setup](https://github.com/aziqi/InfiniDrive/releases/latest) · [📦 Portable .exe](https://github.com/aziqi/InfiniDrive/releases/latest) · [⭐ Star this repo](https://github.com/aziqi/InfiniDrive)

</div>

---

## 🚀 Dual-Engine Architecture — Choose Your Power Mode

InfiniDrive ships two upload/download engines that work simultaneously or independently:

| Feature | 🤖 Bot Cluster Engine | ⚡ MTProto Direct Engine |
|---|---|---|
| **How it works** | Uses Telegram Bot API tokens | Logs in with your personal Telegram account |
| **Best for** | Files < 20 MB, anonymous use | **Files ≥ 20 MB, large folders, archives** |
| **Speed** | Up to 20 MB/s per bot | **Up to 100+ MB/s (12 parallel connections)** |
| **File size limit** | 50 MB per chunk | **4 GB+ per file (no Telegram Bot limit!)** |
| **Rate limit** | Shared Bot API quota | Personal account — virtually no rate limit |
| **Setup** | Bot Token + Channel ID | API ID + API Hash + Phone Number |
| **Recommended?** | ✅ Quick & anonymous | ✅ **Highly recommended for large files** |

> **💡 Smart Mode (Default):** InfiniDrive automatically switches to MTProto engine when a file exceeds the threshold (default: 20 MB), giving you the best of both worlds without manual switching.

---

## ⚡ MTProto Engine — Login with Your Telegram Account

> **🔥 For files ≥ 20 MB, MTProto is STRONGLY RECOMMENDED.**

The MTProto engine uses your **personal Telegram account** (via [Telethon](https://github.com/LonamiWebs/Telethon)) to bypass Bot API limitations entirely:

- 🚀 **100+ MB/s** upload speed with 12 parallel MTProto connections
- 📦 **No 50 MB chunk limit** — upload a 4GB `.zip` as a single continuous stream
- 🔄 **Zero rate limiting** — your personal account has a much higher quota than bots
- 🛡️ **Session saved locally** — you only need to log in once (OTP via Telegram app)

### How to Enable MTProto Engine:

1. Go to **[my.telegram.org/apps](https://my.telegram.org/apps)** and log in
2. Create a new app → copy your **API ID** and **API Hash**
3. Open InfiniDrive → **Settings** → **MTProto Engine** tab
4. Enter your `API ID`, `API Hash`, and phone number (e.g. `+62812345678`)
5. Click **Connect & Verify** → enter the OTP code sent to your Telegram app
6. Done! Your session is saved. InfiniDrive will now use MTProto for large files automatically.

---

## ✨ All Features

<details>
<summary><b>📁 Smart File Management</b></summary>

- **Recursive Windows folder upload** — drag an entire directory and InfiniDrive preserves the full tree structure with 100% accurate byte sizes
- **Folder context menu (3-dots)** — Lock with password, Rename, or Delete any folder
- **Password-lock folders** — protect sensitive directories with a custom password
- **Smart Multi-Select**:
  - `Ctrl + A` — select all visible files instantly
  - `Shift + Click` — select a contiguous range from point A to point Z
  - `Escape` — deselect all

</details>

<details>
<summary><b>🗕 Minimizable Turbo Upload Dock</b></summary>

While uploading, click the **`—` minimize button** in the upload window header. The full modal collapses into a **compact floating dock** pinned to the bottom-right corner showing:

- ⚡ **Live upload speed** (e.g. `81.08 MB/s`)
- ⏱️ **ETA** (estimated time remaining)
- 📊 **Progress bar** with overall percentage
- 🔲 **Expand button** to restore the full window anytime

The upload **continues in the background** — you can browse, create folders, or adjust settings while files are being uploaded.

</details>

<details>
<summary><b>📺 Media Streaming & File Preview</b></summary>

- **Video player** — MP4, MKV with seekable range-request streaming
- **Audio player** — MP3, FLAC, WAV with waveform visualization
- **Image viewer** — JPG, PNG, WebP, GIF
- **Document preview** — PDF, plain text, code files with syntax highlighting

</details>

<details>
<summary><b>🌐 Multi-Language Support</b></summary>

- **English** (default)
- **Bahasa Indonesia** (full translation)

Switch anytime in **Settings → Language**.

</details>

<details>
<summary><b>🔒 Security & Privacy</b></summary>

- **Per-file password protection** — encrypt file access with a custom password
- **Auto-expire** — set a date after which a file link automatically becomes invalid
- **Zero cloud dependency** — your files live in YOUR private Telegram channel. No third-party servers.

</details>

---

## 📥 Download & Install

> **➡️ [Go to Releases →](https://github.com/aziqi/InfiniDrive/releases/latest)**

| Package | Description | Recommended |
|---|---|---|
| `InfiniDrive Setup 1.0.0.exe` | Windows NSIS Installer — creates Desktop & Start Menu shortcuts | ✅ **Most users** |
| `InfiniDrive-Portable-1.0.0.exe` | Single-file portable — run from anywhere, no install needed | ✅ USB / portable use |
| `InfiniDrive-1.0.0-win.zip` | ZIP archive — extract folder and run `InfiniDrive.exe` directly | Advanced |

---

## 🛠️ First-Time Setup Guide

### Step 1 — Create Telegram Bots via @BotFather

1. Open Telegram → search [@BotFather](https://t.me/BotFather)
2. Send `/newbot` → follow prompts → copy the **Bot Token**
3. *(Recommended)* Repeat to create 2–5 bots for maximum clustering throughput

### Step 2 — Create a Private Storage Channel

1. Create a new **Private Channel** in Telegram
2. Add all bots as **Administrators** (enable *Post Messages* permission)
3. Get the Channel ID by forwarding any message to [@JsonDumpBot](https://t.me/JsonDumpBot)
   - Channel ID format: `-1001234567890`

### Step 3 — Configure InfiniDrive

1. Launch **InfiniDrive.exe**
2. Enter your Bot Token(s) and Channel ID in the **Setup Wizard**
3. *(Optional but Recommended)* Enable **MTProto Engine** in Settings for large file support
4. Click **Save & Connect** → you're ready!

---

## 🏗️ Build from Source

### Prerequisites
- **Node.js** v18+ & npm
- **Python** 3.10+
- Windows 11 (for building the `.exe`)

### Development Mode
```bash
# Terminal 1 — Python backend
cd backend
pip install -r requirements.txt
python run_sidecar.py

# Terminal 2 — Electron + Vite frontend
cd app
npm install
npm run electron:dev
```

### Build Production .exe
```bash
# 1. Compile Python backend → standalone binary
python backend/build_exe.py

# 2. Build React frontend + package Electron installer
cd app
npm run dist
# Output: app/dist-electron/
```

---

## 🗂️ Project Structure

```
InfiniDrive/
├── backend/
│   ├── app.py              # FastAPI REST API (upload, download, stream, folders)
│   ├── bot_cluster.py      # Multi-bot round-robin load balancer
│   ├── telegram_user.py    # MTProto Telethon turbo upload engine (12 parallel workers)
│   ├── database.py         # aiosqlite async metadata manager
│   ├── config.py           # Smart dual-engine routing config (%APPDATA%/InfiniDrive/)
│   ├── run_sidecar.py      # Standalone backend process launcher
│   ├── build_exe.py        # PyInstaller → resources/bin/infinidrive_backend.exe
│   └── requirements.txt
├── app/
│   ├── electron/
│   │   ├── main.cjs        # Electron main process + sidecar lifecycle
│   │   └── preload.cjs     # IPC security bridge
│   ├── src/
│   │   ├── components/     # React UI components
│   │   ├── i18n/           # EN + ID language packs
│   │   ├── api/client.ts   # Axios API client
│   │   └── App.tsx         # Main React controller
│   └── package.json
└── resources/
    └── bin/                # Compiled backend binary (gitignored — build locally)
```

---

## 🛡️ License

MIT License — Copyright © 2026 [aziqi](https://github.com/aziqi)

Made with ❤️ for the Windows 11 & Telegram ecosystem.

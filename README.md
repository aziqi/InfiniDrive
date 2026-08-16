# ⚡ InfiniDrive Desktop — Infinite Telegram Cloud Storage for Windows 11

**InfiniDrive** adalah aplikasi desktop modern dan berkinerja tinggi untuk Windows 11 yang mengubah Telegram menjadi penyimpanan cloud tanpa batas (*infinite cloud storage*) dengan arsitektur **Dual-Engine (Bot Cluster & MTProto Direct Stream)**.

---

## ✨ Fitur Unggulan

- ⚡ **Dual-Engine Architecture**: 
  - **Bot Cluster Engine**: Mendukung 1 sampai 10+ bot sekaligus dengan *round-robin load balancing* untuk throughput maksimal.
  - **MTProto Direct Engine**: Upload & Download kecepatan ultra-tinggi hingga 100+ MB/s dengan dukungan file raksasa (hingga 4GB+ per file).
- 🗕 **Minimizable Turbo Upload**: Jendela proses upload dapat diminimalkan ke **Floating Dock** di pojok kanan bawah dengan *live speedometer* (`⚡ MB/s`), perkiraan waktu selesai (ETA), dan tombol *expand* kapan saja.
- 📁 **Manajemen Folder Canggih**:
  - Dukungan upload folder Windows secara rekursif dengan struktur direktori dan kalkulasi ukuran byte 100% akurat.
  - Kunci folder dengan kata sandi (*Password Folder Lock*).
  - Menu titik 3 pada setiap folder untuk Ganti Nama (*Rename*), Kunci/Buka (*Lock/Unlock*), dan Hapus (*Delete*).
- 🎯 **Smart Multi-Select System**:
  - `Ctrl + A` / `Cmd + A` untuk memilih seluruh file sekaligus.
  - `Shift + Click` untuk memilih rentang file dari titik awal ke titik akhir secara instan.
- 🌐 **Dukungan Multi-Bahasa**: Pilihan bahasa antarmuka penuh antara **English (Default)** dan **Bahasa Indonesia**.
- 📺 **Media Streaming & Instant Preview**: Putar video (MP4/MKV) dan audio (MP3/FLAC) secara *seekable*, serta pratinjau foto, PDF, dan dokumen teks langsung di aplikasi.
- 🔒 **Proteksi File & Auto-Expire**: Opsi password per-file dan tanggal kedaluwarsa file otomatis.
- 🖱️ **Modern Fluent UI (Windows 11)**: Dark glassmorphism, animasi halus Framer Motion, dan custom draggable title bar.

---

## 📦 Berkas Executable Siap Pakai (.exe)

Output hasil kompilasi tersedia di direktori `app/dist-electron/`:

| File | Tipe | Deskripsi |
|---|---|---|
| `InfiniDrive-Portable-1.0.0.exe` | **Portable Executable (.exe)** | Berkas tunggal mandiri, langsung jalan tanpa install |
| `InfiniDrive-1.0.0-win.zip` | **Portable Archive (.zip)** | Ekstrak ke folder mana saja dan jalankan `InfiniDrive.exe` |
| `InfiniDrive Setup 1.0.0.exe` | **Windows Installer (.exe)** | Installer NSIS dengan shortcut otomatis di Desktop & Start Menu |

---

## 🏗️ Menjalankan dari Source Code

### Prasyarat:
- **Node.js** v18+ dan **npm**
- **Python** 3.10+

### 1. Jalankan Mode Development:
```bash
# Terminal 1: Backend Python
cd backend
pip install -r requirements.txt
python run_sidecar.py

# Terminal 2: Frontend Electron + Vite
cd app
npm install
npm run electron:dev
```

### 2. Kompilasi ke Standalone .exe:
```bash
# 1. Compile backend Python ke executable (resources/bin/infinidrive_backend.exe)
python backend/build_exe.py

# 2. Build frontend & paketkan installer serta portable .exe
cd app
npm run dist
```

---

## 🛡️ Lisensi & Hak Cipta
Dibuat dengan ❤️ untuk ekosistem Windows 11 & Telegram Cloud.

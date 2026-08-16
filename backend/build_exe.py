import os
import subprocess
import sys
import shutil
from pathlib import Path

def build_sidecar():
    backend_dir = Path(__file__).resolve().parent
    entry_point = backend_dir / "run_sidecar.py"
    dist_dir = backend_dir.parent / "resources" / "bin"
    dist_dir.mkdir(parents=True, exist_ok=True)
    icon_path = backend_dir.parent / "app" / "electron" / "icon.ico"

    print(f"Building InfiniDrive sidecar executable from {entry_point}...")
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "infinidrive_backend",
        "--onefile",
        "--noconsole",
        "--distpath", str(dist_dir),
        "--workpath", str(backend_dir / "build"),
        "--specpath", str(backend_dir),
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespans",
        "--hidden-import", "uvicorn.lifespans.auto",
        "--hidden-import", "aiosqlite",
        "--hidden-import", "telegram",
        "--hidden-import", "telegram.request",
        "--hidden-import", "telethon",
        "--hidden-import", "telethon.sessions",
        "--hidden-import", "telethon.sessions.string",
        "--hidden-import", "telethon.network",
        "--hidden-import", "telethon.crypto",
        "--hidden-import", "telethon.extensions",
        "--collect-submodules", "telethon",
        "--hidden-import", "httpx",
        # Exclude bulky unnecessary packages to minimize binary file size
        "--exclude-module", "tkinter",
        "--exclude-module", "matplotlib",
        "--exclude-module", "scipy",
        "--exclude-module", "pandas",
        "--exclude-module", "IPython",
        "--exclude-module", "notebook",
        "--exclude-module", "unittest",
        "--exclude-module", "pydoc",
        "--exclude-module", "lib2to3",
        "--exclude-module", "sqlite3.test",
        str(entry_point)
    ]

    if icon_path.exists():
        cmd.extend(["--icon", str(icon_path)])

    print("Running PyInstaller command:", " ".join(cmd))
    res = subprocess.run(cmd, cwd=str(backend_dir))
    if res.returncode == 0:
        primary_exe = dist_dir / "infinidrive_backend.exe"
        legacy_exe = dist_dir / "tgdrive_backend.exe"
        shutil.copy2(primary_exe, legacy_exe)
        print(f"[SUCCESS] Built sidecar binary in: {primary_exe} and {legacy_exe}")
    else:
        print("[ERROR] PyInstaller build failed with return code:", res.returncode)

if __name__ == "__main__":
    build_sidecar()

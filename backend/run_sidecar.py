import os
import sys
import json
import socket
import logging
import multiprocessing
import uvicorn
from pathlib import Path

# Add backend directory to sys.path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from config import CONFIG_DIR, config_mgr
from app import app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("tgdrive.sidecar")

def find_available_port(preferred_port: int = 8082) -> int:
    for port in range(preferred_port, preferred_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return preferred_port

def write_runtime_info(port: int):
    runtime_file = CONFIG_DIR / "runtime.json"
    runtime_data = {
        "pid": os.getpid(),
        "port": port,
        "base_url": f"http://127.0.0.1:{port}"
    }
    try:
        with open(runtime_file, "w", encoding="utf-8") as f:
            json.dump(runtime_data, f, indent=2)
        logger.info(f"Runtime info written to {runtime_file}")
    except Exception as e:
        logger.error(f"Failed to write runtime info: {e}")

def main():
    multiprocessing.freeze_support()
    preferred_port = config_mgr.config.port or 8082
    port = find_available_port(preferred_port)
    config_mgr.update(port=port, base_url=f"http://127.0.0.1:{port}")
    write_runtime_info(port)

    logger.info(f"Starting TGDrive sidecar on http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info", access_log=False)

if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()


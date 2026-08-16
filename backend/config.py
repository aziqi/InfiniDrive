import os
import json
import logging
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("tgdrive.config")

def get_default_config_dir() -> Path:
    app_data = os.getenv("APPDATA")
    if app_data:
        config_dir = Path(app_data) / "InfiniDrive"
    else:
        config_dir = Path.home() / ".infinidrive"
    config_dir.mkdir(parents=True, exist_ok=True)
    
    # Migration: copy legacy TGDrive config & db if they exist
    if app_data:
        old_dir = Path(app_data) / "TGDrive"
        if old_dir.exists():
            old_config = old_dir / "config.json"
            new_config = config_dir / "config.json"
            if old_config.exists() and not new_config.exists():
                try:
                    import shutil
                    shutil.copy2(old_config, new_config)
                except Exception:
                    pass
            old_db = old_dir / "tgdrive_storage.db"
            new_db = config_dir / "infinidrive_storage.db"
            if old_db.exists() and not new_db.exists():
                try:
                    import shutil
                    shutil.copy2(old_db, new_db)
                except Exception:
                    pass
    return config_dir

CONFIG_DIR = get_default_config_dir()
CONFIG_FILE = CONFIG_DIR / "config.json"
DATABASE_FILE = CONFIG_DIR / "infinidrive_storage.db"

class AppConfig(BaseModel):
    bot_tokens: List[str] = Field(default_factory=list)
    channel_id: str = ""
    admin_api_key: str = "tgdrive_secret_key"
    base_url: str = "http://127.0.0.1:8082"
    port: int = 8082
    host: str = "127.0.0.1"
    proxy_url: Optional[str] = None
    max_chunk_mb: int = 49
    auto_start_sidecar: bool = True
    
    # Personal Telegram Account (MTProto via Telethon)
    api_id: Optional[int] = None
    api_hash: Optional[str] = None
    phone_number: Optional[str] = None
    session_string: Optional[str] = None
    
    # Smart Dual-Engine Routing
    auth_mode: str = "smart"  # "smart" | "bot_only" | "personal_only"
    smart_threshold_mb: int = 20
    user_chunk_mb: int = 1900
    throttle_delay_sec: float = 1.0
    max_parallel_bot_uploads: int = 4

class ConfigManager:
    def __init__(self, config_path: Path = CONFIG_FILE):
        self.config_path = config_path
        self.config = self.load()

    def load(self) -> AppConfig:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return AppConfig(**data)
            except Exception as e:
                logger.error(f"Failed to parse config file: {e}")
        
        default_config = AppConfig()
        self.save(default_config)
        return default_config

    def save(self, config: AppConfig):
        self.config = config
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(config.model_dump(), f, indent=2)
            logger.info(f"Saved config to {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")

    @property
    def is_configured(self) -> bool:
        clean_tokens = [t.strip() for t in self.config.bot_tokens if t.strip()]
        has_bots = bool(clean_tokens and self.config.channel_id.strip())
        has_user = bool(self.config.session_string and self.config.session_string.strip())
        return has_bots or has_user

    def get_safe_dict(self) -> dict:
        data = self.config.model_dump()
        # Redact / hide sensitive credentials
        data["has_session"] = bool(self.config.session_string)
        data["has_api_credentials"] = bool(self.config.api_id and self.config.api_hash)
        if self.config.phone_number:
            p = self.config.phone_number.strip()
            data["masked_phone"] = f"{p[:4]}****{p[-3:]}" if len(p) > 7 else "****"
        else:
            data["masked_phone"] = ""
        data.pop("session_string", None)
        data.pop("api_hash", None)
        data["bot_count"] = len([t for t in self.config.bot_tokens if t.strip()])
        data["is_configured"] = self.is_configured
        return data

    def update(self, **kwargs) -> AppConfig:
        current_data = self.config.model_dump()
        current_data.update({k: v for k, v in kwargs.items() if v is not None})
        new_config = AppConfig(**current_data)
        self.save(new_config)
        return new_config

config_mgr = ConfigManager()

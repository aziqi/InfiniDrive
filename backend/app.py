# InfiniDrive FastAPI Backend — upload, download, streaming, folder management endpoints
import os
import re
import math
import time
import secrets
import datetime
import shutil
import asyncio
import logging
import collections
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Response, Depends, Header, Query
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from config import config_mgr, AppConfig
    from database import (
        init_db, add_file, get_file_by_id, delete_file_db,
        rename_file_db, get_file_by_share_token, increment_view_count,
        list_files, get_stats, bulk_delete_files_db, move_files_db,
        list_folders, create_folder_db, delete_folder_db, rename_folder_db,
        add_file_chunk, get_file_chunks,
        get_file_thumbnail, get_incomplete_chunks,
        lock_folder_db, unlock_folder_db, verify_folder_password_db, list_locked_folders_db,
        create_share, get_share_by_token, list_shares, revoke_share, increment_share_access,
        hash_password,
        create_folder_group, list_folder_groups, get_folder_group, delete_folder_group
    )
    from bot_cluster import cluster, generate_video_poster, extract_video_thumbnail
    from telegram_user import user_manager
    from bandwidth import bandwidth_manager
except ImportError:
    from .config import config_mgr, AppConfig
    from .database import (
        init_db, add_file, get_file_by_id, delete_file_db,
        rename_file_db, get_file_by_share_token, increment_view_count,
        list_files, get_stats, bulk_delete_files_db, move_files_db,
        list_folders, create_folder_db, delete_folder_db, rename_folder_db,
        add_file_chunk, get_file_chunks,
        get_file_thumbnail, get_incomplete_chunks,
        lock_folder_db, unlock_folder_db, verify_folder_password_db, list_locked_folders_db,
        create_share, get_share_by_token, list_shares, revoke_share, increment_share_access,
        hash_password,
        create_folder_group, list_folder_groups, get_folder_group, delete_folder_group
    )
    from .bot_cluster import cluster, generate_video_poster, extract_video_thumbnail
    from .telegram_user import user_manager
    from .bandwidth import bandwidth_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("infinidrive.api")

def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

class ActivityLogManager:
    def __init__(self, max_entries: int = 300):
        self.logs = collections.deque(maxlen=max_entries)
        self.counter = 0

    def add(self, tag: str, message: str, level: str = "info"):
        self.counter += 1
        now = time.time()
        time_str = datetime.datetime.fromtimestamp(now).strftime("%H:%M:%S")
        entry = {
            "id": f"log_{self.counter}_{int(now*1000)}",
            "timestamp": now,
            "time_str": time_str,
            "tag": tag,
            "message": message,
            "level": level
        }
        self.logs.append(entry)
        logger.info(f"[{tag}] {message}")

    def get_logs(self, since: float = 0.0) -> List[dict]:
        if since <= 0:
            return list(self.logs)
        return [log for log in self.logs if log["timestamp"] > since]

    def clear(self):
        self.logs.clear()

activity_logger = ActivityLogManager(max_entries=300)

class SpeedTracker:
    def __init__(self, filename: str, total_bytes: int, min_interval_sec: float = 0.25):
        self.filename = filename
        self.total_bytes = total_bytes
        self.min_interval_sec = min_interval_sec
        self.start_time = time.time()
        self.last_time = time.time()
        self.last_bytes = 0
        self.peak_speed_bytes = 0.0

    def update(self, current_bytes: int, force: bool = False):
        now = time.time()
        time_diff = now - self.last_time
        if not force and time_diff < self.min_interval_sec and current_bytes < self.total_bytes:
            return

        elapsed_total = max(0.05, now - self.start_time)
        avg_speed = current_bytes / elapsed_total
        
        if time_diff > 0:
            window_speed = max(0.0, (current_bytes - self.last_bytes) / time_diff)
            effective_speed = 0.7 * window_speed + 0.3 * avg_speed
        else:
            effective_speed = avg_speed

        if effective_speed > self.peak_speed_bytes:
            self.peak_speed_bytes = effective_speed

        self.last_bytes = current_bytes
        self.last_time = now

        pct = min(100, int((current_bytes / max(1, self.total_bytes)) * 100))
        cur_mb = current_bytes / (1024 * 1024)
        tot_mb = self.total_bytes / (1024 * 1024)
        speed_mb = effective_speed / (1024 * 1024)
        peak_mb = self.peak_speed_bytes / (1024 * 1024)

        rem_bytes = max(0, self.total_bytes - current_bytes)
        if effective_speed > 1024:
            eta_sec = int(rem_bytes / effective_speed)
            eta_str = f"{eta_sec}s" if eta_sec < 60 else f"{eta_sec//60}m {eta_sec%60}s"
        else:
            eta_str = "--"

        msg = f"[{self.filename}] {cur_mb:.1f} MB / {tot_mb:.1f} MB ({pct}%) -  {speed_mb:.2f} MB/s (Peak: {peak_mb:.2f} MB/s) - ETA {eta_str}"
        activity_logger.add("PROGRESS", msg)

app = FastAPI(title="InfiniDrive Desktop Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_db()
    asyncio.create_task(cluster.start_all())
    asyncio.create_task(user_manager.start())
    activity_logger.add("INFO", "InfiniDrive Dual-Engine sidecar backend engine started.")

class SetupConfigRequest(BaseModel):
    bot_tokens: Optional[List[str]] = None
    channel_id: Optional[str] = None
    proxy_url: Optional[str] = None
    base_url: Optional[str] = None
    admin_api_key: Optional[str] = None
    auth_mode: Optional[str] = None
    smart_threshold_mb: Optional[int] = None
    user_chunk_mb: Optional[int] = None
    throttle_delay_sec: Optional[float] = None
    max_parallel_bot_uploads: Optional[int] = None
    bandwidth_limit_gb: Optional[float] = None

class AddBotRequest(BaseModel):
    token: str

class SendCodeRequest(BaseModel):
    phone: str
    api_id: int
    api_hash: str

class SignInRequest(BaseModel):
    phone: str
    code: str
    password: Optional[str] = None

@app.get("/health")
async def health():
    cfg = config_mgr.config
    clean_tokens = [t.strip() for t in cfg.bot_tokens if t.strip()]
    return {
        "status": "online",
        "configured": config_mgr.is_configured,
        "bot_count": len(clean_tokens),
        "user_connected": user_manager.is_connected,
        "auth_mode": cfg.auth_mode,
        "time": datetime.datetime.now().isoformat()
    }

@app.get("/api/logs")
async def get_activity_logs(since: float = Query(0.0)):
    return {"logs": activity_logger.get_logs(since=since)}

@app.post("/api/logs/clear")
async def clear_activity_logs():
    activity_logger.clear()
    activity_logger.add("INFO", "Activity log console cleared.")
    return {"status": "cleared"}

# MTProto Personal Account Endpoints
@app.post("/api/user/auth/send-code")
async def api_user_send_code(req: SendCodeRequest):
    try:
        activity_logger.add("AUTH", f"Sending Telegram OTP code to {req.phone}...")
        res = await user_manager.send_auth_code(req.phone, req.api_id, req.api_hash)
        activity_logger.add("AUTH", f"OTP code successfully dispatched to {req.phone}!")
        return res
    except Exception as e:
        activity_logger.add("ERROR", f"Failed to send Telegram OTP: {e}", level="error")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/user/auth/sign-in")
async def api_user_sign_in(req: SignInRequest):
    try:
        activity_logger.add("AUTH", f"Verifying OTP code for {req.phone}...")
        res = await user_manager.sign_in(req.phone, req.code, req.password)
        if res.get("requires_2fa"):
            activity_logger.add("AUTH", f"Account has 2FA enabled. Awaiting 2FA password...")
            return res
        activity_logger.add("AUTH", f"MTProto Personal Account authenticated successfully!", level="success")
        return res
    except Exception as e:
        activity_logger.add("ERROR", f"Sign in failed: {e}", level="error")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/user/auth/logout")
async def api_user_logout():
    await user_manager.logout()
    activity_logger.add("AUTH", "MTProto Personal Account disconnected.")
    return {"status": "success", "message": "Logged out successfully"}

@app.get("/api/user/profile")
async def api_user_profile():
    return await user_manager.get_profile()

@app.get("/api/connection")
async def api_connection():
    """Live connection-quality snapshot (Phase 8). Never raises 500."""
    cfg = config_mgr.config
    proxy_type = None
    proxy_host = None
    proxy_port = None
    if cfg.proxy_url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(cfg.proxy_url)
            if parsed.scheme:
                proxy_type = parsed.scheme.lower()
                proxy_host = parsed.hostname
                proxy_port = parsed.port
        except Exception:
            pass

    healthy = sum(1 for b in cluster.bots if b.is_healthy)
    latency_ms = None
    user_connected = user_manager.is_connected
    if user_connected and user_manager.client is not None:
        try:
            import time as _t
            start = _t.time()
            await asyncio.wait_for(user_manager.client.get_me(), timeout=10)
            latency_ms = round((_t.time() - start) * 1000, 1)
        except Exception as e:
            logger.warning(f"Latency probe failed: {e}")
            latency_ms = None

    return {
        "user_connected": user_connected,
        "proxy": {"type": proxy_type, "host": proxy_host, "port": proxy_port},
        "bot_count": len(cluster.bots),
        "healthy_bot_count": healthy,
        "latency_ms": latency_ms
    }

@app.post("/api/sync/channel")
async def sync_channel_files():
    cfg = config_mgr.config
    channel_id = cfg.channel_id
    if not channel_id:
        raise HTTPException(status_code=400, detail="Channel ID is not configured in Settings.")

    activity_logger.add("SYNC", f"Starting Cloud Library Recovery from Telegram Channel {channel_id}...")

    try:
        if user_manager.is_connected:
            res = await user_manager.sync_channel_library(channel_id)
            count = res.get("synced_count", 0)
            activity_logger.add("SYNC", f"Successfully synced and restored {count} files from Telegram Cloud!", level="success")
            return {"status": "success", "synced_count": count, "message": f"Successfully recovered {count} files from cloud channel."}
        else:
            activity_logger.add("SYNC", "MTProto personal user not connected. Cloud scanning requires MTProto login.", level="warning")
            return {"status": "warning", "synced_count": 0, "message": "Please connect your Telegram Account in Settings to scan and sync cloud files."}
    except Exception as e:
        activity_logger.add("ERROR", f"Cloud channel sync failed: {e}", level="error")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config")
async def get_config():
    return config_mgr.get_safe_dict()

@app.post("/api/config")
async def save_config(req: SetupConfigRequest):
    update_data = {}
    if req.bot_tokens is not None:
        update_data["bot_tokens"] = [t.strip() for t in req.bot_tokens if t.strip()]
    if req.channel_id is not None:
        update_data["channel_id"] = req.channel_id.strip()
    if req.proxy_url is not None:
        update_data["proxy_url"] = req.proxy_url.strip() if req.proxy_url else None
    if req.base_url is not None:
        update_data["base_url"] = req.base_url.strip() if req.base_url else "http://127.0.0.1:8082"
    if req.admin_api_key is not None:
        update_data["admin_api_key"] = req.admin_api_key.strip()
    if req.auth_mode is not None:
        update_data["auth_mode"] = req.auth_mode
    if req.smart_threshold_mb is not None:
        update_data["smart_threshold_mb"] = req.smart_threshold_mb
    if req.user_chunk_mb is not None:
        update_data["user_chunk_mb"] = req.user_chunk_mb
    if req.throttle_delay_sec is not None:
        update_data["throttle_delay_sec"] = req.throttle_delay_sec
    if req.max_parallel_bot_uploads is not None:
        update_data["max_parallel_bot_uploads"] = req.max_parallel_bot_uploads
    if req.bandwidth_limit_gb is not None:
        try:
            limit_gb = float(req.bandwidth_limit_gb)
        except (TypeError, ValueError):
            limit_gb = 250.0
        update_data["bandwidth_limit_gb"] = limit_gb if limit_gb > 0 else 250.0

    config_mgr.update(**update_data)
    cluster.reload_from_config()
    results = await cluster.start_all()
    channel_check = None
    if config_mgr.config.channel_id:
        channel_check = await cluster.verify_channel_access(config_mgr.config.channel_id)

    activity_logger.add("CONFIG", "Application configuration updated.")
    return {
        "status": "success",
        "config": config_mgr.get_safe_dict(),
        "bots": results,
        "channel": channel_check
    }

@app.get("/api/bots/status")
async def get_bots_status():
    return {"bots": cluster.get_status()}

@app.post("/api/bots/add")
async def api_add_bot(req: AddBotRequest):
    res = await cluster.add_and_verify_bot(req.token)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Bot verification failed."))
    return res

@app.delete("/api/bots/{token_hash}")
async def api_remove_bot(token_hash: str):
    removed = await cluster.remove_bot(token_hash)
    if not removed:
        raise HTTPException(status_code=404, detail="Bot not found.")
    return {"status": "success", "removed_hash": token_hash}

@app.post("/api/bots/verify")
async def verify_bots():
    results = await cluster.start_all()
    channel_check = None
    if config_mgr.config.channel_id:
        channel_check = await cluster.verify_channel_access(config_mgr.config.channel_id)
    return {
        "bots": results,
        "channel": channel_check
    }

@app.get("/api/stats")
async def api_stats():
    stats = await get_stats()
    cfg = config_mgr.config
    stats["bot_count"] = len(cluster.bots)
    stats["healthy_bot_count"] = sum(1 for b in cluster.bots if b.is_healthy)
    stats["user_account_connected"] = user_manager.is_connected
    stats["auth_mode"] = cfg.auth_mode
    stats["smart_threshold_mb"] = cfg.smart_threshold_mb
    if user_manager.is_connected:
        profile = await user_manager.get_profile()
        stats["user_profile"] = profile
        stats["upload_limit_gb"] = profile.get("upload_limit_gb", 2.0)
    else:
        stats["user_profile"] = None
        stats["upload_limit_gb"] = 2.0
    return stats

@app.get("/api/bandwidth")
async def api_get_bandwidth():
    """Daily bandwidth quota usage (upload + download) for the current calendar day."""
    return bandwidth_manager.get_stats()

class BulkDeleteRequest(BaseModel):
    file_ids: List[str]

class MoveFilesRequest(BaseModel):
    file_ids: List[str]
    target_folder: str

class CreateFolderRequest(BaseModel):
    folder_path: str

class LockFolderRequest(BaseModel):
    folder_path: str
    password: str

class UnlockFolderRequest(BaseModel):
    folder_path: str

class VerifyFolderRequest(BaseModel):
    folder_path: str
    password: str

class RenameFolderRequest(BaseModel):
    folder_path: str
    new_name: str

class ShareCreateRequest(BaseModel):
    file_id: str
    password: Optional[str] = None
    expires_days: Optional[int] = None

@app.get("/api/files")
async def api_list_files(
    folder: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = "uploaded_at",
    sort_order: str = "desc"
):
    files = await list_files(
        folder=folder,
        search=search,
        category=category,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return {"files": files}

@app.post("/api/files/bulk-delete")
async def api_bulk_delete(req: BulkDeleteRequest):
    if not req.file_ids:
        return {"status": "success", "deleted_count": 0}
    
    # Delete from telegram in background
    if config_mgr.config.channel_id:
        for fid in req.file_ids:
            fdata = await get_file_by_id(fid)
            if fdata:
                if fdata.get("is_chunked"):
                    chunks = await get_file_chunks(fid)
                    for c in chunks:
                        if c.get("message_id"):
                            asyncio.create_task(cluster.delete_message(config_mgr.config.channel_id, c["message_id"]))
                elif fdata.get("message_id"):
                    asyncio.create_task(cluster.delete_message(config_mgr.config.channel_id, fdata["message_id"]))
                
    count = await bulk_delete_files_db(req.file_ids)
    return {"status": "success", "deleted_count": count}

@app.post("/api/files/move")
async def api_move_files(req: MoveFilesRequest):
    count = await move_files_db(req.file_ids, req.target_folder)
    return {"status": "success", "moved_count": count, "target_folder": req.target_folder}

@app.get("/api/folders")
async def api_get_folders():
    folders = await list_folders()
    return {"folders": folders}

@app.post("/api/folders")
async def api_create_folder(req: CreateFolderRequest):
    await create_folder_db(req.folder_path)
    return {"status": "success", "folder_path": req.folder_path}

@app.delete("/api/folders")
async def api_delete_folder(folder_path: str = Query(...)):
    res = await delete_folder_db(folder_path)
    if not res:
        raise HTTPException(status_code=400, detail="Cannot delete root or non-existent folder.")
    return {"status": "success", "folder_path": folder_path}

@app.post("/api/folders/rename")
async def api_rename_folder(req: RenameFolderRequest):
    new_path = await rename_folder_db(req.folder_path, req.new_name)
    return {"status": "success", "old_path": req.folder_path, "new_path": new_path}

@app.get("/api/folders/locks")
async def api_get_locked_folders():
    locks = await list_locked_folders_db()
    return {"locked_folders": locks}

@app.post("/api/folders/lock")
async def api_lock_folder(req: LockFolderRequest):
    if not req.password.strip():
        raise HTTPException(status_code=400, detail="Password is required to lock folder.")
    await lock_folder_db(req.folder_path, req.password)
    return {"status": "success", "folder_path": req.folder_path}

@app.post("/api/folders/unlock")
async def api_unlock_folder(req: UnlockFolderRequest):
    await unlock_folder_db(req.folder_path)
    return {"status": "success", "folder_path": req.folder_path}

@app.post("/api/folders/verify")
async def api_verify_folder_password(req: VerifyFolderRequest):
    valid = await verify_folder_password_db(req.folder_path, req.password)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid folder password.")
    return {"status": "success", "valid": True}

class FolderGroupCreateRequest(BaseModel):
    name: str
    color: Optional[str] = None
    folder_paths: Optional[List[str]] = None

@app.get("/api/folder-groups")
async def api_list_folder_groups():
    return {"groups": await list_folder_groups()}

@app.post("/api/folder-groups")
async def api_create_folder_group(req: FolderGroupCreateRequest):
    if not (req.name or "").strip():
        raise HTTPException(status_code=400, detail="Group name is required.")
    group = await create_folder_group(
        name=req.name,
        color=req.color or "#3b82f6",
        folder_paths=req.folder_paths or []
    )
    activity_logger.add("GROUP", f"Created folder group '{group['name']}' with {len(group['folder_paths'])} folder(s).")
    return {"status": "success", "group": group}

@app.delete("/api/folder-groups/{group_id}")
async def api_delete_folder_group(group_id: int):
    existing = await get_folder_group(group_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Folder group not found.")
    deleted = await delete_folder_group(group_id)
    activity_logger.add("GROUP", f"Deleted folder group '{existing.get('name')}'.")
    return {"status": "success", "deleted": deleted, "id": group_id}

@app.get("/thumbnail/{file_id}")
async def api_get_thumbnail(file_id: str):
    thumb = await get_file_thumbnail(file_id)
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not found.")
    return Response(content=thumb, media_type="image/jpeg")

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    expiration_days: Optional[int] = Form(None),
    password: Optional[str] = Form(None),
    folder: Optional[str] = Form("/")
):
    cfg = config_mgr.config
    if not cfg.channel_id:
        raise HTTPException(status_code=400, detail="Telegram Channel ID is not configured.")

    has_user = user_manager.is_connected
    has_bots = bool(cluster.bots)

    if not has_user and not has_bots:
        raise HTTPException(status_code=400, detail="No active Telegram Bot or Personal Account connected.")

    temp_id = secrets.token_hex(6)
    temp_dir = os.path.join(os.getenv("TEMP", "."), "tgdrive_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"temp_{temp_id}_{file.filename}")

    try:
        def copy_stream():
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return os.path.getsize(temp_path)

        file_size = await asyncio.to_thread(copy_stream)
        size_label = format_file_size(file_size)

        # Bandwidth Manager gate (Phase 6): refuse the transfer when today's quota is exhausted.
        if not bandwidth_manager.can_transfer(file_size):
            bw = bandwidth_manager.get_stats()
            activity_logger.add(
                "BANDWIDTH",
                f"[{file.filename}] Upload blocked: daily bandwidth quota exceeded "
                f"({format_file_size(bw['used_today_bytes'])} / {format_file_size(bw['quota_bytes'])}).",
                level="error"
            )
            raise HTTPException(status_code=429, detail="Daily bandwidth quota exceeded.")

        activity_logger.add("START", f"[{file.filename}] Initializing upload ({size_label})...")
        
        # Check if video or audio
        lower_name = file.filename.lower()
        content_type = (file.content_type or "").lower()
        is_video = bool("video" in content_type) or any(lower_name.endswith(ext) for ext in ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.ts'])
        is_audio = bool("audio" in content_type) or any(lower_name.endswith(ext) for ext in ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.wma'])

        # Generate video thumbnail if video
        thumbnail_blob = None
        has_thumbnail = False
        if is_video:
            activity_logger.add("THUMB", f"[{file.filename}] Generating video preview thumbnail...")
            try:
                thumbnail_blob = extract_video_thumbnail(temp_path)
                if not thumbnail_blob:
                    thumbnail_blob = generate_video_poster(file.filename)
                has_thumbnail = True
                activity_logger.add("THUMB", f"[{file.filename}] Video preview thumbnail generated.")
            except Exception as e:
                logger.warning(f"Could not extract video thumbnail: {e}")
                thumbnail_blob = generate_video_poster(file.filename)
                has_thumbnail = True

        share_token = secrets.token_urlsafe(16)
        exp_date = (
            (datetime.datetime.now() + datetime.timedelta(days=expiration_days)).isoformat()
            if expiration_days else None
        )

        # Smart Dual-Engine Routing Decision
        auth_mode = cfg.auth_mode or "smart"
        threshold_bytes = (cfg.smart_threshold_mb or 20) * 1024 * 1024
        
        use_user_account = False
        if auth_mode == "personal_only":
            if not has_user:
                raise HTTPException(status_code=400, detail="Personal MTProto account is not connected.")
            use_user_account = True
        elif auth_mode == "bot_only":
            if not has_bots:
                raise HTTPException(status_code=400, detail="No Telegram Bot Tokens configured.")
            use_user_account = False
        else: # "smart" mode
            if file_size > threshold_bytes and has_user:
                use_user_account = True
            elif not has_bots and has_user:
                use_user_account = True
            else:
                use_user_account = False

        engine_name = " MTProto Personal Account" if use_user_account else " Multi-Bot Cluster"
        activity_logger.add("ROUTE", f"[{file.filename}] Routed to {engine_name} (Size: {size_label}, Mode: {auth_mode})")

        if use_user_account:
            # MTProto Personal Account Engine
            profile = await user_manager.get_profile()
            upload_limit_gb = profile.get("upload_limit_gb", 2.0)
            upload_limit_bytes = int(upload_limit_gb * 1024 * 1024 * 1024)

            if file_size <= upload_limit_bytes:
                # MTProto Single-shot Upload with live progress & speed tracking
                activity_logger.add("TRANSMIT", f"[{file.filename}] Starting MTProto high-speed transmission ({size_label})...")
                
                tracker = SpeedTracker(file.filename, file_size)
                def single_progress(current, total):
                    tracker.update(current)

                res = await user_manager.upload_single(
                    chat_id=cfg.channel_id,
                    file_source=temp_path,
                    filename=file.filename,
                    progress_cb=single_progress
                )
                tracker.update(file_size, force=True)

                file_id = res.get("tg_file_id") or f"user_{secrets.token_hex(8)}"
                uploader_name = res.get("uploader", "personal_account")

                await add_file(
                    file_id=file_id,
                    message_id=res["message_id"],
                    file_name=file.filename,
                    file_size=file_size,
                    mime_type=file.content_type or "application/octet-stream",
                    expiration_date=exp_date,
                    share_token=share_token,
                    password=password,
                    bot_uploader=uploader_name,
                    upload_source="user_account",
                    folder=folder or "/",
                    is_chunked=False,
                    total_chunks=1,
                    has_thumbnail=has_thumbnail,
                    thumbnail_blob=thumbnail_blob
                )
                bandwidth_manager.add_bytes(file_size)
                activity_logger.add("SUCCESS", f"[{file.filename}] Successfully uploaded to Telegram Cloud via MTProto!", level="success")

                return {
                    "status": "success",
                    "file_id": file_id,
                    "file_name": file.filename,
                    "file_size": file_size,
                    "is_chunked": False,
                    "total_chunks": 1,
                    "upload_source": "user_account",
                    "direct_link": f"{cfg.base_url}/dl/{file_id}/{file.filename}",
                    "share_link": f"{cfg.base_url}/share/{share_token}"
                }
            else:
                # Massive File (> 2GB / 4GB): 1.9GB Multi-Part Chunking with Auto-Resume
                chunk_mb = cfg.user_chunk_mb or 1900
                chunk_size_bytes = chunk_mb * 1024 * 1024
                total_chunks = math.ceil(file_size / chunk_size_bytes)
                file_id = f"chunked_user_{secrets.token_hex(8)}"

                activity_logger.add("CHUNKING", f"[{file.filename}] Massive file ({size_label}). Slicing into {total_chunks} parts (~{chunk_mb} MB each) with MTProto...")

                await add_file(
                    file_id=file_id,
                    message_id=0,
                    file_name=file.filename,
                    file_size=file_size,
                    mime_type=file.content_type or "application/octet-stream",
                    expiration_date=exp_date,
                    share_token=share_token,
                    password=password,
                    bot_uploader="personal_account",
                    upload_source="user_account",
                    folder=folder or "/",
                    is_chunked=True,
                    total_chunks=total_chunks,
                    has_thumbnail=has_thumbnail,
                    thumbnail_blob=thumbnail_blob
                )

                tracker = SpeedTracker(file.filename, file_size)
                def chunk_progress(part_num, total_parts, uploaded, total):
                    tracker.update(uploaded)

                upload_res = await user_manager.upload_chunked(
                    chat_id=cfg.channel_id,
                    file_path=temp_path,
                    filename=file.filename,
                    file_id_db=file_id,
                    file_size=file_size,
                    chunk_mb=chunk_mb,
                    throttle_delay=cfg.throttle_delay_sec or 0.0,
                    progress_cb=chunk_progress
                )
                tracker.update(file_size, force=True)

                bandwidth_manager.add_bytes(file_size)
                activity_logger.add("SUCCESS", f"[{file.filename}] All {total_chunks} parts uploaded & assembled via MTProto!", level="success")

                return {
                    "status": "success",
                    "file_id": file_id,
                    "file_name": file.filename,
                    "file_size": file_size,
                    "is_chunked": True,
                    "total_chunks": total_chunks,
                    "upload_source": "user_account",
                    "direct_link": f"{cfg.base_url}/dl/{file_id}/{file.filename}",
                    "share_link": f"{cfg.base_url}/share/{share_token}"
                }

        else:
            # Multi-Bot Cluster Engine
            CHUNK_THRESHOLD = 19 * 1024 * 1024  # 19 MB (Bot API getFile limit)
            CHUNK_SIZE = 19 * 1024 * 1024

            if file_size <= CHUNK_THRESHOLD:
                activity_logger.add("TRANSMIT", f"[{file.filename}] Sending payload ({size_label}) via Bot Cluster...")
                with open(temp_path, "rb") as doc_f:
                    msg, uploader = await cluster.upload_document(
                        chat_id=cfg.channel_id,
                        file_obj=doc_f,
                        filename=file.filename,
                        is_video=is_video,
                        is_audio=is_audio
                    )

                media = getattr(msg, "video", None) or getattr(msg, "audio", None) or getattr(msg, "document", None)
                if not media:
                    raise Exception("Telegram message did not contain a valid media or document object.")
                    
                file_id = media.file_id
                activity_logger.add("BOT", f"[{file.filename}] Sent via @{uploader} (Msg ID: {msg.message_id}).")

                await add_file(
                    file_id=file_id,
                    message_id=msg.message_id,
                    file_name=file.filename,
                    file_size=file_size,
                    mime_type=file.content_type or "application/octet-stream",
                    expiration_date=exp_date,
                    share_token=share_token,
                    password=password,
                    bot_uploader=uploader,
                    upload_source="bot",
                    folder=folder or "/",
                    is_chunked=False,
                    total_chunks=1,
                    has_thumbnail=has_thumbnail,
                    thumbnail_blob=thumbnail_blob
                )
                bandwidth_manager.add_bytes(file_size)
                activity_logger.add("SUCCESS", f"[{file.filename}] Upload completed via Bot Cluster!", level="success")

                return {
                    "status": "success",
                    "file_id": file_id,
                    "file_name": file.filename,
                    "file_size": file_size,
                    "is_chunked": False,
                    "total_chunks": 1,
                    "upload_source": "bot",
                    "direct_link": f"{cfg.base_url}/dl/{file_id}/{file.filename}",
                    "share_link": f"{cfg.base_url}/share/{share_token}"
                }
            else:
                # Multipart Bot Chunked Upload with Multi-Bot Parallelism
                total_chunks = math.ceil(file_size / CHUNK_SIZE)
                file_id = f"chunked_{secrets.token_hex(10)}"
                activity_logger.add("CHUNKING", f"[{file.filename}] File size {size_label} > 19 MB. Slicing into {total_chunks} parts (19 MB each)...")

                await add_file(
                    file_id=file_id,
                    message_id=0,
                    file_name=file.filename,
                    file_size=file_size,
                    mime_type=file.content_type or "application/octet-stream",
                    expiration_date=exp_date,
                    share_token=share_token,
                    password=password,
                    bot_uploader="cluster",
                    upload_source="bot",
                    folder=folder or "/",
                    is_chunked=True,
                    total_chunks=total_chunks,
                    has_thumbnail=has_thumbnail,
                    thumbnail_blob=thumbnail_blob
                )

                # High-speed parallel bot uploads: fully leverage all bots in cluster (3 concurrent chunks per bot)
                total_active_bots = len(cluster.bots) if cluster.bots else 1
                concurrency = max(4, total_active_bots * 3)
                semaphore = asyncio.Semaphore(concurrency)
                completed_count = 0
                uploaded_bytes_total = 0
                completed_lock = asyncio.Lock()
                tracker = SpeedTracker(file.filename, file_size)

                async def upload_single_bot_chunk(c_idx: int):
                    nonlocal completed_count, uploaded_bytes_total
                    async with semaphore:
                        offset = c_idx * CHUNK_SIZE
                        def read_bot_slice():
                            with open(temp_path, "rb") as f_src:
                                f_src.seek(offset)
                                return f_src.read(CHUNK_SIZE)

                        chunk_bytes = await asyncio.to_thread(read_bot_slice)
                        chunk_filename = f"{file.filename}.part{c_idx + 1:04d}"
                        last_err = None

                        for attempt in range(3):
                            try:
                                msg, uploader = await cluster.upload_raw_chunk(
                                    chat_id=cfg.channel_id,
                                    chunk_bytes=chunk_bytes,
                                    filename=chunk_filename,
                                    bot_idx=c_idx + attempt
                                )
                                media = getattr(msg, "document", None) or getattr(msg, "video", None) or getattr(msg, "audio", None)
                                if not media:
                                    raise Exception(f"Chunk {c_idx + 1} did not return valid Telegram media.")

                                await add_file_chunk(
                                    file_id=file_id,
                                    chunk_index=c_idx,
                                    message_id=msg.message_id,
                                    tg_file_id=media.file_id,
                                    chunk_size=len(chunk_bytes),
                                    bot_uploader=uploader,
                                    upload_source="bot",
                                    completed=True
                                )
                                chunk_len = len(chunk_bytes)
                                del chunk_bytes

                                async with completed_lock:
                                    completed_count += 1
                                    uploaded_bytes_total += chunk_len
                                    tracker.update(min(file_size, uploaded_bytes_total))
                                return
                            except Exception as e:
                                last_err = e
                                logger.warning(f"Bot chunk {c_idx + 1} upload retry {attempt + 1}: {e}")
                                await asyncio.sleep(0.5)
                        
                        raise Exception(f"Failed to upload bot chunk {c_idx + 1} after 3 attempts: {last_err}")

                await asyncio.gather(*[upload_single_bot_chunk(i) for i in range(total_chunks)])
                tracker.update(file_size, force=True)
                bandwidth_manager.add_bytes(uploaded_bytes_total or file_size)
                activity_logger.add("SUCCESS", f"[{file.filename}] All {total_chunks} parts stored via Bot Cluster!", level="success")

                return {
                    "status": "success",
                    "file_id": file_id,
                    "file_name": file.filename,
                    "file_size": file_size,
                    "is_chunked": True,
                    "total_chunks": total_chunks,
                    "upload_source": "bot",
                    "direct_link": f"{cfg.base_url}/dl/{file_id}/{file.filename}",
                    "share_link": f"{cfg.base_url}/share/{share_token}"
                }

    except HTTPException:
        raise
    except Exception as e:
        activity_logger.add("ERROR", f"[{file.filename}] Upload failed: {e}", level="error")
        logger.error(f"Upload error for {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

async def _metered_stream(source):
    """Wrap a byte-chunk async generator and record served bytes into the Bandwidth Manager."""
    served = 0
    try:
        async for chunk in source:
            if chunk:
                served += len(chunk)
            yield chunk
    finally:
        if served > 0:
            try:
                bandwidth_manager.add_bytes(served)
            except Exception as e:
                logger.warning(f"Failed to record download bandwidth: {e}")

async def stream_telegram_file(file_data: dict, filename: str, request: Request):
    await increment_view_count(file_data["file_id"])
    file_size = file_data["file_size"]
    mime = file_data.get("mime_type") or "application/octet-stream"
    is_chunked = bool(file_data.get("is_chunked"))
    upload_source = file_data.get("upload_source") or "bot"

    # Auto-detect media MIME type for streaming video/audio player
    ext = os.path.splitext(filename)[1].lower()
    if ext in [".mp4", ".m4v"] and (mime == "application/octet-stream" or not mime):
        mime = "video/mp4"
    elif ext in [".mkv"] and (mime == "application/octet-stream" or not mime):
        mime = "video/x-matroska"
    elif ext in [".webm"] and (mime == "application/octet-stream" or not mime):
        mime = "video/webm"
    elif ext in [".mp3"] and (mime == "application/octet-stream" or not mime):
        mime = "audio/mpeg"
    elif ext in [".flac"] and (mime == "application/octet-stream" or not mime):
        mime = "audio/flac"
    elif ext in [".wav"] and (mime == "application/octet-stream" or not mime):
        mime = "audio/wav"

    range_header = request.headers.get("Range")
    start_byte = 0
    end_byte = file_size - 1
    status_code = 200

    if range_header:
        match = re.match(r"bytes=(\d+)-(\d+)?", range_header)
        if match:
            start_byte = int(match.group(1))
            if match.group(2):
                end_byte = int(match.group(2))
            status_code = 206

    content_length = end_byte - start_byte + 1

    # Bandwidth Manager gate (Phase 6): block downloads once today's quota is exhausted.
    if not bandwidth_manager.can_transfer(content_length):
        bw = bandwidth_manager.get_stats()
        activity_logger.add(
            "BANDWIDTH",
            f"[{filename}] Download blocked: daily bandwidth quota exceeded "
            f"({format_file_size(bw['used_today_bytes'])} / {format_file_size(bw['quota_bytes'])}).",
            level="error"
        )
        raise HTTPException(status_code=429, detail="Daily bandwidth quota exceeded.")

    proxy = config_mgr.config.proxy_url

    if upload_source == "user_account" and user_manager.is_connected:
        # Stream via MTProto client
        if not is_chunked:
            async def stream_user_single():
                async for chunk in user_manager.stream_file_range(
                    chat_id=config_mgr.config.channel_id,
                    message_id=file_data["message_id"],
                    offset=start_byte,
                    limit=content_length
                ):
                    yield chunk

            disposition = "inline" if any(x in mime for x in ["image", "text", "pdf", "video", "audio"]) else "attachment"
            headers = {
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": mime,
                "Content-Disposition": f'{disposition}; filename="{filename}"'
            }
            if status_code == 206:
                headers["Content-Range"] = f"bytes {start_byte}-{end_byte}/{file_size}"
            return StreamingResponse(_metered_stream(stream_user_single()), status_code=status_code, headers=headers)
        else:
            # Multi-part chunked MTProto stream
            chunks = await get_file_chunks(file_data["file_id"])
            if not chunks:
                raise HTTPException(status_code=404, detail="No chunks found for this file.")

            chunk_map = []
            curr_offset = 0
            for c in chunks:
                c_size = c["chunk_size"]
                chunk_map.append({
                    "start": curr_offset,
                    "end": curr_offset + c_size - 1,
                    "size": c_size,
                    "message_id": c["message_id"],
                    "chunk_index": c["chunk_index"]
                })
                curr_offset += c_size

            target_chunks = [c for c in chunk_map if c["end"] >= start_byte and c["start"] <= end_byte]

            async def stream_user_multi():
                for chunk_meta in target_chunks:
                    req_start = max(0, start_byte - chunk_meta["start"])
                    req_end = min(chunk_meta["size"] - 1, end_byte - chunk_meta["start"])
                    req_len = req_end - req_start + 1

                    if req_start > req_end:
                        continue

                    async for chunk in user_manager.stream_file_range(
                        chat_id=config_mgr.config.channel_id,
                        message_id=chunk_meta["message_id"],
                        offset=req_start,
                        limit=req_len
                    ):
                        yield chunk

            disposition = "inline" if any(x in mime for x in ["image", "text", "pdf", "video", "audio"]) else "attachment"
            headers = {
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": mime,
                "Content-Disposition": f'{disposition}; filename="{filename}"'
            }
            if status_code == 206:
                headers["Content-Range"] = f"bytes {start_byte}-{end_byte}/{file_size}"
            return StreamingResponse(_metered_stream(stream_user_multi()), status_code=status_code, headers=headers)

    # Fallback to Bot API HTTP Streaming
    if not is_chunked:
        try:
            remote_url = await cluster.get_file_download_url(file_data["file_id"])
        except Exception as e:
            logger.error(f"Error getting download URL: {e}")
            raise HTTPException(status_code=500, detail="Telegram Bot failed to retrieve file download URL.")

        async def stream_chunks():
            import httpx
            headers = {"Range": f"bytes={start_byte}-{end_byte}"}
            async with httpx.AsyncClient(proxy=proxy, timeout=60.0) as client:
                async with client.stream("GET", remote_url, headers=headers) as r:
                    async for chunk in r.aiter_bytes(chunk_size=65536):
                        yield chunk

        disposition = "inline" if any(x in mime for x in ["image", "text", "pdf", "video", "audio"]) else "attachment"
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime,
            "Content-Disposition": f'{disposition}; filename="{filename}"'
        }
        if status_code == 206:
            headers["Content-Range"] = f"bytes {start_byte}-{end_byte}/{file_size}"

        return StreamingResponse(_metered_stream(stream_chunks()), status_code=status_code, headers=headers)
    else:
        # Dynamic Range-aware Multi-Chunk Streaming Generator for Bot
        chunks = await get_file_chunks(file_data["file_id"])
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks found for this file.")

        chunk_map = []
        curr_offset = 0
        for c in chunks:
            c_size = c["chunk_size"]
            chunk_map.append({
                "start": curr_offset,
                "end": curr_offset + c_size - 1,
                "size": c_size,
                "tg_file_id": c["tg_file_id"],
                "chunk_index": c["chunk_index"]
            })
            curr_offset += c_size

        target_chunks = [
            c for c in chunk_map 
            if c["end"] >= start_byte and c["start"] <= end_byte
        ]

        async def stream_multi_chunks():
            import httpx
            async with httpx.AsyncClient(proxy=proxy, timeout=120.0) as client:
                for chunk_meta in target_chunks:
                    req_start = max(0, start_byte - chunk_meta["start"])
                    req_end = min(chunk_meta["size"] - 1, end_byte - chunk_meta["start"])

                    if req_start > req_end:
                        continue

                    try:
                        remote_url = await cluster.get_file_download_url(chunk_meta["tg_file_id"])
                    except Exception as e:
                        logger.error(f"Failed to fetch chunk {chunk_meta['chunk_index']}: {e}")
                        break

                    chunk_range = {"Range": f"bytes={req_start}-{req_end}"}
                    async with client.stream("GET", remote_url, headers=chunk_range) as r:
                        async for chunk in r.aiter_bytes(chunk_size=65536):
                            yield chunk

        disposition = "inline" if any(x in mime for x in ["image", "text", "pdf", "video", "audio"]) else "attachment"
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime,
            "Content-Disposition": f'{disposition}; filename="{filename}"'
        }
        if status_code == 206:
            headers["Content-Range"] = f"bytes {start_byte}-{end_byte}/{file_size}"

        return StreamingResponse(_metered_stream(stream_multi_chunks()), status_code=status_code, headers=headers)

@app.get("/thumbnail/{file_id}")
async def get_thumbnail_route(file_id: str):
    try:
        thumb = await get_file_thumbnail(file_id)
        if thumb:
            return Response(content=thumb, media_type="image/jpeg")
        
        file_data = await get_file_by_id(file_id)
        if not file_data:
            raise HTTPException(status_code=404, detail="File not found")
        
        poster = generate_video_poster(file_data.get("file_name", "Video"))
        return Response(content=poster, media_type="image/jpeg")
    except Exception as e:
        logger.warning(f"Failed to load thumbnail for {file_id}: {e}")
        fallback = generate_video_poster("Media")
        return Response(content=fallback, media_type="image/jpeg")

@app.get("/dl/{file_id}/{filename}")
@app.get("/preview/{file_id}")
async def download_or_stream(
    file_id: str,
    filename: Optional[str] = None,
    password: Optional[str] = None,
    share_token: Optional[str] = None,
    share_password: Optional[str] = None,
    request: Request = None
):
    file_data = await get_file_by_id(file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")

    # Share-link gating (password-protected share links)
    if share_token:
        share = await get_share_by_token(share_token)
        if not share:
            raise HTTPException(status_code=404, detail="Shared link is invalid.")
        if share.get("expires_at"):
            try:
                exp = datetime.datetime.fromisoformat(share["expires_at"])
                if datetime.datetime.now() > exp:
                    raise HTTPException(status_code=410, detail="This shared link has expired.")
            except ValueError:
                pass
        if share.get("password_hash"):
            if not share_password or share["password_hash"] != hash_password(share_password):
                raise HTTPException(status_code=403, detail="This share link is password protected.")
        await increment_share_access(share_token)

    if file_data.get("password") and file_data["password"] != password:
        raise HTTPException(status_code=403, detail="File is password protected. Invalid password.")

    return await stream_telegram_file(file_data, filename or file_data["file_name"], request)

@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    file_data = await get_file_by_id(file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")
    
    if config_mgr.config.channel_id:
        if file_data.get("is_chunked"):
            chunks = await get_file_chunks(file_id)
            for c in chunks:
                if c.get("message_id"):
                    asyncio.create_task(cluster.delete_message(config_mgr.config.channel_id, c["message_id"]))
        elif file_data.get("message_id"):
            asyncio.create_task(cluster.delete_message(config_mgr.config.channel_id, file_data["message_id"]))

    deleted = await delete_file_db(file_id)
    return {"status": "success", "deleted": deleted}

@app.get("/share/{share_token}")
async def get_shared_file_info(share_token: str):
    file_data = await get_file_by_share_token(share_token)
    if not file_data:
        raise HTTPException(status_code=404, detail="Shared link is invalid or expired")
    
    if file_data.get("expiration_date"):
        exp = datetime.datetime.fromisoformat(file_data["expiration_date"])
        if datetime.datetime.now() > exp:
            raise HTTPException(status_code=410, detail="This shared link has expired")

    return {
        "file_name": file_data["file_name"],
        "file_size": file_data["file_size"],
        "mime_type": file_data["mime_type"],
        "is_protected": bool(file_data.get("password")),
        "file_id": file_data["file_id"],
        "is_chunked": bool(file_data.get("is_chunked"))
    }

@app.post("/api/share")
async def api_create_share(req: ShareCreateRequest):
    file_data = await get_file_by_id(req.file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")

    token = secrets.token_urlsafe(16)
    expires_at = (
        (datetime.datetime.now() + datetime.timedelta(days=req.expires_days)).isoformat()
        if req.expires_days else None
    )
    await create_share(req.file_id, token, password=req.password, expires_at=expires_at)

    share_url = f"{config_mgr.config.base_url}/dl/{req.file_id}/{file_data['file_name']}?share_token={token}"
    activity_logger.add("SHARE", f"Created share link for {file_data['file_name']}", level="success")
    return {
        "status": "success",
        "token": token,
        "share_url": share_url,
        "expires_at": expires_at,
        "is_protected": bool(req.password)
    }

@app.get("/api/shares")
async def api_list_shares():
    return {"shares": await list_shares()}

@app.delete("/api/share/{token}")
async def api_revoke_share(token: str):
    revoked = await revoke_share(token)
    if not revoked:
        raise HTTPException(status_code=404, detail="Share link not found.")
    activity_logger.add("SHARE", f"Revoked share link {token[:8]}...")
    return {"status": "success", "revoked": True}

@app.post("/file/{file_id}/rename")
async def rename_file(file_id: str, new_name: str = Query(...)):
    file_data = await get_file_by_id(file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")
    
    renamed = await rename_file_db(file_id, new_name)
    return {"status": "success", "renamed": renamed, "new_name": new_name}

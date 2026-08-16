# InfiniDrive MTProto Engine  12-worker parallel Telethon uploader, recommended for files >= 20MB
import os
import io
import re
import math
import secrets
import asyncio
import logging
import collections
from typing import Optional, Dict, Any, Callable, AsyncGenerator
from pathlib import Path

try:
    from telethon import TelegramClient, errors
    from telethon.sessions import StringSession
    from telethon.tl.types import DocumentAttributeFilename, InputFileBig, InputFile
    from telethon.tl.functions.upload import SaveBigFilePartRequest, SaveFilePartRequest
    TELETHON_AVAILABLE = True
except ImportError:
    TELETHON_AVAILABLE = False

try:
    from config import config_mgr, AppConfig
    import database
except ImportError:
    from .config import config_mgr, AppConfig
    from . import database

logger = logging.getLogger("infinidrive.mtproto")

async def fast_upload_stream(
    client: TelegramClient,
    file_source: Any,
    filename: str,
    file_size: int,
    progress_callback: Optional[Callable[[int, int], None]] = None,
    max_workers: Optional[int] = None
) -> Any:
    """
    Parallel multi-connection MTProto Turbo Uploader.
    Dynamically scales up to 12 concurrent workers for maximum physical bandwidth saturation.
    Uses 512KB payload slices with prefetch pipeline and zero-copy memoryviews.
    """
    part_size = 512 * 1024
    total_parts = max(1, math.ceil(file_size / part_size))
    is_big = file_size > 10 * 1024 * 1024
    file_id = secrets.randbits(63)

    if max_workers is None:
        if file_size < 10 * 1024 * 1024:
            workers_count = 4
        elif file_size < 100 * 1024 * 1024:
            workers_count = 8
        else:
            workers_count = 12
    else:
        workers_count = max_workers

    queue: asyncio.Queue = asyncio.Queue(maxsize=workers_count * 3)
    progress_lock = asyncio.Lock()
    uploaded_bytes = 0

    async def worker():
        nonlocal uploaded_bytes
        while True:
            item = await queue.get()
            if item is None:
                queue.task_done()
                break
            part_index, chunk_data = item
            actual_len = len(chunk_data)

            for attempt in range(6):
                try:
                    if is_big:
                        req = SaveBigFilePartRequest(
                            file_id=file_id,
                            file_part=part_index,
                            file_total_parts=total_parts,
                            bytes=bytes(chunk_data) if isinstance(chunk_data, memoryview) else chunk_data
                        )
                    else:
                        req = SaveFilePartRequest(
                            file_id=file_id,
                            file_part=part_index,
                            bytes=bytes(chunk_data) if isinstance(chunk_data, memoryview) else chunk_data
                        )
                    await client(req)
                    async with progress_lock:
                        uploaded_bytes += actual_len
                        if progress_callback:
                            progress_callback(uploaded_bytes, file_size)
                    break
                except errors.FloodWaitError as e:
                    logger.warning(f"FloodWait encountered: sleeping for {e.seconds + 1}s")
                    await asyncio.sleep(e.seconds + 1)
                except Exception as e:
                    if attempt >= 5:
                        raise e
                    await asyncio.sleep(0.5 * (attempt + 1))

            queue.task_done()

    workers = [asyncio.create_task(worker()) for _ in range(workers_count)]

    # Stream parts asynchronously into queue
    if isinstance(file_source, (str, Path)):
        loop = asyncio.get_running_loop()
        def read_part(f, size):
            return f.read(size)

        with open(file_source, "rb") as f:
            for idx in range(total_parts):
                chunk = await loop.run_in_executor(None, read_part, f, part_size)
                if not chunk:
                    break
                await queue.put((idx, chunk))
    elif isinstance(file_source, io.BytesIO):
        file_source.seek(0)
        mv = memoryview(file_source.getvalue())
        for idx in range(total_parts):
            start = idx * part_size
            end = min(start + part_size, file_size)
            chunk = mv[start:end]
            await queue.put((idx, chunk))
    else:
        for idx in range(total_parts):
            chunk = file_source.read(part_size)
            if not chunk:
                break
            await queue.put((idx, chunk))

    await queue.join()
    for _ in range(workers_count):
        await queue.put(None)
    await asyncio.gather(*workers)

    if is_big:
        return InputFileBig(id=file_id, parts=total_parts, name=filename)
    else:
        return InputFile(id=file_id, parts=total_parts, name=filename, md5_checksum="")


class TelegramUserManager:
    def __init__(self):
        self.client: Optional[Any] = None
        self._auth_phone: Optional[str] = None
        self._auth_hash: Optional[str] = None
        self._auth_api_id: Optional[int] = None
        self._auth_api_hash: Optional[str] = None
        self._is_connected: bool = False
        self._cached_profile: Optional[Dict[str, Any]] = None
        self._lock = asyncio.Lock()

    @property
    def is_available(self) -> bool:
        return TELETHON_AVAILABLE

    @property
    def is_connected(self) -> bool:
        return self._is_connected and self.client is not None

    async def start(self) -> bool:
        if not TELETHON_AVAILABLE:
            logger.warning("Telethon is not installed. MTProto user account is disabled.")
            return False

        config = config_mgr.config
        if not config.session_string or not config.api_id or not config.api_hash:
            logger.info("No active MTProto session found in configuration.")
            return False

        async with self._lock:
            try:
                if self.client:
                    try:
                        await self.client.disconnect()
                    except Exception:
                        pass

                session = StringSession(config.session_string.strip())
                self.client = TelegramClient(
                    session,
                    config.api_id,
                    config.api_hash.strip(),
                    device_model="TGDrive High-Speed",
                    system_version="Windows 11",
                    app_version="2.0.0",
                    connection_retries=10,
                    retry_delay=1,
                    flood_sleep_threshold=0,
                    request_retries=10,
                    auto_reconnect=True,
                    sequential_updates=False
                )
                await self.client.connect()

                if await self.client.is_user_authorized():
                    self._is_connected = True
                    me = await self.client.get_me()
                    is_premium = getattr(me, "premium", False)
                    upload_limit = 4.0 if is_premium else 2.0
                    self._cached_profile = {
                        "id": me.id,
                        "first_name": me.first_name or "",
                        "last_name": me.last_name or "",
                        "username": me.username or "",
                        "phone": me.phone or config.phone_number or "",
                        "is_premium": is_premium,
                        "upload_limit_gb": upload_limit,
                        "is_connected": True
                    }
                    logger.info(f"MTProto client connected as @{me.username or me.first_name} (Premium: {is_premium})")
                    return True
                else:
                    logger.warning("MTProto session is unauthorized or expired.")
                    self._is_connected = False
                    self._cached_profile = None
                    return False
            except Exception as e:
                logger.error(f"Failed to start MTProto client: {e}")
                self._is_connected = False
                return False

    async def send_auth_code(self, phone: str, api_id: int, api_hash: str) -> Dict[str, Any]:
        if not TELETHON_AVAILABLE:
            raise RuntimeError("Telethon library is missing. Install telethon>=1.36.0")

        clean_phone = phone.strip().replace(" ", "").replace("-", "")
        if not clean_phone.startswith("+"):
            clean_phone = f"+{clean_phone}"

        temp_client = TelegramClient(
            StringSession(),
            api_id,
            api_hash.strip(),
            device_model="TGDrive Desktop",
            system_version="Windows 11",
            app_version="2.0.0"
        )
        await temp_client.connect()

        try:
            res = await temp_client.send_code_request(clean_phone)
            self._auth_phone = clean_phone
            self._auth_hash = res.phone_code_hash
            self._auth_api_id = api_id
            self._auth_api_hash = api_hash.strip()
            self.client = temp_client

            logger.info(f"OTP code sent successfully to {clean_phone}")
            return {
                "success": True,
                "phone": clean_phone,
                "phone_code_hash": res.phone_code_hash,
                "timeout": getattr(res, "timeout", 90)
            }
        except errors.FloodWaitError as e:
            await temp_client.disconnect()
            raise RuntimeError(f"Telegram flood limit: please wait {e.seconds} seconds before trying again.")
        except Exception as e:
            await temp_client.disconnect()
            raise RuntimeError(f"Failed to send code: {str(e)}")

    async def sign_in(self, phone: str, code: str, password: Optional[str] = None) -> Dict[str, Any]:
        if not self.client or not self._auth_hash or not self._auth_api_id:
            raise RuntimeError("Auth session not initialized. Please request code first.")

        clean_phone = phone.strip().replace(" ", "").replace("-", "")
        if not clean_phone.startswith("+"):
            clean_phone = f"+{clean_phone}"

        try:
            try:
                user = await self.client.sign_in(
                    clean_phone,
                    code=code.strip(),
                    phone_code_hash=self._auth_hash
                )
            except errors.SessionPasswordNeededError:
                if not password:
                    return {
                        "success": False,
                        "requires_2fa": True,
                        "message": "Two-factor authentication (2FA) password required."
                    }
                user = await self.client.sign_in(password=password.strip())

            session_str = self.client.session.save()
            is_premium = getattr(user, "premium", False)
            upload_limit = 4.0 if is_premium else 2.0

            config_mgr.update(
                api_id=self._auth_api_id,
                api_hash=self._auth_api_hash,
                phone_number=clean_phone,
                session_string=session_str,
                auth_mode="smart"
            )

            self._is_connected = True
            self._cached_profile = {
                "id": user.id,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "username": user.username or "",
                "phone": user.phone or clean_phone,
                "is_premium": is_premium,
                "upload_limit_gb": upload_limit,
                "is_connected": True
            }

            logger.info(f"Signed in successfully as @{user.username or user.first_name}")
            return {
                "success": True,
                "requires_2fa": False,
                "profile": self._cached_profile
            }
        except errors.PhoneCodeInvalidError:
            raise RuntimeError("Invalid verification code. Please check your Telegram app.")
        except errors.PhoneCodeExpiredError:
            raise RuntimeError("Verification code expired. Please request a new code.")
        except errors.PasswordHashInvalidError:
            raise RuntimeError("Incorrect 2FA password.")
        except Exception as e:
            raise RuntimeError(f"Sign in failed: {str(e)}")

    async def logout(self) -> bool:
        if self.client and self._is_connected:
            try:
                await self.client.log_out()
            except Exception as e:
                logger.warning(f"Error logging out from Telegram server: {e}")

        self._is_connected = False
        self._cached_profile = None

        config_mgr.update(
            session_string="",
            phone_number=""
        )
        logger.info("MTProto personal account disconnected.")
        return True

    async def get_profile(self) -> Dict[str, Any]:
        if not self._is_connected or not self.client:
            return {
                "is_connected": False,
                "upload_limit_gb": 2.0
            }

        if self._cached_profile:
            return self._cached_profile

        try:
            me = await self.client.get_me()
            is_premium = getattr(me, "premium", False)
            upload_limit = 4.0 if is_premium else 2.0
            self._cached_profile = {
                "id": me.id,
                "first_name": me.first_name or "",
                "last_name": me.last_name or "",
                "username": me.username or "",
                "phone": me.phone or config_mgr.config.phone_number or "",
                "is_premium": is_premium,
                "upload_limit_gb": upload_limit,
                "is_connected": True
            }
            return self._cached_profile
        except Exception as e:
            logger.error(f"Failed to fetch profile: {e}")
            return {
                "is_connected": False,
                "upload_limit_gb": 2.0,
                "error": str(e)
            }

    async def upload_single(
        self,
        chat_id: Any,
        file_source: Any,
        filename: str,
        progress_cb: Optional[Callable[[int, int], None]] = None
    ) -> Dict[str, Any]:
        if not self.is_connected:
            raise RuntimeError("MTProto user client is not connected.")

        target_peer = int(chat_id) if str(chat_id).lstrip("-").isdigit() else str(chat_id)

        try:
            # Measure file size
            if isinstance(file_source, (str, Path)):
                file_size = os.path.getsize(file_source)
            elif isinstance(file_source, io.BytesIO):
                file_size = file_source.getbuffer().nbytes
            else:
                file_size = 0

            # Turbo parallel multi-connection MTProto part uploader
            if file_size > 0:
                file_handle = await fast_upload_stream(
                    self.client,
                    file_source,
                    filename,
                    file_size,
                    progress_callback=progress_cb,
                    max_workers=6
                )
            else:
                file_handle = await self.client.upload_file(
                    file_source,
                    part_size_kb=512,
                    progress_callback=progress_cb
                )

            msg = await self.client.send_file(
                target_peer,
                file_handle,
                caption=f"ð {filename}\nâ¡ Engine: MTProto Turbo",
                force_document=True,
                attributes=[DocumentAttributeFilename(file_name=filename)]
            )

            tg_file_id = ""
            if msg.document:
                tg_file_id = str(msg.document.id)

            return {
                "message_id": msg.id,
                "tg_file_id": tg_file_id,
                "uploader": self._cached_profile.get("username", "personal_account") if self._cached_profile else "personal_account"
            }
        except errors.FloodWaitError as e:
            logger.warning(f"FloodWaitError encounter in upload_single: waiting {e.seconds}s")
            await asyncio.sleep(e.seconds + 3)
            return await self.upload_single(chat_id, file_source, filename, progress_cb)
        except Exception as e:
            logger.error(f"MTProto upload_single failed: {e}")
            raise


    async def upload_chunked(
        self,
        chat_id: Any,
        file_path: str,
        filename: str,
        file_id_db: str,
        file_size: int,
        chunk_mb: int = 1900,
        throttle_delay: float = 0.0,
        progress_cb: Optional[Callable[[int, int, int, int], None]] = None
    ) -> Dict[str, Any]:
        if not self.is_connected:
            raise RuntimeError("MTProto user client is not connected.")

        target_peer = int(chat_id) if str(chat_id).lstrip("-").isdigit() else str(chat_id)
        chunk_size_bytes = chunk_mb * 1024 * 1024
        total_chunks = max(1, math.ceil(file_size / chunk_size_bytes))

        # Check existing chunks in database for seamless auto-resume
        existing_chunks = await database.get_file_chunks(file_id_db)
        completed_indices = {c["chunk_index"]: c for c in existing_chunks if c.get("completed", 1) == 1}

        first_message_id = completed_indices.get(0, {}).get("message_id", 0)
        p = Path(file_path)

        semaphore = asyncio.Semaphore(3)
        completed_chunks_count = len(completed_indices)
        uploaded_bytes_total = sum(c.get("chunk_size", chunk_size_bytes) for c in completed_indices.values())
        progress_lock = asyncio.Lock()

        async def upload_single_part(idx: int):
            nonlocal first_message_id, completed_chunks_count, uploaded_bytes_total
            if idx in completed_indices:
                return

            offset = idx * chunk_size_bytes
            async with semaphore:
                # Read chunk data in worker thread
                def read_slice():
                    with open(p, "rb") as f:
                        f.seek(offset)
                        return f.read(chunk_size_bytes)

                chunk_data = await asyncio.to_thread(read_slice)
                actual_chunk_size = len(chunk_data)
                part_filename = f"{filename}.part{idx+1:04d}.tgpart"
                caption = f"ð¦ {filename} (Part {idx+1}/{total_chunks})\nâ¡ Engine: MTProto User Client"

                success = False
                retries = 0
                while not success and retries < 5:
                    try:
                        chunk_buffer = io.BytesIO(chunk_data)
                        chunk_buffer.name = part_filename

                        # Fast parallel multi-worker chunk upload
                        file_handle = await fast_upload_stream(
                            self.client,
                            chunk_buffer,
                            part_filename,
                            actual_chunk_size,
                            max_workers=4
                        )

                        msg = await self.client.send_file(
                            target_peer,
                            file_handle,
                            caption=caption,
                            force_document=True,
                            attributes=[DocumentAttributeFilename(file_name=part_filename)]
                        )

                        doc_id = str(msg.document.id) if msg.document else str(msg.id)
                        if idx == 0:
                            first_message_id = msg.id

                        await database.add_file_chunk(
                            file_id=file_id_db,
                            chunk_index=idx,
                            message_id=msg.id,
                            tg_file_id=doc_id,
                            chunk_size=actual_chunk_size,
                            bot_uploader=self._cached_profile.get("username", "personal_account") if self._cached_profile else "personal_account",
                            upload_source="user_account",
                            completed=True
                        )

                        async with progress_lock:
                            completed_chunks_count += 1
                            uploaded_bytes_total += actual_chunk_size
                            if progress_cb:
                                progress_cb(completed_chunks_count, total_chunks, min(file_size, uploaded_bytes_total), file_size)

                        success = True
                    except errors.FloodWaitError as e:
                        logger.warning(f"Telegram FloodWait on chunk {idx+1}: sleeping {e.seconds}s + 3s...")
                        await asyncio.sleep(e.seconds + 3)
                        retries += 1
                    except Exception as e:
                        logger.error(f"Error uploading chunk {idx+1} (retry {retries+1}/5): {e}")
                        retries += 1
                        await asyncio.sleep(2)
                        if retries >= 5:
                            raise

        tasks = [upload_single_part(i) for i in range(total_chunks)]
        await asyncio.gather(*tasks)

        return {
            "first_message_id": first_message_id,
            "total_chunks": total_chunks,
            "file_size": file_size,
            "uploader": "personal_account"
        }

    async def stream_file_range(
        self,
        chat_id: Any,
        message_id: int,
        offset: int = 0,
        limit: int = 1048576
    ) -> AsyncGenerator[bytes, None]:
        if not self.is_connected:
            raise RuntimeError("MTProto client is not connected.")

        target_peer = int(chat_id) if str(chat_id).lstrip("-").isdigit() else str(chat_id)
        msg = await self.client.get_messages(target_peer, ids=message_id)

        if not msg or not msg.document:
            raise RuntimeError(f"Message {message_id} not found or contains no document.")

        async for chunk in self.client.iter_download(
            msg.document,
            offset=offset,
            limit=limit,
            chunk_size=128 * 1024
        ):
            yield chunk

    async def sync_channel_library(self, chat_id: Any) -> Dict[str, Any]:
        """
        Scans all files in the Telegram storage channel and automatically rebuilds
        the local database metadata so users never lose files even after uninstalling.
        """
        if not self.is_connected:
            raise RuntimeError("MTProto client is not connected.")

        target_peer = int(chat_id) if str(chat_id).lstrip("-").isdigit() else str(chat_id)
        synced_count = 0
        chunk_map = collections.defaultdict(list)

        async for msg in self.client.iter_messages(target_peer, limit=5000):
            if not msg.document:
                continue

            doc = msg.document
            filename = "unnamed_file"
            for attr in doc.attributes:
                if isinstance(attr, DocumentAttributeFilename):
                    filename = attr.file_name
                    break

            size = doc.size
            mime = doc.mime_type or "application/octet-stream"
            tg_file_id = str(doc.id)
            uploader = self._cached_profile.get("username", "personal_account") if self._cached_profile else "personal_account"

            chunk_match = re.match(r"^(.*?)\.part(\d+)(?:\.tgpart)?$", filename, re.IGNORECASE)
            if chunk_match:
                base_name = chunk_match.group(1)
                part_idx = int(chunk_match.group(2)) - 1
                chunk_map[base_name].append({
                    "chunk_index": part_idx,
                    "message_id": msg.id,
                    "tg_file_id": tg_file_id,
                    "chunk_size": size,
                    "bot_uploader": uploader,
                })
            else:
                existing = await database.get_file_by_id(tg_file_id)
                if not existing:
                    share_token = secrets.token_urlsafe(16)
                    await database.add_file(
                        file_id=tg_file_id,
                        message_id=msg.id,
                        file_name=filename,
                        file_size=size,
                        mime_type=mime,
                        share_token=share_token,
                        bot_uploader=uploader,
                        upload_source="user_account",
                        folder="/",
                        is_chunked=False,
                        total_chunks=1
                    )
                    synced_count += 1

        for base_name, parts in chunk_map.items():
            parts.sort(key=lambda p: p["chunk_index"])
            total_size = sum(p["chunk_size"] for p in parts)
            first_part = parts[0]
            file_id = f"synced_chunk_{abs(hash(base_name))}"

            existing = await database.get_file_by_id(file_id)
            if not existing:
                share_token = secrets.token_urlsafe(16)
                await database.add_file(
                    file_id=file_id,
                    message_id=first_part["message_id"],
                    file_name=base_name,
                    file_size=total_size,
                    mime_type="application/octet-stream",
                    share_token=share_token,
                    bot_uploader=first_part["bot_uploader"],
                    upload_source="user_account",
                    folder="/",
                    is_chunked=True,
                    total_chunks=len(parts)
                )
                for p in parts:
                    await database.add_file_chunk(
                        file_id=file_id,
                        chunk_index=p["chunk_index"],
                        message_id=p["message_id"],
                        tg_file_id=p["tg_file_id"],
                        chunk_size=p["chunk_size"],
                        bot_uploader=p["bot_uploader"],
                        upload_source="user_account",
                        completed=True
                    )
                synced_count += 1

        return {"synced_count": synced_count}

user_manager = TelegramUserManager()


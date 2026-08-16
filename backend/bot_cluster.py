# InfiniDrive Bot Cluster  round-robin multi-bot load balancer for Telegram Bot API
import asyncio
import hashlib
import logging
from typing import List, Optional, Dict, Any
from telegram import Bot
from telegram.request import HTTPXRequest
try:
    from config import config_mgr, AppConfig
except ImportError:
    from .config import config_mgr, AppConfig

logger = logging.getLogger("tgdrive.bot_cluster")

class ManagedBot:
    def __init__(self, token: str, proxy_url: Optional[str] = None):
        self.token = token.strip()
        self.proxy_url = proxy_url
        self.token_hash = hashlib.md5(self.token.encode()).hexdigest()[:8]
        self.name = f"bot_{self.token_hash}"
        self.username: Optional[str] = None
        self.is_healthy: bool = False
        self.last_error: Optional[str] = None
        self.total_uploads: int = 0
        
        request = HTTPXRequest(
            connection_pool_size=32,
            http_version="1.1",
            read_timeout=600.0,
            write_timeout=600.0,
            connect_timeout=60.0,
            pool_timeout=60.0,
            media_write_timeout=600.0,
            proxy=proxy_url if proxy_url else None
        )
        self.bot = Bot(token=self.token, request=request)

    async def verify(self) -> bool:
        try:
            me = await asyncio.wait_for(self.bot.get_me(read_timeout=5.0, write_timeout=5.0, connect_timeout=5.0), timeout=6.0)
            self.username = me.username
            self.is_healthy = True
            self.last_error = None
            return True
        except Exception as e:
            self.is_healthy = False
            self.last_error = str(e)
            logger.warning(f"Failed to verify bot {self.name}: {e}")
            return False

class BotCluster:
    def __init__(self):
        self.bots: List[ManagedBot] = []
        self.current_idx = 0
        self._lock = asyncio.Lock()
        self.reload_from_config()

    def reload_from_config(self):
        config = config_mgr.config
        new_bots = []
        for token in config.bot_tokens:
            token = token.strip()
            if token:
                new_bots.append(ManagedBot(token=token, proxy_url=config.proxy_url))
        self.bots = new_bots
        self.current_idx = 0
        logger.info(f"BotCluster reloaded with {len(self.bots)} bots configured.")

    async def start_all(self) -> List[Dict[str, Any]]:
        if not self.bots:
            return []
        
        # Parallel verification of all cluster bots
        await asyncio.gather(*(b.verify() for b in self.bots), return_exceptions=True)
        return [{
            "name": b.name,
            "username": b.username,
            "healthy": b.is_healthy,
            "error": b.last_error,
            "uploads": b.total_uploads
        } for b in self.bots]

    def get_status(self) -> List[Dict[str, Any]]:
        return [{
            "name": b.name,
            "username": b.username or "unknown",
            "healthy": b.is_healthy,
            "error": b.last_error,
            "uploads": b.total_uploads,
            "token_masked": f"{b.token[:6]}...{b.token[-4:]}" if len(b.token) > 10 else "invalid",
            "token_hash": b.token_hash
        } for b in self.bots]

    async def add_and_verify_bot(self, token: str) -> Dict[str, Any]:
        token = token.strip()
        if not token:
            return {"success": False, "error": "Token cannot be empty."}

        async with self._lock:
            # Check if token already exists
            for existing in self.bots:
                if existing.token == token:
                    verified = await existing.verify()
                    return {
                        "success": verified,
                        "bot": {
                            "name": existing.name,
                            "username": existing.username,
                            "healthy": existing.is_healthy,
                            "error": existing.last_error,
                            "token_hash": existing.token_hash
                        }
                    }

            # Create and verify new bot
            new_bot = ManagedBot(token=token, proxy_url=config_mgr.config.proxy_url)
            is_valid = await new_bot.verify()
            
            if is_valid:
                self.bots.append(new_bot)
                current_tokens = list(config_mgr.config.bot_tokens)
                if token not in current_tokens:
                    current_tokens.append(token)
                    config_mgr.update(bot_tokens=current_tokens)
                
                logger.info(f"Bot @{new_bot.username} added and verified dynamically into cluster!")
                return {
                    "success": True,
                    "bot": {
                        "name": new_bot.name,
                        "username": new_bot.username,
                        "healthy": True,
                        "error": None,
                        "token_hash": new_bot.token_hash
                    }
                }
            else:
                return {
                    "success": False,
                    "error": new_bot.last_error or "Telegram rejected this bot token."
                }

    async def remove_bot(self, token_hash: str) -> bool:
        async with self._lock:
            target = None
            for b in self.bots:
                if b.token_hash == token_hash or b.token == token_hash:
                    target = b
                    break
            
            if target:
                self.bots.remove(target)
                current_tokens = list(config_mgr.config.bot_tokens)
                if target.token in current_tokens:
                    current_tokens.remove(target.token)
                    config_mgr.update(bot_tokens=current_tokens)
                logger.info(f"Bot {target.name} removed from cluster.")
                return True
            return False

    async def get_healthy_bot(self) -> Optional[ManagedBot]:
        if not self.bots:
            self.reload_from_config()
        if not self.bots:
            return None

        async with self._lock:
            total_bots = len(self.bots)
            for _ in range(total_bots):
                candidate = self.bots[self.current_idx % total_bots]
                self.current_idx = (self.current_idx + 1) % total_bots
                
                if candidate.is_healthy:
                    return candidate
                
                if await candidate.verify():
                    return candidate
        
        # Fallback: try first bot
        if self.bots and await self.bots[0].verify():
            return self.bots[0]
            
        return None

    async def upload_raw_chunk(
        self,
        chat_id: str,
        chunk_bytes: bytes,
        filename: str,
        bot_idx: Optional[int] = None
    ) -> Any:
        import io
        if bot_idx is not None and self.bots:
            bot_instance = self.bots[bot_idx % len(self.bots)]
            if not bot_instance.is_healthy:
                bot_instance = await self.get_healthy_bot()
        else:
            bot_instance = await self.get_healthy_bot()

        if not bot_instance:
            raise Exception("No healthy Telegram bots available in cluster.")

        doc_io = io.BytesIO(chunk_bytes)
        doc_io.name = filename
        try:
            msg = await bot_instance.bot.send_document(
                chat_id=chat_id,
                document=doc_io,
                caption=f"ð§© {filename}",
                filename=filename,
                read_timeout=300.0,
                write_timeout=300.0,
                connect_timeout=30.0
            )
            bot_instance.total_uploads += 1
            bot_instance.is_healthy = True
            bot_instance.last_error = None
            return msg, bot_instance.name
        except Exception as e:
            bot_instance.last_error = str(e)
            logger.error(f"Chunk upload failed via bot {bot_instance.name}: {e}")
            raise e

    async def upload_document(
        self,
        chat_id: str,
        file_obj,
        filename: str,
        is_video: bool = False,
        is_audio: bool = False
    ) -> Any:
        bot_instance = await self.get_healthy_bot()
        if not bot_instance:
            raise Exception("No healthy Telegram bots available in cluster. Check Bot Tokens in Settings.")

        logger.info(f"Uploading {filename} using bot @{bot_instance.username or bot_instance.name}")
        try:
            if is_video:
                msg = await bot_instance.bot.send_video(
                    chat_id=chat_id,
                    video=file_obj,
                    caption=f"ð {filename}",
                    supports_streaming=True,
                    read_timeout=600.0,
                    write_timeout=600.0,
                    connect_timeout=60.0
                )
            elif is_audio:
                msg = await bot_instance.bot.send_audio(
                    chat_id=chat_id,
                    audio=file_obj,
                    caption=f"ðµ {filename}",
                    filename=filename,
                    read_timeout=600.0,
                    write_timeout=600.0,
                    connect_timeout=60.0
                )
            else:
                msg = await bot_instance.bot.send_document(
                    chat_id=chat_id,
                    document=file_obj,
                    caption=f"ð {filename}",
                    filename=filename,
                    read_timeout=600.0,
                    write_timeout=600.0,
                    connect_timeout=60.0
                )
            bot_instance.total_uploads += 1
            bot_instance.is_healthy = True
            bot_instance.last_error = None
            return msg, bot_instance.name
        except Exception as e:
            bot_instance.last_error = str(e)
            logger.error(f"Upload failed via bot {bot_instance.name}: {e}")
            raise e

    async def get_file_download_url(self, file_id: str) -> str:
        bot_instance = await self.get_healthy_bot()
        if not bot_instance:
            raise Exception("No healthy Telegram bots available.")
        
        try:
            tg_file = await bot_instance.bot.get_file(
                file_id,
                read_timeout=600.0,
                write_timeout=600.0,
                connect_timeout=60.0
            )
            return tg_file.file_path
        except Exception as e:
            bot_instance.last_error = str(e)
            logger.error(f"Failed to get file download URL for {file_id}: {e}")
            raise e

    async def delete_message(self, chat_id: str, message_id: int):
        bot_instance = await self.get_healthy_bot()
        if not bot_instance:
            return
        try:
            await bot_instance.bot.delete_message(chat_id=chat_id, message_id=message_id)
        except Exception as e:
            logger.warning(f"Could not delete message {message_id} from Telegram: {e}")

    async def verify_channel_access(self, chat_id: str) -> Dict[str, Any]:
        if not self.bots:
            return {"valid": False, "error": "No bots configured"}
        
        bot_instance = await self.get_healthy_bot()
        if not bot_instance:
            return {"valid": False, "error": "No verified bots available"}

        try:
            chat = await bot_instance.bot.get_chat(chat_id=chat_id)
            return {
                "valid": True,
                "title": chat.title or "Private Storage Channel",
                "type": chat.type,
                "id": chat.id
            }
        except Exception as e:
            return {"valid": False, "error": str(e)}

def extract_video_thumbnail(file_path: str) -> Optional[bytes]:
    """Extracts a real video frame from the video using OpenCV."""
    try:
        import cv2
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            return None
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        if fps <= 0:
            fps = 25.0
            
        target_frame = int(fps * 1.5)
        if total_frames > 0 and target_frame >= total_frames:
            target_frame = max(0, total_frames // 2)
            
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ret, frame = cap.read()
        if not ret or frame is None:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
            
        cap.release()
        if ret and frame is not None:
            h, w = frame.shape[:2]
            target_w = 480
            target_h = int(h * (target_w / w))
            resized = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_AREA)
            _, buf = cv2.imencode('.jpg', resized, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            return buf.tobytes()
    except Exception as e:
        logger.warning(f"Video thumbnail extraction error: {e}")
    return None

def generate_video_poster(filename: str = "") -> bytes:
    import io
    from PIL import Image, ImageDraw
    
    # Generate 16:9 minimalist clean dark gradient poster (480x270)
    width, height = 480, 270
    image = Image.new("RGB", (width, height), color=(15, 23, 42))
    draw = ImageDraw.Draw(image)
    
    # Subtle modern dark aesthetic gradient
    for y in range(height):
        ratio = y / height
        r = int(12 + ratio * 15)
        g = int(16 + ratio * 20)
        b = int(28 + ratio * 35)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
        
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=85)
    return output.getvalue()

cluster = BotCluster()

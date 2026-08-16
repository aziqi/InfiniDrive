# InfiniDrive Async SQLite Database  stores file metadata, folders, and folder locks
import aiosqlite
import logging
import hashlib
from typing import List, Optional, Dict, Any
try:
    from config import DATABASE_FILE
except ImportError:
    from .config import DATABASE_FILE

logger = logging.getLogger("tgdrive.database")

async def init_db():
    DATABASE_FILE.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("PRAGMA journal_mode = WAL;")
        await db.execute("PRAGMA synchronous = NORMAL;")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS files (
                file_id TEXT PRIMARY KEY,
                message_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expiration_date TEXT,
                share_token TEXT UNIQUE,
                password TEXT,
                view_count INTEGER DEFAULT 0,
                bot_uploader TEXT,
                upload_source TEXT DEFAULT 'bot',
                folder TEXT DEFAULT '/',
                is_chunked BOOLEAN DEFAULT 0,
                total_chunks INTEGER DEFAULT 1,
                has_thumbnail BOOLEAN DEFAULT 0,
                thumbnail_blob BLOB
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS file_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                message_id INTEGER NOT NULL,
                tg_file_id TEXT NOT NULL,
                chunk_size INTEGER NOT NULL,
                bot_uploader TEXT,
                upload_source TEXT DEFAULT 'bot',
                completed BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(file_id) REFERENCES files(file_id) ON DELETE CASCADE,
                UNIQUE(file_id, chunk_index)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parent TEXT DEFAULT '/',
                full_path TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS folder_locks (
                folder_path TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Dynamic column migrations for existing databases (MUST RUN BEFORE INDEX CREATION)
        columns_to_add = [
            ("is_chunked", "BOOLEAN DEFAULT 0"),
            ("total_chunks", "INTEGER DEFAULT 1"),
            ("has_thumbnail", "BOOLEAN DEFAULT 0"),
            ("thumbnail_blob", "BLOB"),
            ("upload_source", "TEXT DEFAULT 'bot'")
        ]
        for col_name, col_type in columns_to_add:
            try:
                await db.execute(f"ALTER TABLE files ADD COLUMN {col_name} {col_type};")
            except Exception:
                pass  # column already exists

        # Migrate file_chunks table
        chunk_columns = [
            ("upload_source", "TEXT DEFAULT 'bot'"),
            ("completed", "BOOLEAN DEFAULT 1")
        ]
        for col_name, col_type in chunk_columns:
            try:
                await db.execute(f"ALTER TABLE file_chunks ADD COLUMN {col_name} {col_type};")
            except Exception:
                pass

        # Migrate folders table
        folder_columns = [
            ("name", "TEXT DEFAULT 'Root'"),
            ("parent", "TEXT DEFAULT '/'"),
            ("full_path", "TEXT DEFAULT '/'")
        ]
        for col_name, col_type in folder_columns:
            try:
                await db.execute(f"ALTER TABLE folders ADD COLUMN {col_name} {col_type};")
            except Exception:
                pass

        # Create Indexes safely
        index_queries = [
            "CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder);",
            "CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);",
            "CREATE INDEX IF NOT EXISTS idx_files_name ON files(file_name);",
            "CREATE INDEX IF NOT EXISTS idx_files_source ON files(upload_source);",
            "CREATE INDEX IF NOT EXISTS idx_chunks_lookup ON file_chunks(file_id, chunk_index);"
        ]
        for idx_sql in index_queries:
            try:
                await db.execute(idx_sql)
            except Exception as e:
                logger.warning(f"Index creation notice: {e}")

        await db.commit()
    logger.info("Database initialized successfully with WAL mode, chunking, and dual-engine support.")

async def add_file(
    file_id: str,
    message_id: int,
    file_name: str,
    file_size: int,
    mime_type: str,
    expiration_date: Optional[str] = None,
    share_token: Optional[str] = None,
    password: Optional[str] = None,
    bot_uploader: Optional[str] = None,
    upload_source: str = "bot",
    folder: str = "/",
    is_chunked: bool = False,
    total_chunks: int = 1,
    has_thumbnail: bool = False,
    thumbnail_blob: Optional[bytes] = None
):
    clean_folder = folder if folder.startswith("/") else f"/{folder}"
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("""
            INSERT OR REPLACE INTO files 
            (file_id, message_id, file_name, file_size, mime_type, expiration_date, share_token, password, bot_uploader, upload_source, folder, is_chunked, total_chunks, has_thumbnail, thumbnail_blob)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_id, message_id, file_name, file_size, mime_type,
            expiration_date, share_token, password, bot_uploader,
            upload_source, clean_folder, 1 if is_chunked else 0, total_chunks,
            1 if has_thumbnail else 0, thumbnail_blob
        ))
        await db.commit()

async def add_file_chunk(
    file_id: str,
    chunk_index: int,
    message_id: int,
    tg_file_id: str,
    chunk_size: int,
    bot_uploader: Optional[str] = None,
    upload_source: str = "bot",
    completed: bool = True
):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("""
            INSERT OR REPLACE INTO file_chunks
            (file_id, chunk_index, message_id, tg_file_id, chunk_size, bot_uploader, upload_source, completed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (file_id, chunk_index, message_id, tg_file_id, chunk_size, bot_uploader, upload_source, 1 if completed else 0))
        await db.commit()

async def get_file_chunks(file_id: str) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM file_chunks WHERE file_id = ? ORDER BY chunk_index ASC", (file_id,)) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

async def get_incomplete_chunks(file_id: str) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM file_chunks WHERE file_id = ? AND completed = 0 ORDER BY chunk_index ASC", (file_id,)) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

async def get_file_thumbnail(file_id: str) -> Optional[bytes]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        async with db.execute("SELECT thumbnail_blob FROM files WHERE file_id = ?", (file_id,)) as cursor:
            row = await cursor.fetchone()
            if row and row[0]:
                return bytes(row[0])
            return None

async def get_file_by_id(file_id: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM files WHERE file_id = ?", (file_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                d = dict(row)
                d.pop("thumbnail_blob", None)
                return d
            return None

async def get_file_by_share_token(token: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM files WHERE share_token = ?", (token,)) as cursor:
            row = await cursor.fetchone()
            if row:
                d = dict(row)
                d.pop("thumbnail_blob", None)
                return d
            return None

async def list_files(
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    folder: Optional[str] = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM files WHERE 1=1"
        params: List[Any] = []

        if search:
            query += " AND file_name LIKE ?"
            params.append(f"%{search}%")
        
        if folder and folder != "all":
            clean_folder = folder if folder.startswith("/") else f"/{folder}"
            query += " AND folder = ?"
            params.append(clean_folder)

        if category and category != "all":
            cat = category.lower()
            if cat == "image":
                query += " AND (mime_type LIKE 'image/%' OR file_name LIKE '%.png' OR file_name LIKE '%.jpg' OR file_name LIKE '%.jpeg' OR file_name LIKE '%.webp' OR file_name LIKE '%.gif' OR file_name LIKE '%.svg')"
            elif cat == "video":
                query += " AND (mime_type LIKE 'video/%' OR file_name LIKE '%.mp4' OR file_name LIKE '%.mkv' OR file_name LIKE '%.webm' OR file_name LIKE '%.avi' OR file_name LIKE '%.mov')"
            elif cat == "audio":
                query += " AND (mime_type LIKE 'audio/%' OR file_name LIKE '%.mp3' OR file_name LIKE '%.wav' OR file_name LIKE '%.ogg' OR file_name LIKE '%.flac' OR file_name LIKE '%.m4a')"
            elif cat == "document":
                query += " AND (mime_type LIKE '%pdf%' OR mime_type LIKE '%word%' OR mime_type LIKE '%excel%' OR mime_type LIKE 'text/%' OR file_name LIKE '%.pdf' OR file_name LIKE '%.docx' OR file_name LIKE '%.xlsx' OR file_name LIKE '%.pptx' OR file_name LIKE '%.txt' OR file_name LIKE '%.md' OR file_name LIKE '%.json' OR file_name LIKE '%.csv')"
            elif cat == "archive":
                query += " AND (mime_type LIKE '%zip%' OR mime_type LIKE '%tar%' OR mime_type LIKE '%rar%' OR file_name LIKE '%.zip' OR file_name LIKE '%.rar' OR file_name LIKE '%.7z' OR file_name LIKE '%.tar' OR file_name LIKE '%.gz')"

        # Sorting logic
        direction = "ASC" if sort_order.lower() == "asc" else "DESC"
        if sort_by == "name":
            query += f" ORDER BY file_name COLLATE NOCASE {direction}"
        elif sort_by == "size":
            query += f" ORDER BY file_size {direction}"
        elif sort_by == "views":
            query += f" ORDER BY view_count {direction}"
        else:
            query += f" ORDER BY uploaded_at {direction}"

        query += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            clean_rows = []
            for row in rows:
                d = dict(row)
                d.pop("thumbnail_blob", None)
                clean_rows.append(d)
            return clean_rows

async def delete_file_db(file_id: str) -> bool:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        cursor = await db.execute("DELETE FROM files WHERE file_id = ?", (file_id,))
        await db.commit()
        return cursor.rowcount > 0

async def bulk_delete_files_db(file_ids: List[str]) -> int:
    if not file_ids:
        return 0
    placeholders = ",".join(["?"] * len(file_ids))
    async with aiosqlite.connect(DATABASE_FILE) as db:
        cursor = await db.execute(f"DELETE FROM files WHERE file_id IN ({placeholders})", file_ids)
        await db.commit()
        return cursor.rowcount

async def move_files_db(file_ids: List[str], target_folder: str) -> int:
    if not file_ids:
        return 0
    clean_folder = target_folder if target_folder.startswith("/") else f"/{target_folder}"
    placeholders = ",".join(["?"] * len(file_ids))
    params = [clean_folder] + file_ids
    async with aiosqlite.connect(DATABASE_FILE) as db:
        cursor = await db.execute(f"UPDATE files SET folder = ? WHERE file_id IN ({placeholders})", params)
        await db.commit()
        return cursor.rowcount

async def rename_file_db(file_id: str, new_name: str) -> bool:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        cursor = await db.execute("UPDATE files SET file_name = ? WHERE file_id = ?", (new_name, file_id))
        await db.commit()
        return cursor.rowcount > 0

async def increment_view_count(file_id: str):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("UPDATE files SET view_count = view_count + 1 WHERE file_id = ?", (file_id,))
        await db.commit()

async def list_folders() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        distinct_folders = set()
        try:
            async with db.execute("SELECT DISTINCT folder FROM files WHERE folder IS NOT NULL AND folder != ''") as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    if row["folder"]:
                        distinct_folders.add(row["folder"])
        except Exception as e:
            logger.warning(f"Failed to read folders from files: {e}")
        
        try:
            async with db.execute("SELECT full_path FROM folders WHERE full_path IS NOT NULL") as cursor:
                frows = await cursor.fetchall()
                for r in frows:
                    if r["full_path"]:
                        distinct_folders.add(r["full_path"])
        except Exception:
            pass
        
        distinct_folders.add("/")
        sorted_folders = sorted(list(distinct_folders))
        return [{"path": f, "name": f.split("/")[-1] if f != "/" else "Root"} for f in sorted_folders]

async def create_folder_db(folder_path: str) -> bool:
    clean_path = folder_path.strip()
    if not clean_path.startswith("/"):
        clean_path = f"/{clean_path}"
    while "//" in clean_path:
        clean_path = clean_path.replace("//", "/")
    if clean_path.endswith("/") and len(clean_path) > 1:
        clean_path = clean_path[:-1]

    parts = [p for p in clean_path.split("/") if p]
    name = parts[-1] if parts else "Root"
    parent = "/" + "/".join(parts[:-1]) if len(parts) > 1 else "/"
    
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("""
            INSERT OR REPLACE INTO folders (name, parent, full_path)
            VALUES (?, ?, ?)
        """, (name, parent, clean_path))
        await db.commit()
        return True

async def delete_folder_db(folder_path: str) -> bool:
    clean_path = folder_path.strip()
    if not clean_path.startswith("/"):
        clean_path = f"/{clean_path}"
    while "//" in clean_path:
        clean_path = clean_path.replace("//", "/")
    if clean_path.endswith("/") and len(clean_path) > 1:
        clean_path = clean_path[:-1]

    if clean_path == "/":
        return False

    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("DELETE FROM folders WHERE full_path = ? OR full_path LIKE ?", (clean_path, f"{clean_path}/%"))
        await db.execute("DELETE FROM folder_locks WHERE folder_path = ? OR folder_path LIKE ?", (clean_path, f"{clean_path}/%"))
        await db.execute("UPDATE files SET folder = '/' WHERE folder = ? OR folder LIKE ?", (clean_path, f"{clean_path}/%"))
        await db.commit()
        return True

async def rename_folder_db(old_path: str, new_name: str) -> str:
    clean_old = old_path.strip().rstrip("/")
    clean_name = new_name.strip().strip("/")
    if not clean_name:
        return old_path

    parts = [p for p in clean_old.split("/") if p]
    if not parts:
        return "/"

    parent = "/" + "/".join(parts[:-1]) if len(parts) > 1 else "/"
    new_path = f"{parent}/{clean_name}" if parent != "/" else f"/{clean_name}"

    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("UPDATE folders SET name = ?, full_path = ? WHERE full_path = ?", (clean_name, new_path, clean_old))
        async with db.execute("SELECT id, full_path FROM folders WHERE full_path LIKE ?", (f"{clean_old}/%",)) as cursor:
            rows = await cursor.fetchall()
            for row in rows:
                f_id, f_path = row[0], row[1]
                updated_sub = new_path + f_path[len(clean_old):]
                await db.execute("UPDATE folders SET full_path = ? WHERE id = ?", (updated_sub, f_id))

        await db.execute("UPDATE files SET folder = ? WHERE folder = ?", (new_path, clean_old))
        async with db.execute("SELECT file_id, folder FROM files WHERE folder LIKE ?", (f"{clean_old}/%",)) as cursor:
            frows = await cursor.fetchall()
            for frow in frows:
                fid, fld = frow[0], frow[1]
                updated_fld = new_path + fld[len(clean_old):]
                await db.execute("UPDATE files SET folder = ? WHERE file_id = ?", (updated_fld, fid))

        await db.execute("UPDATE folder_locks SET folder_path = ? WHERE folder_path = ?", (new_path, clean_old))
        await db.commit()
        return new_path

async def get_stats() -> Dict[str, Any]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size, COALESCE(SUM(view_count), 0) as total_views FROM files") as cursor:
            row = await cursor.fetchone()
            stats = dict(row) if row else {"count": 0, "total_size": 0, "total_views": 0}
            return stats

async def get_file_thumbnail(file_id: str) -> Optional[bytes]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        async with db.execute("SELECT thumbnail_blob FROM files WHERE file_id = ?", (file_id,)) as cursor:
            row = await cursor.fetchone()
            if row and row[0]:
                return row[0]
            return None

async def update_file_thumbnail(file_id: str, thumbnail_blob: bytes) -> bool:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("""
            UPDATE files 
            SET thumbnail_blob = ?, has_thumbnail = 1 
            WHERE file_id = ?
        """, (thumbnail_blob, file_id))
        await db.commit()
        return True

def hash_password(password: str) -> str:
    return hashlib.sha256(password.strip().encode('utf-8')).hexdigest()

async def lock_folder_db(folder_path: str, password: str) -> bool:
    clean_path = folder_path.strip()
    if not clean_path.startswith("/"):
        clean_path = f"/{clean_path}"
    pw_hash = hash_password(password)
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("""
            INSERT OR REPLACE INTO folder_locks (folder_path, password_hash)
            VALUES (?, ?)
        """, (clean_path, pw_hash))
        await db.commit()
        return True

async def unlock_folder_db(folder_path: str) -> bool:
    clean_path = folder_path.strip()
    if not clean_path.startswith("/"):
        clean_path = f"/{clean_path}"
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("DELETE FROM folder_locks WHERE folder_path = ?", (clean_path,))
        await db.commit()
        return True

async def verify_folder_password_db(folder_path: str, password: str) -> bool:
    clean_path = folder_path.strip()
    if not clean_path.startswith("/"):
        clean_path = f"/{clean_path}"
    pw_hash = hash_password(password)
    async with aiosqlite.connect(DATABASE_FILE) as db:
        async with db.execute("SELECT password_hash FROM folder_locks WHERE folder_path = ?", (clean_path,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                return True
            return row[0] == pw_hash

async def list_locked_folders_db() -> List[str]:
    async with aiosqlite.connect(DATABASE_FILE) as db:
        async with db.execute("SELECT folder_path FROM folder_locks") as cursor:
            rows = await cursor.fetchall()
            return [r[0] for r in rows]



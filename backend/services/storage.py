import os
import uuid
import logging
from supabase import create_client, Client

logger = logging.getLogger(__name__)

_MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/gif":  "gif",
}


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("Supabase credentials not found in environment.")
    return create_client(url, key)


def _ext_from_filename(filename: str) -> str:
    return filename.split(".")[-1].lower() if "." in filename else "bin"


def _mime_from_filename(filename: str) -> str:
    ext = _ext_from_filename(filename)
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
    }.get(ext, "application/octet-stream")


async def upload_image_to_storage(image_bytes: bytes, filename: str) -> str:
    """
    Upload an image to Supabase 'images' bucket using an original filename.
    MIME type is inferred from the file extension.

    Returns the public URL.
    """
    mime_type = _mime_from_filename(filename)
    ext       = _ext_from_filename(filename)
    return await _upload(image_bytes, mime_type, ext)


async def upload_image_bytes_to_storage(image_bytes: bytes, mime_type: str) -> str:
    """
    Upload image bytes directly to Supabase 'images' bucket using explicit MIME type.
    Used when we have downloaded image bytes from a URL (post_extractor path).

    Returns the public URL.
    """
    ext = _MIME_TO_EXT.get(mime_type, "jpg")
    return await _upload(image_bytes, mime_type, ext)


async def _upload(image_bytes: bytes, mime_type: str, ext: str) -> str:
    """Shared upload implementation."""
    try:
        supabase = get_supabase_client()
        unique_filename = f"{uuid.uuid4()}.{ext}"

        supabase.storage.from_("images").upload(
            path=unique_filename,
            file=image_bytes,
            file_options={"content-type": mime_type},
        )

        public_url = supabase.storage.from_("images").get_public_url(unique_filename)
        logger.info(f"[STORAGE] Uploaded as {unique_filename} ({mime_type})")
        return public_url

    except Exception as e:
        logger.error(f"[STORAGE] Upload failed: {e}")
        raise ValueError(f"Image upload failed: {str(e)}")

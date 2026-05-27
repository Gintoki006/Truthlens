import os
import uuid
import logging
from supabase import create_client, Client

logger = logging.getLogger(__name__)

def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("Supabase credentials not found in environment.")
    return create_client(url, key)

def get_mime_type(filename: str) -> str:
    ext = filename.split('.')[-1].lower()
    if ext in ['jpg', 'jpeg']:
        return "image/jpeg"
    elif ext == 'png':
        return "image/png"
    elif ext == 'webp':
        return "image/webp"
    elif ext == 'gif':
        return "image/gif"
    return "application/octet-stream"

async def upload_image_to_storage(image_bytes: bytes, filename: str) -> str:
    """
    Uploads an image to the Supabase 'images' bucket.
    Returns the public URL of the uploaded image.
    """
    try:
        supabase = get_supabase_client()
        
        # Generate unique filename
        ext = filename.split('.')[-1] if '.' in filename else 'bin'
        unique_filename = f"{uuid.uuid4()}.{ext}"
        
        mime_type = get_mime_type(filename)
        
        # Upload to Supabase storage
        supabase.storage.from_("images").upload(
            path=unique_filename,
            file=image_bytes,
            file_options={"content-type": mime_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_("images").get_public_url(unique_filename)
        
        logger.info(f"[STORAGE] Successfully uploaded {filename} as {unique_filename}")
        return public_url
        
    except Exception as e:
        logger.error(f"[STORAGE] Failed to upload image to Supabase: {e}")
        raise ValueError(f"Image upload failed: {str(e)}")

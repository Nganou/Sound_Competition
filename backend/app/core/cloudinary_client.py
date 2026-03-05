import cloudinary
import cloudinary.uploader
import cloudinary.api

from app.config import settings

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


def get_signed_upload_params(folder: str = "tracks") -> dict:
    """
    Returns signed upload parameters for direct browser-to-Cloudinary upload.
    The frontend uses these to upload without exposing the API secret.
    """
    import time
    import hashlib

    timestamp = int(time.time())
    params_to_sign = f"folder={folder}&timestamp={timestamp}"
    signature = hashlib.sha1(
        f"{params_to_sign}{settings.cloudinary_api_secret}".encode()
    ).hexdigest()

    return {
        "signature": signature,
        "timestamp": timestamp,
        "api_key": settings.cloudinary_api_key,
        "cloud_name": settings.cloudinary_cloud_name,
        "folder": folder,
    }


def get_waveform_url(public_id: str) -> str:
    """
    Returns a Cloudinary URL that renders an audio waveform image.
    Uses fl_waveform transformation.
    """
    return cloudinary.CloudinaryImage(public_id).build_url(
        resource_type="video",
        raw_transformation="fl_waveform,co_white,b_black,h_200,w_800",
        format="png",
    )


def delete_asset(public_id: str, resource_type: str = "video") -> None:
    cloudinary.uploader.destroy(public_id, resource_type=resource_type)

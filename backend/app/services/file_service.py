from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_EXTENSIONS: dict[str, set[str]] = {
    "ppt": {".ppt", ".pptx"},
    "pdf": {".pdf"},
    "video": {".mp4", ".mov", ".webm", ".avi", ".mkv"},
}

CHUNK_SIZE = 1024 * 1024


def _upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_submission_file(submission_id: int, kind: str, upload: UploadFile) -> str:
    """Streams an uploaded file to disk under uploads/submissions/{id}/{kind}{ext} and
    returns the path relative to the upload root (stored on the Submission row)."""
    suffix = Path(upload.filename or "").suffix.lower()
    allowed = ALLOWED_EXTENSIONS.get(kind)
    if allowed is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Unknown upload kind '{kind}'")
    if suffix not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{suffix}' for {kind}. Allowed: {', '.join(sorted(allowed))}",
        )

    submission_dir = _upload_root() / "submissions" / str(submission_id)
    submission_dir.mkdir(parents=True, exist_ok=True)
    destination = submission_dir / f"{kind}{suffix}"

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    written = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := upload.file.read(CHUNK_SIZE):
                written += len(chunk)
                if written > max_bytes:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit",
                    )
                buffer.write(chunk)
    finally:
        upload.file.close()

    return str(destination.relative_to(_upload_root())).replace("\\", "/")


def resolve_path(relative_path: str) -> Path:
    return _upload_root() / relative_path


def delete_file(relative_path: str | None) -> None:
    if not relative_path:
        return
    path = resolve_path(relative_path)
    if path.exists():
        path.unlink()

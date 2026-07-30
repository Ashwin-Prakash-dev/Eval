from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.services import export_service

router = APIRouter(prefix="/export", tags=["export"])

_CONTENT_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}
_BUILDERS = {"csv": export_service.build_csv, "xlsx": export_service.build_xlsx, "pdf": export_service.build_pdf}


@router.get("/{export_format}")
def export_report(export_format: str, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> Response:
    if export_format not in _BUILDERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="format must be one of: csv, xlsx, pdf")
    content = _BUILDERS[export_format](db)
    filename = f"hackathon-report.{export_format}"
    return Response(
        content=content,
        media_type=_CONTENT_TYPES[export_format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

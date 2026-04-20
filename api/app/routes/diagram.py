import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os
import boto3
from botocore.exceptions import ClientError

router = APIRouter(tags=["diagram"])
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"
BUCKET = os.getenv("S3_BUCKET", "papaya-documents-095523580645")
LAYOUT_KEY = "trips/config/diagram_layout.json"

logger = logging.getLogger(__name__)


def _s3():
    return boto3.client("s3", region_name="us-east-1")


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/api/diagram-layout")
def get_layout():
    try:
        resp = _s3().get_object(Bucket=BUCKET, Key=LAYOUT_KEY)
        return json.loads(resp["Body"].read())
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return {}
        logger.warning("S3 get diagram-layout error: %s", e)
        return {}


@router.post("/api/diagram-layout")
def save_layout(body: dict, _admin=Depends(require_admin)):
    try:
        _s3().put_object(
            Bucket=BUCKET,
            Key=LAYOUT_KEY,
            Body=json.dumps(body).encode(),
            ContentType="application/json",
        )
        return {"ok": True}
    except ClientError as e:
        logger.error("S3 save diagram-layout error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save layout")

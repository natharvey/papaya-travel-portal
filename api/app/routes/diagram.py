import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
import os
import boto3
from botocore.exceptions import ClientError
from app.routes.admin import require_admin

router = APIRouter(tags=["diagram"])

BUCKET = os.getenv("S3_BUCKET", "papaya-documents-095523580645")
LAYOUT_KEY = "trips/config/diagram_layout.json"

logger = logging.getLogger(__name__)


def _s3():
    return boto3.client("s3", region_name="us-east-1")


@router.get("/api/diagram-layout")
def get_layout():
    try:
        resp = _s3().get_object(Bucket=BUCKET, Key=LAYOUT_KEY)
        return json.loads(resp["Body"].read())
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "NoSuchBucket"):
            return {}
        logger.warning("S3 get diagram-layout error: %s", e)
        return {}


@router.post("/api/diagram-layout")
async def save_layout(request: Request, _admin=Depends(require_admin)):
    try:
        body = await request.body()
        data = json.loads(body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
    try:
        _s3().put_object(
            Bucket=BUCKET,
            Key=LAYOUT_KEY,
            Body=json.dumps(data).encode(),
            ContentType="application/json",
        )
        logger.info("Diagram layout saved (%d nodes)", len(data))
        return {"ok": True}
    except ClientError as e:
        logger.error("S3 save diagram-layout error: %s", e)
        raise HTTPException(status_code=500, detail=f"S3 error: {e.response['Error']['Code']}")

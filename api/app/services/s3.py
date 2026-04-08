import os
import time
import logging
from typing import List, Dict

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

BUCKET = os.getenv("S3_BUCKET", "papaya-documents-095523580645")


def _client():
    return boto3.client("s3", region_name="us-east-1")


def upload_document(trip_id: str, filename: str, content: bytes, content_type: str, uploader: str) -> str:
    """Upload a file to S3. uploader is 'admin' or 'client'."""
    key = f"trips/{trip_id}/{uploader}/{int(time.time())}_{filename}"
    _client().put_object(Bucket=BUCKET, Key=key, Body=content, ContentType=content_type)
    return key


def list_documents(trip_id: str) -> List[Dict]:
    """List all documents for a trip, from both admin and client prefixes."""
    docs = []
    for uploader in ("admin", "client"):
        prefix = f"trips/{trip_id}/{uploader}/"
        try:
            resp = _client().list_objects_v2(Bucket=BUCKET, Prefix=prefix)
            for obj in resp.get("Contents", []):
                key = obj["Key"]
                # Strip the timestamp prefix to get original filename
                raw = key.split("/", 3)[-1]  # e.g. "1717123456_booking.pdf"
                filename = raw.split("_", 1)[-1] if "_" in raw else raw
                docs.append({
                    "key": key,
                    "filename": filename,
                    "size": obj["Size"],
                    "uploaded_at": obj["LastModified"].isoformat(),
                    "uploaded_by": uploader,
                })
        except ClientError as e:
            logger.warning("S3 list error for %s/%s: %s", trip_id, uploader, e)
    docs.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return docs


def delete_document(key: str) -> None:
    _client().delete_object(Bucket=BUCKET, Key=key)


def get_download_url(key: str, expires: int = 3600) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires,
    )

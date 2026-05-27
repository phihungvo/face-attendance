from __future__ import annotations

from io import BytesIO
from app.core.settings import settings


class ObjectStorageClient:
    def __init__(self) -> None:
        import boto3
        from botocore.client import Config

        internal_endpoint = self._internal_endpoint_url()
        public_endpoint = self._public_endpoint_url()
        self._bucket = settings.MINIO_BUCKET_ATTENDANCE.strip() or "attendance"
        common_kwargs = dict(
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name=settings.MINIO_REGION,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        self._client = boto3.client(
            "s3",
            endpoint_url=internal_endpoint,
            **common_kwargs,
        )
        self._public_client = boto3.client(
            "s3",
            endpoint_url=public_endpoint,
            **common_kwargs,
        )

    def _normalize_endpoint(self, raw_value: str) -> str:
        raw = raw_value.strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
        scheme = "https" if settings.MINIO_SECURE else "http"
        return f"{scheme}://{raw}"

    def _internal_endpoint_url(self) -> str:
        return self._normalize_endpoint(settings.MINIO_ENDPOINT)

    def _public_endpoint_url(self) -> str:
        raw = settings.MINIO_PUBLIC_ENDPOINT.strip() or settings.MINIO_ENDPOINT
        return self._normalize_endpoint(raw)

    @property
    def bucket(self) -> str:
        return self._bucket

    def ensure_bucket(self) -> None:
        from botocore.exceptions import ClientError

        try:
            self._client.head_bucket(Bucket=self._bucket)
            return
        except ClientError as exc:
            code = int(exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 500) or 500)
            if code != 404:
                raise
        kwargs = {"Bucket": self._bucket}
        if (settings.MINIO_REGION or "us-east-1") != "us-east-1":
            kwargs["CreateBucketConfiguration"] = {"LocationConstraint": settings.MINIO_REGION}
        self._client.create_bucket(**kwargs)

    def upload_bytes(self, *, object_key: str, data: bytes, content_type: str) -> None:
        self._client.upload_fileobj(
            BytesIO(data),
            self._bucket,
            object_key,
            ExtraArgs={"ContentType": content_type},
        )

    def generate_presigned_get_url(self, *, object_key: str, expires_in: int) -> str:
        return str(
            self._public_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": object_key},
                ExpiresIn=expires_in,
            )
        )

    def delete_object(self, *, object_key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=object_key)

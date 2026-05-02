FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# InsightFace/onnxruntime dependencies (opencv already headless but needs some libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# API image should stay light; ML runs in a separate container.
COPY requirements.api.txt /app/requirements.api.txt
RUN pip install -r /app/requirements.api.txt

COPY app /app/app

EXPOSE 8000

# Note: model weights may download on first run into /root/.insightface (volume in compose).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

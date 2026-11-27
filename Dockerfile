# The FairDrive API, for Railway (or any host that runs a container and sets $PORT).
# Data (accounts, sign-ins, trips) lives in /data: mount a volume there or it is lost on every deploy.
FROM python:3.13-slim

# LightGBM needs the OpenMP runtime, which slim images leave out.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv==0.11.32

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
# Dependencies first, so code changes don't reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH" FAIRDRIVE_DATA=/data
# The host reports all its processors (48 on Railway) while the app gets a small share of one. LightGBM
# and Arrow start a worker per processor they see, and 48 workers fighting over that share made scoring
# never finish. One worker each: scoring 300 trips' models takes under a second.
ENV OMP_NUM_THREADS=1
# One process only: accounts and sign-ins are files guarded by in-process locks.
CMD ["sh", "-c", "exec uvicorn fairdrive.api:app --host 0.0.0.0 --port $PORT"]

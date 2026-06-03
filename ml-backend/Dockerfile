# Hugging Face Space (Docker SDK) — OpenMMLab `label_anything` SAM backend.
#
# Hosts the *exact* interactive-segmentation backend validated locally
# (https://github.com/open-mmlab/playground/tree/main/label_anything), configured
# for MobileSAM on CPU. Per click it returns a bounding box (out_bbox, from the
# mask contour) + a brush mask (out_mask) in Label Studio result format — the box
# is what the EI Label Studio app pushes back to Edge Impulse.
#
# Build target: Hugging Face free CPU tier (2 vCPU / 16 GB RAM). No GPU, no CUDA.

FROM python:3.9-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

# System libs: libgl/libglib for OpenCV, git+wget to fetch code & weights, patchelf for the
# executable-stack fix below.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git wget libgl1 libglib2.0-0 patchelf \
    && rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch. Use 2.0.1 (OpenMMLab's own Docker base is torch 2.0.0) rather than the
# README's 1.10.1 pip pin: old torch ships libtorch_cpu.so flagged as needing an executable
# stack, which HF's hardened kernel rejects ("cannot enable executable stack").
RUN pip install --upgrade pip && \
    pip install torch==2.0.1+cpu torchvision==0.15.2+cpu \
        -f https://download.pytorch.org/whl/cpu/torch_stable.html

# Only the deps the MobileSAM path actually imports:
#   - label-studio-ml 1.0.9      the ML backend framework (matches the validated setup)
#   - rq                         label_studio_ml.api imports `rq` at load but doesn't
#                                declare it; no Redis *server* needed (predict is sync)
#   - label-studio-converter     brush.mask2rle (mask -> Label Studio RLE)
#   - opencv / numpy<2           image IO + the RLE encoder (numpy 2 breaks old stack)
#   - boto3                      imported unconditionally at the top of mmdetection.py
#   - timm 0.4.12                MobileSAM's TinyViT imports `timm.models.layers`
# (segment-anything / pycocotools / onnx / matplotlib are NOT imported on this path.)
RUN pip install \
        "label-studio-ml==1.0.9" \
        "rq==1.10.1" \
        label-studio-converter \
        "numpy<2" \
        opencv-python-headless \
        boto3 \
        "timm==0.4.12"

# Safety net for the executable-stack issue: strip the flag from any torch shared objects
# (no-op on clean builds; rescues older prebuilt .so files on HF's hardened kernel).
RUN find /usr/local/lib/python3.9/site-packages/torch -name "*.so*" \
        -exec sh -c 'patchelf --clear-execstack "$1" 2>/dev/null || true' _ {} \; || true

# HF Spaces run as UID 1000; create that user so HOME (download cache) is writable.
RUN useradd -m -u 1000 user
ENV HOME=/home/user
WORKDIR /home/user/app

# Vendor the OpenMMLab label_anything backend (sam/ holds mmdetection.py, _wsgi.py,
# filter_poly.py and the vendored models/mobile_sam). Override PLAYGROUND_REF with a
# commit SHA to pin for full reproducibility.
ARG PLAYGROUND_REF=main
RUN git clone --depth 1 --branch ${PLAYGROUND_REF} \
        https://github.com/open-mmlab/playground.git /tmp/playground && \
    cp -r /tmp/playground/label_anything /home/user/app/label_anything && \
    rm -rf /tmp/playground && \
    wget -q -O /home/user/app/label_anything/mobile_sam.pt \
        https://raw.githubusercontent.com/ChaoningZhang/MobileSAM/master/weights/mobile_sam.pt && \
    chown -R user:user /home/user

USER user
# _wsgi.py imports mmdetection / filter_poly / models.mobile_sam relative to sam/,
# so run from there.
WORKDIR /home/user/app/label_anything/sam

EXPOSE 7860

# Flask dev server is fine for a single-user labeling backend. Inference is synchronous,
# so no Redis is required (RQ is only used for training, which we don't do here).
CMD python _wsgi.py \
      --host 0.0.0.0 \
      --port ${PORT} \
      --with \
        model_name=mobile_sam \
        sam_config=vit_t \
        sam_checkpoint_file=/home/user/app/label_anything/mobile_sam.pt \
        out_mask=True \
        out_bbox=True \
        device=cpu

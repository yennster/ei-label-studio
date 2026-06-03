---
title: EI Label Studio SAM Backend
emoji: 🎯
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# EI Label Studio — SAM (MobileSAM) backend

A Hugging Face **Docker Space** that hosts OpenMMLab PlayGround's
[`label_anything`](https://github.com/open-mmlab/playground/tree/main/label_anything)
Segment Anything backend, configured for **MobileSAM on CPU**. It's the interactive
backend that powers Point2Label / Bbox2Label in the
[EI Label Studio](https://github.com/yennster/ei-label-studio) app: per click it returns a
**bounding box** (`out_bbox`, derived from the mask contour) plus a **brush mask**
(`out_mask`) in Label Studio result format. The app pushes the bounding box back to
Edge Impulse.

## Why a separate host?

The full PyTorch + SAM stack (multi-GB, ~4 GB RAM) can't run as a Vercel function
(500 MB cap, no containers). The HF free CPU tier (2 vCPU / **16 GB RAM**) runs it
comfortably and gives a public HTTPS URL the deployed app can call.

## Deploy

1. Create a new Space → **Docker** SDK, **blank** template, CPU basic (free).
2. Push these two files (`Dockerfile`, `README.md`) to the Space repo:
   ```bash
   git clone https://huggingface.co/spaces/<you>/<space-name>
   cd <space-name>
   cp /path/to/ei-label-studio/ml-backend/{Dockerfile,README.md} .
   git add . && git commit -m "MobileSAM backend" && git push
   ```
3. Watch the **Build logs** tab. First build takes ~10–20 min (PyTorch + clone + weights).
4. When it's running, the endpoint is `https://<you>-<space-name>.hf.space`.

### Verify it's up

```bash
curl https://<you>-<space-name>.hf.space/health
# -> {"model_dir": "...", "status": "UP", ...}
```

## Connect it to the app

Set this in the EI Label Studio Vercel project (Settings → Environment Variables):

```
SAM_BACKEND_URL = https://<you>-<space-name>.hf.space/predict
```

The app's `/api/ei/predict` route fetches the sample image from Edge Impulse, hands the
backend a temporary public URL for it (via Vercel Blob), forwards the Label Studio
prompt, and returns the predicted box + mask.

## Notes & gotchas

- **Cold starts.** A free Space **sleeps after ~48 h idle**. The first click after it
  sleeps waits for the container to wake *and* load the model (up to ~1–2 min), then it's
  fast. Staying always-warm requires paid HF hardware.
- **CPU speed.** MobileSAM on CPU is ~0.5 s/click (per the upstream benchmarks) once warm.
- **Public by default.** Anyone with the URL can call `/predict`. For a private setup, make
  the Space private and send an `Authorization: Bearer <HF_TOKEN>` header (the app supports
  an optional `SAM_BACKEND_AUTH` env var for this).
- **Pinning.** The Dockerfile clones `open-mmlab/playground@main`. For a reproducible build,
  rebuild with a pinned commit: set the `PLAYGROUND_REF` build arg to a commit SHA.
- **Pin fragility.** This reuses the upstream backend's older stack (Python 3.9, Torch
  1.10.1, `label-studio-ml==1.0.9`). If a transitive dependency fails to resolve during the
  build, pin it in the `pip install` layer of the `Dockerfile` and rebuild.

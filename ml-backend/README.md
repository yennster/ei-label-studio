# SAM 2.1 GPU Backend on Beam Cloud

This directory contains the machine learning backend that powers the Segment Anything (SAM 2.1) auto-segmentation in [EI Label Studio](https://github.com/yennster/ei-label-studio).

The backend runs Meta's state-of-the-art **SAM 2.1 (Hiera-Tiny)** on an **NVIDIA A10G GPU** via [Beam Cloud](https://platform.beam.cloud/). It uses dynamic FP16 mixed precision and PyTorch model compilation (`torch.compile`) to achieve model execution latencies **under 15ms** (sub-0.5s end-to-end clicks including network round-trip).

---

## Deployment Instructions

### Prerequisites
1. Sign up on [Beam Cloud](https://platform.beam.cloud/) and obtain your API Token.
2. The deployment requires Python 3.10+ and the Beam CLI.

### Deploy to Beam Cloud

1. Create and activate a temporary virtual environment, then install the Beam SDK:
   ```bash
   python3 -m venv .venv-beam
   source .venv-beam/bin/activate
   pip install beam-client
   ```

2. Configure your local Beam context with your API token (find it in your Beam dashboard):
   ```bash
   beam configure default --token <YOUR_BEAM_TOKEN>
   ```

3. Deploy the backend:
   ```bash
   beam deploy ml-backend/beam_app.py:run_app
   ```

4. The deployment will complete in a few seconds (using cached container layers) and return your public deployment URL:
   ```
   https://sam-backend-<id>.app.beam.cloud
   ```

---

## App Configuration

Set these environment variables in your Next.js application (e.g., in `.env.local` or on Vercel):

```env
SAM_BACKEND_URL="https://sam-backend-<id>.app.beam.cloud/predict"
SAM_BACKEND_AUTH="Bearer <YOUR_BEAM_TOKEN>"
```

The Next.js route `/api/ei/predict` will proxy requests to this endpoint, passing the necessary authentication header and maintaining persistent connections for low latency.

---

## Optimization Details

The backend implements several custom optimizations to achieve low latency:
- **Model Compilation**: Compiles the SAM 2.1 model using `torch.compile` during server startup (`@app.on_event("startup")`), completely avoiding runtime compilation delays during user clicks.
- **Mixed Precision**: Runs inference inside a `torch.amp.autocast("cuda", dtype=torch.float16)` block to utilize A10G Tensor Cores.
- **Vectorized RLE Encoding**: Runs run-length encoding directly on the single-channel binary mask and scales the lengths by 4. This avoids redundant operations on 4-channel image arrays and runs **5.7x faster** than the default Label Studio mask converter.
- **Keep-Warm Setting**: Configured with `keep_warm_seconds=1200` to prevent scale-to-zero during active labeling sessions.

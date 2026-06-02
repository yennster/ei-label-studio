# EI Label Studio

A Vercel-hosted [Label Studio](https://labelstud.io/) wrapper for
[Edge Impulse](https://edgeimpulse.com/). Connect an Edge Impulse project, pull its data
samples, relabel them in an embedded Label Studio canvas, and push every correction straight
back to Edge Impulse — all driven by shareable URLs.

🔗 **Live:** https://label.jennyspeelman.dev

## Features

- **Connect with an API key** — paste a project API key (`ei_…`) + project ID. The key is kept
  in a secure, http-only cookie and proxied server-side; it never touches the URL or local storage.
- **Image, audio & time-series** — labeling templates that map onto Edge Impulse modalities:
  image classification, bounding boxes, audio classification, and multi-axis time-series labels.
  The modality is auto-detected per sample, or you can force a template.
- **Round-trips to EI** — samples are pulled via the Studio API; the current label is shown as a
  pre-annotation; submitting relabels the sample back in Edge Impulse.
- **URL-driven** — deep-link presets (project, category, template, filters, theme, embed…) in the
  spirit of [synthetic-data-studio](https://github.com/yennster/synthetic-data-studio/blob/main/docs/url-parameters.md).
  See `/docs`.
- **Embeddable** — `?embed=1` strips the chrome for iframe use.

## How it works

```
Browser --POST /api/ei/session--> http-only cookie (apiKey + projectId)
   |
   |- GET  /api/ei/projects        -> Studio  GET /v1/api/projects
   |- GET  /api/ei/samples         -> Studio  GET /v1/api/{projectId}/raw-data
   |- GET  /api/ei/media/{p}/{s}   -> Studio  /raw-data/{s}/{image|wav}  (or synth CSV for series)
   |- POST /api/ei/relabel         -> Studio  POST /raw-data/{s}/rename
   \- POST /api/ei/upload          -> Ingestion POST /api/{category}/data
```

All Edge Impulse traffic is proxied through same-origin Next.js Route Handlers (Edge Impulse
blocks browser CORS). The Label Studio Frontend runs entirely client-side — there is **no**
Label Studio server. Its bundle is vendored under `public/vendor/label-studio`.

## Local development

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

Get a project API key from your Edge Impulse project **Dashboard -> Keys**, and the numeric
project ID from **Project info**.

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Zustand · Label Studio Frontend.
Deployed on Vercel.

## Notes & limitations

- An Edge Impulse API key is scoped to a single project, so the project picker shows just that
  project. (Account-wide listing would require JWT login.)
- For **detect** and **time-series** templates the sample-level label is updated, but region-level
  boxes/segments are not yet pushed back to Edge Impulse.
- The standalone Label Studio Frontend npm package no longer ships a built bundle, so a known-good
  build is vendored in this repo and loaded on demand.

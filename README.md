# Atmosphere Visualizer (v2)

A browser-based geometric visualizer that reacts to microphone audio input and auto-selects visual modes based on inferred room atmosphere.

## Features

- Full-screen animated canvas visualizations
- Multiple modes: `orbit`, `particles`, `lattice`, `pulse`
- Smooth mode transitions with selectable speed
- Live microphone audio analysis with energy tracking
- Basic atmosphere inference: `ambient`, `quiet`, `calm`, `bright`, `energetic`
- Auto-adaptation from inferred atmosphere to visualization mode

## Run locally

```bash
npm run dev
```

Then open `http://127.0.0.1:4173`.

## Build

```bash
npm run build
npm run build:site
```

This outputs static deploy files into `dist/`.

## Deploy (GitHub Pages)

This repository includes `.github/workflows/deploy.yml`.

1. Push your branch to GitHub.
2. In repository settings, enable **Pages** and choose **GitHub Actions** as source.
3. Push to `main` (or `work`) or manually run the workflow.
4. The site will be deployed automatically.

# PSL Analyzer

A Vite + React starter website. Face landmark detection runs in the browser with MediaPipe Tasks Vision. The selfie is not sent to an application server or stored by this app.

## Run locally

1. Install Node.js (18+ recommended).
2. Open a terminal in this folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the local URL printed by Vite.

## Deploy to Vercel

### Easiest method: GitHub

1. Create a GitHub repository and upload the contents of this folder.
2. Sign in at https://vercel.com and choose **Add New → Project**.
3. Import the GitHub repository.
4. Vercel should detect Vite automatically. Keep the defaults:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Click **Deploy**. Vercel will give you a public URL.

You can also deploy with the Vercel CLI:

```bash
npm install
npm run build
npx vercel
```

## Notes

- Camera access requires HTTPS (Vercel provides HTTPS) or localhost.
- The first analysis downloads the MediaPipe face-landmarker model and WASM runtime from public CDNs.
- The scores are experimental geometric proxies, not a validated PSL scale, medical assessment, or objective attractiveness rating.
- The app processes images locally in the browser. No backend or database is included.

# SmartResidence mobile (Expo)

React Native app for residents and security guards. Built with Expo SDK 54 and
Expo Router.

## Local development (LAN only)

Physical devices must reach your dev machine over the **local network**. We do
**not** use Expo tunnel mode or ngrok — corporate policy bans outbound
tunneling, and this repo does not ship ngrok binaries.

### Setup

1. Copy env: `cp .env.example .env`
2. Start infra and API from the repo root (`pnpm infra:up`, `pnpm db:migrate`, `pnpm api:dev` or `pnpm dev`).
3. Set `EXPO_PUBLIC_API_URL` in `.env` to your machine's LAN IP, e.g.
   `http://192.168.1.42:4000` (not `localhost` when testing on a phone).
4. Start Expo: `corepack pnpm mobile:dev` from the repo root, or `pnpm dev` from
   `apps/mobile`.
5. Connect phone and PC to the **same Wi‑Fi**. Scan the QR code shown in the
   terminal (Expo Go or a dev client).
6. Allow inbound connections on your firewall for **4000** (API) and **8081**
   (Metro bundler) if the device cannot connect.

### Optional: save a LAN QR image

When the terminal QR is hard to scan, generate a PNG from the `exp://…` URL
Expo prints (must use your LAN IP, not `localhost`):

```bash
node scripts/gen-qr.js "exp://192.168.1.42:8081"
```

Output: `dev-qr.png` (gitignored).

### Do not use

- `expo start --tunnel`
- `@expo/ngrok` or any ngrok install
- Third-party tunnel services for this project

Use an Android/iOS simulator on the same machine if LAN testing is not possible.

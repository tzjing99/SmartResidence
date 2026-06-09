const path = require('node:path');
const QRCode = require('qrcode');

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/gen-qr.js <exp://lan-url>');
  process.exit(1);
}

const out = path.resolve(__dirname, '..', 'dev-qr.png');

QRCode.toFile(
  out,
  url,
  { type: 'png', width: 512, margin: 2, errorCorrectionLevel: 'M' },
  (err) => {
    if (err) {
      console.error('QR generation failed:', err);
      process.exit(1);
    }
    console.log(`LAN dev QR written to ${out} for ${url}`);
  },
);

-- Add DuitNow QR as a first-class payment provider (Malaysia PayNet dynamic QR).
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'DUITNOW_QR';

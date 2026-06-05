import {
  formatVisitorPassShareText,
  formatVisitorPassShareTitle,
  type VisitorPassShareInput,
} from '@smartresidence/shared-types';

export type { VisitorPassShareInput };

function dataUrlToFile(dataUrl: string, filename: string): File {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

function canShareFiles(files: File[]): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

export type ShareVisitorPassOptions = VisitorPassShareInput & {
  qrPngDataUrl?: string | null;
};

export type ShareVisitorPassResult = 'shared' | 'fallback';

/** Share access code + QR via Web Share API, or signal fallback UI. */
export async function shareVisitorPass(
  options: ShareVisitorPassOptions,
): Promise<ShareVisitorPassResult> {
  const text = formatVisitorPassShareText(options);
  const title = formatVisitorPassShareTitle(options.visitorName);

  if (typeof navigator !== 'undefined' && navigator.share) {
    const shareData: ShareData = { title, text };
    if (options.qrPngDataUrl) {
      const file = dataUrlToFile(options.qrPngDataUrl, `visitor-pass-${options.accessCode}.png`);
      if (canShareFiles([file])) {
        shareData.files = [file];
      }
    }
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared';
    }
  }

  return 'fallback';
}

export async function copyVisitorAccessCode(accessCode: string): Promise<void> {
  await navigator.clipboard.writeText(accessCode);
}

export function downloadVisitorQrPng(dataUrl: string, accessCode: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = `visitor-pass-${accessCode}.png`;
  anchor.click();
}

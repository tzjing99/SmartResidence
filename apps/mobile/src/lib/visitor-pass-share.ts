import {
  formatVisitorPassShareText,
  formatVisitorPassShareTitle,
  type VisitorPassShareInput,
} from '@smartresidence/shared-types';
import * as FileSystem from 'expo-file-system';
import { Platform, Share } from 'react-native';

export type { VisitorPassShareInput };

type QrRef = { toDataURL: (callback: (data: string) => void) => void };

export async function shareVisitorPass(
  input: VisitorPassShareInput,
  qrRef?: QrRef | null,
): Promise<void> {
  const message = formatVisitorPassShareText(input);
  const title = formatVisitorPassShareTitle(input.visitorName);
  const fileUri = qrRef ? await writeQrPng(qrRef, input.accessCode) : undefined;

  await Share.share({
    title,
    message: Platform.OS === 'android' ? message : message,
    ...(Platform.OS === 'ios' && fileUri ? { url: fileUri } : {}),
  });
}

async function writeQrPng(qrRef: QrRef, accessCode: string): Promise<string> {
  const dataUrl = await qrDataUrl(qrRef);
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const fileUri = `${FileSystem.cacheDirectory}visitor-pass-${accessCode}.png`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}

function qrDataUrl(ref: QrRef): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      ref.toDataURL((data) => resolve(data));
    } catch (err) {
      reject(err);
    }
  });
}

import {
  type VisitorPassShareInput,
  formatVisitorPassShareText,
  formatVisitorPassShareTitle,
} from '@smartresidence/shared-types';
import { Platform, Share } from 'react-native';

export type { VisitorPassShareInput };

/** Share a captured pass-card PNG via the native share sheet. */
export async function shareVisitorPassImage(
  imageUri: string,
  input: VisitorPassShareInput,
): Promise<void> {
  const message = formatVisitorPassShareText(input);
  const title = formatVisitorPassShareTitle(input.visitorName);

  await Share.share(
    Platform.select({
      ios: { title, message, url: imageUri },
      default: { title, message, url: imageUri },
    }) ?? { title, message, url: imageUri },
  );
}

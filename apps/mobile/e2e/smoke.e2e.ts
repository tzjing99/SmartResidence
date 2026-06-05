import { by, device, element, expect } from 'detox';

describe('SmartResidence smoke', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows the sign-in screen on first launch', async () => {
    await expect(element(by.text(/Sign in/i))).toBeVisible();
  });
});

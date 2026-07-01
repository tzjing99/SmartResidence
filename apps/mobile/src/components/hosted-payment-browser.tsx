import { AppText, Button, palette, spacing } from '@smartresidence/ui-mobile';
import { useMemo } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { isPaymentReturnUrl } from '../lib/payment-return-url';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function buildAutoPostHtml(url: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><form id="pay" method="POST" action="${escapeHtml(url)}">${inputs}</form><p style="font-family:system-ui,sans-serif;padding:24px;color:#555;">Opening secure payment page…</p><script>document.getElementById('pay').submit();</script></body></html>`;
}

export type HostedPaymentSession = {
  title?: string;
  formPost?: { url: string; fields: Record<string, string> };
  redirectUrl?: string;
};

type HostedPaymentBrowserProps = {
  session: HostedPaymentSession | null;
  onClose: () => void;
  onComplete?: () => void;
};

export function HostedPaymentBrowser({ session, onClose, onComplete }: HostedPaymentBrowserProps) {
  const insets = useSafeAreaInsets();
  const html = useMemo(() => {
    if (!session?.formPost) return null;
    return buildAutoPostHtml(session.formPost.url, session.formPost.fields);
  }, [session?.formPost]);

  if (!session) return null;

  function handleNavigation(nav: WebViewNavigation) {
    if (isPaymentReturnUrl(nav.url)) {
      onComplete?.();
      onClose();
    }
  }

  const source = html ? { html } : session.redirectUrl ? { uri: session.redirectUrl } : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.shell, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.toolbar}>
          <AppText style={styles.title}>{session.title ?? 'Complete payment'}</AppText>
          <Button title="Close" variant="secondary" size="sm" onPress={onClose} />
        </View>
        {source ? (
          <WebView
            source={source}
            startInLoadingState
            onNavigationStateChange={handleNavigation}
            onShouldStartLoadWithRequest={(req) => {
              if (isPaymentReturnUrl(req.url)) {
                onComplete?.();
                onClose();
                return false;
              }
              return true;
            }}
            style={styles.webview}
          />
        ) : (
          <View style={styles.fallback}>
            <AppText variant="bodySm" style={{ color: palette.mutedLight, textAlign: 'center' }}>
              Could not open the payment page. Please try again or use web billing.
            </AppText>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: palette.bgLight,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderLight,
  },
  title: {
    flex: 1,
    fontWeight: '700',
    color: palette.textLight,
  },
  webview: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
});

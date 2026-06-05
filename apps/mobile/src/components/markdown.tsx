import { palette } from '@smartresidence/ui-mobile';
import MarkdownDisplay from 'react-native-markdown-display';

// Announcement bodies are authored as markdown; render them with the shared
// on-theme styles so mobile matches the web. `react-native-markdown-display`
// parses to a safe React Native element tree (no raw HTML / scripting), which
// keeps untrusted management input from injecting anything unexpected.
const markdownStyles = {
  body: { color: palette.textLight, fontSize: 13, lineHeight: 19 },
  heading1: { fontSize: 18, fontWeight: '700' as const, marginTop: 4, marginBottom: 4 },
  heading2: { fontSize: 16, fontWeight: '700' as const, marginTop: 4, marginBottom: 4 },
  heading3: { fontSize: 14, fontWeight: '700' as const, marginTop: 4, marginBottom: 2 },
  strong: { fontWeight: '700' as const },
  em: { fontStyle: 'italic' as const },
  paragraph: { marginTop: 2, marginBottom: 6 },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  link: { color: palette.coralPrimary, textDecorationLine: 'underline' as const },
  blockquote: {
    backgroundColor: palette.bgLight,
    borderLeftColor: palette.borderLight,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: palette.bgLight,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: 'monospace',
  },
};

type MarkdownProps = {
  children: string;
};

export function Markdown({ children }: MarkdownProps) {
  return <MarkdownDisplay style={markdownStyles}>{children}</MarkdownDisplay>;
}

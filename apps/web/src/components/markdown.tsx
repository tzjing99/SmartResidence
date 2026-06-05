import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

// Announcement bodies are authored by management but are still untrusted input,
// so the rendered markdown is sanitized (rehype-sanitize) to strip any raw HTML
// / scripting and only keep a safe element subset. Links are additionally
// forced to open in a new tab with `rel="noreferrer"`.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
  },
};

type MarkdownProps = {
  children: string;
  className?: string;
};

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={['sr-markdown leading-relaxed', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-semibold mt-4 first:mt-0 mb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-semibold mt-4 first:mt-0 mb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-semibold mt-3 first:mt-0 mb-1.5" {...props} />
          ),
          p: ({ node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          ul: ({ node, ...props }) => <ul className="my-2 ml-5 list-disc space-y-1" {...props} />,
          ol: ({ node, ...props }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => <li className="pl-1" {...props} />,
          a: ({ node, ...props }) => (
            <a
              className="text-coral-500 underline underline-offset-2 hover:text-coral-600"
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-2 border-l-2 border-[rgb(var(--sr-border))] pl-3 sr-muted"
              {...props}
            />
          ),
          code: ({ node, ...props }) => (
            <code
              className="rounded bg-[rgb(var(--sr-bg))] px-1.5 py-0.5 text-[0.85em] font-mono"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-4 border-[rgb(var(--sr-border))]" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

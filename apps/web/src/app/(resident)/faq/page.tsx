import { FaqClient } from './faq-client';

/** RSC shell — static header ships in the HTML; search and expand stay client-side. */
export default function FaqPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h2 className="sr-section-title">Help &amp; FAQ</h2>
        <p className="sr-muted">Answers curated by your management office.</p>
      </header>
      <FaqClient />
    </div>
  );
}

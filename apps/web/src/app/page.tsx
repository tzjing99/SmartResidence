import Link from 'next/link';
import { Button, Card } from '@smartresidence/ui-web';

const features = [
  {
    title: 'Visitor passes that work offline',
    body: 'Pre-register visitors, generate QR codes, scan at the gate. Owners always know who arrived and when.',
  },
  {
    title: 'Maintenance fees with a real receipt',
    body: 'Every line item shows the formula. No hidden charges. Pay by FPX, card, or e-wallet.',
  },
  {
    title: 'Defects that get fixed',
    body: 'Photo, location, status timeline, and a chat thread with management. No more lost emails.',
  },
  {
    title: 'Owner-first transparency',
    body: 'Activity feed of every action on your unit. See which staff opened your record. Revoke tenant access in one tap.',
  },
];

export default function HomePage() {
  return (
    <main className="container-page">
      <header className="flex items-center justify-between mb-16">
        <div className="text-2xl font-bold tracking-tight">
          Smart<span className="text-coral-500">Residence</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      <section className="text-center max-w-3xl mx-auto mb-20">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Condo management,
          <br />
          <span className="text-coral-500">finally on your side.</span>
        </h1>
        <p className="mt-6 text-lg sr-muted">
          Open-source. Self-hostable. Built for residents who own their data,
          not the other way around.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg">Try the demo condo</Button>
          </Link>
          <a
            href="https://github.com/tzjing99/SmartResidence"
            target="_blank"
            rel="noreferrer"
          >
            <Button size="lg" variant="secondary">
              View on GitHub
            </Button>
          </a>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6 mb-24">
        {features.map((f) => (
          <Card key={f.title}>
            <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
            <p className="sr-muted text-sm leading-relaxed">{f.body}</p>
          </Card>
        ))}
      </section>

      <footer className="text-center text-xs sr-muted py-10 border-t border-[rgb(var(--sr-border))]">
        SmartResidence is licensed under AGPL-3.0. {' '}
        <a className="underline" href="https://github.com/tzjing99/SmartResidence">Source</a>
      </footer>
    </main>
  );
}

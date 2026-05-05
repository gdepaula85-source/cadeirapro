// Owner-acquisition landing page. Customers arrive via /book/[slug] (the
// public booking widget), so this page targets shop owners only:
//   - "Começar" → /signup     (start a 3-step shop signup)
//   - "Sou barbeiro" → /login (existing barbers and owners sign in)
//
// Marketing content is intentionally inline. If the page grows to multiple
// screens (the mock shows a 3-dot carousel; only screen 1 is designed),
// move strings into pt-BR.ts and split into per-step components.
import { Link } from 'react-router-dom';

export function WelcomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#021b15] text-white">
      {/* Decorative background — abstract curves in the bottom corners. Pure
          presentation, no data, so it stays as static SVG. */}
      <BackgroundDecor />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        <header className="flex items-center justify-end pt-2 text-xs font-medium text-white/55">
          <span aria-hidden>9:41</span>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <BrandMark />

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-white/72">
            Cadeira Pro
          </p>

          <h1 className="mt-12 text-3xl font-semibold leading-tight tracking-tight text-white">
            Sua cadeira,
            <br />
            <span className="text-[#8de47f]">seu negócio.</span>
          </h1>

          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/72">
            O app que conecta barbearias e clientes. Mais agenda cheia, mais controle, mais
            liberdade.
          </p>
        </section>

        <footer className="mt-8 space-y-4 pb-2">
          <Link
            to="/signup"
            className="block w-full rounded-2xl bg-[#8de47f] py-4 text-center text-base font-semibold text-[#021b15] shadow-[0_18px_40px_rgb(141_228_127_/_0.28)] transition hover:bg-[#79d569] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8de47f]"
          >
            Começar
          </Link>
          <Link
            to="/login"
            className="block w-full text-center text-sm font-medium text-white/82 underline-offset-4 hover:underline"
          >
            Sou barbeiro
          </Link>
        </footer>
      </div>
    </main>
  );
}

/**
 * Stylized "C" with a small leaf accent. Drop-in placeholder for the proper
 * brand asset (the designer has the mark; this is a text-stack approximation
 * so the page renders correctly until the SVG arrives).
 */
function BrandMark() {
  return (
    <div className="relative" aria-label="Cadeira Pro" role="img">
      <svg width="148" height="148" viewBox="0 0 200 200" aria-hidden>
        {/* The C — an open ring */}
        <path
          d="M 154 64 A 64 64 0 1 0 154 136"
          fill="none"
          stroke="#8de47f"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Leaf accent off the top-right of the C */}
        <path
          d="M 138 52 Q 168 40 178 72 Q 152 70 138 52 Z"
          fill="#8de47f"
        />
      </svg>
    </div>
  );
}

/**
 * Subtle background curves in the corners. Decorative only — keeps the empty
 * dark-green canvas from feeling unfinished without competing with the brand.
 */
function BackgroundDecor() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g stroke="rgb(141 228 127 / 0.08)" strokeWidth="1.5" fill="none">
        <path d="M -20 720 Q 80 660 60 560 Q 40 460 140 420" />
        <path d="M 0 760 Q 120 700 110 600 Q 100 500 200 460" />
        <path d="M 420 80 Q 320 140 340 240 Q 360 340 260 380" />
        <path d="M 400 40 Q 280 100 290 200 Q 300 300 200 340" />
      </g>
    </svg>
  );
}

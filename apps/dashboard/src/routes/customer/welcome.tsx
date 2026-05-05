// Customer welcome screen at /[slug]/welcome — the entry point for a shop's
// white-label customer app. Mirrors the visual language of the owner welcome
// at /welcome (dark green canvas, brand mark, green CTA) but with copy aimed
// at customers and CTAs that route into the per-shop signup/login.
//
// The page resolves the slug via /v1/public/orgs/:slug to validate the shop
// exists and to surface the shop name. If the slug is unknown, the user
// sees a clean "barbershop not found" state rather than a broken page.
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';

export function CustomerWelcomePage() {
  const { slug = '' } = useParams<{ slug: string }>();

  const orgQuery = useQuery({
    queryKey: ['public', 'org', slug],
    queryFn: () => api.public.org(slug),
    enabled: slug.length > 0,
    retry: false,
  });

  const shopName = orgQuery.data?.name ?? '';
  const notFound = orgQuery.error instanceof ApiError && orgQuery.error.status === 404;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#021b15] text-white">
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

          {notFound ? (
            <NotFoundState />
          ) : (
            <>
              <h1 className="mt-12 text-3xl font-semibold leading-tight tracking-tight text-white">
                Seu estilo.
                <br />
                <span className="text-[#8de47f]">Sua cadeira.</span>
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/72">
                Encontre os melhores barbeiros, agende seu horário e cuide do seu estilo com
                praticidade.
              </p>
              {shopName ? (
                <p className="mt-3 text-xs font-medium text-white/55">na {shopName}</p>
              ) : null}
            </>
          )}

          {/* Carousel pagination dots are placeholder — only screen 1 of the
              3-screen onboarding is designed. Restore proper navigation when
              screens 2 and 3 land. */}
          <div className="mt-10 flex items-center gap-2" aria-hidden>
            <span className="h-1.5 w-6 rounded-full bg-[#8de47f]" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
          </div>
        </section>

        {!notFound ? (
          <footer className="mt-8 space-y-4 pb-2">
            <Link
              to={`/${slug}/signup`}
              className="block w-full rounded-2xl bg-[#8de47f] py-4 text-center text-base font-semibold text-[#021b15] shadow-[0_18px_40px_rgb(141_228_127_/_0.28)] transition hover:bg-[#79d569] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8de47f]"
            >
              Começar
            </Link>
            <p className="text-center text-sm text-white/82">
              Já tem uma conta?{' '}
              <Link
                to={`/${slug}/login`}
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                Entrar
              </Link>
            </p>
          </footer>
        ) : null}
      </div>
    </main>
  );
}

function NotFoundState() {
  return (
    <div className="mt-12 max-w-sm">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white">
        Barbearia não encontrada
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-white/72">
        Confira o link compartilhado pela barbearia ou volte para a página inicial.
      </p>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="relative" aria-label="Cadeira Pro" role="img">
      <svg width="148" height="148" viewBox="0 0 200 200" aria-hidden>
        <path
          d="M 154 64 A 64 64 0 1 0 154 136"
          fill="none"
          stroke="#8de47f"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path d="M 138 52 Q 168 40 178 72 Q 152 70 138 52 Z" fill="#8de47f" />
      </svg>
    </div>
  );
}

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

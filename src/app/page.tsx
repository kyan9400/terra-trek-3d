import GlobePoster from "@/components/GlobePoster";
import MobileMenu from "@/components/MobileMenu";
import MotionToggle from "@/components/MotionToggle";
import ScrollDirector from "@/components/ScrollDirector";
import StageLoader from "@/components/StageLoader";
import SiteFooter from "@/components/SiteFooter";
import { Logo, Arrow, Check, PlaneIcon } from "@/components/icons";
import { LEGS, ROUTE, TOTAL_KM, formatCoord, formatKm } from "@/lib/route";

const NAV = [
  { href: "#routes", label: "Routes" },
  { href: "#approach", label: "Approach" },
  { href: "#ways", label: "Ways to go" },
  { href: "#questions", label: "Questions" },
];

const STATS = [
  { value: "38", label: "countries routed" },
  { value: "4.6", label: "nights, average stay per stop" },
  { value: "12", label: "travellers, largest group" },
  { value: "62%", label: "legs by rail, road or sea" },
];

const STEPS = [
  { title: "Listen", body: "A 45-minute call with a route designer. We ask what you want to feel, not only where you want to go." },
  { title: "Route", body: "We sketch three possible lines across the map, each with honest trade-offs: time, cost, flights and pace." },
  { title: "Ground", body: "Every stop is run by people who live there. We pay guides above local rates and publish what they earn." },
  { title: "Return", body: "Back home, you get a printed map of the trip you actually took — detours, wrong turns and all." },
];

const PLANS = [
  {
    name: "Wayfarer",
    kind: "Self-guided",
    price: "$3,900",
    span: "per person · 14 days",
    features: ["Hand-drawn route and daily notes", "Rail and ferry legs booked for you", "24/7 local contact line"],
  },
  {
    name: "Expedition",
    kind: "Small group, max 12",
    price: "$8,400",
    span: "per person · 21 days",
    features: ["Expert leader throughout", "All stays and most meals", "Carbon removal included"],
    featured: true,
  },
  {
    name: "The Long Way Round",
    kind: "Private",
    price: "$24,800",
    span: "per person · 42 days",
    features: ["Private guides in all six cities", "Any start date, any direction", "A route designer on call"],
  },
];

const FACTS = [
  { value: "62%", label: "of our legs travel by rail, road or sea." },
  { value: "4.6", label: "nights, our average stay per stop." },
  { value: "100%", label: "of guides paid at or above living-wage benchmarks." },
  { value: "2×", label: "carbon removal for every flight we book." },
];

const FAQ = [
  {
    q: "How fit do I need to be?",
    a: "If you can walk 10 km on a mixed path, you can do every route we run. Harder options (Lares, the Routeburn) always have a gentler alternative on the same day.",
  },
  {
    q: "Can I start the route somewhere else?",
    a: "Yes. The Long Way Round is a loop on paper; privately, we can start in any of the six cities and fly it in either direction.",
  },
  {
    q: "What is included in the price?",
    a: "Stays, guides, every ground and rail leg, most meals and carbon removal. Long-haul flights are quoted separately so you can use your own miles.",
  },
  {
    q: "How do you handle flight emissions?",
    a: "We measure each flight, then buy twice that amount in verified removal — not avoidance credits — and send you the certificates.",
  },
  {
    q: "Can I travel solo?",
    a: "Many of our travellers do. Expedition groups have no single supplement on shared-room dates.",
  },
];

const MAILTO =
  "mailto:kyan775909@gmail.com?subject=" + encodeURIComponent("Terra Trek — route enquiry (concept site)");

export default function Home() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <a href="#top" className="wordmark" aria-label="Terra Trek — back to top">
            <Logo />
            <span>Terra Trek</span>
          </a>
          <nav aria-label="Primary" className="nav">
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href}>{n.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="header-actions">
            <MotionToggle />
            <a className="btn btn-ember btn-sm header-cta" href="#plan">
              Plan a route
            </a>
            <MobileMenu links={NAV} cta={{ href: "#plan", label: "Plan a route" }} />
          </div>
        </div>
      </header>

      <div className="stage-layer" aria-hidden="true">
        <GlobePoster />
        <StageLoader />
      </div>
      <ScrollDirector />

      <main id="main" tabIndex={-1}>
        <div data-stage>
          {/* ---------------------------------------------------------- hero */}
          <section className="hero" id="top" aria-labelledby="hero-title">
            <div className="shell hero-inner">
              <p className="eyebrow">Terra Trek · Slow routes since 2014 · Lisbon</p>
              <h1 id="hero-title" className="display hero-title">
                Travel the <em>long way</em> round.
              </h1>
              <p className="lede">
                We design small-group and private journeys that link a few extraordinary places with fewer flights,
                longer stays and local people who know every back road. Scroll down and fly our signature route.
              </p>
              <div className="cta-row">
                <a className="btn btn-ember" href="#routes">
                  Fly the route <Arrow />
                </a>
                <a className="btn btn-ghost" href="#plan">
                  Plan a journey
                </a>
              </div>
              <dl className="stats">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="scroll-cue" aria-hidden="true">
              Scroll to take off
            </p>
          </section>

          {/* -------------------------------------------------------- routes */}
          <section className="routes" id="routes" aria-labelledby="routes-title">
            <div className="shell routes-intro">
              <p className="eyebrow">Signature route · 2027 season</p>
              <h2 id="routes-title" className="display">
                The Long Way Round
              </h2>
              <p>
                Six cities, five flights, forty-two days. Every arc on the globe is a true great-circle path — scroll and
                the camera flies each leg with you.
              </p>
            </div>

            <div className="stops">
              <div className="rail-wrap" aria-hidden="true">
                <div className="rail">
                  <span className="rail-line">
                    <span data-rail-fill />
                  </span>
                  <ol>
                    {ROUTE.map((c) => (
                      <li key={c.id} data-rail-item>
                        {c.code}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <ol className="stops-list" aria-label="Route stops">
                {ROUTE.map((c, i) => {
                  const leg = i > 0 ? LEGS[i - 1] : null;
                  return (
                    <li className="stop" key={c.id} data-stop id={`stop-${c.id}`}>
                      <div className="shell">
                        <article className="card" data-card tabIndex={-1} aria-labelledby={`city-${c.id}`}>
                          <p className="card-meta mono">
                            <strong>
                              {String(i + 1).padStart(2, "0")} / {String(ROUTE.length).padStart(2, "0")}
                            </strong>
                            <span>{c.code}</span>
                            <span>{formatCoord(c.lat, c.lon)}</span>
                            <span>{c.days}</span>
                          </p>
                          <h3 className="card-city" id={`city-${c.id}`}>
                            {c.city}
                            <span>{c.country}</span>
                          </h3>
                          <p className="card-title">{c.title}</p>
                          <p className="card-body">{c.body}</p>
                          <ul className="card-tags" aria-label="Highlights">
                            {c.highlights.map((h) => (
                              <li key={h}>{h}</li>
                            ))}
                          </ul>
                          <p className="card-stub mono">
                            <PlaneIcon />
                            {leg ? (
                              <span>
                                Leg {i} of {LEGS.length} · <b>{leg.from.code} → {leg.to.code}</b> · {formatKm(leg.km)} ·{" "}
                                {leg.time}
                              </span>
                            ) : (
                              <span>
                                <b>Departure</b> · fly in from anywhere · we meet you at {c.code}
                              </span>
                            )}
                          </p>
                        </article>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="stop-end" data-stop-end>
              <div className="shell">
                <div className="outro-panel">
                  <p className="display">
                    42 days · {LEGS.length} flights · <em>{formatKm(TOTAL_KM)}</em>
                  </p>
                  <p>
                    Long legs, long stays. Every flight on the route is matched with twice its carbon in verified
                    removal.
                  </p>
                  <a className="text-link" href="#ways">
                    See ways to travel it <Arrow />
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------- approach */}
        <section className="paper section" id="approach" aria-labelledby="approach-title">
          <div className="shell">
            <div className="section-head">
              <p className="eyebrow">How we route</p>
              <h2 id="approach-title">
                Every journey starts with a map and a <em className="serif">long conversation.</em>
              </h2>
            </div>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="step-pin" aria-hidden="true">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------------------------------- ways */}
        <section className="paper ways section" id="ways" aria-labelledby="ways-title">
          <div className="shell">
            <div className="section-head">
              <p className="eyebrow">Ways to go</p>
              <h2 id="ways-title">Three ways to travel with us</h2>
              <p>Every option includes ground transport, carbon removal and a designer who has walked the route.</p>
            </div>
            <div className="plans">
              {PLANS.map((p) => {
                const planId = `plan-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                return (
                <article key={p.name} className={p.featured ? "plan plan-feature" : "plan"} aria-labelledby={planId}>
                  {p.featured ? <span className="plan-badge">Most booked</span> : null}
                  <p className="plan-kind">{p.kind}</p>
                  <h3 id={planId}>{p.name}</h3>
                  <p className="plan-price">
                    <strong>from {p.price}</strong>
                    {p.span}
                  </p>
                  <ul>
                    {p.features.map((f) => (
                      <li key={f}>
                        <Check />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a className={p.featured ? "btn btn-ember btn-sm" : "btn btn-outline-ink btn-sm"} href="#plan">
                    Ask about {p.name}
                  </a>
                </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- principles */}
        <section className="principles section" aria-labelledby="principles-title">
          <div className="shell">
            <div className="section-head">
              <p className="eyebrow">Field principles</p>
              <h2 id="principles-title">
                Fewer flights. Longer stays. <em className="serif">Fair pay.</em>
              </h2>
            </div>
            <dl className="facts">
              {FACTS.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* --------------------------------------------------------- questions */}
        <section className="paper section" id="questions" aria-labelledby="questions-title">
          <div className="shell">
            <div className="section-head">
              <p className="eyebrow">Questions</p>
              <h2 id="questions-title">Good questions</h2>
            </div>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- plan */}
        <section className="plan-cta section" id="plan" aria-labelledby="plan-title">
          <svg className="plan-cta-arc" viewBox="0 0 760 420" aria-hidden="true">
            <path d="M40 380 C 200 40, 560 40, 720 300" fill="none" stroke="#ff9f43" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
            <circle cx="40" cy="380" r="6" fill="#ff9f43" />
            <circle cx="720" cy="300" r="10" fill="none" stroke="#ff9f43" strokeWidth="2" />
            <circle cx="720" cy="300" r="4" fill="#ff9f43" />
          </svg>
          <div className="shell">
            <p className="eyebrow">Plan</p>
            <h2 id="plan-title" className="display">
              Where should your line <em>begin?</em>
            </h2>
            <p>
              Tell us a city you have always wanted to wake up in. A route designer replies within two working days with
              a first sketch — free and without obligation.
            </p>
            <div className="cta-row">
              <a className="btn btn-ember" href={MAILTO}>
                Start a route <Arrow />
              </a>
              <a className="btn btn-ghost" href="#routes">
                Fly the signature route again
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

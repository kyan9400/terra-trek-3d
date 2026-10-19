import { Logo } from "./icons";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-brand">
            <span className="footer-logo">
              <Logo />
            </span>
            Terra Trek
          </p>
          <p className="footer-line">Slow routes across a fast world.</p>
          <p className="footer-line">Concept project — fictional brand.</p>
        </div>
        <div>
          <p>Design &amp; development</p>
          <a href={process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? "https://alhassan-portfolio-sigma.vercel.app"}>Alhassan Alfarran</a>
          <br />
          <a href="https://github.com/kyan9400">GitHub</a>
        </div>
        <div>
          <p>© 2026 Alhassan Alfarran</p>
          <p className="footer-line">Globe, arcs and illustrations drawn in code. Typefaces under the SIL Open Font License.</p>
        </div>
      </div>
    </footer>
  );
}

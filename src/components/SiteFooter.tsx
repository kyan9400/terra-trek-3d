import { Logo } from "./icons";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-brand">
            <span style={{ color: "var(--ember)", verticalAlign: "-6px", marginRight: 8, display: "inline-block" }}>
              <Logo />
            </span>
            Terra Trek
          </p>
          <p style={{ marginTop: 8 }}>Slow routes across a fast world.</p>
          <p style={{ marginTop: 8 }}>Concept project — fictional brand.</p>
        </div>
        <div>
          <p>Design &amp; development</p>
          <a href="https://alhassan-portfolio-sigma.vercel.app">Alhassan Alfarran</a>
          <br />
          <a href="https://github.com/kyan9400">GitHub</a>
        </div>
        <div>
          <p>© 2026 Alhassan Alfarran</p>
          <p style={{ marginTop: 8 }}>Globe, arcs and illustrations drawn in code. Typefaces under the SIL Open Font License.</p>
        </div>
      </div>
    </footer>
  );
}

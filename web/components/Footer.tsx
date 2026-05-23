const GITHUB_HREF = "https://github.com/skamal0730/astrix";

export function Footer() {
  return (
    <footer className="xy-footer container-max">
      <div className="xy-footer__row">
        <a href="https://hedera.com" target="_blank" rel="noreferrer" className="xy-footer__badge">
          <span className="xy-logo-wrap xy-logo-wrap--sm">
            <img
              src="/logo-astrix.png"
              alt=""
              width={72}
              height={18}
              className="logo-astrix logo-astrix--footer opacity-90"
              decoding="async"
            />
          </span>
          <span className="font-medium">Built on Hedera</span>
        </a>

        <nav className="xy-footer__nav">
          <a href="#">Terms of Service</a>
          <a href="#">Privacy Policy</a>
          <a href={GITHUB_HREF} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="#">Twitter / X</a>
        </nav>

        <div className="xy-footer__status">
          <span className="xy-footer__ping" aria-hidden>
            <span className="xy-footer__ping-ring" />
            <span className="xy-footer__ping-dot" />
          </span>
          Network status: <span className="xy-footer__ok">Operational</span>
        </div>
      </div>
      <p className="xy-footer__tagline">
        Astrix — intent-centric execution on Hedera. MEV-resistant ordering via HCS; atomic settlement via HTS.
      </p>
    </footer>
  );
}

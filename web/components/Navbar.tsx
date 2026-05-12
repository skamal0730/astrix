"use client";

type Props = {
  onConnectWallet: () => void;
  onDisconnect: () => void;
  walletAddress: string;
};

function shortAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const links: { href: string; label: string; active?: boolean }[] = [
  { href: "#swap", label: "Swap", active: true },
  { href: "#stream", label: "Explore" },
  { href: "#solvers", label: "Solvers" },
  { href: "#deep-dive", label: "Docs" },
];

export function Navbar({ onConnectWallet, onDisconnect, walletAddress }: Props) {
  const connected = Boolean(walletAddress);

  return (
    <nav className="xy-navbar">
      <div className="container-max xy-navbar__row">
        <a href="#swap" className="xy-navbar__brand">
          <span className="xy-logo-wrap xy-logo-wrap--nav">
            <img
              src="/logo-xyther.png"
              alt="Xyther"
              width={112}
              height={28}
              className="logo-xyther logo-xyther--nav logo-round"
              decoding="async"
            />
          </span>
          <span className="xy-navbar__title">Xyther</span>
        </a>

        <div className="xy-navbar__links">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={l.active ? "xy-navbar__link xy-navbar__link--active" : "xy-navbar__link"}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="xy-navbar__actions">
          <span className="xy-network-pill">
            <span className="xy-network-pill__dot" aria-hidden />
            Hedera Testnet
          </span>
          {connected ? (
            <>
              <span className="xy-navbar__addr u-truncate">{shortAddress(walletAddress)}</span>
              <button type="button" className="button button-ghost button-slim" onClick={onDisconnect}>
                Disconnect
              </button>
            </>
          ) : null}
          <button type="button" className="button button-primary button-slim" onClick={onConnectWallet}>
            {connected ? "Wallet connected" : "Connect Wallet"}
          </button>
        </div>
      </div>
    </nav>
  );
}

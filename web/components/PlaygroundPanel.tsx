"use client";

const EXPIRATION_OPTIONS = [
  { label: "5 Minutes", value: 5 },
  { label: "10 Minutes", value: 10 },
  { label: "20 Minutes", value: 20 },
  { label: "30 Minutes", value: 30 },
  { label: "60 Minutes", value: 60 },
];

type Props = {
  walletAddress: string;
  hederaAccountId: string;
  setHederaAccountId: (v: string) => void;
  nonce: string;
  setNonce: (v: string) => void;
  amountIn: string;
  setAmountIn: (v: string) => void;
  minOutput: string;
  setMinOutput: (v: string) => void;
  expirationMinutes: number;
  setExpirationMinutes: (v: number) => void;
  limitPriceLabel: string;
  usdcBalanceDisplay: string;
  hbarBalanceDisplay: string;
  canSign: boolean;
  canBroadcast: boolean;
  onSign: () => void;
  onBroadcast: () => void;
  statusMessage: string;
  hashscanUrl: string;
  whbarTokenId: string;
  usdcTokenId: string;
};

export function PlaygroundPanel({
  walletAddress,
  hederaAccountId,
  setHederaAccountId,
  nonce,
  setNonce,
  amountIn,
  setAmountIn,
  minOutput,
  setMinOutput,
  expirationMinutes,
  setExpirationMinutes,
  limitPriceLabel,
  usdcBalanceDisplay,
  hbarBalanceDisplay,
  canSign,
  canBroadcast,
  onSign,
  onBroadcast,
  statusMessage,
  hashscanUrl,
  whbarTokenId,
  usdcTokenId,
}: Props) {
  const sellUsdcHuman = amountIn ? (Number(amountIn) / 1e6).toFixed(6) : "0";

  return (
    <article id="swap" className="glass-strong xy-play xy-scroll-target">
      <h2 className="xy-play__h2">Astrix Playground</h2>
      <p className="xy-play__sub">Sign an intent, broadcast to HCS, let solvers compete to fill.</p>

      <div className="xy-play__box">
        <div className="xy-play__row">
          <span className="xy-play__label">You Sell</span>
          <span className="xy-play__balance">
            Balance: <span className="u-fg-soft">{usdcBalanceDisplay}</span> USDC
          </span>
        </div>
        <div className="xy-play__input-row">
          <input
            className="xy-play__input"
            value={sellUsdcHuman}
            inputMode="decimal"
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              if (raw === "" || raw === ".") {
                setAmountIn("0");
                return;
              }
              const n = Number(raw);
              if (Number.isNaN(n)) return;
              setAmountIn(String(Math.round(n * 1e6)));
            }}
          />
          <button type="button" className="button button-ghost button-slim shrink-0">
            USDC
          </button>
        </div>
        <p className="xy-play__hint">
          On-chain: {amountIn} USDC units (6 decimals) · {usdcTokenId}
        </p>
      </div>

      <div className="xy-play__arrow">↓</div>

      <div className="xy-play__box">
        <div className="xy-play__row">
          <span className="xy-play__label">You Buy</span>
          <span className="xy-play__balance">
            Wallet HBAR: <span className="u-fg-soft">{hbarBalanceDisplay}</span>
          </span>
        </div>
        <div className="xy-play__input-row">
          <input
            className="xy-play__input"
            value={minOutput ? (Number(minOutput) / 1e8).toFixed(6) : ""}
            inputMode="decimal"
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              if (raw === "" || raw === ".") {
                setMinOutput("0");
                return;
              }
              const n = Number(raw);
              if (Number.isNaN(n)) return;
              setMinOutput(String(Math.round(n * 1e8)));
            }}
          />
          <button type="button" className="button button-ghost button-slim shrink-0">
            HBAR
          </button>
        </div>
        <p className="xy-play__hint">Min receive: WHBAR tinybars (8 decimals) · {whbarTokenId}</p>
      </div>

      <div className="xy-play__settings">
        <label className="xy-play__field-label">
          <span>Limit price</span>
          <input readOnly className="xy-play__readonly" value={limitPriceLabel} />
        </label>
        <label className="xy-play__field-label">
          <span>Expiration</span>
          <select
            className="xy-play__select"
            value={expirationMinutes}
            onChange={(e) => setExpirationMinutes(Number(e.target.value))}
          >
            {EXPIRATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="xy-play__advanced">
        <Field label="Hedera account ID (balances)" value={hederaAccountId} onChange={setHederaAccountId} placeholder="0.0.xxxxx" />
        <div className="xy-play__grid2">
          <Field
            label="Wallet"
            value={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "—"}
            readOnly
          />
          <Field label="Nonce" value={nonce} onChange={setNonce} />
        </div>
      </div>

      <button
        type="button"
        className="button button-primary broadcast-pulse xy-play__cta"
        disabled={!canSign || amountIn === "0" || minOutput === "0"}
        onClick={canBroadcast ? onBroadcast : onSign}
      >
        {canBroadcast ? "Sign & Broadcast Intent" : "Sign Intent"}
      </button>

      <div className="xy-play__status">
        <p>
          <span className="u-fg">Status:</span> {statusMessage}
        </p>
        {hashscanUrl ? (
          <p>
            <a className="link-accent" href={hashscanUrl} target="_blank" rel="noreferrer">
              View on HashScan
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="xy-play__mini-label">
      <div>{label}</div>
      <input
        className="xy-play__mini-input"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}

"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActiveIntentStream } from "@/components/ActiveIntentStream";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { PlaygroundPanel } from "@/components/PlaygroundPanel";
import { TechnicalDeepDive } from "@/components/TechnicalDeepDive";

const CHAIN_ID = 296;
const WHBAR_TOKEN_ID = "0.0.15058";
const USDC_TOKEN_ID = "0.0.429274";
const WHBAR_EVM = process.env.NEXT_PUBLIC_WHBAR_EVM || "0x0000000000000000000000000000000000003ad1";
const USDC_EVM = process.env.NEXT_PUBLIC_USDC_EVM || "0xc3ba8c19c1253c8ad43e1d3661a07efe41431ef4";
const VERIFYING_CONTRACT =
  process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT || "0x597d420DaB6A4f6E04b446D7ee9c6F938d6Bf4F7";

type IntentPayload = {
  requestId: string;
  intent: {
    intentId: number;
    signer: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    deadline: string;
    nonce: string;
    receiver: string;
    chainId: string;
    signature: string;
  };
};

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [hederaAccountId, setHederaAccountId] = useState("");
  const [signature, setSignature] = useState("");
  const [requestId, setRequestId] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [hashscanUrl, setHashscanUrl] = useState("");
  /** amountIn: USDC smallest units (6 decimals) when selling USDC */
  const [amountIn, setAmountIn] = useState("10000000");
  /** minOutput: WHBAR smallest units (8 decimals / tinybar-style) */
  const [minOutput, setMinOutput] = useState("0");
  const [nonce, setNonce] = useState(String(Date.now()));
  const [balances, setBalances] = useState<{ hbarTinybar: string; usdcUnits: string } | null>(null);
  const [expirationMinutes, setExpirationMinutes] = useState(20);
  const [limitPriceLabel, setLimitPriceLabel] = useState("Loading quote…");
  const signedDeadlineRef = useRef(0);

  const canSign = Boolean(walletAddress);
  const canBroadcast = Boolean(signature && walletAddress);

  const invalidateIntent = useCallback(() => {
    setSignature("");
    setRequestId("");
    setHashscanUrl("");
    signedDeadlineRef.current = 0;
  }, []);

  const setAmountInSafe = useCallback(
    (v: string) => {
      setAmountIn(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  const setMinOutputSafe = useCallback(
    (v: string) => {
      setMinOutput(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  const setExpirationSafe = useCallback(
    (v: number) => {
      setExpirationMinutes(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  const setNonceSafe = useCallback(
    (v: string) => {
      setNonce(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--mesh-x", `${x}%`);
      document.documentElement.style.setProperty("--mesh-y", `${y}%`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    if (!requestId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/status/${requestId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.hashscanUrl) setHashscanUrl(data.hashscanUrl);
      if (data.settlementHashscanUrl) setHashscanUrl(data.settlementHashscanUrl);
      setStatusMessage(data.stage || "awaiting_solver_execution");
    }, 2500);
    return () => clearInterval(interval);
  }, [requestId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!amountIn || amountIn === "0") {
        if (!cancelled) setLimitPriceLabel("Enter an amount to load SaucerSwap spot.");
        return;
      }
      const res = await fetch(
        `/api/spot-quote?amountIn=${encodeURIComponent(amountIn)}&sellToken=usdc`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (cancelled) return;
      setLimitPriceLabel(data.priceLabel || "Market");
      if (data.ok && data.amountOut) {
        const withSlippage = (BigInt(data.amountOut) * BigInt(99)) / BigInt(100);
        setMinOutput(withSlippage.toString());
        setSignature("");
        setRequestId("");
        setHashscanUrl("");
        signedDeadlineRef.current = 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amountIn]);

  useEffect(() => {
    if (!/^\d+\.\d+\.\d+$/.test(hederaAccountId.trim())) {
      setBalances(null);
      return;
    }
    const t = window.setTimeout(async () => {
      const res = await fetch(`/api/balances?accountId=${encodeURIComponent(hederaAccountId.trim())}`);
      const data = await res.json();
      if (!res.ok) return;
      setBalances(data);
    }, 450);
    return () => window.clearTimeout(t);
  }, [hederaAccountId]);

  const hbarBalanceDisplay = balances ? (Number(balances.hbarTinybar) / 1e8).toFixed(2) : "0.00";
  const usdcBalanceDisplay = balances ? (Number(balances.usdcUnits) / 1e6).toFixed(2) : "0.00";

  async function connectWallet() {
    const ethereumProvider = (window as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!ethereumProvider) {
      setStatusMessage("Install MetaMask to connect.");
      return;
    }
    const provider = new ethers.BrowserProvider(ethereumProvider);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    const signer = await provider.getSigner();
    setWalletAddress(await signer.getAddress());
    if (Number(network.chainId) !== CHAIN_ID) {
      setStatusMessage("Switch wallet to Hedera Testnet (chain 296).");
      return;
    }
    setStatusMessage("Wallet connected on Hedera Testnet.");
  }

  function disconnectWallet() {
    setWalletAddress("");
    invalidateIntent();
    setStatusMessage("Disconnected.");
  }

  async function signIntent() {
    const ethereumProvider = (window as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!ethereumProvider || !walletAddress) {
      setStatusMessage("Connect wallet to sign EIP-712.");
      return;
    }

    const provider = new ethers.BrowserProvider(ethereumProvider);
    const signer = await provider.getSigner();

    const domain = {
      name: "XytherIntentSettlement",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
    };

    const types = {
      SwapIntent: [
        { name: "user", type: "address" },
        { name: "inputToken", type: "address" },
        { name: "outputToken", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "minOutput", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "chainId", type: "uint256" },
      ],
    };

    const deadline = Math.floor(Date.now() / 1000) + 60 * expirationMinutes;
    signedDeadlineRef.current = deadline;

    const value = {
      user: walletAddress,
      inputToken: USDC_EVM,
      outputToken: WHBAR_EVM,
      amount: amountIn,
      minOutput,
      nonce,
      deadline,
      chainId: CHAIN_ID,
    };

    const signed = await signer.signTypedData(domain, types, value);
    setSignature(signed);
    setStatusMessage("Intent signed. Ready to broadcast.");
  }

  async function broadcastIntent() {
    if (!canBroadcast) return;
    const id = `intent-${Date.now()}`;
    const deadline = signedDeadlineRef.current || Math.floor(Date.now() / 1000) + 60 * expirationMinutes;

    const payload: IntentPayload = {
      requestId: id,
      intent: {
        intentId: Date.now(),
        signer: walletAddress,
        tokenIn: USDC_EVM,
        tokenOut: WHBAR_EVM,
        amountIn,
        minAmountOut: minOutput,
        deadline: String(deadline),
        nonce: String(nonce),
        receiver: walletAddress,
        chainId: String(CHAIN_ID),
        signature,
      },
    };

    const res = await fetch("/api/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage(data.error || "Broadcast failed");
      return;
    }
    setRequestId(data.requestId);
    setHashscanUrl(data.hashscanUrl || "");
    setStatusMessage("Broadcasted to HCS.");
  }

  return (
    <div className="xy-page">
      <Navbar onConnectWallet={connectWallet} onDisconnect={disconnectWallet} walletAddress={walletAddress} />

      <main className="xy-main">
        <Hero />
        <PlaygroundPanel
          walletAddress={walletAddress}
          hederaAccountId={hederaAccountId}
          setHederaAccountId={setHederaAccountId}
          nonce={nonce}
          setNonce={setNonceSafe}
          amountIn={amountIn}
          setAmountIn={setAmountInSafe}
          minOutput={minOutput}
          setMinOutput={setMinOutputSafe}
          expirationMinutes={expirationMinutes}
          setExpirationMinutes={setExpirationSafe}
          limitPriceLabel={limitPriceLabel}
          usdcBalanceDisplay={usdcBalanceDisplay}
          hbarBalanceDisplay={hbarBalanceDisplay}
          canSign={canSign}
          canBroadcast={canBroadcast}
          onSign={signIntent}
          onBroadcast={broadcastIntent}
          statusMessage={statusMessage}
          hashscanUrl={hashscanUrl}
          whbarTokenId={WHBAR_TOKEN_ID}
          usdcTokenId={USDC_TOKEN_ID}
        />

        <div className="xy-stream-wrap">
          <ActiveIntentStream />
        </div>

        <TechnicalDeepDive />
      </main>

      <Footer />
    </div>
  );
}

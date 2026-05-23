import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { getTestnetConfig } from "@/lib/testnet";

const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
];

/** sellToken=usdc (default): amountIn in USDC 6-dec, quote USDC→WHBAR. sellToken=hbar: amountIn in WHBAR 8-dec, quote WHBAR→USDC. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const amountIn = searchParams.get("amountIn") || "10000000";
  const sellToken = (searchParams.get("sellToken") || "usdc").toLowerCase();

  const testnet = getTestnetConfig();
  const rpc =
    process.env.HEDERA_RPC_URL ||
    process.env.NEXT_PUBLIC_HEDERA_RPC_URL ||
    "https://testnet.hashio.io/api";
  const quoter = process.env.SAUCERSWAP_QUOTER_V2 || testnet.saucerswap.quoter;
  const whbar = process.env.NEXT_PUBLIC_WHBAR_EVM || testnet.tokens.whbar.evmAddress;
  const usdc = process.env.NEXT_PUBLIC_USDC_EVM || testnet.tokens.usdc.evmAddress;
  const fee = Number(process.env.POOL_FEE || testnet.saucerswap.poolFee);

  const usdcToWhbar = sellToken === "usdc";

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const contract = new ethers.Contract(quoter, QUOTER_V2_ABI, provider);
    const params = {
      tokenIn: usdcToWhbar ? usdc : whbar,
      tokenOut: usdcToWhbar ? whbar : usdc,
      amountIn: BigInt(amountIn),
      fee,
      sqrtPriceLimitX96: BigInt(0),
    };
    const result = await contract.quoteExactInputSingle.staticCall(params);
    const amountOut = Array.isArray(result) ? (result[0] as bigint) : (result as { amountOut: bigint }).amountOut;
    const outNum = Number(amountOut);
    const inNum = Number(amountIn);

    let priceLabel: string;
    if (usdcToWhbar) {
      const usdcHuman = inNum / 1e6;
      const hbarHuman = outNum / 1e8;
      const perUsdc = usdcHuman > 0 ? hbarHuman / usdcHuman : 0;
      priceLabel =
        perUsdc > 0
          ? `1 USDC ≈ ${perUsdc.toFixed(6)} HBAR (SaucerSwap quote)`
          : "Market (quote pending)";
    } else {
      const hbarHuman = inNum / 1e8;
      const usdcHuman = outNum / 1e6;
      const perHbar = hbarHuman > 0 ? usdcHuman / hbarHuman : 0;
      priceLabel =
        perHbar > 0
          ? `1 HBAR ≈ ${perHbar.toFixed(6)} USDC (SaucerSwap quote)`
          : "Market (quote pending)";
    }

    return NextResponse.json({
      ok: true,
      amountOut: amountOut.toString(),
      priceLabel,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      amountOut: null,
      priceLabel: "Market (quoter unavailable — set HEDERA_RPC_URL or check pool)",
    });
  }
}

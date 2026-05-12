// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IV3SwapRouter} from "./interfaces/IV3SwapRouter.sol";
import {IHederaTokenService} from "./interfaces/IHederaTokenService.sol";

contract IntentSettlement is EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant INTENT_TYPEHASH = keccak256(
        "Intent(uint256 intentId,address signer,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,address receiver,uint256 chainId)"
    );

    // HIP-206 Hedera Token Service precompile.
    address public constant HTS_PRECOMPILE = address(0x167);
    int64 private constant HTS_SUCCESS = 22;

    struct Intent {
        uint256 intentId;
        address signer;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        uint256 nonce;
        address receiver;
        uint256 chainId;
    }

    mapping(address signer => mapping(uint256 nonce => bool used)) public usedNonces;

    address public immutable router;
    address public immutable whbar;
    address public immutable usdc;
    uint24 public immutable poolFee;

    error InvalidSignature();
    error InvalidIntentPair();
    error InvalidPath();
    error IntentExpired();
    error InvalidChainId();
    error NonceAlreadyUsed();
    error InvalidAmountIn();
    error InvalidReceiver();
    error HtsAssociationFailed(int64 responseCode);

    event IntentSettled(
        uint256 indexed intentId,
        address indexed signer,
        address indexed receiver,
        uint256 nonce,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address router_, address whbar_, address usdc_, uint24 poolFee_)
        EIP712("XytherIntentSettlement", "1")
    {
        router = router_;
        whbar = whbar_;
        usdc = usdc_;
        poolFee = poolFee_;
    }

    function settle(Intent calldata intent, bytes calldata signature, bytes calldata path)
        external
        returns (uint256 amountOut)
    {
        if (intent.deadline < block.timestamp) revert IntentExpired();
        if (intent.chainId != block.chainid) revert InvalidChainId();
        if (intent.amountIn == 0) revert InvalidAmountIn();
        if (intent.receiver == address(0)) revert InvalidReceiver();
        bool whbarToUsdc = intent.tokenIn == whbar && intent.tokenOut == usdc;
        bool usdcToWhbar = intent.tokenIn == usdc && intent.tokenOut == whbar;
        if (!whbarToUsdc && !usdcToWhbar) revert InvalidIntentPair();
        if (usedNonces[intent.signer][intent.nonce]) revert NonceAlreadyUsed();
        _validatePath(path, intent.tokenIn, intent.tokenOut);

        bytes32 digest = _hashTypedDataV4(_hashIntent(intent));
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != intent.signer) revert InvalidSignature();

        usedNonces[intent.signer][intent.nonce] = true;

        IERC20(intent.tokenIn).safeTransferFrom(intent.signer, address(this), intent.amountIn);
        IERC20(intent.tokenIn).forceApprove(router, intent.amountIn);

        IV3SwapRouter.ExactInputParams memory params = IV3SwapRouter.ExactInputParams({
            path: path,
            recipient: intent.receiver,
            deadline: intent.deadline,
            amountIn: intent.amountIn,
            amountOutMinimum: intent.minAmountOut
        });

        amountOut = IV3SwapRouter(router).exactInput(params);

        emit IntentSettled(
            intent.intentId, intent.signer, intent.receiver, intent.nonce, intent.amountIn, amountOut
        );
    }

    function associateSelfWithToken(address token) external returns (int64 responseCode) {
        responseCode = IHederaTokenService(HTS_PRECOMPILE).associateToken(address(this), token);
        if (responseCode != HTS_SUCCESS) revert HtsAssociationFailed(responseCode);
    }

    function isNonceUsed(address signer, uint256 nonce) external view returns (bool) {
        return usedNonces[signer][nonce];
    }

    function hbarUsdcPath() external view returns (bytes memory) {
        return abi.encodePacked(whbar, poolFee, usdc);
    }

    function _hashIntent(Intent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.intentId,
                intent.signer,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.minAmountOut,
                intent.deadline,
                intent.nonce,
                intent.receiver,
                intent.chainId
            )
        );
    }

    function _validatePath(bytes calldata path, address tokenIn, address tokenOut) internal view {
        // Single-hop V3 path format: tokenIn(20) + fee(3) + tokenOut(20) = 43 bytes.
        if (path.length != 43) revert InvalidPath();
        bytes memory expected = abi.encodePacked(tokenIn, poolFee, tokenOut);
        if (keccak256(path) != keccak256(expected)) revert InvalidPath();
    }
}

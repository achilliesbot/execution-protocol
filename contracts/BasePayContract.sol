// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal ERC20 interface (USDC)
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title BasePayContract
/// @notice Accepts USDC micro-fee payments per EP validation request (requestId).
/// @dev Agents approve USDC to this contract, then call pay(requestId).
///      EP server verifies payment by reading receipts[requestId].
///      Owner can withdraw accumulated USDC.
contract BasePayContract {
    struct Receipt {
        address payer;
        uint256 amount;
        uint256 timestamp;
    }

    address public owner;
    IERC20 public immutable usdc;

    // Fee in USDC minor units (6 decimals). Example: 0.10 USDC = 100_000
    uint256 public feeAmount;

    mapping(bytes32 => Receipt) public receipts;

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event Paid(bytes32 indexed requestId, address indexed payer, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address usdcToken, uint256 initialFeeAmount) {
        require(usdcToken != address(0), "BAD_USDC");
        owner = msg.sender;
        usdc = IERC20(usdcToken);
        feeAmount = initialFeeAmount;
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "BAD_OWNER");
        address old = owner;
        owner = newOwner;
        emit OwnerUpdated(old, newOwner);
    }

    function setFeeAmount(uint256 newFeeAmount) external onlyOwner {
        uint256 old = feeAmount;
        feeAmount = newFeeAmount;
        emit FeeUpdated(old, newFeeAmount);
    }

    function isPaid(bytes32 requestId) external view returns (bool) {
        return receipts[requestId].payer != address(0);
    }

    /// @notice Pay the micro-fee for a given EP requestId.
    /// @dev Requires prior USDC approval to this contract.
    function pay(bytes32 requestId) external {
        require(receipts[requestId].payer == address(0), "ALREADY_PAID");

        uint256 amt = feeAmount;
        require(amt > 0, "FEE_DISABLED");

        bool ok = usdc.transferFrom(msg.sender, address(this), amt);
        require(ok, "TRANSFER_FAILED");

        receipts[requestId] = Receipt({ payer: msg.sender, amount: amt, timestamp: block.timestamp });
        emit Paid(requestId, msg.sender, amt);
    }

    /// @notice Owner withdraws accumulated USDC from contract.
    /// @param to Address to receive USDC
    /// @param amount Amount to withdraw (use type(uint256).max for full balance)
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "BAD_TO");
        uint256 balance = usdc.balanceOf(address(this));
        uint256 withdrawAmount = (amount == type(uint256).max) ? balance : amount;
        require(withdrawAmount > 0 && withdrawAmount <= balance, "INSUFFICIENT_BALANCE");

        bool ok = usdc.transfer(to, withdrawAmount);
        require(ok, "TRANSFER_FAILED");
        emit Withdrawn(to, withdrawAmount);
    }
}

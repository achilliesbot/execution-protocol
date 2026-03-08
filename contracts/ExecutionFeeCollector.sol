// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Execution Protocol Fee Collector
 * @notice Collects and manages fees for Execution Protocol ACP service
 * @author Achilles (@achillesalphaai)
 * @dev Fee structure: max(0.5%, 0.01 ETH)
 */
contract ExecutionFeeCollector is Ownable, ReentrancyGuard, Pausable {
    
    // ============ State ============
    
    // Fee parameters
    uint256 public constant BASIS_POINTS = 10000; // 100%
    uint256 public feePercentage = 50; // 0.5% = 50 basis points
    uint256 public flatFeeEth = 0.01 ether;
    
    // Treasury
    address public treasury;
    uint256 public totalFeesCollected;
    
    // Execution Protocol ATTEST contract
    address public attestRegistry;
    
    // Authorized executors
    mapping(address => bool) public authorizedExecutors;
    
    // Fee records
    struct FeeRecord {
        address agent;
        uint256 tradeValue;
        uint256 feeAmount;
        bool isFlatFee;
        uint256 timestamp;
        bytes32 decisionId;
    }
    
    mapping(bytes32 => FeeRecord) public feeRecords;
    bytes32[] public allDecisionIds;
    
    // ============ Events ============
    
    event FeeCollected(
        bytes32 indexed decisionId,
        address indexed agent,
        uint256 tradeValue,
        uint256 feeAmount,
        bool isFlatFee
    );
    
    event TreasuryUpdated(address indexed newTreasury);
    event ExecutorAuthorized(address indexed executor);
    event ExecutorRevoked(address indexed executor);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event FeeParametersUpdated(uint256 percentage, uint256 flatFee);
    
    // ============ Modifiers ============
    
    modifier onlyExecutor() {
        require(authorizedExecutors[msg.sender] || msg.sender == owner(), 
            "Not authorized executor");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        authorizedExecutors[msg.sender] = true;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Calculate fee for a trade
     * @param tradeValue Trade value in wei (ETH terms)
     * @return feeAmount Fee to charge
     * @return isFlatFee Whether flat fee was used
     */
    function calculateFee(uint256 tradeValue) public view returns (uint256 feeAmount, bool isFlatFee) {
        // Calculate percentage fee
        uint256 percentageFee = (tradeValue * feePercentage) / BASIS_POINTS;
        
        // Return max of percentage or flat
        if (percentageFee >= flatFeeEth) {
            return (percentageFee, false);
        } else {
            return (flatFeeEth, true);
        }
    }
    
    /**
     * @notice Collect fee for a trade execution
     * @param decisionId Unique decision identifier
     * @param agent Agent address paying the fee
     * @param tradeValue Value of the trade
     */
    function collectFee(
        bytes32 decisionId,
        address agent,
        uint256 tradeValue
    ) external payable onlyExecutor whenNotPaused nonReentrant {
        require(agent != address(0), "Invalid agent address");
        require(feeRecords[decisionId].timestamp == 0, "Fee already collected");
        
        (uint256 requiredFee, bool isFlatFee) = calculateFee(tradeValue);
        
        require(msg.value >= requiredFee, "Insufficient fee payment");
        
        // Record the fee
        feeRecords[decisionId] = FeeRecord({
            agent: agent,
            tradeValue: tradeValue,
            feeAmount: requiredFee,
            isFlatFee: isFlatFee,
            timestamp: block.timestamp,
            decisionId: decisionId
        });
        
        allDecisionIds.push(decisionId);
        totalFeesCollected += requiredFee;
        
        // Refund excess if any
        if (msg.value > requiredFee) {
            (bool success, ) = payable(agent).call{value: msg.value - requiredFee}("");
            require(success, "Refund failed");
        }
        
        emit FeeCollected(decisionId, agent, tradeValue, requiredFee, isFlatFee);
    }
    
    /**
     * @notice Batch collect fees (gas efficient for multiple trades)
     */
    function batchCollectFees(
        bytes32[] calldata decisionIds,
        address[] calldata agents,
        uint256[] calldata tradeValues
    ) external payable onlyExecutor whenNotPaused nonReentrant {
        require(
            decisionIds.length == agents.length && 
            agents.length == tradeValues.length,
            "Array length mismatch"
        );
        
        uint256 totalRequired = 0;
        uint256[] memory fees = new uint256[](decisionIds.length);
        bool[] memory isFlatFees = new bool[](decisionIds.length);
        
        // Calculate total required
        for (uint i = 0; i < decisionIds.length; i++) {
            require(feeRecords[decisionIds[i]].timestamp == 0, "Fee already collected");
            (fees[i], isFlatFees[i]) = calculateFee(tradeValues[i]);
            totalRequired += fees[i];
        }
        
        require(msg.value >= totalRequired, "Insufficient total payment");
        
        // Record all fees
        for (uint i = 0; i < decisionIds.length; i++) {
            feeRecords[decisionIds[i]] = FeeRecord({
                agent: agents[i],
                tradeValue: tradeValues[i],
                feeAmount: fees[i],
                isFlatFee: isFlatFees[i],
                timestamp: block.timestamp,
                decisionId: decisionIds[i]
            });
            
            allDecisionIds.push(decisionIds[i]);
            totalFeesCollected += fees[i];
            
            emit FeeCollected(decisionIds[i], agents[i], tradeValues[i], fees[i], isFlatFees[i]);
        }
        
        // Refund excess
        if (msg.value > totalRequired) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - totalRequired}("");
            require(success, "Refund failed");
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get fee history for an agent
     */
    function getAgentFeeHistory(address agent) external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint i = 0; i < allDecisionIds.length; i++) {
            if (feeRecords[allDecisionIds[i]].agent == agent) {
                count++;
            }
        }
        
        bytes32[] memory history = new bytes32[](count);
        uint256 index = 0;
        for (uint i = 0; i < allDecisionIds.length; i++) {
            if (feeRecords[allDecisionIds[i]].agent == agent) {
                history[index] = allDecisionIds[i];
                index++;
            }
        }
        
        return history;
    }
    
    /**
     * @notice Get total fees collected by type
     */
    function getFeeStats() external view returns (
        uint256 totalFlatFees,
        uint256 totalPercentageFees,
        uint256 flatFeeCount,
        uint256 percentageFeeCount
    ) {
        for (uint i = 0; i < allDecisionIds.length; i++) {
            FeeRecord memory record = feeRecords[allDecisionIds[i]];
            if (record.isFlatFee) {
                totalFlatFees += record.feeAmount;
                flatFeeCount++;
            } else {
                totalPercentageFees += record.feeAmount;
                percentageFeeCount++;
            }
        }
    }
    
    // ============ Admin Functions ============
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    function authorizeExecutor(address executor) external onlyOwner {
        require(executor != address(0), "Invalid executor address");
        authorizedExecutors[executor] = true;
        emit ExecutorAuthorized(executor);
    }
    
    function revokeExecutor(address executor) external onlyOwner {
        authorizedExecutors[executor] = false;
        emit ExecutorRevoked(executor);
    }
    
    function setFeeParameters(uint256 _percentage, uint256 _flatFee) external onlyOwner {
        require(_percentage <= 500, "Percentage too high (max 5%)"); // Max 5%
        feePercentage = _percentage;
        flatFeeEth = _flatFee;
        emit FeeParametersUpdated(_percentage, _flatFee);
    }
    
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(treasury).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit FeesWithdrawn(treasury, balance);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Receive ============
    
    receive() external payable {
        // Accept ETH payments
    }
}

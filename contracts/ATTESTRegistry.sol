// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
// Note: Address.isContract removed in OZ v5 - using direct code length check instead
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ATTEST Registry
 * @notice Onchain attestation service for AI agent reputation
 * @author Achilles (@achillesalphaai)
 * @dev Built for the AI agent economy on Base
 */
contract ATTESTRegistry is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // ============ Structs ============
    
    struct Attestation {
        bytes32 uid;                    // Unique identifier
        bytes32 schema;                 // Schema type (job, skill, identity)
        address recipient;              // Agent receiving attestation
        address attester;               // Protocol/person issuing
        uint64 time;                    // Creation timestamp
        uint64 expiration;              // Optional expiration
        bool revocable;                 // Can be revoked?
        bytes32 refUID;                 // Reference to previous attestation
        bytes data;                     // Encoded attestation data
    }
    
    struct Schema {
        bytes32 uid;
        string name;
        string description;
        bytes32 schemaType;             // keccak256 of data structure
        address resolver;               // Optional validation contract
        bool revocable;
        uint256 attestationsCount;
    }
    
    struct AgentProfile {
        address agentAddress;
        uint256 totalAttestations;
        uint256 totalAttesters;
        uint256 reputationScore;        // 0-10000 (2 decimal places)
        uint256 lastActivityBlock;      // Use block number instead of timestamp (audit fix H1)
        bool isVerified;
        bytes32 identityAttestation;
    }

    // ============ State ============
    
    // UID => Attestation
    mapping(bytes32 => Attestation) public attestations;
    
    // Schema UID => Schema
    mapping(bytes32 => Schema) public schemas;
    
    // Agent => Profile
    mapping(address => AgentProfile) public profiles;
    
    // Schema type => array of attestation UIDs
    mapping(bytes32 => bytes32[]) public attestationsBySchema;
    
    // Agent => attestation count by schema
    mapping(address => mapping(bytes32 => uint256)) public agentAttestationCount;
    
    // Revoked attestations
    mapping(bytes32 => bool) public revokedAttestations;
    
    // Nonce tracking for signatures
    mapping(address => uint256) public nonces;
    
    // Counters
    uint256 public totalAttestations;
    uint256 public totalSchemas;
    
    // Fees
    uint256 public attestationFee = 0.001 ether;  // ~$2-3 on Base
    uint256 public schemaCreationFee = 0.01 ether; // ~$20-30 on Base
    
    // Maximum fee limits
    uint256 public constant MAX_ATTESTATION_FEE = 0.1 ether;  // ~$200 max
    uint256 public constant MAX_SCHEMA_CREATION_FEE = 1 ether; // ~$2000 max
    
    // Average block time on Base (for reputation calculation)
    uint256 public constant AVG_BLOCK_TIME = 12; // 12 seconds per block
    
    // ============ Events ============
    
    event AttestationCreated(
        bytes32 indexed uid,
        bytes32 indexed schema,
        address indexed recipient,
        address attester,
        uint64 time
    );
    
    event AttestationRevoked(
        bytes32 indexed uid,
        address indexed revoker,
        uint64 time
    );
    
    event SchemaRegistered(
        bytes32 indexed uid,
        string name,
        address indexed resolver
    );
    
    event AgentVerified(
        address indexed agent,
        bytes32 indexed identityAttestation,
        uint256 timestamp
    );
    
    event ReputationUpdated(
        address indexed agent,
        uint256 newScore,
        uint256 timestamp
    );
    
    event FeesUpdated(
        uint256 attestationFee,
        uint256 schemaCreationFee,
        uint256 timestamp
    );
    
    // ============ Constructor ============
    
    constructor() 
        Ownable(msg.sender) 
        EIP712("ATTEST", "1") 
    {}
    
    // ============ Core Functions ============
    
    /**
     * @notice Create a new schema type
     * @param _name Schema name (e.g., "JobCompletion")
     * @param _description Human-readable description
     * @param _schemaType Hash of data structure
     * @param _resolver Optional validation contract
     * @param _revocable Can attestations be revoked?
     * @return schemaUID Unique schema identifier
     */
    function registerSchema(
        string calldata _name,
        string calldata _description,
        bytes32 _schemaType,
        address _resolver,
        bool _revocable
    ) external payable whenNotPaused returns (bytes32 schemaUID) {
        require(msg.value >= schemaCreationFee, "ATTEST: Insufficient fee");
        require(bytes(_name).length > 0, "ATTEST: Name required");
        require(_schemaType != bytes32(0), "ATTEST: Invalid schema type");
        require(bytes(_description).length > 0, "ATTEST: Description required");
        
        // Validate resolver address if provided
        // Note: Using assembly to check code size (OZ v5 removed Address.isContract)
        if (_resolver != address(0)) {
            uint256 size;
            assembly {
                size := extcodesize(_resolver)
            }
            require(size > 0, "ATTEST: Resolver must be contract");
        }
        
        schemaUID = keccak256(abi.encodePacked(
            _name,
            _schemaType,
            msg.sender,
            block.number  // Use block number instead of timestamp for consistency
        ));
        
        require(schemas[schemaUID].uid == bytes32(0), "ATTEST: Schema exists");
        
        schemas[schemaUID] = Schema({
            uid: schemaUID,
            name: _name,
            description: _description,
            schemaType: _schemaType,
            resolver: _resolver,
            revocable: _revocable,
            attestationsCount: 0
        });
        
        totalSchemas++;
        
        emit SchemaRegistered(schemaUID, _name, _resolver);
        
        return schemaUID;
    }
    
    /**
     * @notice Create an attestation (external entry point)
     * @param _schema Schema UID
     * @param _recipient Agent receiving attestation
     * @param _expiration Optional expiration (0 for none)
     * @param _refUID Reference to previous attestation
     * @param _data Encoded attestation data
     * @return uid Unique attestation identifier
     */
    function attest(
        bytes32 _schema,
        address _recipient,
        uint64 _expiration,
        bytes32 _refUID,
        bytes calldata _data
    ) external payable whenNotPaused returns (bytes32 uid) {
        return _attestInternal(_schema, _recipient, _expiration, _refUID, _data);
    }
    
    /**
     * @dev Internal attestation logic shared between external attest and verifyAgentIdentity
     */
    function _attestInternal(
        bytes32 _schema,
        address _recipient,
        uint64 _expiration,
        bytes32 _refUID,
        bytes memory _data
    ) internal returns (bytes32 uid) {
        require(msg.value >= attestationFee, "ATTEST: Insufficient fee");
        require(_recipient != address(0), "ATTEST: Invalid recipient");
        require(schemas[_schema].uid != bytes32(0), "ATTEST: Schema not found");
        
        Schema storage schema = schemas[_schema];
        
        // Check resolver if exists
        if (schema.resolver != address(0)) {
            require(
                ISchemaResolver(schema.resolver).resolve(_recipient, _data),
                "ATTEST: Resolver rejected"
            );
        }
        
        // Generate unique UID (using block.timestamp for external calls, block.number for internal)
        uid = keccak256(abi.encodePacked(
            _schema,
            _recipient,
            msg.sender,
            block.timestamp,
            totalAttestations
        ));
        
        require(attestations[uid].uid == bytes32(0), "ATTEST: UID collision");
        
        // Create attestation
        attestations[uid] = Attestation({
            uid: uid,
            schema: _schema,
            recipient: _recipient,
            attester: msg.sender,
            time: uint64(block.timestamp),
            expiration: _expiration,
            revocable: schema.revocable,
            refUID: _refUID,
            data: _data
        });
        
        // Update counters and indices
        totalAttestations++;
        attestationsBySchema[_schema].push(uid);
        agentAttestationCount[_recipient][_schema]++;
        
        // Update or create agent profile
        _updateAgentProfile(_recipient);
        
        // Update schema count
        schemas[_schema].attestationsCount++;
        
        emit AttestationCreated(uid, _schema, _recipient, msg.sender, uint64(block.timestamp));
        
        return uid;
    }
    
    /**
     * @notice Revoke an attestation
     * @param _uid Attestation to revoke
     */
    function revoke(bytes32 _uid) external whenNotPaused {
        Attestation storage attestation = attestations[_uid];
        
        require(attestation.uid != bytes32(0), "ATTEST: Not found");
        require(attestation.revocable, "ATTEST: Not revocable");
        require(
            attestation.attester == msg.sender || owner() == msg.sender,
            "ATTEST: Not authorized"
        );
        require(!revokedAttestations[_uid], "ATTEST: Already revoked");
        
        revokedAttestations[_uid] = true;
        
        emit AttestationRevoked(_uid, msg.sender, uint64(block.timestamp));
    }
    
    /**
     * @notice Verify agent identity and create identity attestation
     * @param _agent Agent address
     * @param _proof Identity proof (signed message)
     * @return uid Identity attestation UID
     */
    function verifyAgentIdentity(
        address _agent,
        bytes calldata _proof
    ) external onlyOwner whenNotPaused returns (bytes32 uid) {
        require(_agent != address(0), "ATTEST: Invalid address");
        require(!profiles[_agent].isVerified, "ATTEST: Already verified");
        
        // TODO: Implement proof verification logic
        // This would check Bankr identity, social verification, etc.
        
        // Create identity schema if not exists
        bytes32 identitySchema = keccak256("AgentIdentity");
        
        uid = _attestInternal(
            identitySchema,
            _agent,
            0, // No expiration
            bytes32(0),
            _proof
        );
        
        profiles[_agent].isVerified = true;
        profiles[_agent].identityAttestation = uid;
        
        emit AgentVerified(_agent, uid, block.timestamp);
        
        return uid;
    }
    
    /**
     * @notice Get agent reputation score
     * @param _agent Agent address
     * @return score 0-10000 (represents 0.00-100.00)
     */
    function getReputationScore(address _agent) external view returns (uint256 score) {
        return profiles[_agent].reputationScore;
    }
    
    /**
     * @notice Get all attestations for an agent by schema
     */
    function getAgentAttestations(
        address _agent,
        bytes32 _schema
    ) external view returns (bytes32[] memory) {
        bytes32[] memory allAttestations = attestationsBySchema[_schema];
        bytes32[] memory agentAttestations = new bytes32[](agentAttestationCount[_agent][_schema]);
        
        uint256 count = 0;
        for (uint256 i = 0; i < allAttestations.length; i++) {
            if (attestations[allAttestations[i]].recipient == _agent && 
                !revokedAttestations[allAttestations[i]]) {
                agentAttestations[count] = allAttestations[i];
                count++;
            }
        }
        
        return agentAttestations;
    }
    
    /**
     * @notice Check if attestation is valid (not revoked, not expired)
     */
    function isAttestationValid(bytes32 _uid) external view returns (bool) {
        Attestation storage attestation = attestations[_uid];
        
        if (attestation.uid == bytes32(0)) return false;
        if (revokedAttestations[_uid]) return false;
        if (attestation.expiration != 0 && attestation.expiration < block.timestamp) return false;
        
        return true;
    }
    
    // ============ Internal Functions ============
    
    function _updateAgentProfile(address _agent) internal {
        AgentProfile storage profile = profiles[_agent];
        
        if (profile.agentAddress == address(0)) {
            profile.agentAddress = _agent;
        }
        
        profile.totalAttestations++;
        profile.lastActivityBlock = block.number; // Use block number instead of timestamp (audit fix H1)
        
        // Calculate reputation score
        uint256 newScore = _calculateReputationScore(_agent);
        profile.reputationScore = newScore;
        
        emit ReputationUpdated(_agent, newScore, block.timestamp);
    }
    
    function _calculateReputationScore(address _agent) internal view returns (uint256) {
        AgentProfile storage profile = profiles[_agent];
        
        if (profile.totalAttestations == 0) return 0;
        
        // Base score from attestation count (with overflow protection)
        uint256 baseScore = profile.totalAttestations * 100;
        require(baseScore / 100 == profile.totalAttestations, "ATTEST: Overflow in score calc");
        
        // Bonus for verification
        baseScore = baseScore + 2000;
        
        // Bonus for diversity of attesters (with overflow check)
        uint256 diversityBonus = profile.totalAttesters * 500;
        require(diversityBonus / 500 == profile.totalAttesters, "ATTEST: Overflow in diversity calc");
        baseScore = baseScore + diversityBonus;
        
        // Time bonus based on block number (not timestamp) - prevents miner manipulation (audit fix H1)
        // Approximately 30 days worth of blocks
        uint256 blocksIn30Days = 30 days / AVG_BLOCK_TIME; // ~216,000 blocks
        uint256 timeBonus = (block.number - profile.lastActivityBlock) < blocksIn30Days ? 1000 : 0;
        baseScore = baseScore + timeBonus;
        
        // Cap at 10000
        return baseScore > 10000 ? 10000 : baseScore;
    }
    
    // ============ Admin Functions ============
    
    function setFees(
        uint256 _attestationFee,
        uint256 _schemaCreationFee
    ) external onlyOwner {
        require(_attestationFee <= MAX_ATTESTATION_FEE, "ATTEST: Attestation fee exceeds maximum");
        require(_schemaCreationFee <= MAX_SCHEMA_CREATION_FEE, "ATTEST: Schema fee exceeds maximum");
        
        attestationFee = _attestationFee;
        schemaCreationFee = _schemaCreationFee;
        
        emit FeesUpdated(_attestationFee, _schemaCreationFee, block.timestamp);
    }
    
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "ATTEST: No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "ATTEST: Fee withdrawal failed");
    }
    
    // ============ Interface ============
}

interface ISchemaResolver {
    function resolve(address recipient, bytes calldata data) external view returns (bool);
}

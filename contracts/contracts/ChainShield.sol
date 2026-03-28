// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChainShield {
    struct SuspiciousRecord {
        uint40 timestamp; // fits block.timestamp, packs with riskScore into one slot
        uint8 riskScore; // 0-100 compressed to 1 byte
    }

    // Minimal on-chain storage: only keep a flag + compact risk data
    mapping(bytes32 => SuspiciousRecord) public suspicious;
    address public owner;
    uint256 public totalSuspicious;

    event SuspiciousRecorded(bytes32 indexed txHash, uint8 riskScore, uint256 timestamp, bytes32 metaHash);

    error NotAuthorized();
    error AlreadyRecorded();
    error InvalidRisk();
    error NotFound();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Record only suspicious transactions; owner-only to prevent spam
    /// @param _txHash SHA-256 hash of transaction payload
    /// @param _riskScore Compact risk score 0-100
    /// @param _metaHash Optional hashed metadata stored via event (gas cheap)
    function recordSuspicious(bytes32 _txHash, uint8 _riskScore, bytes32 _metaHash) external onlyOwner {
        if (suspicious[_txHash].timestamp != 0) revert AlreadyRecorded();
        if (_riskScore > 100) revert InvalidRisk();

        suspicious[_txHash] = SuspiciousRecord({
            timestamp: uint40(block.timestamp),
            riskScore: _riskScore
        });

        unchecked {
            totalSuspicious += 1;
        }

        emit SuspiciousRecorded(_txHash, _riskScore, block.timestamp, _metaHash);
    }

    /// @notice Check if a suspicious tx hash exists
    function isRecorded(bytes32 _txHash) public view returns (bool) {
        return suspicious[_txHash].timestamp != 0;
    }

    /// @notice Get compact suspicious record
    function getSuspicious(bytes32 _txHash) external view returns (uint256 timestamp, uint8 riskScore) {
        SuspiciousRecord memory record = suspicious[_txHash];
        if (record.timestamp == 0) revert NotFound();
        return (uint256(record.timestamp), record.riskScore);
    }

    /// @notice Transfer contract ownership (for maintenance)
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}

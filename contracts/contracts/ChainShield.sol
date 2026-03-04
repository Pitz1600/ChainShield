// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChainShield {
    struct SuspiciousRecord {
        uint256 timestamp;
        uint8 riskScore; // 0-100 compressed to 1 byte
    }

    // Minimal on-chain storage: only keep a flag + compact risk data
    mapping(bytes32 => SuspiciousRecord) public suspicious;
    address public owner;
    uint256 public totalSuspicious;

    event SuspiciousRecorded(bytes32 indexed txHash, uint8 riskScore, uint256 timestamp, bytes32 metaHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
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
        require(!isRecorded(_txHash), "Already recorded");
        require(_riskScore <= 100, "Invalid risk");

        suspicious[_txHash] = SuspiciousRecord({
            timestamp: block.timestamp,
            riskScore: _riskScore
        });

        totalSuspicious += 1;

        emit SuspiciousRecorded(_txHash, _riskScore, block.timestamp, _metaHash);
    }

    /// @notice Check if a suspicious tx hash exists
    function isRecorded(bytes32 _txHash) public view returns (bool) {
        return suspicious[_txHash].timestamp != 0;
    }

    /// @notice Get compact suspicious record
    function getSuspicious(bytes32 _txHash) external view returns (uint256 timestamp, uint8 riskScore) {
        SuspiciousRecord memory record = suspicious[_txHash];
        require(record.timestamp != 0, "Not found");
        return (record.timestamp, record.riskScore);
    }

    /// @notice Transfer contract ownership (for maintenance)
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}

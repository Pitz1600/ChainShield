// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ChainShield Smart Contract
 * @notice Minimal smart contract for recording transaction hashes on Ethereum blockchain
 * @dev Stores only transaction hashes, timestamps, and verifier IDs - NO PII or financial details
 * 
 * This contract is designed for Philippine government fraud detection prototype.
 * It provides immutable audit trails for transaction verification.
 */
contract ChainShield {
    struct TransactionRecord {
        bytes32 txHash;
        uint256 timestamp;
        address verifier;
        bool exists;
    }
    
    mapping(bytes32 => TransactionRecord) public records;
    address public owner;
    uint256 public totalRecords;
    
    event TransactionRecorded(
        bytes32 indexed txHash,
        uint256 timestamp,
        address indexed verifier
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Record a transaction hash on the blockchain
     * @param _txHash The SHA-256 hash of the transaction data
     * @dev Only stores hash - no personal or financial information
     */
    function recordTransaction(bytes32 _txHash) public {
        require(!records[_txHash].exists, "Transaction already recorded");
        
        records[_txHash] = TransactionRecord({
            txHash: _txHash,
            timestamp: block.timestamp,
            verifier: msg.sender,
            exists: true
        });
        
        totalRecords++;
        
        emit TransactionRecorded(_txHash, block.timestamp, msg.sender);
    }
    
    /**
     * @notice Verify if a transaction hash exists on the blockchain
     * @param _txHash The transaction hash to verify
     * @return Boolean indicating if transaction exists
     */
    function verifyTransaction(bytes32 _txHash) public view returns (bool) {
        return records[_txHash].exists;
    }
    
    /**
     * @notice Get transaction record details
     * @param _txHash The transaction hash to query
     * @return txHash The stored transaction hash
     * @return timestamp The block timestamp when recorded
     * @return verifier The address that recorded the transaction
     */
    function getTransaction(bytes32 _txHash) public view returns (
        bytes32,
        uint256,
        address
    ) {
        require(records[_txHash].exists, "Transaction not found");
        TransactionRecord memory record = records[_txHash];
        return (record.txHash, record.timestamp, record.verifier);
    }
    
    /**
     * @notice Get total number of recorded transactions
     * @return Total count of transactions
     */
    function getTotalRecords() public view returns (uint256) {
        return totalRecords;
    }
    
    /**
     * @notice Transfer contract ownership (for maintenance)
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
}

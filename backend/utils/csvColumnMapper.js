/**
 * Intelligent CSV Column Mapper
 * Auto-detects columns from any budget CSV format
 */

class CSVColumnMapper {
    constructor() {
        // Define possible column name variations for each field
        this.fieldMappings = {
            amount: [
                'amount', 'total', 'value', 'cost', 'price', 'budget', 'expense',
                'disbursement', 'payment', 'sum', 'total_amount', 'transaction_amount',
                'net_amount', 'gross_amount', 'halaga', 'bayad'
            ],
            // Separate debit/credit columns (will be handled specially)
            debit_amount: [
                'debit_amount', 'debit', 'debit_amt', 'dr', 'dr_amount', 'debit_value',
                'withdrawal', 'outflow', 'expense_amount'
            ],
            credit_amount: [
                'credit_amount', 'credit', 'credit_amt', 'cr', 'cr_amount', 'credit_value',
                'deposit', 'inflow', 'income_amount'
            ],
            transactionType: [
                'type', 'transaction_type', 'category', 'transaction_category',
                'purpose', 'classification', 'uri', 'klase',
                // ✅ ADD THESE
                'transaction_code', 'trans_code', 'code', 'txn_type', 'txn_code'
            ],
            fromAddress: [
                'from', 'from_address', 'sender', 'source', 'payer', 'from_account',
                'originator', 'debtor', 'nagbayad', 'pinagmulan',
                // ✅ ADD THESE
                'payer_name', 'paid_by', 'debtor_name', 'from_entity', 'from_name'
            ],
            toAddress: [
                'to', 'to_address', 'recipient', 'receiver', 'payee', 'to_account',
                'beneficiary', 'creditor', 'tumanggap', 'destinasyon',
                // ✅ ADD THESE
                'payee_name', 'paid_to', 'creditor_name', 'to_entity', 'to_name',
                'encashed_by', 'received_by'
            ],
            agency: [
                'agency', 'department', 'office', 'organization', 'org', 'ministry',
                'bureau', 'unit', 'ahensya', 'kagawaran', 'barangay', 'lgu'
            ],
            programName: [
                'program', 'program_name', 'project', 'project_name', 'initiative',
                'scheme', 'programa', 'proyekto'
            ],
            beneficiaryType: [
                'beneficiary_type', 'recipient_type', 'payee_type', 'entity_type',
                'uri_ng_tumanggap'
            ],
            description: [
                'description', 'details', 'particulars', 'notes', 'remarks',
                'memo', 'narrative', 'paglalarawan', 'detalye',
                // ✅ ADD THESE
                'description_raw', 'desc', 'comment', 'purpose'
            ],
            timestamp: [
                'date', 'timestamp', 'transaction_date', 'payment_date', 'disbursement_date',
                'created_at', 'datetime', 'petsa',
                // ✅ ADD THESE
                'post_date', 'posting_date', 'effective_date', 'value_date', 'trans_date',
                'txn_date', 'date_posted'
            ],
            transactionId: [
                'id', 'transaction_id', 'reference', 'ref_no', 'reference_number',
                'voucher_no', 'check_no', 'receipt_no',
                // ✅ ADD THESE
                'record_id', 'txn_id', 'transaction_ref'
            ]
        };
    }

    /**
     * Auto-detect column mappings from CSV headers
     */
    detectColumns(headers) {
        const mappings = {};
        const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

        // Try to map each field
        for (const [field, variations] of Object.entries(this.fieldMappings)) {
            const matchedHeader = this.findBestMatch(normalizedHeaders, variations);
            if (matchedHeader) {
                // Find original header (with original casing)
                const originalIndex = normalizedHeaders.indexOf(matchedHeader);
                mappings[field] = headers[originalIndex];
            }
        }

        return mappings;
    }

    /**
     * Find best matching header for a field
     */
    findBestMatch(headers, variations) {
        // First try exact match
        for (const variation of variations) {
            if (headers.includes(variation)) {
                return variation;
            }
        }

        // Then try partial match (contains)
        for (const variation of variations) {
            const match = headers.find(h => h.includes(variation) || variation.includes(h));
            if (match) {
                return match;
            }
        }

        return null;
    }

    /**
     * Intelligently detect and extract amount from debit/credit columns
     */
    detectAmountColumns(row, mappings) {
        const debitCol = mappings.debit_amount;
        const creditCol = mappings.credit_amount;

        // If we have separate debit/credit columns
        if (debitCol && creditCol) {
            const debit = parseFloat(row[debitCol]) || 0;
            const credit = parseFloat(row[creditCol]) || 0;

            // Use whichever is non-zero
            // If both are non-zero, prefer debit (expense/outflow)
            if (debit > 0) return debit;
            if (credit > 0) return credit;

            // Both are zero or invalid
            return 0;
        }

        // If only debit column exists
        if (debitCol && row[debitCol]) {
            return parseFloat(row[debitCol]) || 0;
        }

        // If only credit column exists
        if (creditCol && row[creditCol]) {
            return parseFloat(row[creditCol]) || 0;
        }

        // Fall back to regular amount column
        if (mappings.amount && row[mappings.amount]) {
            return parseFloat(row[mappings.amount]) || 0;
        }

        return 0;
    }

    /**
     * Map CSV row to transaction object using detected mappings
     */
    mapRow(row, mappings) {
        const transaction = {};

        // Special handling for amount (debit/credit)
        const amount = this.detectAmountColumns(row, mappings);
        if (amount > 0) {
            transaction.amount = amount;
        }

        // Map each field (skip amount fields as we handled them above)
        for (const [field, columnName] of Object.entries(mappings)) {
            if (field === 'debit_amount' || field === 'credit_amount') {
                continue; // Already handled
            }

            if (row[columnName] !== undefined && row[columnName] !== '') {
                transaction[field] = row[columnName];
            }
        }

        // Apply defaults and transformations
        return this.applyDefaults(transaction);
    }

    /**
     * Apply defaults and smart transformations
     */
    applyDefaults(transaction) {
        // Infer transaction type from description or amount
        if (!transaction.transactionType) {
            transaction.transactionType = this.inferTransactionType(transaction);
        }

        // Generate addresses if missing
        if (!transaction.fromAddress) {
            transaction.fromAddress = this.generateAddress(transaction.agency || 'Government');
        }
        if (!transaction.toAddress) {
            transaction.toAddress = this.generateAddress(transaction.beneficiaryType || 'Beneficiary');
        }

        // Set defaults
        transaction.currency = transaction.currency || 'PHP';
        transaction.beneficiaryType = transaction.beneficiaryType || 'Individual';
        transaction.agency = transaction.agency || 'Unknown Agency';

        return transaction;
    }

    /**
     * Infer transaction type from context
     */
    inferTransactionType(transaction) {
        const desc = (transaction.description || '').toLowerCase();
        const program = (transaction.programName || '').toLowerCase();
        const agency = (transaction.agency || '').toLowerCase();

        // Check for welfare keywords
        if (desc.includes('welfare') || desc.includes('4ps') || desc.includes('assistance') ||
            program.includes('welfare') || program.includes('assistance') ||
            agency.includes('dswd') || agency.includes('social welfare')) {
            return 'Social Welfare';
        }

        // Check for procurement keywords
        if (desc.includes('procurement') || desc.includes('purchase') || desc.includes('supply') ||
            desc.includes('equipment') || desc.includes('construction') ||
            program.includes('procurement') || program.includes('infrastructure')) {
            return 'Procurement';
        }

        // Check for tax keywords
        if (desc.includes('tax') || desc.includes('revenue') || agency.includes('bir') ||
            agency.includes('revenue')) {
            return 'Tax';
        }

        // Check for grant keywords
        if (desc.includes('grant') || desc.includes('subsidy') || desc.includes('scholarship')) {
            return 'Grant';
        }

        // Default
        return 'Other';
    }

    /**
     * Generate Ethereum-style address from text
     */
    generateAddress(text) {
        // Create a simple hash-based address
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        // Convert to hex and pad
        const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
        return '0x' + hexHash.repeat(5).substring(0, 40);
    }

    /**
     * Validate mapped transaction
     */
    validate(transaction) {
        const errors = [];

        // Check for amount
        if (!transaction.amount || isNaN(parseFloat(transaction.amount))) {
            errors.push('Invalid or missing amount');
        } else {
            const amount = parseFloat(transaction.amount);

            // ✅ SECURITY: Prevent NaN, Infinity, and unrealistic values
            if (!Number.isFinite(amount)) {
                errors.push('Amount must be a finite number');
            } else if (amount <= 0) {
                errors.push('Amount must be positive');
            } else if (amount > 1e12) {
                // Prevent unrealistic amounts (> 1 trillion)
                errors.push('Amount exceeds maximum allowed value');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get confidence score for mappings
     */
    getConfidence(mappings) {
        const requiredFields = ['amount'];
        const importantFields = ['transactionType', 'fromAddress', 'toAddress'];
        const optionalFields = ['agency', 'programName', 'description'];

        let score = 0;
        let maxScore = 0;

        // Required fields (40 points each)
        for (const field of requiredFields) {
            maxScore += 40;
            if (mappings[field]) score += 40;
        }

        // Important fields (20 points each)
        for (const field of importantFields) {
            maxScore += 20;
            if (mappings[field]) score += 20;
        }

        // Optional fields (5 points each)
        for (const field of optionalFields) {
            maxScore += 5;
            if (mappings[field]) score += 5;
        }

        return Math.round((score / maxScore) * 100);
    }
}

module.exports = CSVColumnMapper;

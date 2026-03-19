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
                'debit_amount', 'debit_amt', 'debit_value',
                'withdrawal', 'outflow', 'expense_amount', 'debit'
            ],
            credit_amount: [
                'credit_amount', 'credit_amt', 'credit_value',
                'deposit', 'inflow', 'income_amount', 'credit'
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
                'agency', 'agency_name', 'agency name', 'department', 'department_name',
                'office', 'office_name', 'organization', 'org', 'ministry',
                'bureau', 'unit', 'ahensya', 'kagawaran', 'barangay', 'lgu'
            ],
            programName: [
                'program', 'program_name', 'program name', 'program_title', 'program title',
                'project', 'project_name', 'project name', 'project_title', 'project title',
                'initiative', 'scheme', 'programa', 'proyekto'
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
                'record_id', 'txn_id', 'transaction_ref'
            ],

        };
    }

    normalizeHeader(value) {
        return String(value || '')
            .replace(/\ufeff/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '');
    }

    /**
     * Auto-detect column mappings from CSV headers
     */
    detectColumns(headers) {
        const mappings = {};
        const normalizedHeaders = headers.map((h) => this.normalizeHeader(h));
        const normalizedToOriginal = new Map();

        headers.forEach((header, index) => {
            const normalized = normalizedHeaders[index];
            if (normalized && !normalizedToOriginal.has(normalized)) {
                normalizedToOriginal.set(normalized, header);
            }
        });

        // Try to map each field
        for (const [field, variations] of Object.entries(this.fieldMappings)) {
            const matchedHeader = this.findBestMatch(normalizedHeaders, variations);
            if (matchedHeader) {
                const original = normalizedToOriginal.get(matchedHeader);
                if (original) {
                    mappings[field] = original;
                }
            }
        }

        return mappings;
    }

    /**
     * Find best matching header for a field
     */
    findBestMatch(headers, variations) {
        const normalizedVariations = variations.map((v) => this.normalizeHeader(v));

        // First try exact match
        for (const variation of normalizedVariations) {
            if (headers.includes(variation)) {
                return variation;
            }
        }

        // Then try partial match — only allow if variation is at least 5 chars
        // to prevent short strings like 'cr', 'dr' matching inside longer words
        for (const variation of normalizedVariations) {
            if (variation.length < 5) continue;
            const match = headers.find((h) => h.includes(variation) || variation.includes(h));
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
        // Fill agency from programName if missing
        if (!transaction.agency || String(transaction.agency).trim() === '') {
            transaction.agency = transaction.programName || 'Unknown Agency';
        }

        // Fill programName from agency if missing
        if (!transaction.programName || String(transaction.programName).trim() === '') {
            transaction.programName = transaction.agency || '';
        }

        // Infer transaction type from description or amount
        if (!transaction.transactionType) {
            transaction.transactionType = this.inferTransactionType(transaction);
        }

        // Generate addresses if missing
        if (!transaction.fromAddress) {
            transaction.fromAddress = this.generateAddress(transaction.agency || 'Barangay');
        }
        if (!transaction.toAddress) {
            transaction.toAddress = this.generateAddress(transaction.beneficiaryType || 'Beneficiary');
        }

        // Set defaults
        transaction.currency = transaction.currency || 'PHP';
        transaction.beneficiaryType = transaction.beneficiaryType || 'Individual';

        return transaction;
    }

    /**
     * Infer transaction type from context
     */
    inferTransactionType(transaction) {
        const desc    = (transaction.description   || '').toLowerCase();
        const program = (transaction.programName   || '').toLowerCase();
        const agency  = (transaction.agency        || '').toLowerCase();
        const combined = `${desc} ${program} ${agency}`;

        // Welfare keywords
        if (combined.includes('welfare') || combined.includes('4ps') ||
            combined.includes('assistance') || combined.includes('dswd') ||
            combined.includes('social welfare') || combined.includes('beneficiary')) {
            return 'Social Welfare';
        }

        // Procurement keywords
        if (combined.includes('procurement') || combined.includes('purchase') ||
            combined.includes('supply') || combined.includes('equipment') ||
            combined.includes('construction') || combined.includes('infrastructure') ||
            combined.includes('supplier') || combined.includes('contractor')) {
            return 'Procurement';
        }

        // Tax keywords
        if (combined.includes('tax') || combined.includes('revenue') ||
            combined.includes('bir') || combined.includes('business permit')) {
            return 'Tax';
        }

        // Grant keywords
        if (combined.includes('grant') || combined.includes('subsidy') ||
            combined.includes('scholarship') || combined.includes('livelihood')) {
            return 'Grant';
        }

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

        const hasAgency  = transaction.agency      && String(transaction.agency).trim()      !== '';
        const hasProgram = transaction.programName && String(transaction.programName).trim() !== '';

        // Fill agency from programName if missing
        if (!hasAgency) {
            transaction.agency = transaction.programName || 'Unknown Agency';
        }

        // Fill programName from agency if missing
        if (!hasProgram) {
            transaction.programName = transaction.agency || '';
        }

        // Validate with filled-in values
        if (!transaction.agency || String(transaction.agency).trim() === '') {
            errors.push('Missing agency');
        }
        if (!transaction.programName || String(transaction.programName).trim() === '') {
            errors.push('Missing program name');
        }

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
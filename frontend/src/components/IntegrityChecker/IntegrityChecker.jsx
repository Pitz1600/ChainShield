import React, { useState } from 'react';
import { Lock, Upload, AlertCircle, CheckCircle, Clock, FileText, AlertTriangle, TrendingUp, Shield, BarChart, Info, Settings, Zap, Download, ChevronLeft, ChevronRight, Link, Clipboard, Plus, Trash2, X, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { isOfficial } from '../../utils/permissions';
import { formatAddressLabel } from '../../utils/helpers';
import '../../styles/IntegrityChecker.css';
import useLockBodyScroll from '../../utils/useLockBodyScroll';

const IntegrityChecker = ({ user }) => {
    // Permission check - only officials and admins can import
    if (!isOfficial(user)) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><Lock size={48} color="#991b1b" /></div>
                    <h2 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Access Denied</h2>
                    <p style={{ color: '#7f1d1d' }}>
                        Integrity Checker is only available to Barangay Officials and Administrators.
                    </p>
                    <p style={{ color: '#991b1b', fontSize: '0.875rem', marginTop: '1rem' }}>
                        Your role: <strong>{user?.role || 'Unknown'}</strong>
                    </p>
                </div>
            </div>
        );
    }

    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState(null);
    const [approvingId, setApprovingId] = useState(null);
    const [selectedTx, setSelectedTx] = useState(null);
    const [actionMessage, setActionMessage] = useState('');
    const [error, setError] = useState(null);
    const [tablePage, setTablePage] = useState(1);
    const [detailsPage, setDetailsPage] = useState(1);
    const TABLE_PAGE_SIZE = 10;
    const DETAILS_PAGE_SIZE = 5;
    const TOAST_DURATION = 4000;
    const ML_REASON_REGEX = /ml|ai summary|hybrid/i;
    const classifyReason = (reason) => {
        const raw = String(reason || '').trim();
        const lower = raw.toLowerCase();
        if (lower.startsWith('ai summary:') || lower.startsWith('summary:')) {
            return { label: 'Summary', text: raw.replace(/^ai summary:\s*/i, '').replace(/^summary:\s*/i, '') };
        }
        if (lower.includes('ml') || lower.includes('hybrid')) {
            return { label: 'ML', text: raw.replace(/^ml\s*/i, '').replace(/^ml\s*hybrid\s*/i, '') };
        }
        return { label: 'Signal', text: raw };
    };
    const shouldShowInBulletin = (reason) => {
        const lower = String(reason || '').trim().toLowerCase();
        if (lower.startsWith('ai summary:') || lower.startsWith('summary:')) return false;
        if (lower.startsWith('ml hybrid assessment')) return false;
        return true;
    };

    // Manual Entry State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [manualRows, setManualRows] = useState([{
        date: new Date().toISOString().split('T')[0],
        agency: '',
        programName: '',
        payerName: '',
        payeeName: '',
        debitAmount: '0',
        creditAmount: '0',
        description: ''
    }]);
    const [currentRowIndex, setCurrentRowIndex] = useState(0);
    const [modalError, setModalError] = useState(null);
    useLockBodyScroll(isModalOpen || Boolean(selectedTx));

    const RESULTS_CACHE_KEY = 'integrity_checker_results_v1';

    // Load cached results on mount to survive refresh
    React.useEffect(() => {
        try {
            const cached = localStorage.getItem(RESULTS_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                setResults(parsed);
            }
        } catch (e) {
            console.warn('Failed to load cached results', e);
        }
    }, []);

    // Persist results whenever they change
    React.useEffect(() => {
        try {
            if (results && results.results && results.results.length > 0) {
                localStorage.setItem(RESULTS_CACHE_KEY, JSON.stringify(results));
            } else {
                localStorage.removeItem(RESULTS_CACHE_KEY);
            }
        } catch (e) {
            console.warn('Failed to cache results', e);
        }
    }, [results]);

    // Auto-hide toast after a short duration
    React.useEffect(() => {
        if (!actionMessage) return;
        const timer = setTimeout(() => setActionMessage(''), TOAST_DURATION);
        return () => clearTimeout(timer);
    }, [actionMessage]);

    const formatCsvError = (err, fallbackTitle) => {
        if (!err) return null;
        if (typeof err === 'string') {
            return { title: fallbackTitle || 'Error', message: err };
        }

        const data = err.response?.data || {};
        const message = data.message || data.error || err.message || 'Something went wrong.';

        return {
            title: fallbackTitle || 'Error',
            message,
            missingColumns: Array.isArray(data.missingColumns) ? data.missingColumns : null,
            detectedColumns: Array.isArray(data.detectedColumns) ? data.detectedColumns : null,
            mappingConfidence: typeof data.mappingConfidence === 'number' ? data.mappingConfidence : null
        };
    };

    const handleClearResults = () => {
        setResults(null);
        setSelectedTx(null);
        setTablePage(1);
        setDetailsPage(1);
        setActionMessage('');
        setError(null);
        try {
            localStorage.removeItem(RESULTS_CACHE_KEY);
        } catch (e) {
            console.warn('Failed to clear cached results', e);
        }
    };

    const hasMissingColumns =
        typeof error !== 'string' &&
        error &&
        Array.isArray(error.missingColumns) &&
        error.missingColumns.length > 0;
    const fallbackMissingColumns = [
        'agency',
        'program_name',
        'amount (or debit_amount / credit_amount)'
    ];
    const shouldShowMissingFallback =
        typeof error === 'string' &&
        error.toLowerCase().includes('missing required column');

    const handleApprove = async (tx) => {
        setApprovingId(tx.transactionId);
        try {
            await api.put(`/transactions/${tx.transactionId}/approve`);
            setResults(prev => ({
                ...prev,
                results: prev.results.filter(r => r.transactionId !== tx.transactionId)
            }));
            setSelectedTx(null);
            try { localStorage.setItem('tx_refresh', String(Date.now())); } catch (e) {}
            setActionMessage(`Approved ${tx.transactionId} successfully.`);
        } catch (err) {
            alert('Approve failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setApprovingId(null);
        }
    };

    const handleFlag = async (tx) => {
        setApprovingId(tx.transactionId);
        try {
            await api.put(`/transactions/${tx.transactionId}/verify`, { status: 'Flagged' });
            setResults(prev => ({
                ...prev,
                results: prev.results.filter(r => r.transactionId !== tx.transactionId)
            }));
            setSelectedTx(null);
            try { localStorage.setItem('tx_refresh', String(Date.now())); } catch (e) {}
            setActionMessage(`Flagged ${tx.transactionId} for manual review.`);
        } catch (err) {
            alert('Flag failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setApprovingId(null);
        }
    };

    const handleDeny = async (tx) => {
        setApprovingId(tx.transactionId);
        try {
            await api.delete(`/transactions/${tx.transactionId}`);
            setResults(prev => ({
                ...prev,
                results: prev.results.filter(r => r.transactionId !== tx.transactionId)
            }));
            setSelectedTx(null);
            try { localStorage.setItem('tx_refresh', String(Date.now())); } catch (e) {}
            setActionMessage(`Denied and removed ${tx.transactionId}.`);
        } catch (err) {
            alert('Deny failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setApprovingId(null);
        }
    };

    const formatCurrencyDisplay = (value) => {
        if (!value && value !== 0) return '';
        const number = parseFloat(value);
        if (isNaN(number)) return value;
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2
        }).format(number);
    };

    const getRiskCategory = (result) => {
        if (result.anomalyCategory && result.anomalyCategory !== 'Other') return result.anomalyCategory;
        if (result.riskCategory && result.riskCategory !== 'Other') return result.riskCategory;

        const patternText = Array.isArray(result.anomalyPatterns)
            ? result.anomalyPatterns.map((pattern) => String(pattern.type || pattern)).join(' ').toLowerCase()
            : '';
        const reasonText = Array.isArray(result.reasons) ? result.reasons.join(' ').toLowerCase() : '';
        const combined = `${reasonText} ${patternText}`;

        if (combined.includes('welfare') || result.transactionType === 'Social Welfare') return 'Welfare Anomaly';
        if (combined.includes('procurement') || result.transactionType === 'Procurement') return 'Procurement Anomaly';
        if (combined.includes('tax') || result.transactionType === 'Tax') return 'Tax Anomaly';
        if (combined.includes('rapid sequential') || combined.includes('circular movement') || combined.includes('collusion')) {
            return 'Network Pattern Anomaly';
        }
        if (combined.includes('unusual amount') || combined.includes('amount')) return 'Amount Anomaly';
        if (combined.includes('timing') || combined.includes('unusual transaction time')) return 'Timing Anomaly';

        return '-';
    };

    const handleAddManualRow = () => {
        setManualRows([...manualRows, {
            date: new Date().toISOString().split('T')[0],
            agency: '',
            programName: '',
            payerName: '',
            payeeName: '',
            debitAmount: '0',
            creditAmount: '0',
            description: ''
        }]);
        setCurrentRowIndex(manualRows.length);
    };

    const handleRemoveManualRow = (index) => {
        const newRows = manualRows.filter((_, i) => i !== index);
        setManualRows(newRows);
        if (currentRowIndex >= newRows.length) {
            setCurrentRowIndex(Math.max(0, newRows.length - 1));
        }
    };

    const handleManualFieldChange = (field, value) => {
        setModalError(null);
        setError(null);
        const newRows = [...manualRows];
        newRows[currentRowIndex][field] = value;
        setManualRows(newRows);
    };

    const validateManualRow = (row, index) => {
        if (!row.date) return `Row ${index + 1}: Date is required.`;
        if (!row.agency?.trim()) return `Row ${index + 1}: Agency is required.`;
        if (row.agency.length > 120) return `Row ${index + 1}: Agency is too long (max 120).`;
        if (!row.programName?.trim()) return `Row ${index + 1}: Program Name is required.`;
        if (row.programName.length > 120) return `Row ${index + 1}: Program Name is too long (max 120).`;
        if (!row.payerName?.trim()) return `Row ${index + 1}: Payer Name is required.`;
        if (row.payerName.length > 100) return `Row ${index + 1}: Payer Name is too long (max 100).`;
        if (!row.payeeName?.trim()) return `Row ${index + 1}: Payee Name is required.`;
        if (row.payeeName.length > 100) return `Row ${index + 1}: Payee Name is too long (max 100).`;
        if (!row.description?.trim()) return `Row ${index + 1}: Description is required.`;
        if (row.description.length > 500) return `Row ${index + 1}: Description is too long (max 500).`;

        const debit = parseFloat(row.debitAmount?.toString().replace(/,/g, ''));
        const credit = parseFloat(row.creditAmount?.toString().replace(/,/g, ''));
        if (isNaN(debit) || debit < 0) return `Row ${index + 1}: Invalid Debit amount.`;
        if (isNaN(credit) || credit < 0) return `Row ${index + 1}: Invalid Credit amount.`;

        const specialChars = /[<>{}[\]\\]/;
        if (specialChars.test(row.agency) || specialChars.test(row.programName) || specialChars.test(row.payerName) || specialChars.test(row.payeeName) || specialChars.test(row.description)) {
            return `Row ${index + 1}: Special characters like < > { } [ ] are not allowed.`;
        }

        return null;
    };

    const handleAnalyzeManual = async () => {
        setModalError(null);

        // Comprehensive Validation
        for (let i = 0; i < manualRows.length; i++) {
            const errorMsg = validateManualRow(manualRows[i], i);
            if (errorMsg) {
                setModalError(errorMsg);
                return;
            }
        }

        setUploading(true);
        setError(null);
        setResults(null);

        try {
            // Convert manual rows to CSV format
            const headers = ['Date', 'Agency', 'Program Name', 'Payer Name', 'Payee Name', 'Debit Amount', 'Credit Amount', 'Description'];
            const csvContent = [
                headers.join(','),
                ...manualRows.map(row => [
                    `"${row.date || ''}"`,
                    `"${row.agency || ''}"`,
                    `"${row.programName || ''}"`,
                    `"${row.payerName || ''}"`,
                    `"${row.payeeName || ''}"`,
                    row.debitAmount?.toString().replace(/,/g, '') || '0',
                    row.creditAmount?.toString().replace(/,/g, '') || '0',
                    `"${row.description || ''}"`
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'manual_entry.csv', { type: 'text/csv' });

            const formData = new FormData();
            formData.append('csvFile', file);

            const response = await api.post('/transactions/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResults(response.data);
            setIsModalOpen(false);
            try { localStorage.setItem('tx_refresh', String(Date.now())); } catch (e) {}

            // Clear all manual entry form data after successful analysis
            setManualRows([{
                date: new Date().toISOString().split('T')[0],
                agency: '',
                programName: '',
                payerName: '',
                payeeName: '',
                debitAmount: '0',
                creditAmount: '0',
                description: ''
            }]);
            setCurrentRowIndex(0);
            setModalError(null);
        } catch (err) {
            setError(formatCsvError(err, 'Analysis failed'));
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.name.endsWith('.csv')) {
            setFile(selectedFile);
            setError(null);
        } else {
            setFile(null);
            setError(formatCsvError('Please select a valid CSV file', 'Upload failed'));
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/transactions/template', {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(response.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'transaction_import_template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError(formatCsvError(err, 'Template download failed'));
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setUploading(true);
        setError(null);
        setResults(null);
        setTablePage(1);
        setDetailsPage(1);

        try {
            const formData = new FormData();
            formData.append('csvFile', file);

            const response = await api.post('/transactions/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResults(response.data);
            setFile(null);
            try { localStorage.setItem('tx_refresh', String(Date.now())); } catch (e) {}
            // Reset file input
            document.getElementById('csvFileInput').value = '';
        } catch (err) {
            setError(formatCsvError(err, 'Upload failed'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="csv-import-container">
            {actionMessage && (
                <div className="toast toast-floating success">
                    <CheckCircle size={18} style={{ marginRight: '6px' }} /> {actionMessage}
                </div>
            )}
            <div className="page-hero integrity-checker-hero">
                <span className="hero-tag">INTEGRITY CHECKER</span>
                <h2 className="hero-title">Transaction Integrity Verification</h2>
                <p className="hero-subtitle">Perform bulk transaction analysis or manual verification with AI-powered risk assessment.</p>

                <div className="hero-features-grid">
                    <div className="hero-feature-card">
                        <div className="feature-icon"><CheckCircle size={20} color="#34d399" /></div>
                        <div className="feature-text">
                            <strong>No Template Needed</strong>
                            <p>Upload ANY budget CSV</p>
                        </div>
                    </div>
                    <div className="hero-feature-card">
                        <div className="feature-icon"><Settings size={20} color="#818cf8" /></div>
                        <div className="feature-text">
                            <strong>Smart Detection</strong>
                            <p>Auto-maps columns</p>
                        </div>
                    </div>
                    <div className="hero-feature-card">
                        <div className="feature-icon"><Shield size={20} color="#fbbf24" /></div>
                        <div className="feature-text">
                            <strong>Risk Analysis</strong>
                            <p>Detects anomalies instantly</p>
                        </div>
                    </div>
                    <div className="hero-feature-card">
                        <div className="feature-icon"><BarChart size={20} color="#60a5fa" /></div>
                        <div className="feature-text">
                            <strong>Verified</strong>
                            <p>Checks PhilGEPS & PSA</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="csv-content">
                <div className="csv-upload-section">
                    <div className="file-input-wrapper">
                        <input
                            id="csvFileInput"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                        <div className="file-input-content">
                            <Upload size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                            <span className="file-name">{file ? file.name : 'Click to upload or drag and drop CSV'}</span>
                            <span className="file-limit">Maximum file size: 10MB</span>

                            <div className="template-download-container">
                                <span className="separator">or</span>
                                <button
                                    className="btn-link-template"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation(); // Prevent opening file dialog
                                        handleDownloadTemplate();
                                    }}
                                    type="button"
                                >
                                    <Download size={16} />
                                    <span>Download Sample Template</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="upload-actions-footer">
                        <button
                            className="btn-upload"
                            onClick={handleUpload}
                            disabled={!file || uploading}
                        >
                            {uploading ? (
                                <><Clock size={20} style={{ marginRight: '8px' }} /> Analyzing Transactions...</>
                            ) : (
                                <><Upload size={20} style={{ marginRight: '8px' }} /> Upload & Analyze</>
                            )}
                        </button>

                        <div className="action-divider">or</div>

                        <button
                            className="btn-manual"
                            onClick={() => setIsModalOpen(true)}
                            disabled={uploading}
                        >
                            <Plus size={20} style={{ marginRight: '8px' }} /> Manual Entry
                        </button>
                    </div>
                </div>

                {uploading && (
                    <div className="analyzing-state">
                        <Loader2 className="animate-spin" size={48} />
                        <h3>Integrity checking in progress...</h3>
                        <p>Our AI is analyzing patterns and blockchain signatures</p>
                    </div>
                )}

                {isModalOpen && (
                    <div className="integrity-modal-overlay">
                        <div className="integrity-modal">
                            <div className="modal-header">
                                <div className="modal-title-group">
                                    <h3>Manual Transaction Entry</h3>
                                    <span className="row-counter">Row {currentRowIndex + 1} of {manualRows.length}</span>
                                </div>
                                <button className="close-modal" onClick={() => { setIsModalOpen(false); setModalError(null); }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="modal-body">
                                {modalError && (
                                    <div className="modal-inner-error">
                                        <AlertCircle size={18} />
                                        <span>{modalError}</span>
                                    </div>
                                )}

                                <div className="form-grid">
                                    <div className="form-group date-col">
                                        <label>Date</label>
                                        <input
                                            type="date"
                                            value={manualRows[currentRowIndex].date}
                                            onChange={(e) => handleManualFieldChange('date', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Agency
                                            <span className={`char-count ${manualRows[currentRowIndex].agency.length > 120 ? 'limit' : ''}`}>
                                                {manualRows[currentRowIndex].agency.length}/120
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Barangay Pantal"
                                            value={manualRows[currentRowIndex].agency}
                                            onChange={(e) => handleManualFieldChange('agency', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Program Name
                                            <span className={`char-count ${manualRows[currentRowIndex].programName.length > 120 ? 'limit' : ''}`}>
                                                {manualRows[currentRowIndex].programName.length}/120
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Office Supplies"
                                            value={manualRows[currentRowIndex].programName}
                                            onChange={(e) => handleManualFieldChange('programName', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Payer Name
                                            <span className={`char-count ${manualRows[currentRowIndex].payerName.length > 100 ? 'limit' : ''}`}>
                                                {manualRows[currentRowIndex].payerName.length}/100
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Barangay Pantal"
                                            value={manualRows[currentRowIndex].payerName}
                                            onChange={(e) => handleManualFieldChange('payerName', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Payee Name
                                            <span className={`char-count ${manualRows[currentRowIndex].payeeName.length > 100 ? 'limit' : ''}`}>
                                                {manualRows[currentRowIndex].payeeName.length}/100
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Supplier Name"
                                            value={manualRows[currentRowIndex].payeeName}
                                            onChange={(e) => handleManualFieldChange('payeeName', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Debit Amount (Payment Out)</label>
                                        <div className="currency-input-wrapper">
                                            <span className="currency-symbol">PHP</span>
                                            <input
                                                type="text"
                                                placeholder="0.00"
                                                value={manualRows[currentRowIndex].debitAmount}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                    handleManualFieldChange('debitAmount', val);
                                                }}
                                                onBlur={(e) => {
                                                    const numericVal = parseFloat(e.target.value.replace(/,/g, ''));
                                                    if (!isNaN(numericVal)) {
                                                        const formatted = new Intl.NumberFormat('en-PH', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        }).format(numericVal);
                                                        handleManualFieldChange('debitAmount', formatted);
                                                    }
                                                }}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Credit Amount (Funds In)</label>
                                        <div className="currency-input-wrapper">
                                            <span className="currency-symbol">PHP</span>
                                            <input
                                                type="text"
                                                placeholder="0.00"
                                                value={manualRows[currentRowIndex].creditAmount}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                    handleManualFieldChange('creditAmount', val);
                                                }}
                                                onBlur={(e) => {
                                                    const numericVal = parseFloat(e.target.value.replace(/,/g, ''));
                                                    if (!isNaN(numericVal)) {
                                                        const formatted = new Intl.NumberFormat('en-PH', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        }).format(numericVal);
                                                        handleManualFieldChange('creditAmount', formatted);
                                                    }
                                                }}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group full-width">
                                        <label>
                                            Description
                                            <span className={`char-count ${manualRows[currentRowIndex].description.length > 500 ? 'limit' : ''}`}>
                                                {manualRows[currentRowIndex].description.length}/500
                                            </span>
                                        </label>
                                        <textarea
                                            placeholder="Enter transaction details..."
                                            value={manualRows[currentRowIndex].description}
                                            onChange={(e) => handleManualFieldChange('description', e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {manualRows.length >= 2 && (
                                    <div className="modal-pagination">
                                        <button
                                            className="btn-nav"
                                            onClick={() => setCurrentRowIndex(currentRowIndex - 1)}
                                            disabled={currentRowIndex === 0}
                                            type="button"
                                        >
                                            <ChevronLeft size={16} /> Previous
                                        </button>

                                        <div className="nav-indicators">
                                            {manualRows.map((_, idx) => (
                                                <span
                                                    key={idx}
                                                    className={`nav-dot ${currentRowIndex === idx ? 'active' : ''}`}
                                                    onClick={() => setCurrentRowIndex(idx)}
                                                ></span>
                                            ))}
                                        </div>

                                        <button
                                            className="btn-nav"
                                            onClick={() => setCurrentRowIndex(currentRowIndex + 1)}
                                            disabled={currentRowIndex === manualRows.length - 1}
                                            type="button"
                                        >
                                            Next <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <div className="footer-left">
                                    <button className="btn-add-row" onClick={handleAddManualRow} type="button">
                                        <Plus size={16} /> Add another row
                                    </button>
                                    {manualRows.length > 1 && (
                                        <button className="btn-remove-row" onClick={() => handleRemoveManualRow(currentRowIndex)} type="button">
                                            <Trash2 size={16} /> Remove row
                                        </button>
                                    )}
                                </div>
                                <div className="footer-right">
                                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)} type="button">Cancel</button>
                                    <button className="btn-analyze" onClick={handleAnalyzeManual} type="button">
                                        <Zap size={18} /> Analyze
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="alert alert-error">
                        <span className="alert-icon"><AlertCircle size={20} /></span>
                        <div className="alert-content">
                            <div className="alert-title">{typeof error === 'string' ? 'Error' : error.title}</div>
                            <div className="alert-message">
                                {typeof error === 'string' ? error : error.message}
                            </div>
                            {typeof error !== 'string' && error.missingColumns && (
                                <div className="alert-section">
                                    <div className="alert-section-title">Missing columns</div>
                                    <div className="alert-pill-row">
                                        {error.missingColumns.map((col) => (
                                            <span key={col} className="alert-pill">{col}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {shouldShowMissingFallback && (
                                <div className="alert-section">
                                    <div className="alert-section-title">Missing columns</div>
                                    <div className="alert-pill-row">
                                        {fallbackMissingColumns.map((col) => (
                                            <span key={col} className="alert-pill">{col}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {typeof error !== 'string' && error.detectedColumns && (
                                <div className="alert-section">
                                    <div className="alert-section-title">Detected columns</div>
                                    <div className="alert-pill-row">
                                        {error.detectedColumns.slice(0, 20).map((col) => (
                                            <span key={col} className="alert-pill alert-pill-muted">{col}</span>
                                        ))}
                                    </div>
                                    {error.detectedColumns.length > 20 && (
                                        <div className="alert-meta">Showing first 20 columns.</div>
                                    )}
                                </div>
                            )}
                            {typeof error !== 'string' && typeof error.mappingConfidence === 'number' && (
                                <div className="alert-meta">
                                    Column detection confidence: <strong>{error.mappingConfidence}%</strong>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {results && (
                    <div className="results-container animate-fade-in">
                        <div className="results-header">
                            <div className="results-header-main">
                                <h3><CheckCircle size={24} className="success-icon" /> Integrity Check Complete</h3>
                                <p>{results.message || 'AI analysis done. All rows are now pending official verification before blockchain/DB write.'}</p>
                                {results.mappingConfidence && (
                                    <p className="mapping-confidence">
                                        <BarChart size={16} className="mapping-icon" /> Column Detection Confidence: <strong>{results.mappingConfidence}%</strong>
                                    </p>
                                )}
                            </div>
                            <div className="results-header-actions">
                                <button type="button" className="btn-clear-results" onClick={handleClearResults}>
                                    Clear Results
                                </button>
                            </div>
                        </div>

                        <div className="results-stats">
                            <div className="stat-card success">
                                <div className="stat-value">{results.imported}</div>
                                <div className="stat-label">Successfully Checked</div>
                            </div>
                            {results.flaggedCount > 0 && (
                                <div className="stat-card danger">
                                    <div className="stat-value">{results.flaggedCount}</div>
                                    <div className="stat-label"><AlertTriangle size={18} style={{ marginRight: '4px' }} /> Flagged for Review</div>
                                </div>
                            )}
                            {results.highRiskCount > 0 && (
                                <div className="stat-card warning">
                                    <div className="stat-value">{results.highRiskCount}</div>
                                    <div className="stat-label"><AlertTriangle size={18} style={{ marginRight: '4px' }} /> High Risk</div>
                                </div>
                            )}
                            {results.failed > 0 && (
                                <div className="stat-card error">
                                    <div className="stat-value">{results.failed}</div>
                                    <div className="stat-label">Failed</div>
                                </div>
                            )}
                            {results.blockchainVerified > 0 && (
                                <div className="stat-card verified">
                                    <div className="stat-value">{results.blockchainVerified}</div>
                                    <div className="stat-label">
                                        <Shield size={18} className="stat-icon-shield" /> Verified on Blockchain
                                    </div>
                                </div>
                            )}
                        </div>

                        {results.columnMappings && (
                            <div className="column-mappings">
                                <div className="section-title-row">
                                    <h4><Clipboard size={18} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> Detected Column Mappings</h4>
                                    <span className="section-count">{Object.keys(results.columnMappings).length} fields mapped</span>
                                </div>
                                <div className="mappings-table-wrapper">
                                    <table className="mappings-table">
                                        <thead>
                                            <tr>
                                                <th>Field</th>
                                                <th>Detected Column</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(results.columnMappings).map(([field, column]) => (
                                                <tr key={field}>
                                                    <td><code>{field}</code></td>
                                                    <td>
                                                        <span className="mapping-arrow">-&gt;</span>
                                                        <span className="column-name">{column || '-'}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {results.results && results.results.length > 0 && (() => {
                            const totalTablePages = Math.ceil(results.results.length / TABLE_PAGE_SIZE);
                            const tableStart = (tablePage - 1) * TABLE_PAGE_SIZE;
                            const tableSlice = results.results.slice(tableStart, tableStart + TABLE_PAGE_SIZE);
                            return (
                                <div className="results-table-container">
                                    <div className="table-header-row">
                                        <h4>Checked Transactions with Risk Assessment</h4>
                                        <span className="table-range-text">
                                            Showing {tableStart + 1}-{Math.min(tableStart + TABLE_PAGE_SIZE, results.results.length)} of {results.results.length}
                                        </span>
                                    </div>
                                    <table className="results-table">
                                        <thead>
                                            <tr>
                                                <th>Row</th>
                                                <th>Transaction ID</th>
                                                <th>Type</th>
                                                <th>Amount</th>
                                                <th>From</th>
                                                <th>To</th>
                                                <th>Risk Score</th>
                                                <th>Risk Level</th>
                                                <th>Risk Category</th>
                                                <th>Blockchain Hash</th>
                                                <th>Status</th>
                                                <th className="actions-col">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableSlice.map((result, idx) => (
                                                <tr
                                                    key={idx}
                                                    className={`result-row ${result.flagged ? 'flagged-row' : ''}`}
                                                    style={{ animationDelay: `${idx * 0.05}s` }}
                                                    onClick={() => setSelectedTx(result)}
                                                >
                                                    <td data-label="Row">{result.row}</td>
                                                    <td data-label="Transaction ID" className="transaction-id">{result.transactionId}</td>
                                                    <td data-label="Type">{result.transactionType}</td>
                                                    <td data-label="Amount" className="amount">{formatCurrencyDisplay(result.amount)}</td>
                                                    <td data-label="From">{formatAddressLabel(result.fromAddress) || '-'}</td>
                                                    <td data-label="To">{formatAddressLabel(result.toAddress) || '-'}</td>
                                                    <td data-label="Risk Score">
                                                        <span className={`risk-score risk-${result.riskLevel?.toLowerCase()}`}>
                                                            {result.riskScore}
                                                        </span>
                                                    </td>
                                                    <td data-label="Risk Level">
                                                        <span className={`badge badge-${result.riskLevel?.toLowerCase()}`}>
                                                            {result.riskLevel}
                                                        </span>
                                                    </td>
                                                    <td data-label="Risk Category">
                                                        {getRiskCategory(result) !== '-' ? (
                                                            <span className="anomaly-type">{getRiskCategory(result)}</span>
                                                        ) : (
                                                            <span className="no-anomaly">-</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Blockchain Hash" className="blockchain-cell">
                                                        {result.blockchainTxId ? (
                                                            <div className="blockchain-hash-wrapper">
                                                                <span className="blockchain-hash-text" title={result.blockchainTxId}>
                                                                    <Link size={12} className="link-icon" /> ...
                                                                </span>
                                                                <button
                                                                    className="btn-copy-hash"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(result.blockchainTxId);
                                                                        alert('Blockchain hash copied to clipboard!');
                                                                    }}
                                                                    title="Copy blockchain hash"
                                                                >
                                                                    <Clipboard size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="not-recorded">Not recorded</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Status">
                                                        {result.flagged ? (
                                                            <span className="badge badge-danger"><AlertTriangle size={14} className="badge-icon" /> FLAGGED</span>
                                                        ) : (
                                                            <span className="badge badge-success"><CheckCircle size={14} className="badge-icon" /> Clean</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Actions" className="actions-cell">
                                                        <div className="actions-buttons">
                                                            <button type="button" className="btn-review" onClick={() => setSelectedTx(result)}>Review</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {totalTablePages > 1 && (
                                        <div style={{
                                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                                            gap: '0.5rem', padding: '1rem 0', marginTop: '0.5rem'
                                        }}>
                                            <button
                                                onClick={() => setTablePage(p => Math.max(1, p - 1))}
                                                disabled={tablePage === 1}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                    padding: '0.4rem 0.75rem', borderRadius: '8px',
                                                    border: '1px solid #e2e8f0', background: tablePage === 1 ? '#f8fafc' : 'white',
                                                    cursor: tablePage === 1 ? 'not-allowed' : 'pointer',
                                                    color: tablePage === 1 ? '#94a3b8' : '#334155',
                                                    fontSize: '0.85rem', fontWeight: '500'
                                                }}
                                            >
                                                <ChevronLeft size={16} /> Prev
                                            </button>
                                            {Array.from({ length: totalTablePages }, (_, i) => i + 1)
                                                .filter(p => p === 1 || p === totalTablePages || Math.abs(p - tablePage) <= 1)
                                                .reduce((acc, p, i, arr) => {
                                                    if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                                    acc.push(p);
                                                    return acc;
                                                }, [])
                                                .map((p, i) => p === '...' ? (
                                                    <span key={`dots-${i}`} style={{ color: '#94a3b8', padding: '0 0.25rem' }}>...</span>
                                                ) : (
                                                    <button key={p} onClick={() => setTablePage(p)} style={{
                                                        width: '2rem', height: '2rem', borderRadius: '8px',
                                                        border: tablePage === p ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                                        background: tablePage === p ? '#6366f1' : 'white',
                                                        color: tablePage === p ? 'white' : '#334155',
                                                        cursor: 'pointer', fontWeight: tablePage === p ? '700' : '500',
                                                        fontSize: '0.85rem'
                                                    }}>{p}</button>
                                                ))
                                            }
                                            <button
                                                onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
                                                disabled={tablePage === totalTablePages}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                    padding: '0.4rem 0.75rem', borderRadius: '8px',
                                                    border: '1px solid #e2e8f0', background: tablePage === totalTablePages ? '#f8fafc' : 'white',
                                                    cursor: tablePage === totalTablePages ? 'not-allowed' : 'pointer',
                                                    color: tablePage === totalTablePages ? '#94a3b8' : '#334155',
                                                    fontSize: '0.85rem', fontWeight: '500'
                                                }}
                                            >
                                                Next <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {results.errors && results.errors.length > 0 && (
                            <div className="errors-container">
                                <div className="section-title-row errors-head">
                                    <h4><AlertTriangle size={18} style={{ marginRight: '6px', color: '#ef4444' }} /> Errors ({results.errors.length})</h4>
                                    <span className="section-count">Review and fix invalid rows before re-uploading.</span>
                                </div>
                                <div className="errors-table-wrapper">
                                    <table className="errors-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Row</th>
                                                <th>Error Message</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.errors.map((err, idx) => (
                                                <tr key={idx}>
                                                    <td>{idx + 1}</td>
                                                    <td><span className="error-row-badge">Row {err.row}</span></td>
                                                    <td>{err.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {selectedTx && (
                    <div className="tx-modal-overlay">
                        <div className="tx-modal">
                            <div className="tx-modal-header">
                                <h3>Review Transaction</h3>
                                <button className="close-btn" onClick={() => setSelectedTx(null)}>&times;</button>
                            </div>
                            <div className="tx-modal-body">
                                <div className="tx-grid">
                                    <div className="tx-grid-row">
                                        <div className="tx-grid-col">
                                            <label>ID</label>
                                            <div className="font-mono">{selectedTx.transactionId}</div>
                                        </div>
                                        <div className="tx-grid-col">
                                            <label>Type</label>
                                            <div>{selectedTx.transactionType}</div>
                                        </div>
                                    </div>
                                    <div className="tx-grid-row">
                                        <div className="tx-grid-col">
                                            <label>Amount</label>
                                            <div className="font-bold">{formatCurrencyDisplay(selectedTx.amount)}</div>
                                        </div>
                                        <div className="tx-grid-col">
                                            <label>Risk</label>
                                            <div>{selectedTx.riskScore} ({selectedTx.riskLevel})</div>
                                        </div>
                                    </div>
                                    <div className="tx-grid-row">
                                        <div className="tx-grid-col">
                                            <label>From</label>
                                            <div>{formatAddressLabel(selectedTx.fromAddress) || '-'}</div>
                                        </div>
                                        <div className="tx-grid-col">
                                            <label>To</label>
                                            <div>{formatAddressLabel(selectedTx.toAddress) || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="tx-grid-row">
                                        <div className="tx-grid-col">
                                            <label>AI Combined</label>
                                            <div>{selectedTx.mlUsed ? 'Yes' : 'No'}</div>
                                        </div>
                                        <div className="tx-grid-col">
                                            <label>ML Score</label>
                                            <div>{selectedTx.mlScore ?? '-'}</div>
                                        </div>
                                    </div>
                                    <div className="tx-grid-row">
                                        <div className="tx-grid-col">
                                            <label>Blockchain</label>
                                            <div>{selectedTx.blockchainTxId ? 'Recorded' : 'Not recorded'}</div>
                                        </div>
                                        <div className="tx-grid-col">
                                            <label>Status</label>
                                            <div>{selectedTx.flagged ? 'Flagged' : 'Clean'}</div>
                                        </div>
                                    </div>
                                    {selectedTx.reasons && selectedTx.reasons.length > 0 && (
                                        <div className="tx-grid-desc">
                                            <label>Reason Why</label>
                                            <ul>
                                                {selectedTx.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="tx-modal-footer">
                                <div className="tx-modal-actions">
                                    <button className="btn-verify" disabled={approvingId === selectedTx.transactionId} onClick={() => handleApprove(selectedTx)}>Approve</button>
                                    <button className="btn-flag" disabled={approvingId === selectedTx.transactionId} onClick={() => handleFlag(selectedTx)}>Flag</button>
                                    <button className="btn-flag" disabled={approvingId === selectedTx.transactionId} onClick={() => handleDeny(selectedTx)}>Deny</button>
                                </div>
                                <button className="btn-close" onClick={() => setSelectedTx(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="supported-columns-section" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white' }}>
                    <h4><FileText size={18} /> Supported Column Names (Auto-Detected)</h4>
                    {(hasMissingColumns || shouldShowMissingFallback) && (
                        <div className="missing-columns-banner">
                            <div className="missing-columns-title">Missing required columns</div>
                            <div className="missing-columns-row">
                                {(hasMissingColumns ? error.missingColumns : fallbackMissingColumns).map((col) => (
                                    <span key={col} className="missing-columns-pill">{col}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="supported-columns">
                        <div className="column-pill">
                            <strong>Amount:</strong> amount, total, cost, budget, halaga
                        </div>
                        <div className="column-pill">
                            <strong>Type:</strong> type, category, purpose, classification
                        </div>
                        <div className="column-pill">
                            <strong>Date:</strong> date, timestamp, transaction_date, petsa
                        </div>
                        <div className="column-pill">
                            <strong>Agency:</strong> agency, dept, office, barangay
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntegrityChecker;

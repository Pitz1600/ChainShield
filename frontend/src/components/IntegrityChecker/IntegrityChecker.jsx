import React, { useState } from 'react';
import { Lock, Upload, AlertCircle, CheckCircle, Clock, FileText, AlertTriangle, TrendingUp, Shield, BarChart, Info, Settings, Zap, Download, ChevronLeft, ChevronRight, Link, Clipboard, Circle, Plus, Trash2, X, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { isOfficial } from '../../utils/permissions';
import '../../styles/IntegrityChecker.css';

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

    // Manual Entry State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [manualRows, setManualRows] = useState([{
        date: new Date().toISOString().split('T')[0],
        payerName: '',
        payeeName: '',
        debitAmount: '0',
        creditAmount: '0',
        description: ''
    }]);
    const [currentRowIndex, setCurrentRowIndex] = useState(0);
    const [modalError, setModalError] = useState(null);

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

    const handleAddManualRow = () => {
        setManualRows([...manualRows, {
            date: new Date().toISOString().split('T')[0],
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
        if (specialChars.test(row.payerName) || specialChars.test(row.payeeName) || specialChars.test(row.description)) {
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
            const headers = ['Date', 'Payer Name', 'Payee Name', 'Debit Amount', 'Credit Amount', 'Description'];
            const csvContent = [
                headers.join(','),
                ...manualRows.map(row => [
                    `"${row.date || ''}"`,
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

            // Clear all manual entry form data after successful analysis
            setManualRows([{
                date: new Date().toISOString().split('T')[0],
                payerName: '',
                payeeName: '',
                debitAmount: '0',
                creditAmount: '0',
                description: ''
            }]);
            setCurrentRowIndex(0);
            setModalError(null);
        } catch (err) {
            setError('Analysis failed: ' + (err.response?.data?.error || err.message));
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
            setError('Please select a valid CSV file');
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
            setError('Failed to download template: ' + (err.response?.data?.error || err.message));
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
            // Reset file input
            document.getElementById('csvFileInput').value = '';
        } catch (err) {
            setError('Upload failed: ' + (err.response?.data?.error || err.message));
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
                                            <span className="currency-symbol">₱</span>
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
                                            <span className="currency-symbol">₱</span>
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
                        <span>{error}</span>
                    </div>
                )}

                {results && (
                    <div className="results-container animate-fade-in">
                        <div className="results-header">
                            <h3><CheckCircle size={24} className="success-icon" /> Integrity Check Complete</h3>
                            <p>{results.message || 'AI analysis done. All rows are now pending official verification before blockchain/DB write.'}</p>
                            {results.mappingConfidence && (
                                <p className="mapping-confidence">
                                    <BarChart size={16} className="mapping-icon" /> Column Detection Confidence: <strong>{results.mappingConfidence}%</strong>
                                </p>
                            )}
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
                                <h4><Clipboard size={18} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> Detected Column Mappings</h4>
                                <div className="mappings-grid">
                                    {Object.entries(results.columnMappings).map(([field, column]) => (
                                        <div key={field} className="mapping-item">
                                            <span className="field-name">{field}</span>
                                            <span className="arrow">→</span>
                                            <span className="column-name">{column}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.results && results.results.length > 0 && (() => {
                            const totalTablePages = Math.ceil(results.results.length / TABLE_PAGE_SIZE);
                            const tableStart = (tablePage - 1) * TABLE_PAGE_SIZE;
                            const tableSlice = results.results.slice(tableStart, tableStart + TABLE_PAGE_SIZE);
                            return (
                                <div className="results-table-container">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <h4 style={{ margin: 0 }}>Checked Transactions with Risk Assessment</h4>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            Showing {tableStart + 1}–{Math.min(tableStart + TABLE_PAGE_SIZE, results.results.length)} of {results.results.length}
                                        </span>
                                    </div>
                                    <table className="results-table">
                                        <thead>
                                            <tr>
                                                <th>Row</th>
                                                <th>Transaction ID</th>
                                                <th>Type</th>
                                                <th>Amount</th>
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
                                                    <td data-label="Amount" className="amount">₱{result.amount?.toLocaleString()}</td>
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
                                                        {result.anomalyCategory && result.anomalyCategory !== 'Other' ? (
                                                            <span className="anomaly-type">{result.anomalyCategory}</span>
                                                        ) : (
                                                            <span className="no-anomaly">-</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Blockchain Hash">
                                                        {result.blockchainTxId ? (
                                                            <div className="blockchain-hash-wrapper">
                                                                <span className="blockchain-hash-text" title={result.blockchainTxId}>
                                                                    <Link size={12} className="link-icon" /> {result.blockchainTxId.substring(0, 10)}...
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
                                                    <span key={`dots-${i}`} style={{ color: '#94a3b8', padding: '0 0.25rem' }}>…</span>
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

                        {results.results && results.results.some(r => r.reasons && r.reasons.length > 0) && (() => {
                            const detailResults = results.results.filter(r => r.reasons && r.reasons.length > 0);
                            const totalDetailPages = Math.ceil(detailResults.length / DETAILS_PAGE_SIZE);
                            const detailStart = (detailsPage - 1) * DETAILS_PAGE_SIZE;
                            const detailSlice = detailResults.slice(detailStart, detailStart + DETAILS_PAGE_SIZE);
                            return (
                                <div className="risk-details">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <h4 style={{ margin: 0 }}>🔍 Risk Detection Details</h4>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            Showing {detailStart + 1}–{Math.min(detailStart + DETAILS_PAGE_SIZE, detailResults.length)} of {detailResults.length}
                                        </span>
                                    </div>
                                    {detailSlice.map((result, idx) => (
                                        <div key={idx} className={`risk-detail-card risk-${result.riskLevel?.toLowerCase()}`} style={{ animationDelay: `${idx * 0.1}s` }}>
                                            <div className="risk-card-header">
                                                <div className="risk-card-title">
                                                    Row {result.row} — <span className="tx-id-highlight">{result.transactionId}</span>
                                                    {result.riskScore !== undefined && (
                                                        <span className="risk-score-text">
                                                            Score: {result.riskScore}/100
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`risk-card-badge risk-${result.riskLevel?.toLowerCase()}`}>
                                                    {result.riskLevel === 'CRITICAL' && <><Circle size={10} fill="currentColor" className="circle-icon" /> CRITICAL</>}
                                                    {result.riskLevel === 'HIGH' && <><Circle size={10} fill="currentColor" className="circle-icon" /> HIGH</>}
                                                    {result.riskLevel === 'MEDIUM' && <><Circle size={10} fill="currentColor" className="circle-icon" /> MEDIUM</>}
                                                    {result.riskLevel === 'LOW' && <><Circle size={10} fill="currentColor" className="circle-icon" /> LOW</>}
                                                    {!result.riskLevel && <><Circle size={10} className="circle-icon" /> N/A</>}
                                                </span>
                                            </div>
                                            <div className="risk-reasons-list">
                                                {result.reasons.map((reason, rIdx) => (
                                                    <div key={rIdx} className="risk-reason-item">
                                                        <span className="warning-emoji">⚠️</span>
                                                        {reason}
                                                    </div>
                                                ))}
                                            </div>
                                            {result.anomalyPatterns && result.anomalyPatterns.length > 0 && (
                                                <div className="anomaly-patterns-container">
                                                    <strong className="patterns-label">Patterns:</strong>
                                                    {result.anomalyPatterns.map((pattern, pIdx) => (
                                                        <span key={pIdx} className="pattern-pill">
                                                            {pattern.type || pattern}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {totalDetailPages > 1 && (
                                        <div style={{
                                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                                            gap: '0.5rem', padding: '1rem 0'
                                        }}>
                                            <button
                                                onClick={() => setDetailsPage(p => Math.max(1, p - 1))}
                                                disabled={detailsPage === 1}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                    padding: '0.4rem 0.75rem', borderRadius: '8px',
                                                    border: '1px solid #e2e8f0', background: detailsPage === 1 ? '#f8fafc' : 'white',
                                                    cursor: detailsPage === 1 ? 'not-allowed' : 'pointer',
                                                    color: detailsPage === 1 ? '#94a3b8' : '#334155',
                                                    fontSize: '0.85rem', fontWeight: '500'
                                                }}
                                            >
                                                <ChevronLeft size={16} /> Prev
                                            </button>
                                            {Array.from({ length: totalDetailPages }, (_, i) => i + 1)
                                                .filter(p => p === 1 || p === totalDetailPages || Math.abs(p - detailsPage) <= 1)
                                                .reduce((acc, p, i, arr) => {
                                                    if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                                    acc.push(p);
                                                    return acc;
                                                }, [])
                                                .map((p, i) => p === '...' ? (
                                                    <span key={`dots-${i}`} style={{ color: '#94a3b8', padding: '0 0.25rem' }}>…</span>
                                                ) : (
                                                    <button key={p} onClick={() => setDetailsPage(p)} style={{
                                                        width: '2rem', height: '2rem', borderRadius: '8px',
                                                        border: detailsPage === p ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                                        background: detailsPage === p ? '#6366f1' : 'white',
                                                        color: detailsPage === p ? 'white' : '#334155',
                                                        cursor: 'pointer', fontWeight: detailsPage === p ? '700' : '500',
                                                        fontSize: '0.85rem'
                                                    }}>{p}</button>
                                                ))
                                            }
                                            <button
                                                onClick={() => setDetailsPage(p => Math.min(totalDetailPages, p + 1))}
                                                disabled={detailsPage === totalDetailPages}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                    padding: '0.4rem 0.75rem', borderRadius: '8px',
                                                    border: '1px solid #e2e8f0', background: detailsPage === totalDetailPages ? '#f8fafc' : 'white',
                                                    cursor: detailsPage === totalDetailPages ? 'not-allowed' : 'pointer',
                                                    color: detailsPage === totalDetailPages ? '#94a3b8' : '#334155',
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
                                <h4><AlertTriangle size={20} style={{ display: 'inline', marginRight: '8px', color: '#ef4444' }} /> Errors ({results.errors.length})</h4>
                                <div className="errors-list">
                                    {results.errors.map((err, idx) => (
                                        <div key={idx} className="error-item">
                                            <strong>Row {err.row}:</strong> {err.error}
                                        </div>
                                    ))}
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
                                            <div className="font-bold">₱{selectedTx.amount?.toLocaleString()}</div>
                                        </div>
                                        <div className="tx-grid-col">
                                            <label>Risk</label>
                                            <div>{selectedTx.riskScore} ({selectedTx.riskLevel})</div>
                                        </div>
                                    </div>
                                    <div className="tx-grid-row">
                                        <div className="tx-grid-col">
                                            <label>From</label>
                                            <div>{selectedTx.fromAddress || '—'}</div>
                                        </div>
                                        <div className="tx-grid-col">
                                            <label>To</label>
                                            <div>{selectedTx.toAddress || '—'}</div>
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
                                            <label>Reasons</label>
                                            <ul>
                                                {selectedTx.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="tx-modal-footer">
                                <div className="tx-modal-actions">
                                    {user?.role === 'auditor' ? (
                                        <>
                                            <button className="btn-verify" disabled={approvingId === selectedTx.transactionId} onClick={() => handleApprove(selectedTx)}>Approve</button>
                                            <button className="btn-flag" disabled={approvingId === selectedTx.transactionId} onClick={() => handleFlag(selectedTx)}>Flag</button>
                                        </>
                                    ) : (
                                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Approval and flagging are restricted to Auditors.</div>
                                    )}
                                </div>
                                <button className="btn-close" onClick={() => setSelectedTx(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="supported-columns-section" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white' }}>
                    <h4><FileText size={18} /> Supported Column Names (Auto-Detected)</h4>
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

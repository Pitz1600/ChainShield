import React, { useState } from 'react';
import { Lock, Upload, AlertCircle, CheckCircle, Clock, FileText, AlertTriangle, TrendingUp, Shield, BarChart, Info, Settings, Zap, Download } from 'lucide-react';
import { isOfficial } from '../../utils/permissions';
import '../../styles/CSVImport.css';

const CSVImport = ({ user }) => {
    // Permission check - only officials and admins can import
    if (!isOfficial(user)) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><Lock size={48} color="#991b1b" /></div>
                    <h2 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Access Denied</h2>
                    <p style={{ color: '#7f1d1d' }}>
                        CSV Import is only available to Barangay Officials and Administrators.
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
    const [error, setError] = useState(null);

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
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Please login first');
                return;
            }

            const response = await fetch('http://localhost:5000/api/transactions/template', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to download template' }));
                setError(errorData.error || `Download failed: ${response.statusText}`);
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'transaction_import_template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError('Failed to download template: ' + err.message);
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

        try {
            const formData = new FormData();
            formData.append('csvFile', file);

            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/transactions/import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                setResults(data);
                setFile(null);
                // Reset file input
                document.getElementById('csvFileInput').value = '';
            } else {
                setError(data.error || 'Upload failed');
            }
        } catch (err) {
            setError('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="csv-import-container">
            <div className="page-hero csv-hero">
                <span className="hero-tag">CSV IMPORT</span>
                <h2 className="hero-title">Bulk Transaction Import</h2>
                <p className="hero-subtitle">Upload CSV files to import multiple transactions at once with automatic fraud detection and risk analysis.</p>

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
                            <p>Detects fraud instantly</p>
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
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error">
                        <span className="alert-icon"><AlertCircle size={20} /></span>
                        <span>{error}</span>
                    </div>
                )}

                {results && (
                    <div className="results-container">
                        <div className="results-header">
                            <h3><CheckCircle size={24} style={{ display: 'inline', marginRight: '8px', color: '#10b981' }} /> Import Complete with Risk Analysis</h3>
                            <p>{results.message}</p>
                            {results.mappingConfidence && (
                                <p className="mapping-confidence">
                                    📊 Column Detection Confidence: <strong>{results.mappingConfidence}%</strong>
                                </p>
                            )}
                        </div>

                        <div className="results-stats">
                            <div className="stat-card success">
                                <div className="stat-value">{results.imported}</div>
                                <div className="stat-label">Successfully Imported</div>
                            </div>
                            {results.flaggedCount > 0 && (
                                <div className="stat-card danger">
                                    <div className="stat-value">{results.flaggedCount}</div>
                                    <div className="stat-label">🚨 Flagged for Review</div>
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
                        </div>

                        {results.columnMappings && (
                            <div className="column-mappings">
                                <h4>📋 Detected Column Mappings</h4>
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

                        {results.results && results.results.length > 0 && (
                            <div className="results-table-container">
                                <h4>Imported Transactions with Risk Assessment</h4>
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
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.results.map((result, idx) => (
                                            <tr key={idx} className={result.flagged ? 'flagged-row' : ''}>
                                                <td>{result.row}</td>
                                                <td className="transaction-id">{result.transactionId}</td>
                                                <td>{result.transactionType}</td>
                                                <td className="amount">₱{result.amount?.toLocaleString()}</td>
                                                <td>
                                                    <span className={`risk-score risk-${result.riskLevel?.toLowerCase()}`}>
                                                        {result.riskScore}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${result.riskLevel?.toLowerCase()}`}>
                                                        {result.riskLevel}
                                                    </span>
                                                </td>
                                                <td>
                                                    {result.fraudType && result.fraudType !== 'Other' ? (
                                                        <span className="fraud-type">{result.fraudType}</span>
                                                    ) : (
                                                        <span className="no-fraud">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {result.flagged ? (
                                                        <span className="badge badge-danger">🚨 FLAGGED</span>
                                                    ) : (
                                                        <span className="badge badge-success"><CheckCircle size={14} style={{ marginRight: '4px' }} /> Clean</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {results.results && results.results.some(r => r.reasons && r.reasons.length > 0) && (
                            <div className="fraud-details">
                                <h4>🔍 Risk Detection Details</h4>
                                {results.results.filter(r => r.reasons && r.reasons.length > 0).map((result, idx) => (
                                    <div key={idx} className="fraud-detail-card">
                                        <div className="fraud-detail-header">
                                            <strong>Row {result.row}</strong> - {result.transactionId}
                                            <span className={`badge badge-${result.riskLevel?.toLowerCase()}`}>
                                                {result.riskLevel}
                                            </span>
                                        </div>
                                        <div className="fraud-reasons">
                                            {result.reasons.map((reason, rIdx) => (
                                                <div key={rIdx} className="reason-item">
                                                    • {reason}
                                                </div>
                                            ))}
                                        </div>
                                        {result.philippinePatterns && result.philippinePatterns.length > 0 && (
                                            <div className="ph-patterns">
                                                <strong>Philippine Patterns Detected:</strong>
                                                {result.philippinePatterns.map((pattern, pIdx) => (
                                                    <span key={pIdx} className="pattern-badge">
                                                        {pattern.type}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

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

export default CSVImport;

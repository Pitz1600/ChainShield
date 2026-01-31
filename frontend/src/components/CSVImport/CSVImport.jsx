import React, { useState } from 'react';
import { Lock, Upload, AlertCircle, CheckCircle, Clock, FileText, AlertTriangle, TrendingUp, Shield, BarChart, Info, Settings, Zap } from 'lucide-react';
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
                {/* Actions moved to main content */}
            </div>

            <div className="csv-content">
                <div className="csv-import-actions" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
                    <button
                        className="btn-download-template"
                        onClick={handleDownloadTemplate}
                        style={{
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            color: '#475569',
                            padding: '1rem 2rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            fontWeight: '600',
                            fontSize: '1rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FileText size={20} color="#3b82f6" />
                        <div>
                            <div style={{ textAlign: 'left', color: '#1e293b' }}>Download Sample Template</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'normal', textAlign: 'left' }}>Use this to format your CSV correctly</div>
                        </div>
                        <Download size={20} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                    </button>
                </div>

                <div className="csv-upload-section">
                    <div className="file-input-wrapper">
                        <input
                            id="csvFileInput"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                        <label htmlFor="csvFileInput" className="file-input-label">
                            {file ? file.name : 'Choose ANY CSV file...'}
                        </label>
                    </div>

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

                <div className="csv-import-info">
                    <h4><Info size={20} style={{ display: 'inline', marginRight: '8px', color: '#1d4ed8' }} /> How It Works</h4>
                    <ul>
                        <li><CheckCircle size={18} style={{ display: 'inline', marginRight: '8px', color: '#10b981' }} /> <strong>No Template Required!</strong> Upload ANY budget CSV file</li>
                        <li><Settings size={18} style={{ display: 'inline', marginRight: '8px', color: '#6366f1' }} /> <strong>Smart Column Detection:</strong> Auto-detects amount, date, description, etc.</li>
                        <li><Shield size={18} style={{ display: 'inline', marginRight: '8px', color: '#f59e0b' }} /> <strong>Risk Detection:</strong> Checks for overpricing, unusual patterns, circular transactions</li>
                        <li><BarChart size={18} style={{ display: 'inline', marginRight: '8px', color: '#3b82f6' }} /> <strong>Government Verification:</strong> Compares against PhilGEPS prices & PSA demographics</li>
                        <li><Zap size={18} style={{ display: 'inline', marginRight: '8px', color: '#8b5cf6' }} /> <strong>Instant Analysis:</strong> Each transaction analyzed in real-time</li>
                    </ul>

                    <h4><FileText size={20} style={{ display: 'inline', marginRight: '8px', color: '#64748b' }} /> Supported Column Names (Auto-Detected)</h4>
                    <div className="supported-columns">
                        <div><strong>Amount:</strong> amount, total, value, cost, budget, halaga</div>
                        <div><strong>Type:</strong> type, category, purpose, classification</div>
                        <div><strong>Date:</strong> date, timestamp, transaction_date, petsa</div>
                        <div><strong>Description:</strong> description, details, particulars, notes</div>
                        <div><strong>Agency:</strong> agency, department, office, ahensya</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CSVImport;

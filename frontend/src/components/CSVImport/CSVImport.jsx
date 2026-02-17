import React, { useState } from 'react';
import { Lock, Upload, AlertCircle, CheckCircle, Clock, FileText, AlertTriangle, TrendingUp, Shield, BarChart, Info, Settings, Zap, Download, ChevronLeft, ChevronRight, Link, Clipboard, Circle } from 'lucide-react';
import api from '../../services/api';
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
    const [tablePage, setTablePage] = useState(1);
    const [detailsPage, setDetailsPage] = useState(1);
    const TABLE_PAGE_SIZE = 10;
    const DETAILS_PAGE_SIZE = 5;

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
            <div className="page-hero csv-hero">
                <span className="hero-tag">CSV IMPORT</span>
                <h2 className="hero-title">Bulk Transaction Import</h2>
                <p className="hero-subtitle">Upload CSV files to import multiple transactions at once with automatic risk assessment and anomaly detection.</p>

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
                                    <BarChart size={16} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> Column Detection Confidence: <strong>{results.mappingConfidence}%</strong>
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
                                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: 'white' }}>
                                    <div className="stat-value">{results.blockchainVerified}</div>
                                    <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                        <Shield size={18} style={{ marginRight: '4px' }} /> Verified on Blockchain
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
                                        <h4 style={{ margin: 0 }}>Imported Transactions with Risk Assessment</h4>
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
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableSlice.map((result, idx) => (
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
                                                        {result.anomalyCategory && result.anomalyCategory !== 'Other' ? (
                                                            <span className="anomaly-type">{result.anomalyCategory}</span>
                                                        ) : (
                                                            <span className="no-anomaly">-</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {result.blockchainTxId ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#059669' }} title={result.blockchainTxId}>
                                                                    <Link size={12} style={{ marginRight: '4px' }} /> {result.blockchainTxId.substring(0, 10)}...
                                                                </span>
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(result.blockchainTxId);
                                                                        alert('Blockchain hash copied to clipboard!');
                                                                    }}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        padding: '0.25rem',
                                                                        fontSize: '0.875rem'
                                                                    }}
                                                                    title="Copy blockchain hash"
                                                                >
                                                                    <Clipboard size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Not recorded</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {result.flagged ? (
                                                            <span className="badge badge-danger"><AlertTriangle size={14} style={{ marginRight: '4px' }} /> FLAGGED</span>
                                                        ) : (
                                                            <span className="badge badge-success"><CheckCircle size={14} style={{ marginRight: '4px' }} /> Clean</span>
                                                        )}
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
                                        <div key={idx} className="risk-detail-card" style={{
                                            border: result.riskLevel === 'CRITICAL' ? '2px solid #ef4444' :
                                                result.riskLevel === 'HIGH' ? '2px solid #f97316' :
                                                    result.riskLevel === 'MEDIUM' ? '2px solid #eab308' :
                                                        '1px solid #e2e8f0',
                                            borderRadius: '12px',
                                            padding: '1rem 1.25rem',
                                            marginBottom: '0.75rem',
                                            background: result.riskLevel === 'CRITICAL' ? '#fef2f2' :
                                                result.riskLevel === 'HIGH' ? '#fff7ed' :
                                                    result.riskLevel === 'MEDIUM' ? '#fefce8' :
                                                        '#f8fafc'
                                        }}>
                                            <div className="risk-detail-header" style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '0.75rem'
                                            }}>
                                                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                                                    Row {result.row} — <span style={{ color: '#6366f1' }}>{result.transactionId}</span>
                                                    {result.riskScore !== undefined && (
                                                        <span style={{ marginLeft: '0.75rem', color: '#64748b', fontWeight: '400', fontSize: '0.85rem' }}>
                                                            Score: {result.riskScore}/100
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '999px',
                                                    fontWeight: '700',
                                                    fontSize: '0.75rem',
                                                    letterSpacing: '0.05em',
                                                    color: 'white',
                                                    background: result.riskLevel === 'CRITICAL' ? '#dc2626' :
                                                        result.riskLevel === 'HIGH' ? '#ea580c' :
                                                            result.riskLevel === 'MEDIUM' ? '#ca8a04' :
                                                                '#16a34a'
                                                }}>
                                                    {result.riskLevel === 'CRITICAL' && <><Circle size={10} fill="currentColor" style={{ marginRight: '4px' }} /> CRITICAL</>}
                                                    {result.riskLevel === 'HIGH' && <><Circle size={10} fill="currentColor" style={{ marginRight: '4px' }} /> HIGH</>}
                                                    {result.riskLevel === 'MEDIUM' && <><Circle size={10} fill="currentColor" style={{ marginRight: '4px' }} /> MEDIUM</>}
                                                    {result.riskLevel === 'LOW' && <><Circle size={10} fill="currentColor" style={{ marginRight: '4px' }} /> LOW</>}
                                                    {!result.riskLevel && <><Circle size={10} style={{ marginRight: '4px' }} /> N/A</>}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                {result.reasons.map((reason, rIdx) => (
                                                    <div key={rIdx} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        fontSize: '0.875rem',
                                                        color: '#334155',
                                                        padding: '0.25rem 0'
                                                    }}>
                                                        <span style={{ color: result.riskLevel === 'CRITICAL' || result.riskLevel === 'HIGH' ? '#ef4444' : '#f59e0b' }}>⚠️</span>
                                                        {reason}
                                                    </div>
                                                ))}
                                            </div>
                                            {result.anomalyPatterns && result.anomalyPatterns.length > 0 && (
                                                <div style={{
                                                    marginTop: '0.75rem',
                                                    paddingTop: '0.75rem',
                                                    borderTop: '1px solid rgba(0,0,0,0.08)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    <strong style={{ fontSize: '0.8rem', color: '#64748b' }}>Patterns:</strong>
                                                    {result.anomalyPatterns.map((pattern, pIdx) => (
                                                        <span key={pIdx} style={{
                                                            background: '#818cf8',
                                                            color: 'white',
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '999px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '500'
                                                        }}>
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

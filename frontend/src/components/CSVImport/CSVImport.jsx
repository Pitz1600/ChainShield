import React, { useState } from 'react';
import '../../styles/CSVImport.css';

const CSVImport = () => {
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
            <div className="csv-import-header">
                <h2>📊 Bulk Transaction Import</h2>
                <p>Upload CSV file to scan multiple transactions for fraud</p>
            </div>

            <div className="csv-import-actions">
                <button
                    className="btn-download-template"
                    onClick={handleDownloadTemplate}
                >
                    📥 Download CSV Template
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
                        {file ? file.name : 'Choose CSV file...'}
                    </label>
                </div>

                <button
                    className="btn-upload"
                    onClick={handleUpload}
                    disabled={!file || uploading}
                >
                    {uploading ? '⏳ Processing...' : '🚀 Upload & Scan'}
                </button>
            </div>

            {error && (
                <div className="alert alert-error">
                    <span className="alert-icon">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {results && (
                <div className="results-container">
                    <div className="results-header">
                        <h3>✅ Import Complete</h3>
                        <p>{results.message}</p>
                    </div>

                    <div className="results-stats">
                        <div className="stat-card success">
                            <div className="stat-value">{results.imported}</div>
                            <div className="stat-label">Successfully Imported</div>
                        </div>
                        {results.failed > 0 && (
                            <div className="stat-card error">
                                <div className="stat-value">{results.failed}</div>
                                <div className="stat-label">Failed</div>
                            </div>
                        )}
                    </div>

                    {results.results && results.results.length > 0 && (
                        <div className="results-table-container">
                            <h4>Imported Transactions</h4>
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th>Row</th>
                                        <th>Transaction ID</th>
                                        <th>Risk Score</th>
                                        <th>Risk Level</th>
                                        <th>Flagged</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.results.map((result, idx) => (
                                        <tr key={idx}>
                                            <td>{result.row}</td>
                                            <td>{result.transactionId}</td>
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
                                                {result.flagged ? (
                                                    <span className="badge badge-danger">🚨 Yes</span>
                                                ) : (
                                                    <span className="badge badge-success">✅ No</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {results.errors && results.errors.length > 0 && (
                        <div className="errors-container">
                            <h4>⚠️ Errors ({results.errors.length})</h4>
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
                <h4>📋 CSV Format Requirements</h4>
                <ul>
                    <li><strong>Required columns:</strong> transactionType, fromAddress, toAddress, amount</li>
                    <li><strong>Optional columns:</strong> agency, programName, beneficiaryType, currency, timestamp</li>
                    <li><strong>Transaction Types:</strong> Social Welfare, Procurement, Tax, Grant</li>
                    <li><strong>File size limit:</strong> 10MB</li>
                </ul>
            </div>
        </div>
    );
};

export default CSVImport;

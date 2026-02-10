import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, FileText } from 'lucide-react';
import { isOfficial } from '../../utils/permissions';
import '../../styles/DocumentVerification.css';

function DocumentVerification({ user }) {
    const [documentId, setDocumentId] = useState('');
    const [file, setFile] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
            if (!validTypes.includes(selectedFile.type)) {
                setError('Please select a valid image (JPG, PNG) or PDF file');
                setFile(null);
                return;
            }

            // Validate file size (max 5MB)
            if (selectedFile.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                setFile(null);
                return;
            }

            setFile(selectedFile);
            setError(null);
        }
    };

    const handleVerify = async () => {
        if (!documentId.trim()) {
            setError('Please enter a document ID');
            return;
        }

        try {
            setVerifying(true);
            setError(null);
            setResult(null);

            const token = localStorage.getItem('token');

            // For now, we'll just send the document ID
            // In a real implementation, you'd also hash the file and send it
            const response = await fetch('http://localhost:5000/api/datagovph/scan', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentId: documentId,
                    documentType: 'government_document'
                })
            });

            if (response.ok) {
                const data = await response.json();
                setResult({
                    verified: data.verified || false,
                    status: data.verified ? 'Authentic' : 'Not Found',
                    message: data.message || 'Document verification completed',
                    details: data.details || {},
                    blockchainHash: data.blockchainHash || null
                });
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Verification failed');
            }
        } catch (err) {
            setError('Error verifying document: ' + err.message);
        } finally {
            setVerifying(false);
        }
    };

    const handleReset = () => {
        setDocumentId('');
        setFile(null);
        setResult(null);
        setError(null);
    };

    return (
        <div className="document-verification">
            <div className="page-hero doc-verify-hero">
                <span className="hero-tag">OFFICIAL VERIFICATION</span>
                <h1 className="hero-title">Document Verification</h1>
                <p className="hero-subtitle">Verify the authenticity of government-issued documents using blockchain technology.</p>
            </div>

            <div className="verification-container">
                <div className="verification-card">
                    <h2>Verify Document</h2>

                    <div className="form-group">
                        <label htmlFor="documentId">Document ID / Reference Number</label>
                        <input
                            id="documentId"
                            type="text"
                            value={documentId}
                            onChange={(e) => setDocumentId(e.target.value)}
                            placeholder="e.g., DOC-2024-12345"
                            disabled={verifying}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="fileUpload">Upload Document (Optional)</label>
                        <input
                            id="fileUpload"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                            disabled={verifying}
                        />
                        {file && (
                            <div className="file-info">
                                <span>📎 {file.name}</span>
                                <span className="file-size">({(file.size / 1024).toFixed(2)} KB)</span>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="error-message">
                            <span><AlertTriangle size={20} color="#f59e0b" /></span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="button-group">
                        <button
                            onClick={handleVerify}
                            disabled={verifying || !documentId.trim()}
                            className="verify-button"
                        >
                            {verifying ? 'Verifying...' : 'Verify Document'}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={verifying}
                            className="reset-button"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {result && (
                    <div className={`result-card ${result.verified ? 'verified' : 'not-verified'}`}>
                        <div className="result-icon">
                            {result.verified ? <CheckCircle size={20} color="#10b981" /> : <XCircle size={20} color="#ef4444" />}
                        </div>
                        <h3>{result.status}</h3>
                        <p>{result.message}</p>

                        {result.verified && (
                            <div className="result-details">
                                <div className="detail-item">
                                    <strong>Document ID:</strong>
                                    <span>{documentId}</span>
                                </div>
                                {result.blockchainHash && (
                                    <div className="detail-item">
                                        <strong>Blockchain Hash:</strong>
                                        <span className="hash">{result.blockchainHash.substring(0, 20)}...</span>
                                    </div>
                                )}
                                {result.details.issuedDate && (
                                    <div className="detail-item">
                                        <strong>Issued Date:</strong>
                                        <span>{new Date(result.details.issuedDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {result.details.issuingOffice && (
                                    <div className="detail-item">
                                        <strong>Issuing Office:</strong>
                                        <span>{result.details.issuingOffice}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {!result.verified && (
                            <div className="not-found-info">
                                <p>This document could not be verified in our system.</p>
                                <p>Possible reasons:</p>
                                <ul>
                                    <li>Document ID is incorrect</li>
                                    <li>Document has not been registered</li>
                                    <li>Document may be irregular or altered</li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="info-section">
                <h3><Info size={20} style={{ display: 'inline', marginRight: '8px' }} /> How It Works</h3>
                <div className="info-grid">
                    <div className="info-item">
                        <div className="info-number">1</div>
                        <p>Enter the document ID or reference number found on your document</p>
                    </div>
                    <div className="info-item">
                        <div className="info-number">2</div>
                        <p>Optionally upload a copy of the document for additional verification</p>
                    </div>
                    <div className="info-item">
                        <div className="info-number">3</div>
                        <p>Our system checks the document against blockchain records</p>
                    </div>
                    <div className="info-item">
                        <div className="info-number">4</div>
                        <p>Get instant verification results with document details</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DocumentVerification;

import React, { useState } from 'react';
import '../../styles/SubmitComplaint.css';

function SubmitComplaint({ user }) {
    const [formData, setFormData] = useState({
        category: '',
        subject: '',
        description: '',
        location: '',
        anonymous: false
    });
    const [files, setFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    const categories = [
        'Infrastructure',
        'Public Services',
        'Health & Sanitation',
        'Peace & Order',
        'Environmental',
        'Corruption/Irregularity',
        'Other'
    ];

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

        // Validate file size (max 5MB per file)
        const validFiles = selectedFiles.filter(file => {
            if (file.size > 5 * 1024 * 1024) {
                setError(`File ${file.name} is too large (max 5MB)`);
                return false;
            }
            return true;
        });

        setFiles(prev => [...prev, ...validFiles]);
        setError(null);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.category) {
            setError('Please select a category');
            return;
        }
        if (!formData.subject.trim()) {
            setError('Please enter a subject');
            return;
        }
        if (!formData.description.trim()) {
            setError('Please provide a description');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const token = localStorage.getItem('token');

            // Create FormData for file upload
            const submitData = new FormData();
            submitData.append('category', formData.category);
            submitData.append('subject', formData.subject);
            submitData.append('description', formData.description);
            submitData.append('location', formData.location);
            submitData.append('anonymous', formData.anonymous);

            files.forEach(file => {
                submitData.append('attachments', file);
            });

            const response = await fetch('http://localhost:5000/api/complaints', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: submitData
            });

            if (response.ok) {
                setSuccess(true);
                // Reset form
                setFormData({
                    category: '',
                    subject: '',
                    description: '',
                    location: '',
                    anonymous: false
                });
                setFiles([]);

                // Hide success message after 5 seconds
                setTimeout(() => setSuccess(false), 5000);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to submit complaint');
            }
        } catch (err) {
            setError('Error submitting complaint: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="submit-complaint">
            <div className="complaint-header">
                <h1>📝 Submit Report or Complaint</h1>
                <p>Report issues, concerns, or irregularities to barangay officials</p>
            </div>

            {success && (
                <div className="success-banner">
                    ✅ Your report has been submitted successfully! You will receive updates via email.
                </div>
            )}

            {error && (
                <div className="error-banner">
                    ⚠️ {error}
                </div>
            )}

            <div className="complaint-form-container">
                <form onSubmit={handleSubmit} className="complaint-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="category">Category *</label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select a category</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="location">Location</label>
                            <input
                                id="location"
                                name="location"
                                type="text"
                                value={formData.location}
                                onChange={handleInputChange}
                                placeholder="e.g., Purok 1, Main Street"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="subject">Subject *</label>
                        <input
                            id="subject"
                            name="subject"
                            type="text"
                            value={formData.subject}
                            onChange={handleInputChange}
                            placeholder="Brief summary of your report"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description *</label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Provide detailed information about your report..."
                            rows="6"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="attachments">Attachments (Optional)</label>
                        <input
                            id="attachments"
                            type="file"
                            multiple
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                        />
                        <small>Upload photos or documents (max 5MB per file)</small>

                        {files.length > 0 && (
                            <div className="file-list">
                                {files.map((file, index) => (
                                    <div key={index} className="file-item">
                                        <span>📎 {file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            className="remove-file"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                name="anonymous"
                                checked={formData.anonymous}
                                onChange={handleInputChange}
                            />
                            <span>Submit anonymously (your identity will be hidden)</span>
                        </label>
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="submit-button"
                        >
                            {submitting ? 'Submitting...' : 'Submit Report'}
                        </button>
                    </div>
                </form>

                <div className="complaint-info">
                    <h3>ℹ️ What Happens Next?</h3>
                    <ol>
                        <li>Your report is reviewed by barangay officials</li>
                        <li>You'll receive a confirmation email with a tracking number</li>
                        <li>Officials will investigate and take appropriate action</li>
                        <li>You'll be notified of updates and resolution</li>
                    </ol>

                    <div className="info-note">
                        <strong>Note:</strong> For emergencies, please contact local authorities directly.
                        This form is for non-urgent reports and concerns.
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SubmitComplaint;

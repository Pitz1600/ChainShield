import React, { useState } from 'react';
import '../styles/CaseDetail.css';

function CaseDetail({ case: caseData, onClose }) {
  const [notes, setNotes] = useState([
    {
      id: '1',
      content: 'Initial investigation started. Reviewing transaction patterns.',
      author: 'Agent Smith',
      timestamp: new Date().toISOString()
    }
  ]);
  const [newNote, setNewNote] = useState('');

  const addNote = () => {
    if (newNote.trim()) {
      const note = {
        id: Date.now().toString(),
        content: newNote,
        author: 'Current User',
        timestamp: new Date().toISOString()
      };
      setNotes([...notes, note]);
      setNewNote('');
    }
  };

  return (
    <div className="case-detail">
      <div className="case-detail-header">
        <div className="header-info">
          <p className="case-detail-number">{caseData.caseNumber}</p>
          <h2 className="case-detail-title">{caseData.title}</h2>
        </div>
        <button onClick={onClose} className="case-close-btn">
          ✕
        </button>
      </div>

      <div className="case-detail-body">
        <div className="case-info-grid">
          <div className="info-item">
            <p className="info-label">Status</p>
            <p className="info-value">{caseData.status.toUpperCase()}</p>
          </div>
          <div className="info-item">
            <p className="info-label">Priority</p>
            <p className="info-value">{caseData.priority.toUpperCase()}</p>
          </div>
          <div className="info-item">
            <p className="info-label">Assigned To</p>
            <p className="info-value">{caseData.assignedTo?.username || 'Unassigned'}</p>
          </div>
        </div>

        <div className="notes-section">
          <h3 className="notes-title">
            <span className="notes-icon">💬</span>
            Investigation Notes
          </h3>
          <div className="notes-list">
            {notes.map(note => (
              <div key={note.id} className="note-item">
                <div className="note-header">
                  <span className="note-author">{note.author}</span>
                  <span className="note-time">
                    {new Date(note.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="note-content">{note.content}</p>
              </div>
            ))}
          </div>
          <div className="note-input-wrapper">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNote()}
              placeholder="Add investigation note..."
              className="note-input"
            />
            <button onClick={addNote} className="note-submit-btn">
              Add Note
            </button>
          </div>
        </div>

        <div className="case-actions">
          <button className="case-action-btn export">
            <span className="action-icon">📥</span>
            <span>Export Case</span>
          </button>
          <button className="case-action-btn attach">
            <span className="action-icon">📎</span>
            <span>Attach Evidence</span>
          </button>
          <button onClick={onClose} className="case-action-btn close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CaseDetail;
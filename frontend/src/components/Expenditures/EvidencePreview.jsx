import { useEffect, useRef, useState } from 'react';
import { expendituresAPI as api } from '../../services/api';
import useLockBodyScroll from '../../utils/useLockBodyScroll';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function EvidencePreview({ budgetId, expenditureId, file, onClose }) {
  const dialog = useRef(null);
  const [content, setContent] = useState(null), [error, setError] = useState('');
  useLockBodyScroll(true);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element.showModal();
    return () => { element.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    async function load() {
      try {
        const response = await api.previewEvidence(budgetId, expenditureId, file._id, controller.signal);
        const blob = response.data;
        if (file.mimeType === DOCX) {
          const { default: mammoth } = await import('mammoth/mammoth.browser.js');
          const result = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
          if (!controller.signal.aborted) setContent({ text: result.value });
        } else if (['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimeType)) {
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(new Blob([blob], { type: file.mimeType }));
          setContent({ url: objectUrl });
        } else {
          throw new Error('This file type cannot be previewed. Download the original file to open it.');
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e.message || 'Unable to load this evidence. Close the viewer and try again.');
      }
    }
    load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [budgetId, expenditureId, file._id, file.mimeType]);
  return <dialog ref={dialog} className="evidence-preview" aria-labelledby="evidence-preview-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="evidence-preview-header"><div><span className="expenditure-eyebrow">Treasurer evidence</span><h2 id="evidence-preview-title">{file.originalName}</h2></div><button type="button" onClick={onClose}>Close preview</button></header>
    <div className="evidence-preview-content">
      {error ? <p role="alert">{error}</p> : !content ? <p role="status">Loading evidence…</p> : file.mimeType === DOCX ? <><p className="evidence-preview-note">Document text preview. Download the original for its full formatting and embedded images.</p><div className="evidence-preview-document">{content.text || 'No readable text was found in this document.'}</div></> : file.mimeType === 'application/pdf' ? <iframe title={`Evidence: ${file.originalName}`} src={content.url} /> : <img src={content.url} alt={`Evidence: ${file.originalName}`} onError={() => setError('This image could not be displayed. Download the original file to inspect it.')} />}
    </div>
  </dialog>;
}

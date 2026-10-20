import { createPortal } from 'react-dom';
import DialogSurface from '../Layout/DialogSurface';
import '../../styles/LegalPolicyModal.css';

const policies = {
  terms: {
    title: 'Terms of Service',
    introduction: 'These terms explain your responsibilities when using ChainShield, a portal that supports barangay financial oversight, transaction review, and audit workflows.',
    sections: [
      ['Account access', 'Provide accurate registration details and keep them current. Email verification and administrator approval are required before portal access. Use only your own approved account, protect your password and verification codes, and report suspected unauthorized access to the barangay administrator.'],
      ['Authorized use', 'Use ChainShield only for legitimate barangay duties and authorized audit activities within your assigned role. Do not impersonate another person, bypass access controls, interfere with the service, or access or share records without permission.'],
      ['Records and submissions', 'Submit information and documents only when you are authorized to do so. Check their accuracy, avoid unnecessary personal information, and do not knowingly upload misleading records, harmful files, or material that violates another person’s rights.'],
      ['Review of results', 'Risk scores, alerts, and integrity checks support human review. They do not establish fraud, determine liability, or replace an official audit. Verify findings against source records and follow the barangay’s review procedures before taking action.'],
      ['Confidentiality', 'Handle financial records, personal information, and audit findings with care. Share or export them only with authorized recipients for an approved purpose. Your duty to protect confidential records continues after your access ends.'],
      ['Service availability and account restrictions', 'Access may be interrupted for maintenance, technical issues, or security needs. Administrators may restrict or suspend accounts where access is no longer authorized or misuse is suspected. Keep official records according to the barangay’s recordkeeping procedures.'],
      ['Updates and questions', 'These terms may be updated as the service or barangay procedures change. Material changes should be brought to users’ attention before renewed agreement is requested. Contact the barangay administrator for questions about access, these terms, or acceptable use.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    introduction: 'This policy explains how ChainShield handles information used to manage accounts and support barangay financial oversight. Submit only information needed for your authorized work.',
    sections: [
      ['Information handled', 'Account information includes your name, email address, requested role, position, and optional date of birth, along with authentication and account approval details. The portal also handles submitted financial records, uploaded files, feedback or complaints, and records of account activity such as sign-ins and audit actions.'],
      ['How information is used', 'Information is used to verify and administer accounts, apply access permissions, process and review records, generate alerts, investigate reported issues, and protect the service. Your email address is used for account verification and account security communications.'],
      ['Access and service providers', 'Access depends on assigned permissions and work responsibilities. Authorized administrators, barangay personnel, and auditors may access information needed for their duties. Configured hosting, storage, email, and security providers may process information to operate the service. Information may also be disclosed where required by applicable law or an authorized official process.'],
      ['Cookies and browser storage', 'ChainShield uses authentication cookies and browser storage to support sign-in, session security, and the portal’s operation. If a security challenge is enabled, its provider may process browser and network information to help detect automated abuse. Blocking essential cookies may prevent sign-in.'],
      ['Blockchain evidence', 'Some suspicious-transaction evidence may be recorded as hashes, risk scores, and timestamps on a blockchain. Full financial records are stored separately. Blockchain entries are designed to persist and may not be removable, even when a related account or database record is changed. Avoid placing personal information in evidence identifiers or metadata.'],
      ['Retention and protection', 'Records should be kept for the periods needed for account administration, authorized audits, security investigations, and applicable barangay recordkeeping requirements. Access controls and security measures help protect information, but no system can guarantee complete security. Account closure does not automatically erase official records or audit history.'],
      ['Your requests and questions', 'Contact the barangay administrator to ask about information held about you, request corrections, raise a privacy concern, or request deletion or limits on use. Requests are reviewed subject to identity verification, access permissions, and applicable recordkeeping obligations. Do not send passwords or verification codes with your request.'],
      ['Policy updates', 'This policy may be updated when the service or its information practices change. Material changes should be communicated to affected users. Contact the barangay administrator if you need clarification before submitting information.'],
    ],
  },
};

export default function LegalPolicyModal({ policy, onClose }) {
  const { title, introduction, sections } = policies[policy];

  return createPortal(
    <div className="legal-policy-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <DialogSurface className="legal-policy-modal" label={title} onClose={onClose} aria-describedby="legal-policy-introduction">
        <header className="legal-policy-header">
          <h2>{title}</h2>
          <button type="button" className="legal-policy-close" aria-label={`Close ${title}`} onClick={onClose}>×</button>
        </header>
        <div className="legal-policy-body" tabIndex={0}>
          <p id="legal-policy-introduction">{introduction}</p>
          {sections.map(([heading, content]) => (
            <section key={heading}>
              <h3>{heading}</h3>
              <p>{content}</p>
            </section>
          ))}
        </div>
        <footer className="legal-policy-footer">
          <button type="button" className="legal-policy-done" onClick={onClose}>Close</button>
        </footer>
      </DialogSurface>
    </div>,
    document.body,
  );
}

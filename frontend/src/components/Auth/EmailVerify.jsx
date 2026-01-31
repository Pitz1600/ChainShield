import { useState, useRef } from "react";
import { Shield, AlertCircle, CheckCircle } from 'lucide-react';
import api from "../../services/api";
import "../../styles/EmailVerify.css";

const EmailVerify = ({ user, onNavigate, onLogin }) => {
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRefs = useRef([]);

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false;

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

    // Focus next input
    if (element.value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
    if (e.key === "Enter") {
      handleVerify(e);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter a complete 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/auth/verify-email", { otp: code });

      if (res.data.success) {
        setSuccess("Email verified successfully!");
        setTimeout(() => {
          const token = localStorage.getItem('token');
          onLogin(token, { ...user, isVerified: true });
        }, 1500);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid or expired OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setSuccess("");

    try {
      await api.post("/auth/resend-otp");
      setSuccess("A new OTP has been sent to your email.");
      setOtp(new Array(6).fill(""));
      inputRefs.current[0].focus();
    } catch {
      setError("Failed to resend OTP. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      {/* Sidebar - Same matches Login.jsx */}
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand">
            <div className="sidebar-logo"><Shield size={48} /></div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Transaction Verification System</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle"></div>
            <div className="illustration-icon">📧</div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Verify Your Account</h3>
            <p className="sidebar-info-text">
              We need to verify your email address to ensure the security of your account and government records.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="auth-main">
        <div className="auth-content">
          <button className="back-button" onClick={() => onNavigate("welcome")}>
            ← Back to Home
          </button>

          <div className="auth-header">
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              We sent a 6-digit code to <strong>{user?.email || "your email"}</strong>
            </p>
          </div>

          {error && (
            <div className="alert-box error">
              <span className="alert-icon"><AlertCircle size={20} /></span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-box success">
              <span className="alert-icon"><CheckCircle size={20} /></span>
              <span className="alert-message">{success}</span>
            </div>
          )}

          <div className="auth-form">
            <p className="verify-text">
              Enter the 6-digit verification code below to confirm your identity.
            </p>

            <div className="otp-container">
              {otp.map((data, index) => (
                <input
                  className="otp-input"
                  type="text"
                  name="otp"
                  maxLength="1"
                  key={index}
                  value={data}
                  ref={(el) => (inputRefs.current[index] = el)}
                  onChange={(e) => handleChange(e.target, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onFocus={(e) => e.target.select()}
                />
              ))}
            </div>

            <p className="helper-text">
              This code will expire in 10 minutes.
            </p>

            <button
              className="submit-button"
              onClick={handleVerify}
              disabled={loading}
              style={{ marginTop: '0' }}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify Account</span>
                  <span className="button-icon">→</span>
                </>
              )}
            </button>

            <p className="resend-text">
              Didn't receive the code?
              <button
                className="resend-link"
                onClick={handleResendOtp}
                disabled={loading}
              >
                Resend code
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerify;
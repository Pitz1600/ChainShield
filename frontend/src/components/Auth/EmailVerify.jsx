import { useState, useRef, useEffect } from "react";
import { Shield, AlertCircle, CheckCircle, Mail, ChevronLeft } from 'lucide-react';
import api from "../../services/api";
import "../../styles/EmailVerify.css";

const EmailVerify = ({ user, onNavigate, onLogin }) => {
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isInvalidOtp, setIsInvalidOtp] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false;

    if (isInvalidOtp) setIsInvalidOtp(false);
    if (error) setError("");

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

    // Focus next input
    if (element.value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    if (isInvalidOtp) setIsInvalidOtp(false);
    if (error) setError("");

    const pastedData = e.clipboardData.getData('text').trim();

    // Only accept 6-digit numeric codes
    if (!/^\d{6}$/.test(pastedData)) {
      setError('Please paste a valid 6-digit code');
      setIsInvalidOtp(true);
      return;
    }

    // Distribute the pasted digits across all inputs
    const digits = pastedData.split('');
    setOtp(digits);

    // Focus the last input
    inputRefs.current[5].focus();
  };

  const handleKeyDown = (e, index) => {
    if (isInvalidOtp) setIsInvalidOtp(false);
    if (error) setError("");

    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
    if (e.key === "Enter") {
      if (!loading) {
        handleVerify(e);
      }
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter a complete 6-digit verification code.");
      setIsInvalidOtp(true);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setIsInvalidOtp(false);

    try {
      const res = await api.post("/auth/verify-email", { otp: code }, { timeout: 10000 });

      if (res.data.success) {
        setSuccess("Email verified successfully!");
        setTimeout(async () => {
          try {
            // Fetch fresh profile to ensure we have the latest status
            const profileRes = await api.get('/auth/profile');
            onLogin(null, profileRes.data);
          } catch (err) {
            console.error("Failed to refresh profile:", err);
            // Fallback: just redirect to login to force a refresh
            onNavigate('login');
          }
        }, 1500);
      }
    } catch (err) {
      setIsInvalidOtp(true);
      const serverError = err.response?.data?.error;
      const errorMessage = serverError 
        ? `${serverError} The 6-digit verification code you entered is invalid or does not match what was sent to your email.`
        : (err.code === 'ECONNABORTED' 
            ? 'Verification request timed out. Please check your internet connection and try again.' 
            : 'Incorrect verification code. The 6-digit code you entered does not match what was sent to your email.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    if (isInvalidOtp) setIsInvalidOtp(false);
    setError("");
    setSuccess("");

    try {
      await api.post("/auth/resend-otp");
      setSuccess("A new OTP has been sent to your email.");
      setOtp(new Array(6).fill(""));
      if (inputRefs.current[0]) inputRefs.current[0].focus();
      setResendCooldown(60);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend OTP. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      {/* Sidebar - Same matches Login.jsx */}
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand">
            <div className="sidebar-logo"><img src="/ChainShield_logo.png" alt="ChainShield Logo" className="logo-image" /></div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Transaction Verification System</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle"></div>
            <div className="illustration-icon"><Mail size={64} /></div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Verify Your Account</h3>
            <p className="sidebar-info-text">
              We need to verify your email address to ensure the security of your account and barangay records.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="auth-main">
        <div className="auth-content">
          <button className="back-button" onClick={() => onNavigate("welcome")}>
            <ChevronLeft size={16} style={{ marginRight: '4px' }} /> Back to Home
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
                  className={`otp-input ${isInvalidOtp ? 'error' : ''}`}
                  type="text"
                  name="otp"
                  maxLength="1"
                  key={index}
                  value={data}
                  ref={(el) => (inputRefs.current[index] = el)}
                  onChange={(e) => handleChange(e.target, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onFocus={(e) => e.target.select()}
                  onPaste={index === 0 ? handlePaste : undefined}
                />
              ))}
            </div>

            {isInvalidOtp && (
              <p className="otp-error-explanation">
                The verification code entered is incorrect. It does not match the 6-digit code sent to your email. Please check your inbox and re-enter the code.
              </p>
            )}

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
                disabled={loading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerify;
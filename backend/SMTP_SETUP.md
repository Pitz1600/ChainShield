# 📧 SMTP Email Configuration Guide

## Quick Start

ChainShield uses **Nodemailer** for sending OTP verification emails and admin invitations.

### Current Status
Your `.env` file is configured with **Gmail SMTP** (currently using placeholder credentials).

---

## 🚀 Setup Options

### Option 1: Development Mode (No Email Setup Required)

**Best for**: Testing and development

**Setup**: Comment out all SMTP variables in `.env`

```bash
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# ... (all SMTP variables commented)
```

**Behavior**:
- ✅ OTP codes printed to console/terminal
- ✅ No email configuration needed
- ✅ Perfect for local testing

**How to use**:
1. Start the app: `docker compose up`
2. Register a new account
3. Check the terminal logs for the OTP code
4. Use the OTP to verify your account

---

### Option 2: Gmail (Recommended for Personal Use)

**Best for**: Personal projects, small teams

**Setup Steps**:

1. **Enable 2-Factor Authentication** on your Google account
   - Go to: https://myaccount.google.com/security

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "ChainShield"
   - Copy the 16-character password

3. **Update `.env` file**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop  # Your app password
   EMAIL_FROM=your-email@gmail.com
   EMAIL_FROM_NAME=ChainShield
   ```

4. **Restart the backend**:
   ```bash
   docker compose restart backend
   ```

**Limits**: 500 emails/day (free)

---

### Option 3: Mailtrap (Recommended for Testing)

**Best for**: Testing email functionality without sending real emails

**Setup Steps**:

1. **Sign up** at https://mailtrap.io (free account)

2. **Get credentials**:
   - Go to your inbox
   - Click "Show Credentials"
   - Copy SMTP settings

3. **Update `.env` file**:
   ```bash
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_SECURE=false
   SMTP_USER=your-mailtrap-username
   SMTP_PASS=your-mailtrap-password
   EMAIL_FROM=noreply@chainshield.local
   EMAIL_FROM_NAME=ChainShield
   ```

4. **Restart the backend**:
   ```bash
   docker compose restart backend
   ```

**Features**:
- ✅ Catches all emails (no real sending)
- ✅ View emails in web interface
- ✅ Test HTML templates
- ✅ Free tier: 100 emails/month

---

### Option 4: SendGrid (Recommended for Production)

**Best for**: Production deployments, high volume

**Setup Steps**:

1. **Sign up** at https://sendgrid.com (free account)

2. **Create API Key**:
   - Go to Settings → API Keys
   - Create API Key with "Mail Send" permissions
   - Copy the key (starts with `SG.`)

3. **Verify sender email** (required):
   - Go to Settings → Sender Authentication
   - Verify your email address or domain

4. **Update `.env` file**:
   ```bash
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASS=SG.your-sendgrid-api-key-here
   EMAIL_FROM=verified@yourdomain.com
   EMAIL_FROM_NAME=ChainShield
   ```

5. **Restart the backend**:
   ```bash
   docker compose restart backend
   ```

**Limits**: 100 emails/day (free tier)

---

## 🧪 Testing Email Configuration

### 1. Check Backend Logs

After configuring SMTP, restart the backend and check the logs:

```bash
docker compose logs backend
```

Look for:
```
✅ Email service initialized successfully
📧 Email mode: production (SMTP configured)
```

### 2. Test Registration

1. Go to http://localhost:5173
2. Click "Sign Up"
3. Fill in the registration form
4. Submit

**Development Mode**: Check terminal for OTP
**Production Mode**: Check your email inbox

### 3. Verify OTP Email

The email should contain:
- ✅ 6-digit OTP code
- ✅ Professional HTML template
- ✅ ChainShield branding
- ✅ Expiration notice (10 minutes)

---

## 🔧 Troubleshooting

### Email Not Sending

**Check 1**: Verify SMTP credentials in `.env`
```bash
# Make sure these are uncommented and correct
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Check 2**: Check backend logs for errors
```bash
docker compose logs backend | grep -i email
```

**Check 3**: Test SMTP connection
```bash
# The backend will log connection status on startup
docker compose restart backend
```

### Gmail "Less Secure App" Error

**Solution**: Use App Password instead of regular password
- Regular Gmail password won't work
- Must generate App Password (see Option 2 above)

### SendGrid "Sender Not Verified" Error

**Solution**: Verify your sender email
- Go to SendGrid → Settings → Sender Authentication
- Verify the email address you're using in `EMAIL_FROM`

---

## 📝 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SMTP_HOST` | Yes* | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | Yes* | SMTP server port | `587` |
| `SMTP_SECURE` | No | Use TLS (true/false) | `false` |
| `SMTP_USER` | Yes* | SMTP username | `user@gmail.com` |
| `SMTP_PASS` | Yes* | SMTP password | `app-password` |
| `EMAIL_FROM` | Yes* | Sender email address | `noreply@domain.com` |
| `EMAIL_FROM_NAME` | No | Sender display name | `ChainShield` |
| `FRONTEND_URL` | Yes | Frontend URL for links | `http://localhost:5173` |

*Required only if using production email mode

---

## 🎯 Recommended Setup by Environment

| Environment | Recommended Option | Why |
|-------------|-------------------|-----|
| **Local Development** | Development Mode | No setup, instant testing |
| **Testing/Staging** | Mailtrap | Safe email testing |
| **Small Production** | Gmail | Easy setup, reliable |
| **Large Production** | SendGrid | Scalable, professional |

---

## 🔒 Security Best Practices

1. **Never commit `.env` file** to version control
   - Already in `.gitignore`
   - Contains sensitive credentials

2. **Use App Passwords** for Gmail
   - Never use your main Gmail password
   - Generate app-specific passwords

3. **Rotate credentials** regularly
   - Change SMTP passwords periodically
   - Revoke unused app passwords

4. **Use environment-specific configs**
   - Different SMTP for dev/staging/prod
   - Separate SendGrid accounts per environment

---

## 📊 Current Configuration

Your `.env` file is currently set to:
- **SMTP Provider**: Gmail (with placeholder credentials)
- **Mode**: Will use console logging until you add real credentials
- **Frontend URL**: http://localhost:5173

**To activate real emails**: Replace the placeholder values in `.env` with your actual Gmail credentials.

**To use console logging**: Comment out all SMTP variables.

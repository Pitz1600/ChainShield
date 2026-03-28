const { AkismetClient } = require('akismet-api');

const getConfig = () => ({
    key: process.env.AKISMET_API_KEY,
    blog: process.env.AKISMET_BLOG,
    enabled: String(process.env.AKISMET_ENABLED || '').toLowerCase() === 'true'
});

let client = null;
let verifyPromise = null;

const getStatus = async () => {
    const { key, blog, enabled } = getConfig();
    if (!enabled) {
        return { enabled: false, valid: false, error: 'disabled', blog };
    }
    if (!key || !blog) {
        return { enabled: true, valid: false, error: 'missing_config', blog };
    }
    const verification = await verifyKeyOnce();
    return { enabled: true, valid: verification.valid, error: verification.error || null, blog };
};

const getClient = () => {
    const { key, blog, enabled } = getConfig();
    if (!enabled || !key || !blog) return null;
    if (!client) {
        client = new AkismetClient({ key, blog });
    }
    return client;
};

const verifyKeyOnce = async () => {
    const akismet = getClient();
    if (!akismet) return { enabled: false, valid: false };
    if (!verifyPromise) {
        verifyPromise = akismet.verifyKey()
            .then((valid) => ({ enabled: true, valid: Boolean(valid), error: null }))
            .catch((err) => ({ enabled: true, valid: false, error: err?.message || 'verify_failed' }));
    }
    return verifyPromise;
};

const buildCommentPayload = ({ content, user, req, commentType, permalink }) => {
    const blog = process.env.AKISMET_BLOG;
    const isTest = process.env.NODE_ENV !== 'production';
    return {
        blog,
        user_ip: req.ip,
        user_agent: req.get('User-Agent'),
        referrer: req.get('Referer'),
        permalink,
        comment_type: commentType,
        comment_author: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
        comment_author_email: user?.email,
        comment_content: content,
        isTest
    };
};

const checkAkismet = async ({ content, user, req, commentType, permalink }) => {
    const akismet = getClient();
    if (!akismet) {
        return { enabled: false, valid: false, isSpam: false, error: null };
    }

    const verification = await verifyKeyOnce();
    if (!verification.valid) {
        return { enabled: true, valid: false, isSpam: false, error: verification.error || 'invalid_key' };
    }

    try {
        const payload = buildCommentPayload({ content, user, req, commentType, permalink });
        const isSpam = await akismet.checkSpam(payload);
        return { enabled: true, valid: true, isSpam: Boolean(isSpam), error: null };
    } catch (err) {
        return { enabled: true, valid: true, isSpam: false, error: err?.message || 'akismet_error' };
    }
};

module.exports = {
    checkAkismet,
    getStatus
};

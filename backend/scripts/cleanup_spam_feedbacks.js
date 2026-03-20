const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');

const MIN_FEEDBACK_LENGTH = 10;

const normalizeForSignals = (text) =>
    String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

const countWords = (text) => (normalizeForSignals(text).match(/\b\w+\b/g) || []).length;

const getSpamSignals = (text) => {
    const normalized = normalizeForSignals(text);
    const words = normalized.split(/\s+/).filter(Boolean);
    const wordCount = countWords(text);
    const uniqueWords = new Set(words);
    const uniqueRatio = words.length ? uniqueWords.size / words.length : 0;
    const uniqueCharRatio = normalized.length
        ? (new Set(normalized.replace(/\s+/g, '').split('')).size / normalized.replace(/\s+/g, '').length)
        : 1;
    const longestToken = words.reduce((max, w) => Math.max(max, w.length), 0);
    const hasWhitespace = /\s/.test(normalized);
    const urlCount = (text.match(/https?:\/\/|www\./gi) || []).length;
    const repeatedChar = /(.)\1{6,}/.test(normalized);
    const nonAlphaRatio = normalized.length
        ? (normalized.replace(/[a-z0-9\s]/gi, '').length / normalized.length)
        : 0;

    const reasons = [];
    if (normalized.length < MIN_FEEDBACK_LENGTH) reasons.push('too_short');
    if (wordCount > 6 && uniqueRatio < 0.4) reasons.push('low_variance');
    if (urlCount >= 2) reasons.push('too_many_links');
    if (repeatedChar) reasons.push('repeated_chars');
    if (nonAlphaRatio > 0.45) reasons.push('symbol_heavy');
    if (!hasWhitespace && normalized.length >= 40 && longestToken >= 40) reasons.push('long_unbroken_token');
    if (normalized.length >= 40 && uniqueCharRatio < 0.2) reasons.push('low_char_diversity');

    return { reasons, score: reasons.length, urlCount };
};

const isHeuristicSpam = (spamCheck) =>
    spamCheck.reasons.includes('too_many_links') || spamCheck.score >= 2;

const run = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';
    await mongoose.connect(uri);

    const feedbacks = await Feedback.find({});
    let deletedFeedbacks = 0;
    let removedReplies = 0;

    for (const feedback of feedbacks) {
        const content = feedback.content || '';
        const spamCheck = getSpamSignals(content);
        const heuristicSpam = isHeuristicSpam(spamCheck);

        if (heuristicSpam) {
            await feedback.deleteOne();
            deletedFeedbacks += 1;
            continue;
        }

        if (feedback.replies && feedback.replies.length) {
            const keptReplies = [];
            for (const reply of feedback.replies) {
                const replyCheck = getSpamSignals(reply.content || '');
                const replySpam = isHeuristicSpam(replyCheck);
                if (replySpam) {
                    removedReplies += 1;
                } else {
                    keptReplies.push(reply);
                }
            }
            feedback.replies = keptReplies;
            await feedback.save();
        }
    }

    console.log(`Cleanup complete. Deleted posts: ${deletedFeedbacks}, removed replies: ${removedReplies}`);
    await mongoose.disconnect();
};

run().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});

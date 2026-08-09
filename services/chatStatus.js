const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

async function getUnansweredChatCounts() {
    const adminIds = await User.distinct('_id', { role: 'admin', isActive: true });
    if (!adminIds.length) return { byUser: {}, total: 0, customers: 0 };

    const [incomingGroups, replyGroups] = await Promise.all([
        ChatMessage.aggregate([
            { $match: { recipient: { $in: adminIds }, booking: null } },
            { $group: { _id: '$sender', messages: { $push: '$createdAt' } } }
        ]),
        ChatMessage.aggregate([
            { $match: { sender: { $in: adminIds }, booking: null, isAutomated: { $ne: true } } },
            { $group: { _id: '$recipient', lastReplyAt: { $max: '$createdAt' } } }
        ])
    ]);

    const lastReplies = new Map(replyGroups.map(item => [String(item._id), item.lastReplyAt]));
    const byUser = {};
    let total = 0;
    incomingGroups.forEach(group => {
        const userId = String(group._id);
        const lastReplyAt = lastReplies.get(userId);
        const count = group.messages.reduce((sum, createdAt) => sum + (!lastReplyAt || new Date(createdAt) > new Date(lastReplyAt) ? 1 : 0), 0);
        if (count > 0) { byUser[userId] = count; total += count; }
    });
    return { byUser, total, customers: Object.keys(byUser).length };
}

module.exports = { getUnansweredChatCounts };

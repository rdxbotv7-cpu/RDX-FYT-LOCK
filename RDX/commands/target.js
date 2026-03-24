const fs = require('fs-extra');
const path = require('path');

// Initialize global storage for target conversations
if (!global.targetConvos) {
    global.targetConvos = new Map(); // threadID -> { targetUserID, targetUserName, messageIndex }
}

function getMathsMessages() {
    const mathsPath = path.join(__dirname, 'CONVO/MATHS FILE.txt');
    try {
        const content = fs.readFileSync(mathsPath, 'utf8');
        const messages = content.split('\n').filter(m => m.trim().length > 0);
        return messages;
    } catch {
        return ['Hello!', 'How are you?', 'Nice to talk!'];
    }
}

module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: 'target',
        aliases: ['targetuser', 'settarget'],
        description: "Target a user - bot will reply to their messages using MATHS FILE",
        usage: 'target @user / target uid / target off',
        category: 'Tools',
        prefix: true,
        adminOnly: true
    },

    async run({ api, event, args, send, Threads }) {
        const { threadID, senderID, messageReply, mentions } = event;

        // Get target action
        const action = args[0]?.toLowerCase();

        // Handle OFF - disable target
        if (action === 'off' || action === 'disable') {
            // Clear target for this group
            global.targetConvos.delete(threadID);

            Threads.setSettings(threadID, {
                targetUserID: null,
                targetUserName: null,
                targetIndex: 0
            });

            return send.reply(`✅ Target DISABLED!\n\nNo user is being targeted now.`);
        }

        // Try to get user ID from various sources
        let targetUserID = null;
        let targetUserName = null;

        // 1. Check for mention
        if (mentions && Object.keys(mentions).length > 0) {
            const mentionKeys = Object.keys(mentions);
            targetUserID = mentionKeys[0];
            targetUserName = mentions[targetUserID].replace(/@/g, '');
        }
        // 2. Check for reply
        else if (messageReply && args[0]?.toLowerCase() === 'reply') {
            targetUserID = messageReply.senderID.toString();
            try {
                const userInfo = await api.getUserInfo(targetUserID);
                targetUserName = userInfo[targetUserID]?.name || 'User';
            } catch {
                targetUserName = 'User';
            }
        }
        // 3. Check for UID directly
        else if (args[0] && /^\d+$/.test(args[0])) {
            targetUserID = args[0];
            try {
                const userInfo = await api.getUserInfo(targetUserID);
                targetUserName = userInfo[targetUserID]?.name || 'User';
            } catch {
                targetUserName = 'User';
            }
        }
        // 4. No valid input
        else {
            return send.reply(`╔═══════════════════════╗
   🎯 TARGET COMMAND
╚═══════════════════════╝

Usage:
• target @username - Target by mention
• target uid - Target by user ID
• target reply - Target by replying to a message
• target off - Disable target

Example: .target @username`);
        }

        if (!targetUserID) {
            return send.reply("❌ Could not identify user. Please try again.");
        }

        // Set target for this group
        const targetData = {
            targetUserID: targetUserID,
            targetUserName: targetUserName,
            messageIndex: 0
        };

        global.targetConvos.set(threadID, targetData);

        Threads.setSettings(threadID, {
            targetUserID: targetUserID,
            targetUserName: targetUserName,
            targetIndex: 0
        });

        return send.reply(`✅ Target SET!\n\n👤 User: ${targetUserName}\n🆔 UID: ${targetUserID}\n\nNow bot will reply to their messages using MATHS FILE.`);
    }
};
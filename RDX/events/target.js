const fs = require('fs-extra');
const path = require('path');

if (!global.targetConvos) {
    global.targetConvos = new Map();
}

function getMathsMessages() {
    const mathsPath = path.join(__dirname, '../commands/CONVO/MATHS FILE.txt');
    try {
        const content = fs.readFileSync(mathsPath, 'utf8');
        const messages = content.split('\n').filter(m => m.trim().length > 0);
        return messages;
    } catch {
        return ['Hello!', 'How are you?', 'Nice to talk!', 'Good morning!', 'See you later!'];
    }
}

module.exports = {
    config: {
        credits: 'SARDAR RDX',
        name: 'target',
        eventType: 'message',
        description: 'Auto reply to targeted user with MATHS FILE'
    },

    async run({ api, event, send }) {
        const { threadID, senderID, messageID, isGroup } = event;

        if (!isGroup) return; // Only work in groups

        // Get target data for this group
        const targetData = global.targetConvos.get(threadID);

        if (!targetData) {
            // Also check in thread settings
            const Threads = global.RDX?.Threads;
            if (Threads) {
                const settings = await Threads.getSettings(threadID);
                if (settings?.targetUserID) {
                    targetData = {
                        targetUserID: settings.targetUserID,
                        targetUserName: settings.targetUserName,
                        messageIndex: settings.targetIndex || 0
                    };
                    global.targetConvos.set(threadID, targetData);
                }
            }
        }

        if (!targetData) return;
        if (!targetData.targetUserID) return;

        // Check if sender is the target user
        const senderStr = senderID.toString();
        const targetStr = targetData.targetUserID.toString();

        if (senderStr !== targetStr) return;

        // Get maths messages
        const mathsMessages = getMathsMessages();

        // Get current index
        let index = targetData.messageIndex || 0;

        // Check if we need to wrap around or use random
        if (index >= mathsMessages.length) {
            // Start from beginning or use random
            index = Math.floor(Math.random() * mathsMessages.length);
        }

        // Get the message
        const replyMessage = mathsMessages[index];

        // Send the reply with mention
        try {
            let userID = targetData.targetUserID;
            let userName = targetData.targetUserName;

            // If targetUserName not available, fetch from API
            if (!userName) {
                try {
                    const userInfo = await api.getUserInfo(userID);
                    userName = userInfo[userID]?.name || userInfo[userID]?.firstName || 'User';
                } catch {
                    userName = 'User';
                }
            }

            api.sendMessage({
                body: `@${userName} ${replyMessage}`,
                mentions: [{
                    tag: `@${userName}`,
                    id: parseInt(userID)
                }]
            }, threadID);

            // Update index for next message
            targetData.messageIndex = (index + 1) % mathsMessages.length;
            global.targetConvos.set(threadID, targetData);

            // Also save to database if Threads available
            if (global.RDX?.Threads) {
                await global.RDX.Threads.setSettings(threadID, {
                    targetIndex: targetData.messageIndex
                });
            }
        } catch (err) {
            console.error('Target reply error:', err);
        }
    }
};
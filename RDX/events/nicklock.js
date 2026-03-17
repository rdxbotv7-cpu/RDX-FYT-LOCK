const fs = require('fs-extra');
const path = require('path');

const nicklockPath = path.join(__dirname, '../commands/cache/data/nicklock.json');

function getNicklockData() {
    try {
        fs.ensureDirSync(path.dirname(nicklockPath));
        if (!fs.existsSync(nicklockPath)) {
            fs.writeJsonSync(nicklockPath, { locks: {}, lockAll: null }, { spaces: 2 });
        }
        return fs.readJsonSync(nicklockPath);
    } catch {
        return { locks: {}, lockAll: null };
    }
}

// Get user's current nickname from thread info
async function getCurrentNickname(api, threadID, userID) {
    try {
        const threadInfo = await api.getThreadInfo(threadID);
        const participant = threadInfo.participants.find(p => p.id === userID);
        if (participant && participant.nickname) {
            return participant.nickname;
        }
        return null; // No nickname set
    } catch (err) {
        return null;
    }
}

// Function to restore nickname - only once per change
async function restoreNickname(api, threadID, userID, lockedNick) {
    try {
        // Get current nickname first
        const currentNick = await getCurrentNickname(api, threadID, userID);

        // Only restore if actually different
        if (currentNick !== lockedNick) {
            await api.changeNickname(lockedNick, threadID, userID);
            console.log(`[NICKLOCK] Restored nickname for ${userID}: ${lockedNick}`);
        }
    } catch (err) {
        console.log(`[NICKLOCK] Error restoring nickname: ${err.message}`);
    }
}

module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: 'nicklock',
        eventType: ['log:user-nickname'],
        description: 'Auto restore locked nicknames'
    },

    async run({ api, event, Threads }) {
        const { threadID, logMessageType, logMessageData } = event;

        // Only handle nickname change events
        if (logMessageType !== 'log:user-nickname') return;

        const botID = api.getCurrentUserID();
        const userID = logMessageData?.participant_id;
        const newNickname = logMessageData?.nickname;

        // Skip if no userID or if it's the bot
        if (!userID || userID === botID) return;

        const data = getNicklockData();
        const key = `${threadID}_${userID}`;

        // Check individual lock first
        if (data.locks && data.locks[key]) {
            const lockedNick = data.locks[key].nickname;
            // Only restore if the new nickname is different
            if (newNickname !== lockedNick) {
                await restoreNickname(api, threadID, userID, lockedNick);
            }
            return;
        }

        // Check lockAll (all members lock)
        if (data.lockAll && data.lockAll.threadID === threadID) {
            const lockedNick = data.lockAll.nickname;
            // Only restore if the new nickname is different
            if (newNickname !== lockedNick) {
                await restoreNickname(api, threadID, userID, lockedNick);
            }
        }
    }
};

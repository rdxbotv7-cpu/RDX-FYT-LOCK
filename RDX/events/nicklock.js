const fs = require('fs-extra');
const path = require('path');

const nicklockPath = path.join(__dirname, '../commands/cache/data/nicklock.json');

function getNicklockData() {
    try {
        fs.ensureDirSync(path.dirname(nicklockPath));
        if (!fs.existsSync(nicklockPath)) {
            return { locks: {}, lockAll: null };
        }
        return fs.readJsonSync(nicklockPath);
    } catch {
        return { locks: {}, lockAll: null };
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

        // Check if this is a nickname change event
        if (logMessageType !== 'log:user-nickname') return;

        const botID = api.getCurrentUserID();
        const userID = logMessageData?.participant_id;
        const newNickname = logMessageData?.nickname;

        // Skip if no userID or if it's the bot
        if (!userID || userID === botID) return;

        const data = getNicklockData();
        const key = `${threadID}_${userID}`;

        // Check individual lock first
        if (data.locks[key]) {
            const lockedNick = data.locks[key].nickname;

            if (newNickname !== lockedNick) {
                try {
                    await api.changeNickname(lockedNick, threadID, userID);
                    console.log(`[NICKLOCK] Restored individual nickname for ${userID}: ${lockedNick}`);
                } catch (err) {
                    console.error('[NICKLOCK] Failed to restore individual nickname:', err);
                }
            }
            return;
        }

        // Check lockAll (all members lock)
        if (data.lockAll && data.lockAll.threadID === threadID) {
            const lockedNick = data.lockAll.nickname;

            if (newNickname !== lockedNick) {
                try {
                    await api.changeNickname(lockedNick, threadID, userID);
                    console.log(`[NICKLOCK] Restored locked nickname for ${userID}: ${lockedNick}`);
                } catch (err) {
                    console.error('[NICKLOCK] Failed to restore locked nickname:', err);
                }
            }
        }
    }
};

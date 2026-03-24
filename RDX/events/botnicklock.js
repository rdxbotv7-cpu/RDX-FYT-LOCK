const fs = require('fs-extra');
const path = require('path');

const botNickLockPath = path.join(__dirname, '../commands/cache/data/botnicklock.json');

function getBotNickLockData() {
    try {
        if (!fs.existsSync(botNickLockPath)) {
            return {};
        }
        return fs.readJsonSync(botNickLockPath);
    } catch {
        return {};
    }
}

module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: 'botnicklock',
        eventType: ['log:user-nickname'],
        description: 'Auto restore bot locked nickname'
    },

    async run({ api, event }) {
        const { threadID, logMessageType, logMessageData } = event;

        // Only handle nickname change events
        if (logMessageType !== 'log:user-nickname') return;

        const botID = api.getCurrentUserID();
        const userID = logMessageData?.participant_id;
        const newNickname = logMessageData?.nickname;

        // Only care if it's the bot's nickname that changed
        if (!userID || userID !== botID.toString()) return;

        const data = getBotNickLockData();
        const lockedData = data[threadID];

        // If no lock for this group, skip
        if (!lockedData) return;

        const lockedNick = lockedData.nickname;

        // Only restore if the new nickname is different from locked
        if (newNickname !== lockedNick) {
            try {
                await api.changeNickname(lockedNick, threadID, botID);
                console.log(`[BOTNICKLOCK] Restored bot nickname in ${threadID}: ${lockedNick}`);
            } catch (err) {
                console.log('[BOTNICKLOCK] Could not restore nickname:', err.message);
            }
        }
    }
};
const fs = require('fs-extra');
const path = require('path');

const nicklockPath = path.join(__dirname, './cache/data/nicklock.json');

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

function saveNicklockData(data) {
    try {
        fs.ensureDirSync(path.dirname(nicklockPath));
        fs.writeJsonSync(nicklockPath, data, { spaces: 2 });
    } catch (err) {
        console.error('Failed to save nicklock data:', err);
    }
}

module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: 'locknickall',
        aliases: ['lockallnick', 'nicklockall', 'locknicks', 'nlockall'],
        description: "Lock ALL members nickname to prevent changes.",
        usage: 'locknickall [nickname] or locknickall off',
        category: 'Group',
        groupOnly: true,
        prefix: true
    },

    async run({ api, event, args, send, config }) {
        const { threadID, senderID } = event;

        const isBotAdmin = config.ADMINBOT.includes(senderID);

        if (!isBotAdmin) {
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                const adminIDs = threadInfo.adminIDs.map(a => a.id);
                const isGroupAdmin = adminIDs.includes(senderID);

                if (!isGroupAdmin) {
                    return send.reply('Only group admins or bot admins can use this command.');
                }
            } catch {
                return send.reply('Failed to verify admin status.');
            }
        }

        const data = getNicklockData();

        // Handle 'off' to unlock all members
        if (args[0] && (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'unlock')) {
            if (!data.lockAll || data.lockAll.threadID !== threadID) {
                return send.reply('All members nickname is not locked in this group.');
            }

            data.lockAll = null;
            saveNicklockData(data);

            return send.reply('🔓 All members nickname unlocked.');
        }

        // Handle status/view command
        if (!args[0] || args[0].toLowerCase() === 'status' || args[0].toLowerCase() === 'info') {
            if (data.lockAll && data.lockAll.threadID === threadID) {
                return send.reply(`🔒 All Members Nickname Locked
───────────────
Nickname: ${data.lockAll.nickname}
Locked By: ${data.lockAll.lockedBy}

This nickname will auto-restore if anyone changes it.`);
            }
            return send.reply('All members nickname is not locked in this group.\n\nUsage:\n- locknickall [nickname] - Lock all members nickname\n- locknickall off - Unlock all members nickname');
        }

        // Set nickname for all members and lock
        const nickname = args.join(' ');

        if (!nickname) {
            return send.reply('Please provide a nickname to lock for all members.\n\nUsage: locknickall [nickname]');
        }

        try {
            // Get all thread participants
            const threadInfo = await api.getThreadInfo(threadID);
            const participantIDs = threadInfo.participantIDs;
            const botID = api.getCurrentUserID();

            let successCount = 0;
            let failCount = 0;

            // Send initial message
            await send.reply(`🔒 Setting nickname for all members: ${nickname}...`);

            // Set nickname for each member (continue even if some fail)
            for (const uid of participantIDs) {
                if (uid === botID) continue; // Skip bot
                try {
                    await api.changeNickname(nickname, threadID, uid);
                    successCount++;

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (err) {
                    failCount++;
                }
            }

            // Save the lockAll data regardless of success/fail count
            data.lockAll = {
                threadID: threadID,
                nickname: nickname,
                lockedBy: senderID,
                lockedAt: Date.now(),
                memberCount: successCount
            };
            saveNicklockData(data);

            if (failCount > 0) {
                return send.reply(`🔒 All Members Nickname Locked
─────────────────
Nickname: ${nickname}
Members Updated: ${successCount}
Failed: ${failCount}

⚠️ Some failed - bot may need admin rights.
Lock is ACTIVE - when anyone changes nickname it will be auto-restored!`);
            }

            return send.reply(`🔒 All Members Nickname Locked
─────────────────
Nickname: ${nickname}
Members Updated: ${successCount}

This nickname will auto-restore if anyone changes it.`);
        } catch (error) {
            return send.reply('Failed to lock all members nickname: ' + error.message);
        }
    }
};

const fs = require('fs-extra');
const path = require('path');

const botNickLockPath = path.join(__dirname, './cache/data/botnicklock.json');

function getBotNickLockData() {
    try {
        fs.ensureDirSync(path.dirname(botNickLockPath));
        if (!fs.existsSync(botNickLockPath)) {
            fs.writeJsonSync(botNickLockPath, {}, { spaces: 2 });
        }
        return fs.readJsonSync(botNickLockPath);
    } catch {
        return {};
    }
}

function saveBotNickLockData(data) {
    try {
        fs.ensureDirSync(path.dirname(botNickLockPath));
        fs.writeJsonSync(botNickLockPath, data, { spaces: 2 });
    } catch (err) {
        console.error('Failed to save bot nicklock data:', err);
    }
}

// Get current bot nickname in a group
async function getBotCurrentNickname(api, threadID, botID) {
    try {
        const threadInfo = await api.getThreadInfo(threadID);
        const participant = threadInfo.participants.find(p => p.id === botID);
        if (participant && participant.nickname) {
            return participant.nickname;
        }
        return null;
    } catch (err) {
        return null;
    }
}

module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: 'botnicklock',
        aliases: ['bnlock', 'botnick'],
        description: "Lock bot's nickname in group to prevent changes.",
        usage: 'botnicklock [name] or botnicklock on or botnicklock off',
        category: 'Group',
        groupOnly: true,
        prefix: true
    },

    async run({ api, event, args, send, Threads, config }) {
        const { threadID, senderID } = event;
        const botID = api.getCurrentUserID();

        const data = getBotNickLockData();
        const currentLocked = data[threadID];

        // Check if admin (bot admin or group admin)
        const isBotAdmin = config.ADMINBOT.includes(senderID);
        let isGroupAdmin = false;

        if (!isBotAdmin) {
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                const adminIDs = threadInfo.adminIDs.map(a => a.id);
                isGroupAdmin = adminIDs.includes(senderID);
                if (!isGroupAdmin) {
                    return send.reply('Only group admins or bot admins can use this command.');
                }
            } catch {
                return send.reply('Failed to verify admin status.');
            }
        }

        const action = args[0]?.toLowerCase();

        // Show status
        if (!action || action === 'status' || action === 'info') {
            if (currentLocked) {
                return send.reply(`🔒 Bot Nickname Locked
────────────────
Nickname: ${currentLocked.nickname}
Locked By: ${currentLocked.lockedBy}
Locked At: ${new Date(currentLocked.lockedAt).toLocaleString()}

Bot nickname will auto-restore if changed.`);
            }
            return send.reply(`Bot nickname is not locked in this group.

Usage:
• botnicklock [name] - Set & lock nickname
• botnicklock on - Lock current nickname
• botnicklock off - Unlock nickname`);
        }

        // OFF - Unlock silently (no messages)
        if (action === 'off' || action === 'unlock' || action === 'disable') {
            if (!currentLocked) {
                return send.reply('Bot nickname is not locked.');
            }

            // Delete the lock data silently
            delete data[threadID];
            saveBotNickLockData(data);

            // Silently restore to original (no notification)
            const originalName = currentLocked.originalName || config.BOTNAME || 'RDX Bot';
            try {
                await api.changeNickname(originalName, threadID, botID);
            } catch (err) {
                console.log('[BOTNICKLOCK] Could not restore nickname:', err.message);
            }

            return; // Silent - no message sent
        }

        // ON - Lock current nickname
        if (action === 'on' || action === 'lock') {
            // Get current bot nickname
            const currentNick = await getBotCurrentNickname(api, threadID, botID);
            const nicknameToLock = currentNick || config.BOTNAME || 'RDX Bot';

            data[threadID] = {
                nickname: nicknameToLock,
                originalName: currentNick,
                lockedBy: senderID,
                lockedAt: Date.now()
            };
            saveBotNickLockData(data);

            return send.reply(`🔒 Bot Nickname Locked
────────────────
Nickname: ${nicknameToLock}

This nickname will auto-restore if changed.`);
        }

        // [name] - Set specific nickname and lock
        const newNickname = args.join(' ');

        if (!newNickname) {
            return send.reply('Please provide a nickname.\n\nUsage:\n• botnicklock [name] - Set & lock nickname\n• botnicklock on - Lock current nickname\n• botnicklock off - Unlock');
        }

        // Try to set the nickname first
        let nickSetSuccess = false;
        try {
            await api.changeNickname(newNickname, threadID, botID);
            nickSetSuccess = true;
        } catch (err) {
            console.log('[BOTNICKLOCK] Bot needs admin to set nickname:', err.message);
            nickSetSuccess = false;
        }

        // Get current nickname to store as original
        const currentNick = await getBotCurrentNickname(api, threadID, botID);

        // Save the lock
        data[threadID] = {
            nickname: newNickname,
            originalName: currentNick || config.BOTNAME || 'RDX Bot',
            lockedBy: senderID,
            lockedAt: Date.now()
        };
        saveBotNickLockData(data);

        if (nickSetSuccess) {
            return send.reply(`🔒 Bot Nickname Locked
────────────────
Nickname: ${newNickname}

This nickname will auto-restore if changed.`);
        } else {
            return send.reply(`🔒 Bot Nickname Locked (Pending)
────────────────
Nickname: ${newNickname}

⚠️ Bot needs admin to set nickname, but lock is active!`);
        }
    }
};
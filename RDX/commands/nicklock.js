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

// Check if nickname should be restored (for both individual and all-members lock)
async function checkAndRestoreNickname(api, threadID, userID, newNickname) {
  const data = getNicklockData();
  const key = `${threadID}_${userID}`;
  const botID = api.getCurrentUserID();

  // Skip if it's the bot itself
  if (userID === botID) return;

  // Check individual lock first
  if (data.locks && data.locks[key]) {
    const lockedNick = data.locks[key].nickname;
    if (newNickname !== lockedNick) {
      try {
        await api.changeNickname(lockedNick, threadID, userID);
      } catch (err) {
        console.log('[NICKLOCK] Bot needs admin to change nickname:', err.message);
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
      } catch (err) {
        console.log('[NICKLOCK] Bot needs admin to change nickname:', err.message);
      }
    }
  }
}

module.exports = {
  config: {
    credits: "SARDAR RDX",
    name: 'nicklock',
    aliases: ['locknick', 'nlock'],
    description: "Lock your own or a user's nickname to prevent changes.",
    usage: 'nicklock [nickname] or nicklock @user [nickname] or nicklock off or nicklock off @user',
    category: 'Group',
    groupOnly: true,
    prefix: true
  },

  configAll: {
    credits: "SARDAR RDX",
    name: 'locknickall',
    aliases: ['lockallnick', 'nicklockall'],
    description: "Lock all members nickname to prevent changes.",
    usage: 'locknickall [nickname] or locknickall off',
    category: 'Group',
    groupOnly: true,
    prefix: true
  },

  checkNickChange: async function (api, threadID, userID, newNickname) {
    await checkAndRestoreNickname(api, threadID, userID, newNickname);
  },

  async run({ api, event, args, send, config }) {
    const { threadID, senderID, mentions } = event;

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

    if (!args[0]) {
      const threadLocks = Object.entries(data.locks)
        .filter(([key]) => key.startsWith(threadID))
        .map(([key, value]) => ({ uid: key.split('_')[1], ...value }));

      if (threadLocks.length === 0) {
        return send.reply(`No locked nicknames in this group.

Usage:
- nicklock @user [nickname] - Lock user's nickname
- nicklock [nickname] - Lock your own nickname
- nicklock off - Unlock your own nickname
- nicklock off @user - Unlock user's nickname
- nicklock list - Show locked nicknames`);
      }

      let msg = `🔒 Locked Nicknames (${threadLocks.length})
─────────────────\n`;

      for (const lock of threadLocks) {
        let name = 'Unknown';
        try {
          const info = await api.getUserInfo(lock.uid);
          name = info[lock.uid]?.name || info[lock.uid]?.firstName || 'Unknown';
        } catch { }

        msg += `\n${name}\nNickname: ${lock.nickname}\nUID: ${lock.uid}\n`;
      }

      return send.reply(msg);
    }

    if (args[0].toLowerCase() === 'list') {
      const threadLocks = Object.entries(data.locks)
        .filter(([key]) => key.startsWith(threadID))
        .map(([key, value]) => ({ uid: key.split('_')[1], ...value }));

      if (threadLocks.length === 0) {
        return send.reply('No locked nicknames in this group.');
      }

      let msg = `🔒 Locked Nicknames (${threadLocks.length})
─────────────────\n`;

      for (const lock of threadLocks) {
        let name = 'Unknown';
        try {
          const info = await api.getUserInfo(lock.uid);
          name = info[lock.uid]?.name || info[lock.uid]?.firstName || 'Unknown';
        } catch { }

        msg += `\n${name}\nNickname: ${lock.nickname}\nUID: ${lock.uid}\n`;
      }

      return send.reply(msg);
    }

    if (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'unlock') {
      let uid = '';

      if (Object.keys(mentions).length > 0) {
        uid = Object.keys(mentions)[0];
      } else if (args[1] && /^\d+$/.test(args[1])) {
        uid = args[1];
      } else if (event.messageReply) {
        uid = event.messageReply.senderID;
      } else {
        // Use sender's own ID - unlock their own nickname
        uid = senderID;
      }

      const key = `${threadID}_${uid}`;

      if (!data.locks[key]) {
        return send.reply('This user does not have a locked nickname.');
      }

      delete data.locks[key];
      saveNicklockData(data);

      return send.reply('🔓 Nickname unlocked.');
    }

    let uid = '';
    let nickname = '';

    // If no mention, no UID, no messageReply, then use sender's own ID
    if (Object.keys(mentions).length > 0) {
      uid = Object.keys(mentions)[0];
      const mentionText = mentions[uid];
      nickname = args.join(' ').replace(mentionText, '').trim();
    } else if (args[0] && /^\d+$/.test(args[0])) {
      uid = args[0];
      nickname = args.slice(1).join(' ');
    } else if (event.messageReply) {
      uid = event.messageReply.senderID;
      nickname = args.join(' ');
    } else {
      // Use sender's own ID - lock their own nickname
      uid = senderID;
      nickname = args.join(' ');
    }

    // If no nickname provided, get the user's current nickname
    if (!nickname) {
      try {
        const threadInfo = await api.getThreadInfo(threadID);
        const participant = threadInfo.participantIDs.includes(uid) ? threadInfo.participants.find(p => p.id === uid) : null;
        if (participant && participant.nickname) {
          nickname = participant.nickname;
        } else {
          // Try to get from user info as fallback
          const userInfo = await api.getUserInfo(uid);
          nickname = userInfo[uid]?.name || userInfo[uid]?.firstName || 'User';
        }
      } catch {
        nickname = 'User';
      }
    }

    // nickname is now optional - if not provided, current nickname will be used

    // Try to change nickname, but don't fail if bot doesn't have admin
    let nickChangeSuccess = false;
    try {
      await api.changeNickname(nickname, threadID, uid);
      nickChangeSuccess = true;
    } catch (err) {
      console.log('[NICKLOCK] Bot needs admin to set nickname, but lock will still be active:', err.message);
      nickChangeSuccess = false;
    }

    const key = `${threadID}_${uid}`;
    data.locks[key] = {
      nickname,
      lockedBy: senderID,
      lockedAt: Date.now()
    };
    saveNicklockData(data);

    let name = 'Unknown';
    try {
      const info = await api.getUserInfo(uid);
      name = info[uid]?.name || info[uid]?.firstName || 'Unknown';
    } catch { }

    if (nickChangeSuccess) {
      return send.reply(`🔒 Nickname Locked
─────────────────
User: ${name}
Nickname: ${nickname}

This nickname will auto-restore if changed.`);
    } else {
      return send.reply(`🔒 Nickname Locked (Pending)
─────────────────
User: ${name}
Nickname: ${nickname}

⚠️ Bot needs admin to set nickname, but lock is active! When user changes nickname, it will be auto-restored.`);
    }
  },

  // Handler for locknickall command
  runAll: async function ({ api, event, args, send, config }) {
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
────────────────
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

      // Set nickname for each member
      for (const uid of participantIDs) {
        if (uid === botID) continue; // Skip bot
        try {
          await api.changeNickname(nickname, threadID, uid);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      // Save the lockAll data
      data.lockAll = {
        threadID: threadID,
        nickname: nickname,
        lockedBy: senderID,
        lockedAt: Date.now(),
        memberCount: successCount
      };
      saveNicklockData(data);

      return send.reply(`🔒 All Members Nickname Locked
────────────────
Nickname: ${nickname}
Members Updated: ${successCount}
Failed: ${failCount}

This nickname will auto-restore if anyone changes it.`);
    } catch (error) {
      return send.reply('Failed to lock all members nickname: ' + error.message);
    }
  }
};


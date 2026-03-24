module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: 'gcnamelock',
        aliases: ['gclock', 'namelock', 'gcnlock'],
        description: "Lock group name - prevents any name changes",
        usage: 'gcnamelock [name/off]',
        category: 'Group',
        groupOnly: true,
        prefix: true,
        adminOnly: false
    },

    async run({ api, event, args, send, Threads }) {
        const { threadID } = event;
        const threadInfo = await api.getThreadInfo(threadID);
        const botID = api.getCurrentUserID();

        // Get current settings
        const settings = Threads.getSettings(threadID);
        const target = args[0]?.toLowerCase();

        // Handle "off" to disable lock
        if (target === 'off' || target === 'disable') {
            const lockedName = settings?.customLockedName || settings?.originalName;

            // Disable the lock
            Threads.setSettings(threadID, {
                gcNameLock: false,
                gcLockedName: null
            });

            // Silently rename to the locked name without any message
            if (lockedName) {
                try {
                    await api.setTitle(lockedName, threadID);
                } catch (err) {
                    console.log('[GCNAMELOCK] Failed to restore name on off:', err.message);
                }
            }
            return; // No message when turning off - silent operation
        }

        // If a name is provided, use it; otherwise use current group name
        let nameToLock;
        if (target) {
            // User provided a custom name - set it first
            nameToLock = args.join(' ');
            try {
                await api.setTitle(nameToLock, threadID);
            } catch (err) {
                console.log('[GCNAMELOCK] Failed to set group name:', err.message);
                return send.reply(`⚠️ Could not set group name. Make sure bot has admin rights.`);
            }
        } else {
            // No name provided - use current group name
            nameToLock = threadInfo.threadName || 'Group';
        }

        // Enable the lock with the name
        Threads.setSettings(threadID, {
            gcNameLock: true,
            gcLockedName: nameToLock
        });

        // Send only ONE message when locking
        return send.reply(`✅ GROUP NAME LOCKED!\n\n🔒 Locked Name: ${nameToLock}\n\nNo one can change it until you turn it off.`);
    }
};
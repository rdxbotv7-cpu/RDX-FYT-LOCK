module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: "gcnamelock",
        eventType: ["log:thread-name"],
        description: "Auto restore locked group name - silent operation"
    },

    async run({ api, event, Threads, logMessageType, logMessageData }) {
        const { threadID, author } = event;
        const botID = api.getCurrentUserID();

        // Get thread settings
        const settings = Threads.getSettings(threadID);

        // Check if gcNameLock is enabled
        if (!settings?.gcNameLock) return;

        // Don't respond to bot's own changes (silent restore)
        if (author === botID) {
            console.log('[GCNAMELOCK] Bot changed name, skipping notification');
            return;
        }

        // Handle group name changes - restore silently without any message
        if (logMessageType === "log:thread-name") {
            const newName = logMessageData.name;
            const lockedName = settings.gcLockedName;

            // If name is different from locked name, restore it silently
            if (newName !== lockedName && lockedName) {
                try {
                    // Silently restore the locked name without sending any message
                    await api.setTitle(lockedName, threadID);
                    console.log(`[GCNAMELOCK] Name restored silently for thread ${threadID}`);
                } catch (error) {
                    console.error('[GCNAMELOCK] Failed to restore name:', error.message);
                }
            }
        }
    }
};
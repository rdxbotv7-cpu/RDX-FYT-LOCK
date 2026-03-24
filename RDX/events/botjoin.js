const fs = require('fs-extra');
const path = require('path');

module.exports = {
    config: {
        credits: "SARDAR RDX",
        name: "botjoin",
        eventType: ["log:subscribe"],
        description: "Send welcome when bot is added to group"
    },

    async run({ api, event, Threads, config, send }) {
        const { threadID, logMessageData } = event;

        // Check if bot was added to group
        const botID = api.getCurrentUserID();

        if (logMessageData && logMessageData.addedParticipants) {
            const wasAdded = logMessageData.addedParticipants.some(p => p.userFbId === botID);

            if (wasAdded) {
                // Bot was added to this group
                try {
                    // Set bot nickname when joining group
                    // Uses: per-group setting > config.BOTNICKNAME > config.BOTNAME > default
                    const settings = Threads.getSettings(threadID);
                    const botNickname = settings?.botNickname || config.BOTNICKNAME || config.BOTNAME || "RDX Bot";

                    try {
                        await api.changeNickname(botNickname, threadID, botID);
                    } catch (e) {
                        console.log('Could not set bot nickname:', e.message);
                    }

                    // Send welcome message
                    const welcomeMsg = `╔════════════════════════════╗
║   🎉 WELCOME TO GROUP!    
╠════════════════════════════╣
║ 👋 Hello Everyone!

║ I'm ${config.BOTNAME || 'RDX Bot'}
║ I'm now your group assistant

║ Use .help for commands
╚════════════════════════════╝`;

                    api.sendMessage(welcomeMsg, threadID);

                } catch (error) {
                    console.error('Bot join event error:', error.message);
                }
            }
        }
    }
};

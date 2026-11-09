const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const PREFIX = "!";

function getSuperProperties() {
    const props = {
        "os": "Windows", "browser": "Discord Client", "release_channel": "stable",
        "client_version": "1.0.9168", "os_version": "10.0.19045", "os_arch": "x64",
        "app_arch": "x64", "system_locale": "en-US", "has_client_mods": false,
        "browser_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9168 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36",
        "browser_version": "37.6.0", "client_build_number": 382917, "native_build_number": 63502,
        "client_event_source": null
    };
    return Buffer.from(JSON.stringify(props)).toString('base64');
}

client.once('ready', () => {
    console.log(`[+] Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'complete') {
        const questId = args[0];
        const tokens = args.slice(1);

        if (!questId || tokens.length === 0) {
            return message.reply(`**Usage:** \`!complete <quest_id> <user_token1> <user_token2> ...\``);
        }

        const progressMsg = await message.reply(`⏳ Starting quest **${questId}** for **${tokens.length}** token(s)...`);
        
        let completed = 0;
        let failed = 0;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const headers = {
                "Authorization": token,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9168 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36",
                "Content-Type": "application/json",
                "X-Super-Properties": getSuperProperties(),
                "X-Discord-Locale": "en-US",
                "X-Discord-Timezone": "America/New_York",
                "X-Debug-Options": "bugReporterEnabled"
            };

            try {
                const questRes = await axios.get(`https://discord.com/api/v9/quests/${questId}`, { headers });
                const questData = questRes.data;
                const taskConfig = questData.config.task_config || {};
                const questType = taskConfig.type || "UNKNOWN";

                await axios.post(`https://discord.com/api/v9/quests/${questId}/enroll`, {}, { headers });

                if (questType === "WATCH_VIDEO" || questType === "WATCH_VIDEO_ON_MOBILE") {
                    let watchTime = taskConfig.video_duration || 60;
                    let progress = 0;
                    while (progress < watchTime) {
                        await axios.post(`https://discord.com/api/v9/quests/${questId}/video-progress`, {
                            timestamp: (Math.floor(Date.now() / 1000) + progress) * 1000
                        }, { headers });
                        progress += 15;
                        await new Promise(r => setTimeout(r, 2000)); 
                    }
                    // Complete the video progress
                    await axios.post(`https://discord.com/api/v9/quests/${questId}/video-progress/complete`, {}, { headers });
                
                } else if (questType === "PLAY_ACTIVITY" || questType === "PLAY_GAME") {
                    const appId = taskConfig.application_id;
                    await axios.post(`https://discord.com/api/v9/quests/${questId}/heartbeat`, {
                        application_id: appId, terminal: false, timestamp: Date.now()
                    }, { headers });
                    await new Promise(r => setTimeout(r, 5000));
                    await axios.post(`https://discord.com/api/v9/quests/${questId}/heartbeat/complete`, {
                        application_id: appId
                    }, { headers });
                }
                
                // Try to claim (This is where the Captcha will hit)
                try {
                    await axios.post(`https://discord.com/api/v9/quests/${questId}/claim`, {}, { headers });
                    completed++;
                } catch (claimErr) {
                    if (claimErr.response && claimErr.response.data && claimErr.response.data.captcha_key) {
                        // It completed, but captcha blocked the claim
                        completed++; 
                        console.log(`[!] Quest ${questId} completed for token ${i+1} but hit CAPTCHA on claim.`);
                    } else {
                        throw claimErr;
                    }
                }

            } catch (err) {
                failed++;
                console.log(`Error: ${err.response?.data?.message || err.message}`);
            }

            await progressMsg.edit(`⏳ Processing: **${i + 1}/${tokens.length}**\n✅ Completed: ${completed} | ❌ Failed: ${failed}`).catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
        }

        const finalEmbed = new EmbedBuilder()
            .setTitle('✅ Quest Completion Finished')
            .setDescription(`**Quest ID:** \`${questId}\`\n\n**Completed:** ${completed}\n**Failed:** ${failed}\n\n*If it says completed but you don't have the reward, open the Discord app and claim it manually. Discord threw a Captcha.*`)
            .setColor('#d946ef');

        await progressMsg.edit({ content: null, embeds: [finalEmbed] });
    }
});

client.login("MTM3MzI4OTQ0MjIwMjM1MzczNQ.G59SHL.mHcLs_kOgTsXvC0BO33cT_1k0iAHZd243tDlDw");
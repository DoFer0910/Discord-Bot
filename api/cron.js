/**
 * Vercel Cron Job エンドポイント
 * 1日1回（Hobbyプランでは例: 1:01）に呼ばれ、設定されたチャンネルに
 * 最新のスケジュールパネルを設置します。
 */
import { REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Cron 呼び出しの正当性検証
    if (process.env.CRON_SECRET) {
        if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const channelId = process.env.SCHEDULE_CHANNEL_ID;
    if (!channelId) {
        return res.status(500).json({ error: 'SCHEDULE_CHANNEL_ID is not configured' });
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

        const embed = new EmbedBuilder()
            .setTitle(`📅 今日のスプラトゥーン3 スケジュール (${today})`)
            .setDescription('おはようございます！下のボタンを押すと、**あなただけに**今日のスケジュールの詳細が表示されます！\n')
            .setColor(0x10b981)
            .toJSON();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('schedule_current')
                    .setLabel('現在のスケジュール')
                    .setEmoji('🟢')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('schedule_next')
                    .setLabel('次回のスケジュール')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary)
            )
            .toJSON();

        await rest.post(Routes.channelMessages(channelId), {
            body: {
                content: `🌅 **本日のスケジュールチェック**`,
                embeds: [embed],
                components: [row],
            }
        });

        return res.status(200).json({ success: true, message: 'Daily schedule panel sent to channel' });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

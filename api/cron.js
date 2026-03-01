/**
 * Vercel Cron Job エンドポイント
 * 奇数時の1分ごとにこの関数が呼ばれ、設定されたチャンネルにスケジュールを送信します
 */
import { fetchScheduleEmbeds } from '../src/schedule.js';
import { REST, Routes } from 'discord.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Cron 呼び出しの正当性検証 (Vercel環境では req.headers.authorization に共有シークレットが含まれることがある。簡易的に実行するかどうかの判断に使う)
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
        const result = await fetchScheduleEmbeds();

        if (result.error) {
            await rest.post(Routes.channelMessages(channelId), {
                body: { content: `❌ 自動送信エラー: ${result.error}` }
            });
            return res.status(200).json({ success: false, message: result.error });
        }

        // 現在のスケジュールを送信
        if (result.currentEmbeds.length > 0) {
            await rest.post(Routes.channelMessages(channelId), {
                body: {
                    content: '📅 **＝＝＝ 現在のスケジュール ＝＝＝**',
                    embeds: result.currentEmbeds.map(e => e.toJSON()),
                }
            });
        }

        // 次回のスケジュールを送信
        if (result.nextEmbeds.length > 0) {
            await rest.post(Routes.channelMessages(channelId), {
                body: {
                    content: '📅 **＝＝＝ 次回のスケジュール ＝＝＝**',
                    embeds: result.nextEmbeds.map(e => e.toJSON()),
                }
            });
        }

        return res.status(200).json({ success: true, message: 'Schedule sent to channel' });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

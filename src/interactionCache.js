import { REST, Routes } from 'discord.js';

/**
 * チャンネルの履歴から、Botが過去に送信した「パネル以外のメッセージ」を探して削除する処理。
 * @param {string} channelId - DiscordチャンネルID
 */
export async function deleteOldBotMessages(channelId) {
    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
        console.error('CLIENT_ID が環境変数に設定されていないため、古いメッセージの削除をスキップします。');
        return;
    }

    try {
        const rest = new REST({ defaultVersion: '10' }).setToken(process.env.DISCORD_TOKEN);

        // チャンネルの最新メッセージを20件取得
        const messages = await rest.get(Routes.channelMessages(channelId), {
            query: new URLSearchParams({ limit: '20' })
        });

        // 自分（Bot）が送信したメッセージを抽出
        const botMessages = messages.filter(msg => msg.author.id === clientId);

        for (const msg of botMessages) {
            // パネル用メッセージ（componentsが含まれているもの）は削除対象外とする
            // 逆にcomponentsが空、もしくは存在しない場合は削除対象
            if (!msg.components || msg.components.length === 0) {
                try {
                    await rest.delete(Routes.channelMessage(channelId, msg.id));
                } catch (delError) {
                    console.error(`メッセージ ${msg.id} の削除に失敗しました:`, delError.message);
                }
            }
        }
    } catch (error) {
        console.error('過去のメッセージ検索・削除中にエラーが発生しました:', error.message);
    }
}

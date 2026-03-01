import { REST, Routes } from 'discord.js';

// ユーザーIDをキー、過去のインタラクショントークンを値とするメモリキャッシュ
// Vercel環境ではコールドスタート時にリセットされますが、連続クリックによるスパム防止目的には十分に機能します。
const userInteractionTokens = new Map();

/**
 * ユーザーの過去のインタラクションメッセージ(Original)を削除する
 * @param {string} userId - DiscordユーザーID
 */
export async function deletePreviousInteractionMessage(userId) {
    const oldToken = userInteractionTokens.get(userId);
    if (!oldToken) return;

    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
        console.error('CLIENT_ID が環境変数に設定されていないため、古いメッセージの削除をスキップします。');
        return;
    }

    try {
        const rest = new REST({ defaultVersion: '10' }).setToken(process.env.DISCORD_TOKEN);
        // 古いインタラクションの元のメッセージを削除
        await rest.delete(Routes.webhookMessage(clientId, oldToken, '@original'));
    } catch (error) {
        // メッセージがすでにない、期限切れ等（Unknown Message エラー等）の場合は無視する
        // デバッグログがうるさくなりすぎるのを防ぐため出力は最小限に
        if (error.code !== 10008) {
            console.log(`過去のメッセージ削除中にエラー: ${error.message}`);
        }
    }
}

/**
 * 今回のインタラクショントークンを記録する
 * @param {string} userId - DiscordユーザーID
 * @param {string} token - インタラクショントークン
 */
export function saveCurrentInteractionToken(userId, token) {
    if (userId && token) {
        userInteractionTokens.set(userId, token);
    }
}

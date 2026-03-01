/**
 * スケジュール個人設定パネルモジュール
 * メンバーごとに受け取りたいスケジュール情報を選択可能にする
 */

import {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

// ユーザーごとの設定を保持（Map<userId, Set<category>>）
const userPreferences = new Map();

// 選択可能なカテゴリ定義
const SCHEDULE_CATEGORIES = [
    { value: 'regular', label: 'ナワバリバトル', emoji: '🟢' },
    { value: 'bankara', label: 'バンカラマッチ', emoji: '🟠' },
    { value: 'xmatch', label: 'Xマッチ', emoji: '🔵' },
    { value: 'salmon', label: 'サーモンラン', emoji: '🟡' },
];

/**
 * スケジュール設定パネルのEmbedを生成
 * @returns {EmbedBuilder} 設定パネル用Embed
 */
function createSchedulePrefEmbed() {
    return new EmbedBuilder()
        .setTitle('📋 スケジュール通知設定')
        .setDescription(
            'DMで受け取りたいスケジュール情報を選択してください。\n' +
            '選択したカテゴリの情報がDMで届きます。\n\n' +
            '**選択可能なカテゴリ:**\n' +
            '🟢 ナワバリバトル\n' +
            '🟠 バンカラマッチ\n' +
            '🔵 Xマッチ\n' +
            '🟡 サーモンラン'
        )
        .setColor(0x7c3aed)
        .setFooter({ text: '何も選択しない場合、DM通知は送信されません。' });
}

/**
 * スケジュール設定用のSelectMenuを生成
 * @returns {ActionRowBuilder} SelectMenu行
 */
function createSchedulePrefMenu() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('schedule_prefs')
        .setPlaceholder('受け取りたい情報を選択...')
        .setMinValues(0)
        .setMaxValues(SCHEDULE_CATEGORIES.length)
        .addOptions(
            SCHEDULE_CATEGORIES.map(cat => ({
                label: cat.label,
                value: cat.value,
                emoji: cat.emoji,
            }))
        );

    return new ActionRowBuilder().addComponents(menu);
}

/**
 * スケジュール設定パネルをチャンネルに送信
 * @param {TextChannel} channel - 送信先チャンネル
 */
export async function sendSchedulePrefPanel(channel) {
    await channel.send({
        embeds: [createSchedulePrefEmbed()],
        components: [createSchedulePrefMenu()],
    });
}

/**
 * SelectMenuインタラクションを処理し、ユーザーの設定を保存
 * @param {StringSelectMenuInteraction} interaction - SelectMenuインタラクション
 */
export async function handleSchedulePrefs(interaction) {
    const userId = interaction.user.id;
    const selected = interaction.values;

    if (selected.length === 0) {
        // 選択なし → DM通知無効
        userPreferences.delete(userId);
        await interaction.reply({
            content: '❌ スケジュールDM通知を**無効**にしました。',
            ephemeral: true,
        });
        return;
    }

    // 設定を保存
    userPreferences.set(userId, new Set(selected));

    // 選択されたカテゴリの日本語名を取得
    const selectedLabels = selected
        .map(v => SCHEDULE_CATEGORIES.find(c => c.value === v))
        .filter(Boolean)
        .map(c => `${c.emoji} ${c.label}`)
        .join('\n');

    await interaction.reply({
        content: `✅ 以下のスケジュールをDMで受け取ります:\n${selectedLabels}`,
        ephemeral: true,
    });
}

/**
 * ユーザーの設定をフィルタオブジェクトとして取得
 * @param {string} userId - ユーザーID
 * @returns {object|null} フィルタ { regular, bankara, xmatch, salmon } または null
 */
export function getUserFilter(userId) {
    const prefs = userPreferences.get(userId);
    if (!prefs) return null;

    return {
        regular: prefs.has('regular'),
        bankara: prefs.has('bankara'),
        xmatch: prefs.has('xmatch'),
        salmon: prefs.has('salmon'),
    };
}

/**
 * 設定登録済みの全ユーザーIDを取得
 * @returns {string[]} ユーザーID配列
 */
export function getRegisteredUserIds() {
    return Array.from(userPreferences.keys());
}

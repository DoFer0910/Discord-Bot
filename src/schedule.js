/**
 * スプラトゥーン3 スケジュール取得・Embed生成モジュール
 * splatoon3.ink API からデータを取得し、Discord Embed に整形する
 */

import { EmbedBuilder } from 'discord.js';

// スケジュールAPI エンドポイント
const SCHEDULE_API_URL = 'https://splatoon3.ink/data/schedules.json';

// ルール名の英語→日本語マッピング
const RULE_NAME_MAP = {
    'Turf War': 'ナワバリバトル',
    'Splat Zones': 'ガチエリア',
    'Tower Control': 'ガチヤグラ',
    'Rainmaker': 'ガチホコバトル',
    'Clam Blitz': 'ガチアサリ',
};

/**
 * ルール名を日本語に変換
 * @param {string} englishName - 英語ルール名
 * @returns {string} 日本語ルール名
 */
function translateRule(englishName) {
    return RULE_NAME_MAP[englishName] || englishName;
}

/**
 * 日時をJSTでフォーマット（HH:MM形式）
 * @param {string} isoString - ISO 8601形式の日時文字列
 * @returns {string} JST形式の時刻文字列
 */
function formatTimeJST(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

/**
 * 日時をJSTでフォーマット（MM/DD HH:MM形式）
 * @param {string} isoString - ISO 8601形式の日時文字列
 * @returns {string} JST形式の日時文字列
 */
function formatDateTimeJST(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

/**
 * 現在のスケジュールノードを取得（現在時刻に該当するもの）
 * @param {Array} nodes - スケジュールノードの配列
 * @returns {object|null} 該当するノード
 */
function findCurrentNode(nodes) {
    const now = new Date();
    return nodes.find(node => {
        const start = new Date(node.startTime);
        const end = new Date(node.endTime);
        return now >= start && now < end;
    }) || null;
}

/**
 * 次のスケジュールノードを取得
 * @param {Array} nodes - スケジュールノードの配列
 * @returns {object|null} 次のノード
 */
function findNextNode(nodes) {
    const now = new Date();
    return nodes.find(node => {
        const start = new Date(node.startTime);
        return start > now;
    }) || null;
}

/**
 * バンカラマッチのEmbedを生成
 * @param {object} setting - バンカラマッチ設定
 * @param {string} mode - 'CHALLENGE' または 'OPEN'
 * @param {string} startTime - 開始時刻
 * @param {string} endTime - 終了時刻
 * @param {string} label - 「現在」または「次回」
 * @returns {EmbedBuilder} Embed
 */
function createBankaraEmbed(setting, mode, startTime, endTime, label) {
    const isChallenge = mode === 'CHALLENGE';
    const modeLabel = isChallenge ? 'チャレンジ' : 'オープン';
    const emoji = isChallenge ? '🟠' : '🟢';
    const color = isChallenge ? 0xff6b2b : 0x2dd4bf;

    const ruleName = translateRule(setting.vsRule.name);
    const stages = setting.vsStages.map(s => s.name).join(' / ');
    const timeRange = `${formatTimeJST(startTime)} 〜 ${formatTimeJST(endTime)}`;

    return new EmbedBuilder()
        .setTitle(`${emoji} 【${label}】バンカラマッチ（${modeLabel}）`)
        .setDescription(`**ルール**: ${ruleName}`)
        .addFields(
            { name: '🗺️ ステージ', value: stages },
            { name: '🕐 時間', value: timeRange },
        )
        .setColor(color)
        .setTimestamp();
}

/**
 * XマッチのEmbedを生成
 * @param {object} setting - Xマッチ設定
 * @param {string} startTime - 開始時刻
 * @param {string} endTime - 終了時刻
 * @param {string} label - 「現在」または「次回」
 * @returns {EmbedBuilder} Embed
 */
function createXMatchEmbed(setting, startTime, endTime, label) {
    const ruleName = translateRule(setting.vsRule.name);
    const stages = setting.vsStages.map(s => s.name).join(' / ');
    const timeRange = `${formatTimeJST(startTime)} 〜 ${formatTimeJST(endTime)}`;

    return new EmbedBuilder()
        .setTitle(`🔵 【${label}】Xマッチ`)
        .setDescription(`**ルール**: ${ruleName}`)
        .addFields(
            { name: '🗺️ ステージ', value: stages },
            { name: '🕐 時間', value: timeRange },
        )
        .setColor(0x0dc5d9)
        .setTimestamp();
}

/**
 * サーモンランのEmbedを生成
 * @param {object} coopNode - サーモンランスケジュールノード
 * @param {string} label - 「現在」または「次回」
 * @returns {EmbedBuilder} Embed
 */
function createSalmonRunEmbed(coopNode, label) {
    const setting = coopNode.setting;
    const stageName = setting.coopStage.name;
    const weapons = setting.weapons.map(w => w.name).join('\n');
    const timeRange = `${formatDateTimeJST(coopNode.startTime)} 〜 ${formatDateTimeJST(coopNode.endTime)}`;

    const embed = new EmbedBuilder()
        .setTitle(`🟡 【${label}】サーモンラン`)
        .addFields(
            { name: '🗺️ ステージ', value: stageName },
            { name: '🔫 支給ブキ', value: weapons },
            { name: '🕐 時間', value: timeRange },
        )
        .setColor(0xff8c00)
        .setTimestamp();

    // ステージサムネイル画像を設定
    if (setting.coopStage.thumbnailImage?.url) {
        embed.setThumbnail(setting.coopStage.thumbnailImage.url);
    }

    return embed;
}

/**
 * スケジュールAPIからデータを取得してEmbed配列を生成
 * @returns {Promise<{embeds: EmbedBuilder[]} | {error: string}>} Embed配列またはエラー
 */
export async function fetchScheduleEmbeds() {
    try {
        const response = await fetch(SCHEDULE_API_URL, {
            headers: {
                'User-Agent': 'SplatoonRoleBot/1.3.0',
            },
        });

        if (!response.ok) {
            throw new Error(`API応答エラー: ${response.status}`);
        }

        const data = await response.json();
        const embeds = [];

        // === 現在のスケジュール ===
        const label = '現在';

        // バンカラマッチ
        const currentBankara = findCurrentNode(data.data.bankaraSchedules.nodes);
        if (currentBankara?.bankaraMatchSettings) {
            for (const setting of currentBankara.bankaraMatchSettings) {
                embeds.push(createBankaraEmbed(
                    setting,
                    setting.bankaraMode,
                    currentBankara.startTime,
                    currentBankara.endTime,
                    label,
                ));
            }
        }

        // Xマッチ
        const currentX = findCurrentNode(data.data.xSchedules.nodes);
        if (currentX?.xMatchSetting) {
            embeds.push(createXMatchEmbed(
                currentX.xMatchSetting,
                currentX.startTime,
                currentX.endTime,
                label,
            ));
        }

        // サーモンラン
        const currentCoop = findCurrentNode(data.data.coopGroupingSchedule.regularSchedules.nodes);
        if (currentCoop) {
            embeds.push(createSalmonRunEmbed(currentCoop, label));
        }

        // === 次回のスケジュール ===
        const nextLabel = '次回';

        // バンカラマッチ（次回）
        const nextBankara = findNextNode(data.data.bankaraSchedules.nodes);
        if (nextBankara?.bankaraMatchSettings) {
            for (const setting of nextBankara.bankaraMatchSettings) {
                embeds.push(createBankaraEmbed(
                    setting,
                    setting.bankaraMode,
                    nextBankara.startTime,
                    nextBankara.endTime,
                    nextLabel,
                ));
            }
        }

        // Xマッチ（次回）
        const nextX = findNextNode(data.data.xSchedules.nodes);
        if (nextX?.xMatchSetting) {
            embeds.push(createXMatchEmbed(
                nextX.xMatchSetting,
                nextX.startTime,
                nextX.endTime,
                nextLabel,
            ));
        }

        // サーモンラン（次回）
        const nextCoop = findNextNode(data.data.coopGroupingSchedule.regularSchedules.nodes);
        if (nextCoop) {
            embeds.push(createSalmonRunEmbed(nextCoop, nextLabel));
        }

        // Embedが1つも生成できなかった場合
        if (embeds.length === 0) {
            return { error: 'スケジュールの取得に失敗しました。時間をおいて再度お試しください。' };
        }

        return { embeds };
    } catch (error) {
        console.error('スケジュール取得エラー:', error);
        return { error: 'スケジュールの取得に失敗しました。時間をおいて再度お試しください。' };
    }
}

/**
 * スプラトゥーン3 スケジュール取得・Embed生成モジュール
 * splatoon3.ink API からデータを取得し、Discord Embed に整形する
 * 日本語ロケールAPI を使用して武器名・ステージ名を日本語化
 */

import { EmbedBuilder, REST, Routes } from 'discord.js';

// スケジュールAPI エンドポイント
const SCHEDULE_API_URL = 'https://splatoon3.ink/data/schedules.json';
// 日本語ロケールAPI エンドポイント
const LOCALE_API_URL = 'https://splatoon3.ink/data/locale/ja-JP.json';

// ルール名の英語→日本語マッピング（フォールバック用）
const RULE_NAME_MAP = {
    'Turf War': 'ナワバリバトル',
    'Splat Zones': 'ガチエリア',
    'Tower Control': 'ガチヤグラ',
    'Rainmaker': 'ガチホコバトル',
    'Clam Blitz': 'ガチアサリ',
};

// ロケールキャッシュ
let localeCache = null;

/**
 * 日本語ロケールデータを取得（キャッシュ付き）
 * @returns {Promise<object|null>} ロケールデータ
 */
async function fetchLocale() {
    if (localeCache) return localeCache;

    try {
        const response = await fetch(LOCALE_API_URL, {
            headers: { 'User-Agent': 'SplatoonRoleBot/1.4.0' },
        });
        if (response.ok) {
            localeCache = await response.json();
            console.log('✅ 日本語ロケールデータを取得しました。');
        }
    } catch (error) {
        console.error('⚠️ ロケールデータの取得に失敗しました:', error.message);
    }
    return localeCache;
}

/**
 * ステージ名を日本語に変換（ロケールデータ使用）
 * @param {object} stage - ステージオブジェクト（id, name を含む）
 * @returns {string} 日本語ステージ名
 */
function translateStage(stage) {
    if (localeCache?.stages?.[stage.id]?.name) {
        return localeCache.stages[stage.id].name;
    }
    return stage.name;
}

/**
 * 武器名を日本語に変換（ロケールデータ使用）
 * @param {object} weapon - 武器オブジェクト（__splatoon3ink_id, name を含む）
 * @returns {string} 日本語武器名
 */
function translateWeapon(weapon) {
    // splatoon3.ink のロケールデータでは武器IDがハッシュ形式
    const weaponId = weapon.__splatoon3ink_id || weapon.image?.url;
    if (weaponId && localeCache?.weapons?.[weaponId]?.name) {
        return localeCache.weapons[weaponId].name;
    }
    return weapon.name;
}

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
 * ナワバリバトルのEmbedを生成
 * @param {object} setting - ナワバリバトル設定
 * @param {string} startTime - 開始時刻
 * @param {string} endTime - 終了時刻
 * @param {string} label - 「現在」または「次回」
 * @returns {EmbedBuilder} Embed
 */
function createRegularEmbed(setting, startTime, endTime, label) {
    const ruleName = translateRule(setting.vsRule.name);
    const stages = setting.vsStages.map(s => translateStage(s)).join(' / ');
    const timeRange = `${formatTimeJST(startTime)} 〜 ${formatTimeJST(endTime)}`;

    return new EmbedBuilder()
        .setTitle(`🟢 【${label}】ナワバリバトル`)
        .setDescription(`**ルール**: ${ruleName}`)
        .addFields(
            { name: '🗺️ ステージ', value: stages },
            { name: '🕐 時間', value: timeRange },
        )
        .setColor(0x19d719)
        .setTimestamp();
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
    const stages = setting.vsStages.map(s => translateStage(s)).join(' / ');
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
    const stages = setting.vsStages.map(s => translateStage(s)).join(' / ');
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
    const stageName = translateStage(setting.coopStage);
    const weapons = setting.weapons.map(w => translateWeapon(w)).join('\n');
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
 * 現在と次回を分離して返す
 * @returns {Promise<{currentEmbeds: EmbedBuilder[], nextEmbeds: EmbedBuilder[]} | {error: string}>}
 */
export async function fetchScheduleEmbeds() {
    try {
        // ロケールデータを取得（キャッシュあれば即返却）
        await fetchLocale();

        const response = await fetch(SCHEDULE_API_URL, {
            headers: {
                'User-Agent': 'SplatoonRoleBot/1.4.0',
            },
        });

        if (!response.ok) {
            throw new Error(`API応答エラー: ${response.status}`);
        }

        const data = await response.json();
        const currentEmbeds = [];
        const nextEmbeds = [];

        // === 現在のスケジュール ===
        const label = '現在';

        // ナワバリバトル
        const currentRegular = findCurrentNode(data.data.regularSchedules.nodes);
        if (currentRegular?.regularMatchSetting) {
            currentEmbeds.push(createRegularEmbed(
                currentRegular.regularMatchSetting,
                currentRegular.startTime,
                currentRegular.endTime,
                label,
            ));
        }

        // バンカラマッチ
        const currentBankara = findCurrentNode(data.data.bankaraSchedules.nodes);
        if (currentBankara?.bankaraMatchSettings) {
            for (const setting of currentBankara.bankaraMatchSettings) {
                currentEmbeds.push(createBankaraEmbed(
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
            currentEmbeds.push(createXMatchEmbed(
                currentX.xMatchSetting,
                currentX.startTime,
                currentX.endTime,
                label,
            ));
        }

        // サーモンラン
        const currentCoop = findCurrentNode(data.data.coopGroupingSchedule.regularSchedules.nodes);
        if (currentCoop) {
            currentEmbeds.push(createSalmonRunEmbed(currentCoop, label));
        }

        // === 次回のスケジュール ===
        const nextLabel = '次回';

        // ナワバリバトル（次回）
        const nextRegular = findNextNode(data.data.regularSchedules.nodes);
        if (nextRegular?.regularMatchSetting) {
            nextEmbeds.push(createRegularEmbed(
                nextRegular.regularMatchSetting,
                nextRegular.startTime,
                nextRegular.endTime,
                nextLabel,
            ));
        }

        // バンカラマッチ（次回）
        const nextBankara = findNextNode(data.data.bankaraSchedules.nodes);
        if (nextBankara?.bankaraMatchSettings) {
            for (const setting of nextBankara.bankaraMatchSettings) {
                nextEmbeds.push(createBankaraEmbed(
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
            nextEmbeds.push(createXMatchEmbed(
                nextX.xMatchSetting,
                nextX.startTime,
                nextX.endTime,
                nextLabel,
            ));
        }

        // サーモンラン（次回）
        const nextCoop = findNextNode(data.data.coopGroupingSchedule.regularSchedules.nodes);
        if (nextCoop) {
            nextEmbeds.push(createSalmonRunEmbed(nextCoop, nextLabel));
        }

        // Embedが1つも生成できなかった場合
        if (currentEmbeds.length === 0 && nextEmbeds.length === 0) {
            return { error: 'スケジュールの取得に失敗しました。時間をおいて再度お試しください。' };
        }

        return { currentEmbeds, nextEmbeds };
    } catch (error) {
        console.error('スケジュール取得エラー:', error);
        return { error: 'スケジュールの取得に失敗しました。時間をおいて再度お試しください。' };
    }
}

/**
 * /schedule コマンド応答: Webhookでスケジュール情報を取得して送信
 * @param {Object} interactionData
 */
export async function fetchAndSendSchedule(interactionData) {
    const { application_id, token } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    const result = await fetchScheduleEmbeds();
    if (result.error) {
        await rest.patch(Routes.webhookMessage(application_id, token), {
            body: { content: `❌ ${result.error}` }
        }).catch(console.error);
        return;
    }

    // 元の応答メッセージを更新して現在のスケジュールを表示
    if (result.currentEmbeds.length > 0) {
        await rest.patch(Routes.webhookMessage(application_id, token), {
            body: {
                content: '📅 **＝＝＝ 現在のスケジュール ＝＝＝**',
                embeds: result.currentEmbeds.map(e => e.toJSON()),
            }
        }).catch(console.error);
    } else {
        await rest.patch(Routes.webhookMessage(application_id, token), {
            body: { content: '現在のスケジュールがありません。' }
        }).catch(console.error);
    }

    // 次回のスケジュールを別メッセージで送信
    if (result.nextEmbeds.length > 0) {
        await rest.post(Routes.webhook(application_id, token), {
            body: {
                content: '📅 **＝＝＝ 次回のスケジュール ＝＝＝**',
                embeds: result.nextEmbeds.map(e => e.toJSON()),
            }
        }).catch(console.error);
    }
}

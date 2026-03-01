/**
 * スケジュール自動送信モジュール
 * JST 1:01, 3:01, 5:01, ..., 23:01 に自動でスケジュールを送信
 * Bot起動時にも即座に1回送信する
 * 前回送信メッセージは自動削除し、最新のみ表示
 */

import { fetchScheduleEmbeds } from './schedule.js';

// 自動送信間隔: 2時間（ミリ秒）
const INTERVAL_MS = 2 * 60 * 60 * 1000;

// 前回チャンネルに送信したメッセージID配列
let previousChannelMessageIds = [];

/**
 * 次回の送信時刻（JST奇数時1分）までのミリ秒を計算
 * 送信時刻: 1:01, 3:01, 5:01, 7:01, 9:01, 11:01, 13:01, 15:01, 17:01, 19:01, 21:01, 23:01
 * @returns {number} 次回送信までのミリ秒
 */
function getMillisUntilNextScheduledTime() {
    const now = new Date();

    // JSTでの現在時刻を取得
    const jstOffset = 9 * 60; // JST = UTC+9
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const jstMinutes = (utcMinutes + jstOffset) % (24 * 60);
    const jstHour = Math.floor(jstMinutes / 60);

    // 次の奇数時を計算
    let nextHourJST;
    if (jstHour % 2 === 0) {
        // 偶数時 → 次の奇数時
        nextHourJST = jstHour + 1;
    } else {
        // 奇数時で1分を過ぎていたら次の奇数時（+2時間後）
        const jstMin = jstMinutes % 60;
        if (jstMin >= 1) {
            nextHourJST = jstHour + 2;
        } else {
            // まだ1分前なので今の奇数時
            nextHourJST = jstHour;
        }
    }

    // 次回送信時刻をUTCで構築
    const nextJSTTotalMinutes = nextHourJST * 60 + 1; // XX:01
    const nextUTCTotalMinutes = (nextJSTTotalMinutes - jstOffset + 24 * 60) % (24 * 60);
    const nextUTCHour = Math.floor(nextUTCTotalMinutes / 60);
    const nextUTCMin = nextUTCTotalMinutes % 60;

    const nextTime = new Date(now);
    nextTime.setUTCHours(nextUTCHour, nextUTCMin, 0, 0);

    // 過去の時刻なら翌日に設定
    if (nextTime <= now) {
        nextTime.setUTCDate(nextTime.getUTCDate() + 1);
    }

    return nextTime.getTime() - now.getTime();
}

/**
 * 前回のチャンネルメッセージを削除
 * @param {TextChannel} channel - 対象チャンネル
 */
async function deletePreviousChannelMessages(channel) {
    for (const msgId of previousChannelMessageIds) {
        try {
            const msg = await channel.messages.fetch(msgId);
            await msg.delete();
        } catch {
            // 既に削除済み or 権限不足の場合は無視
        }
    }
    previousChannelMessageIds = [];
}

/**
 * スケジュールをチャンネルに送信（現在と次回を分けて送信）
 * @param {TextChannel} channel - 送信先チャンネル
 */
async function sendScheduleToChannel(channel) {
    try {
        const result = await fetchScheduleEmbeds();

        if (result.error) {
            await channel.send({ content: `❌ ${result.error}` });
            return;
        }

        // 前回メッセージを削除
        await deletePreviousChannelMessages(channel);

        const newMessageIds = [];

        // 現在のスケジュールを送信
        if (result.currentEmbeds.length > 0) {
            const currentMsg = await channel.send({
                content: '📅 **＝＝＝ 現在のスケジュール ＝＝＝**',
                embeds: result.currentEmbeds,
            });
            newMessageIds.push(currentMsg.id);
        }

        // 次回のスケジュールを送信（別メッセージで区切り）
        if (result.nextEmbeds.length > 0) {
            const nextMsg = await channel.send({
                content: '📅 **＝＝＝ 次回のスケジュール ＝＝＝**',
                embeds: result.nextEmbeds,
            });
            newMessageIds.push(nextMsg.id);
        }

        // 送信したメッセージIDを保存
        previousChannelMessageIds = newMessageIds;

        console.log('✅ スケジュールを自動送信しました。');
    } catch (error) {
        console.error('❌ スケジュール自動送信エラー:', error);
    }
}

/**
 * 自動スケジュール送信を開始
 * @param {Client} client - Discord クライアント
 */
export function startAutoSchedule(client) {
    const channelId = process.env.SCHEDULE_CHANNEL_ID;

    if (!channelId) {
        console.log('ℹ️ SCHEDULE_CHANNEL_ID が未設定のため、自動送信は無効です。');
        return;
    }

    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        console.error(`❌ チャンネルID ${channelId} が見つかりません。SCHEDULE_CHANNEL_ID を確認してください。`);
        return;
    }

    // Bot起動時に即座に1回送信
    console.log('📋 Bot起動時スケジュール送信を実行します...');
    sendScheduleToChannel(channel);

    // 次回の定期送信時刻までの待機時間を計算
    const msUntilNext = getMillisUntilNextScheduledTime();
    const nextTime = new Date(Date.now() + msUntilNext);
    const nextTimeJST = nextTime.toLocaleTimeString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    console.log(`⏰ 次回の自動送信: JST ${nextTimeJST}（${Math.round(msUntilNext / 60000)}分後）`);

    // 次の定期送信時刻まで待機し、その後2時間ごとに繰り返し
    setTimeout(() => {
        sendScheduleToChannel(channel);
        console.log('⏰ 定期送信タイマー開始（2時間間隔）');

        setInterval(() => {
            sendScheduleToChannel(channel);
        }, INTERVAL_MS);
    }, msUntilNext);
}

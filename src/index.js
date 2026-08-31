/**
 * スラッシュコマンド登録スクリプト
 * サーバーレス環境への移行に伴い、このファイルはコマンド登録用ツールとして使用します
 * 実行方法: node src/index.js
 */

import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

// 環境変数の検証
const { DISCORD_TOKEN, CLIENT_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('❌ .env に DISCORD_TOKEN と CLIENT_ID を設定してください。');
    process.exit(1);
}

// スラッシュコマンド定義
const commands = [
    new SlashCommandBuilder()
        .setName('setup_roles')
        .setDescription('ロール選択パネルをこのチャンネルに設置します')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    new SlashCommandBuilder()
        .setName('setup_mh_roles')
        .setDescription('モンハン（ワールド／アイスボーン）のロールパネルを設置します')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    new SlashCommandBuilder()
        .setName('setup_mh_recruit')
        .setDescription('モンハン募集専用チャンネルと常設パネルを設置します')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    new SlashCommandBuilder()
        .setName('hunt')
        .setDescription('モンハン（ワールド／アイスボーン）のクエスト募集を投稿します')
        .addStringOption(option => option
            .setName('target')
            .setDescription('対象モンスターまたはクエスト名')
            .setMinLength(1)
            .setMaxLength(1000)
            .setRequired(true))
        .addStringOption(option => option
            .setName('purpose')
            .setDescription('募集の目的（素材集め、調査など）')
            .setMinLength(1)
            .setMaxLength(1000)
            .setRequired(true))
        .addIntegerOption(option => option
            .setName('slots')
            .setDescription('募集人数（主催者を除く）')
            .addChoices(
                { name: '1人', value: 1 },
                { name: '2人', value: 2 },
                { name: '3人', value: 3 },
            )
            .setRequired(true))
        .addBooleanOption(option => option
            .setName('voice')
            .setDescription('VCを使用する（未入力はなし）'))
        .addStringOption(option => option
            .setName('start_time')
            .setDescription('開始時刻（未入力は今から。例: 21:00）')
            .setMaxLength(100))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('現在と次回のスプラトゥーン3スケジュールを表示します')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('setup_schedule')
        .setDescription('スケジュールの常設確認パネルをこのチャンネルに設置します（管理者用）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    new SlashCommandBuilder()
        .setName('setup_recruit')
        .setDescription('募集用のパネルをこのチャンネルに設置します（管理者用）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    new SlashCommandBuilder()
        .setName('setup_help')
        .setDescription('使い方説明パネルをこのチャンネルに設置します（管理者用）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
];

// コマンド登録の実行
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    console.log('🔄 スラッシュコマンドの登録を開始します...');

    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ スラッシュコマンドを正常に登録しました！');
    } catch (error) {
        console.error('❌ スラッシュコマンド登録エラー:', error);
    }
}

registerCommands();

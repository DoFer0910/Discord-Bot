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

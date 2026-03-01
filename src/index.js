/**
 * スプラトゥーン向け Discord ロール管理Bot
 * ボタンでロールをトグル（付与/解除）する機能を提供
 */

import 'dotenv/config';
import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { sendRolePanels } from './panels.js';
import { handleRoleButton } from './interactions.js';
import { fetchScheduleEmbeds } from './schedule.js';
import { startAutoSchedule } from './autoSchedule.js';

// 環境変数の検証
const { DISCORD_TOKEN, CLIENT_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('❌ .env に DISCORD_TOKEN と CLIENT_ID を設定してください。');
    process.exit(1);
}

// Discord クライアント初期化
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

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
];

// Bot 起動時の処理
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} としてログインしました！`);

    // スラッシュコマンドをグローバル登録
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ スラッシュコマンドを登録しました。');
    } catch (error) {
        console.error('❌ スラッシュコマンド登録エラー:', error);
    }

    // スケジュール自動送信を開始
    startAutoSchedule(client);
});

// インタラクション処理
client.on('interactionCreate', async (interaction) => {
    // スラッシュコマンド処理
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup_roles') {
            await interaction.deferReply({ ephemeral: true });
            try {
                await sendRolePanels(interaction.channel);
                await interaction.editReply({
                    content: '✅ ロール選択パネルを設置しました！',
                });
            } catch (error) {
                console.error('パネル送信エラー:', error);
                await interaction.editReply({
                    content: '❌ パネルの送信に失敗しました。',
                });
            }
        }

        // /schedule コマンド処理
        if (interaction.commandName === 'schedule') {
            await interaction.deferReply();
            const result = await fetchScheduleEmbeds();
            if (result.error) {
                await interaction.editReply({ content: `❌ ${result.error}` });
            } else {
                await interaction.editReply({ embeds: result.embeds });
            }
        }
        return;
    }

    // ボタンインタラクション処理
    if (interaction.isButton()) {
        await handleRoleButton(interaction);
        return;
    }
});

// Bot ログイン
client.login(DISCORD_TOKEN);

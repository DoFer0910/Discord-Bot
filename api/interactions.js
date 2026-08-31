import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import { Routes } from 'discord.js';
import { handleRoleButton, handleRecruitButton, handleHelpButton, postHuntCommand, validateHuntCommand, createDiscordRest, handleHuntButton } from '../src/interactions.js';
import { sendSetupRolesResponse, sendSetupMhRolesResponse, sendSetupScheduleResponse, sendSetupRecruitResponse, sendSetupHelpResponse } from '../src/panels.js';
import { handleScheduleButton, fetchAndSendSchedule } from '../src/schedule.js';

export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

/** Discordへの非同期処理をVercelへ委譲する薄い境界。テストではwaitUntilImplを差し替えられる。 */
export function scheduleBackground(task, waitUntilImpl = vercelWaitUntil) {
    waitUntilImpl(task);
}

/**
 * /huntの初回応答を即時deferし、募集投稿と元メッセージの結果PATCHを背景実行する。
 * Discordの3秒制限を守りつつ、成功／失敗のどちらもユーザーへ返す。
 */
export function deferHuntInteraction(interactionData, {
    waitUntilImpl = vercelWaitUntil,
    restFactory = createDiscordRest,
    postHuntCommandImpl = postHuntCommand,
} = {}) {
    const validation = validateHuntCommand(interactionData);
    if (validation.error) {
        return { type: 4, data: { content: validation.error, flags: 64 } };
    }

    const task = (async () => {
        const result = await postHuntCommandImpl(interactionData);
        try {
            const rest = restFactory();
            await rest.patch(
                Routes.webhookMessage(interactionData.application_id, interactionData.token),
                { body: { content: result.content } },
            );
        } catch (error) {
            console.error('モンハン募集の結果メッセージ更新に失敗しました:', error);
        }
    })();
    scheduleBackground(task, waitUntilImpl);
    return { type: 5, data: { flags: 64 } };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY?.trim();
    if (!PUBLIC_KEY) {
        console.error('DISCORD_PUBLIC_KEY is missing in env');
        return res.status(500).json({ error: 'DISCORD_PUBLIC_KEY is missing in env' });
    }

    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];

    if (!signature || !timestamp) {
        console.error('Missing signature or timestamp', { signature, timestamp });
        return res.status(401).json({ error: 'Missing signature' });
    }

    try {
        const rawBody = await getRawBody(req);

        const isValidRequest = await verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);
        if (!isValidRequest) {
            console.error('Bad request signature');
            return res.status(401).json({ error: 'Bad request signature' });
        }

        const body = JSON.parse(rawBody);

        // Ping
        if (body.type === InteractionType.PING) {
            console.log('Received PING, sending PONG');
            return res.status(200).json({ type: InteractionResponseType.PONG });
        }

        // Slash Commands
        if (body.type === InteractionType.APPLICATION_COMMAND) {
            const { name } = body.data;

            if (name === 'setup_roles') {
                const response = await sendSetupRolesResponse(body);
                return res.status(200).json(response);
            }

            if (name === 'setup_mh_roles') {
                const response = await sendSetupMhRolesResponse(body);
                return res.status(200).json(response);
            }

            if (name === 'hunt') {
                const response = deferHuntInteraction(body);
                return res.status(200).json(response);
            }

            if (name === 'schedule') {
                const response = await fetchAndSendSchedule(body);
                return res.status(200).json(response);
            }

            if (name === 'setup_schedule') {
                const response = await sendSetupScheduleResponse(body);
                return res.status(200).json(response);
            }

            if (name === 'setup_recruit') {
                const response = await sendSetupRecruitResponse(body);
                return res.status(200).json(response);
            }

            if (name === 'setup_help') {
                const response = await sendSetupHelpResponse(body);
                return res.status(200).json(response);
            }
        }

        // Button interactions
        if (body.type === InteractionType.MESSAGE_COMPONENT) {
            const customId = body.data.custom_id;

            // スケジュールパネルのボタン
            if (customId && customId.startsWith('schedule_')) {
                const response = await handleScheduleButton(body, customId);
                return res.status(200).json(response);
            }

            // ロールパネルのボタン
            if (customId && customId.startsWith('role_')) {
                const response = await handleRoleButton(body);
                return res.status(200).json(response);
            }

            // 募集パネルのボタン
            if (customId === 'recruit_everyone') {
                const response = await handleRecruitButton(body);
                return res.status(200).json(response);
            }

            // モンハン募集の参加・辞退・締切ボタン
            if (customId && customId.startsWith('mh_hunt_')) {
                const response = await handleHuntButton(body);
                return res.status(200).json(response);
            }

            // 使い方パネルのボタン
            if (customId === 'show_help') {
                const response = await handleHelpButton(body);
                return res.status(200).json(response);
            }
        }

        return res.status(400).json({ error: 'Unknown interaction type' });

    } catch (err) {
        console.error('Error processing webhook:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

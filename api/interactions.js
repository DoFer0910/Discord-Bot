import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { handleRoleButton } from '../src/interactions.js';
import { sendSetupRolesResponse, sendSetupScheduleResponse } from '../src/panels.js';
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

        const isValidRequest = verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);
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
                res.status(200).json({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { flags: 64 },
                });
                await sendSetupRolesResponse(body);
                return;
            }

            if (name === 'schedule') {
                res.status(200).json({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                });
                await fetchAndSendSchedule(body);
                return;
            }

            if (name === 'setup_schedule') {
                res.status(200).json({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { flags: 64 },
                });
                await sendSetupScheduleResponse(body);
                return;
            }
        }

        // Button interactions
        if (body.type === InteractionType.MESSAGE_COMPONENT) {
            const customId = body.data.custom_id;

            // スケジュールパネルのボタン
            if (customId && customId.startsWith('schedule_')) {
                res.status(200).json({
                    type: InteractionResponseType.DEFERRED_MESSAGE_UPDATE,
                });
                await handleScheduleButton(body, customId);
                return;
            }

            // ロールパネルのボタン
            res.status(200).json({
                type: InteractionResponseType.DEFERRED_MESSAGE_UPDATE,
            });
            await handleRoleButton(body);
            return;
        }

        return res.status(400).json({ error: 'Unknown interaction type' });

    } catch (err) {
        console.error('Error processing webhook:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

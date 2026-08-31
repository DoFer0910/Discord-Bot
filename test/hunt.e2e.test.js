import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  deferHuntInteraction,
  deferMhRecruitModalInteraction,
  deferMhRecruitSetupInteraction,
} from '../api/interactions.js';
import { handleHuntButton } from '../src/interactions.js';
import { HUNT_BUTTON_IDS } from '../src/mh.js';
import {
  MH_RECRUIT_MODAL_PREFIX,
  MH_RECRUIT_OPEN_ID,
  createMhRecruitModalResponse,
} from '../src/mhRecruit.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'discord.openapi.yaml');

async function waitForPrism(port, child) {
  for (let i = 0; i < 120; i += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Prism mock server exited before startup (code: ${child.exitCode})`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v10/guilds/guild-1/roles`);
      if (response.ok) return;
    } catch {
      // Prism起動中は接続拒否になるため、短い間隔で再試行する。
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error('Prism mock server did not start');
}

async function startProxy(targetPort) {
  const requests = [];
  const server = createServer(async (incoming, outgoing) => {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    requests.push({ method: incoming.method, url: incoming.url, body: body.toString('utf8') });

    const upstream = httpRequest({
      hostname: '127.0.0.1',
      port: targetPort,
      path: incoming.url,
      method: incoming.method,
      headers: { ...incoming.headers, host: `127.0.0.1:${targetPort}`, 'content-length': body.length },
    }, response => {
      outgoing.writeHead(response.statusCode || 500, response.headers);
      response.pipe(outgoing);
    });
    upstream.on('error', error => {
      outgoing.statusCode = 502;
      outgoing.end(error.message);
    });
    upstream.end(body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, requests, port: server.address().port };
}

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('Webhookのdefer→Prism REST投稿→結果PATCHと募集操作を一連で通す', async () => {
  const prismPort = await getAvailablePort();
  const prismScript = join(process.cwd(), 'node_modules', '@stoplight', 'prism-cli', 'dist', 'index.js');
  const prism = spawn(process.execPath, [prismScript, 'mock', fixture, '--port', String(prismPort)], {
    shell: false,
    stdio: 'ignore',
  });
  let proxy;
  const previousApiBase = process.env.DISCORD_API_BASE;
  const previousToken = process.env.DISCORD_TOKEN;
  const previousClientId = process.env.CLIENT_ID;
  try {
    await waitForPrism(prismPort, prism);
    proxy = await startProxy(prismPort);
    process.env.DISCORD_API_BASE = `http://127.0.0.1:${proxy.port}`;
    process.env.DISCORD_TOKEN = 'test-token';
    process.env.CLIENT_ID = 'app-1';

    const interaction = {
      application_id: 'app-1',
      token: 'interaction-token',
      channel_id: 'channel-1',
      guild_id: 'guild-1',
      member: { user: { id: 'owner-1', username: 'Owner' } },
      data: {
        name: 'hunt',
        options: [
          { name: 'target', value: '歴戦王ネルギガンテ' },
          { name: 'purpose', value: '素材集め' },
          { name: 'slots', value: 1 },
          { name: 'voice', value: true },
          { name: 'start_time', value: '21:00' },
        ],
      },
    };
    const backgroundTasks = [];
    const deferred = deferHuntInteraction(interaction, {
      waitUntilImpl: task => backgroundTasks.push(task),
    });
    assert.deepEqual(deferred, { type: 5, data: { flags: 64 } });
    assert.equal(backgroundTasks.length, 1);
    await backgroundTasks[0];

    const methods = proxy.requests.map(item => item.method);
    assert.deepEqual(methods, ['GET', 'POST', 'PATCH']);
    const posted = JSON.parse(proxy.requests[1].body);
    assert.deepEqual(posted.allowed_mentions, {
      roles: ['mh-notification-role'], users: [], replied_user: false,
    });
    assert.deepEqual(JSON.parse(proxy.requests[2].body), {
      content: '✅ モンハン募集を投稿しました！',
    });
    assert.equal(proxy.requests[2].url, '/v10/webhooks/app-1/interaction-token/messages/@original');

    // 表示名に危険な文字列が含まれても、role mention以外は許可しない。
    const unsafeInteraction = {
      ...interaction,
      member: { user: { id: 'owner-2', username: '@everyone @here' } },
    };
    const unsafeTasks = [];
    const unsafeDeferred = deferHuntInteraction(unsafeInteraction, {
      waitUntilImpl: task => unsafeTasks.push(task),
    });
    assert.equal(unsafeDeferred.type, 5);
    await unsafeTasks[0];
    const unsafePosted = JSON.parse(proxy.requests[4].body);
    assert.equal(unsafePosted.content.includes('@everyone @here'), true);
    assert.deepEqual(unsafePosted.allowed_mentions, {
      roles: ['mh-notification-role'], users: [], replied_user: false,
    });

    let failurePatch;
    const failedTasks = [];
    const failedDeferred = deferHuntInteraction(interaction, {
      waitUntilImpl: task => failedTasks.push(task),
      postHuntCommandImpl: async () => ({ ok: false, content: '❌ モンハン募集の投稿に失敗しました。' }),
      restFactory: () => ({ patch: async (_route, options) => { failurePatch = options.body; } }),
    });
    assert.equal(failedDeferred.type, 5);
    await failedTasks[0];
    assert.deepEqual(failurePatch, { content: '❌ モンハン募集の投稿に失敗しました。' });

    let message = { embeds: posted.embeds, components: posted.components };
    const joined = await handleHuntButton({
      data: { custom_id: HUNT_BUTTON_IDS.join },
      message,
      member: { user: { id: 'hunter-1', username: 'Hunter' } },
    });
    assert.equal(joined.type, 7);
    message = joined.data;
    const left = await handleHuntButton({
      data: { custom_id: HUNT_BUTTON_IDS.leave },
      message,
      member: { user: { id: 'hunter-1', username: 'Hunter' } },
    });
    assert.equal(left.type, 7);
    message = left.data;
    const rejected = await handleHuntButton({
      data: { custom_id: HUNT_BUTTON_IDS.close },
      message,
      member: { user: { id: 'hunter-1', username: 'Hunter' } },
    });
    assert.equal(rejected.type, 4);
    const closed = await handleHuntButton({
      data: { custom_id: HUNT_BUTTON_IDS.close },
      message,
      member: { user: { id: 'owner-1', username: 'Owner' } },
    });
    assert.equal(closed.type, 7);
    assert.ok(closed.data.components[0].components.every(button => button.disabled));

    const setupStart = proxy.requests.length;
    const setupTasks = [];
    const setupDeferred = deferMhRecruitSetupInteraction({
      application_id: 'app-1',
      token: 'setup-token',
      guild_id: 'guild-1',
      data: { name: 'setup_mh_recruit' },
    }, { waitUntilImpl: task => setupTasks.push(task) });
    assert.deepEqual(setupDeferred, { type: 5, data: { flags: 64 } });
    await setupTasks[0];

    const setupRequests = proxy.requests.slice(setupStart);
    assert.deepEqual(setupRequests.map(item => item.method), ['GET', 'POST', 'GET', 'POST', 'PATCH']);
    assert.equal(setupRequests[0].url, '/v10/guilds/guild-1/channels');
    const createdChannel = JSON.parse(setupRequests[1].body);
    assert.equal(createdChannel.name, 'モンハン募集');
    assert.equal(createdChannel.permission_overwrites.length, 2);
    const setupPanel = JSON.parse(setupRequests[3].body);
    assert.equal(setupPanel.components[0].components[0].custom_id, MH_RECRUIT_OPEN_ID);

    const modalResponse = createMhRecruitModalResponse({ message: { id: 'old-panel' } });
    assert.equal(modalResponse.type, 9);
    assert.equal(modalResponse.data.custom_id, `${MH_RECRUIT_MODAL_PREFIX}old-panel`);

    const modalInteraction = {
      application_id: 'app-1',
      token: 'modal-token',
      channel_id: 'mh-channel',
      guild_id: 'guild-1',
      member: { user: { id: 'owner-3', username: 'Modal Owner' } },
      data: {
        custom_id: `${MH_RECRUIT_MODAL_PREFIX}old-panel`,
        components: [
          { components: [{ custom_id: 'target', value: 'ミラボレアス' }] },
          { components: [{ custom_id: 'purpose', value: '初討伐' }] },
          { components: [{ custom_id: 'slots', value: '３' }] },
          { components: [{ custom_id: 'voice', value: 'あり' }] },
          { components: [{ custom_id: 'start_time', value: '22:00' }] },
        ],
      },
    };
    const modalStart = proxy.requests.length;
    const modalTasks = [];
    const modalDeferred = deferMhRecruitModalInteraction(modalInteraction, {
      waitUntilImpl: task => modalTasks.push(task),
    });
    assert.deepEqual(modalDeferred, { type: 5, data: { flags: 64 } });
    await modalTasks[0];

    const modalRequests = proxy.requests.slice(modalStart);
    assert.deepEqual(modalRequests.map(item => item.method), ['GET', 'POST', 'POST', 'DELETE', 'PATCH']);
    const huntFromModal = JSON.parse(modalRequests[1].body);
    assert.equal(huntFromModal.embeds[0].fields.find(field => field.name === '対象').value, 'ミラボレアス');
    const latestPanel = JSON.parse(modalRequests[2].body);
    assert.equal(latestPanel.components[0].components[0].custom_id, MH_RECRUIT_OPEN_ID);
    assert.equal(modalRequests[3].url, '/v10/channels/mh-channel/messages/old-panel');
    assert.equal(modalRequests[4].url, '/v10/webhooks/app-1/modal-token/messages/@original');
  } finally {
    if (proxy) proxy.server.close();
    prism.kill();
    if (previousApiBase === undefined) delete process.env.DISCORD_API_BASE;
    else process.env.DISCORD_API_BASE = previousApiBase;
    if (previousToken === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = previousToken;
    if (previousClientId === undefined) delete process.env.CLIENT_ID;
    else process.env.CLIENT_ID = previousClientId;
  }
});

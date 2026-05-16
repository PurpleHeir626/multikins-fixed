const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const http = require('http');

const bots = [
  { token: process.env.BOT_TOKEN_1, kindroidId: process.env.KINDROID_AI_ID_1, shareCode: process.env.KINDROID_SHARE_CODE_1, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 1 },
  { token: process.env.BOT_TOKEN_2, kindroidId: process.env.KINDROID_AI_ID_2, shareCode: process.env.KINDROID_SHARE_CODE_2, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 2 },
  { token: process.env.BOT_TOKEN_3, kindroidId: process.env.KINDROID_AI_ID_3, shareCode: process.env.KINDROID_SHARE_CODE_3, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 3 },
  { token: process.env.BOT_TOKEN_4, kindroidId: process.env.KINDROID_AI_ID_4, shareCode: process.env.KINDROID_SHARE_CODE_4, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 4 },
  { token: process.env.BOT_TOKEN_5, kindroidId: process.env.KINDROID_AI_ID_5, shareCode: process.env.KINDROID_SHARE_CODE_5, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 5 },
  { token: process.env.BOT_TOKEN_6, kindroidId: process.env.KINDROID_AI_ID_6, shareCode: process.env.KINDROID_SHARE_CODE_6, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 6 },
  { token: process.env.BOT_TOKEN_7, kindroidId: process.env.KINDROID_AI_ID_7, shareCode: process.env.KINDROID_SHARE_CODE_7, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 7 },
  { token: process.env.BOT_TOKEN_8, kindroidId: process.env.KINDROID_AI_ID_8, shareCode: process.env.KINDROID_SHARE_CODE_8, apiKey: process.env.KINDROID_API_KEY, inferUrl: process.env.KINDROID_INFER_URL || 'https://api.kindroid.ai/v1/discord-bot', index: 8 },
];

function loadMemory(index) {
  try {
    return JSON.parse(fs.readFileSync(`memory_bot${index}.json`, 'utf8')) || {};
  } catch {
    return {};
  }
}

function saveMemory(index, memory) {
  fs.writeFileSync(`memory_bot${index}.json`, JSON.stringify(memory, null, 2));
}

async function sendToKindroid(message, config) {
  const memory = loadMemory(config.index);
  const uid = message.author.id;

  if (!memory[uid]) memory[uid] = { facts: [], history: [] };
  memory[uid].history.push({ role: 'user', content: message.content });

  // Use share code if available, otherwise fall back to kindroidId
  const identifier = config.shareCode || config.kindroidId;

  try {
    const response = await fetch(config.inferUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kindroidId: identifier,
        shareCode: config.shareCode,
        message: message.content,
        memory: memory[uid]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bot ${config.index} Kindroid HTTP error ${response.status}: ${errorText}`);
      return `Sorry, I'm having trouble connecting right now. (Error ${response.status})`;
    }

    const data = await response.json();
    const aiReply = data.reply || "No response";

    memory[uid].history.push({ role: 'assistant', content: aiReply });
    saveMemory(config.index, memory);

    return aiReply;
  } catch (error) {
    console.error(`Bot ${config.index} Kindroid error:`, error.message);
    return "I'm having trouble connecting to my AI right now. Please try again shortly.";
  }
}

function createBot(config) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once('ready', () => {
    console.log(`Bot ${config.index} ready! Logged in as ${client.user.tag}`);
  });

  let memorySaveEnabled = true;

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    console.log(`Bot ${config.index} received message from ${message.author.username}: "${message.content.substring(0, 80)}"`);

    const lowered = message.content.toLowerCase().trim();

    if (lowered === '!ping') {
      try {
        await message.reply(`Bot ${config.index} is online and responding!`);
      } catch (err) {
        console.error(`Bot ${config.index} failed to send ping reply:`, err.message);
      }
      return;
    }

    if (lowered === 'memory on') {
      memorySaveEnabled = true;
      try { await message.reply("Memory saving is now **ON**."); } catch (err) { console.error(`Bot ${config.index} reply error:`, err.message); }
      return;
    }

    if (lowered === 'memory off') {
      memorySaveEnabled = false;
      try { await message.reply("Memory saving is now **OFF**."); } catch (err) { console.error(`Bot ${config.index} reply error:`, err.message); }
      return;
    }

    if (!memorySaveEnabled) return;

    if (lowered === 'lexport') {
      const mem = loadMemory(config.index);
      const json = JSON.stringify(mem, null, 2);
      try {
        if (json.length > 1900) {
          await message.reply({
            content: 'Memory export:',
            files: [{ attachment: Buffer.from(json), name: `memory_bot${config.index}.json` }],
          });
        } else {
          await message.reply("```json\n" + json + "\n```");
        }
      } catch (err) {
        console.error(`Bot ${config.index} reply error:`, err.message);
      }
      return;
    }

    if (lowered.startsWith('iremember ')) {
      const fact = message.content.slice(10).trim();
      if (!fact) {
        try { await message.reply('What should I remember?'); } catch (err) { console.error(`Bot ${config.index} reply error:`, err.message); }
        return;
      }
      const uid = message.author.id;
      const memory = loadMemory(config.index);
      if (!memory[uid]) memory[uid] = { facts: [], history: [] };
      if (!memory[uid].facts) memory[uid].facts = [];
      memory[uid].facts.push(fact);
      saveMemory(config.index, memory);
      try { await message.reply(`Remembered: ${fact}`); } catch (err) { console.error(`Bot ${config.index} reply error:`, err.message); }
      return;
    }

    const reply = await sendToKindroid(message, config);
    try {
      await message.reply(reply);
    } catch (err) {
      console.error(`Bot ${config.index} failed to send reply:`, err.message);
    }
  });

  client.on('error', (error) => {
    console.error(`Bot ${config.index} client error:`, error.message);
  });

  client.login(config.token)
    .then(() => console.log(`Bot ${config.index} login successful`))
    .catch(err => console.error(`Bot ${config.index} login failed:`, err.message));

  setTimeout(() => {
    if (!client.isReady()) {
      console.error(`Bot ${config.index} timed out - still not connected after 30s`);
    }
  }, 30000);
}

bots.filter(b => b.token && b.kindroidId).forEach((config, i) => {
  setTimeout(() => createBot(config), i * 6000);
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('OK')).listen(PORT, () => {
  console.log(`Health check server on port ${PORT}`);
});
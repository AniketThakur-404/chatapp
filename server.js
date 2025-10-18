// server.js
const express = require('express');
const axios = require('axios');
const path = require('path');
const WhatsAppCarProtectionBot = require('./bot');
require('dotenv').config(); // for local dev; Vercel injects envs automatically

const app = express();
const bot = new WhatsAppCarProtectionBot();

// ---- ENV VARS ----
const requiredEnv = ['VERIFY_TOKEN', 'ACCESS_TOKEN', 'PHONE_NUMBER_ID'];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
}
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || '';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';

// ---- MIDDLEWARE ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Safe logging (redact auth)
app.use((req, res, next) => {
  const { method, path, headers, body } = req;
  const redactedHeaders = { ...headers };
  if (redactedHeaders.authorization) redactedHeaders.authorization = '***redacted***';

  console.log(`${new Date().toISOString()} - ${method} ${path}`);
  console.log('Headers:', JSON.stringify(redactedHeaders, null, 2));
  if (body && Object.keys(body).length > 0) {
    console.log('Body:', JSON.stringify(body, null, 2));
  }
  next();
});

// (Optional) serve static files
app.use(express.static('public'));

// ---- HEALTH / ROOT ----
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/status', (req, res) => {
  res.json({
    message: 'WhatsApp Car Protection Chatbot Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: { webhook: '/webhook', test: '/test-message' }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- WEBHOOK VERIFY (GET) ----
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  console.log('❌ Webhook verification failed', {
    mode,
    tokenReceived: token ? 'present' : 'missing'
  });
  return res.status(403).send('Verification failed');
});

// ---- WEBHOOK RECEIVE (POST) ----
app.post('/webhook', async (req, res) => {
  console.log('📨 POST /webhook called');

  try {
    // Acknowledge immediately
    res.status(200).json({ status: 'received' });

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      console.log(`⚠️ Ignoring object type: ${body.object}`);
      return;
    }

    const change = body?.entry?.[0]?.changes?.[0];
    if (!change) {
      console.log('⚠️ No change payload');
      return;
    }

    const messages = change.value?.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      if (change.value?.statuses) {
        console.log('📊 Status update:', JSON.stringify(change.value.statuses, null, 2));
      } else {
        console.log('⚠️ No messages in change');
      }
      return;
    }

    const message = messages[0];
    const senderId = message.from;
    let messageText = '';

    if (message.type === 'text') {
      messageText = message.text?.body ?? '';
      console.log(`📝 Text from ${senderId}: ${messageText}`);
    } else if (message.type === 'interactive') {
      if (message.interactive.type === 'button_reply') {
        messageText = message.interactive.button_reply.title;
      } else if (message.interactive.type === 'list_reply') {
        messageText = message.interactive.list_reply.title;
      }
      console.log(`🔘 Interactive from ${senderId}: ${messageText}`);
    } else {
      console.log(`⚠️ Unsupported message type: ${message.type}`);
      return;
    }

    // Process via your bot
    const botResponse = bot.processMessage(senderId, messageText || '');
    console.log('🤖 Bot response:', JSON.stringify(botResponse, null, 2));

    // Send back to WhatsApp
    await sendWhatsAppResponse(senderId, botResponse);
  } catch (error) {
    console.error('❌ Webhook handler error:', error?.response?.data || error);
  }
});

// ---- TEST ENDPOINTS ----
app.post('/test-message', (req, res) => {
  const { userId = 'test-user', message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const response = bot.processMessage(userId, message);
  res.json({
    userId,
    userMessage: message,
    botResponse: response,
    sessionData: bot.getSession(userId)
  });
});

app.get('/session/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ userId, sessionData: bot.getSession(userId) });
});

app.delete('/session/:userId', (req, res) => {
  const { userId } = req.params;
  bot.sessions.delete(userId);
  res.json({ userId, message: 'Session reset successfully' });
});

// ---- SENDER ----
async function sendWhatsAppResponse(to, response) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.error('❌ ACCESS_TOKEN or PHONE_NUMBER_ID missing — cannot send WhatsApp message.');
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };

  let data;

  if (response?.buttons?.length) {
    // Up to 10 options → interactive list
    if (response.buttons.length <= 10) {
      data = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Select an option' },
          body: { text: response.text || 'Choose an option:' },
          action: {
            button: 'View Options',
            sections: [
              {
                title: 'Available Options',
                rows: response.buttons.map((button, index) => {
                  const fullText = String(button || '').trim();
                  const title = fullText.slice(0, 24);
                  const description = fullText.length > 24 ? fullText.slice(24, 96) : '';
                  return {
                    id: `option_${index}_${Date.now()}`,
                    title,
                    description
                  };
                })
              }
            ]
          }
        }
      };
    } else {
      // > 10 → fallback to numbered text
      let textWithButtons = `${response.text || ''}\n\n*Reply with number:*\n`;
      response.buttons.forEach((b, i) => (textWithButtons += `\n${i + 1}. ${b}`));
      data = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body: textWithButtons }
      };
    }
  } else {
    // Plain text
    data = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: response?.text || '' }
    };
  }

  console.log('📤 Sending WhatsApp payload:', JSON.stringify(data, null, 2));

  try {
    const apiResponse = await axios.post(url, data, { headers, timeout: 30000 });
    console.log('✅ Message sent:', apiResponse.data);
    return apiResponse.data;
  } catch (error) {
    console.error('❌ WhatsApp API error:', error?.response?.data || error.message);

    // Fallback if interactive fails
    if (data.type === 'interactive') {
      try {
        const fallbackData = {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body: `${response?.text || ''}\n\nPlease type your choice.`
          }
        };
        const fallbackRes = await axios.post(url, fallbackData, { headers, timeout: 10000 });
        console.log('✅ Fallback sent:', fallbackRes.data);
        return fallbackRes.data;
      } catch (fallbackErr) {
        console.error('❌ Fallback failed:', fallbackErr?.response?.data || fallbackErr.message);
      }
    }
  }
}

// ---- EXPORTS & LOCAL DEV ----
// Export the Express app so Vercel (@vercel/node) can handle it
module.exports = app;

// Local dev: only listen when run directly (not on Vercel)
if (require.main === module) {
  const DEFAULT_PORT = Number(process.env.PORT) || 3000;
  const MAX_RETRIES = 5;

  const tryListen = (portToTry, attempt = 0) => {
    const server = app.listen(portToTry, () => {
      console.log(`Local dev server: http://localhost:${portToTry}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < MAX_RETRIES) {
        const nextPort = portToTry + 1;
        console.warn(`⚠️ Port ${portToTry} in use. Trying ${nextPort}...`);
        tryListen(nextPort, attempt + 1);
      } else {
        console.error('❌ Failed to start server:', err);
        console.error(
          '➡️  Set a free port with "set PORT=3001" (PowerShell) or "PORT=3001 npm start" (bash) and retry.'
        );
      }
    });
  };

  tryListen(DEFAULT_PORT);
}

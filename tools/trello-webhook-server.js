#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

// 極簡 Trello Webhook 伺服器：驗證 ping、接收事件並輸出差異報告
// 注意：要在公網可達的 URL 上運行，並於 Trello 註冊 webhook

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ type: '*/*' }));

const PORT = Number(process.env.TRELLO_WEBHOOK_PORT || 4300);
const APP_SECRET = process.env.TRELLO_APP_SECRET || '';

function verifySignature(req) {
  if (!APP_SECRET) return true; // 未設定則跳過驗證（開發用）
  const base = (process.env.TRELLO_WEBHOOK_CALLBACK_URL || '') + JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha1', APP_SECRET).update(base).digest('base64');
  const got = req.get('x-trello-webhook');
  return hmac === got;
}

app.head('/trello/webhook', (req, res) => {
  // Trello 建立 webhook 時會先發 HEAD 以確認 200
  res.status(200).end();
});

app.post('/trello/webhook', (req, res) => {
  if (!verifySignature(req)) {
    res.status(401).send('invalid signature');
    return;
  }
  const payload = req.body || {};
  try {
    const outDir = path.resolve(process.cwd(), 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, 'trello-webhook-events.ndjson');
    fs.appendFileSync(out, JSON.stringify({ ts: new Date().toISOString(), payload }) + '\n', 'utf8');
  } catch (e) {
    console.error('[webhook] write error', e);
  }
  res.status(200).send('ok');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[trello-webhook] listening on :${PORT}`);
});



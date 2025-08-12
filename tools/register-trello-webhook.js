#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

require('dotenv').config();
const fetch = require('node-fetch');

function env(name, required = true) {
  const v = process.env[name];
  if (!v && required) {
    console.error(`[缺少環境變數] ${name}`);
    process.exit(1);
  }
  return v || '';
}

const KEY = env('TRELLO_KEY');
const TOKEN = env('TRELLO_TOKEN');
const BOARD_ID = env('TRELLO_BOARD_ID');
const CALLBACK_URL = env('TRELLO_WEBHOOK_CALLBACK_URL');

async function trello(method, path, params = {}, body) {
  const qs = new URLSearchParams({ key: KEY, token: TOKEN, ...params }).toString();
  const url = `https://api.trello.com/1${path}?${qs}`;
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`${method} ${path} ${res.status} ${t}`);
  }
  return res.json();
}

async function main() {
  const existing = await trello('GET', '/tokens/' + TOKEN + '/webhooks');
  const found = existing.find(w => w.callbackURL === CALLBACK_URL && w.idModel === BOARD_ID);
  if (found) {
    console.log('[webhook] 已存在：', found.id);
    return;
  }
  const created = await trello('POST', '/webhooks', {
    callbackURL: CALLBACK_URL,
    idModel: BOARD_ID,
    description: 'Course MVP sync webhook'
  });
  console.log('[webhook] 已建立：', created.id);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});



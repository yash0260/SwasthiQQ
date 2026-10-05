// api.js — Backend communication layer
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function runConversation(payload) {
  const res = await fetch(`${BASE}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listConversations() {
  const res = await fetch(`${BASE}/conversations`);
  if (!res.ok) throw new Error('Failed to load conversations');
  const data = await res.json();
  return data.conversations || [];
}

export async function getConversation(id) {
  const res = await fetch(`${BASE}/conversations/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

// MythX Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Context menu for selected text
  chrome.contextMenus.create({
    id: 'mythx-analyze-text',
    title: '⚡ MythX: Fact-Check Selected Text',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'mythx-analyze-image',
    title: '⚡ MythX: Analyze This Image',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'mythx-analyze-text' && info.selectionText) {
    const result = await analyzeContent({ text: info.selectionText });
    showNotification(result);
    
    // Inject result into page
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showMythXOverlay,
      args: [result, info.selectionText]
    });
  }
  
  if (info.menuItemId === 'mythx-analyze-image' && info.srcUrl) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showMythXOverlay,
      args: [{ verdict: 'UNVERIFIED', explanation: 'Open popup to analyze image with full AI vision.', confidence: 0, red_flags: [] }, info.srcUrl]
    });
  }
});

async function analyzeContent({ text, imageBase64 }) {
  const storage = await chrome.storage.local.get(['gemini_key']);
  const apiKey = storage.gemini_key;
  
  if (!apiKey) {
    return { verdict: 'UNVERIFIED', explanation: 'Please set your Gemini API key in the MythX extension popup.', confidence: 0, red_flags: [] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const parts = [
    { text: `Analyze for fake news. Respond ONLY with JSON: {"verdict":"REAL"|"FAKE"|"MISLEADING"|"UNVERIFIED","confidence":<0-100>,"explanation":"<2 sentences>","red_flags":["..."]}` },
    { text: 'CONTENT: ' + text }
  ];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 256 } })
    });
    const data = await res.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const match = rawText.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { verdict: 'UNVERIFIED', explanation: 'Analysis incomplete.', confidence: 0, red_flags: [] };
  } catch (e) {
    return { verdict: 'UNVERIFIED', explanation: 'Error: ' + e.message, confidence: 0, red_flags: [] };
  }
}

function showNotification(result) {
  const icons = { REAL: '✅', FAKE: '🚫', MISLEADING: '⚠️', UNVERIFIED: '🔍' };
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: `MythX: ${icons[result.verdict] || ''} ${result.verdict}`,
    message: result.explanation || 'Analysis complete'
  });
}

// This function runs in the page context
function showMythXOverlay(result, content) {
  // Remove existing overlay
  const existing = document.getElementById('mythx-overlay');
  if (existing) existing.remove();

  const colors = { REAL: '#00C896', FAKE: '#FF3B5C', MISLEADING: '#FF8C00', UNVERIFIED: '#A78BFA' };
  const icons = { REAL: '✅', FAKE: '🚫', MISLEADING: '⚠️', UNVERIFIED: '🔍' };
  const color = colors[result.verdict] || '#A78BFA';

  const overlay = document.createElement('div');
  overlay.id = 'mythx-overlay';
  overlay.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 999999;
    background: #0f0f12; border: 1px solid ${color}44; border-radius: 16px;
    padding: 1rem 1.2rem; max-width: 320px; box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${color}22;
    font-family: 'Syne', sans-serif; color: #f0eee8; animation: mythx-fadein 0.3s ease;
  `;

  overlay.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400&display=swap');
      @keyframes mythx-fadein { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <div style="background:#c8ff00;border-radius:5px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;">⚡</div>
        <span style="font-weight:800;font-size:0.85rem;letter-spacing:-0.02em;">Myth<span style="color:#c8ff00;">X</span></span>
      </div>
      <button onclick="document.getElementById('mythx-overlay').remove()" style="background:none;border:none;color:#6b6870;cursor:pointer;font-size:1rem;padding:0;">×</button>
    </div>
    <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.6rem;">
      <span style="font-size:1.3rem;">${icons[result.verdict] || '🔍'}</span>
      <div>
        <div style="font-weight:800;font-size:1rem;color:${color};letter-spacing:-0.02em;">${result.verdict}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:#6b6870;">Confidence: ${result.confidence || 0}%</div>
      </div>
    </div>
    <p style="font-size:0.75rem;line-height:1.5;color:#f0eee8;opacity:0.8;margin-bottom:0.5rem;">${result.explanation || ''}</p>
    ${(result.red_flags || []).slice(0,2).map(f => `
      <div style="font-size:0.68rem;color:#FF8C00;margin-top:0.2rem;">⚠ ${f}</div>
    `).join('')}
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.55rem;color:#6b6870;margin-top:0.6rem;text-align:right;">MYTHX TRUTH ENGINE</div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 12000);
}

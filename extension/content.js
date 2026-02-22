// MythX Content Script - Auto-adds fact-check buttons to social media posts

(function() {
  'use strict';
  
  let apiKey = null;
  chrome.storage.local.get(['gemini_key'], (r) => { apiKey = r.gemini_key; });

  // Platform configs
  const platforms = {
    'twitter.com': { postSelector: 'article[data-testid="tweet"]', textSelector: '[data-testid="tweetText"]' },
    'x.com': { postSelector: 'article[data-testid="tweet"]', textSelector: '[data-testid="tweetText"]' },
    'reddit.com': { postSelector: '[data-testid="post-container"]', textSelector: '[data-testid="post-container"] p' },
  };

  const hostname = window.location.hostname.replace('www.', '');
  const platform = Object.keys(platforms).find(k => hostname.includes(k));
  if (!platform) return;

  const config = platforms[platform];

  function addMythXButton(post) {
    if (post.querySelector('.mythx-btn')) return;
    
    const textEl = post.querySelector(config.textSelector);
    if (!textEl) return;

    const btn = document.createElement('button');
    btn.className = 'mythx-btn';
    btn.innerHTML = '⚡ MythX Check';
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!apiKey) {
        alert('Please set your Gemini API key in the MythX extension popup.');
        return;
      }
      
      btn.innerHTML = '⏳ Analyzing...';
      btn.disabled = true;
      
      const text = textEl.innerText.trim().slice(0, 1000);
      const result = await analyzeText(text);
      showInlineResult(post, result);
      
      btn.innerHTML = '⚡ MythX ✓';
      btn.disabled = false;
    };

    // Try to append to the post actions area
    const actions = post.querySelector('[role="group"]') || post;
    actions.appendChild(btn);
  }

  async function analyzeText(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const parts = [
      { text: `Fact-check this content. JSON only: {"verdict":"REAL"|"FAKE"|"MISLEADING"|"UNVERIFIED","confidence":<0-100>,"explanation":"<1-2 sentences>","red_flags":["..."]}` },
      { text: text }
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
      return match ? JSON.parse(match[0]) : { verdict: 'UNVERIFIED', explanation: 'Could not analyze.', confidence: 0, red_flags: [] };
    } catch(e) {
      return { verdict: 'UNVERIFIED', explanation: 'Error: ' + e.message, confidence: 0, red_flags: [] };
    }
  }

  function showInlineResult(post, result) {
    const existing = post.querySelector('.mythx-result');
    if (existing) existing.remove();

    const colors = { REAL: '#00C896', FAKE: '#FF3B5C', MISLEADING: '#FF8C00', UNVERIFIED: '#A78BFA' };
    const icons = { REAL: '✅', FAKE: '🚫', MISLEADING: '⚠️', UNVERIFIED: '🔍' };
    const color = colors[result.verdict] || '#A78BFA';

    const div = document.createElement('div');
    div.className = 'mythx-result';
    div.style.cssText = `
      margin: 8px 0; padding: 10px 14px;
      background: ${color}12; border: 1px solid ${color}33;
      border-radius: 10px; font-family: system-ui, sans-serif;
    `;
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:1rem;">${icons[result.verdict]}</span>
        <strong style="color:${color};font-size:0.85rem;">${result.verdict}</strong>
        <span style="color:#888;font-size:0.72rem;">${result.confidence}% confidence</span>
        <span style="margin-left:auto;font-size:0.7rem;color:#888;font-weight:600;">⚡ MythX</span>
      </div>
      <p style="font-size:0.78rem;color:#ccc;margin:0;line-height:1.45;">${result.explanation}</p>
      ${(result.red_flags||[]).slice(0,2).map(f => `<div style="font-size:0.7rem;color:#FF8C00;margin-top:3px;">⚠ ${f}</div>`).join('')}
    `;

    post.appendChild(div);
  }

  // Observer to handle dynamically loaded posts
  const observer = new MutationObserver(() => {
    document.querySelectorAll(config.postSelector).forEach(addMythXButton);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll(config.postSelector).forEach(addMythXButton);
})();

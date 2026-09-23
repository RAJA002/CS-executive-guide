// Study bot — calls Groq's API directly from the browser.
// The API key lives ONLY in this browser's localStorage. It is never sent
// anywhere except https://api.groq.com, never written into any file in this
// repo, and never seen by anyone else who visits the published site.

const GROQ_KEY_STORAGE = "groq_api_key";
const GROQ_MODEL_STORAGE = "groq_model_choice";
let botHistory = [];

function getGroqKey() { return localStorage.getItem(GROQ_KEY_STORAGE) || ""; }
function setGroqKey(k) { localStorage.setItem(GROQ_KEY_STORAGE, k.trim()); }
function getModel() { return localStorage.getItem(GROQ_MODEL_STORAGE) || "llama-3.3-70b-versatile"; }
function setModel(m) { localStorage.setItem(GROQ_MODEL_STORAGE, m); }

// ---------- Book search (retrieval over the extracted PDF text) ----------
const BOOK_SOURCES = { cmsl: "Capital Market & Securities Laws", ecip: "Economic, Commercial & IP Laws", tax: "Tax Laws & Practice" };
let bookIndex = null; // loaded once, cached: [{paper, p, t, words}]

const STOPWORDS = new Set("a an the of to in on for and or is are was were be been being this that these those it its as at by from with about into over under between which what who whom whose when where why how not no can may shall will would should could i you he she they we".split(" "));

function tokenize(str) {
  return (str.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 2 && !STOPWORDS.has(w));
}

async function loadBookIndex() {
  if (bookIndex) return bookIndex;
  const ids = Object.keys(BOOK_SOURCES);
  const results = await Promise.all(ids.map(id =>
    fetch(`assets/text/${id}.json`).then(r => r.ok ? r.json() : []).catch(() => [])
  ));
  bookIndex = [];
  ids.forEach((id, i) => {
    (results[i] || []).forEach(pg => {
      bookIndex.push({ paper: id, p: pg.p, t: pg.t, words: tokenize(pg.t) });
    });
  });
  return bookIndex;
}

// Score each page by how many query keywords it contains, return the best few.
async function searchBook(query, topN = 5) {
  const index = await loadBookIndex();
  const qWords = [...new Set(tokenize(query))];
  if (qWords.length === 0) return [];
  const scored = index.map(pg => {
    let score = 0;
    qWords.forEach(qw => {
      const count = pg.words.reduce((n, w) => n + (w === qw || w.startsWith(qw) ? 1 : 0), 0);
      score += count;
    });
    return { ...pg, score };
  }).filter(pg => pg.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

function buildContextBlock(matches) {
  if (matches.length === 0) return "";
  const MAX_CHARS = 7000;
  let used = 0;
  const parts = [];
  for (const m of matches) {
    let snippet = m.t;
    if (used + snippet.length > MAX_CHARS) {
      snippet = snippet.slice(0, Math.max(0, MAX_CHARS - used));
    }
    if (!snippet) break;
    parts.push(`[${BOOK_SOURCES[m.paper]} — p.${m.p}]\n${snippet}`);
    used += snippet.length;
    if (used >= MAX_CHARS) break;
  }
  return parts.join("\n\n---\n\n");
}

function injectBotWidget() {
  const toggle = document.createElement("button");
  toggle.id = "bot-toggle";
  toggle.textContent = "AI";
  toggle.title = "Ask the study bot";
  document.body.appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = "bot-panel";
  panel.innerHTML = `
    <div class="bot-head">
      <span>CS Study Bot</span>
      <div class="bot-head-actions">
        <button id="bot-maximize" title="Maximize">⤢</button>
        <button id="bot-settings-toggle" title="Settings">⚙</button>
        <button id="bot-close" title="Close">✕</button>
      </div>
    </div>
    <div id="bot-body">
      <div class="bot-messages" id="bot-messages"></div>
      <div class="bot-select-row">
        Model:
        <select id="bot-model-select">
          <option value="llama-3.3-70b-versatile">Llama 3.3 70B (fast, default)</option>
          <option value="openai/gpt-oss-120b">GPT-OSS 120B (stronger reasoning)</option>
        </select>
      </div>
      <div class="bot-input-row">
        <input id="bot-input" type="text" placeholder="Ask about any topic..." />
        <button id="bot-send">Send</button>
      </div>
    </div>
    <div id="bot-settings-panel" class="bot-settings" style="display:none;">
      <p>Your Groq API key is stored only in this browser (localStorage). It's never sent anywhere except Groq's API, and it's never written into the site's code.</p>
      <input id="bot-key-input" type="password" placeholder="gsk_..." />
      <button id="bot-key-save">Save key</button>
      <p>Don't have one? Get a free key at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> — takes about 2 minutes, no card required.</p>
    </div>
  `;
  document.body.appendChild(panel);

  const messages = document.getElementById("bot-messages");
  const modelSelect = document.getElementById("bot-model-select");
  modelSelect.value = getModel();
  modelSelect.addEventListener("change", () => setModel(modelSelect.value));

  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open") && !getGroqKey()) {
      showSettings(true);
    }
  });
  document.getElementById("bot-close").addEventListener("click", () => panel.classList.remove("open"));
  document.getElementById("bot-maximize").addEventListener("click", () => {
    panel.classList.toggle("maximized");
    document.getElementById("bot-maximize").textContent = panel.classList.contains("maximized") ? "⤡" : "⤢";
    document.getElementById("bot-maximize").title = panel.classList.contains("maximized") ? "Restore" : "Maximize";
  });
  document.getElementById("bot-settings-toggle").addEventListener("click", () => {
    showSettings(document.getElementById("bot-settings-panel").style.display === "none");
  });

  function showSettings(show) {
    document.getElementById("bot-settings-panel").style.display = show ? "block" : "none";
    document.getElementById("bot-body").style.display = show ? "none" : "flex";
    document.getElementById("bot-body").style.flexDirection = "column";
    document.getElementById("bot-body").style.flex = "1";
  }
  showSettings(!getGroqKey());

  document.getElementById("bot-key-save").addEventListener("click", () => {
    const val = document.getElementById("bot-key-input").value;
    if (val.trim()) {
      setGroqKey(val);
      document.getElementById("bot-key-input").value = "";
      showSettings(false);
      addMessage("system", "Key saved to this browser. Ask away.");
    }
  });

  document.getElementById("bot-send").addEventListener("click", sendBotMessage);
  document.getElementById("bot-input").addEventListener("keydown", e => {
    if (e.key === "Enter") sendBotMessage();
  });

  if (botHistory.length === 0) {
    addMessage("system", "Ask me anything about your 3 subjects — I'll answer from general knowledge of Indian company/tax/securities law. Always cross-check exam-critical points against your official study material.");
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Lightweight markdown renderer — handles the patterns Groq's models actually
// use in replies (bold, headings, bullet lists, horizontal rules, paragraphs).
function renderMarkdown(raw) {
  const lines = escapeHtml(raw).split("\n");
  let html = "";
  let inList = false;
  let i = 0;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") { closeList(); i++; continue; }

    // Table: any consecutive block of pipe-delimited lines (tolerates a
    // truncated trailing row if the AI's reply got cut off mid-sentence)
    if (/^\|/.test(trimmed)) {
      closeList();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        rows.push(lines[i].trim());
        i++;
      }
      const cellsOf = row => row.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
      const sepIdx = rows.findIndex(r => /^\|[\s:|-]+\|?$/.test(r));
      html += `<div class="table-scroll"><table>`;
      if (sepIdx === 1) {
        const headerCells = cellsOf(rows[0]);
        html += "<thead><tr>" + headerCells.map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
        for (let r = 2; r < rows.length; r++) {
          if (/^\|[\s:|-]+\|?$/.test(rows[r])) continue;
          html += "<tr>" + cellsOf(rows[r]).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>";
        }
        html += "</tbody>";
      } else {
        rows.forEach(row => {
          if (/^\|[\s:|-]+\|?$/.test(row)) return;
          html += "<tr>" + cellsOf(row).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>";
        });
      }
      html += "</table></div>";
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) { closeList(); html += "<hr>"; i++; continue; }

    const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (heading) { closeList(); html += `<h4>${inline(heading[1])}</h4>`; i++; continue; }

    const quote = trimmed.match(/^&gt;\s?(.*)$/);
    if (quote) { closeList(); html += `<blockquote>${inline(quote[1])}</blockquote>`; i++; continue; }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(bullet[1])}</li>`;
      i++; continue;
    }

    closeList();
    html += `<p>${inline(trimmed)}</p>`;
    i++;
  }
  closeList();
  return html;

  function inline(text) {
    return text
      .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }
}

function addMessage(role, text) {
  botHistory.push({ role, text });
  const messages = document.getElementById("bot-messages");
  const div = document.createElement("div");
  div.className = `bot-msg ${role}`;
  const bubble = document.createElement("span");
  bubble.className = "bubble";
  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  div.appendChild(bubble);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

async function sendBotMessage() {
  const input = document.getElementById("bot-input");
  const text = input.value.trim();
  if (!text) return;
  const key = getGroqKey();
  if (!key) {
    document.getElementById("bot-settings-panel").style.display = "block";
    document.getElementById("bot-body").style.display = "none";
    return;
  }
  addMessage("user", text);
  input.value = "";
  addMessage("system", "Searching the study material...");
  const thinkingNode = document.getElementById("bot-messages").lastChild;

  try {
    const matches = await searchBook(text);
    thinkingNode.querySelector(".bubble").textContent = "Thinking...";
    const context = buildContextBlock(matches);
    const reply = await callGroq(key, text, context, matches);
    thinkingNode.remove();
    botHistory.pop(); // remove the "Thinking..." placeholder from history
    addMessage("assistant", reply);
  } catch (err) {
    thinkingNode.remove();
    botHistory.pop();
    addMessage("system", `Error: ${err.message}. Check that your API key is correct in Settings (⚙).`);
  }
}

function openBotWithPrompt(promptText, paperId) {
  const panel = document.getElementById("bot-panel");
  panel.classList.add("open");
  if (!getGroqKey()) {
    document.getElementById("bot-settings-panel").style.display = "block";
    document.getElementById("bot-body").style.display = "none";
    return;
  }
  document.getElementById("bot-input").value = promptText;
  sendBotMessage();
}

async function callGroq(key, userText, context, matches) {
  let systemPrompt = `You are a study assistant for a student preparing for the ICSI Company Secretary (CS) Executive Programme, Group 2 (Module 2): Paper 5 Capital Market & Securities Laws, Paper 6 Economic, Commercial & Intellectual Property Laws, Paper 7 Tax Laws & Practice. Answer clearly and concisely, structured for exam revision. Keep answers reasonably compact — prefer short tables (2-3 columns, under 8 rows) or bullet points over long, wide tables, since this is a narrow chat window.`;

  if (context) {
    systemPrompt += `\n\nBelow are excerpts retrieved from the student's own official ICSI study material (matched by keyword search against their question — may or may not be fully relevant). Prioritise these excerpts as your primary source when they're relevant; if they don't cover the question, answer from your general knowledge of Indian law instead and say so. Always note that exact section numbers / recent amendments should be verified against the official book, since law can change after your knowledge cutoff.\n\n${context}`;
  } else {
    systemPrompt += ` No matching excerpt was found in the student's study material for this question — answer from your general knowledge of Indian law, and note that the student should verify exam-critical details against their official ICSI study material.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...botHistory.filter(m => m.role !== "system").slice(-8).map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text
    })),
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages,
      max_tokens: 1600,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  let reply = data.choices?.[0]?.message?.content || "No response received.";
  if (matches && matches.length > 0) {
    const cited = [...new Set(matches.map(m => `${BOOK_SOURCES[m.paper]} p.${m.p}`))].slice(0, 5);
    reply += `\n\n---\n*Checked: ${cited.join(", ")}*`;
  }
  return reply;
}

document.addEventListener("DOMContentLoaded", injectBotWidget);

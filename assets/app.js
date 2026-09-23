// Progress tracking — stored entirely in the visitor's own browser (localStorage).
const PROGRESS_KEY = "cs_progress_v1";

function getProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch { return {}; }
}
function setStatus(paperId, lessonNum, status) {
  const p = getProgress();
  const key = `${paperId}-${lessonNum}`;
  if (status === "none") delete p[key];
  else p[key] = status;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}
function getStatus(paperId, lessonNum) {
  return getProgress()[`${paperId}-${lessonNum}`] || "none";
}

function paperStats(paperId) {
  const paper = PAPERS[paperId];
  const p = getProgress();
  let done = 0;
  paper.lessons.forEach(l => { if (p[`${paperId}-${l.n}`] === "done") done++; });
  return { done, total: paper.lessons.length, pct: Math.round((done / paper.lessons.length) * 100) };
}

const STATUS_LABEL = { none: "Not started", studying: "Studying", done: "Revised", weak: "Weak" };

// Recommends the next lesson to study for a paper:
// 1. Anything marked "weak" first (revision priority), in lesson order.
// 2. Anything already "studying" (finish what you started).
// 3. Otherwise, the first untouched lesson within the highest-weightage part
//    that still has incomplete lessons, in official lesson order.
// Returns null once every lesson in the paper is "done".
function nextLesson(paperId) {
  const paper = PAPERS[paperId];
  const p = getProgress();
  const statusOf = l => p[`${paperId}-${l.n}`] || "none";

  const weak = paper.lessons.find(l => statusOf(l) === "weak");
  if (weak) return { lesson: weak, reason: "weak" };

  const studying = paper.lessons.find(l => statusOf(l) === "studying");
  if (studying) return { lesson: studying, reason: "studying" };

  const partOrder = paper.parts.map((part, i) => i).sort((a, b) => paper.parts[b].marks - paper.parts[a].marks);
  for (const partIdx of partOrder) {
    const next = paper.lessons.find(l => l.part === partIdx && statusOf(l) === "none");
    if (next) return { lesson: next, reason: "next" };
  }
  return null;
}

// ---------- Dashboard ----------
function renderDashboard() {
  const upNext = document.getElementById("up-next");
  upNext.innerHTML = Object.values(PAPERS).map(paper => {
    const rec = nextLesson(paper.id);
    if (!rec) {
      return `<div class="upnext-card done"><div class="code">${paper.code} — ${paper.short}</div><div class="upnext-title">All lessons revised 🎉</div></div>`;
    }
    const part = paper.parts[rec.lesson.part];
    const reasonLabel = rec.reason === "weak" ? "Revise — flagged weak" : rec.reason === "studying" ? "Continue" : "Start next";
    return `
      <a class="upnext-card" href="subject.html?paper=${paper.id}#lesson-${paper.id}-${rec.lesson.n}">
        <div class="code">${paper.code} — ${paper.short}</div>
        <div class="upnext-tag ${rec.reason}">${reasonLabel}</div>
        <div class="upnext-title">${rec.lesson.n}. ${rec.lesson.title}</div>
        <div class="upnext-part">${part.name} — ${part.marks} marks</div>
      </a>`;
  }).join("");

  const grid = document.getElementById("paper-grid");
  grid.innerHTML = "";
  Object.values(PAPERS).forEach(paper => {
    const stats = paperStats(paper.id);
    const a = document.createElement("a");
    a.className = "paper-card";
    a.href = `subject.html?paper=${paper.id}`;
    a.innerHTML = `
      <div class="code">${paper.code}</div>
      <h2>${paper.title}</h2>
      <div class="progress-track"><div class="progress-fill" style="width:${stats.pct}%"></div></div>
      <div class="progress-label"><span>${stats.done} / ${stats.total} lessons revised</span><span>${stats.pct}%</span></div>
    `;
    grid.appendChild(a);
  });

  // Weak topics across all papers
  const weakList = document.getElementById("weak-items");
  const p = getProgress();
  const weak = [];
  Object.values(PAPERS).forEach(paper => {
    paper.lessons.forEach(l => {
      if (p[`${paper.id}-${l.n}`] === "weak") weak.push({ paper, lesson: l });
    });
  });
  if (weak.length === 0) {
    weakList.innerHTML = `<p class="empty-note">No topics marked weak yet — mark any lesson "Weak" on a subject page and it'll show up here for quick revision.</p>`;
  } else {
    weakList.innerHTML = `<ul>${weak.map(w => `
      <li><a href="subject.html?paper=${w.paper.id}" style="text-decoration:none;color:inherit;">${w.lesson.title} <span style="color:var(--ink-soft);font-size:0.82rem;">— ${w.paper.short}</span></a> <span class="tag">Weak</span></li>
    `).join("")}</ul>`;
  }
}

// ---------- Subject page ----------
function renderSubject() {
  const params = new URLSearchParams(location.search);
  const paperId = params.get("paper") || "cmsl";
  const paper = PAPERS[paperId];
  if (!paper) { document.getElementById("subject-root").innerHTML = "<p>Unknown paper.</p>"; return; }

  document.title = `${paper.short} — CS Executive Module 2 Guide`;
  document.getElementById("subject-code").textContent = paper.code;
  document.getElementById("subject-title").textContent = paper.title;

  const stats = paperStats(paperId);
  document.getElementById("part-summary").innerHTML = paper.parts.map((part, i) => {
    const partLessons = paper.lessons.filter(l => l.part === i);
    const p = getProgress();
    const partDone = partLessons.filter(l => p[`${paperId}-${l.n}`] === "done").length;
    return `<div><strong>${part.marks} marks</strong>${part.name} — ${partDone}/${partLessons.length} revised</div>`;
  }).join("") + `<div><strong>${stats.pct}%</strong>Overall progress</div>`;

  const recBox = document.getElementById("recommended-next");
  const rec = nextLesson(paperId);
  if (rec) {
    const reasonText = rec.reason === "weak" ? "Flagged weak — worth revising" : rec.reason === "studying" ? "Pick up where you left off" : "Next up, by weightage";
    recBox.innerHTML = `<span class="rec-label">${reasonText}:</span> <a href="#lesson-${paperId}-${rec.lesson.n}" class="rec-link">${rec.lesson.n}. ${rec.lesson.title}</a>`;
    recBox.style.display = "block";
  } else {
    recBox.innerHTML = `All lessons in this paper are marked revised 🎉`;
    recBox.style.display = "block";
  }

  const root = document.getElementById("lesson-list");
  root.innerHTML = "";
  paper.parts.forEach((part, i) => {
    const divider = document.createElement("div");
    divider.className = "part-divider";
    divider.innerHTML = `<h2>${part.name}</h2><span>${part.marks} marks</span>`;
    root.appendChild(divider);

    paper.lessons.filter(l => l.part === i).forEach(l => {
      const status = getStatus(paperId, l.n);
      const div = document.createElement("div");
      div.className = "lesson";
      div.id = `lesson-${paperId}-${l.n}`;
      div.innerHTML = `
        <div class="lesson-row">
          <span class="caret">▸</span>
          <span class="lesson-num">${l.n}.</span>
          <span class="lesson-title">${l.title}</span>
          <select class="status-select" data-status="${status}">
            <option value="none" ${status === "none" ? "selected" : ""}>Not started</option>
            <option value="studying" ${status === "studying" ? "selected" : ""}>Studying</option>
            <option value="done" ${status === "done" ? "selected" : ""}>Revised</option>
            <option value="weak" ${status === "weak" ? "selected" : ""}>Weak</option>
          </select>
        </div>
        <div class="lesson-notes">
          <p>${l.notes}</p>
          <span class="ask-bot-link">Ask the bot about this lesson →</span>
        </div>
      `;
      const row = div.querySelector(".lesson-row");
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("status-select")) return;
        div.classList.toggle("open");
      });
      const select = div.querySelector(".status-select");
      select.addEventListener("click", e => e.stopPropagation());
      select.addEventListener("change", e => {
        setStatus(paperId, l.n, e.target.value);
        select.setAttribute("data-status", e.target.value);
      });
      div.querySelector(".ask-bot-link").addEventListener("click", (e) => {
        e.stopPropagation();
        openBotWithPrompt(`Explain "${l.title}" from ${paper.title} (${paper.code}) — key points I should know for the exam.`, paperId);
      });
      root.appendChild(div);
    });
  });

  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      target.classList.add("open");
      setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  }
}

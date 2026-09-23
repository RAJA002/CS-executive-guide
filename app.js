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

// ---------- Dashboard ----------
function renderDashboard() {
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
}

// ==========================================================
// AI Study Tool — Frontend Logic
// Modes: Learn, Quiz, Flashcards, Test Me, Explain It
// ==========================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========== DOM References ==========

// Sidebar
const sidebar = $("#sidebar");
const fileListEl = $("#file-list");
const btnNew = $("#btn-new");
const btnToggleSidebar = $("#btn-toggle-sidebar");

// Upload view
const uploadView = $("#upload-view");
const studyView = $("#study-view");
const fileInput = $("#file-input");
const fileDrop = $("#file-drop");
const fileLabel = $("#file-label");
const textInput = $("#text-input");
const btnGenerate = $("#btn-generate");
const loading = $("#loading");
const errorMsg = $("#error-msg");

// Mode panels
const modeTabs = $$("#mode-tabs .mode-tab");
const modePanels = $$(".mode-panel");

// Learn
const summaryText = $("#summary-text");
const mindmapContainer = $("#mindmap-container");
const conceptDetailsContainer = $("#concept-details-container");
const chatMessages = $("#chat-messages");
const chatInput = $("#chat-input");
const btnChatSend = $("#btn-chat-send");

// Quiz
const quizContainer = $("#quiz-container");
const btnQuizSubmit = $("#btn-quiz-submit");
const btnQuizNext = $("#btn-quiz-next");
const quizResults = $("#quiz-results");
const quizResultsScore = $("#quiz-results-score");
const quizResultsGrade = $("#quiz-results-grade");
const quizResultsSummary = $("#quiz-results-summary");
const btnNewQuiz = $("#btn-new-quiz");
const quizProgressFill = $("#quiz-progress-fill");
const quizStatus = $("#quiz-status");
const quizLiveScore = $("#quiz-live-score");
const quizTopic = $("#quiz-topic");
const quizRoundActions = $("#quiz-round-actions");
const btnNextRound = $("#btn-next-round");
const btnRestartQuiz = $("#btn-restart-quiz");

// Flashcards
const flashcardInner = $("#flashcard-inner");
const fcFront = $("#fc-front");
const fcBack = $("#fc-back");
const fcPrev = $("#fc-prev");
const fcNext = $("#fc-next");
const fcCounter = $("#fc-counter");
const fcDifficultyBar = $("#fc-difficulty-bar");
const fcScheduleInfo = $("#fc-schedule-info");
const fcSectionTabs = $("#fc-section-tabs");
const btnFcAdd = $("#btn-fc-add");
const btnFcEdit = $("#btn-fc-edit");
const btnFcDelete = $("#btn-fc-delete");
const fcModalOverlay = $("#fc-modal-overlay");
const fcModalTitle = $("#fc-modal-title");
const fcModalSection = $("#fc-modal-section");
const fcModalFront = $("#fc-modal-front");
const fcModalBack = $("#fc-modal-back");
const btnFcModalSave = $("#btn-fc-modal-save");
const btnFcModalCancel = $("#btn-fc-modal-cancel");

// Test Me
const testmeContainer = $("#testme-container");
const testmeCounter = $("#testme-counter");
const btnTestmePrev = $("#btn-testme-prev");
const btnTestmeNext = $("#btn-testme-next");

// Explain It
const explainConcept = $("#explain-concept");
const explainInput = $("#explain-input");
const btnExplainSubmit = $("#btn-explain-submit");
const explainLoading = $("#explain-loading");
const explainResult = $("#explain-result");
const explainClarity = $("#explain-clarity");
const explainStrengths = $("#explain-strengths");
const explainMissing = $("#explain-missing");
const explainFeedback = $("#explain-feedback");

// ========== State ==========

let currentInputTab = "upload";
let selectedFile = null;
let studyData = null;
let activeFileId = null;

// Quiz state
let allQuizQuestions = [];    // Full question pool
let currentRoundQuestions = []; // Current 10 questions
let masteredIds = new Set();   // Indices of mastered questions
let incorrectIds = new Set();  // Indices of incorrect from last round
let quizChecked = false;
let quizRound = 0;

// Flashcard state
let flashcardSections = [];   // [{topic, cards: [{front, back}]}]
let activeFcSection = 0;      // Index of active section
let fcIndex = 0;
let fcSchedule = {};
let fcEditIndex = null;       // null = add, number = edit

// Test Me state
let testmeIndex = 0;
let testmeItems = [];

// Chat state
let chatHistory = [];         // [{role, content}]

// ========== LocalStorage helpers ==========

const HISTORY_KEY = "studytool_history";
const SCHEDULE_KEY = "studytool_fc_schedule";
const FC_EDITS_KEY = "studytool_fc_edits";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addToHistory(data) {
  const history = loadHistory();
  const filtered = history.filter((h) => h.id !== data.file_id);
  filtered.unshift({
    id: data.file_id,
    filename: data.filename || "Untitled",
    data: data,
    timestamp: Date.now(),
  });
  saveHistory(filtered.slice(0, 50));
}

function removeFromHistory(fileId) {
  saveHistory(loadHistory().filter((h) => h.id !== fileId));
}

function loadFcSchedule() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || {}; }
  catch { return {}; }
}

function saveFcSchedule(schedule) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

function loadFcEdits(fileId) {
  try {
    const all = JSON.parse(localStorage.getItem(FC_EDITS_KEY)) || {};
    return all[fileId] || null;
  } catch { return null; }
}

function saveFcEdits(fileId, sections) {
  try {
    const all = JSON.parse(localStorage.getItem(FC_EDITS_KEY)) || {};
    all[fileId] = sections;
    localStorage.setItem(FC_EDITS_KEY, JSON.stringify(all));
  } catch {}
}

// ========== Sidebar / File Manager ==========

function renderFileList() {
  const history = loadHistory();
  fileListEl.innerHTML = "";

  if (history.length === 0) {
    fileListEl.innerHTML = '<li style="color:#666;padding:0.5rem;font-size:0.85rem;">No files yet.</li>';
    return;
  }

  history.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "file-item" + (entry.id === activeFileId ? " active" : "");

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-item-name";
    nameSpan.textContent = entry.filename;
    nameSpan.title = entry.filename;

    const actions = document.createElement("span");
    actions.className = "file-item-actions";

    const btnRename = document.createElement("button");
    btnRename.textContent = "✏️";
    btnRename.title = "Rename";
    btnRename.addEventListener("click", (e) => {
      e.stopPropagation();
      const newName = prompt("Rename file:", entry.filename);
      if (newName && newName.trim()) {
        entry.filename = newName.trim();
        if (entry.data) entry.data.filename = newName.trim();
        const hist = loadHistory();
        const item = hist.find((h) => h.id === entry.id);
        if (item) { item.filename = newName.trim(); if (item.data) item.data.filename = newName.trim(); }
        saveHistory(hist);
        renderFileList();
        const fd = new FormData();
        fd.append("filename", newName.trim());
        fetch(`/files/${entry.id}`, { method: "PUT", body: fd }).catch(() => {});
      }
    });

    const btnDelete = document.createElement("button");
    btnDelete.textContent = "🗑️";
    btnDelete.title = "Delete";
    btnDelete.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${entry.filename}"?`)) {
        removeFromHistory(entry.id);
        fetch(`/files/${entry.id}`, { method: "DELETE" }).catch(() => {});
        if (activeFileId === entry.id) { activeFileId = null; studyData = null; showUploadView(); }
        renderFileList();
      }
    });

    actions.appendChild(btnRename);
    actions.appendChild(btnDelete);
    li.appendChild(nameSpan);
    li.appendChild(actions);
    li.addEventListener("click", () => loadFromHistory(entry.id));
    fileListEl.appendChild(li);
  });
}

function loadFromHistory(fileId) {
  const entry = loadHistory().find((h) => h.id === fileId);
  if (!entry) return;
  activeFileId = fileId;
  studyData = entry.data;
  showStudyView();
  renderFileList();
}

btnToggleSidebar.addEventListener("click", () => sidebar.classList.toggle("open"));

btnNew.addEventListener("click", () => {
  activeFileId = null; studyData = null; showUploadView(); renderFileList();
});

// ========== View switching ==========

function showUploadView() {
  uploadView.classList.remove("hidden");
  studyView.classList.add("hidden");
  fileLabel.textContent = "📄 Click or drag a PDF here";
  selectedFile = null;
  textInput.value = "";
  hideError();
}

function showStudyView() {
  uploadView.classList.add("hidden");
  studyView.classList.remove("hidden");
  const docTitle = $("#doc-title");
  if (docTitle && studyData) docTitle.textContent = studyData.filename || "Untitled document";
  renderAllModes();
  switchMode("learn");
}

// ========== Input Tab switching ==========

$$("#input-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    currentInputTab = tab.dataset.tab;
    $$("#input-tabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
    $("#tab-upload").classList.toggle("hidden", currentInputTab !== "upload");
    $("#tab-paste").classList.toggle("hidden", currentInputTab !== "paste");
  });
});

// ========== File handling ==========

fileDrop.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (!e.target.files.length) return;
  const file = e.target.files[0];
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    selectedFile = null;
    fileLabel.textContent = "Drop your PDF here or browse";
    showError("Please select a PDF file.");
    return;
  }
  selectedFile = file;
  hideError();
  fileLabel.textContent = `✅ ${selectedFile.name}`;
});

fileDrop.addEventListener("dragover", (e) => { e.preventDefault(); fileDrop.classList.add("dragover"); });
fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("dragover"));
fileDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDrop.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith(".pdf")) { selectedFile = file; fileLabel.textContent = `✅ ${file.name}`; }
  else showError("Please drop a PDF file.");
});

// ========== Generate ==========

btnGenerate.addEventListener("click", async () => {
  hideError();
  const formData = new FormData();
  if (currentInputTab === "upload") {
    if (!selectedFile) return showError("Please select a PDF file first.");
    formData.append("file", selectedFile);
  } else {
    const text = textInput.value.trim();
    if (!text) return showError("Please paste some text first.");
    formData.append("text", text);
  }

  loading.classList.remove("hidden");
  btnGenerate.disabled = true;

  try {
    const res = await fetch("/generate", { method: "POST", body: formData });
    if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Something went wrong."); }
    const data = await res.json();
    studyData = data;
    activeFileId = data.file_id;
    addToHistory(data);
    renderFileList();
    showStudyView();
  } catch (err) {
    showError(err.message);
  } finally {
    loading.classList.add("hidden");
    btnGenerate.disabled = false;
  }
});

// ========== Mode Switching ==========

modeTabs.forEach((tab) => tab.addEventListener("click", () => switchMode(tab.dataset.mode)));

function switchMode(mode) {
  modeTabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  modePanels.forEach((p) => p.classList.toggle("hidden", p.id !== `mode-${mode}`));
}

// ========== Render All Modes ==========

function renderAllModes() {
  if (!studyData) return;
  renderLearn();
  renderQuiz();
  renderFlashcards();
  renderTestMe();
  renderExplain();
}

// ========== LEARN MODE ==========

function renderLearn() {
  summaryText.textContent = studyData.summary || "No summary available.";

  // Concept details (expandable)
  conceptDetailsContainer.innerHTML = "";
  const details = studyData.concept_details || [];
  if (details.length > 0) {
    details.forEach((cd) => {
      const div = document.createElement("div");
      div.className = "concept-detail";
      const header = document.createElement("button");
      header.type = "button";
      header.className = "concept-detail-header";
      header.setAttribute("aria-expanded", "false");
      header.innerHTML = `<span class="concept-detail-arrow">&#9654;</span><h3>${escapeHtml(cd.name)}</h3>`;
      div.appendChild(header);
      const body = document.createElement("div");
      body.className = "concept-detail-body";
      body.innerHTML = `<p>${escapeHtml(cd.summary)}</p>`;
      div.appendChild(body);
      header.addEventListener("click", () => {
        const expanded = div.classList.toggle("expanded");
        header.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      conceptDetailsContainer.appendChild(div);
    });
  } else {
    // Fallback for old data format (flat concepts list)
    (studyData.concepts || []).forEach((c) => {
      const div = document.createElement("div");
      div.className = "concept-detail";
      const header = document.createElement("button");
      header.type = "button";
      header.className = "concept-detail-header";
      header.setAttribute("aria-expanded", "false");
      header.innerHTML = `<span class="concept-detail-arrow">&#9654;</span><h3>${escapeHtml(c)}</h3>`;
      div.appendChild(header);
      header.addEventListener("click", () => {
        const expanded = div.classList.toggle("expanded");
        header.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      conceptDetailsContainer.appendChild(div);
    });
  }

  // Mindmap
  renderMindmap(studyData.mindmap);

  // Reset chat
  chatHistory = [];
  chatMessages.innerHTML = '<div class="chat-msg ai"><span class="chat-avatar">🤖</span><span class="chat-bubble">Ask me anything about the document!</span></div>';
}

function renderMindmap(mm) {
  mindmapContainer.innerHTML = "";
  if (!mm || !mm.label) {
    mindmapContainer.innerHTML = '<p style="color:#888;text-align:center;">No mindmap data.</p>';
    return;
  }

  const tree = document.createElement("div");
  tree.className = "mindmap-tree";

  // Root
  const root = document.createElement("div");
  root.className = "mindmap-root";
  root.textContent = mm.label;
  tree.appendChild(root);

  // Branches
  if (mm.children && mm.children.length > 0) {
    const branches = document.createElement("div");
    branches.className = "mindmap-branches";

    mm.children.forEach((child) => {
      const branch = document.createElement("div");
      branch.className = "mindmap-branch";

      const node = document.createElement("div");
      node.className = "mindmap-node" + (child.children && child.children.length > 0 ? " has-children" : "");
      node.textContent = child.label;
      branch.appendChild(node);

      if (child.children && child.children.length > 0) {
        const leaves = document.createElement("div");
        leaves.className = "mindmap-leaves";
        child.children.forEach((leaf) => {
          const leafEl = document.createElement("div");
          leafEl.className = "mindmap-leaf";
          leafEl.textContent = leaf.label;
          leaves.appendChild(leafEl);
        });
        branch.appendChild(leaves);
      }

      branches.appendChild(branch);
    });

    tree.appendChild(branches);
  }

  mindmapContainer.appendChild(tree);
}

// Chat
btnChatSend.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });

async function sendChatMessage() {
  const msg = chatInput.value.trim();
  if (!msg || !activeFileId) return;

  // Add user message
  chatHistory.push({ role: "user", content: msg });
  appendChatMsg("user", msg);
  chatInput.value = "";

  // Show typing indicator
  const typingEl = appendChatMsg("ai", "Thinking...");

  try {
    const fd = new FormData();
    fd.append("file_id", activeFileId);
    fd.append("messages", JSON.stringify(chatHistory));
    const res = await fetch("/chat", { method: "POST", body: fd });
    if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Chat failed."); }
    const data = await res.json();
    typingEl.textContent = data.reply;
    chatHistory.push({ role: "assistant", content: data.reply });
  } catch (err) {
    typingEl.textContent = `Error: ${err.message}`;
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendChatMsg(role, text) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  const avatar = document.createElement("span");
  avatar.className = "chat-avatar";
  avatar.textContent = role === "user" ? "🧑" : "🤖";
  const bubble = document.createElement("span");
  bubble.className = "chat-bubble";
  bubble.textContent = text;
  div.appendChild(avatar);
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

// ========== QUIZ MODE (one-at-a-time) ==========

let quizCurrent = 0;       // index within currentRoundQuestions
let quizSelected = null;    // selected option index
let quizConfirmed = false;  // whether current answer has been submitted
let quizRoundScore = 0;     // score for current round
let quizAnswers = [];       // {correct:bool} per answered question

function renderQuiz() {
  allQuizQuestions = [...(studyData.quiz || [])];
  masteredIds = new Set();
  incorrectIds = new Set();
  quizRound = 0;
  quizChecked = false;
  quizAnswers = [];
  quizRoundScore = 0;
  quizResults.classList.add("hidden");
  _startNewRound();
}

function _startNewRound() {
  quizChecked = false;
  quizRound++;
  quizCurrent = 0;
  quizSelected = null;
  quizConfirmed = false;
  quizRoundScore = 0;
  quizAnswers = [];

  // Determine pool: first round = all, subsequent = only incorrect
  let pool;
  if (quizRound === 1) {
    pool = allQuizQuestions.map((_, i) => i);
  } else {
    pool = [...incorrectIds];
  }

  // Remove already mastered
  pool = pool.filter((i) => !masteredIds.has(i));

  if (pool.length === 0) {
    _showQuizComplete();
    return;
  }

  // Shuffle and pick up to 10
  _shuffle(pool);
  const roundIds = pool.slice(0, 10);
  currentRoundQuestions = roundIds.map((i) => ({ ...allQuizQuestions[i], _poolIndex: i }));
  incorrectIds = new Set(); // reset for this round

  _updateQuizProgress();
  _renderCurrentQuestion();
}

function _updateQuizProgress() {
  const total = allQuizQuestions.length;
  const mastered = masteredIds.size;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  quizProgressFill.style.width = `${pct}%`;
  quizStatus.textContent = `Round ${quizRound} · ${mastered}/${total} mastered · Question ${quizCurrent + 1} of ${currentRoundQuestions.length}`;
  if (quizLiveScore) quizLiveScore.textContent = `${quizRoundScore} pts`;
  if (quizTopic) quizTopic.textContent = `${quizCurrent + 1} / ${currentRoundQuestions.length}`;
}

function _showQuizComplete() {
  quizContainer.innerHTML = "";
  quizProgressFill.style.width = "100%";
  quizStatus.textContent = `All ${allQuizQuestions.length} questions mastered!`;
  if (quizLiveScore) quizLiveScore.textContent = `${allQuizQuestions.length} pts`;
  if (quizTopic) quizTopic.textContent = "Mastery complete";
  btnQuizSubmit.classList.add("hidden");
  btnQuizNext.classList.add("hidden");
  quizResults.classList.add("hidden");

  // Show restart
  quizRoundActions.classList.remove("hidden");
  btnNextRound.classList.add("hidden");
}

function _renderCurrentQuestion() {
  quizContainer.innerHTML = "";
  quizResults.classList.add("hidden");
  quizRoundActions.classList.add("hidden");
  quizSelected = null;
  quizConfirmed = false;

  if (quizCurrent >= currentRoundQuestions.length) {
    _showRoundResults();
    return;
  }

  const q = currentRoundQuestions[quizCurrent];

  const div = document.createElement("div");
  div.className = "quiz-question";
  div.innerHTML = `
    <span class="quiz-section-chip">${escapeHtml(q.section || `Question ${quizCurrent + 1}`)}</span>
    <p class="quiz-question-text">${escapeHtml(q.question)}</p>
  `;

  const optionsDiv = document.createElement("div");
  optionsDiv.className = "quiz-options";

  (q.options || []).forEach((opt, optIndex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option-btn";
    btn.dataset.index = optIndex;

    const letter = document.createElement("span");
    letter.className = "quiz-option-letter";
    letter.textContent = String.fromCharCode(65 + optIndex);
    btn.appendChild(letter);

    const text = document.createElement("span");
    text.className = "quiz-option-text";
    text.textContent = opt;
    btn.appendChild(text);

    btn.addEventListener("click", () => {
      if (quizConfirmed) return;
      quizSelected = optIndex;
      // Update visual selection
      optionsDiv.querySelectorAll(".quiz-option-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      // Enable submit
      btnQuizSubmit.disabled = false;
      btnQuizSubmit.classList.remove("disabled");
    });

    optionsDiv.appendChild(btn);
  });

  div.appendChild(optionsDiv);

  // Hidden feedback area
  const feedback = document.createElement("div");
  feedback.className = "quiz-feedback hidden";
  feedback.id = "quiz-feedback";
  div.appendChild(feedback);

  quizContainer.appendChild(div);

  // Show submit, hide next
  btnQuizSubmit.classList.remove("hidden");
  btnQuizSubmit.disabled = true;
  btnQuizSubmit.classList.add("disabled");
  btnQuizNext.classList.add("hidden");

  _updateQuizProgress();
}

function _submitAnswer() {
  if (quizSelected === null || quizConfirmed) return;
  quizConfirmed = true;

  const q = currentRoundQuestions[quizCurrent];
  const correctIdx = _normalizeAnswerIndex(q.answer, q.options || []);
  const isCorrect = quizSelected === correctIdx;

  if (isCorrect) {
    quizRoundScore++;
    masteredIds.add(q._poolIndex);
  } else {
    incorrectIds.add(q._poolIndex);
  }
  quizAnswers.push({ correct: isCorrect, section: q.section || `Question ${quizCurrent + 1}` });

  // Update live score
  if (quizLiveScore) quizLiveScore.textContent = `${quizRoundScore} pts`;

  // Color the options
  const buttons = quizContainer.querySelectorAll(".quiz-option-btn");
  buttons.forEach((btn) => {
    const idx = Number(btn.dataset.index);
    btn.classList.add("confirmed");
    if (idx === correctIdx) btn.classList.add("correct-option");
    if (idx === quizSelected && idx !== correctIdx) btn.classList.add("wrong-option");
  });

  // Show feedback
  const feedback = document.getElementById("quiz-feedback");
  if (feedback) {
    feedback.classList.remove("hidden");
    feedback.className = `quiz-feedback ${isCorrect ? "correct" : "wrong"}`;
    feedback.innerHTML = `<strong>${isCorrect ? "✅ Correct!" : "❌ Incorrect."}</strong> ${escapeHtml(q.explanation || "")}`;
  }

  // Hide submit, show next
  btnQuizSubmit.classList.add("hidden");
  btnQuizNext.classList.remove("hidden");
  btnQuizNext.textContent = quizCurrent + 1 >= currentRoundQuestions.length ? "See Results →" : "Next Question →";
}

function _nextQuestion() {
  quizCurrent++;
  _renderCurrentQuestion();
}

function _showRoundResults() {
  quizContainer.innerHTML = "";
  btnQuizSubmit.classList.add("hidden");
  btnQuizNext.classList.add("hidden");
  quizChecked = true;

  const total = currentRoundQuestions.length;
  const pct = Math.round((quizRoundScore / total) * 100);
  const grade = pct >= 90 ? "🏆 Excellent!" : pct >= 70 ? "👍 Good work!" : pct >= 50 ? "📚 Keep studying!" : "💪 Review and try again!";

  quizResults.classList.remove("hidden");
  quizResultsScore.textContent = `${quizRoundScore}/${total}`;
  quizResultsGrade.textContent = `${pct}% — ${grade}`;

  // Build answer summary
  quizResultsSummary.innerHTML = "";
  quizAnswers.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "quiz-result-row";
    row.innerHTML = `
      <span class="quiz-result-icon">${a.correct ? "✅" : "❌"}</span>
      <span class="quiz-result-label">Q${i + 1}. ${escapeHtml(a.section)}</span>
    `;
    quizResultsSummary.appendChild(row);
  });

  _updateQuizProgress();
  if (quizTopic) quizTopic.textContent = `Last round: ${quizRoundScore}/${total}`;

  // Show round actions
  quizRoundActions.classList.remove("hidden");
  const remaining = [...incorrectIds].filter((i) => !masteredIds.has(i));
  if (remaining.length > 0) {
    btnNextRound.classList.remove("hidden");
    btnNextRound.textContent = `Next Round (${remaining.length} incorrect)`;
  } else if (masteredIds.size < allQuizQuestions.length) {
    btnNextRound.classList.remove("hidden");
    btnNextRound.textContent = "Next Round";
  } else {
    btnNextRound.classList.add("hidden");
    quizStatus.textContent = `🎉 All ${allQuizQuestions.length} questions mastered!`;
    if (quizTopic) quizTopic.textContent = "Mastery complete";
  }
}

// Button listeners
btnQuizSubmit.addEventListener("click", _submitAnswer);
btnQuizNext.addEventListener("click", _nextQuestion);

function _normalizeAnswerIndex(answer, options) {
  if (typeof answer === "number") {
    return answer >= 0 && answer < options.length ? answer : -1;
  }

  const raw = String(answer || "").trim();
  const num = Number(raw);
  if (Number.isInteger(num) && num >= 0 && num < options.length) return num;

  const letter = raw.charAt(0).toUpperCase();
  const idx = letter.charCodeAt(0) - 65;
  if (idx >= 0 && idx < options.length) return idx;

  const optionMatch = options.findIndex((opt) => String(opt).trim() === raw);
  return optionMatch;
}

btnNextRound.addEventListener("click", () => _startNewRound());

btnRestartQuiz.addEventListener("click", () => renderQuiz());

// New Quiz (re-generate)
btnNewQuiz.addEventListener("click", async () => {
  if (!activeFileId) return;
  btnNewQuiz.disabled = true;
  btnNewQuiz.textContent = "⏳ Generating…";
  try {
    const res = await fetch(`/files/${activeFileId}`);
    if (!res.ok) throw new Error("Could not load source text.");
    const { text } = await res.json();
    const fd = new FormData();
    fd.append("text", text);
    const genRes = await fetch("/generate", { method: "POST", body: fd });
    if (!genRes.ok) throw new Error("Generation failed.");
    const data = await genRes.json();
    studyData.quiz = data.quiz;
    addToHistory(studyData);
    renderQuiz();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btnNewQuiz.disabled = false;
    btnNewQuiz.textContent = "♻️ New Quiz";
  }
});

// ========== FLASHCARDS MODE ==========

function renderFlashcards() {
  // Load user edits if available, otherwise use generated data
  const saved = loadFcEdits(activeFileId);
  if (saved) {
    flashcardSections = JSON.parse(JSON.stringify(saved));
  } else if (studyData.flashcard_sections && studyData.flashcard_sections.length > 0) {
    flashcardSections = JSON.parse(JSON.stringify(studyData.flashcard_sections));
  } else {
    // Backwards compat: old flat flashcards array
    flashcardSections = [{ topic: "All Cards", cards: [...(studyData.flashcards || [])] }];
  }

  activeFcSection = 0;
  fcIndex = 0;
  fcSchedule = loadFcSchedule();
  _renderFcSectionTabs();
  _renderCurrentFlashcard();
}

function _renderFcSectionTabs() {
  fcSectionTabs.innerHTML = "";
  flashcardSections.forEach((sec, i) => {
    const btn = document.createElement("button");
    btn.className = "fc-section-tab" + (i === activeFcSection ? " active" : "");
    btn.textContent = `${sec.topic} (${sec.cards.length})`;
    btn.addEventListener("click", () => {
      activeFcSection = i;
      fcIndex = 0;
      _renderFcSectionTabs();
      _renderCurrentFlashcard();
    });
    fcSectionTabs.appendChild(btn);
  });
}

function _currentFcCards() {
  if (flashcardSections.length === 0) return [];
  return flashcardSections[activeFcSection]?.cards || [];
}

function _renderCurrentFlashcard() {
  const cards = _currentFcCards();
  if (cards.length === 0) {
    fcFront.textContent = "No flashcards in this section";
    fcBack.textContent = "";
    fcCounter.textContent = "";
    fcScheduleInfo.textContent = "";
    return;
  }

  if (fcIndex >= cards.length) fcIndex = cards.length - 1;
  if (fcIndex < 0) fcIndex = 0;

  flashcardInner.classList.remove("flipped");
  const card = cards[fcIndex];
  fcFront.textContent = card.front;
  fcBack.textContent = card.back;
  fcCounter.textContent = `${fcIndex + 1} / ${cards.length}`;

  const key = _fcKey(card);
  const sched = fcSchedule[key];
  if (sched) {
    const now = Date.now();
    if (sched.nextReview <= now) {
      fcScheduleInfo.textContent = "⏰ Due for review now!";
    } else {
      const diffH = Math.round((sched.nextReview - now) / 3600000);
      fcScheduleInfo.textContent = diffH < 24 ? `Next review in ~${diffH}h` : `Next review in ~${Math.round(diffH / 24)}d`;
    }
  } else {
    fcScheduleInfo.textContent = "Not rated yet";
  }
}

function _fcKey(card) {
  return `${activeFileId || "anon"}_${(card.front || "").substring(0, 30)}`;
}

flashcardInner.addEventListener("click", () => flashcardInner.classList.toggle("flipped"));

fcPrev.addEventListener("click", () => {
  const cards = _currentFcCards();
  if (cards.length === 0) return;
  fcIndex = (fcIndex - 1 + cards.length) % cards.length;
  _renderCurrentFlashcard();
});

fcNext.addEventListener("click", () => {
  const cards = _currentFcCards();
  if (cards.length === 0) return;
  fcIndex = (fcIndex + 1) % cards.length;
  _renderCurrentFlashcard();
});

// Spaced repetition
fcDifficultyBar.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cards = _currentFcCards();
    if (cards.length === 0) return;
    const diff = btn.dataset.diff;
    const card = cards[fcIndex];
    const key = _fcKey(card);
    const intervals = { hard: 0, medium: 24, easy: 72 };
    fcSchedule[key] = { diff, nextReview: Date.now() + (intervals[diff] || 24) * 3600000 };
    saveFcSchedule(fcSchedule);
    const labels = { hard: "🔴 Review again soon", medium: "🟡 Review in 1 day", easy: "🟢 Review in 3 days" };
    fcScheduleInfo.textContent = labels[diff];
    setTimeout(() => {
      fcIndex = (fcIndex + 1) % cards.length;
      _renderCurrentFlashcard();
    }, 600);
  });
});

// Flashcard CRUD
btnFcAdd.addEventListener("click", () => {
  fcEditIndex = null;
  fcModalTitle.textContent = "Add Flashcard";
  fcModalFront.value = "";
  fcModalBack.value = "";
  _populateSectionSelect();
  fcModalOverlay.classList.remove("hidden");
});

btnFcEdit.addEventListener("click", () => {
  const cards = _currentFcCards();
  if (cards.length === 0) return;
  fcEditIndex = fcIndex;
  fcModalTitle.textContent = "Edit Flashcard";
  fcModalFront.value = cards[fcIndex].front;
  fcModalBack.value = cards[fcIndex].back;
  _populateSectionSelect();
  fcModalSection.value = activeFcSection.toString();
  fcModalOverlay.classList.remove("hidden");
});

btnFcDelete.addEventListener("click", () => {
  const cards = _currentFcCards();
  if (cards.length === 0) return;
  if (!confirm("Delete this flashcard?")) return;
  cards.splice(fcIndex, 1);
  if (fcIndex >= cards.length) fcIndex = Math.max(0, cards.length - 1);
  _saveFcState();
  _renderFcSectionTabs();
  _renderCurrentFlashcard();
});

btnFcModalCancel.addEventListener("click", () => fcModalOverlay.classList.add("hidden"));
const btnFcModalCancelFooter = $("#btn-fc-modal-cancel-footer");
if (btnFcModalCancelFooter) btnFcModalCancelFooter.addEventListener("click", () => fcModalOverlay.classList.add("hidden"));

btnFcModalSave.addEventListener("click", () => {
  const front = fcModalFront.value.trim();
  const back = fcModalBack.value.trim();
  if (!front || !back) return showToast("Fill in both front and back.", "error");

  const sectionIdx = parseInt(fcModalSection.value, 10);

  if (fcEditIndex !== null) {
    // Editing existing card
    const cards = _currentFcCards();
    if (sectionIdx === activeFcSection) {
      cards[fcEditIndex] = { front, back };
    } else {
      // Move card to different section
      cards.splice(fcEditIndex, 1);
      flashcardSections[sectionIdx].cards.push({ front, back });
      activeFcSection = sectionIdx;
      fcIndex = flashcardSections[sectionIdx].cards.length - 1;
    }
  } else {
    // Adding new card
    flashcardSections[sectionIdx].cards.push({ front, back });
    activeFcSection = sectionIdx;
    fcIndex = flashcardSections[sectionIdx].cards.length - 1;
  }

  _saveFcState();
  _renderFcSectionTabs();
  _renderCurrentFlashcard();
  fcModalOverlay.classList.add("hidden");
});

function _populateSectionSelect() {
  fcModalSection.innerHTML = "";
  flashcardSections.forEach((sec, i) => {
    const opt = document.createElement("option");
    opt.value = i.toString();
    opt.textContent = sec.topic;
    if (i === activeFcSection) opt.selected = true;
    fcModalSection.appendChild(opt);
  });
}

function _saveFcState() {
  saveFcEdits(activeFileId, flashcardSections);
}

// ========== TEST ME MODE ==========

function renderTestMe() {
  testmeItems = [];

  (studyData.quiz || []).forEach((q) => {
    testmeItems.push({ question: q.question, answer: `${q.answer} — ${q.explanation || ""}` });
  });

  // Flatten flashcard sections
  const sections = studyData.flashcard_sections || [];
  sections.forEach((sec) => {
    (sec.cards || []).forEach((fc) => {
      testmeItems.push({ question: fc.front, answer: fc.back });
    });
  });

  // Fallback for old data
  if (sections.length === 0) {
    (studyData.flashcards || []).forEach((fc) => {
      testmeItems.push({ question: fc.front, answer: fc.back });
    });
  }

  testmeIndex = 0;
  _renderTestMeCard();
}

function _renderTestMeCard() {
  testmeContainer.innerHTML = "";
  if (testmeItems.length === 0) {
    testmeContainer.innerHTML = '<p style="text-align:center;color:#888;">No items to test.</p>';
    testmeCounter.textContent = "";
    return;
  }

  const item = testmeItems[testmeIndex];
  const div = document.createElement("div");
  div.className = "testme-card";

  const qP = document.createElement("div");
  qP.className = "testme-question";
  qP.textContent = item.question;
  div.appendChild(qP);

  const revealBtn = document.createElement("button");
  revealBtn.className = "btn-reveal";
  revealBtn.textContent = "Show Answer";
  div.appendChild(revealBtn);

  const ansDiv = document.createElement("div");
  ansDiv.className = "testme-answer hidden";
  ansDiv.textContent = item.answer;
  div.appendChild(ansDiv);

  revealBtn.addEventListener("click", () => {
    ansDiv.classList.remove("hidden");
    revealBtn.classList.add("hidden");
  });

  testmeContainer.appendChild(div);
  testmeCounter.textContent = `${testmeIndex + 1} / ${testmeItems.length}`;
}

btnTestmePrev.addEventListener("click", () => {
  if (testmeItems.length === 0) return;
  testmeIndex = (testmeIndex - 1 + testmeItems.length) % testmeItems.length;
  _renderTestMeCard();
});

btnTestmeNext.addEventListener("click", () => {
  if (testmeItems.length === 0) return;
  testmeIndex = (testmeIndex + 1) % testmeItems.length;
  _renderTestMeCard();
});

// ========== EXPLAIN IT MODE (Feynman Technique) ==========

function renderExplain() {
  const concepts = (studyData.concepts && studyData.concepts.length > 0)
    ? studyData.concepts
    : (studyData.concept_details || []).map((c) => c.name).filter(Boolean);

  explainConcept.innerHTML = "";
  concepts.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    explainConcept.appendChild(opt);
  });
  explainInput.value = "";
  explainResult.classList.add("hidden");
}

btnExplainSubmit.addEventListener("click", async () => {
  const concept = explainConcept.value;
  const explanation = explainInput.value.trim();
  if (!concept) return showToast("Select a concept first.", "error");
  if (!explanation || explanation.length < 20) return showToast("Write a more detailed explanation (at least 20 characters).", "error");

  explainLoading.classList.remove("hidden");
  explainResult.classList.add("hidden");
  btnExplainSubmit.disabled = true;

  try {
    const fd = new FormData();
    fd.append("topic", concept);
    fd.append("explanation", explanation);
    fd.append("summary", studyData.summary || "");
    const res = await fetch("/evaluate", { method: "POST", body: fd });
    if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Evaluation failed."); }
    const data = await res.json();

    const clarity = data.clarity || 0;
    const color = clarity >= 7 ? "#00b894" : clarity >= 4 ? "#f39c12" : "#e74c3c";
    explainClarity.textContent = `${clarity} / 10`;
    explainClarity.style.color = color;

    explainStrengths.innerHTML = "";
    (data.strengths || []).forEach((s) => { const li = document.createElement("li"); li.textContent = s; explainStrengths.appendChild(li); });

    explainMissing.innerHTML = "";
    (data.missing || []).forEach((m) => { const li = document.createElement("li"); li.textContent = m; explainMissing.appendChild(li); });

    explainFeedback.textContent = data.feedback || "";
    explainResult.classList.remove("hidden");
    explainResult.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    explainLoading.classList.add("hidden");
    btnExplainSubmit.disabled = false;
  }
});

// ========== Helpers ==========

function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.remove("hidden"); }
function hideError() { errorMsg.classList.add("hidden"); }

function showToast(msg, type = "info") {
  const container = $("#toast-container");
  if (!container) {
    // Fallback for unexpected DOM states.
    console[type === "error" ? "error" : "log"](msg);
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ========== Init ==========

(function init() {
  renderFileList();
  const history = loadHistory();
  if (history.length > 0) loadFromHistory(history[0].id);
  else showUploadView();
})();

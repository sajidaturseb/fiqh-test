(function () {
  "use strict";

  const data = window.FIQH_QUIZ_DATA;
  const app = document.getElementById("app");
  const homeButton = document.getElementById("homeButton");
  const bestScore = document.getElementById("bestScore");
  let state = { lesson: null, index: 0, answers: [] };

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function getBest() {
    try { return JSON.parse(localStorage.getItem("fiqh-best") || "null"); }
    catch (_) { return null; }
  }

  function setBest(score, total) {
    const current = getBest();
    const ratio = score / total;
    if (!current || ratio > current.ratio) {
      localStorage.setItem("fiqh-best", JSON.stringify({ score, total, ratio }));
    }
    renderBest();
  }

  function renderBest() {
    const best = getBest();
    bestScore.textContent = best ? `Иң яхшы нәтиҗә: ${Math.round(best.ratio * 100)}%` : "";
  }

  function focusMain() {
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderHome() {
    const lessons = data.lessons.map((lesson) => {
      const label = lesson.id === 25 ? "25 нче дәрес — арадаш тест" :
        lesson.id === 50 ? "50 нче дәрес — йомгаклау зачеты" :
        `${lesson.id} нче дәрес — ${lesson.title}`;
      return `<option value="${lesson.id}">${escapeHtml(label)}</option>`;
    }).join("");

    app.innerHTML = `
      <section class="intro-grid">
        <div class="intro-copy">
          <p class="eyebrow">Ике еллык уку программасы</p>
          <h1>Белемеңне тикшер</h1>
          <p class="lead">Дәресне сайла, сорауларга җавап бир һәм нәтиҗәне шунда ук бел. Һәр сорауда бер генә дөрес җавап бар.</p>
          <div class="stats" aria-label="Тест турында мәгълүмат">
            <div class="stat"><strong>50</strong><span>дәрес</span></div>
            <div class="stat"><strong>560</strong><span>сорау</span></div>
            <div class="stat"><strong>2 ел</strong><span>уку программасы</span></div>
          </div>
        </div>
        <div class="panel">
          <h2>Тестны башлау</h2>
          <p class="panel-note">Үтәргә теләгән дәресне сайлагыз.</p>
          <label for="lessonSelect">Дәрес</label>
          <select id="lessonSelect">${lessons}</select>
          <p class="lesson-meta" id="lessonMeta"></p>
          <button class="primary" id="startButton" type="button">Башларга</button>
        </div>
      </section>`;

    const select = document.getElementById("lessonSelect");
    const meta = document.getElementById("lessonMeta");
    const updateMeta = () => {
      const lesson = data.lessons.find((item) => item.id === Number(select.value));
      meta.textContent = `${lesson.questions.length} сорау • ${lesson.title}`;
    };
    select.addEventListener("change", updateMeta);
    document.getElementById("startButton").addEventListener("click", () => startQuiz(Number(select.value)));
    updateMeta();
    focusMain();
  }

  function startQuiz(lessonId) {
    state = {
      lesson: data.lessons.find((item) => item.id === lessonId),
      index: 0,
      answers: []
    };
    renderQuestion();
  }

  function renderQuestion() {
    const question = state.lesson.questions[state.index];
    const selected = state.answers[state.index] || "";
    const progress = ((state.index + 1) / state.lesson.questions.length) * 100;
    const options = question.options.map((option) => `
      <button class="option ${selected === option.key ? "selected" : ""}" type="button" data-key="${option.key}" aria-pressed="${selected === option.key}">
        <span class="option-key">${option.key}</span>
        <span>${escapeHtml(option.text)}</span>
      </button>`).join("");

    app.innerHTML = `
      <section class="quiz-wrap">
        <div class="quiz-head">
          <div class="quiz-head-row">
            <span class="quiz-title">${state.lesson.id} нче дәрес • ${escapeHtml(state.lesson.title)}</span>
            <span>${state.index + 1} / ${state.lesson.questions.length}</span>
          </div>
          <div class="progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="${state.lesson.questions.length}" aria-valuenow="${state.index + 1}">
            <div class="progress-bar" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="quiz-card">
          <p class="question-number">${state.index + 1} нче сорау</p>
          <h2 class="question-text">${escapeHtml(question.text)}</h2>
          <div class="options">${options}</div>
          <div class="quiz-actions">
            <button class="secondary" id="backButton" type="button">${state.index === 0 ? "Тесттан чыгу" : "Артка"}</button>
            <button class="primary" id="nextButton" type="button" ${selected ? "" : "disabled"}>${state.index === state.lesson.questions.length - 1 ? "Нәтиҗәне күрсәтергә" : "Алга"}</button>
          </div>
        </div>
      </section>`;

    app.querySelectorAll(".option").forEach((button) => {
      button.addEventListener("click", () => {
        state.answers[state.index] = button.dataset.key;
        renderQuestion();
      });
    });
    document.getElementById("backButton").addEventListener("click", () => {
      if (state.index === 0) renderHome();
      else { state.index -= 1; renderQuestion(); }
    });
    document.getElementById("nextButton").addEventListener("click", () => {
      if (!state.answers[state.index]) return;
      if (state.index === state.lesson.questions.length - 1) renderResults();
      else { state.index += 1; renderQuestion(); }
    });
    focusMain();
  }

  function renderResults() {
    const total = state.lesson.questions.length;
    const score = state.lesson.questions.reduce((sum, question, index) => sum + (state.answers[index] === question.answer ? 1 : 0), 0);
    const percent = Math.round((score / total) * 100);
    setBest(score, total);

    const mistakes = state.lesson.questions.map((question, index) => ({
      question,
      answer: state.answers[index]
    })).filter((item) => item.answer !== item.question.answer);

    const review = mistakes.length ? mistakes.map((item) => {
      const chosen = item.question.options.find((option) => option.key === item.answer);
      const correct = item.question.options.find((option) => option.key === item.question.answer);
      return `<div class="review-item"><strong>${escapeHtml(item.question.text)}</strong><br>Сезнең җавап: ${escapeHtml(chosen ? chosen.text : "җавап юк")}<span>Дөрес җавап: ${escapeHtml(correct.text)}</span></div>`;
    }).join("") : `<p class="perfect">Барлык җаваплар да дөрес. Афәрин!</p>`;

    let message = "Теманы тагын бер кабатларга киңәш итәбез.";
    if (percent >= 90) message = "Бик яхшы нәтиҗә. Белемнәрегез нык!";
    else if (percent >= 70) message = "Яхшы нәтиҗә. Хаталарны карап чыгыгыз.";

    app.innerHTML = `
      <section class="result-card">
        <div class="result-top">
          <div class="score-ring" style="--score:${percent * 3.6}deg"><strong>${percent}%</strong></div>
          <div>
            <p class="eyebrow">Тест тәмамланды</p>
            <h2>${score} / ${total} дөрес</h2>
            <p class="result-summary">${message}</p>
          </div>
        </div>
        <div class="result-actions">
          <button class="secondary" id="homeResult" type="button">Башка дәрес</button>
          <button class="primary" id="retryButton" type="button">Тагын бер тапкыр</button>
        </div>
        <div class="review">
          <h3>${mistakes.length ? `Хаталар өстендә эш (${mistakes.length})` : "Нәтиҗә"}</h3>
          <div class="review-list">${review}</div>
        </div>
      </section>`;

    document.getElementById("homeResult").addEventListener("click", renderHome);
    document.getElementById("retryButton").addEventListener("click", () => startQuiz(state.lesson.id));
    focusMain();
  }

  homeButton.addEventListener("click", renderHome);
  renderBest();
  renderHome();
})();

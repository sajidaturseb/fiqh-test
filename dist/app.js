(function () {
  "use strict";

  const data = window.FIQH_QUIZ_DATA;
  const course = window.FIQH_COURSE || { modules: [], lessonPages: {} };
  const app = document.getElementById("app");
  const homeButton = document.getElementById("homeButton");
  const bestScore = document.getElementById("bestScore");
  const requestedLessonId = Number(new URLSearchParams(window.location.search).get("lesson"));
  const lockedLesson = data.lessons.find((lesson) => lesson.id === requestedLessonId) || null;
  const assignedGroup = new URLSearchParams(window.location.search).get("group") || "";
  const resultsEndpoint = window.FIQH_RESULTS_ENDPOINT || "";
  let state = { lesson: null, index: 0, answers: [], student: null, startedAt: null, attemptId: null };

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function getBest() {
    try { return JSON.parse(localStorage.getItem("fiqh-best") || "null"); }
    catch (_) { return null; }
  }

  function getCompleted() {
    try { return JSON.parse(localStorage.getItem("fiqh-completed") || "{}"); }
    catch (_) { return {}; }
  }

  function markCompleted(lessonId, percent) {
    const completed = getCompleted();
    completed[lessonId] = Math.max(Number(completed[lessonId]) || 0, percent);
    localStorage.setItem("fiqh-completed", JSON.stringify(completed));
  }

  function getModuleForLesson(lessonId) {
    return course.modules.find((module) => module.lessonIds.includes(lessonId));
  }

  function bookPages(lessonId) {
    return course.lessonPages[lessonId] || "";
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

  function lessonLabel(lesson) {
    return `${lesson.id} нче дәрес — ${lesson.title}`;
  }

  function lessonUrl(lessonId, group) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    if (lessonId) url.searchParams.set("lesson", lessonId);
    if (group) url.searchParams.set("group", group);
    return url.toString();
  }

  function renderLessonCards(module, completed) {
    return module.lessonIds.map((lessonId) => {
      const lesson = data.lessons.find((item) => item.id === lessonId);
      const score = completed[lessonId];
      const stateClass = score >= 70 ? " completed" : (score !== undefined ? " attempted" : "");
      const stateLabel = score !== undefined ? `<span class="lesson-score">${score}%</span>` : `<span class="lesson-arrow" aria-hidden="true">→</span>`;
      return `<a class="course-lesson${stateClass}" href="${escapeHtml(lessonUrl(lessonId))}">
        <span class="lesson-index">${lessonId}</span>
        <span class="lesson-name">${escapeHtml(lesson.title)}<small>Китап: ${escapeHtml(bookPages(lessonId))} нче бит</small></span>
        ${stateLabel}
      </a>`;
    }).join("");
  }

  async function copyLessonLink(lessonId) {
    const groupField = document.getElementById("shareGroup");
    const link = lessonUrl(lessonId, groupField ? groupField.value.trim() : "");
    try {
      await navigator.clipboard.writeText(link);
    } catch (_) {
      const field = document.createElement("textarea");
      field.value = link;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    const status = document.getElementById("shareStatus");
    if (status) status.textContent = "Сылтама күчерелде";
  }

  function renderLockedHome() {
    const lesson = lockedLesson;
    const module = getModuleForLesson(lesson.id);
    const pages = bookPages(lesson.id);
    const pageWord = /[-,]/.test(pages) ? "битләрен" : "битен";
    const isAssessment = lesson.id === 25 || lesson.id === 49 || lesson.id === 50;
    const readingTask = isAssessment
      ? "Тәһарәт, намаз, ураза, зәкят һәм хаҗ бүлекләрен кабатлагыз."
      : `«${course.bookTitle || "Фикһ китабы"}»ның ${pages} нче ${pageWord} укыгыз.`;
    const practice = module ? module.practice : "Үткән бүлекләрне кабатлагыз.";
    app.innerHTML = `
      <section class="lesson-workspace">
        <div class="lesson-study">
          <nav class="lesson-breadcrumb" aria-label="Курс юлы">
            <a href="${escapeHtml(lessonUrl(0))}">Курс</a><span>•</span><span>${module ? escapeHtml(module.title) : "Йомгаклау"}</span>
          </nav>
          <p class="eyebrow">${lesson.id} нче дәрес</p>
          <h1>${escapeHtml(lesson.title)}</h1>
          <p class="lead">Дәреснең темасы «${escapeHtml(course.bookTitle || "Фикһ китабы")}»ның күрсәтелгән битләренә нигезләнгән.</p>
          <div class="study-steps">
            <article class="study-step">
              <span>1</span>
              <div><h2>Теманы укыгыз</h2><p>${escapeHtml(lesson.title)}</p></div>
            </article>
            <article class="study-step book-step">
              <span>2</span>
              <div><h2>«${escapeHtml(course.bookTitle || "Фикһ китабы")}»</h2><p>${escapeHtml(readingTask)}</p><strong>${escapeHtml(pages)} нче бит</strong></div>
            </article>
            <article class="study-step">
              <span>3</span>
              <div><h2>Кабатлау</h2><p>${escapeHtml(practice)}</p></div>
            </article>
            <article class="study-step">
              <span>4</span>
              <div><h2>Тест</h2><p>${lesson.questions.length} сорауга җавап бирегез.</p></div>
            </article>
          </div>
        </div>
        <div class="panel lesson-panel">
          <p class="eyebrow">Дәрес тесты</p>
          <h2>${lesson.questions.length} сорау</h2>
          <p class="panel-note">«${escapeHtml(course.bookTitle || "Фикһ китабы")}»ның күрсәтелгән битләрен укыгыз һәм тестны башлагыз.</p>
          <form id="studentForm">
            <label for="studentName">Исем һәм фамилия</label>
            <input id="studentName" name="studentName" maxlength="80" autocomplete="name" required>
            ${assignedGroup ? `<p class="assigned-group"><span>Төркем</span><strong>${escapeHtml(assignedGroup)}</strong></p>` : `<label for="studentGroup">Төркем</label><input id="studentGroup" name="studentGroup" maxlength="60" required>`}
            <label class="book-check"><input id="bookReady" type="checkbox" required><span>Китаптагы күрсәтелгән битләр белән эшләдем</span></label>
            <p class="privacy-note">Нәтиҗә, исем һәм төркем укытучы журналына җибәрелә.</p>
            <button class="primary" id="startButton" type="submit">Тестны башларга</button>
          </form>
        </div>
      </section>`;

    document.getElementById("studentForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = document.getElementById("studentName").value.trim();
      const groupInput = document.getElementById("studentGroup");
      const group = assignedGroup || (groupInput ? groupInput.value.trim() : "");
      if (!name || !group) return;
      startQuiz(lesson.id, { name, group });
    });
    focusMain();
  }

  function renderHome() {
    if (lockedLesson) {
      renderLockedHome();
      return;
    }
    const lessons = data.lessons.map((lesson) => {
      return `<option value="${lesson.id}">${escapeHtml(lessonLabel(lesson))}</option>`;
    }).join("");
    const completed = getCompleted();
    const completedCount = Object.keys(completed).filter((lessonId) => completed[lessonId] >= 70 && data.lessons.some((lesson) => lesson.id === Number(lessonId))).length;
    const progress = Math.round((completedCount / data.lessons.length) * 100);
    const nextLesson = data.lessons.find((lesson) => completed[lesson.id] < 70 || completed[lesson.id] === undefined) || data.lessons[0];
    const modules = course.modules.map((module, index) => {
      const done = module.lessonIds.filter((lessonId) => completed[lessonId] >= 70).length;
      return `<details class="course-module" ${index === 0 ? "open" : ""}>
        <summary>
          <span class="module-number">${module.number}</span>
          <span class="module-copy"><strong>${escapeHtml(module.title)}</strong><small>${escapeHtml(module.description)}</small></span>
          <span class="module-meta">${done}/${module.lessonIds.length}<small>${escapeHtml(module.bookPages)} нче бит</small></span>
        </summary>
        <div class="module-lessons">${renderLessonCards(module, completed)}</div>
      </details>`;
    }).join("");

    app.innerHTML = `
      <section class="course-home">
        <div class="course-intro">
          <div>
            <p class="eyebrow">«Фикһ китабы» буенча онлайн курс</p>
            <h1>Фикһ курсы</h1>
            <p class="lead">50 дәрес. Һәр дәрестә «Фикһ китабы»ның битләре һәм тест күрсәтелгән.</p>
          </div>
          <aside class="progress-card">
            <span class="progress-label">Сезнең алга китеш</span>
            <strong>${completedCount} / ${data.lessons.length}</strong>
            <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="progress-bar" style="width:${progress}%"></div></div>
            <p>${progress}% тәмамланган</p>
            <a class="primary button-link" href="${escapeHtml(lessonUrl(nextLesson.id))}">${completedCount ? "Дәвам итәргә" : "Беренче дәресне ачарга"}</a>
          </aside>
        </div>
        <div class="course-layout">
          <div class="curriculum">
            <div class="section-heading">
              <div><p class="eyebrow">Уку юлы</p><h2>7 бүлек • 50 дәрес</h2></div>
              <p>«Фикһ китабы»ның күрсәтелгән битләрен укыгыз, аннары тестны үтәгез.</p>
            </div>
            <div class="module-list">${modules}</div>
          </div>
          <aside class="panel quick-panel">
            <p class="eyebrow">Укытучы өчен</p>
            <h2>Дәрес сылтамасы</h2>
            <p class="panel-note">Дәресне һәм төркемне сайлап, укучыга әзер сылтама җибәрегез.</p>
            <label for="lessonSelect">Дәрес</label>
            <select id="lessonSelect">${lessons}</select>
            <p class="lesson-meta" id="lessonMeta"></p>
            <label class="share-group-label" for="shareGroup">Төркем</label>
            <input id="shareGroup" maxlength="60" placeholder="Мәсәлән, 2 нче төркем">
            <button class="primary share-button" id="shareButton" type="button">Сылтаманы күчерергә</button>
            <p class="share-status" id="shareStatus" aria-live="polite"></p>
          </aside>
        </div>
      </section>`;

    const select = document.getElementById("lessonSelect");
    const meta = document.getElementById("lessonMeta");
    const updateMeta = () => {
      const lesson = data.lessons.find((item) => item.id === Number(select.value));
      meta.textContent = `${lesson.questions.length} сорау • ${lesson.title}`;
    };
    select.addEventListener("change", updateMeta);
    document.getElementById("shareButton").addEventListener("click", () => copyLessonLink(Number(select.value)));
    updateMeta();
    focusMain();
  }

  function startQuiz(lessonId, student) {
    state = {
      lesson: data.lessons.find((item) => item.id === lessonId),
      index: 0,
      answers: [],
      student: student || null,
      startedAt: Date.now(),
      attemptId: self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
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
    markCompleted(state.lesson.id, percent);
    if (lockedLesson && state.student) submitResult(score, total, percent);

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
          <button class="secondary" id="homeResult" type="button">${lockedLesson ? "Дәрес башына" : "Башка дәрес"}</button>
          <button class="primary" id="retryButton" type="button">Тагын бер тапкыр</button>
        </div>
        ${lockedLesson ? `<p class="submission-status" id="submissionStatus" aria-live="polite">Нәтиҗә җибәрелә…</p>` : ""}
        <div class="review">
          <h3>${mistakes.length ? `Хаталар өстендә эш (${mistakes.length})` : "Нәтиҗә"}</h3>
          <div class="review-list">${review}</div>
        </div>
      </section>`;

    document.getElementById("homeResult").addEventListener("click", renderHome);
    document.getElementById("retryButton").addEventListener("click", () => startQuiz(state.lesson.id, state.student));
    focusMain();
  }

  async function submitResult(score, total, percent) {
    const status = document.getElementById("submissionStatus");
    if (!resultsEndpoint) {
      if (status) status.textContent = "Нәтиҗәләрне җибәрү вакытлыча көйләнмәгән.";
      return;
    }
    const payload = {
      studentName: state.student.name,
      group: state.student.group,
      lessonId: state.lesson.id,
      lessonTitle: state.lesson.title,
      score,
      total,
      percent,
      durationSeconds: Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)),
      attemptId: state.attemptId,
      answers: state.lesson.questions.map((question, index) => ({
        number: question.number,
        selected: state.answers[index] || "",
        correct: question.answer,
        isCorrect: state.answers[index] === question.answer
      }))
    };
    try {
      const response = await fetch(resultsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "request_failed");
      if (status) status.textContent = "Нәтиҗә укытучыга җибәрелде.";
    } catch (_) {
      if (status) status.textContent = "Нәтиҗәне җибәреп булмады. Интернетны тикшереп, кабатлап карагыз.";
    }
  }

  homeButton.addEventListener("click", () => {
    if (lockedLesson) window.location.href = lessonUrl(0);
    else renderHome();
  });
  renderBest();
  renderHome();
})();

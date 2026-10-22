(function () {
  "use strict";

  const data = window.FIQH_QUIZ_DATA;
  const course = window.FIQH_COURSE || { modules: [], lessonPages: {} };
  const russian = window.FIQH_RU_DATA || { modules: [], lessons: [] };
  const app = document.getElementById("app");
  const homeButton = document.getElementById("homeButton");
  const bestScore = document.getElementById("bestScore");
  const languageSwitch = document.getElementById("languageSwitch");
  const requestedLessonId = Number(new URLSearchParams(window.location.search).get("lesson"));
  const lockedLesson = data.lessons.find((lesson) => lesson.id === requestedLessonId) || null;
  const hasRussian = Boolean(lockedLesson && russian.lessons.some((lesson) => lesson.id === lockedLesson.id));
  let language = hasRussian && new URLSearchParams(window.location.search).get("lang") === "ru" ? "ru" : "tt";
  let currentScreen = "home";
  const groupSections = [
    { heading: "1 курс", prefix: "1 курс", count: 8 },
    { heading: "2 курс", prefix: "2 курс", count: 8 },
    { heading: "Онлайн 1 курс", prefix: "Онлайн 1 курс", count: 10 },
    { heading: "Онлайн 2 курс", prefix: "Онлайн 2 курс", count: 10 }
  ];
  // The new online cohort uses its own entrance page, so its 29 groups do not
  // lengthen the ordinary lesson form's group selector.
  const portalGroupSections = [
    { prefix: "Онлайн 1 курс, татар", count: 24 },
    { prefix: "Онлайн 1 курс, рус", count: 5 }
  ];
  const allowedGroups = new Set([...groupSections, ...portalGroupSections].flatMap((section) =>
    Array.from({ length: section.count }, (_, index) => `${section.prefix} — ${index + 1} группа`)));
  const requestedGroup = new URLSearchParams(window.location.search).get("group") || "";
  const assignedGroup = allowedGroups.has(requestedGroup) ? requestedGroup : "";
  const resultsEndpoint = window.FIQH_RESULTS_ENDPOINT || "";
  let state = { lesson: null, index: 0, answers: [], student: null, startedAt: null, attemptId: null };
  let submissionStatusCode = "sending";

  function tr(tatar, russianText) { return language === "ru" ? russianText : tatar; }
  function localizedLesson(lesson) {
    return language === "ru" ? (russian.lessons.find((item) => item.id === lesson.id) || lesson) : lesson;
  }
  function localizedQuestion(lesson, index) {
    return localizedLesson(lesson).questions[index];
  }
  function refreshLanguageSwitch() {
    if (!languageSwitch) return;
    languageSwitch.hidden = !hasRussian;
    if (!hasRussian) return;
    document.documentElement.lang = language;
    homeButton.setAttribute("aria-label", tr("Баш биткә кайту", "Вернуться на главную"));
    document.getElementById("brandTitle").textContent = tr("Фикһ курсы", "Курс фикха");
    document.getElementById("courseFooter").textContent = tr("«Фикһ китабы» буенча онлайн курс", "Онлайн-курс по учебнику «Азбука фикха»");
    languageSwitch.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === language));
    });
  }
  function switchLanguage(nextLanguage) {
    if (!hasRussian || !["tt", "ru"].includes(nextLanguage)) return;
    language = nextLanguage;
    const url = new URL(window.location.href);
    if (language === "ru") url.searchParams.set("lang", "ru");
    else url.searchParams.delete("lang");
    window.history.replaceState(null, "", url.toString());
    refreshLanguageSwitch();
    renderBest();
    if (currentScreen === "question") renderQuestion();
    else if (currentScreen === "results") renderResults(false);
    else renderHome();
  }
  function submissionMessage() {
    const messages = {
      sending: ["Нәтиҗә җибәрелә…", "Результат отправляется…"],
      sent: ["Нәтиҗә укытучыга җибәрелде.", "Результат отправлен преподавателю."],
      unavailable: ["Нәтиҗәләрне җибәрү вакытлыча көйләнмәгән.", "Отправка результатов временно не настроена."],
      failed: ["Нәтиҗәне җибәреп булмады. Интернетны тикшереп, кабатлап карагыз.", "Не удалось отправить результат. Проверьте интернет и попробуйте ещё раз."]
    };
    return tr(...messages[submissionStatusCode]);
  }
  function setSubmissionStatus(code) {
    submissionStatusCode = code;
    const status = document.getElementById("submissionStatus");
    if (status) status.textContent = submissionMessage();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function groupOptions(placeholder) {
    return `<option value="" selected>${placeholder}</option>` + groupSections.map((section) =>
      `<optgroup label="${escapeHtml(section.heading)}">${Array.from({ length: section.count }, (_, index) => {
        const label = `${section.prefix} — ${index + 1} группа`;
        return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
      }).join("")}</optgroup>`).join("");
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

  function russianModuleForLesson(lessonId) {
    const original = getModuleForLesson(lessonId);
    return russian.modules.find((module) => original && module.id === original.id) || original;
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
    bestScore.textContent = best ? `${tr("Иң яхшы нәтиҗә", "Лучший результат")}: ${Math.round(best.ratio * 100)}%` : "";
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
    if (group || assignedGroup) url.searchParams.set("group", group || assignedGroup);
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
    const group = groupField && allowedGroups.has(groupField.value) ? groupField.value : "";
    const link = lessonUrl(lessonId, group);
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
    currentScreen = "home";
    const lesson = lockedLesson;
    const shownLesson = localizedLesson(lesson);
    const module = getModuleForLesson(lesson.id);
    const russianModule = russianModuleForLesson(lesson.id);
    const pages = bookPages(lesson.id);
    const pageWord = /[-,]/.test(pages) ? "битләрен" : "битен";
    const isAssessment = lesson.id === 25 || lesson.id === 49 || lesson.id === 50;
    const readingTaskTatar = lesson.id === 25
      ? "Тәһарәт, намаз һәм ураза бүлекләрен кабатлагыз."
      : isAssessment
        ? "Тәһарәт, намаз, ураза, зәкят һәм хаҗ бүлекләрен кабатлагыз."
        : `«${course.bookTitle || "Фикһ китабы"}»ның ${pages} нче ${pageWord} укыгыз.`;
    const readingTaskRussian = lesson.id === 25
      ? "Повторите разделы очищения, намаза и поста, изученные на первом курсе."
      : isAssessment
        ? "Повторите разделы очищения, намаза, поста, закята и хаджа."
        : `Прочитайте страницы ${pages} русского учебника «Азбука фикха».`;
    const readingTask = tr(readingTaskTatar, readingTaskRussian);
    const practice = tr(module ? module.practice : "Үткән бүлекләрне кабатлагыз.", russianModule ? russianModule.practice : "Повторите изученный материал.");
    app.innerHTML = `
      <section class="lesson-workspace">
        <div class="lesson-study">
          <nav class="lesson-breadcrumb" aria-label="${tr("Курс юлы", "Разделы курса")}">
            <a href="${escapeHtml(lessonUrl(0))}">${tr("Курс", "Курс")}</a><span>•</span><span>${escapeHtml(tr(module ? module.title : "Йомгаклау", russianModule ? russianModule.title : "Повторение"))}</span>
          </nav>
          <p class="eyebrow">${tr(`${lesson.id} нче дәрес`, `Урок ${lesson.id}`)}</p>
          <h1>${escapeHtml(shownLesson.title)}</h1>
          <p class="lead">${tr(`Дәреснең темасы «${escapeHtml(course.bookTitle || "Фикһ китабы")}»ның күрсәтелгән битләренә нигезләнгән.`, "Тема урока основана на указанных страницах учебника по фикху.")}</p>
          <div class="study-steps">
            <article class="study-step">
              <span>1</span>
              <div><h2>${tr("Теманы укыгыз", "Прочитайте тему")}</h2><p>${escapeHtml(shownLesson.title)}</p></div>
            </article>
            <article class="study-step book-step">
              <span>2</span>
              <div><h2>${tr(`«${escapeHtml(course.bookTitle || "Фикһ китабы")}»`, "«Азбука фикха»")}</h2><p>${escapeHtml(readingTask)}</p><strong>${tr(`${escapeHtml(pages)} нче бит`, `Страницы ${escapeHtml(pages)}`)}</strong></div>
            </article>
            <article class="study-step">
              <span>3</span>
              <div><h2>${tr("Кабатлау", "Повторение")}</h2><p>${escapeHtml(practice)}</p></div>
            </article>
            <article class="study-step">
              <span>4</span>
              <div><h2>Тест</h2><p>${tr(`${lesson.questions.length} сорауга җавап бирегез.`, `Ответьте на ${lesson.questions.length} вопросов.`)}</p></div>
            </article>
          </div>
        </div>
        <div class="panel lesson-panel">
          <p class="eyebrow">${tr("Дәрес тесты", "Тест урока")}</p>
          <h2>${tr(`${lesson.questions.length} сорау`, `${lesson.questions.length} вопросов`)}</h2>
          <p class="panel-note">${tr(`«${escapeHtml(course.bookTitle || "Фикһ китабы")}»ның күрсәтелгән битләрен укыгыз һәм тестны башлагыз.`, "Прочитайте указанные страницы учебника и начните тест.")}</p>
          <form id="studentForm">
            <label for="studentName">${tr("Исем һәм фамилия", "Имя и фамилия")}</label>
            <input id="studentName" name="studentName" maxlength="80" autocomplete="name" required>
            ${assignedGroup ? `<p class="assigned-group"><span>Группа</span><strong>${escapeHtml(assignedGroup)}</strong></p>` : `<label for="studentGroup">Группа</label><select id="studentGroup" name="studentGroup" required>${groupOptions("Выберите группу")}</select>`}
            <label class="book-check"><input id="bookReady" type="checkbox" required><span>${tr("Китаптагы күрсәтелгән битләр белән эшләдем", "Я изучил(а) указанные страницы учебника")}</span></label>
            <p class="privacy-note">Результат, имя и группа отправляются в журнал преподавателя.</p>
            <button class="primary" id="startButton" type="submit">${tr("Тестны башларга", "Начать тест")}</button>
          </form>
        </div>
      </section>`;

    document.getElementById("studentForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = document.getElementById("studentName").value.trim();
      const groupInput = document.getElementById("studentGroup");
      const group = assignedGroup || (groupInput ? groupInput.value : "");
      if (!name || !allowedGroups.has(group)) return;
      startQuiz(lesson.id, { name, group });
    });
    focusMain();
  }

  function renderHome() {
    currentScreen = "home";
    if (lockedLesson) {
      renderLockedHome();
      return;
    }
    const onlineFirstCourse = assignedGroup.startsWith("Онлайн 1 курс, ");
    const visibleLessons = onlineFirstCourse ? data.lessons.filter((lesson) => lesson.id <= 25) : data.lessons;
    const visibleModules = onlineFirstCourse
      ? course.modules.map((module) => ({...module, lessonIds: module.lessonIds.filter((id) => id <= 25)})).filter((module) => module.lessonIds.length)
      : course.modules;
    const lessons = visibleLessons.map((lesson) => {
      return `<option value="${lesson.id}">${escapeHtml(lessonLabel(lesson))}</option>`;
    }).join("");
    const completed = getCompleted();
    const completedCount = visibleLessons.filter((lesson) => completed[lesson.id] >= 70).length;
    const progress = Math.round((completedCount / visibleLessons.length) * 100);
    const nextLesson = visibleLessons.find((lesson) => completed[lesson.id] < 70 || completed[lesson.id] === undefined) || visibleLessons[0];
    const modules = visibleModules.map((module, index) => {
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
            <p class="lead">${visibleLessons.length} дәрес. Һәр дәрестә «Фикһ китабы»ның битләре һәм тест күрсәтелгән.</p>
          </div>
          <aside class="progress-card">
            <span class="progress-label">Сезнең алга китеш</span>
            <strong>${completedCount} / ${visibleLessons.length}</strong>
            <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="progress-bar" style="width:${progress}%"></div></div>
            <p>${progress}% тәмамланган</p>
            <a class="primary button-link" href="${escapeHtml(lessonUrl(nextLesson.id))}">${completedCount ? "Дәвам итәргә" : "Беренче дәресне ачарга"}</a>
          </aside>
        </div>
        <div class="course-layout">
          <div class="curriculum">
            <div class="section-heading">
              <div><p class="eyebrow">Уку юлы</p><h2>${visibleModules.length} бүлек • ${visibleLessons.length} дәрес</h2></div>
              <p>«Фикһ китабы»ның күрсәтелгән битләрен укыгыз, аннары тестны үтәгез.</p>
            </div>
            <div class="module-list">${modules}</div>
          </div>
          <aside class="panel quick-panel" ${assignedGroup.startsWith("Онлайн 1 курс, ") ? 'hidden style="display:none"' : ""}>
            <p class="eyebrow">Укытучы өчен</p>
            <h2>Дәрес сылтамасы</h2>
            <p class="panel-note">Выберите урок и группу, затем отправьте готовую ссылку ученику.</p>
            <label for="lessonSelect">Дәрес</label>
            <select id="lessonSelect">${lessons}</select>
            <p class="lesson-meta" id="lessonMeta"></p>
            <label class="share-group-label" for="shareGroup">Группа</label>
            <select id="shareGroup">${groupOptions("Группу выберет ученик")}</select>
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
    submissionStatusCode = "sending";
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
    currentScreen = "question";
    const question = localizedQuestion(state.lesson, state.index);
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
            <span class="quiz-title">${tr(`${state.lesson.id} нче дәрес`, `Урок ${state.lesson.id}`)} • ${escapeHtml(localizedLesson(state.lesson).title)}</span>
            <span>${state.index + 1} / ${state.lesson.questions.length}</span>
          </div>
          <div class="progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="${state.lesson.questions.length}" aria-valuenow="${state.index + 1}">
            <div class="progress-bar" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="quiz-card">
          <p class="question-number">${tr(`${state.index + 1} нче сорау`, `Вопрос ${state.index + 1}`)}</p>
          <h2 class="question-text">${escapeHtml(question.text)}</h2>
          <div class="options">${options}</div>
          <div class="quiz-actions">
            <button class="secondary" id="backButton" type="button">${state.index === 0 ? tr("Тесттан чыгу", "Выйти из теста") : tr("Артка", "Назад")}</button>
            <button class="primary" id="nextButton" type="button" ${selected ? "" : "disabled"}>${state.index === state.lesson.questions.length - 1 ? tr("Нәтиҗәне күрсәтергә", "Показать результат") : tr("Алга", "Далее")}</button>
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

  function renderResults(submit = true) {
    currentScreen = "results";
    const total = state.lesson.questions.length;
    const score = state.lesson.questions.reduce((sum, question, index) => sum + (state.answers[index] === question.answer ? 1 : 0), 0);
    const percent = Math.round((score / total) * 100);
    setBest(score, total);
    markCompleted(state.lesson.id, percent);

    const mistakes = state.lesson.questions.map((question, index) => ({
      question: localizedQuestion(state.lesson, index),
      answer: state.answers[index]
    })).filter((item) => item.answer !== item.question.answer);

    const review = mistakes.length ? mistakes.map((item) => {
      const chosen = item.question.options.find((option) => option.key === item.answer);
      const correct = item.question.options.find((option) => option.key === item.question.answer);
      return `<div class="review-item"><strong>${escapeHtml(item.question.text)}</strong><br>${tr("Сезнең җавап", "Ваш ответ")}: ${escapeHtml(chosen ? chosen.text : tr("җавап юк", "нет ответа"))}<span>${tr("Дөрес җавап", "Правильный ответ")}: ${escapeHtml(correct.text)}</span></div>`;
    }).join("") : `<p class="perfect">${tr("Барлык җаваплар да дөрес. Афәрин!", "Все ответы верны. Отлично!")}</p>`;

    let message = "Теманы тагын бер кабатларга киңәш итәбез.";
    if (percent >= 90) message = "Бик яхшы нәтиҗә. Белемнәрегез нык!";
    else if (percent >= 70) message = "Яхшы нәтиҗә. Хаталарны карап чыгыгыз.";
    message = tr(message, percent >= 90 ? "Отличный результат. Вы хорошо усвоили материал!" : percent >= 70 ? "Хороший результат. Посмотрите, где были ошибки." : "Советуем ещё раз повторить тему.");

    app.innerHTML = `
      <section class="result-card">
        <div class="result-top">
          <div class="score-ring" style="--score:${percent * 3.6}deg"><strong>${percent}%</strong></div>
          <div>
            <p class="eyebrow">${tr("Тест тәмамланды", "Тест завершён")}</p>
            <h2>${tr(`${score} / ${total} дөрес`, `${score} из ${total} верно`)}</h2>
            <p class="result-summary">${message}</p>
          </div>
        </div>
        <div class="result-actions">
          <button class="secondary" id="homeResult" type="button">${lockedLesson ? tr("Дәрес башына", "К началу урока") : "Башка дәрес"}</button>
          <button class="primary" id="retryButton" type="button">${tr("Тагын бер тапкыр", "Пройти ещё раз")}</button>
        </div>
        ${lockedLesson ? `<p class="submission-status" id="submissionStatus" aria-live="polite">${submissionMessage()}</p>` : ""}
        <div class="review">
          <h3>${mistakes.length ? tr(`Хаталар өстендә эш (${mistakes.length})`, `Разбор ошибок (${mistakes.length})`) : tr("Нәтиҗә", "Результат")}</h3>
          <div class="review-list">${review}</div>
        </div>
      </section>`;

    document.getElementById("homeResult").addEventListener("click", renderHome);
    document.getElementById("retryButton").addEventListener("click", () => startQuiz(state.lesson.id, state.student));
    if (submit && lockedLesson && state.student) submitResult(score, total, percent);
    focusMain();
  }

  async function submitResult(score, total, percent) {
    if (!resultsEndpoint) {
      setSubmissionStatus("unavailable");
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
      setSubmissionStatus("sent");
    } catch (_) {
      setSubmissionStatus("failed");
    }
  }

  if (languageSwitch) {
    languageSwitch.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => switchLanguage(button.dataset.lang));
    });
  }
  refreshLanguageSwitch();
  homeButton.addEventListener("click", () => {
    if (lockedLesson) window.location.href = lessonUrl(0);
    else renderHome();
  });
  renderBest();
  renderHome();
})();

(function () {
  "use strict";

  function safe(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  window.renderFiqhLessonMaterial = function (lessonId, language) {
    const lesson = window.FIQH_LESSON_CONTENT && window.FIQH_LESSON_CONTENT[lessonId];
    if (!lesson || !lesson[language]) return "";
    const material = lesson[language];
    const extras = window.FIQH_LESSON_EXTRAS?.[lessonId]?.[language] || [];
    const visual = window.FIQH_LESSON_VISUALS?.[lessonId]?.[language];
    const isRussian = language === "ru";
    const labels = isRussian ? {
      start: "Из учебника", book: "Главная тема", explain: "Разберём по смыслу",
      more: "Ещё в этом уроке", page: "Страница", remember: "Запомните",
      source: "Основа урока: «Азбука фикха»"
    } : {
      start: "Китаптан", book: "Төп тема", explain: "Мәгънәсен аңлыйк",
      more: "Бу дәрестә тагын", page: "Бит", remember: "Истә калдырыгыз",
      source: "Дәреснең нигезе: «Фикһ китабы»"
    };
    return `<div class="fiqh-material fiqh-tone-${(lessonId - 1) % 3}" data-lesson="${lessonId}">
      <section class="fiqh-opening">
        <span class="fiqh-label">${safe(labels.start)} · ${safe(labels.page)} ${lesson.page}</span>
        <h2>${safe(window.FIQH_LESSON_OPENINGS?.[lessonId]?.[language] || material.title)}</h2>
        <p class="fiqh-book-quote">${safe(material.brief[0])}</p>
        <p>${safe(material.intro)}</p>
        ${material.brief.length > 1 ? `<div class="fiqh-mini-grid">${material.brief.slice(1).map((item) => `<p>${safe(item)}</p>`).join("")}</div>` : ""}
      </section>
      ${material.context ? `<section class="fiqh-context"><span class="fiqh-label">${safe(material.contextLabel || labels.start)}</span><h2>${safe(material.contextTitle)}</h2><p>${safe(material.context)}</p></section>` : ""}
      <section class="fiqh-central" aria-label="${safe(labels.book)}">
        <span class="fiqh-label">${safe(labels.book)} · ${safe(labels.page)} ${lesson.page}</span>
        <h2>${safe(material.title)}</h2>
        <ol>${material.points.map((item) => `<li>${safe(item)}</li>`).join("")}</ol>
        <h3 class="fiqh-explain-title">${safe(labels.explain)}</h3>
        <div class="fiqh-explain-grid">${material.explain.map((item, index) =>
          `<article><span class="fiqh-explain-marker" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div><h4>${safe(item.title)}</h4><p>${safe(item.text)}</p></div></article>`).join("")}</div>
      </section>
      ${visual ? `<section class="fiqh-visual" aria-label="${isRussian ? "Наглядная схема урока" : "Дәреснең күрсәтмә схемасы"}">
        <span class="fiqh-label">${isRussian ? "Наглядная схема" : "Күрсәтмә схема"}</span>
        <h2>${safe(visual.title)}</h2>
        <div class="fiqh-visual-map fiqh-visual-map--${safe(visual.kind)}" style="--node-count:${visual.nodes.length}">
          ${visual.nodes.map((node, index) => `<div class="fiqh-visual-node"><span aria-hidden="true">${visual.kind === "fork" ? ["?", "А", "Б"][index] : index + 1}</span><strong>${safe(node)}</strong></div>`).join("")}
        </div>
        <details class="fiqh-situation"><summary><span>${isRussian ? "Ситуация для размышления" : "Уйлап карау өчен хәл"}</span><strong>${safe(visual.question)}</strong><small>${isRussian ? "Нажмите, чтобы увидеть ответ" : "Җавапны күрү өчен басыгыз"}</small></summary><p>${safe(visual.answer)}</p></details>
      </section>` : ""}
      ${extras.map((section) => `<section class="fiqh-extra fiqh-extra--${safe(section.kind || "cards")}">
        <span class="fiqh-label">${safe(section.label || labels.start)}</span>
        <h2>${safe(section.title)}</h2>
        ${section.intro ? `<p>${safe(section.intro)}</p>` : ""}
        ${section.kind === "checks" ? `<ul class="fiqh-extra-checks">${section.items.map((item) => `<li><span aria-hidden="true">✓</span>${safe(item)}</li>`).join("")}</ul>` :
          `<div class="fiqh-extra-grid">${section.items.map((item, index) => `<article class="fiqh-extra-card">${section.kind === "steps" ? `<span class="fiqh-step-index" aria-hidden="true">${index + 1}</span>` : ""}<div><h3>${safe(item.title)}</h3><p>${safe(item.text)}</p></div></article>`).join("")}</div>`}
      </section>`).join("")}
      <section class="fiqh-more" aria-label="${safe(labels.more)}">
        <h2>${safe(labels.more)}</h2>
        <div class="fiqh-more-grid">${material.further.map((item) => `<article><h3>${safe(item.title)}</h3><p>${safe(item.text)}</p></article>`).join("")}</div>
      </section>
      ${material.checks ? `<section class="fiqh-checks"><span class="fiqh-label">${safe(labels.remember)}</span><ul>${material.checks.map((item) => `<li><span aria-hidden="true">✓</span>${safe(item)}</li>`).join("")}</ul></section>` : ""}
      <p class="fiqh-source-note">${safe(labels.source)} · ${isRussian ? `стр. ${lesson.page}.` : `${lesson.page} нче бит.`}</p>
    </div>`;
  };
})();

(function () {
  "use strict";

  const endpoint = window.FIQH_RESULTS_ENDPOINT || "";
  const $ = (id) => document.getElementById(id);
  let all = [];
  let teacherPin = "";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function normalize(row) {
    return {
      submittedAt: row.submitted_at,
      studentName: row.student_name,
      group: row.student_group,
      lessonId: Number(row.lesson_id),
      lessonTitle: row.lesson_title,
      score: Number(row.score),
      total: Number(row.total),
      percent: Number(row.percent),
      durationSeconds: Number(row.duration_seconds),
      attemptId: row.attempt_id,
      answers: Array.isArray(row.answers) ? row.answers : []
    };
  }

  async function loadResults() {
    if (!endpoint) throw new Error("endpoint_not_configured");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-teacher-pin": teacherPin },
      body: JSON.stringify({ action: "list" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || "request_failed");
    return payload.results.map(normalize);
  }

  function unique(key) {
    return [...new Set(all.map((item) => item[key]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "tt"));
  }

  function options(values, label) {
    return `<option value="">${label}</option>${values.map((value) => `<option>${escapeHtml(value)}</option>`).join("")}`;
  }

  function fillFilters() {
    $("groupFilter").innerHTML = options(unique("group"), "Барлык төркемнәр");
    $("lessonFilter").innerHTML = options(unique("lessonId"), "Барлык дәресләр");
    $("studentFilter").innerHTML = options(unique("studentName"), "Барлык укучылар");
  }

  function filtered() {
    const group = $("groupFilter").value;
    const lesson = $("lessonFilter").value;
    const student = $("studentFilter").value;
    return all.filter((item) => (!group || item.group === group)
      && (!lesson || String(item.lessonId) === lesson)
      && (!student || item.studentName === student));
  }

  function level(percent) {
    if (percent >= 90) return ["Үзләштерелгән", "good"];
    if (percent >= 70) return ["Ныгытырга", "mid"];
    return ["Кабатларга", "low"];
  }

  function render() {
    const rows = filtered();
    const names = new Set(rows.map((item) => item.studentName));
    const average = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.percent, 0) / rows.length) : 0;
    const mastered = rows.length ? Math.round(rows.filter((item) => item.percent >= 90).length / rows.length * 100) : 0;

    $("attempts").textContent = rows.length;
    $("students").textContent = names.size;
    $("average").textContent = `${average}%`;
    $("mastered").textContent = `${mastered}%`;

    $("resultRows").innerHTML = rows.map((item) => {
      const badge = level(item.percent);
      return `<tr><td>${new Date(item.submittedAt).toLocaleString("ru-RU")}</td><td>${escapeHtml(item.studentName)}</td><td>${escapeHtml(item.group)}</td><td>${item.lessonId}</td><td>${item.score} / ${item.total} (${item.percent}%)</td><td>${Math.max(1, Math.round(item.durationSeconds / 60))} мин</td><td><span class="badge ${badge[1]}">${badge[0]}</span></td></tr>`;
    }).join("") || '<tr><td colspan="7">Нәтиҗәләр юк</td></tr>';

    const questions = {};
    rows.forEach((attempt) => attempt.answers.forEach((answer) => {
      const key = `${attempt.lessonId}-${answer.number}`;
      if (!questions[key]) questions[key] = { lesson: attempt.lessonId, number: answer.number, total: 0, wrong: 0 };
      questions[key].total += 1;
      if (!answer.isCorrect) questions[key].wrong += 1;
    }));

    $("questionRows").innerHTML = Object.values(questions)
      .sort((a, b) => b.wrong / b.total - a.wrong / a.total)
      .slice(0, 20)
      .map((question) => `<div class="question-row"><strong>${question.lesson}-${question.number}</strong><span>Хаталар: ${question.wrong} / ${question.total}</span><span>${Math.round(question.wrong / question.total * 100)}%</span></div>`)
      .join("") || '<p class="muted">Анализ өчен нәтиҗәләр юк.</p>';
  }

  async function login(event) {
    event.preventDefault();
    teacherPin = $("teacherPin").value.trim();
    $("loginError").textContent = "";
    try {
      all = await loadResults();
      $("loginPanel").hidden = true;
      $("dashboard").hidden = false;
      fillFilters();
      render();
    } catch (error) {
      $("loginError").textContent = error.message === "invalid_pin" ? "PIN-код дөрес түгел." : "Нәтиҗәләрне алып булмады.";
    }
  }

  async function refresh() {
    const button = $("refreshButton");
    button.disabled = true;
    try {
      all = await loadResults();
      fillFilters();
      render();
    } finally {
      button.disabled = false;
    }
  }

  function exportCsv() {
    const header = ["Вакыт", "Укучы", "Төркем", "Дәрес", "Тема", "Дөрес", "Барлыгы", "Процент", "Вакыт секунд"];
    const values = filtered().map((item) => [item.submittedAt, item.studentName, item.group, item.lessonId, item.lessonTitle, item.score, item.total, item.percent, item.durationSeconds]);
    const csv = [header, ...values].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `fiqh-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  $("loginForm").addEventListener("submit", login);
  $("refreshButton").addEventListener("click", refresh);
  $("exportButton").addEventListener("click", exportCsv);
  ["groupFilter", "lessonFilter", "studentFilter"].forEach((id) => $(id).addEventListener("change", render));
})();

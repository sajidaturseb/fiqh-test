import fs from "node:fs";
import vm from "node:vm";

const files = ["dist/questions.js", "dist/course.js", "dist/app.js", "dist/index.html"];
const forbidden = [
  ["истихаза", /истихаза/iu], ["мөсафир", /мөсафир/iu], ["нисаб", /нисаб/iu],
  ["ишрак", /ишрак(?!ъ)/iu], ["сәгый", /сәгый/iu], ["сәҗдәи сәһү", /сәҗдәи\s+сәһү/iu],
  ["тәхийятүл-мәсҗид", /тәхийятүл-мәсҗид/iu], ["кыран", /(^|[^й])кыран/iu],
  ["тәмәттугъ", /тәмәттугъ/iu], ["Мәкәм Ибраһим", /мәкәм\s+ибра[гһ]им/iu],
  ["Хәҗәрел-әсвәд", /хәҗәрел-әсвәд/iu], ["Мәсҗидел-Хәрам", /мәсҗидел-хәрам/iu],
  ["кыраәт", /кыраәт/iu], ["җәмәрәләр", /җәмәрәләр/iu], ["тәдиле әркән", /тәдиле\s+әркән/iu],
  ["Кыблатайн", /кыблатайн/iu], ["Гарәфәт", /гарәфәт/iu],
  ["ваҗибы/ваҗибына/ваҗибны/ваҗиблар", /ваҗиб(?:ы|ына|ны|лар)/iu]
];

let failed = false;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8").toLocaleLowerCase("tt");
  for (const [label, pattern] of forbidden) {
    if (pattern.test(text)) {
      console.error(`${file}: учебникта булмаган язылыш табылды: ${label}`);
      failed = true;
    }
  }
}

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync("dist/questions.js", "utf8"), sandbox);
vm.runInNewContext(fs.readFileSync("dist/course.js", "utf8"), sandbox);
const lessons = sandbox.window.FIQH_QUIZ_DATA?.lessons || [];
const course = sandbox.window.FIQH_COURSE;
const questionCount = lessons.reduce((sum, lesson) => sum + lesson.questions.length, 0);

if (lessons.length !== 50 || questionCount !== 560) {
  console.error(`Көтелгән күләм: 50 дәрес һәм 560 сорау; табылды: ${lessons.length} һәм ${questionCount}.`);
  failed = true;
}

for (const lesson of lessons) {
  if (!course.lessonPages[lesson.id]) {
    console.error(`${lesson.id} нче дәрес өчен китап бите күрсәтелмәгән.`);
    failed = true;
  }
  for (const [index, question] of lesson.questions.entries()) {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      console.error(`${lesson.id} нче дәрес, ${index + 1} нче сорау: җавап вариантлары җитми.`);
      failed = true;
    }
    if (!question.options.some((option) => option.key === question.answer)) {
      console.error(`${lesson.id} нче дәрес, ${index + 1} нче сорау: дөрес җавап индексы хаталы.`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`Терминология тикшерелде: ${lessons.length} дәрес, ${questionCount} сорау.`);

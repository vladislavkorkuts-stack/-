/* Run against `npm run dev`. Chromium is bundled through npm for restricted CI. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");
const bundled = require("@sparticuz/chromium");
const course = require("../scripts/course.json");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

(async () => {
  let options = { headless: true };
  if (process.env.CHROMIUM_PATH)
    options.executablePath = process.env.CHROMIUM_PATH;
  else {
    // This archive supplies the NSS libraries absent in the minimal Arena image.
    const libPath = await bundled.inflate(
      path.resolve("node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
    );
    options = {
      ...options,
      executablePath: await bundled.default.executablePath(),
      args: bundled.default.args,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${libPath}/lib:${process.env.LD_LIBRARY_PATH || ""}`,
      },
    };
  }
  const browser = await chromium.launch(options);
  let checks = 0;
  const check = (message) => {
    checks++;
    console.log(`✓ ${message}`);
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
    });
    const page = await context.newPage();
    const errors = [];
    const failedResources = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failedResources.push(response.url());
    });
    const go = async (url) => {
      await page.goto(`${base}/${url}`);
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    };

    await go("");
    await expect(page.locator(".course-card")).toHaveCount(3);
    await expect(page.locator(".lesson-row:visible")).toHaveCount(15);
    check("Каталог: три раздела и все 15 тем");
    await page.locator('[data-filter="1"]').click();
    await expect(page.locator(".lesson-row:visible")).toHaveCount(5);
    await page.locator('[data-filter="2"]').click();
    await expect(page.locator(".lesson-row:visible")).toHaveCount(8);
    await page.locator('[data-filter="0"]').click();
    await expect(page.locator(".lesson-row:visible")).toHaveCount(2);
    await page.locator('[data-filter="all"]').click();
    await page.locator("#lesson-search").fill("числовых");
    await expect(page.locator(".lesson-row:visible")).toHaveCount(1);
    await expect(page.locator(".lesson-row:visible")).toHaveAttribute(
      "data-lesson-id",
      "12",
    );
    await page.locator("#lesson-search").fill("несуществующая тема");
    await expect(page.locator("[data-empty]")).toBeVisible();
    await page.locator("[data-reset-search]").click();
    await expect(page.locator(".lesson-row:visible")).toHaveCount(15);
    check("Поиск, фильтры и восстановление из пустой выдачи");

    await page.locator('[data-save="3"]').click();
    await expect(page.locator('[data-save="3"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await go("saved.html");
    await expect(page.locator(".lesson-row:visible")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".lesson-row:visible")).toHaveAttribute(
      "data-lesson-id",
      "3",
    );
    await page.locator('[data-save="3"]').click();
    await expect(page.locator("[data-saved-empty]")).toBeVisible();
    check(
      "Избранное сохраняется между страницами и после перезагрузки, удаление работает",
    );

    await go("lessons/01.html");
    await page.locator("[data-complete]").click();
    await expect(page.locator("[data-complete]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await go("");
    await expect(page.locator("[data-completed-count]")).toHaveText("1");
    await expect(page.locator("[data-start]")).toHaveAttribute(
      "href",
      "lessons/02.html",
    );
    await expect(page.locator('[data-state="1"]')).toHaveClass(/done/);
    assert.equal(
      await page
        .locator('[data-group-progress="0"]')
        .evaluate((el) => el.style.width),
      "50%",
    );
    await go("lessons/01.html");
    await page.locator("[data-complete]").click();
    await expect(page.locator("[data-complete]")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    check(
      "Прохождение, отмена, прогресс раздела и продолжение с непройденной темы",
    );

    for (const lesson of course) {
      await go(`lessons/${String(lesson.id).padStart(2, "0")}.html`);
      await expect(page.locator("h1")).toHaveText(lesson.title);
      const wrong = (lesson.quiz.correct + 1) % lesson.quiz.options.length;
      await page.locator(`input[value="${wrong}"]`).check();
      await page.locator('.quiz-form button[type="submit"]').click();
      await expect(page.locator(".quiz-feedback")).toContainText(
        "Пока не совсем",
      );
      await page.locator(`input[value="${lesson.quiz.correct}"]`).check();
      await page.locator('.quiz-form button[type="submit"]').click();
      await expect(page.locator(".quiz-feedback")).toContainText("Верно!");
      await expect(page.locator(".quiz-feedback")).toHaveClass(/correct/);
    }
    check("Все 15 страниц: правильные и неправильные ответы самопроверки");

    for (const route of [
      "",
      "introduction.html",
      "arrays.html",
      "computer.html",
      "appendix.html",
      "textbook.html",
      "safety.html",
      "saved.html",
      "lessons/03.html",
      "lessons/15.html",
    ]) {
      await go(route);
      await page.addScriptTag({ path: require.resolve("axe-core") });
      const violations = await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          })
        ).violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      );
      assert.deepEqual(violations, [], `Accessibility: /${route}`);
    }
    check("Axe WCAG A/AA: нет обнаруженных нарушений на 10 типовых страницах");

    const routes = [
      "",
      "arrays.html",
      "computer.html",
      "appendix.html",
      "textbook.html",
      "safety.html",
      "saved.html",
      "lessons/03.html",
    ];
    for (const width of [320, 390, 768, 900, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await go(route);
        const size = await page.evaluate(() => ({
          viewport: innerWidth,
          content: document.documentElement.scrollWidth,
        }));
        assert.ok(
          size.content <= size.viewport,
          `Overflow at ${width}px on /${route}: ${size.content}`,
        );
      }
    }
    check(
      "Нет горизонтального переполнения: 48 проверок страниц на ширинах 320–1440px",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await go("");
    assert.equal(
      await page.locator("#navigation").evaluate((el) => el.inert),
      true,
    );
    await page.locator(".mobile-menu").click();
    await expect(page.locator(".mobile-menu")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    assert.equal(
      await page.locator("#navigation").evaluate((el) => el.inert),
      false,
    );
    await page.keyboard.press("Escape");
    await expect(page.locator(".mobile-menu")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator(".mobile-menu")).toBeFocused();
    await page.locator(".mobile-menu").click();
    await page.locator('#navigation a[href="arrays.html"]').click();
    await expect(page.locator("h1")).toHaveText("Алгоритмы обработки массивов");
    check(
      "Мобильное меню: открытие, Escape, управление фокусом и переход в раздел",
    );

    await go("!Index/index.html");
    await page.locator("[data-start]").click();
    await expect(page).toHaveURL(/\/lessons\/01.html$/);
    check(
      "Старая точка входа !Index использует корректные относительные ссылки",
    );
    const pdf = await context.request.get(`${base}/files/informatika-10.pdf`);
    assert.equal(pdf.status(), 200);
    assert.ok((await pdf.body()).subarray(0, 4).equals(Buffer.from("%PDF")));
    check("Локальный PDF доступен и имеет корректный формат");

    const privateContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await privateContext.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("Storage blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("Storage blocked");
      };
    });
    const privatePage = await privateContext.newPage();
    privatePage.on("pageerror", (error) => errors.push(error.message));
    await privatePage.goto(`${base}/lessons/01.html`);
    await privatePage.locator("[data-save]").click();
    await expect(privatePage.locator("[data-save]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(privatePage.locator("#toast")).toContainText(
      "хранилище браузера недоступно",
    );
    check(
      "Сайт работает при заблокированном localStorage и предупреждает о несохранении",
    );
    await privateContext.close();
    assert.deepEqual(errors, [], "No browser errors");
    assert.deepEqual(failedResources, [], "No failed resources");
    check("Нет ошибок JavaScript и неудачных запросов ресурсов");
    console.log(`\n${checks} browser test groups passed.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

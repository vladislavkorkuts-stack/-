(() => {
  "use strict";
  const KEY = "informatics-10-v1";
  const prefix = document.body.dataset.prefix || "";
  let state = { completed: [], saved: [] };
  let storageAvailable = true;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (stored && typeof stored === "object") {
      for (const key of ["completed", "saved"]) {
        state[key] = Array.isArray(stored[key])
          ? [
              ...new Set(
                stored[key].filter(
                  (n) => Number.isInteger(n) && n >= 1 && n <= 15,
                ),
              ),
            ]
          : [];
      }
    }
  } catch (_) {
    storageAvailable = false;
  }

  let toastTimer;
  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageAvailable = true;
    } catch (_) {
      storageAvailable = false;
    }
  }
  function renderState() {
    document.querySelectorAll("[data-save]").forEach((button) => {
      const saved = state.saved.includes(Number(button.dataset.save));
      button.setAttribute("aria-pressed", String(saved));
      button.title = saved ? "Убрать из избранного" : "В избранное";
      const label = button.querySelector("[data-save-label]");
      if (label) label.textContent = saved ? "В избранном" : "В избранное";
      else {
        const row = button.closest("[data-lesson-id]");
        const title =
          row?.querySelector(".lesson-copy strong")?.textContent || "тема";
        button.setAttribute(
          "aria-label",
          `${saved ? "Убрать из избранного" : "Добавить в избранное"}: ${title}`,
        );
      }
    });
    document.querySelectorAll("[data-completed-count]").forEach((el) => {
      el.textContent = state.completed.length;
    });
    document.querySelectorAll("[data-group-progress]").forEach((el) => {
      const groups = [
        [1, 2],
        [3, 4, 5, 6, 7],
        [8, 9, 10, 11, 12, 13, 14, 15],
      ];
      const ids = groups[Number(el.dataset.groupProgress)];
      const n = ids.filter((id) => state.completed.includes(id)).length;
      el.style.width = `${(n / ids.length) * 100}%`;
      el.parentElement.setAttribute(
        "aria-label",
        `Пройдено ${n} из ${ids.length} тем`,
      );
    });
    document.querySelectorAll("[data-state]").forEach((el) => {
      const done = state.completed.includes(Number(el.dataset.state));
      el.classList.toggle("done", done);
      el.setAttribute("aria-label", done ? "Тема пройдена" : "Открыть тему");
      el.innerHTML = done
        ? '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L20 5"/></svg>'
        : '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
    });
    document.querySelectorAll("[data-complete]").forEach((button) => {
      const done = state.completed.includes(Number(button.dataset.complete));
      button.setAttribute("aria-pressed", String(done));
      button.textContent = done
        ? "✓ Тема пройдена · Отменить"
        : "Отметить пройденной";
    });
    const next = Array.from({ length: 15 }, (_, i) => i + 1).find(
      (id) => !state.completed.includes(id),
    );
    document.querySelectorAll("[data-start]").forEach((link) => {
      link.href = `${prefix}lessons/${String(next || 1).padStart(2, "0")}.html`;
      link.firstChild.textContent =
        state.completed.length === 15
          ? "Повторить курс "
          : state.completed.length
            ? "Продолжить обучение "
            : "Начать обучение ";
    });
    const savedList = document.querySelector("[data-saved-list]");
    if (savedList) {
      savedList.querySelectorAll("[data-lesson-id]").forEach((row) => {
        row.hidden = !state.saved.includes(Number(row.dataset.lessonId));
      });
      savedList.hidden = state.saved.length === 0;
      document.querySelector("[data-saved-empty]").hidden =
        state.saved.length !== 0;
    }
  }

  document.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.save);
      const wasSaved = state.saved.includes(id);
      state.saved = wasSaved
        ? state.saved.filter((n) => n !== id)
        : [...state.saved, id];
      persist();
      renderState();
      toast(
        storageAvailable
          ? wasSaved
            ? "Тема удалена из избранного"
            : "Тема добавлена в избранное"
          : "Отметка действует до закрытия страницы: хранилище браузера недоступно",
      );
    });
  });
  document.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.complete);
      const done = state.completed.includes(id);
      state.completed = done
        ? state.completed.filter((n) => n !== id)
        : [...state.completed, id];
      persist();
      renderState();
      toast(
        storageAvailable
          ? done
            ? "Отметка о прохождении снята"
            : "Отличная работа! Прогресс сохранён"
          : "Хранилище браузера недоступно: прогресс не сохранится после закрытия страницы",
      );
    });
  });

  const search = document.getElementById("lesson-search");
  let selectedGroup = "all";
  function filterLessons() {
    if (!search) return;
    const normalize = (value) =>
      value.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
    const query = normalize(search.value);
    let visible = 0;
    document.querySelectorAll("[data-lesson-id]").forEach((row) => {
      const matches =
        (selectedGroup === "all" || row.dataset.group === selectedGroup) &&
        normalize(row.dataset.search).includes(query);
      row.hidden = !matches;
      if (matches) visible++;
    });
    const counter = document.querySelector("[data-result-count]");
    const suffix =
      visible === 1 ? "тема" : visible >= 2 && visible <= 4 ? "темы" : "тем";
    if (counter) counter.textContent = `${visible} ${suffix}`;
    const empty = document.querySelector("[data-empty]");
    if (empty) empty.hidden = visible !== 0;
    const list = document.querySelector(".topics-section .lesson-list");
    if (list) list.hidden = visible === 0;
  }
  search?.addEventListener("input", filterLessons);
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedGroup = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      filterLessons();
    });
  });
  document
    .querySelector("[data-reset-search]")
    ?.addEventListener("click", () => {
      search.value = "";
      document.querySelector('[data-filter="all"]').click();
      search.focus();
    });

  document.querySelectorAll(".quiz-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const answer = new FormData(form).get("answer");
      const feedback = form.querySelector(".quiz-feedback");
      if (answer === null) return;
      const correct = answer === form.dataset.correct;
      feedback.hidden = false;
      feedback.classList.toggle("correct", correct);
      feedback.textContent = correct
        ? `Верно! ${form.dataset.explanation}`
        : "Пока не совсем. Вернись к конспекту и попробуй другой вариант.";
    });
    form.addEventListener("change", () => {
      form.querySelector(".quiz-feedback").hidden = true;
    });
  });
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button
        .closest(".example-code")
        .querySelector("code").textContent;
      try {
        if (navigator.clipboard?.writeText)
          await navigator.clipboard.writeText(text);
        else throw new Error("Clipboard not available");
        button.textContent = "Скопировано ✓";
        toast("Код скопирован");
        setTimeout(() => {
          button.textContent = "Копировать";
        }, 2200);
      } catch (_) {
        const range = document.createRange();
        range.selectNodeContents(
          button.closest(".example-code").querySelector("code"),
        );
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        toast("Код выделен. Нажми Ctrl+C или выбери «Копировать»");
      }
    });
  });

  const menuButton = document.querySelector(".mobile-menu");
  const sidebar = document.getElementById("navigation");
  const overlay = document.querySelector(".menu-overlay");
  function setMenu(open) {
    sidebar.inert = !open && window.innerWidth <= 800;
    sidebar.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Закрыть меню" : "Открыть меню",
    );
    overlay.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) sidebar.querySelector("a").focus();
    else menuButton.focus();
  }
  menuButton?.addEventListener("click", () =>
    setMenu(!sidebar.classList.contains("open")),
  );
  overlay?.addEventListener("click", () => setMenu(false));
  document.addEventListener("keydown", (event) => {
    const targetIsInput =
      /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
      event.target.isContentEditable;
    if (event.key === "/" && search && !targetIsInput) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === "Escape" && sidebar.classList.contains("open"))
      setMenu(false);
    if (event.key === "Tab" && sidebar.classList.contains("open")) {
      const focusable = [...sidebar.querySelectorAll("a, button")];
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  sidebar.inert = window.innerWidth <= 800;
  window.addEventListener("resize", () => {
    sidebar.inert =
      window.innerWidth <= 800 && !sidebar.classList.contains("open");
    if (window.innerWidth > 800 && sidebar.classList.contains("open"))
      setMenu(false);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) window.location.reload();
  });
  renderState();
})();

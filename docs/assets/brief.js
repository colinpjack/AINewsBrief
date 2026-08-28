(() => {
  const root = document.documentElement;
  const stored = localStorage.getItem("brief-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = stored || (prefersDark ? "dark" : "light");
  root.setAttribute("data-theme", initial);

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("brief-theme", next);
  });

  const picker = document.querySelector("[data-edition]");
  if (!picker) return;

  const inArchive = document.body.classList.contains("archive-page")
    || document.body.classList.contains("archive-edition");
  const latest = picker.options[0]?.value;

  picker.addEventListener("change", () => {
    const date = picker.value;
    if (!date) return;
    if (date === latest) {
      window.location.href = inArchive ? "../index.html" : "index.html";
      return;
    }
    window.location.href = inArchive ? `${date}.html` : `archive/${date}.html`;
  });
})();

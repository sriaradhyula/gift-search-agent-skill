(() => {
  const storageKey = "gift-search-theme";
  const choices = ["system", "light", "dark"];
  const root = document.documentElement;

  function setTheme(value) {
    const theme = choices.includes(value) ? value : "system";
    root.dataset.theme = theme;
    const select = document.getElementById("theme-choice");
    if (select) select.value = theme;
  }

  try {
    setTheme(localStorage.getItem(storageKey));
  } catch {
    setTheme("system");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("theme-choice");
    if (!select) return;
    select.value = root.dataset.theme;
    select.addEventListener("change", () => {
      setTheme(select.value);
      try {
        localStorage.setItem(storageKey, select.value);
      } catch {
        // The current page still uses the selection when storage is unavailable.
      }
    });
  });

  window.addEventListener("storage", ({ key, newValue }) => {
    if (key === storageKey || key === null) setTheme(newValue);
  });
})();

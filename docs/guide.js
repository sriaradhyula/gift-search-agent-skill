const agents = document.querySelectorAll("[data-agent]");
const install = document.getElementById("install-command");

for (const button of agents) {
  button.addEventListener("click", () => {
    for (const option of agents) option.setAttribute("aria-pressed", String(option === button));
    install.textContent = `npx skills add sriaradhyula/gift-search-agent-skill --skill gift-search -a ${button.dataset.agent}`;
  });
}

for (const button of document.querySelectorAll("[data-copy]")) {
  let reset;
  button.addEventListener("click", async () => {
    clearTimeout(reset);
    const code = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = "Copied";
      reset = setTimeout(() => { button.textContent = "Copy"; }, 1500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}

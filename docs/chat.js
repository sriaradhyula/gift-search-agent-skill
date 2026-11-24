import { consumeEvents } from "./team.js";

function chatMarkdown() {
  const md = window.markdownit({ html: false, linkify: false });
  md.validateLink = (value) => {
    const url = URL.parse(value);
    return Boolean(url && /^(https?:\/\/|mailto:)/i.test(value) && !url.username && !url.password);
  };
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const alt = renderer.renderInlineAsText(token.children, options, env) || "Open image";
    const url = token.attrGet("src");
    const escape = md.utils.escapeHtml;
    return `<a href="${escape(url)}">${escape(alt)}</a>`;
  };
  return md;
}

export function enableChat({ endpoint, getContext, getHarness, onActivity, onInspectLink }) {
  const form = document.getElementById("claude-chat");
  const field = document.getElementById("claude-question");
  const messages = document.getElementById("claude-messages");
  const jump = document.getElementById("open-claude-chat");
  const markdown = chatMarkdown();
  const histories = new Map();
  const linkDestinations = new WeakMap();
  const queue = [];
  let draining = false;

  function appendMessage(speaker, text, className) {
    const article = document.createElement("article");
    article.className = "chat-message";
    const label = document.createElement("strong");
    label.textContent = speaker;
    const body = document.createElement("div");
    body.className = `chat-content ${className}`;
    body.textContent = text;
    article.append(label, body);
    messages.append(article);
    return body;
  }

  function showReply(body, text) {
    const follow = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 48;
    body.innerHTML = markdown.render(text);
    for (const link of body.querySelectorAll("a[href]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-link";
      button.setAttribute("aria-label", `Inspect link for ${link.textContent.trim()}`);
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "ⓘ ";
      button.append(icon, ...link.childNodes);
      linkDestinations.set(button, link.href);
      link.replaceWith(button);
    }
    if (follow) messages.scrollTop = messages.scrollHeight;
  }

  messages.addEventListener("click", (event) => {
    const destination = linkDestinations.get(event.target.closest(".chat-link"));
    if (destination) onInspectLink(destination);
  });

  async function send({ content, context, reply, harness }) {
    if (!histories.has(harness.id)) histories.set(harness.id, []);
    const history = histories.get(harness.id);
    let text = "";
    let completed = false;
    let frame;
    reply.textContent = "Thinking…";
    reply.parentElement.setAttribute("aria-busy", "true");
    try {
      const message = { role: "user", content };
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ harness: harness.id, messages: [...history, message], context }),
      });
      await consumeEvents(response, (event) => {
        if (event.kind === "text") {
          text += event.text;
          if (frame === undefined) {
            frame = requestAnimationFrame(() => {
              frame = undefined;
              showReply(reply, text);
            });
          }
        } else if (event.kind === "done") completed = true;
        else onActivity(event);
      });
      if (!completed || !text.trim()) throw new Error(`${harness.label} did not return a reply.`);
      showReply(reply, text);
      history.push(message, { role: "assistant", content: text.trim() });
      while (history.length > 10 || history.reduce((length, entry) => length + entry.content.length, 0) > 160_000) {
        history.splice(0, 2);
      }
    } catch (error) {
      reply.replaceChildren();
      if (text.trim()) showReply(reply, text);
      const alert = document.createElement("p");
      alert.className = "chat-error";
      alert.setAttribute("role", "alert");
      alert.textContent = error.message;
      reply.append(alert);
    } finally {
      if (frame !== undefined) cancelAnimationFrame(frame);
      reply.parentElement.removeAttribute("aria-busy");
    }
  }

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) await send(queue.shift());
    } finally {
      draining = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = field.value;
    if (!content.trim()) return;
    field.value = "";
    const harness = getHarness();
    appendMessage("You", content, "chat-prompt");
    const reply = appendMessage(harness.label, "Queued…", "chat-markdown");
    queue.push({ content, context: getContext(), reply, harness });
    messages.scrollTop = messages.scrollHeight;
    field.focus();
    void drain();
  });

  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  jump.addEventListener("click", () => {
    const opened = form.hidden;
    form.hidden = !opened;
    jump.setAttribute("aria-expanded", String(opened));
    if (opened) field.focus({ preventScroll: true });
  });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.isComposing) {
      form.hidden = true;
      jump.setAttribute("aria-expanded", "false");
      jump.focus({ preventScroll: true });
    }
  });
}

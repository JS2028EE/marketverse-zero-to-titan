// News/event feed with impact-aware presentation.
const NewsEngine = (() => {
  let events = [];
  let feedEl;
  let count = 0;

  function loadEvents() {
    return fetch("data/events.json")
      .then((r) => { if (!r.ok) throw new Error("Events could not be loaded"); return r.json(); })
      .then((data) => { events = Array.isArray(data.events) ? data.events : []; });
  }

  function init() {
    feedEl = document.getElementById("mv-news-feed");
    // Seed the tape so the interface is alive immediately.
    for (let i = 0; i < Math.min(3, events.length); i++) spawnRandomEvent();
    setInterval(spawnRandomEvent, 7000);
  }

  function spawnRandomEvent() {
    if (!events.length || !feedEl) return;
    const ev = events[Math.floor(Math.random() * events.length)];
    renderEvent(ev);
  }

  function renderEvent(ev) {
    const li = document.createElement("li");
    const impact = String(ev.impact || "low").toLowerCase().replace(/\s+/g, "-");
    li.className = `mv-news-item mv-news-item-${impact}`;

    const title = document.createElement("div");
    title.className = "mv-news-item-title";
    title.textContent = ev.title;

    const body = document.createElement("div");
    body.className = "mv-news-item-body";
    body.textContent = ev.body;

    const tag = document.createElement("div");
    tag.className = "mv-news-item-tag";
    tag.textContent = `${String(ev.category || "MARKET").toUpperCase()} · IMPACT ${String(ev.impact || "Low").toUpperCase()}`;

    li.append(title, body, tag);
    feedEl.prepend(li);
    count += 1;
    const countEl = document.getElementById("mv-news-count");
    if (countEl) countEl.textContent = Math.min(count, 99);
    while (feedEl.children.length > 24) feedEl.removeChild(feedEl.lastChild);
  }

  return { loadEvents, init };
})();

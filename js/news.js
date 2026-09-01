// News/events feed

const NewsEngine = (() => {
  let events = [];
  let feedEl;

  function loadEvents() {
    return fetch("data/events.json")
      .then((r) => r.json())
      .then((data) => {
        events = data.events;
      });
  }

  function init() {
    feedEl = document.getElementById("mv-news-feed");
    setInterval(spawnRandomEvent, 8000);
  }

  function spawnRandomEvent() {
    if (!events.length) return;
    const ev = events[Math.floor(Math.random() * events.length)];
    renderEvent(ev);
  }

  function renderEvent(ev) {
    const li = document.createElement("li");
    li.className = "mv-news-item";

    const title = document.createElement("div");
    title.className = "mv-news-item-title";
    title.textContent = ev.title;

    const body = document.createElement("div");
    body.className = "mv-news-item-body";
    body.textContent = ev.body;

    const tag = document.createElement("div");
    tag.className = "mv-news-item-tag";
    tag.textContent = `[${ev.category}] Impact: ${ev.impact}`;

    li.appendChild(title);
    li.appendChild(body);
    li.appendChild(tag);

    feedEl.prepend(li);
    while (feedEl.children.length > 20) {
      feedEl.removeChild(feedEl.lastChild);
    }
  }

  return {
    loadEvents,
    init
  };
})();

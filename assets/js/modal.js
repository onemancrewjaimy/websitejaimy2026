/**
 * Dialoog voor een project (video) of een foto.
 * Gebruikt het native <dialog>-element: focus blijft binnen de dialoog,
 * Escape sluit, en de focus gaat terug naar de kaart die hem opende.
 */
let dialog = null;
let lastTrigger = null;

const CLOSE_ICON =
  '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14"/></svg>';

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', 'modal-title');
  dialog.innerHTML = `
    <button type="button" class="modal__close" data-modal-close aria-label="Sluiten">${CLOSE_ICON}</button>
    <div class="modal__media" data-modal-media></div>
    <div class="modal__body" data-modal-body></div>`;
  document.body.append(dialog);

  dialog.querySelector('[data-modal-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // klik op de achtergrond
  });
  dialog.addEventListener('close', () => {
    dialog.querySelector('[data-modal-media]').replaceChildren(); // stopt de video
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    lastTrigger = null;
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * @param {object} options
 * @param {'video'|'photo'} options.kind
 * @param {string} options.src        video- of afbeeldingspad
 * @param {string} [options.poster]   posterbeeld bij een video
 * @param {string} [options.alt]      alt-tekst bij een foto
 * @param {string} [options.label]    categorie boven de titel
 * @param {string} options.title
 * @param {string} [options.summary]
 * @param {HTMLElement} [options.trigger]
 */
export function openModal({ kind, src, poster, alt, label, title, summary, trigger }) {
  if (!dialog) build();
  lastTrigger = trigger || document.activeElement;

  const media = dialog.querySelector('[data-modal-media]');
  const body = dialog.querySelector('[data-modal-body]');

  if (kind === 'video') {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (poster) video.poster = poster;
    video.src = src;
    video.setAttribute('aria-label', title);
    media.replaceChildren(video);
    video.play().catch(() => {
      /* Automatisch afspelen geweigerd: de bezoeker start de video zelf. */
    });
  } else {
    const image = document.createElement('img');
    image.src = src;
    image.alt = alt || '';
    media.replaceChildren(image);
  }

  const heading = element('h2', '', title);
  heading.id = 'modal-title';
  const parts = [];
  if (label) parts.push(element('p', 'tag', label));
  parts.push(heading);
  if (summary) parts.push(element('p', '', summary));
  if (kind === 'video') {
    const row = element('div', 'btn-row');
    const cta = element('a', 'btn btn--primary', 'Plan een kennismaking');
    cta.href = 'contact';
    row.append(cta);
    parts.push(row);
  }
  body.replaceChildren(...parts);

  dialog.showModal();
}

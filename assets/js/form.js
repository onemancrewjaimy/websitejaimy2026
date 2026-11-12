/**
 * Contactformulier.
 *
 * Controle bij versturen (niet tijdens het typen); elke fout staat onder
 * zijn eigen veld en het eerste foute veld krijgt de focus.
 *
 * Versturen gaat op één van twee manieren:
 * 1. Staat er een adres in data-endpoint op het <form> (bijvoorbeeld van
 *    Formspree: data-endpoint="https://formspree.io/f/..."), dan gaat de
 *    aanvraag daarheen en verschijnt de bevestiging pas na een geslaagd
 *    antwoord.
 * 2. Zonder data-endpoint opent het e-mailprogramma van de bezoeker met een
 *    ingevulde mail aan het adres in het action-attribuut (mailto:). Er
 *    verschijnt dan geen "verstuurd"-melding, want de bezoeker verstuurt de
 *    mail zelf.
 */
const RULES = {
  name: (value) => (value.trim().length >= 2 ? '' : 'Vul je naam in.'),
  email: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? '' : 'Vul een e-mailadres in met een @, bijvoorbeeld naam@bedrijf.nl.'),
  phone: (value) => (!value.trim() || /^[+0-9()\s-]{8,}$/.test(value.trim()) ? '' : 'Controleer je telefoonnummer: alleen cijfers, spaties en een +.'),
  videoType: (value) => (value ? '' : 'Kies het type video.'),
  message: (value) => (value.trim().length >= 10 ? '' : 'Vertel in minstens 10 tekens waar je hulp bij zoekt.'),
};

const TYPE_LABELS = {
  werving: 'Wervingsvideo',
  info: 'Info- of instructievideo',
  advertentie: 'Recruitment advertentie',
  anders: 'Nog niet zeker',
};

export function initForm(form) {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[type="submit"]');
  form.noValidate = true;

  function setError(field, message) {
    const error = form.querySelector(`[data-error-for="${field.name}"]`);
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  function validate() {
    const failed = [];
    Object.entries(RULES).forEach(([name, rule]) => {
      const field = form.elements[name];
      if (!field) return;
      const message = rule(field.value);
      setError(field, message);
      if (message) failed.push(field);
    });
    return failed;
  }

  function setStatus(text, state = '') {
    status.textContent = text;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  function mailBody(data) {
    const lines = [`Naam: ${data.name}`];
    if (data.company) lines.push(`Bedrijf: ${data.company}`);
    lines.push(`E-mail: ${data.email}`);
    if (data.phone) lines.push(`Telefoon: ${data.phone}`);
    lines.push(`Type video: ${TYPE_LABELS[data.videoType] || data.videoType}`, '', data.message);
    return lines.join('\n');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const failed = validate();
    if (failed.length) {
      setStatus(failed.length === 1 ? 'Eén veld is nog niet goed ingevuld.' : `${failed.length} velden zijn nog niet goed ingevuld.`, 'error');
      failed[0].focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const endpoint = form.dataset.endpoint;

    if (!endpoint) {
      const address = form.getAttribute('action').replace(/^mailto:/, '');
      const subject = `Kennismaking: ${TYPE_LABELS[data.videoType] || 'video'}${data.company ? ` voor ${data.company}` : ''}`;
      window.location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody(data))}`;
      setStatus('Je e-mailprogramma opent met je aanvraag. Verstuur de mail om hem af te ronden.');
      return;
    }

    submit.disabled = true;
    const sending = setTimeout(() => setStatus('Bezig met versturen'), 300);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      setStatus('Je aanvraag is verstuurd. Ik reageer binnen 1 werkdag.');
    } catch (error) {
      setStatus('Versturen is niet gelukt. Probeer het opnieuw, of mail naar contact@onemancrew.nl.', 'error');
    } finally {
      clearTimeout(sending);
      submit.disabled = false;
    }
  });
}

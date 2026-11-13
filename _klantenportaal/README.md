# Klantenportaal (bewaard, tijdelijk van de website gehaald)

Op 13 november 2026 is de link naar het klantenportaal van de website gehaald.
Deze map bewaart alles wat nodig is om het portaal later terug te zetten.
De map begint met een underscore, zodat GitHub Pages hem niet publiceert.

## Wat er op de website stond

Alleen de link "Klantenportaal" in de navigatie, op alle vier de pagina's
(`index.html`, `portfolio.html`, `contact.html`, `over-ons.html`), op twee plekken per pagina:

1. In de hoofdnavigatie (`<nav class="nav__links">`), als laatste item na "Contact".
2. In het mobiele menu (`<ul class="menu__list">`), als laatste item na "Contact".

De regel was op beide plekken:

```html
<li><a href="portaal/login.html">Klantenportaal</a></li>
```

## Waar de link naartoe wees

`portaal/login.html`, dus de map `portaal/` naast `index.html`.
Die map met de portaalpagina's zelf heeft nooit in deze repository gestaan;
hier is dus geen portaalcode, inlogpagina of klantgegevens bewaard.

## Wat is blijven staan

`robots.txt` bevat nog de regel `Disallow: /portaal/`. Die houdt zoekmachines
buiten het portaal en kan blijven staan voor als het portaal terugkomt.

## Terugzetten

1. Zet de portaalbestanden in de map `portaal/` (met in elk geval `login.html`).
2. Voeg de regel hierboven weer toe op de twee plekken in elk van de vier pagina's.

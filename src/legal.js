// Impressum + Datenschutz — §5 DDG / DSGVO. Stammdaten: business/STAMMDATEN.md (Stand 07/2026).
export const LEGAL_HTML = `
<h2>Impressum</h2>
<p>Angaben gemäß § 5 DDG</p>
<p>
  <strong>OsAI — Osman Öztopcu</strong><br />
  Karolingerstraße 55<br />
  70736 Fellbach<br />
  Deutschland
</p>
<p>
  E-Mail: osman@osai.solutions<br />
  Telefon: +49 173 1956617<br />
  Web: <a href="https://osai.solutions" style="color:#00F0FF">osai.solutions</a>
</p>
<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE462559965</p>
<p>Verantwortlich für den Inhalt: Osman Öztopcu (Anschrift wie oben)</p>

<h2>Datenschutzerklärung</h2>
<h3>Was wird gespeichert?</h3>
<p>
  TOPPING RUSH ist ein Event-Spiel. Gespeichert wird ausschließlich der von dir
  frei gewählte <strong>Spielname</strong> (max. 16 Zeichen) zusammen mit deinem
  <strong>besten Punktestand</strong> und der Anzahl deiner Versuche — für das
  Event-Leaderboard auf dem Bildschirm vor Ort. Bitte gib keinen echten
  vollständigen Namen ein, ein Spitzname reicht.
</p>
<h3>Rechtsgrundlage &amp; Speicherdauer</h3>
<p>
  Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch aktive
  Namenseingabe und Teilnahme). Die Daten werden nur für die Dauer des Events
  benötigt und über den Board-Reset des Veranstalters gelöscht — sprich einfach
  das Personal an der Bar an, wenn dein Eintrag vorher entfernt werden soll.
</p>
<h3>Technik &amp; Hosting</h3>
<p>
  Die Anwendung läuft auf Vercel (Vercel Inc.); Leaderboard-Daten liegen in einer
  Upstash-Redis-Datenbank (EU-Region). Beim Absenden eines Scores wird deine
  IP-Adresse kurzzeitig technisch verarbeitet (Rate-Limiting gegen Missbrauch),
  aber nicht dauerhaft mit deinem Spielnamen gespeichert. Es werden keine
  Tracking-Cookies gesetzt; im Browser bleiben nur lokale Spieleinstellungen
  (Name, Ton an/aus, eigener Bestwert) in deinem localStorage.
</p>
<h3>Deine Rechte</h3>
<p>
  Du hast das Recht auf Auskunft, Berichtigung und Löschung deiner Daten
  (Art. 15–17 DSGVO). Kontakt: osman@osai.solutions.
</p>
`;

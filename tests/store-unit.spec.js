// v2.5-Gate: Store-Unit-Tests „Jede Runde zählt" — direkt auf MemoryStore
// (läuft im Node-Kontext des Test-Runners, kein HTTP). Deckt ab, was über die
// API nicht erreichbar ist: Trim auf 100, Alt-Member ohne '#' (Anzeige +
// Bestmarken-Übernahme), Split am LETZTEN '#'.
import { test, expect } from '@playwright/test';
import { MemoryStore, memberName } from '../lib/store.js';

test('memberName: Split am LETZTEN #, Alt-Member ohne # bleiben ganz', () => {
  expect(memberName('Selcuk')).toBe('Selcuk'); // Alt-Bestand (Best-of-Ära)
  expect(memberName('Osman#mcz41xab')).toBe('Osman');
  expect(memberName('A#B#xy')).toBe('A#B'); // letzter #, nicht der erste
  expect(memberName('#run1')).toBe('');
});

test('Jede Runde zählt: gleicher Name mehrfach, Rang = Rang DIESER Runde', async () => {
  const s = new MemoryStore();
  const r1 = await s.submit('Alina', 500);
  expect(r1.rank).toBe(1);
  expect(r1.isNewBest).toBe(true);
  expect(typeof r1.runId).toBe('string');

  // schlechtere zweite Runde landet ZUSÄTZLICH auf dem Board (kein Best-of)
  const r2 = await s.submit('Alina', 300);
  expect(r2.rank).toBe(2);
  expect(r2.isNewBest).toBe(false);
  expect(r2.best).toBe(500); // Meta bleibt namensbasiert (GT)
  expect(r2.tries).toBe(2);
  expect(r2.runId).not.toBe(r1.runId);

  const top = await s.top(10);
  expect(top.map((e) => e.name)).toEqual(['Alina', 'Alina']);
  expect(top[0].id).toBe(`Alina#${r1.runId}`);
  expect(top[1].id).toBe(`Alina#${r2.runId}`);
});

test('Alt-Member ohne #: korrekt angezeigt, zählt als bisherige Bestmarke', async () => {
  const s = new MemoryStore();
  s.lb.push({ member: 'Selcuk', score: 1551 }); // Bestands-Eintrag (Best-of-Ära)

  let top = await s.top(10);
  expect(top[0]).toEqual({ name: 'Selcuk', score: 1551, id: 'Selcuk' });

  // neue Runde desselben Namens: eigener Member, Alt-Eintrag bleibt liegen,
  // Bestmarke wird aus dem Alt-Member übernommen → KEIN falsches isNewBest
  const r = await s.submit('Selcuk', 800);
  expect(r.rank).toBe(2);
  expect(r.isNewBest).toBe(false);
  expect(r.best).toBe(1551);
  top = await s.top(10);
  expect(top.map((e) => e.name)).toEqual(['Selcuk', 'Selcuk']);
  expect(top[0].id).toBe('Selcuk'); // Alt-Member unversehrt
  expect(top[1].id).toBe(`Selcuk#${r.runId}`);
});

test('Trim auf 100: Board hält nie mehr als Top 100, zu schwache Runde → rank null', async () => {
  const s = new MemoryStore();
  for (let i = 0; i < 100; i++) await s.submit(`P${i}`, 1000 - i); // Scores 1000..901
  expect(s.lb.length).toBe(100);

  // Runde unterhalb der Top 100 wird sofort weggetrimmt → rank null
  const low = await s.submit('Late', 5);
  expect(low.rank).toBeNull();
  expect(s.lb.length).toBe(100);
  expect(s.lb.some((e) => e.member.startsWith('Late#'))).toBe(false);

  // starke Runde verdrängt den bisherigen Platz 100 (Score 901)
  const high = await s.submit('Star', 2000);
  expect(high.rank).toBe(1);
  expect(s.lb.length).toBe(100);
  expect(s.lb.some((e) => e.score === 901)).toBe(false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { checkDostaWinner, checkProlazWinner, type MatchSettings } from "./matchRules.js";

// Testovi pravila zavrsetka bez baze i Socket.IO servera.
const dosta: MatchSettings = { gameType: "dosta", targetScore: 501, turnDuration: 30 };
const prolaz: MatchSettings = { gameType: "prolaz", targetScore: 1001, turnDuration: 30 };

test("Dosta: mec zavrsava cim ekipa dosegne 501", () => {
  assert.equal(checkDostaWinner(dosta, 490, 450), null);
  assert.equal(checkDostaWinner(dosta, 510, 450), 1);
  assert.equal(checkDostaWinner(dosta, 450, 501), 2);
});

test("Prolaz: pobjednik se odredjuje nakon konacnog obracuna", () => {
  assert.equal(checkProlazWinner(prolaz, 990, 800), null);
  assert.equal(checkProlazWinner(prolaz, 1010, 1030), 2);
  assert.equal(checkProlazWinner(prolaz, 1050, 950), 1);
});

test("Izjednacenje na ciljnom rezultatu ne proglasava pobjednika", () => {
  assert.equal(checkDostaWinner(dosta, 501, 501), null);
  assert.equal(checkProlazWinner(prolaz, 1001, 1001), null);
});

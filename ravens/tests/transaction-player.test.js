const test = require("node:test");
const assert = require("node:assert/strict");
const { extractName, resolve } = require("../transaction-player.js");

const roster = [
  { id: "3916387", displayName: "Lamar Jackson", lastName: "Jackson" },
  { id: "4242433", displayName: "Carl Jones Jr.", lastName: "Jones" },
  { id: "4428317", displayName: "T.J. Tampa", lastName: "Tampa" },
];

test("extracts the full player named in a transaction", () => {
  assert.equal(extractName("Signed WR Shedrick Jackson to the practice squad."), "Shedrick Jackson");
  assert.equal(extractName("Placed CB T.J. Tampa Jr. on Injured Reserve."), "T.J. Tampa Jr");
});

test("does not substitute a roster player who only shares the surname", () => {
  const player = resolve("Signed WR Shedrick Jackson to the practice squad.", roster);
  assert.equal(player.displayName, "Shedrick Jackson");
  assert.equal(player.id, "4361332");
});

test("uses an exact roster identity when available", () => {
  const player = resolve("Signed LB Carl Jones Jr. to the active roster from the practice squad.", roster);
  assert.equal(player.id, "4242433");
});

test("matches harmless suffix differences without falling back to surname-only matching", () => {
  const player = resolve("Placed CB T.J. Tampa Jr. on Injured Reserve.", roster);
  assert.equal(player.id, "4428317");
});

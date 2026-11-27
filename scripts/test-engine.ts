// Quick checks for scoring rules. Run: npm test
import assert from "node:assert/strict";
import { accuracyOf, pointsFor, textMatches } from "../src/shared/scoring";
import type { Question } from "../src/shared/types";

const base = { id: "q", prompt: "x", timeLimit: 20, points: "standard" as const };

// Speed: instant keeps 100%, buzzer keeps 50%
assert.equal(pointsFor({ accuracy: 1, timeMs: 0, limitMs: 20000, mode: "standard", streakAfter: 1 }), 1000);
assert.equal(pointsFor({ accuracy: 1, timeMs: 20000, limitMs: 20000, mode: "standard", streakAfter: 1 }), 500);
assert.equal(pointsFor({ accuracy: 1, timeMs: 0, limitMs: 20000, mode: "double", streakAfter: 1 }), 2000);
assert.equal(pointsFor({ accuracy: 1, timeMs: 0, limitMs: 20000, mode: "none", streakAfter: 3 }), 0);
// Streak bonus: 3 in a row = +200
assert.equal(pointsFor({ accuracy: 1, timeMs: 0, limitMs: 20000, mode: "standard", streakAfter: 3 }), 1200);
// Faster always beats slower
const fast = pointsFor({ accuracy: 1, timeMs: 1200, limitMs: 20000, mode: "standard", streakAfter: 1 });
const slow = pointsFor({ accuracy: 1, timeMs: 9000, limitMs: 20000, mode: "standard", streakAfter: 1 });
assert.ok(fast > slow);

// Choice + poll
const choice: Question = { ...base, type: "choice", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["b"] };
assert.equal(accuracyOf(choice, { type: "choice", optionId: "b" }), 1);
assert.equal(accuracyOf(choice, { type: "choice", optionId: "a" }), 0);
assert.equal(accuracyOf({ ...choice, correct: [] }, { type: "choice", optionId: "a" }), 0);

// Slider closeness
const slider: Question = { ...base, type: "slider", min: 1950, max: 2000, step: 1, correct: 1969 };
assert.equal(accuracyOf(slider, { type: "slider", value: 1969 }), 1);
assert.ok(accuracyOf(slider, { type: "slider", value: 1970 }) > 0.9);
assert.equal(accuracyOf(slider, { type: "slider", value: 1999 }), 0);

// Order partial credit
const order: Question = { ...base, type: "order", items: ["a", "b", "c", "d"].map((id) => ({ id, text: id })) };
assert.equal(accuracyOf(order, { type: "order", order: ["a", "b", "c", "d"] }), 1);
assert.equal(accuracyOf(order, { type: "order", order: ["a", "b", "d", "c"] }), 0.5);

// Typing: typos, case, accents, Cyrillic
assert.ok(textMatches("ulanbaatar", ["Ulaanbaatar"]));
assert.ok(textMatches("  ULAANBAATAR!", ["Ulaanbaatar"]));
assert.ok(textMatches("улаанбаатар", ["Улаанбаатар"]));
assert.ok(textMatches("Ulaanbator", ["Ulaanbaatar"]));
assert.ok(!textMatches("Darkhan", ["Ulaanbaatar"]));
assert.ok(!textMatches("Ag", ["Au"])); // short answers must be exact
assert.ok(textMatches("Өлгий", ["Өлгий"]));

// Pin distance
const pin: Question = { ...base, type: "pin", image: "x", imageAspect: 2, target: { x: 0.5, y: 0.5 }, radius: 0.05 };
assert.equal(accuracyOf(pin, { type: "pin", x: 0.52, y: 0.5 }), 1);
assert.ok(accuracyOf(pin, { type: "pin", x: 0.6, y: 0.5 }) > 0);
assert.equal(accuracyOf(pin, { type: "pin", x: 0.95, y: 0.1 }), 0);

console.log("All scoring checks passed.");

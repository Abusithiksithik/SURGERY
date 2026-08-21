'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreSimilarity, rankSimilarSurgeries, ageToGroup } = require('../engine/similarity');

const target = {
  surgeryTypeId: 'TYPE_A',
  surgeonId: 'SURGEON_1',
  anaesthetistId: 'ANAES_1',
  age: 45,
  gender: 'MALE',
  packageName: 'CARDIAC_PKG',
  departmentId: 'DEPT_1',
};

test('same surgery type + same surgeon scores highest', () => {
  const exactMatch = { ...target };
  const typeOnlyMatch = { ...target, surgeonId: 'SURGEON_2' };
  const s1 = scoreSimilarity(target, exactMatch);
  const s2 = scoreSimilarity(target, typeOnlyMatch);
  assert.ok(s1 > s2);
});

test('age group bucketing groups nearby ages together', () => {
  assert.equal(ageToGroup(45), ageToGroup(47));   // both ADULT (age < 50)
  assert.notEqual(ageToGroup(45), ageToGroup(10)); // ADULT vs CHILD
});

test('rankSimilarSurgeries filters to same surgery type only', () => {
  const candidates = [
    { surgeryId: '1', surgeryTypeId: 'TYPE_A', surgeonId: 'SURGEON_1', surgeryDate: '2026-01-01' },
    { surgeryId: '2', surgeryTypeId: 'TYPE_B', surgeonId: 'SURGEON_1', surgeryDate: '2026-01-02' },
  ];
  const ranked = rankSimilarSurgeries(target, candidates);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].surgeryId, '1');
});

test('rankSimilarSurgeries orders by score then recency', () => {
  const candidates = [
    { surgeryId: 'old-exact', surgeryTypeId: 'TYPE_A', surgeonId: 'SURGEON_1', surgeryDate: '2020-01-01' },
    { surgeryId: 'new-exact', surgeryTypeId: 'TYPE_A', surgeonId: 'SURGEON_1', surgeryDate: '2026-01-01' },
    { surgeryId: 'type-only', surgeryTypeId: 'TYPE_A', surgeonId: 'SURGEON_9', surgeryDate: '2026-06-01' },
  ];
  const ranked = rankSimilarSurgeries(target, candidates);
  assert.equal(ranked[0].surgeryId, 'new-exact'); // same score as old-exact, newer wins
  assert.equal(ranked[1].surgeryId, 'old-exact');
  assert.equal(ranked[2].surgeryId, 'type-only');
});

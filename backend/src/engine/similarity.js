/**
 * similarity.js
 * -----------------------------------------------------------------------
 * Similarity ranking for historical surgeries against a target case
 * profile. This mirrors database/05_schema_functions.sql::fn_similar_surgeries
 * exactly (same weights, same priority order) so that:
 *   - the SQL function can be used for large-scale, indexed DB-side ranking
 *   - this JS module can be used for unit testing, in-memory re-ranking
 *     of an already-fetched candidate set, or "what-if" weight tuning in
 *     the admin UI before persisting new weights.
 *
 * Priority order (spec):
 *   1. Same Surgery Type + Same Surgeon   (highest)
 *   2. Same Surgery Type
 *   3. Same Anaesthetist
 *   4. Same Age Group
 *   5. Same Gender
 *   6. Same Package
 *   7. Same Department
 * -----------------------------------------------------------------------
 */

'use strict';

const DEFAULT_WEIGHTS = Object.freeze({
  surgeonAndType: 40,
  surgeryType: 25,
  anaesthetist: 12,
  ageGroup: 8,
  gender: 5,
  package: 6,
  department: 4,
});

/**
 * Buckets a numeric age into the same groups used by the DB view
 * v_completed_surgeries.age_group, so JS-side and SQL-side scoring agree.
 */
function ageToGroup(age) {
  if (age === null || age === undefined || Number.isNaN(age)) return null;
  if (age < 13) return 'CHILD';
  if (age < 30) return 'YOUNG_ADULT';
  if (age < 50) return 'ADULT';
  if (age < 65) return 'MIDDLE_AGED';
  return 'SENIOR';
}

/**
 * @param {object} target - { surgeryTypeId, surgeonId, anaesthetistId, age, gender, packageName, departmentId }
 * @param {object} candidate - same shape as a row from v_completed_surgeries
 * @param {object} weights - override any of DEFAULT_WEIGHTS
 * @returns {number} similarity score (higher = more similar)
 */
function scoreSimilarity(target, candidate, weights = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  let score = 0;

  const sameType = target.surgeryTypeId && target.surgeryTypeId === candidate.surgeryTypeId;
  const sameSurgeon = target.surgeonId && target.surgeonId === candidate.surgeonId;

  if (sameType && sameSurgeon) score += w.surgeonAndType;
  if (sameType) score += w.surgeryType;
  if (target.anaesthetistId && target.anaesthetistId === candidate.anaesthetistId) {
    score += w.anaesthetist;
  }
  if (ageToGroup(target.age) === ageToGroup(candidate.age) && target.age != null) {
    score += w.ageGroup;
  }
  if (target.gender && target.gender === candidate.gender) score += w.gender;
  if (target.packageName && target.packageName === candidate.packageName) score += w.package;
  if (target.departmentId && target.departmentId === candidate.departmentId) {
    score += w.department;
  }

  return score;
}

/**
 * Ranks and returns the top N candidates for a target case.
 * Minimum relevance bar: candidate must share the same surgery type
 * (matches the SQL function's WHERE clause), otherwise it's not
 * "similar" in any meaningful clinical/cost sense.
 */
function rankSimilarSurgeries(target, candidates, { limit = 10, weights = {} } = {}) {
  return candidates
    .filter((c) => c.surgeryTypeId === target.surgeryTypeId)
    .map((c) => ({ ...c, similarityScore: scoreSimilarity(target, c, weights) }))
    .sort((a, b) => {
      if (b.similarityScore !== a.similarityScore) return b.similarityScore - a.similarityScore;
      // tie-break: most recent first
      return new Date(b.surgeryDate) - new Date(a.surgeryDate);
    })
    .slice(0, limit);
}

module.exports = {
  DEFAULT_WEIGHTS,
  ageToGroup,
  scoreSimilarity,
  rankSimilarSurgeries,
};

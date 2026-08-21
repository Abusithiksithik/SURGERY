'use strict';

const { env } = require('../config/env');

/**
 * Parses page/limit query params into Prisma-ready skip/take, clamped to
 * sane bounds so a client can't request an unbounded result set.
 */
function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = env.DEFAULT_PAGE_SIZE;
  if (limit > env.MAX_PAGE_SIZE) limit = env.MAX_PAGE_SIZE;

  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/** Builds the `meta` block returned alongside paginated list responses. */
function buildPaginationMeta({ page, limit, totalCount }) {
  return {
    page,
    limit,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    hasNextPage: page * limit < totalCount,
    hasPrevPage: page > 1,
  };
}

/**
 * Parses `sort=field:asc,otherField:desc` into a Prisma orderBy array.
 * `allowedFields` guards against sorting on arbitrary/unindexed columns.
 */
function parseSort(sortParam, allowedFields, fallback) {
  if (!sortParam) return fallback;
  const orderBy = [];
  for (const clause of String(sortParam).split(',')) {
    const [field, dirRaw] = clause.split(':');
    const dir = (dirRaw || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    if (allowedFields.includes(field)) {
      orderBy.push({ [field]: dir });
    }
  }
  return orderBy.length ? orderBy : fallback;
}

module.exports = { parsePagination, buildPaginationMeta, parseSort };

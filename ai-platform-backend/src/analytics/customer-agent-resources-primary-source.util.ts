/**
 * Picks exactly one primary RAG/source per assistant message for customer analytics:
 * highest finite relevance score wins; ties break to earliest index in Message.sources.
 * If no finite scores exist, falls back to the first source entry.
 */

export type SourceLikeWithScore = {
  score?: number | string | null;
};

export type PrimarySourcePickResult<T extends SourceLikeWithScore> =
  | { kind: 'none' }
  | { kind: 'primary'; index: number; source: T };

export function pickPrimarySourceForAnalytics<T extends SourceLikeWithScore>(
  sources: readonly T[] | null | undefined,
): PrimarySourcePickResult<T> {
  const arr = Array.isArray(sources) ? sources : [];
  if (arr.length === 0) return { kind: 'none' };

  let foundFinite = false;
  let bestIdx = 0;
  let bestScore = 0;

  for (let i = 0; i < arr.length; i += 1) {
    const raw = arr[i]?.score;
    const n = typeof raw === 'number' ? raw : NaN;
    if (!Number.isFinite(n)) continue;

    if (!foundFinite) {
      foundFinite = true;
      bestIdx = i;
      bestScore = n;
      continue;
    }

    if (n > bestScore || (n === bestScore && i < bestIdx)) {
      bestIdx = i;
      bestScore = n;
    }
  }

  if (foundFinite) {
    const source = arr[bestIdx];
    if (source == null) return { kind: 'none' };
    return { kind: 'primary', index: bestIdx, source };
  }

  const first = arr[0];
  return first != null ? { kind: 'primary', index: 0, source: first } : { kind: 'none' };
}

/**
 * Mongo aggregation expression for the primary `{ ...source }` object from `sources`, or null.
 * Expects `{ $addFields: { sourcesArr: { $ifNull: ['$sources', []] } } }` in a preceding stage.
 */
export function assistantPrimarySourceElementExpr(): Record<string, unknown> {
  return {
    $let: {
      vars: {
        arr: '$sourcesArr',
      },
      in: {
        $cond: [
          { $lte: [{ $size: '$$arr' }, 0] },
          null,
          {
            $let: {
              vars: {
                scan: {
                  $reduce: {
                    input: { $range: [0, { $size: '$$arr' }] },
                    initialValue: { phase: 'none', bestIdx: 0, bestScore: 0 },
                    /**
                     * $reduce binds $$this per element. Nested $lets must NOT reference sibling
                     * bindings in the same `vars` object (MongoDB forbids $$el inside hasNum while
                     * `el` is defined alongside it). Bind index + element first, then derive flags.
                     */
                    in: {
                      $let: {
                        vars: {
                          idx: '$$this',
                          currentEl: { $arrayElemAt: ['$$arr', '$$this'] },
                        },
                        in: {
                          $let: {
                            vars: {
                              hasNumericScore: {
                                $and: [
                                  { $ne: ['$$currentEl.score', null] },
                                  {
                                    $in: [
                                      { $type: '$$currentEl.score' },
                                      ['double', 'int', 'long', 'decimal'],
                                    ],
                                  },
                                ],
                              },
                            },
                            in: {
                              $cond: [
                                { $eq: ['$$hasNumericScore', false] },
                                '$$value',
                                {
                                  $let: {
                                    vars: {
                                      scoreNum: { $toDouble: '$$currentEl.score' },
                                    },
                                    in: {
                                      $cond: [
                                        { $eq: ['$$value.phase', 'none'] },
                                        {
                                          phase: 'scored',
                                          bestIdx: '$$idx',
                                          bestScore: '$$scoreNum',
                                        },
                                        {
                                          $cond: [
                                            {
                                              $or: [
                                                { $gt: ['$$scoreNum', '$$value.bestScore'] },
                                                {
                                                  $and: [
                                                    { $eq: ['$$scoreNum', '$$value.bestScore'] },
                                                    { $lt: ['$$idx', '$$value.bestIdx'] },
                                                  ],
                                                },
                                              ],
                                            },
                                            {
                                              phase: 'scored',
                                              bestIdx: '$$idx',
                                              bestScore: '$$scoreNum',
                                            },
                                            '$$value',
                                          ],
                                        },
                                      ],
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              in: {
                $cond: [
                  { $eq: ['$$scan.phase', 'none'] },
                  { $arrayElemAt: ['$$arr', 0] },
                  { $arrayElemAt: ['$$arr', '$$scan.bestIdx'] },
                ],
              },
            },
          },
        ],
      },
    },
  };
}

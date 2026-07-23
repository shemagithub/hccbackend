/**
 * MariaDB rejects prepared-statement placeholders for LIMIT/OFFSET
 * (`Incorrect arguments to mysqld_stmt_execute`). Rewrite those
 * placeholders to safe inline integers before execute().
 */
export function rewriteLimitOffsetPlaceholders(sql, params = []) {
  if (typeof sql !== 'string' || !Array.isArray(params) || params.length === 0) {
    return { sql, params };
  }

  if (!/\bLIMIT\s*\?/i.test(sql) && !/\bOFFSET\s*\?/i.test(sql)) {
    return { sql, params };
  }

  const questionIndexes = [];
  for (let i = 0; i < sql.length; i += 1) {
    if (sql[i] === '?') {
      questionIndexes.push(i);
    }
  }

  const removals = new Set();
  const replacements = [];
  const limitOffsetRe = /\b(LIMIT|OFFSET)\s*\?/gi;
  let match;

  while ((match = limitOffsetRe.exec(sql)) !== null) {
    const placeholderPos = match.index + match[0].length - 1;
    const paramIndex = questionIndexes.indexOf(placeholderPos);
    if (paramIndex < 0) continue;

    const raw = params[paramIndex];
    const parsed = Number.parseInt(raw, 10);
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      text: `${match[1].toUpperCase()} ${safe}`,
    });
    removals.add(paramIndex);
  }

  if (replacements.length === 0) {
    return { sql, params };
  }

  let nextSql = sql;
  for (let i = replacements.length - 1; i >= 0; i -= 1) {
    const item = replacements[i];
    nextSql = `${nextSql.slice(0, item.start)}${item.text}${nextSql.slice(item.end)}`;
  }

  const nextParams = params.filter((_, index) => !removals.has(index));
  return { sql: nextSql, params: nextParams };
}

export function wrapExecute(executeFn) {
  return (sql, params, ...rest) => {
    const rewritten = rewriteLimitOffsetPlaceholders(sql, params);
    return executeFn(rewritten.sql, rewritten.params, ...rest);
  };
}

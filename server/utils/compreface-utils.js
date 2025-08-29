function findCandidates(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results;
  if (Array.isArray(obj)) {
    obj.forEach((o) => findCandidates(o, results));
    return results;
  }

  const listKeys = ['subjects', 'candidates', 'matches', 'entities', 'candidates_results'];
  for (const k of listKeys) {
    if (Array.isArray(obj[k])) {
      obj[k].forEach((item) => {
        const subj = item.subject || item.name || item.label || item.id;
        const score = item.probability ?? item.confidence ?? item.score ?? item.similarity ?? null;
        if (subj) results.push({ subject: String(subj), score: score != null ? Number(score) : null });
      });
    }
  }

  if (obj.subject && (obj.probability !== undefined || obj.confidence !== undefined || obj.score !== undefined || obj.similarity !== undefined)) {
    const s = obj.subject;
    const p = obj.probability ?? obj.confidence ?? obj.score ?? obj.similarity;
    results.push({ subject: String(s), score: p != null ? Number(p) : null });
  }

  Object.values(obj).forEach((v) => {
    if (typeof v === 'object') findCandidates(v, results);
  });

  return results;
}

function pickBestCandidate(candidates) {
  if (!candidates || !candidates.length) return null;
  return candidates
    .map((c) => ({ subject: c.subject, score: typeof c.score === 'number' ? c.score : 0 }))
    .sort((a, b) => b.score - a.score)[0];
}

function extractComprefaceSubjectId(respJson) {
  if (!respJson) return null;
  if (respJson.subject_id) return respJson.subject_id;
  if (respJson.subject && typeof respJson.subject === 'string') return respJson.subject;
  if (respJson.subject && typeof respJson.subject === 'object' && (respJson.subject.id || respJson.subject._id)) return respJson.subject.id || respJson.subject._id;
  try {
    const stack = [respJson];
    while (stack.length) {
      const obj = stack.pop();
      if (!obj || typeof obj !== 'object') continue;
      if (obj.id && typeof obj.id === 'string') return obj.id;
      if (obj._id && typeof obj._id === 'string') return obj._id;
      Object.values(obj).forEach((v) => { if (typeof v === 'object') stack.push(v); });
    }
  } catch (e) {
    // ignore
  }
  return null;
}

module.exports = { findCandidates, pickBestCandidate, extractComprefaceSubjectId };

export function analyzeTimeline(evidence) {
  return evidence.filter((item) => item.timestamp).map((item) => ({
    date: new Date(item.timestamp).toISOString(),
    event: item.text,
    sourceType: item.sourceType,
    evidenceId: String(item._id),
    author: item.author ?? null
  })).sort((a, b) => a.date.localeCompare(b.date));
}

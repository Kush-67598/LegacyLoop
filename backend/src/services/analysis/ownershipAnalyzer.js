const SOURCE_ROOTS = new Set(['src', 'lib', 'app', 'apps', 'packages', 'services']);

export function moduleForFile(filename) {
  const parts = String(filename).replaceAll('\\', '/').split('/').filter(Boolean);
  if (!parts.length) return '(root)';
  if (parts.length === 1) return '(root)';
  return SOURCE_ROOTS.has(parts[0].toLowerCase()) && parts.length > 2 ? parts[1] : parts[0];
}

export function analyzeOwnership(evidence, { inactiveDays = 180, now = new Date() } = {}) {
  const modules = new Map();
  for (const item of evidence.filter((record) => record.sourceType === 'git_commit')) {
    const author = item.author || item.metadata?.authorEmail || 'Unknown contributor';
    const files = [...new Set(item.metadata?.changedFiles ?? [])];
    const touchedModules = new Set(files.map(moduleForFile));
    if (!touchedModules.size) touchedModules.add('(unknown)');
    for (const moduleName of touchedModules) {
      if (!modules.has(moduleName)) modules.set(moduleName, new Map());
      const contributors = modules.get(moduleName);
      if (!contributors.has(author)) contributors.set(author, { name: author, commitCount: 0, files: new Map(), lastActivity: null });
      const contributor = contributors.get(author);
      contributor.commitCount += 1;
      for (const filename of files.filter((file) => moduleForFile(file) === moduleName)) contributor.files.set(filename, (contributor.files.get(filename) ?? 0) + 1);
      const date = item.timestamp ? new Date(item.timestamp) : null;
      if (date && (!contributor.lastActivity || date > contributor.lastActivity)) contributor.lastActivity = date;
    }
  }

  return [...modules.entries()].map(([module, contributorsMap]) => {
    const contributors = [...contributorsMap.values()].map((person) => ({
      name: person.name,
      commitCount: person.commitCount,
      filesModified: person.files.size,
      mostFrequentlyModifiedFiles: [...person.files.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([file]) => file),
      lastActivity: person.lastActivity?.toISOString() ?? null
    })).sort((a, b) => b.commitCount - a.commitCount);
    const totalCommits = contributors.reduce((sum, person) => sum + person.commitCount, 0);
    const activityDates = contributors.map((person) => person.lastActivity).filter(Boolean);
    const recent = activityDates.some((date) => now - new Date(date) <= inactiveDays * 86400000);
    const riskSignals = [];
    if (contributors.length === 1) riskSignals.push('single_primary_contributor');
    else if (contributors.length <= 2) riskSignals.push('low_contributor_diversity');
    if (contributors.length && activityDates.length && !recent) riskSignals.push('inactive_module');
    const hasDecisionDocumentation = evidence.some((item) => item.sourceType === 'markdown_document' && /decision|architecture|adr/i.test(item.text) && item.text.toLowerCase().includes(module.toLowerCase()));
    if (contributors.length && !hasDecisionDocumentation) riskSignals.push('missing_decision_documentation');
    return { module, totalCommits, contributors, riskSignals };
  }).sort((a, b) => a.module.localeCompare(b.module));
}

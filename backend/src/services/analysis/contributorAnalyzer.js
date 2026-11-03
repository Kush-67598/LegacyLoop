export function analyzeContributors(ownership, { departingMember } = {}) {
  return ownership.map((item) => {
    const total = item.contributors.reduce((sum, contributor) => sum + contributor.commitCount, 0);
    const leaver = departingMember && item.contributors.find((person) => person.name.toLowerCase() === departingMember.toLowerCase());
    const leaverShare = leaver && total ? leaver.commitCount / total : 0;
    const riskSignals = [];
    if (item.contributors.length === 1) riskSignals.push('only_one_recorded_contributor');
    if (leaver && leaverShare > 0.5) riskSignals.push('departing_member_majority_activity');
    if (item.contributors.length <= 1) riskSignals.push('limited_evidence_of_other_contributor_familiarity');
    return { module: item.module, recordedContributors: item.contributors.length, departingMemberCommitShare: leaver ? Number(leaverShare.toFixed(2)) : null, riskSignals };
  });
}

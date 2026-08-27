// Orchestrator: runs all enabled rules over parsed content, returns report
window.Validator = {
  run(rawText, ruleState) {
    const parsed = window.XhtmlParser.parse(rawText);
    const state = ruleState || {};
    const activeRules = window.RULES_CONFIG.filter(r =>
      Object.prototype.hasOwnProperty.call(state, r.id) ? state[r.id] : r.enabled
    );

    const issues = [];
    for (const rule of activeRules) {
      const found = window.runRule(rule.id, parsed, true);
      issues.push(...found);
    }

    return {
      parsed,
      activeRules,
      issues,
      issueCount: issues.length
    };
  }
};

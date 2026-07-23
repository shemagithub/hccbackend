/**
 * System health score (0–100).
 *
 * Previous logic treated empty datasets (no tasks, no risks, no completed projects)
 * as 0%, which produced misleading scores like 20% when only staff were active.
 * Empty operational data is neutral (healthy); problems are measured explicitly.
 */

function pct(part, whole, emptyScore = 100) {
  const denominator = Number(whole) || 0;
  const numerator = Number(part) || 0;
  if (denominator <= 0) return emptyScore;
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}

function pressureScore(count, softCap = 25) {
  const value = Number(count) || 0;
  if (value <= 0) return 100;
  return Math.max(0, 100 - (value / softCap) * 100);
}

export function calculateSystemHealth({
  staffStats = {},
  projectStats = {},
  taskStats = {},
  riskStats = {},
  issueStats = {},
  totalPendingItems = 0,
}) {
  const projectTotal = Number(projectStats.total) || 0;
  const projectDelivery =
    projectTotal <= 0
      ? 100
      : Math.max(
          0,
          100
            - pct(projectStats.overdue, projectTotal, 0)
            - pct(projectStats.onHold, projectTotal, 0) * 0.5,
        );

  const taskProgress = pct(taskStats.completed, taskStats.total);

  const riskTotal = Number(riskStats.total) || 0;
  const riskPosture =
    riskTotal <= 0
      ? 100
      : Math.max(
          0,
          100
            - pct(riskStats.active, riskTotal, 0) * 0.55
            - pct(riskStats.critical, riskTotal, 0) * 0.45,
        );

  const issueTotal = Number(issueStats.total) || 0;
  const issuePosture = issueTotal <= 0 ? 100 : pct(issueStats.resolved, issueTotal);

  const healthFactors = {
    activeStaff: Math.round(pct(staffStats.active, staffStats.total)),
    projectDelivery: Math.round(projectDelivery),
    taskProgress: Math.round(taskProgress),
    riskPosture: Math.round(riskPosture),
    issuePosture: Math.round(issuePosture),
    backlogHealth: Math.round(pressureScore(totalPendingItems)),
  };

  const systemHealthScore = Math.round(
    healthFactors.activeStaff * 0.15 +
      healthFactors.projectDelivery * 0.25 +
      healthFactors.taskProgress * 0.2 +
      healthFactors.riskPosture * 0.15 +
      healthFactors.issuePosture * 0.1 +
      healthFactors.backlogHealth * 0.15,
  );

  const systemHealth =
    systemHealthScore >= 80
      ? 'Excellent'
      : systemHealthScore >= 60
        ? 'Good'
        : systemHealthScore >= 40
          ? 'Fair'
          : 'Poor';

  return { healthFactors, systemHealthScore, systemHealth };
}

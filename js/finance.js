// ===============================
// FINANCE SERVICE (PRO VERSION)
// ===============================

window.calculateFinance = function ({
  payments = [],
  enrollments = [],
  cashEntries = [],
  cashExits = []
}) {

  // =========================
  // RECEITA REAL (PAGAMENTOS)
  // =========================

  const received = payments
    .filter(p => p.status === "paid")
    .reduce((acc, p) => acc + (p.amount || 0), 0)

  // =========================
  // RECEITA ESPERADA (MATRÍCULAS)
  // =========================

  const activeEnrollments = enrollments.filter(e => e.status === "active")

  const expected = activeEnrollments
    .reduce((acc, e) => acc + (e.final_price || e.monthly_fee || 0), 0)

  // =========================
  // PROJEÇÃO
  // =========================

  const projected = expected * 0.9

  // =========================
  // INADIMPLÊNCIA
  // =========================

 const overdue = payments
  .filter(p => p.status === "overdue" || p.status === "pending")
    .reduce((acc, p) => acc + (p.amount || 0), 0)

  const defaultRate = expected > 0
    ? (overdue / expected) * 100
    : 0

  // =========================
  // CAIXA
  // =========================

  const entries = cashEntries
    .reduce((acc, c) => acc + (c.amount || 0), 0)

  const exits = cashExits
    .reduce((acc, c) => acc + (c.amount || 0), 0)

  const balance = entries - exits

  // =========================
  // CONSOLIDADO
  // =========================

  const total = received + balance

  return {
    receita: { received, expected, projected },
    inadimplencia: { overdue, defaultRate },
    caixa: { entries, exits, balance },
    total
  }
}
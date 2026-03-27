// ===============================
// FINANCE SERVICE (GLOBAL SAFE)
// ===============================

window.calculateFinance = function ({
  payments = [],
  cashEntries = [],
  cashExits = []
}) {

  // RECEITA
  const received = payments
    .filter(p => p.status === "paid")
    .reduce((acc, p) => acc + (p.amount || 0), 0)

  const expected = payments
    .reduce((acc, p) => acc + (p.amount || 0), 0)

  const projected = expected * 0.9

  const overdue = payments
    .filter(p => p.status === "overdue")
    .reduce((acc, p) => acc + (p.amount || 0), 0)

  const defaultRate = expected > 0
    ? (overdue / expected) * 100
    : 0

  // CAIXA
  const entries = cashEntries
    .reduce((acc, c) => acc + (c.amount || 0), 0)

  const exits = cashExits
    .reduce((acc, c) => acc + (c.amount || 0), 0)

  const balance = entries - exits

  // CONSOLIDADO
  const total = received + balance

  return {
    receita: { received, expected, projected },
    inadimplencia: { overdue, defaultRate },
    caixa: { entries, exits, balance },
    total
  }
}
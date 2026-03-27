window.calculateFinance = function ({
  payments = [],
  enrollments = [],
  cashEntries = [],
  cashExits = []
}) {

  const normalizeStatus = (s) => (s || "").toLowerCase();

  // =========================
  // RECEBIDO
  // =========================

  const received = payments
    .filter(p => normalizeStatus(p.status) === "paid" || normalizeStatus(p.status) === "pago")
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  // =========================
  // ESPERADO
  // =========================

  const activeEnrollments = enrollments
    .filter(e => normalizeStatus(e.status) === "active" || normalizeStatus(e.status) === "ativo");

  const expected = activeEnrollments
    .reduce((acc, e) => acc + (e.final_price || e.monthly_fee || 0), 0);

  // =========================
  // PROJEÇÃO
  // =========================

  const projected = expected * 0.9;

  // =========================
  // INADIMPLÊNCIA
  // =========================

  const overdue = payments
    .filter(p => {
      const s = normalizeStatus(p.status);
      return s === "overdue" || s === "pending" || s === "vencido" || s === "pendente";
    })
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const defaultRate = expected > 0
    ? Math.min((overdue / expected) * 100, 100)
    : 0;

  // =========================
  // CAIXA
  // =========================

  const entries = cashEntries
    .reduce((acc, c) => acc + (c.amount || 0), 0);

  const exits = cashExits
    .reduce((acc, c) => acc + (c.amount || 0), 0);

  const balance = entries - exits;

  // =========================
  // TOTAL (CORRETO)
  // =========================

  const total = Number(received || 0) + Number(balance || 0);

  return {
    receita: { received, expected, projected },
    inadimplencia: { overdue, defaultRate },
    caixa: { entries, exits, balance },
    total
  };
};
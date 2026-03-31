window.calculateFinance = function ({
  payments = [],
  cash = []
}) {

  // =========================
  // 🔥 EXCLUI BOLSISTAS INTEGRAIS
  // scholarship = 1 E final_amount = 0
  // não entram nos cálculos financeiros
  // =========================

  const billablePayments = payments.filter(p =>
  !(Number(p.scholarship) === 1 && Number(p.final_amount) === 0)
);

  // =========================
  // RECEITA
  // =========================

  let esperado = 0;
  let recebido = 0;
  let atrasado = 0;
  let pendente = 0;

  const today = new Date();

  billablePayments.forEach(p => {
    const value = Number(p.final_amount || 0);
    esperado += value;

    if (p.status === "paid") {
      recebido += value;
    } else if (p.status === "pending") {
      const due = new Date(p.due_date);
      if (due < today) atrasado += value;
      else pendente += value;
    } else if (p.status === "overdue") {
      atrasado += value;
    }
  });

  const projetado  = recebido + pendente;

  const defaultRate = esperado > 0
    ? Math.min((atrasado / esperado) * 100, 100)
    : 0;

  // =========================
  // CAIXA
  // =========================

  let entries = 0;
  let exits   = 0;

  cash.forEach(c => {
    const v = Number(c.amount || 0);
    if (c.type === "in")  entries += v;
    if (c.type === "out") exits   += v;
  });

  const balance = entries - exits;

  // =========================
  // TOTAL CONSOLIDADO
  // =========================

  const total = recebido + balance;

  return {
    receita:       { esperado, recebido, projetado, pendente },
    inadimplencia: { atrasado, defaultRate },
    caixa:         { entries, exits, balance },
    total
  };
};
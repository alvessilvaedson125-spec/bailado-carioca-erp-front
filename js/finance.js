// js/finance.js

window.calculateFinance = function (paymentsData = [], cashData = []) {
  try {
    let esperado = 0;
    let recebido = 0;
    let pendente = 0;
    let atrasado = 0;

    const today = new Date();

    // PAYMENTS
    paymentsData.forEach(p => {
      const value = Number(p.final_amount || p.amount || 0);

      esperado += value;

      if (p.status === "paid") {
        recebido += value;
        return;
      }

      if (p.status === "pending") {
        const due = p.due_date ? new Date(p.due_date) : null;

        if (due && due < today) {
          atrasado += value;
        } else {
          pendente += value;
        }
      }
    });

    const projetado = recebido + pendente;

    const inadPercent = esperado > 0
      ? (atrasado / esperado) * 100
      : 0;

    // CASH
    let entradas = 0;
    let saidas = 0;

    cashData.forEach(e => {
      const v = Number(e.amount || 0);

      if (e.type === "in") entradas += v;
      if (e.type === "out") saidas += v;
    });

    const saldo = entradas - saidas;

    // CONSOLIDADO
    const total = recebido + saldo;

    return {
      esperado,
      recebido,
      projetado,
      atrasado,
      inadPercent,
      entradas,
      saidas,
      saldo,
      total
    };

  } catch (err) {
    console.error("Finance error:", err);

    return {
      esperado: 0,
      recebido: 0,
      projetado: 0,
      atrasado: 0,
      inadPercent: 0,
      entradas: 0,
      saidas: 0,
      saldo: 0,
      total: 0
    };
  }
};
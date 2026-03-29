(function(){

  let classesCache = [];
  let studentsCache = [];
  let attendanceData = {};

  const el  = (id) => document.getElementById(id);
  const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ===============================
  // INIT
  // ===============================

  async function init(){
    console.log("Attendance module iniciado");

    await checkAuth();

    await loadClasses();

    el("att-load-btn")?.addEventListener("click", loadCall);
    el("att-save-btn")?.addEventListener("click", saveCall);
    el("att-all-present")?.addEventListener("click", markAllPresent);
    el("att-history-btn")?.addEventListener("click", loadHistory);

    // Data padrão: hoje
    const today = new Date().toISOString().split("T")[0];
    if(el("att-date")) el("att-date").value = today;
  }

  // ===============================
  // CARREGAR TURMAS
  // ===============================

  async function loadClasses(){
    try{
      const res = await apiRequest("/api/v1/classes");
      classesCache = res?.success ? res.data : [];

      const selects = ["att-class", "att-history-class"];

      selects.forEach(id => {
        const select = el(id);
        if(!select) return;

        select.innerHTML = `<option value="">Selecione a turma...</option>`;

        classesCache.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name;
          select.appendChild(opt);
        });
      });

    }catch(err){
      console.error(err);
      Toast.error("Erro ao carregar turmas");
    }
  }

  // ===============================
  // CARREGAR CHAMADA
  // ===============================

  async function loadCall(){
    const classId = el("att-class")?.value;
    const date    = el("att-date")?.value;

    if(!classId){
      Toast.warning("Selecione a turma");
      return;
    }

    if(!date){
      Toast.warning("Selecione a data");
      return;
    }

    const tbody = el("att-table-body");
    if(tbody) tbody.innerHTML = `<tr><td colspan="3">Carregando...</td></tr>`;

    try{

      const res = await apiRequest(
        `/api/v1/attendance/students?class_id=${classId}&date=${date}`
      );

      if(!res || !res.success){
        Toast.error("Erro ao carregar alunos");
        return;
      }

      studentsCache = res.data || [];

      if(studentsCache.length === 0){
        if(tbody) tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Nenhum aluno matriculado nesta turma</td></tr>`;
        return;
      }

      // Mostra container da chamada
      el("att-call-container")?.classList.remove("hidden");

      // Título
      const cls = classesCache.find(c => c.id === classId);
      const dateFormatted = new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric"
      });

      if(el("att-call-title"))    el("att-call-title").innerText = cls?.name || "—";
      if(el("att-call-subtitle")) el("att-call-subtitle").innerText = dateFormatted;

      renderCallTable(studentsCache);

    }catch(err){
      console.error(err);
      Toast.error("Erro ao carregar chamada");
    }
  }

  // ===============================
  // RENDER TABELA DE CHAMADA
  // ===============================

  function renderCallTable(students){
    const tbody = el("att-table-body");
    if(!tbody) return;

    tbody.innerHTML = "";

    students.forEach(student => {

      const tr = document.createElement("tr");

      const scholarshipBadge = student.scholarship
        ? `<span class="badge blue">Bolsista</span>`
        : `<span class="badge gray">—</span>`;

      // Status já registrado ou padrão presente
      const isPresent = student.status !== "absent";

      tr.innerHTML = `
        <td>
          <div class="student-cell">
            <div class="student-avatar">${getInitials(student.student_name)}</div>
            <strong>${student.student_name}</strong>
          </div>
        </td>
        <td>${scholarshipBadge}</td>
        <td>
          <div class="att-toggle">
            <button
              class="att-btn ${isPresent ? "att-present active" : "att-present"}"
              data-enrollment="${student.enrollment_id}"
              data-status="present"
            >✅ Presente</button>
            <button
              class="att-btn ${!isPresent ? "att-absent active" : "att-absent"}"
              data-enrollment="${student.enrollment_id}"
              data-status="absent"
            >❌ Ausente</button>
          </div>
        </td>
      `;

      // Eventos dos botões
      tr.querySelectorAll(".att-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const enrollmentId = btn.dataset.enrollment;
          const status       = btn.dataset.status;

          // Remove active de ambos os botões da linha
          tr.querySelectorAll(".att-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          // Salva no mapa local
          attendanceData[enrollmentId] = status;
        });
      });

      // Inicializa mapa com status atual
      attendanceData[student.enrollment_id] = isPresent ? "present" : "absent";

      tbody.appendChild(tr);
    });
  }

  // ===============================
  // MARCAR TODOS PRESENTES
  // ===============================

  function markAllPresent(){
    studentsCache.forEach(s => {
      attendanceData[s.enrollment_id] = "present";
    });

    // Atualiza visualmente
    document.querySelectorAll(".att-btn").forEach(btn => {
      if(btn.dataset.status === "present"){
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    Toast.success("Todos marcados como presentes");
  }

  // ===============================
  // SALVAR CHAMADA
  // ===============================

  async function saveCall(){
    const classId = el("att-class")?.value;
    const date    = el("att-date")?.value;

    if(!classId || !date){
      Toast.warning("Selecione turma e data antes de salvar");
      return;
    }

    if(studentsCache.length === 0){
      Toast.warning("Nenhum aluno para registrar");
      return;
    }

    const records = studentsCache.map(s => ({
      enrollment_id: s.enrollment_id,
      student_id:    s.student_id,
      status:        attendanceData[s.enrollment_id] || "present"
    }));

    try{

      const res = await apiRequest("/api/v1/attendance", "POST", {
        class_id: classId,
        date,
        records
      });

      if(!res || !res.success){
        Toast.error("Erro ao salvar chamada");
        return;
      }

      Toast.success(
        `Chamada salva! ${res.saved} registradas, ${res.updated} atualizadas`
      );

    }catch(err){
      console.error(err);
      Toast.error("Erro ao salvar chamada");
    }
  }

  // ===============================
  // HISTÓRICO DE FREQUÊNCIA
  // ===============================

  async function loadHistory(){
    const classId = el("att-history-class")?.value;

    if(!classId){
      Toast.warning("Selecione a turma");
      return;
    }

    const container = el("att-history-container");
    if(container) container.innerHTML = `<p class="empty-state">Carregando...</p>`;

    try{

      const res = await apiRequest(
        `/api/v1/attendance/summary?class_id=${classId}`
      );

      if(!res || !res.success){
        Toast.error("Erro ao carregar histórico");
        return;
      }

      renderHistory(res.data || []);

    }catch(err){
      console.error(err);
      Toast.error("Erro ao carregar histórico");
    }
  }

  // ===============================
  // RENDER HISTÓRICO
  // ===============================

  function renderHistory(data){
    const container = el("att-history-container");
    if(!container) return;

    if(!data.length){
      container.innerHTML = `<p class="empty-state">Nenhuma presença registrada</p>`;
      return;
    }

    container.innerHTML = `
      <table class="data-table" id="att-history-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Bolsista</th>
            <th>Presenças</th>
            <th>Faltas</th>
            <th>Total aulas</th>
            <th>Frequência</th>
          </tr>
        </thead>
        <tbody id="att-history-body"></tbody>
      </table>
    `;

    const tbody = el("att-history-body");

    data.forEach(row => {
      const tr = document.createElement("tr");

      const freq = row.total_classes > 0
        ? (row.total_present / row.total_classes) * 100
        : 0;

      const freqColor = freq >= 75 ? "green" : freq >= 50 ? "orange" : "red";

      const scholarshipBadge = row.scholarship
        ? `<span class="badge blue">Bolsista</span>`
        : `<span class="badge gray">—</span>`;

      tr.innerHTML = `
        <td><strong>${row.student_name}</strong></td>
        <td>${scholarshipBadge}</td>
        <td>${row.total_present}</td>
        <td>${row.total_absent}</td>
        <td>${row.total_classes}</td>
        <td>
          <span class="badge ${freqColor}">${freq.toFixed(0)}%</span>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // ===============================
  // UTILS
  // ===============================

  function getInitials(name){
    if(!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  window.AttendanceModule = { init };

})();
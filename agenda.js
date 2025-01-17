document.addEventListener("DOMContentLoaded", () => {
    const daysRow = document.getElementById("days-row");
    const techniciansBody = document.getElementById("technicians-body");
    const monthNameElement = document.getElementById("month-name");
    const monthSelect = document.getElementById("month-select");
    const yearSelect = document.getElementById("year-select");
    const updateButton = document.getElementById("update-calendar");
    const addTechnicianBtn = document.getElementById("add-technician-btn");
    const saveTableButton = document.getElementById("save-table");
    const modal = document.getElementById("modal");
    const closeModal = document.getElementById("close-modal");
    const saveTechnician = document.getElementById("save-technician");
    const technicianNameInput = document.getElementById("technician-name");
  
    // Meses do ano
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
  
    // Lista global de técnicos
    let technicians = [];
  
    // Preencher o dropdown de meses
    monthNames.forEach((month, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = month;
      monthSelect.appendChild(option);
    });
  
    // Inicializar o calendário com o mês e ano atual
    const today = new Date();
    monthSelect.value = today.getMonth();
    yearSelect.value = today.getFullYear();
    generateCalendar(today.getFullYear(), today.getMonth());
    loadTechniciansFromLocalStorage(); // Carregar os dados dos técnicos ao carregar a página
  
    // Atualizar o calendário ao clicar no botão
    updateButton.addEventListener("click", () => {
      const selectedMonth = parseInt(monthSelect.value, 10);
      const selectedYear = parseInt(yearSelect.value, 10);
      generateCalendar(selectedYear, selectedMonth);
      loadAgendaForCurrentMonth(); // Carregar os dados do mês/ano atual
    });
  
    // Gerar o calendário
    function generateCalendar(year, month) {
      // Atualizar o nome do mês e ano no cabeçalho
      monthNameElement.textContent = `${monthNames[month]} ${year}`;
  
      // Obter o número de dias no mês selecionado
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  
      // Gerar o HTML da linha de dias da semana
      let daysHTML = `<th class="left-header">Técnicos</th>`;
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const weekday = weekdays[date.getDay()];
        daysHTML += `<th>${weekday}<br>${String(day).padStart(2, "0")}</th>`;
      }
      daysHTML += `<th>Ações</th>`; // Adicionar coluna para ações
      daysRow.innerHTML = daysHTML;
    }
  
    // Mostrar modal ao clicar no botão "Adicionar Técnico"
    addTechnicianBtn.addEventListener("click", () => {
      modal.style.display = "block";
    });
  
    // Fechar o modal
    closeModal.addEventListener("click", () => {
      modal.style.display = "none";
    });
  
    // Adicionar técnico ao clicar em "Salvar"
    saveTechnician.addEventListener("click", () => {
        const technicianName = technicianNameInput.value.trim();
        if (technicianName === "") {
          alert("Por favor, insira um nome para o técnico.");
          return;
        }
      
        // Obter chave atual (mês/ano/região)
        const key = getAgendaKey();
      
        // Verificar se o técnico já existe na tabela atual (mês/ano/região)
        const currentTechnicians = technicians.filter((tech) => tech.agendas[key]);
        const isDuplicateInCurrentContext = currentTechnicians.some(
          (tech) => tech.name.toLowerCase() === technicianName.toLowerCase()
        );
      
        if (isDuplicateInCurrentContext) {
          alert("Este técnico já foi adicionado neste contexto (mês, ano, região).");
          return;
        }
      
        // Verificar se o técnico já existe globalmente
        let technician = technicians.find(
          (tech) => tech.name.toLowerCase() === technicianName.toLowerCase()
        );
      
        if (!technician) {
          // Criar um novo técnico
          technician = {
            id: unicoID(), // Gerar ID único
            name: technicianName,
            agendas: {} // Inicializa as agendas vazias
          };
          technicians.push(technician); // Adicionar à lista global
        }
      
        // Garantir que haja uma agenda para o contexto atual
        if (!technician.agendas[key]) {
          const daysInMonth = daysRow.children.length - 2; // Excluir "Técnicos" e "Ações"
          technician.agendas[key] = Array(daysInMonth).fill("Não");
        }
      
        addTechnicianRow(technician); // Adicionar a linha na tabela
      
        // Fechar o modal e limpar o campo de entrada
        modal.style.display = "none";
        technicianNameInput.value = "";
      });
  
    // Adicionar uma linha para o técnico na tabela
    function addTechnicianRow(technician) {
      const key = getAgendaKey(); // Chave do mês/ano atual
      const daysInMonth = daysRow.children.length - 2; // Excluir "Técnicos" e "Ações"
      const agenda = technician.agendas[key] || Array(daysInMonth).fill("Não");
  
      let rowHTML = `<td class="left-header">${technician.name}</td>`;
      agenda.forEach((value, i) => {
        rowHTML += `
          <td>
            <select data-index="${i}" data-id="${technician.id}">
              <option value="Sim" ${value === "Sim" ? "selected" : ""}>Sim</option>
              <option value="Não" ${value === "Não" ? "selected" : ""}>Não</option>
            </select>
          </td>`;
      });
  
      rowHTML += `
        <td>
          <button class="remove-btn">
            <img src="imagens/remover.png" alt="Remover Técnico" title="Remover Técnico" />
          </button>
        </td>`;
  
      const newRow = document.createElement("tr");
      newRow.innerHTML = rowHTML;
      techniciansBody.appendChild(newRow);
  
      // Adicionar evento de alteração aos selects
      newRow.querySelectorAll("select").forEach((select) => {
        select.addEventListener("change", (event) => {
          const dayIndex = parseInt(event.target.getAttribute("data-index"), 10);
          const technicianId = event.target.getAttribute("data-id");
  
          // Atualizar o valor no objeto técnico
          const technician = technicians.find((tech) => tech.id === technicianId);
          if (technician) {
            technician.agendas[key][dayIndex] = event.target.value;
          }
        });
      });
  
      // Adicionar evento de remoção ao botão
      const removeBtn = newRow.querySelector(".remove-btn");
      removeBtn.addEventListener("click", () => {
        techniciansBody.removeChild(newRow);
        technicians = technicians.filter((tech) => tech.id !== technician.id); // Remover da lista global
      });
    }
  
    // Salvar técnicos no localStorage
    saveTableButton.addEventListener("click", () => {
      localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(technicians));
      alert("Tabela salva com sucesso!");
    });
  
    // Carregar técnicos do localStorage
function loadTechniciansFromLocalStorage() {
    const savedData = localStorage.getItem("dados_agenda_tecnicos");
  
    try {
      // Tentar converter os dados salvos em um array válido
      technicians = savedData ? JSON.parse(savedData) : [];
      if (!Array.isArray(technicians)) {
        // Caso não seja um array, redefinir como vazio
        technicians = [];
      }
    } catch (error) {
      console.error("Erro ao carregar dados do localStorage:", error);
      technicians = []; // Se der erro, inicializar como um array vazio
    }
  
    loadAgendaForCurrentMonth();
  }
  
  function loadAgendaForCurrentMonth() {
    const key = getAgendaKey();
    techniciansBody.innerHTML = ""; // Limpar a tabela
    technicians.forEach((technician) => {
      if (technician.agendas[key]) {
        addTechnicianRow(technician);
      }
    });
  }
  
  function getAgendaKey() {
    const region = document.getElementById("region-select").value;
    const month = monthSelect.value;
    const year = yearSelect.value;
    return `${year}_${month}_${region}`; // Combina mês, ano e região
  }
})
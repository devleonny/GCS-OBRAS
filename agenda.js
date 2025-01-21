document.addEventListener("DOMContentLoaded", () => {
  const daysRow = document.getElementById("days-row");
  const techniciansBody = document.getElementById("technicians-body");
  const monthNameElement = document.getElementById("month-name");
  const monthSelect = document.getElementById("month-select");
  const yearSelect = document.getElementById("year-select");
  const syncDataBtn = document.getElementById("sync-data-btn");
  const addLineBtn = document.getElementById("add-line-btn");

  // Mapeamento para as cores dos departamentos
const departmentColors = {
  "Administrativo": "#FF5733",
  "Financeiro": "#33FF57",
  "RH": "#3357FF",
  "TI": "#F5A623",
  "Comercial": "#8E44AD",
  "Produção": "#1ABC9C",
  "Logística": "#E74C3C"
};

// Função para gerar uma cor aleatória
function getRandomColor() {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
}

// Função para obter a cor de um departamento
function getDepartmentColor(departmentName) {
  if (!departmentColors[departmentName]) {
      departmentColors[departmentName] = getRandomColor();
  }
  return departmentColors[departmentName];
}


  const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  let technicians = []; // Declaração global
  let departments = [];
  let technicianOptions = [];

  // Carregar configurações atuais (mês, ano, região)
  loadCurrentSettings();

  // Preencher dropdown de meses
  monthNames.forEach((month, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = month;
      monthSelect.appendChild(option);
  });

  // Carregar dados salvos no localStorage (departamentos e técnicos)
  loadFromLocalStorage();

  // Gerar tabela inicial com base no mês, ano e região carregados
  generateCalendar(yearSelect.value, monthSelect.value);
  loadTechniciansFromLocalStorage(); // Preenche a tabela com base no localStorage

  // Eventos para salvar configurações e recarregar a tabela ao alterar mês, ano ou região
  monthSelect.addEventListener("change", () => {
      saveCurrentSettings();
      generateCalendar(yearSelect.value, monthSelect.value);
      loadTechniciansFromLocalStorage();
  });

  yearSelect.addEventListener("input", () => {
      saveCurrentSettings();
      generateCalendar(yearSelect.value, monthSelect.value);
      loadTechniciansFromLocalStorage();
  });

  document.getElementById("region-select").addEventListener("change", () => {
      saveCurrentSettings();
      loadTechniciansFromLocalStorage();
  });

  // Botão para sincronizar dados
  syncDataBtn.addEventListener("click", async () => {
      showLoading();
      try {
          const [fetchedDepartments, fetchedTechnicians] = await Promise.all([
              fetchDepartmentsFromAPI(),
              resgatar_tecnicos()
          ]);

          // Salvar dados sincronizados no localStorage
          localStorage.setItem("departments", JSON.stringify(fetchedDepartments));
          localStorage.setItem("technicians", JSON.stringify(fetchedTechnicians));

          // Atualizar variáveis locais
          departments = fetchedDepartments;
          technicianOptions = fetchedTechnicians;

          // Recarregar a tabela
          loadTechniciansFromLocalStorage();
          alert("Dados sincronizados com sucesso!");
      } catch (error) {
          console.error("Erro ao sincronizar os dados:", error);
          alert("Erro ao sincronizar os dados. Verifique sua conexão e tente novamente.");
      } finally {
          hideLoading();
      }
  });

  // Botão para adicionar nova linha
  addLineBtn.addEventListener("click", addNewRow);

  // Função para carregar dados do localStorage
  function loadFromLocalStorage() {
    const storedDepartments = localStorage.getItem("departments");
    const storedTechnicians = localStorage.getItem("technicians");

    // Verificar se já existem dados no localStorage
    if (storedDepartments) {
        departments = JSON.parse(storedDepartments);
    } else {
        departments = []; // Inicializa vazio caso não existam dados
    }

    // Adiciona uma cor para cada departamento, se não existir
    departments = departments.map((dept) => {
        if (!dept.color) {
            dept.color = getRandomColor(); // Gera cor aleatória para departamentos sem cor
        }
        return dept;
    });

    // Salva as cores atualizadas no localStorage
    localStorage.setItem("departments", JSON.stringify(departments));

    if (storedTechnicians) {
        technicianOptions = JSON.parse(storedTechnicians);
    } else {
        technicianOptions = []; // Inicializa vazio caso não existam dados
    }

    console.log("Dados carregados do localStorage:", { departments, technicianOptions });
}



  // Função para mostrar o indicador de carregamento
  function showLoading() {
      const totalColumns = daysRow.children.length || 3;
      techniciansBody.innerHTML = `
          <tr>
              <td colspan="${totalColumns}" class="loading-container">
                  <img src="gifs/loading.gif" alt="Carregando" class="loading-gif">
                  <p>Carregando dados...</p>
              </td>
          </tr>
      `;
  }

  // Função para ocultar o indicador de carregamento
  function hideLoading() {
      techniciansBody.innerHTML = ""; // Limpa o tbody
  }

  async function fetchDepartmentsFromAPI() {
    const apiUrl =
        "https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=departamentos";

    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error("Erro ao buscar departamentos da API.");
    }

    const data = await response.json();

    // Processa os departamentos e garante que cada um tenha uma cor
    const fetchedDepartments = Object.entries(data).map(([nome, codigo]) => ({
        nome,
        codigo: String(codigo),
        color: getDepartmentColorFromStorage(nome), // Garante que a cor seja consistente
    }));

    return fetchedDepartments;
}


  async function resgatar_tecnicos() {
    const apiUrl =
        "https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=clientes_v2";

    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();

    // Filtra os técnicos e utiliza `omie` como identificador
    return Object.entries(data)
        .filter(([_, value]) => value.tags && value.tags.some(tagObj => tagObj.tag === "TÉCNICO"))
        .map(([_, value]) => ({
            omie: value.omie, // Substitui `id` por `omie`
            nome: value.nome,
        }));
}


  function generateCalendar(year, month) {
    const region = document.getElementById("region-select").value;
    monthNameElement.textContent = `${monthNames[month]} ${year} - Região: ${region.charAt(0).toUpperCase() + region.slice(1)}`;
  
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    let daysHTML = `<th class="left-header">Técnicos</th>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = weekdays[new Date(year, month, day).getDay()];
      daysHTML += `<th>${weekday}<br>${String(day).padStart(2, "0")}</th>`;
    }
    daysHTML += `<th>Ações</th>`;
    daysRow.innerHTML = daysHTML;
  }
  
  function addTechnicianRow(technician, agenda = []) {
    const totalDays = daysRow.children.length - 2;
    const newRow = document.createElement("tr");

    // Coluna de técnico
    const tecnicoCell = document.createElement("td");
    tecnicoCell.className = "left-header";

    const tecnicoSelect = document.createElement("select");
    tecnicoSelect.innerHTML = `
        <option value="">Selecione</option>
        ${technicianOptions.map((tech) => `
            <option value="${tech.omie}" ${tech.omie == technician.omie ? "selected" : ""}>
                ${tech.nome}
            </option>`).join("")}
    `;

    tecnicoSelect.addEventListener("change", () => {
        const selectedOmie = tecnicoSelect.value;

        // Atualiza o técnico na lista de técnicos
        let existingTechnician = technicians.find((t) => t.omie == selectedOmie);

        if (!existingTechnician) {
            existingTechnician = {
                omie: selectedOmie,
                nome: tecnicoSelect.options[tecnicoSelect.selectedIndex]?.textContent.trim() || "Desconhecido",
                agendas: {},
            };
            technicians.push(existingTechnician);
        }

        saveTechniciansToLocalStorage();
    });

    tecnicoCell.appendChild(tecnicoSelect);
    newRow.appendChild(tecnicoCell);

    // Colunas de dias
    for (let i = 0; i < totalDays; i++) {
        const dayCell = document.createElement("td");
        const daySelect = document.createElement("select");

        daySelect.innerHTML = `
            <option value="">Selecione</option>
            ${departments.map((dept) => `
                <option value="${dept.codigo}" ${agenda[i] == dept.codigo ? "selected" : ""}>
                    ${dept.nome}
                </option>`).join("")}
        `;

        daySelect.addEventListener("change", () => {
            const selectedDept = departments.find((d) => d.codigo === daySelect.value);
            dayCell.style.backgroundColor = selectedDept ? selectedDept.color : "";
            saveTechniciansToLocalStorage();
        });

        // Define a cor de fundo inicial, se já houver valor selecionado
        const selectedDept = departments.find((d) => d.codigo === agenda[i]);
        if (selectedDept) {
            dayCell.style.backgroundColor = selectedDept.color;
        }

        dayCell.appendChild(daySelect);
        newRow.appendChild(dayCell);
    }

    // Coluna de ações
    const actionCell = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = '<img src="imagens/remover.png" alt="Remover Técnico" title="Remover Técnico">';

    removeBtn.addEventListener("click", () => {
        techniciansBody.removeChild(newRow);
        technicians = technicians.filter((t) => t.omie !== technician.omie);
        saveTechniciansToLocalStorage();
    });

    actionCell.appendChild(removeBtn);
    newRow.appendChild(actionCell);

    techniciansBody.appendChild(newRow);
}


function saveTechniciansToLocalStorage() {
  const key = getAgendaKey(); // Obtém a chave do mês/ano/região atual
  if (!key) {
      console.error("Chave inválida ao salvar a agenda!");
      return;
  }

  // Atualiza as agendas dos técnicos
  Array.from(techniciansBody.children).forEach((row) => {
      const tecnicoSelect = row.querySelector("td select:first-child"); // Primeiro select é o técnico
      if (!tecnicoSelect) {
          console.warn("Linha sem select de técnico encontrada. Ignorando...");
          return; // Ignora linhas sem select de técnico
      }

      const technicianOmie = tecnicoSelect.value; // Agora usa `omie` como identificador
      if (!technicianOmie) {
          console.warn("Nenhum técnico selecionado para esta linha. Ignorando...");
          return; // Ignora linhas onde o técnico não está selecionado
      }

      // Busca ou cria o técnico
      let technician = technicians.find((t) => t.omie === technicianOmie);
      if (!technician) {
          technician = {
              omie: technicianOmie,
              nome: tecnicoSelect.options[tecnicoSelect.selectedIndex]?.textContent.trim() || "Desconhecido",
              agendas: {},
          };
          technicians.push(technician);
      }

      // Captura os departamentos selecionados para os dias do mês atual
      const selectedDepartments = Array.from(row.querySelectorAll("td"))
          .slice(1) // Ignora a primeira célula (coluna do técnico)
          .map((cell) => {
              const select = cell.querySelector("select"); // Busca o <select> dentro da célula
              return select?.value || ""; // Retorna o valor do <select>, ou vazio se não existir
          });

      // Atualiza a agenda do técnico para a chave atual
      technician.agendas[key] = selectedDepartments;
  });

  // Salva os técnicos atualizados no localStorage
  localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(technicians));
  console.log("Agenda salva no localStorage:", technicians);
}


function loadTechniciansFromLocalStorage() {
  const storedData = localStorage.getItem("dados_agenda_tecnicos");
  if (storedData) {
      technicians = JSON.parse(storedData);
      console.log("Técnicos carregados do localStorage:", technicians);
      loadAgendaForCurrentMonth(); // Preenche a tabela com base na agenda do mês atual
  } else {
      technicians = [];
      console.log("Nenhum técnico salvo no localStorage.");
      techniciansBody.innerHTML = "<tr><td colspan='32'>Nenhum técnico encontrado.</td></tr>";
  }
}

function loadAgendaForCurrentMonth() {
  const key = getAgendaKey(); // Obtém a chave atual (mês/ano/região)
  if (!key) {
      console.error("Chave inválida ao carregar a agenda!");
      return;
  }

  techniciansBody.innerHTML = ""; // Limpa a tabela

  // Preenche os técnicos e suas agendas do mês atual
  technicians.forEach((technician) => {
      if (technician.agendas && technician.agendas[key]) {
          addTechnicianRow(technician, technician.agendas[key]);
      }
  });
}


function getAgendaKey() {
  const region = document.getElementById("region-select").value;
  const month = monthSelect.value;
  const year = yearSelect.value;

  if (!region || month === undefined || !year) {
      console.error("Chave inválida gerada:", { region, month, year });
      return null;
  }

  return `${year}_${month}_${region}`;
}

function addNewRow() {
  const technician = { id: "", nome: "Selecione", agendas: {} };
  addTechnicianRow(technician); // Apenas adiciona a linha, sem salvar imediatamente
}


function saveCurrentSettings() {
  const currentSettings = {
      month: monthSelect.value,
      year: yearSelect.value,
      region: document.getElementById("region-select").value,
  };
  localStorage.setItem("current_settings", JSON.stringify(currentSettings));
}

function loadCurrentSettings() {
  const savedSettings = localStorage.getItem("current_settings");
  if (savedSettings) {
      const { month, year, region } = JSON.parse(savedSettings);

      monthSelect.value = month || new Date().getMonth();
      yearSelect.value = year || new Date().getFullYear();
      document.getElementById("region-select").value = region || "norte";
  } else {
      // Caso não existam configurações salvas, usa os valores padrão
      monthSelect.value = new Date().getMonth();
      yearSelect.value = new Date().getFullYear();
      document.getElementById("region-select").value = "norte";
  }
}

function debugKeys() {
  const savedData = localStorage.getItem("dados_agenda_tecnicos");
  if (savedData) {
      const agendas = JSON.parse(savedData);
      console.log("Chaves salvas no localStorage:", Object.keys(agendas));
      console.log("Chave atual gerada:", getAgendaKey());
  } else {
      console.log("Nenhuma chave salva no localStorage.");
  }
}

});

function getDepartmentColorFromStorage(departmentName) {
  const storedDepartments = JSON.parse(localStorage.getItem("departments")) || [];
  const storedDepartment = storedDepartments.find((dept) => dept.nome === departmentName);

  // Retorna a cor salva ou gera uma nova
  if (storedDepartment && storedDepartment.color) {
      return storedDepartment.color;
  }
  return getRandomColor();
}



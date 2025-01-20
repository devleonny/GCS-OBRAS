document.addEventListener("DOMContentLoaded", () => {
    const daysRow = document.getElementById("days-row");
    const techniciansBody = document.getElementById("technicians-body");
    const monthNameElement = document.getElementById("month-name");
    const monthSelect = document.getElementById("month-select");
    const yearSelect = document.getElementById("year-select");
    const addLineBtn = document.getElementById("add-line-btn"); // Alterado para "Adicionar Linha"

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  let technicians = [];
  let departments = [];

  monthNames.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  const today = new Date();
  monthSelect.value = today.getMonth();
  yearSelect.value = today.getFullYear();
  generateCalendar(today.getFullYear(), today.getMonth());

  // Buscar departamentos da API e salvar no localStorage
  fetchDepartmentsFromAPI().then(() => {
    loadTechniciansFromLocalStorage();
  });

  monthSelect.addEventListener("change", () => updateAgenda());
  yearSelect.addEventListener("input", () => updateAgenda());
  document.getElementById("region-select").addEventListener("change", () => updateAgenda());

  function updateAgenda() {
    const selectedMonth = parseInt(monthSelect.value, 10);
    const selectedYear = parseInt(yearSelect.value, 10);
    generateCalendar(selectedYear, selectedMonth);
    loadAgendaForCurrentMonth();
  }

  function fetchDepartmentsFromAPI() {
    const apiUrl =
      "https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=departamentos";

    return fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Erro ao buscar departamentos da API.");
        }
        return response.json();
      })
      .then((data) => {
        if (typeof data === "object" && data !== null) {
          departments = Object.entries(data).map(([nome, codigo]) => ({
            nome,
            codigo: String(codigo),
          }));

          localStorage.setItem("dados_departamentos", JSON.stringify(departments));
          console.log("Departamentos atualizados da API:", departments);
        } else {
          console.warn("Estrutura inesperada no retorno da API:", data);
          departments = [];
        }
      })
      .catch((error) => {
        console.error("Erro ao buscar departamentos da API:", error);
      });
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

  function addTechnicianRow(technician) {
    const key = getAgendaKey();
    const daysInMonth = daysRow.children.length - 2;
    const agenda = technician.agendas[key] || Array(daysInMonth).fill("");

    let rowHTML = `<td class="left-header">${technician.name}</td>`;
    agenda.forEach((value, i) => {
      rowHTML += `
        <td>
          <select data-index="${i}" data-id="${technician.id}">
            <option value="" ${value === "" ? "selected" : ""}>Selecione</option>
            ${departments
              .map((dept) => {
                const isSelected = String(value) === String(dept.codigo) ? "selected" : "";
                return `<option value="${dept.codigo}" ${isSelected}>${dept.nome}</option>`;
              })
              .join("")}
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

    newRow.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", (event) => {
        const index = parseInt(event.target.getAttribute("data-index"), 10);
        const id = event.target.getAttribute("data-id");
        const tech = technicians.find((t) => t.id === id);
        if (tech) tech.agendas[key][index] = event.target.value;
        saveTechniciansToLocalStorage();
      });
    });

    const removeBtn = newRow.querySelector(".remove-btn");
    removeBtn.addEventListener("click", () => {
      techniciansBody.removeChild(newRow);
      technicians = technicians.filter((tech) => tech.id !== technician.id);
      saveTechniciansToLocalStorage();
    });
  }

  function saveTechniciansToLocalStorage() {
    localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(technicians));
  }

  function loadTechniciansFromLocalStorage() {
    const savedData = localStorage.getItem("dados_agenda_tecnicos");
    technicians = savedData ? JSON.parse(savedData) : [];
    updateAgenda();
  }

  function loadAgendaForCurrentMonth() {
    const key = getAgendaKey();
    techniciansBody.innerHTML = "";
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
    return `${year}_${month}_${region}`;
  }

  
});
async function resgatar_tecnicos() {
  
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=clientes_v2');
    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }
    
    const data = await response.json();
    // Filtrar apenas os itens que possuem a tag "TÉCNICO" em tags
    const tecnicoItems = Object.entries(data).filter(([key, value]) =>
      value.tags && value.tags.some(tagObj => tagObj.tag === "TÉCNICO")
    );

    // Exibir os itens filtrados no console
    console.log('Itens com a tag "TÉCNICO":', Object.fromEntries(tecnicoItems));
  } catch (error) {
    console.error('Erro ao buscar ou processar os dados:', error);
  }

}

// Chama a função para buscar e exibir os dados
resgatar_tecnicos();


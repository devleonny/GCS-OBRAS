document.addEventListener("DOMContentLoaded", () => {
    const daysRow = document.getElementById("days-row");
    const techniciansBody = document.getElementById("technicians-body");
    const monthNameElement = document.getElementById("month-name");
    const monthSelect = document.getElementById("month-select");
    const yearSelect = document.getElementById("year-select");
    const regionSelect = document.getElementById("region-select"); // Corrigido aqui
    const syncDataBtn = document.getElementById("sync-data-btn");
    const addLineBtn = document.getElementById("add-line-btn");
    // Função para gerar uma cor aleatória
    function getRandomColor() {
        return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
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
    saveCurrentSettings(); // Salva a configuração atual
    generateCalendar(yearSelect.value, monthSelect.value);
    loadTechniciansFromLocalStorage(); // Preenche a tabela com base no localStorage
    // Eventos para salvar configurações e recarregar a tabela ao alterar mês, ano ou região
    monthSelect.addEventListener("change", () => {
        generateCalendar(yearSelect.value, monthSelect.value);
        loadTechniciansFromLocalStorage();
    });

    yearSelect.addEventListener("input", () => {
        generateCalendar(yearSelect.value, monthSelect.value);
        loadTechniciansFromLocalStorage();
    });

    regionSelect.addEventListener("change", () => {
        generateCalendar(yearSelect.value, monthSelect.value); // Atualiza o calendário
        loadTechniciansFromLocalStorage(); // Recarrega os técnicos com base na nova região
    });
    

    syncDataBtn.addEventListener("click", async () => {
        showLoading(); // Exibe o indicador de carregamento
        saveCurrentSettings(); // Salva as configurações antes de sincronizar
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

            // Atualizar a lista global de técnicos
            technicians = fetchedTechnicians.map(tech => ({
                omie: tech.omie,
                nome: tech.nome,
                agendas: {}, // Inicializa uma agenda vazia para cada técnico
            }));

            // Recria o calendário e limpa o corpo da tabela
            generateCalendar(yearSelect.value, monthSelect.value); // Gera os dias do mês
            techniciansBody.innerHTML = ""; // Limpa as linhas existentes

            // Preenche a tabela com os técnicos sincronizados
            technicians.forEach(tech => addTechnicianRow(tech));

            // Exibe o popup de sucesso
            showPopup("Dados sincronizados com sucesso!");
        } catch (error) {
            console.error("Erro ao sincronizar os dados:", error);
            showPopup("Erro ao sincronizar os dados. Verifique sua conexão e tente novamente.");
        } finally {
            hideLoading(); // Oculta o indicador de carregamento
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
        const regionSelect = document.getElementById("region-select");
        const region = regionSelect.value.charAt(0).toUpperCase() + regionSelect.value.slice(1); // Região selecionada
        monthNameElement.textContent = `${monthNames[month]} ${year} - Região: ${region}`;

        // Corrigir cálculo dos dias no mês
        let daysInMonth = new Date(year, month + 1, 0).getDate(); // Último dia do mês

        if (month == 1 && year % 4 == 0) {

            daysInMonth = 29

        } else if (month == 1) {

            daysInMonth = 28

        }

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

        // Cria uma nova linha no corpo da tabela
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
        tecnicoCell.appendChild(tecnicoSelect);
        newRow.appendChild(tecnicoCell);

        // Evento ao selecionar um técnico
        tecnicoSelect.addEventListener("change", () => {
            const technicianOmie = tecnicoSelect.value;
            if (!technicianOmie) return; // Não faz nada se nenhum técnico for selecionado

            const currentKey = getAgendaKey(); // Obtém a chave do mês/ano atual
            if (!currentKey) return;

            // Verifica se o técnico já está alocado para o mês/ano atual
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
            const isTechnicianAssigned = Object.values(storedData).some(tech =>
                tech.omie === technicianOmie && tech.agendas[currentKey]
            );

            if (isTechnicianAssigned) {
                showPopup("Este técnico já possui uma agenda para este mês e ano. Por favor, selecione outro.");
                tecnicoSelect.value = ""; // Reseta a seleção
                return;
            }

            const selectedRegion = document.getElementById("region-select").value; // Obtém a região atual

            // Atualiza o técnico existente ou adiciona um novo
            if (!storedData[technicianOmie]) {
                storedData[technicianOmie] = {
                    omie: technicianOmie,
                    nome: tecnicoSelect.options[tecnicoSelect.selectedIndex]?.textContent.trim() || "Desconhecido",
                    regiao_atual: selectedRegion, // Define a região atual
                    agendas: {}
                };
            }

            // Atualiza ou cria a agenda do técnico para o mês/ano atual
            storedData[technicianOmie].agendas[currentKey] = storedData[technicianOmie].agendas[currentKey] || [];

            // Atualiza a região atual no objeto técnico
            storedData[technicianOmie].regiao_atual = selectedRegion;

            // Salva os dados atualizados no localStorage
            localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
        });

        // Colunas de dias
        for (let i = 0; i < totalDays; i++) {
            const dayCell = document.createElement("td");
            const daySelect = document.createElement("select");
            daySelect.className = "department-select";

            // Preenche os departamentos no dropdown
            daySelect.innerHTML = `
            <option value="" data-title="Selecione">Selecione</option>
            ${departments.map(dept => `
                <option value="${dept.codigo}" data-title="${dept.nome}" ${agenda[i] == dept.codigo ? "selected" : ""}>
                    ${dept.nome}
                </option>`).join("")}
        `;

            // Define a cor inicial do <td> com base no departamento selecionado
            dayCell.style.backgroundColor = getDepartmentColorByCode(daySelect.value);

            // Evento ao alterar o departamento
            daySelect.addEventListener("change", () => {
                const selectedDepartments = Array.from(newRow.querySelectorAll("td select"))
                    .slice(1) // Ignora a primeira célula (coluna do técnico)
                    .map(cell => cell.value || "");
            
                const technicianOmie = tecnicoSelect.value;
                if (!technicianOmie) return; // Não faz nada se nenhum técnico for selecionado
            
                const currentKey = getAgendaKey(); // Obtém a chave do mês/ano atual
                if (!currentKey) {
                    console.error("Chave inválida ao salvar agenda ao trocar departamento!");
                    return;
                }
            
                // Carrega os dados do localStorage
                const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
            
                // Verifica se o técnico existe no localStorage
                if (!storedData[technicianOmie]) {
                    console.error(`Técnico ${technicianOmie} não encontrado no localStorage!`);
                    return;
                }
            
                // Atualiza a agenda do técnico para o mês/ano atual
                storedData[technicianOmie].agendas[currentKey] = selectedDepartments;
            
                // Salva os dados atualizados no localStorage
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
            
                // Atualiza a cor da célula com base no departamento selecionado
                dayCell.style.backgroundColor = getDepartmentColorByCode(daySelect.value);
            });
            

            dayCell.appendChild(daySelect);
            newRow.appendChild(dayCell);
        }

        // Coluna de ações
        const actionsCell = document.createElement("td");
        actionsCell.className = "actions";

        // Botão de editar região (com imagem)
        const editButton = document.createElement("button");
        editButton.className = "edit-btn";
        const editImage = document.createElement("img");
        editImage.src = "imagens/editar.png";
        editImage.alt = "Editar Região";
        editButton.appendChild(editImage);
        editButton.addEventListener("click", () => openEditModal(technician));
        actionsCell.appendChild(editButton);

        // Botão de remover (com imagem)
        const removeButton = document.createElement("button");
        removeButton.className = "remove-btn";
        const removeImage = document.createElement("img");
        removeImage.src = "imagens/remover.png";
        removeImage.alt = "Remover";
        removeButton.appendChild(removeImage);
        removeButton.addEventListener("click", () => {
            const technicianOmie = technician.omie;
            const currentKey = getAgendaKey(); // Obtém a chave do mês/ano atual
        
            if (!technicianOmie || !currentKey) {
                console.error("Erro ao remover: técnico ou chave inválida!");
                return;
            }
        
            // Carrega os dados do localStorage
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
        
            // Verifica se o técnico existe no localStorage
            if (storedData[technicianOmie]) {
                // Remove apenas a agenda do mês/ano atual
                delete storedData[technicianOmie].agendas[currentKey];
        
                // Se o técnico não tiver mais agendas, mantemos o registro dele no localStorage
                if (Object.keys(storedData[technicianOmie].agendas).length === 0) {
                    console.log(`Técnico ${technicianOmie} ainda possui o registro, mas sem agendas.`);
                }
        
                // Salva os dados atualizados no localStorage
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
            }
        
            // Remove a linha da tabela
            newRow.remove();
        });        

        actionsCell.appendChild(removeButton);

        newRow.appendChild(actionsCell);

        techniciansBody.appendChild(newRow);
    }

    function getDepartmentColorByCode(departmentCode) {
        const department = departments.find((dept) => dept.codigo === departmentCode);
        return department ? department.color : "#ffffff"; // Retorna a cor ou branco, se não encontrado
    }

    function saveTechniciansToLocalStorage() {
        const key = getAgendaKey(); // Obtém a chave do mês/ano atual
        if (!key) {
            console.error("Chave inválida ao salvar a agenda!");
            return;
        }

        const techniciansObj = {}; // Objeto para armazenar técnicos
        const selectedRegion = regionSelect.value; // Obtém a região atual selecionada

        Array.from(techniciansBody.children).forEach((row) => {
            const tecnicoSelect = row.querySelector("td select:first-child");
            if (!tecnicoSelect) return;

            const technicianOmie = tecnicoSelect.value;
            if (!technicianOmie) return;

            let technician = technicians.find(t => t.omie === technicianOmie);
            if (!technician) {
                technician = {
                    omie: technicianOmie,
                    nome: tecnicoSelect.options[tecnicoSelect.selectedIndex]?.textContent.trim() || "Desconhecido",
                    agendas: {}
                };
                technicians.push(technician);
            }

            const selectedDepartments = Array.from(row.querySelectorAll("td select"))
                .slice(1)
                .map(cell => cell.value || "");

            technician.agendas[key] = selectedDepartments;
            technician.regiao_atual = selectedRegion;
            techniciansObj[technicianOmie] = technician;
        });

        localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(techniciansObj));
    }

    function loadTechniciansFromLocalStorage() {
        const storedData = localStorage.getItem("dados_agenda_tecnicos");
        const selectedRegion = regionSelect.value; // Obtém a região selecionada no dropdown
    
        if (storedData) {
            // Converte o objeto de volta para uma lista
            const techniciansObj = JSON.parse(storedData);
    
            // Filtrar técnicos com base na região selecionada
            if (selectedRegion === "todas") {
                // Exibe todos os técnicos, independentemente da região
                technicians = Object.values(techniciansObj);
            } else {
                // Filtra apenas os técnicos da região selecionada
                technicians = Object.values(techniciansObj).filter(
                    tech => tech.regiao_atual === selectedRegion
                );
            }
    
            console.log(
                `Técnicos carregados para a região "${selectedRegion}":`,
                technicians
            );
    
            loadAgendaForCurrentMonth(); // Preenche a tabela com base na agenda do mês atual
        } else {
            technicians = [];
            console.log("Nenhum técnico salvo no localStorage.");
        }
    
        // Se não houver técnicos ou agendas, exibe o aviso
        if (!technicians.length) {
            const totalColumns = daysRow.children.length || 2; // Inclui dias e ações
            techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${totalColumns}">Nenhum técnico disponível para esta região. Adicione um técnico.</td></tr>`;
        }
    }
    


    function loadAgendaForCurrentMonth() {
        const key = getAgendaKey(); // Obtém a chave atual (mês/ano)
        if (!key) {
            console.error("Chave inválida ao carregar a agenda!");
            return;
        }

        techniciansBody.innerHTML = ""; // Limpa a tabela

        // Preenche os técnicos e suas agendas do mês atual
        let hasData = false; // Verifica se há dados
        technicians.forEach((technician) => {
            if (technician.agendas && technician.agendas[key]) {
                hasData = true;
                addTechnicianRow(technician, technician.agendas[key]);
            }
        });

        // Exibe o aviso se não houver dados
        if (!hasData) {
            const totalColumns = daysRow.children.length || 2; // Inclui dias e ações
            techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${totalColumns}">Nenhum dado disponível. Adicione um técnico.</td></tr>`;
        }
    }

    function getAgendaKey() {
        const month = monthSelect.value;
        const year = yearSelect.value;

        if (month === undefined || !year) {
            console.error("Chave inválida gerada:", { month, year });
            return null;
        }

        return `${year}_${month}`;
    }

    function addNewRow() {
        // Remove o aviso, se existir
        const noDataRow = document.getElementById("no-data-row");
        if (noDataRow) {
            noDataRow.remove();
        }

        // Cria um novo objeto técnico vazio para a nova linha
        const newTechnician = { id: "", nome: "Selecione", agendas: {} };

        // Adiciona a nova linha com um técnico vazio
        addTechnicianRow(newTechnician); // Adiciona a linha, sem salvar imediatamente
    }



    function saveCurrentSettings() {
        const currentSettings = {
            month: monthSelect.value,
            year: yearSelect.value,
            region: document.getElementById("region-select").value,
        };
        localStorage.setItem("current_settings", JSON.stringify(currentSettings));
        console.log("Configurações salvas no localStorage:", currentSettings);
    }

    function loadCurrentSettings() {
        const defaultMonth = new Date().getMonth();
        const defaultYear = new Date().getFullYear();
        const defaultRegion = "nordeste";

        const savedSettings = localStorage.getItem("current_settings");
        if (savedSettings) {
            const { month, year, region } = JSON.parse(savedSettings);
            monthSelect.value = month !== undefined ? month : defaultMonth;
            yearSelect.value = year || defaultYear;
            document.getElementById("region-select").value = region || defaultRegion;
        } else {
            monthSelect.value = defaultMonth;
            yearSelect.value = defaultYear;
            document.getElementById("region-select").value = defaultRegion;
        }

        generateCalendar(yearSelect.value, monthSelect.value);
    }

    function showPopup(message) {
        const modal = document.getElementById("popup-modal");
        const modalMessage = document.getElementById("modal-message");
        const closeButton = document.getElementById("close-button");
        const closeModalBtn = document.getElementById("close-modal-btn");

        modalMessage.textContent = message; // Define a mensagem
        modal.style.display = "block"; // Exibe o modal

        // Fecha o modal ao clicar no botão "Fechar"
        const closeModal = () => {
            modal.style.display = "none";
        };

        closeButton.addEventListener("click", closeModal, { once: true });
        closeModalBtn.addEventListener("click", closeModal, { once: true });

        // Fecha o modal ao clicar fora dele
        window.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeModal();
            }
        }, { once: true });
    }

    function getDepartmentColorFromStorage(departmentName) {
        const storedDepartments = JSON.parse(localStorage.getItem("departments")) || [];
        const storedDepartment = storedDepartments.find((dept) => dept.nome === departmentName);

        // Retorna a cor salva ou gera uma nova
        if (storedDepartment && storedDepartment.color) {
            return storedDepartment.color;
        }
        return getRandomColor();
    }

    function openEditModal(technician) {
        const modal = document.getElementById("edit-modal");
        const regionSelect = document.getElementById("edit-region-select");
        const confirmBtn = document.getElementById("edit-confirm-btn");
        const cancelBtn = document.getElementById("edit-cancel-btn");

        // Preencher o select com as regiões
        regionSelect.innerHTML = `
        <option value="norte">Norte</option>
        <option value="nordeste">Nordeste</option>
        <option value="centro-oeste">Centro-Oeste</option>
        <option value="sudeste">Sudeste</option>
        <option value="sul">Sul</option>
    `;

        // Selecionar a região atual do técnico
        regionSelect.value = technician.regiao_atual;

        // Exibir o modal
        modal.style.display = "block";

        // Evento para confirmar a alteração
        const confirmHandler = () => {
            const newRegion = regionSelect.value;

            // Recuperar os dados salvos no localStorage
            const storedData = localStorage.getItem("dados_agenda_tecnicos");
            if (storedData) {
                const techniciansData = JSON.parse(storedData);

                // Atualizar o valor de regiao_atual para o técnico no objeto armazenado
                if (techniciansData[technician.omie]) {
                    techniciansData[technician.omie].regiao_atual = newRegion;
                }

                // Salvar as alterações de volta no localStorage
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(techniciansData));

                // Recarregar a lista de técnicos com base na nova região
                loadTechniciansFromLocalStorage();
            }

            modal.style.display = "none"; // Fecha o modal

            // Remove os eventos para evitar duplicação
            confirmBtn.removeEventListener("click", confirmHandler);
            cancelBtn.removeEventListener("click", cancelHandler);
        };

        // Evento para cancelar a alteração
        const cancelHandler = () => {
            modal.style.display = "none"; // Fecha o modal

            // Remove os eventos para evitar duplicação
            confirmBtn.removeEventListener("click", confirmHandler);
            cancelBtn.removeEventListener("click", cancelHandler);
        };

        confirmBtn.addEventListener("click", confirmHandler);
        cancelBtn.addEventListener("click", cancelHandler);
    }

});  

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
    loadTechniciansFromStorage();

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

        console.log("Dados carregados do localStorage:", { departments });
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
        const newRow = document.createElement("tr");

        // Coluna de técnico
        const tecnicoCell = document.createElement("td");
        tecnicoCell.className = "left-header";

        const tecnicoInput = document.createElement("input");
        tecnicoInput.type = "text";
        tecnicoInput.placeholder = "Selecione um técnico";
        tecnicoInput.className = "dropdown-input";
        tecnicoInput.value = technician.nome || ""; // Preenche o nome do técnico
        tecnicoInput.dataset.omie = technician.omie || ""; // Salva o omie no dataset

        const tecnicoDropdown = document.createElement("div");
        tecnicoDropdown.className = "dropdown-options";

        // Preencher dropdown com técnicos
        technicianOptions.forEach((tech) => {
            const option = document.createElement("div");
            option.className = "dropdown-option";
            option.textContent = tech.nome;
            option.dataset.omie = tech.omie;
            option.addEventListener("click", () => {
                tecnicoInput.value = tech.nome;
                tecnicoInput.dataset.omie = tech.omie; // Salva o omie no input
                tecnicoDropdown.style.display = "none"; // Fecha o dropdown
                saveTechniciansToLocalStorage(); // Salva alterações automaticamente
            });
            tecnicoDropdown.appendChild(option);
        });

        tecnicoInput.addEventListener("focus", () => {
            tecnicoDropdown.style.display = "block"; // Exibe o dropdown
            positionDropdown(tecnicoInput, tecnicoDropdown); // Posiciona o dropdown dinamicamente
        });

        tecnicoInput.addEventListener("input", () => {
            const searchTerm = tecnicoInput.value.toLowerCase();
            Array.from(tecnicoDropdown.children).forEach((option) => {
                option.style.display = option.textContent.toLowerCase().includes(searchTerm)
                    ? "block"
                    : "none";
            });
        });

        tecnicoInput.addEventListener("blur", () => {
            setTimeout(() => {
                const validTechnician = technicianOptions.find(
                    (tech) => tech.nome.trim().toLowerCase() === tecnicoInput.value.trim().toLowerCase()
                );

                if (!validTechnician) {
                    tecnicoInput.value = "";
                    tecnicoInput.dataset.omie = "";
                    showPopup("Por favor, selecione um técnico válido.");
                } else {
                    tecnicoInput.dataset.omie = validTechnician.omie;

                    // Salvar no localStorage
                    saveTechniciansToLocalStorage();
                }

                tecnicoDropdown.style.display = "none"; // Fecha o dropdown
            }, 200); // Pequeno atraso para permitir a seleção do dropdown
        });

        tecnicoCell.appendChild(tecnicoInput);
        tecnicoCell.appendChild(tecnicoDropdown);
        newRow.appendChild(tecnicoCell);

        // Colunas de dias
        // Colunas de dias
        // Colunas de dias
        for (let i = 0; i < totalDays; i++) {
            const dayCell = document.createElement("td"); // Define o fundo na célula
            const dayInput = document.createElement("input");
            dayInput.type = "text";
            dayInput.placeholder = "Selecione";
            dayInput.className = "dropdown-input";
            dayInput.style.backgroundColor = "transparent"; // Fundo do input transparente

            // Carregar o valor e a cor do departamento
            const deptCode = agenda[i] || ""; // Código do departamento salvo
            const dept = departments.find((d) => d.codigo === deptCode);
            if (dept) {
                dayInput.value = dept.nome; // Nome do departamento
                dayCell.style.backgroundColor = dept.color; // Define a cor de fundo no TD
                adjustTextColor(dayCell, dept.color); // Ajusta a cor do texto no TD
            }            

            dayInput.dataset.codigo = deptCode; // Salvar o código no dataset

            // Dropdown de opções
            const dayDropdown = document.createElement("div");
            dayDropdown.className = "dropdown-options";
            departments.forEach((dept) => {
                const option = document.createElement("div");
                option.className = "dropdown-option";
                option.textContent = dept.nome;
                option.dataset.codigo = dept.codigo;
                option.addEventListener("click", () => {
                    dayInput.value = dept.nome;
                    dayInput.dataset.codigo = dept.codigo;
                    dayDropdown.style.display = "none";
                    dayCell.style.backgroundColor = dept.color; // Atualiza a cor no TD
                    adjustTextColor(dayCell, dept.color); // Ajusta a cor do texto no TD
                    saveTechniciansToLocalStorage(); // Salva alterações automaticamente
                });
                dayDropdown.appendChild(option);
            });

            dayInput.addEventListener("focus", () => {
                dayDropdown.style.display = "block";
                positionDropdown(dayInput, dayDropdown);
            });

            dayInput.addEventListener("blur", () => {
                setTimeout(() => {
                    const validDepartment = departments.find(
                        (dept) => dept.nome.trim().toLowerCase() === dayInput.value.trim().toLowerCase()
                    );

                    if (!validDepartment) {
                        dayInput.value = "";
                        dayInput.dataset.codigo = "";
                        showPopup("Por favor, selecione um departamento válido.");
                        dayCell.style.backgroundColor = ""; // Remove a cor do fundo no TD
                        dayCell.style.color = ""; // Reseta a cor do texto
                    } else {
                        dayInput.dataset.codigo = validDepartment.codigo;
                        dayCell.style.backgroundColor = validDepartment.color;
                        adjustTextColor(dayCell, validDepartment.color); // Ajusta a cor do texto no TD
                        saveTechniciansToLocalStorage();
                    }

                    dayDropdown.style.display = "none"; // Fecha o dropdown
                }, 200); // Pequeno atraso para permitir a seleção do dropdown
            });

            dayCell.appendChild(dayInput);
            dayCell.appendChild(dayDropdown);
            newRow.appendChild(dayCell);
        }

        // Coluna de ações
        const actionsCell = document.createElement("td");
        actionsCell.className = "actions";

        const editButton = document.createElement("button");
        editButton.className = "edit-btn";
        const editImage = document.createElement("img");
        editImage.src = "imagens/editar.png";
        editImage.alt = "Alterar Região";
        editButton.appendChild(editImage);
        editButton.addEventListener("click", () => openEditModal(technician));
        actionsCell.appendChild(editButton);

        const removeButton = document.createElement("button");
        removeButton.className = "remove-btn";
        const removeImage = document.createElement("img");
        removeImage.src = "imagens/excluir.png";
        removeImage.alt = "Excluir Técnico";
        removeButton.appendChild(removeImage);
        removeButton.addEventListener("click", () => {
            newRow.remove();
            saveTechniciansToLocalStorage(); // Atualiza o localStorage após exclusão
        });

        actionsCell.appendChild(removeButton);
        newRow.appendChild(actionsCell);

        techniciansBody.appendChild(newRow);
    }



    function positionDropdown(input, dropdown) {
        const rect = input.getBoundingClientRect();
        dropdown.style.position = "absolute";
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        dropdown.style.zIndex = "10000"; // Mantém o dropdown acima de outros elementos

        document.body.appendChild(dropdown); // Move o dropdown para o body
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
            const tecnicoInput = row.querySelector("td input.dropdown-input");
            if (!tecnicoInput || !tecnicoInput.dataset.omie) return;

            const technicianOmie = tecnicoInput.dataset.omie;

            let technician = technicians.find((t) => t.omie === technicianOmie);
            if (!technician) {
                technician = {
                    omie: technicianOmie,
                    nome: tecnicoInput.value.trim(),
                    agendas: {},
                };
                technicians.push(technician);
            }

            const selectedDepartments = Array.from(
                row.querySelectorAll("td input.dropdown-input")
            )
                .slice(1)
                .map((cell) => cell.dataset.codigo || "");

            technician.agendas[key] = selectedDepartments;
            technician.regiao_atual = selectedRegion; // Salva a região atual
            techniciansObj[technicianOmie] = technician;
        });

        localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(techniciansObj));
        console.log("Dados salvos no localStorage:", techniciansObj);
    }

    function loadTechniciansFromLocalStorage() {
        const storedData = localStorage.getItem("dados_agenda_tecnicos");
        const currentKey = getAgendaKey(); // Chave do mês/ano atual
        const selectedRegion = regionSelect.value; // Região selecionada

        if (storedData) {
            const techniciansObj = JSON.parse(storedData);

            // Filtrar técnicos com base na região e na agenda
            technicians = Object.values(techniciansObj).filter((tech) => {
                const isRegionMatching =
                    selectedRegion === "todas" || tech.regiao_atual === selectedRegion;
                return tech.agendas[currentKey] && isRegionMatching;
            });

            techniciansBody.innerHTML = ""; // Limpa a tabela

            if (technicians.length > 0) {
                technicians.forEach((technician) => {
                    const agenda = technician.agendas[currentKey] || [];
                    addTechnicianRow(technician, agenda);
                });
            } else {
                techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${daysRow.children.length || 2
                    }">Nenhum técnico disponível para esta região.</td></tr>`;
            }
        } else {
            techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${daysRow.children.length || 2
                }">Nenhum técnico disponível para esta região.</td></tr>`;
        }
    }

    function loadTechniciansFromStorage() {
        const storedTechnicians = localStorage.getItem("technicians");
        if (storedTechnicians) {
            try {
                technicianOptions = JSON.parse(storedTechnicians);
                console.log("Técnicos carregados do localStorage:", technicianOptions);
            } catch (error) {
                console.error("Erro ao carregar técnicos do localStorage:", error);
                technicianOptions = []; // Garante que a lista esteja vazia em caso de erro
            }
        } else {
            console.warn("Nenhum técnico encontrado no localStorage.");
            technicianOptions = []; // Lista vazia se não houver dados
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

        // Preenche o dropdown com as regiões disponíveis
        regionSelect.innerHTML = `
            <option value="norte">Norte</option>
            <option value="nordeste">Nordeste</option>
            <option value="centro-oeste">Centro-Oeste</option>
            <option value="sudeste">Sudeste</option>
            <option value="sul">Sul</option>
        `;
        // Define a região atual do técnico como selecionada
        regionSelect.value = technician.regiao_atual || "norte";

        // Exibe o modal
        modal.style.display = "block";

        // Função para confirmar a alteração da região
        const confirmHandler = () => {
            const newRegion = regionSelect.value;

            // Atualiza a região no localStorage
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
            if (storedData[technician.omie]) {
                storedData[technician.omie].regiao_atual = newRegion;
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));

                // Envia os dados atualizados para a API
                // enviarParaAPI(storedData[technician.omie], "editar");
            }

            // Fecha o modal
            modal.style.display = "none";

            // Atualiza a tabela para refletir a mudança
            loadTechniciansFromLocalStorage();

            // Remove os event listeners para evitar duplicação
            confirmBtn.removeEventListener("click", confirmHandler);
            cancelBtn.removeEventListener("click", cancelHandler);
        };

        // Função para cancelar a alteração
        const cancelHandler = () => {
            modal.style.display = "none";

            // Remove os event listeners para evitar duplicação
            confirmBtn.removeEventListener("click", confirmHandler);
            cancelBtn.removeEventListener("click", cancelHandler);
        };

        // Adiciona os event listeners
        confirmBtn.addEventListener("click", confirmHandler);
        cancelBtn.addEventListener("click", cancelHandler);
    }

    function enviarParaAPI(tecnico, operacao) {
        const payload = {
            tabela: "agenda", // Campo fixo
            operacao: operacao, // "incluir" ou "editar"
            tecnico: tecnico, // Objeto completo do técnico
        };

        // Chama a função genérica para envio
        enviar_dados_generico(payload);
    }



});

function isColorDark(color) {
    // Remove o "#" se existir
    const hex = color.replace("#", "");
    
    // Verifica se a cor tem 6 caracteres
    if (hex.length !== 6) {
        console.error("Formato de cor inválido:", color);
        return false; // Retorna falso para evitar erros
    }
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    console.log(`Cor: ${color}, Luminância: ${luminance}`);
    return luminance < 0.5; // Retorna true se a cor for escura
}

function adjustTextColor(element, backgroundColor) {
    const isDark = isColorDark(backgroundColor);

    // Força a cor do texto no elemento principal (TD)
    element.style.setProperty("color", isDark ? "white" : "black", "important");

    // Ajusta também o input dentro do TD
    const input = element.querySelector("input");
    if (input) {
        input.style.setProperty("color", "inherit", "important"); // Garante que o input herde a cor do TD
    }
}

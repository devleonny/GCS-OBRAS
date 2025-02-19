document.addEventListener("DOMContentLoaded", () => {
    const daysRow = document.getElementById("days-row");
    const techniciansBody = document.getElementById("technicians-body");
    const monthNameElement = document.getElementById("month-name");
    const monthSelect = document.getElementById("month-select");
    const yearSelect = document.getElementById("year-select");
    const regionSelect = document.getElementById("region-select");
    const syncDataBtn = document.getElementById("sync-data-btn");
    const addLineBtn = document.getElementById("add-line-btn");
    const updateDataBtn = document.getElementById("update-data-btn");

    recuperar_clientes()

    document.querySelectorAll(".close-modal-btn").forEach((closeBtn) => {
        closeBtn.addEventListener("click", (event) => {
            const modal = event.target.closest(".modal"); // Seleciona o modal atual
            modal.style.display = "none"; // Esconde o modal
        });
    });

    checkRegionBeforeAdding();
    // Função para gerar uma cor aleatória
    function getRandomColor() {
        return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    }

    // Adiciona o evento ao botão de "Atualizar"
    updateDataBtn.addEventListener("click", atualizarDados);

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    let technicians = []; // Declaração global
    let departments = [];
    let technicianOptions = [];
    let isLoading = false;

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
        checkRegionBeforeAdding();
        generateCalendar(yearSelect.value, monthSelect.value);
        loadTechniciansFromLocalStorage();
    });

    // Sincronizar dados (usado para botão e verificação inicial)
    async function syncData(clientesIndexDB) {
        showLoading(); // Exibe o indicador de carregamento
        try {
            if (!clientesIndexDB) {

                console.log("entrei")
                await recuperar_clientes()
                console.log("sai")

            }
            const [fetchedDepartments, fetchedTechnicians] = await Promise.all([
                fetchDepartmentsFromAPI(),
                resgatar_tecnicos()
            ]);

            // Salvar dados sincronizados no localStorage
            localStorage.setItem("departments", JSON.stringify(fetchedDepartments));
            localStorage.setItem("technicians", JSON.stringify(fetchedTechnicians));

            // Atualizar variáveis globais
            departments = fetchedDepartments;
            technicianOptions = fetchedTechnicians;

            // Atualizar a tabela e o calendário somente após a sincronização
            hideLoading(); // Oculta o loading
            generateCalendar(yearSelect.value, monthSelect.value);
            loadTechniciansFromLocalStorage();
            showPopup("Dados sincronizados com sucesso!");
        } catch (error) {
            hideLoading(); // Oculta o loading em caso de erro
            console.error("Erro ao sincronizar os dados:", error);
            showPopup("Erro ao sincronizar os dados. Verifique sua conexão e tente novamente.");
        } finally {
            atualizarDados()
        }
    }

    // Verifica se os dados estão no localStorage, caso contrário, sincroniza
    async function checkAndSyncData() {
        let storedDepartments = localStorage.getItem("departments");
        let storedTechnicians = localStorage.getItem("technicians");
        let clientesIndexDB = await recuperarDados("dados_clientes") || false;

        if (storedDepartments == "[]") {
            storedDepartments = false
        }

        if (!storedDepartments || !storedTechnicians || !clientesIndexDB) {
            console.log("Dados ausentes no localStorage. Realizando sincronização...");
            syncData(clientesIndexDB);
        } else {
            console.log("Dados encontrados no localStorage. Continuando normalmente.");
            atualizarDados()
            loadFromLocalStorage();
            loadTechniciansFromStorage();
            generateCalendar(yearSelect.value, monthSelect.value);
            loadTechniciansFromLocalStorage();
        }
    }


    // Função de inicialização da página
    function initializePage() {
        showLoading(); // Exibe o loading ao carregar a página
        loadCurrentSettings(); // Carrega configurações de mês, ano e região
        checkAndSyncData(); // Verifica se há dados e sincroniza se necessário
    }

    // Evento do botão de sincronização manual
    syncDataBtn.addEventListener("click", () => syncData(false));
    // Chama a função de inicialização
    initializePage();

    // Botão para adicionar nova linha
    addLineBtn.addEventListener("click", () => {
        if (regionSelect.value === "todas") {
            // Mostra aviso se a região for "Todas as Regiões"
            showPopup("Escolha uma região para adicionar um Técnico.");
        } else {
            // Adiciona a nova linha normalmente
            addNewRow();
        }
    });

    function checkRegionBeforeAdding() {
        if (regionSelect.value === "todas") {
            addLineBtn.style.cursor = "pointer";
        } else {
            addLineBtn.style.cursor = "pointer"; // Certifica que o cursor é padrão
        }
    }

    // Função para carregar dados do localStorage
    function loadFromLocalStorage() {
        let storedDepartments = localStorage.getItem("departments");

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
    }

    // Função para mostrar o indicador de carregamento
    function showLoading() {
        isLoading = true;
        const totalColumns = document.getElementById("days-row").children.length || 3;
        document.getElementById("technicians-body").innerHTML = `
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
        isLoading = false;
        document.getElementById("technicians-body").innerHTML = ""; // Limpa o tbody
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
        let clientes = await recuperarDados("dados_clientes"); // Recupera os dados

        if (clientes && typeof clientes === "object") {
            // Converte os valores do objeto em uma array
            const dadosArray = Object.values(clientes);

            // Filtra apenas os objetos que possuem a tag "TÉCNICO"
            const tecnicos = dadosArray
                .filter(item =>
                    item.tags && item.tags.some(tagObj => tagObj.tag === "TÉCNICO")
                )
                .map(tecnico => ({
                    nome: tecnico.nome,
                    omie: tecnico.omie
                })); // Retorna apenas `nome` e `omie`
            return tecnicos;
        } else {
            console.error("Os dados retornados não são um objeto válido:", clientes);
            return []; // Retorna uma array vazia como fallback
        }
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

    function updateFilteredDropdown(dropdown, options, inputValue, onSelectCallback) {
        dropdown.innerHTML = ""; // Limpa o dropdown

        const filteredOptions = options.filter((option) =>
            option.nome.toLowerCase().includes(inputValue.toLowerCase())
        );

        if (filteredOptions.length > 0) {
            filteredOptions.forEach((option) => {
                const optionElement = document.createElement("div");
                optionElement.className = "dropdown-option";
                optionElement.textContent = option.nome;
                optionElement.dataset.codigo = option.codigo || option.omie; // Suporte para técnicos (omie) e departamentos (codigo)

                // Define o evento de clique para selecionar o item
                optionElement.addEventListener("click", () => {
                    onSelectCallback(option);
                    dropdown.style.display = "none"; // Fecha o dropdown
                });

                dropdown.appendChild(optionElement);
            });
        } else {
            const noResultsOption = document.createElement("div");
            noResultsOption.className = "dropdown-option no-results";
            noResultsOption.textContent = "Nenhum item encontrado";
            dropdown.appendChild(noResultsOption);
        }
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
        const tecnicoOmie = technician.omie || "";
        const tecnicoAtual = technicianOptions.find((tech) => tech.omie == tecnicoOmie);
        tecnicoInput.value = tecnicoAtual ? tecnicoAtual.nome : ""; // Nome do técnico baseado no `omie`

        tecnicoInput.dataset.omie = tecnicoOmie;

        const tecnicoDropdown = document.createElement("div");
        tecnicoDropdown.className = "dropdown-options";
        technicianOptions.forEach((tech) => {
            const option = document.createElement("div");
            option.className = "dropdown-option";
            option.textContent = tech.nome;
            option.dataset.omie = tech.omie;
    
            option.addEventListener("click", () => {
                tecnicoInput.value = tech.nome; // Atualiza o nome do técnico no input
                tecnicoInput.dataset.omie = tech.omie; // Vincula o código omie
                tecnicoDropdown.style.display = "none"; // Fecha o dropdown
            });
    
            tecnicoDropdown.appendChild(option);
        });

        tecnicoInput.addEventListener("focus", () => {
            tecnicoDropdown.style.display = "block"; // Exibe o dropdown
            positionDropdown(tecnicoInput, tecnicoDropdown); // Posiciona o dropdown abaixo do input
            updateFilteredDropdown(tecnicoDropdown, technicianOptions, tecnicoInput.value, (selectedTech) => {
                tecnicoInput.value = selectedTech.nome;
                tecnicoInput.dataset.omie = selectedTech.omie;
            });
        });

        tecnicoInput.addEventListener("input", () => {
            // Verifica se o técnico selecionado é válido
            updateFilteredDropdown(
                tecnicoDropdown,
                technicianOptions,
                tecnicoInput.value,
                (selectedTech) => {
                    tecnicoInput.value = selectedTech.nome; // Define o nome do técnico
                    tecnicoInput.dataset.omie = selectedTech.omie; // Salva o código omie
                }
            );

            const validTechnician = technicianOptions.find(
                (tech) => tech.nome.trim().toLowerCase() === tecnicoInput.value.trim().toLowerCase()
            );

            if (!validTechnician) {
                // Técnico inválido: Limpa o campo e exibe mensagem de erro (opcional)
                tecnicoInput.dataset.omie = ""; // Remove o `omie` se inválido
                return; // Sai da função para evitar qualquer outra ação
            }

            // Verifica se o técnico já existe na agenda atual
            const currentKey = getAgendaKey(); // Exemplo: "2025_0"
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
            const isDuplicate = Object.values(storedData).some(
                (tech) =>
                    tech.omie === validTechnician.omie && // Mesmo técnico pelo código `omie`
                    tech.agendas[currentKey] // Já registrado na mesma agenda
            );

            if (isDuplicate) {
                // Técnico duplicado: Limpa o campo e exibe mensagem de erro
                tecnicoInput.value = ""; // Limpa o nome do técnico
                tecnicoInput.dataset.omie = ""; // Remove o código do dataset
                showPopup("Este técnico já está na agenda atual!");
                return; // Sai da função para evitar salvar duplicado
            }

            // Técnico válido e não duplicado: Salva o `omie` no dataset
            tecnicoInput.dataset.omie = validTechnician.omie;
        });


        // Validação no blur para não duplicar técnicos na mesma agenda
        tecnicoInput.dataset.originalName = technician.nome || ""; // Armazena o nome original no dataset

        tecnicoInput.addEventListener("blur", () => {
            setTimeout(() => {
                const currentKey = getAgendaKey(); // Chave do mês/ano atual (exemplo: "2025_0")
                const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};

                // Captura o nome e Omie antes de qualquer mudança
                const previousOmie = tecnicoInput.dataset.previousOmie || String(tecnicoInput.dataset.omie);
                const previousName = tecnicoInput.dataset.previousName || tecnicoInput.dataset.originalName;

                console.log("Chave do mês/ano (currentKey):", currentKey);
                console.log("Dados armazenados (storedData):", storedData);
                console.log("Nome Anterior:", previousName);
                console.log("Omie Anterior:", previousOmie);

                // Verifica se o técnico selecionado é válido
                const validTechnician = technicianOptions.find(
                    (tech) => tech.nome.trim().toLowerCase() === tecnicoInput.value.trim().toLowerCase()
                );

                if (!validTechnician) {
                    // Técnico inválido: Reverte o valor para o anterior
                    tecnicoInput.value = previousName;
                    tecnicoInput.dataset.omie = previousOmie;
                    showPopup("Por favor, selecione um técnico válido.");
                    console.log("Técnico inválido. Revertendo para o valor anterior.");
                } else {
                    // Verifica se o técnico já está na agenda atual
                    const isDuplicate = Object.values(storedData).some(
                        (tech) =>
                            String(tech.omie) === String(validTechnician.omie) &&
                            tech.agendas?.[currentKey]
                    );

                    if (isDuplicate) {
                        // Técnico duplicado: Reverte o valor para o anterior
                        tecnicoInput.value = previousName;
                        tecnicoInput.dataset.omie = previousOmie;
                        showPopup("Este técnico já está na agenda atual!");
                        console.log("Técnico duplicado. Revertendo para o valor anterior.");
                    } else {
                        // Técnico válido e não duplicado
                        const newOmie = String(validTechnician.omie);

                        if (storedData[previousOmie]) {
                            console.log(
                                `Encontrado técnico anterior (${previousName}, ${previousOmie}) no storedData.`
                            );

                            // Verifica se há uma agenda para a chave atual
                            if (storedData[previousOmie]?.agendas?.[currentKey]) {
                                console.log(
                                    `Agenda encontrada para técnico anterior (${previousName}, ${previousOmie}):`,
                                    storedData[previousOmie].agendas[currentKey]
                                );

                                delete storedData[previousOmie].agendas[currentKey];

                                enviar(`dados_agenda_tecnicos/${newOmie}`, storedData[newOmie]);

                                // Atualiza o localStorage
                                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
                                console.log(
                                    `Agenda do mês ${currentKey} removida para técnico ${previousName} (${previousOmie}).`
                                );
                            } else {
                                console.log(
                                    `Nenhuma agenda encontrada para o técnico anterior (${previousName}, ${previousOmie}) no mês ${currentKey}.`
                                );
                            }
                        } else {
                            console.log(
                                `Técnico anterior (${previousName}, ${previousOmie}) não encontrado no storedData.`
                            );
                        }

                        // Atualiza o técnico atual
                        tecnicoInput.dataset.omie = newOmie;
                        tecnicoInput.dataset.originalName = validTechnician.nome;

                        // Salva as mudanças no localStorage
                        saveTechniciansToLocalStorage();

                        // Log de sucesso
                        console.log(
                            `Técnico atualizado com sucesso: ${validTechnician.nome} (${newOmie}).`
                        );
                    }
                }

                tecnicoDropdown.style.display = "none"; // Fecha o dropdown
            }, 200); // Pequeno atraso para permitir seleção do dropdown
        });

        // Garante que o valor anterior seja salvo antes de edição
        tecnicoInput.addEventListener("focus", () => {
            tecnicoInput.dataset.previousOmie = tecnicoInput.dataset.omie;
            tecnicoInput.dataset.previousName = tecnicoInput.value;
            console.log("Salvando valores anteriores:", {
                previousOmie: tecnicoInput.dataset.previousOmie,
                previousName: tecnicoInput.dataset.previousName,
            });
        });


        tecnicoCell.appendChild(tecnicoInput);
        tecnicoCell.appendChild(tecnicoDropdown);
        newRow.appendChild(tecnicoCell);

        // Colunas de dias (departamentos) (mantidas inalteradas)
        for (let i = 0; i < totalDays; i++) {
            const dayCell = document.createElement("td");
            dayCell.style.width = "50px";
            dayCell.style.maxWidth = "50px";

            const dayInput = document.createElement("input");
            dayInput.type = "text";
            dayInput.className = "dropdown-input";
            dayInput.style.backgroundColor = "transparent";

            const deptCode = agenda[i] || "";
            const dept = departments.find((d) => d.codigo === deptCode);
            if (dept) {
                const truncatedName = dept.nome.length > 3 ? dept.nome.slice(0, 3) + "..." : dept.nome;
                dayInput.value = truncatedName;
                dayInput.title = dept.nome;
                dayCell.style.backgroundColor = dept.color;
                adjustTextColor(dayCell, dept.color);
            }

            dayInput.dataset.codigo = deptCode;

            const dayDropdown = document.createElement("div");
            dayDropdown.className = "dropdown-options";
            departments.forEach((dept) => {
                const option = document.createElement("div");
                option.className = "dropdown-option";
                option.textContent = dept.nome;
                option.dataset.codigo = dept.codigo;
                option.addEventListener("click", () => {
                    const truncatedName = dept.nome.length > 3 ? dept.nome.slice(0, 3) + "..." : dept.nome;
                    dayInput.value = truncatedName;
                    dayInput.title = dept.nome;
                    dayInput.dataset.codigo = dept.codigo;
                    dayDropdown.style.display = "none";
                    dayCell.style.backgroundColor = dept.color;
                    adjustTextColor(dayCell, dept.color);
                    saveTechniciansToLocalStorage();
                });
                dayDropdown.appendChild(option);
            });

            dayInput.addEventListener("focus", () => {
                dayDropdown.style.display = "block"; // Exibe o dropdown
                positionDropdown(dayInput, dayDropdown); // Posiciona o dropdown abaixo do input
                updateFilteredDropdown(dayDropdown, departments, dayInput.value, (selectedDept) => {
                    const truncatedName = selectedDept.nome.length > 3 ? selectedDept.nome.slice(0, 3) + "..." : selectedDept.nome;
                    dayInput.value = truncatedName;
                    dayInput.title = selectedDept.nome;
                    dayInput.dataset.codigo = selectedDept.codigo;
                    dayCell.style.backgroundColor = selectedDept.color;
                    adjustTextColor(dayCell, selectedDept.color);
                    saveTechniciansToLocalStorage();
                });
            });

            dayInput.addEventListener("input", () => {
                updateFilteredDropdown(
                    dayDropdown,
                    departments,
                    dayInput.value,
                    (selectedDept) => {
                        const truncatedName = selectedDept.nome.length > 3 ? selectedDept.nome.slice(0, 3) + "..." : selectedDept.nome;
                        dayInput.value = truncatedName; // Define o nome truncado no input
                        dayInput.title = selectedDept.nome; // Define o nome completo no título
                        dayInput.dataset.codigo = selectedDept.codigo; // Salva o código do departamento
                        dayCell.style.backgroundColor = selectedDept.color; // Aplica a cor no fundo do TD
                        adjustTextColor(dayCell, selectedDept.color); // Ajusta a cor do texto
                        saveTechniciansToLocalStorage(); // Salva no localStorage
                    }
                );
            });

            dayInput.addEventListener("blur", () => {
                setTimeout(async () => {
                    const idAgenda = getAgendaKey(); // Obtém a chave do mês/ano atual
                    const indexDia = Array.from(dayInput.parentElement.parentElement.children).indexOf(dayInput.parentElement) - 1;
                    const technicianOmie = dayInput.closest("tr").querySelector("td input.dropdown-input").dataset.omie;
            
                    // 🔥 Permitir campo em branco (remover departamento) 🔥
                    if (!dayInput.value.trim()) {
                        dayInput.dataset.codigo = "";
                        dayCell.style.backgroundColor = ""; // Remove cor do fundo
                        dayCell.style.color = ""; // Reseta cor do texto
            
                        // Remove do LocalStorage
                        saveTechniciansToLocalStorage();
            
                        // Remove da API
                        if (idAgenda && indexDia >= 0) {
                            await enviar(`dados_agenda_tecnicos/${technicianOmie}/agendas/${idAgenda}/${indexDia}`, null);
                            console.log(`Departamento removido: dados_agenda_tecnicos/${technicianOmie}/agendas/${idAgenda}/${indexDia}`);
                        }
                        return;
                    }
            
                    // 🔥 Verifica se o departamento é válido 🔥
                    const validDepartment = departments.find(
                        (dept) =>
                            dept.nome.trim().toLowerCase() === dayInput.value.trim().toLowerCase() || // Compara pelo nome
                            String(dept.codigo) === String(dayInput.dataset.codigo) // Compara pelo código (força string)
                    );
            
                    if (!validDepartment) {
                        // Departamento inválido: limpa o campo e exibe mensagem
                        dayInput.value = "";
                        dayInput.dataset.codigo = "";
                        showPopup("Por favor, selecione um departamento válido.");
                        dayCell.style.backgroundColor = ""; // Remove a cor do fundo
                        dayCell.style.color = ""; // Reseta a cor do texto
                    } else {
                        // 🔥 Atualiza nome, código e estilo 🔥
                        const truncatedName = validDepartment.nome.length > 3
                            ? validDepartment.nome.slice(0, 3) + "..."
                            : validDepartment.nome;
                        dayInput.value = truncatedName; // Nome truncado
                        dayInput.title = validDepartment.nome; // Nome completo como dica
                        dayInput.dataset.codigo = validDepartment.codigo; // Salva o código no dataset
                        dayCell.style.backgroundColor = validDepartment.color; // Aplica a cor no TD
                        adjustTextColor(dayCell, validDepartment.color); // Ajusta a cor do texto no TD
            
                        // Salva no LocalStorage
                        saveTechniciansToLocalStorage();
            
                        // 🔥 Envia APENAS a atualização específica 🔥
                        if (idAgenda && indexDia >= 0) {
                            await enviar(`dados_agenda_tecnicos/${technicianOmie}/agendas/${idAgenda}/${indexDia}`, validDepartment.codigo);
                            console.log(`Atualizado: dados_agenda_tecnicos/${technicianOmie}/agendas/${idAgenda}/${indexDia} -> ${validDepartment.codigo}`);
                        }
                    }
            
                    dayDropdown.style.display = "none"; // Fecha o dropdown
                }, 200);
            });
            
            dayCell.appendChild(dayInput);
            dayCell.appendChild(dayDropdown);
            newRow.appendChild(dayCell);
        }

        // Coluna de ações (atualização para o botão de exclusão)
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

        // Lógica de exclusão
        // Lógica para o botão de exclusão com modal
        removeButton.addEventListener("click", () => {
            const currentKey = getAgendaKey(); // Obtém a chave atual da agenda (exemplo: "2025_0")
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};

            // Configura o modal
            const deleteModal = document.getElementById("delete-modal");
            const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
            const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

            // Exibe o modal
            deleteModal.style.display = "block";

            // Lógica para confirmar exclusão
            const confirmHandler = () => {
                if (storedData[technician.omie]) {
                    // Remove apenas a agenda correspondente
                    delete storedData[technician.omie].agendas[currentKey];

                    // Envia os dados atualizados para a API com a operação "editar"
                    deletar(`dados_agenda_tecnicos/${technician.omie}`);

                    // Salva os dados atualizados no localStorage
                    localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
                }

                // Remove a linha da tabela
                newRow.remove();

                // Atualiza a tabela de técnicos na interface
                loadTechniciansFromLocalStorage();

                // Fecha o modal
                deleteModal.style.display = "none";

                // Remove os event listeners para evitar duplicações
                confirmDeleteBtn.removeEventListener("click", confirmHandler);
                cancelDeleteBtn.removeEventListener("click", cancelHandler);
            };

            // Lógica para cancelar exclusão
            const cancelHandler = () => {
                // Fecha o modal
                deleteModal.style.display = "none";

                // Remove os event listeners para evitar duplicações
                confirmDeleteBtn.removeEventListener("click", confirmHandler);
                cancelDeleteBtn.removeEventListener("click", cancelHandler);
            };

            // Adiciona os event listeners
            confirmDeleteBtn.addEventListener("click", confirmHandler);
            cancelDeleteBtn.addEventListener("click", cancelHandler);
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

        const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};

        Array.from(techniciansBody.children).forEach((row) => {
            const tecnicoInput = row.querySelector("td input.dropdown-input");
            if (!tecnicoInput || !tecnicoInput.dataset.omie) return;

            const technicianOmie = tecnicoInput.dataset.omie;

            // Verifica se o técnico já existe no `storedData`
            let technician = storedData[technicianOmie] || {
                omie: technicianOmie,
                nome: tecnicoInput.value.trim(),
                agendas: {},
            };

            technician.regiao_atual = regionSelect.value;

            // Captura os departamentos selecionados para a agenda atual
            const selectedDepartments = Array.from(
                row.querySelectorAll("td input.dropdown-input")
            )
                .slice(1) // Ignora o campo do técnico
                .map((cell) => cell.dataset.codigo || "");

            technician.agendas[key] = selectedDepartments;

            // Atualiza o `storedData` com o técnico
            storedData[technicianOmie] = technician;
        });

        // Salva os dados atualizados no localStorage
        localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
        console.log("Dados atualizados no localStorage e enviados para a API:", storedData);
    }


    function loadTechniciansFromLocalStorage() {
        if (isLoading) return;
    
        const storedData = localStorage.getItem("dados_agenda_tecnicos");
        const daysRow = document.getElementById("days-row");
        const techniciansBody = document.getElementById("technicians-body");

        if (storedData) {
            const techniciansObj = JSON.parse(storedData);
            const currentKey = getAgendaKey(); // Chave do mês/ano atual
            const selectedRegion = regionSelect.value; // Região selecionada
    
            const technicians = Object.values(techniciansObj).filter((tech) => {
                const isRegionMatching =
                    selectedRegion === "todas" || tech.regiao_atual === selectedRegion;
                return tech.agendas[currentKey] && isRegionMatching;
            });
    
            techniciansBody.innerHTML = ""; // Limpa a tabela
    
            if (technicians.length > 0) {
                technicians.forEach((technician) => {
                    const agenda = technician.agendas[currentKey] || [];
                    addTechnicianRow(technician, agenda); // Adiciona a linha com base no `omie`
                });
            } else {
                techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${daysRow.children.length || 2
                    }">Nenhum técnico disponível para esta região.</td></tr>`;
            }
        } else {
            techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${daysRow.children.length || 2
                }">Nenhum técnico disponível.</td></tr>`;
        }
    }
    

    function loadTechniciansFromStorage() {
        let storedTechnicians = localStorage.getItem("technicians");
        if (storedTechnicians) {
            try {
                technicianOptions = JSON.parse(storedTechnicians);
            } catch (error) {
                technicianOptions = []; // Garante que a lista esteja vazia em caso de erro
            }
        } else {
            technicianOptions = []; // Lista vazia se não houver dados
        }
    }

    function getAgendaKey() {
        const monthSelect = document.getElementById("month-select");
        const yearSelect = document.getElementById("year-select");

        const month = monthSelect.value;
        const year = yearSelect.value;

        if (month === undefined || !year) {
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
        const newTechnician = { id: "", nome: "", agendas: {} }; // Nome vazio e sem "Selecione"

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

        // Fecha o modal ao clicar fora do modal
        window.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeModal();
            }
        }, { once: true });
    }

    function getDepartmentColorFromStorage(departmentName) {
        let storedDepartments = JSON.parse(localStorage.getItem("departments")) || [];
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
        const confirmHandler = async () => {
            const newRegion = regionSelect.value;
        
            // Atualiza a região no localStorage
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
        
            if (storedData[technician.omie]) {
                storedData[technician.omie].regiao_atual = newRegion;
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
        
                // 🔥 Envia APENAS a atualização da região específica 🔥
                enviar(`dados_agenda_tecnicos/${technician.omie}/regiao_atual`,newRegion );
        
                console.log(`Região atualizada para ${newRegion} do técnico ${technician.omie}`);
            }
        
            // Fecha o modal
            modal.style.display = "none";
        
            // Atualiza a tabela para refletir a mudança
            loadTechniciansFromLocalStorage();
        
            // Remove os event listeners para evitar duplicação
            confirmBtn.removeEventListener("click", confirmHandler);
        };
        

        // Função para cancelar a alteração
        const cancelHandler = () => {
            modal.style.display = "none";

            // Remove os event listeners para evitar duplicação
            confirmBtn.removeEventListener("click", confirmHandler);
        };

        // Adiciona os event listeners
        confirmBtn.addEventListener("click", confirmHandler);
    }


    async function atualizarDados() {
        
            showLoading(); // Exibe o indicador de carregamento
            const data = await receber("dados_agenda_tecnicos");

            console.log(data)

            // Salva no localStorage como um objeto indexado por `omie`
            localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(data));

            hideLoading();
            generateCalendar(yearSelect.value, monthSelect.value); // Garante que o calendário seja atualizado
            loadTechniciansFromLocalStorage(); // Monta a tabela
    }


});

function isColorDark(color) {
    // Remove o "#" se existir
    const hex = color.replace("#", "");

    // Verifica se a cor tem 6 caracteres
    if (hex.length !== 6) {
        return false; // Retorna falso para evitar erros
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
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
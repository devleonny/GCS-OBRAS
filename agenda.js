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

    // deletar(`dados_agenda_tecnicos/6053638295`)

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
                await recuperar_clientes();
            }

            const [fetchedDepartments, fetchedTechnicians] = await Promise.all([
                fetchDepartmentsFromAPI(),
                resgatar_tecnicos()
            ]);

            // 🔥 Valida se os dados retornados são válidos
            if (!Array.isArray(fetchedDepartments) || fetchedDepartments.length === 0) {
            } else {
                localStorage.setItem("departments", JSON.stringify(fetchedDepartments));
                departments = fetchedDepartments;
            }

            if (!Array.isArray(fetchedTechnicians) || fetchedTechnicians.length === 0) {
            } else {
                localStorage.setItem("technicians", JSON.stringify(fetchedTechnicians));
                technicianOptions = fetchedTechnicians;
            }

            // Atualizar a tabela e o calendário somente após a sincronização
            hideLoading(); // Oculta o loading
            generateCalendar(yearSelect.value, monthSelect.value);
            loadTechniciansFromLocalStorage();
            showPopup("Dados sincronizados com sucesso!");
        } catch (error) {
            hideLoading();
            showPopup("Erro ao sincronizar os dados. Verifique sua conexão.");
            loadTechniciansFromLocalStorage();
        } finally {
            atualizarDados();
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
            syncData(clientesIndexDB);
        } else {
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
            return []; // Retorna uma array vazia como fallback
        }
    }

    function generateCalendar(year, month) {
        const regionSelect = document.getElementById("region-select");
        const region = regionSelect.value.charAt(0).toUpperCase() + regionSelect.value.slice(1); // Região selecionada
        monthNameElement.textContent = `${monthNames[month]} ${year} - Região: ${region}`;
    
        // Corrigir cálculo dos dias no mês
        let daysInMonth;
    
        // Verifica se o mês é fevereiro (mês 1 em JavaScript)
        if (month == 1) {
            // Verifica se o ano é bissexto (ano % 4 == 0)
            daysInMonth = (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) ? 29 : 28;
        } else if (month == 3 || month == 5 || month == 8 || month == 10) {
            // Meses com 30 dias
            daysInMonth = 30;
        } else {
            // Todos os outros meses têm 31 dias
            daysInMonth = 31;
        }
    
        const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        let daysHTML = `<th class="left-header">Técnicos</th>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const weekday = weekdays[new Date(year, month, day).getDay()];
            daysHTML += `<th>${weekday}<br>${String(day).padStart(2, "0")}</th>`;
        }
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
        const tecnicoNome = technician.nome || "";

        const tecnicoAtual = technicianOptions.find((tech) => tech.omie == tecnicoOmie);
        tecnicoInput.value = tecnicoNome; // 🔥 Exibe o nome do técnico na tabela corretamente

        if (tecnicoNome) {
            tecnicoInput.readOnly = "true"
        }
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
            adicionarTecnico(tecnicoInput, tecnicoDropdown);
        });

        // Garante que o valor anterior seja salvo antes de edição
        tecnicoInput.addEventListener("focus", () => {
            tecnicoInput.dataset.previousOmie = tecnicoInput.dataset.omie;
            tecnicoInput.dataset.previousName = tecnicoInput.value;
        });


        const editButton = document.createElement("button");
        editButton.className = "edit-btn";
        const editImage = document.createElement("img");
        editImage.src = "imagens/editar.png";
        editImage.className = "imagem-editar"
        editImage.alt = "Alterar Região";
        editButton.addEventListener("click", () => openEditModal(technician));
        editButton.appendChild(editImage);

        tecnicoCell.appendChild(tecnicoInput);
        tecnicoCell.appendChild(tecnicoDropdown);
        tecnicoCell.appendChild(editButton); // Coloca o botão de editar aqui
        newRow.appendChild(tecnicoCell);

        // Colunas de dias (departamentos) (mantidas inalteradas)
        for (let i = 0; i <= totalDays; i++) {
            const dayCell = document.createElement("td");
            dayCell.style.width = "50px";
            dayCell.style.maxWidth = "50px";

            const dayNumber = (i + 1).toString(); // Converte para string

            const dayInput = document.createElement("input");
            dayInput.type = "text";
            dayInput.className = "dropdown-input";
            dayInput.style.backgroundColor = "transparent";

            dayInput.dataset.day = dayNumber;

            const deptCode = agenda[dayNumber] || "";
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

            // 🔥 Evita que o dropdown feche antes de registrar a seleção
            dayDropdown.addEventListener("mousedown", (event) => {
                event.preventDefault();
            });

            departments.forEach((dept) => {
                const option = document.createElement("div");
                option.className = "dropdown-option";
                option.textContent = dept.nome;
                option.dataset.codigo = dept.codigo;

                // Evento de clique na opção do dropdown
                // Selecionando um departamento do dropdown
                option.addEventListener("mousedown", (event) => {
                    event.preventDefault(); // 🔥 Evita perda de foco antes de salvar

                    // Atualiza corretamente o nome e código do departamento
                    const truncatedName = dept.nome.length > 3 ? dept.nome.slice(0, 3) + "..." : dept.nome;
                    dayInput.value = truncatedName;
                    dayInput.title = dept.nome;
                    dayInput.dataset.codigo = dept.codigo;

                    // Aplica a cor do departamento na célula
                    dayCell.style.backgroundColor = dept.color;
                    adjustTextColor(dayCell, dept.color);

                    // Chama a função para salvar
                    salvarDepartamentoEspecifico(dayInput, dayCell, dayDropdown, tecnicoInput, previousValue);

                    // Fecha o dropdown após salvar
                    setTimeout(() => {
                        dayDropdown.style.display = "none";
                    }, 50);

                    saveTechniciansToLocalStorage(); // 🔥 Sempre salva os dados após a seleção
                });


                dayDropdown.appendChild(option);
            });

            dayInput.addEventListener("focus", () => {
                const tecnicoInput = newRow.querySelector("td input.dropdown-input") //Obtém o input do técnico
                const tecnicoOmie = tecnicoInput.dataset.omie //Obtém o código Omie do técnico

                //Verifica se há um técnico definido
                if (!tecnicoOmie || tecnicoOmie.trim() === "") {
                    showPopup("Selecione um técnico antes de editar os dias.")
                    dayInput.blur(); //Remove o foco do Input dia
                    return
                }

                //Se houver um técnico definido, exibe o dropdown.
                dayDropdown.style.display = "block"; // Exibe o dropdown
                positionDropdown(dayInput, dayDropdown); // Posiciona o dropdown abaixo do input

                updateFilteredDropdown(dayDropdown, departments, dayInput.value, (selectedDept) => {
                    const truncatedName = selectedDept.nome.length > 3 ? selectedDept.nome.slice(0, 3) + "..." : selectedDept.nome;
                    dayInput.value = truncatedName;
                    dayInput.title = selectedDept.nome;
                    dayInput.dataset.codigo = selectedDept.codigo; // 🔥 Garante que o código seja salvo corretamente
                    dayCell.style.backgroundColor = selectedDept.color;
                    adjustTextColor(dayCell, selectedDept.color);
                    salvarDepartamentoEspecifico(dayInput, dayCell, dayDropdown, tecnicoInput, previousValue);
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

            let previousValue = dayInput.value.trim();

            // Atualiza o valor anterior quando o campo recebe foco
            dayInput.addEventListener("focus", () => {
                previousValue = dayInput.value.trim();  // Salva o valor antes da edição
            });

            dayCell.appendChild(dayInput);
            dayCell.appendChild(dayDropdown);
            newRow.appendChild(dayCell);
        }

        techniciansBody.appendChild(newRow);
    }

    function adicionarTecnico(inputTecnico, dropdownTecnico) {
        setTimeout(() => {
            const chaveAtual = getAgendaKey(); // Chave do mês/ano atual (exemplo: "2025_0")
            const dadosArmazenados = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};

            // Captura o nome e Omie antes de qualquer mudança
            const omieAnterior = inputTecnico.dataset.previousOmie || String(inputTecnico.dataset.omie);
            const nomeAnterior = inputTecnico.dataset.previousName || inputTecnico.dataset.originalName;

            // Verifica se o técnico selecionado é válido
            const tecnicoValido = technicianOptions.find(
                (tecnico) => tecnico.nome.trim().toLowerCase() === inputTecnico.value.trim().toLowerCase()
            );

            if (!tecnicoValido) {
                // Técnico inválido: Reverte o valor para o anterior
                inputTecnico.value = nomeAnterior;
                inputTecnico.dataset.omie = omieAnterior;
                showPopup("Por favor, selecione um técnico válido.");
            } else {
                // Verifica se o técnico já está na agenda atual
                const estaDuplicado = Object.values(dadosArmazenados).some(
                    (tecnico) =>
                        String(tecnico.omie) === String(tecnicoValido.omie) &&
                        tecnico.agendas?.[chaveAtual]
                );

                if (estaDuplicado) {
                    // Técnico duplicado: Reverte o valor para o anterior
                    inputTecnico.value = nomeAnterior;
                    inputTecnico.dataset.omie = omieAnterior;
                    showPopup("Este técnico já está na agenda atual!");
                } else {
                    // Técnico válido e não duplicado
                    const novoOmie = String(tecnicoValido.omie);

                    if (dadosArmazenados[omieAnterior]) {
                        const tecnicoData = dadosArmazenados[omieAnterior];
    
                        // Verifica se o técnico já tem agendas salvas
                        const agendasExistentes = tecnicoData.agendas || {};
    
                        // Adiciona a nova agenda (ou atualiza a chave atual)
                        tecnicoData.agendas = {
                            ...agendasExistentes,  // Mantém as agendas anteriores
                            [chaveAtual]: tecnicoData.agendas[chaveAtual] || {}, // Adiciona ou mantém a chave atual
                        };

                        enviar(`dados_agenda_tecnicos/${novoOmie}/agendas`, tecnicoData.agendas)
    
                        // Atualiza a informação no localStorage
                        dadosArmazenados[omieAnterior] = tecnicoData;
                    } else {
                        // Se o técnico não existir, cria um novo técnico
                        dadosArmazenados[novoOmie] = {
                            omie: novoOmie,
                            nome: tecnicoValido.nome,
                            agendas: {
                                [chaveAtual]: {}, // Cria a agenda para o mês/ano atual
                            },
                            regiao_atual: regionSelect.value, // A região atual do técnico
                        };
                        enviar(`dados_agenda_tecnicos/${novoOmie}`, dadosArmazenados[novoOmie])
                    }


                    if (dadosArmazenados[omieAnterior]) {
                        // Verifica se há uma agenda para a chave atual e remove apenas a chave modificada
                        if (dadosArmazenados[omieAnterior]?.agendas?.[chaveAtual]) {
                            delete dadosArmazenados[omieAnterior].agendas[chaveAtual];
                        }
                    }

                    // Atualiza o técnico atual
                    inputTecnico.dataset.omie = novoOmie;
                    inputTecnico.dataset.originalName = tecnicoValido.nome;
                    inputTecnico.readOnly = "true"
                }
            }

            // 🔥 Agora chamamos a função separada para salvar
            saveTechniciansToLocalStorage();

            dropdownTecnico.style.display = "none"; // Fecha o dropdown
        }, 200); // Pequeno atraso para permitir seleção do dropdown
    }

    function salvarDepartamentoEspecifico(inputDia, celulaDia, dropdownDia, inputTecnico, valorAnterior) {
        setTimeout(async () => {
            const entradaUsuario = inputDia.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const codigoDataset = inputDia.dataset.codigo ? String(inputDia.dataset.codigo).trim() : "";

            let dadosArmazenados = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
            const chaveAtual = getAgendaKey();
            const omieTecnico = inputTecnico.dataset.omie;

            if (!omieTecnico || !dadosArmazenados[omieTecnico] || !dadosArmazenados[omieTecnico].agendas) {
                return;
            }

            const valorFoiAlterado = valorAnterior !== inputDia.value.trim();

            // Se o campo foi apagado pelo usuário
            if (entradaUsuario === "") {
                if (valorFoiAlterado) {
                    deletar(`dados_agenda_tecnicos/${omieTecnico}/agendas/${chaveAtual}/${inputDia.dataset.day}`);
                }

                // 🔥 Remove do localStorage e da nuvem
                if (dadosArmazenados[omieTecnico].agendas[chaveAtual]) {
                    delete dadosArmazenados[omieTecnico].agendas[chaveAtual][inputDia.dataset.day];
                }

                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(dadosArmazenados));

                inputDia.dataset.codigo = ""; // Remove o código do departamento
                celulaDia.style.backgroundColor = "white"; // 🔥 Volta ao fundo original
                celulaDia.style.color = ""; // 🔥 Ajusta a cor do texto de volta ao normal
                dropdownDia.style.display = "none";

                return;
            }

            const departamentoValido = departments.find((dept) => {
                const nomeDept = dept.nome.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const codigoDept = String(dept.codigo).trim();
                return nomeDept == entradaUsuario || codigoDept == codigoDataset;
            });

            if (!departamentoValido) {
                inputDia.value = ""; // Apaga o texto
                inputDia.dataset.codigo = ""; // Remove qualquer código inválido
                celulaDia.style.backgroundColor = "white"; // 🔥 Volta ao fundo original
                celulaDia.style.color = ""; // 🔥 Ajusta a cor do texto
            } else {
                inputDia.dataset.codigo = departamentoValido.codigo;
                celulaDia.style.backgroundColor = departamentoValido.color;
                celulaDia.style.color = isColorDark(departamentoValido.color) ? "white" : "black";

                // 🔥 Atualiza no localStorage
                dadosArmazenados[omieTecnico].agendas[chaveAtual][inputDia.dataset.day] = departamentoValido.codigo;
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(dadosArmazenados));

                // 🔥 Atualiza na nuvem
                enviar(`dados_agenda_tecnicos/${omieTecnico}/agendas/${chaveAtual}/${inputDia.dataset.day}`, departamentoValido.codigo);
            }

            dropdownDia.style.display = "none";
        }, 100);
    }

    function positionDropdown(input, dropdown) {
        const rect = input.getBoundingClientRect();
        dropdown.style.position = "absolute";
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        dropdown.style.zIndex = "10000"; // Mantém o dropdown acima de outros elementos
    
        document.body.appendChild(dropdown); // Move o dropdown para o body
    
        // Adiciona um ouvinte de evento global para fechar o dropdown se clicar fora
        document.addEventListener("click", (event) => {
            if (!dropdown.contains(event.target) && event.target !== input) {
                dropdown.style.display = "none";
            }
        });
    }

    function getDepartmentColorByCode(departmentCode) {
        const department = departments.find((dept) => dept.codigo === departmentCode);
        return department ? department.color : "#ffffff"; // Retorna a cor ou branco, se não encontrado
    }

    function saveTechniciansToLocalStorage() {
        const key = getAgendaKey(); // Obtém a chave do mês/ano atual
        if (!key) return;

        const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};

        Array.from(techniciansBody.children).forEach((row) => {
            const tecnicoInput = row.querySelector("td input.dropdown-input");
            let technicianOmie = tecnicoInput.dataset.omie?.trim();
            let technicianNome = tecnicoInput.value.trim();

            // 🔥 Se não tem código Omie, tenta encontrar pelo nome
            if (!technicianOmie || technicianOmie === "undefined") {
                const matchedTechnician = technicianOptions.find(tech => tech.nome.trim().toLowerCase() === technicianNome.toLowerCase());
                if (matchedTechnician) {
                    technicianOmie = matchedTechnician.omie;
                    tecnicoInput.dataset.omie = technicianOmie;
                } else {
                    return;
                }
            }

            let agendaAtualizada = {};
            let hasDepartment = false;

            // 🔥 Percorre os inputs dos dias para verificar se há pelo menos um departamento selecionado
            const dayInputs = Array.from(row.querySelectorAll("td input.dropdown-input")).slice(1);
            dayInputs.forEach((cell, index) => {
                const codigo = cell.dataset.codigo?.trim();
                const dia = String(index + 1);

                if (codigo && codigo !== "null") {
                    agendaAtualizada[dia] = codigo;
                    hasDepartment = true;
                }
            });

            // 🔥 Apenas salva se o técnico tiver pelo menos UM departamento
            if (hasDepartment) {
                // 🔥 Mantém os dados antigos do técnico antes de sobrescrever
                if (!storedData[technicianOmie]) {
                    storedData[technicianOmie] = {
                        omie: technicianOmie,
                        nome: technicianNome,
                        agendas: {},
                        regiao_atual: regionSelect.value,
                    };
                }

                // 🔥 Mantém os meses anteriores e adiciona o novo mês/ano
                storedData[technicianOmie].agendas[key] = agendaAtualizada;

                // 🔥 Atualiza o LocalStorage
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));

            }
        });

        // 🔥 Atualiza apenas com técnicos válidos no localStorage
        localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));
    }

    function loadTechniciansFromLocalStorage() {
        if (isLoading) return;

        const storedData = localStorage.getItem("dados_agenda_tecnicos");
        const daysRow = document.getElementById("days-row");
        const techniciansBody = document.getElementById("technicians-body");

        if (storedData) {
            const techniciansObj = JSON.parse(storedData) || {};

            if (!techniciansObj || Object.keys(techniciansObj).length === 0) {
                techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${daysRow.children.length || 2}">Nenhum técnico disponível.</td></tr>`;
                return;
            }

            const currentKey = getAgendaKey(); // Exemplo: "2025_0"
            const selectedRegion = regionSelect.value; // Região selecionada

            const technicians = Object.values(techniciansObj).filter((tech) => {
                const isRegionMatching = selectedRegion === "todas" || tech.regiao_atual === selectedRegion;
            
                // 🔥 Verifica se o técnico tem a agenda para o mês/ano atual, mesmo que não tenha entradas
                const hasAgendaForCurrentMonth = tech.agendas && tech.agendas[currentKey];
            
                return isRegionMatching && hasAgendaForCurrentMonth;
            });            

            techniciansBody.innerHTML = ""; // Limpa a tabela

            if (technicians.length > 0) {
                technicians.forEach((technician) => {
                    const agenda = technician.agendas[currentKey] || {}; // 🔥 Garante que a agenda nunca seja `undefined`
                    addTechnicianRow(technician, agenda);
                });
            } else {
                techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${daysRow.children.length || 2}">Nenhum técnico disponível para esta região.</td></tr>`;
            }
        } else {
            techniciansBody.innerHTML = `<tr id="no-data-row"><td colspan="${daysRow.children.length || 2}">Nenhum técnico disponível.</td></tr>`;
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
        const deleteBtn = document.getElementById("delete-btn"); // Botão de excluir no modal de edição

        const deleteModal = document.getElementById("delete-modal"); // Modal de confirmação de exclusão
        const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
        const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

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

        // Exibe o modal de edição
        modal.style.display = "block";

        // Função para confirmar a alteração da região
        const confirmHandler = async () => {
            const newRegion = regionSelect.value;

            // Atualiza a região no localStorage
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};

            if (storedData[technician.omie]) {
                storedData[technician.omie].regiao_atual = newRegion;
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));

                // Envia a atualização da região específica
                enviar(`dados_agenda_tecnicos/${technician.omie}/regiao_atual`, newRegion);
            }

            // Fecha o modal de edição
            modal.style.display = "none";

            // Atualiza a tabela para refletir a mudança
            loadTechniciansFromLocalStorage();
        };

        // Função para cancelar a alteração
        const cancelHandler = () => {
            modal.style.display = "none";
        };

        // Função para abrir o modal de confirmação de exclusão
        const openDeleteModal = () => {
            deleteModal.style.display = "block"; // Exibe o modal de exclusão
        };

        // Função para excluir o técnico
        const deleteHandler = () => {
            const storedData = JSON.parse(localStorage.getItem("dados_agenda_tecnicos")) || {};
            const currentKey = getAgendaKey(); // Chave do mês/ano atual

            // Verifica se o técnico existe no localStorage
            if (storedData[technician.omie]) {

                // Verifica se o técnico tem agendas e remove a agenda do mês atual
                if (storedData[technician.omie]?.agendas?.[currentKey]) {
                    delete storedData[technician.omie].agendas[currentKey];
                }

                // Atualiza no localStorage
                localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(storedData));

                // Remove o técnico da visualização
                loadTechniciansFromLocalStorage();

                // Atualiza na nuvem (removendo o técnico)
                deletar(`dados_agenda_tecnicos/${technician.omie}/agendas/${currentKey}`);

                // Fecha o modal de confirmação de exclusão
                deleteModal.style.display = "none";
                modal.style.display = "none"; // Fecha o modal de edição
            }
        };

        // Função para cancelar a exclusão
        const cancelDeleteHandler = () => {
            // Fecha o modal de confirmação de exclusão
            deleteModal.style.display = "none";
        };

        // Adiciona os event listeners para os botões
        confirmBtn.addEventListener("click", confirmHandler);
        deleteBtn.addEventListener("click", openDeleteModal); // Abre o modal de exclusão
        confirmDeleteBtn.addEventListener("click", deleteHandler); // Confirma a exclusão
        cancelDeleteBtn.addEventListener("click", cancelDeleteHandler); // Cancela a exclusão
    }

    async function atualizarDados() {
        showLoading(); // Exibe o indicador de carregamento

        try {
            const data = await receber("dados_agenda_tecnicos");
            console.log(data)

            // 🔥 Verifica se os dados são válidos
            if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
                hideLoading();
                loadTechniciansFromLocalStorage(); // Mantém os dados locais
                return;
            }

            // 🔥 Atualiza os dados garantindo que cada técnico tenha uma região associada
            Object.keys(data).forEach((technicianOmie) => {
                if (!data[technicianOmie].regiao_atual) {
                    data[technicianOmie].regiao_atual = regionSelect.value;
                }
            });

            // Salva no localStorage como um objeto indexado por `omie`
            localStorage.setItem("dados_agenda_tecnicos", JSON.stringify(data));

            hideLoading();
            generateCalendar(yearSelect.value, monthSelect.value); // Atualiza o calendário
            loadTechniciansFromLocalStorage(); // Monta a tabela
        } catch (error) {
            hideLoading();
            showPopup("Erro ao buscar dados. Verifique sua conexão.");
            loadTechniciansFromLocalStorage(); // Mantém os dados locais
        }
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
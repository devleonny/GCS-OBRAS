function novoTicket() {
    // Criar overlay do popup
    const overlay = document.createElement('div');
    overlay.className = 'ticket-overlay';

    // Criar container do popup
    const popup = document.createElement('div');
    popup.className = 'ticket-popup';

    // HTML do formulário
    popup.innerHTML = `
        <div class="ticket-header">
            <h2 class="ticket-title">Novo Ticket</h2>
            <p class="ticket-subtitle">Descreva seu problema ou solicitação</p>
            <button id="close-ticket-popup" class="ticket-close-btn">&times;</button>
        </div>
        
        <form id="ticket-form" class="ticket-form">
            <div class="ticket-field">
                <label for="ticket-titulo" class="ticket-label">Título</label>
                <input type="text" id="ticket-titulo" name="titulo" required 
                       class="ticket-input"
                       placeholder="Descreva brevemente o problema">
            </div>

            <div class="ticket-field-row">
                <div class="ticket-field-half">
                    <label for="ticket-prioridade" class="ticket-label">Prioridade</label>
                    <select id="ticket-prioridade" name="prioridade" required class="ticket-select">
                        <option value="">Selecionar</option>
                        <option value="baixa">🟢 Baixa</option>
                        <option value="media">🟡 Média</option>
                        <option value="alta">🟠 Alta</option>
                        <option value="critica">🔴 Crítica</option>
                    </select>
                </div>

                <div class="ticket-field-half">
                    <label for="ticket-categoria" class="ticket-label">Categoria</label>
                    <select id="ticket-categoria" name="categoria" required class="ticket-select">
                        <option value="">Selecionar</option>
                        <option value="bug">🐛 Bug/Erro</option>
                        <option value="feature">✨ Nova Funcionalidade</option>
                        <option value="suporte">🛠️ Suporte Técnico</option>
                        <option value="duvida">❓ Dúvida</option>
                        <option value="melhoria">📈 Melhoria</option>
                    </select>
                </div>
            </div>

            <div class="ticket-field">
                <label for="ticket-local" class="ticket-label">Local do Problema</label>
                <input type="text" id="ticket-local" name="local" 
                       class="ticket-input"
                       placeholder="Ex: Orçamento, Criar Orçamento, Relatórios, Login...">
            </div>

            <div class="ticket-field">
                <label for="ticket-descricao" class="ticket-label">Descrição</label>
                <textarea id="ticket-descricao" name="descricao" required rows="4"
                          class="ticket-textarea"
                          placeholder="Descreva detalhadamente o problema ou solicitação..."></textarea>
            </div>

            <div class="ticket-buttons">
                <button type="button" id="cancelar-ticket" class="ticket-btn ticket-btn-cancel">
                    Cancelar
                </button>
                <button type="submit" class="ticket-btn ticket-btn-submit">
                    Criar Ticket
                </button>
            </div>
        </form>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Event listeners
    const closeBtn = document.getElementById('close-ticket-popup');
    const cancelBtn = document.getElementById('cancelar-ticket');
    const form = document.getElementById('ticket-form');

    // Fechar popup
    function fecharPopup() {
        document.body.removeChild(overlay);
    }

    closeBtn.addEventListener('click', fecharPopup);
    cancelBtn.addEventListener('click', fecharPopup);

    // Fechar ao clicar no overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            fecharPopup();
        }
    });

    // Submeter formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('.ticket-btn-submit');
        submitBtn.innerHTML = 'Criando...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(form);
            const ticketId = gerarUUID();
            const ticketData = {
                id: ticketId,
                titulo: formData.get('titulo'),
                prioridade: formData.get('prioridade'),
                categoria: formData.get('categoria'),
                local: formData.get('local'),
                descricao: formData.get('descricao'),
                status: 'não iniciado',
                dataAbertura: new Date().toLocaleString('pt-BR'),
                dataConclusao: '',
                usuario: obterNomeUsuario(),
                tabela: 'tickets',
                timestamp: Date.now()
            };

            console.log('Novo ticket criado:', ticketData);

            await salvarTicket(ticketData);
            await carregarTickets();

            submitBtn.innerHTML = '✓ Criado!';
            submitBtn.classList.add('ticket-btn-success');

            setTimeout(() => {
                fecharPopup();
            }, 1000);

        } catch (error) {
            console.error('Erro ao criar ticket:', error);

            submitBtn.innerHTML = '❌ Erro ao criar';
            submitBtn.classList.add('ticket-btn-error');
            submitBtn.disabled = false;

            setTimeout(() => {
                submitBtn.innerHTML = 'Criar Ticket';
                submitBtn.classList.remove('ticket-btn-error');
            }, 2000);
        }
    });

    setTimeout(() => {
        document.getElementById('ticket-titulo').focus();
    }, 100);
}

// Função para gerar UUID
function gerarUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Função para obter nome do usuário
function obterNomeUsuario() {
    try {
        const acesso = JSON.parse(localStorage.getItem('acesso')) || {};
        return acesso.nome_completo || acesso.nome || 'Usuário Atual';
    } catch (error) {
        console.error('Erro ao obter nome do usuário:', error);
        return 'Usuário Atual';
    }
}

// Função para verificar se usuário é admin
function isAdmin() {
    try {
        const acesso = JSON.parse(localStorage.getItem('acesso')) || {};
        return acesso.permissao === 'adm';
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        return false;
    }
}

// Função para excluir ticket
async function excluirTicket(ticketId) {
    if (!isAdmin()) {
        alert('Apenas administradores podem excluir tickets.');
        return;
    }

    if (!confirm('Tem certeza que deseja excluir este ticket?')) {
        return;
    }

    try {
        let dados_tickets = {};

        if (typeof recuperarDados === 'function') {
            dados_tickets = await recuperarDados('dados_tickets') || {};
        } else {
            dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        }

        if (dados_tickets[ticketId]) {
            delete dados_tickets[ticketId];

            if (typeof inserirDados === 'function' && typeof enviar === 'function') {
                await inserirDados(dados_tickets, 'dados_tickets');
                // Remover do servidor também
                if (typeof remover === 'function') {
                    await remover(`dados_tickets/${ticketId}`);
                }
            } else {
                localStorage.setItem('dados_tickets', JSON.stringify(dados_tickets));
            }

            console.log('Ticket excluído:', ticketId);
            await carregarTickets();
        }

    } catch (error) {
        console.error('Erro ao excluir ticket:', error);
        alert('Erro ao excluir ticket. Tente novamente.');
    }
}

// Função para salvar ticket
async function salvarTicket(ticketData) {
    try {
        if (typeof recuperarDados === 'function' && typeof inserirDados === 'function' && typeof enviar === 'function') {
            let dados_tickets = await recuperarDados('dados_tickets') || {};
            dados_tickets[ticketData.id] = ticketData;
            await inserirDados(dados_tickets, 'dados_tickets');
            await enviar(`dados_tickets/${ticketData.id}`, ticketData);
        } else {
            salvarTicketLocal(ticketData);
        }

        console.log('Ticket salvo com sucesso:', ticketData);

    } catch (error) {
        console.error('Erro ao salvar ticket:', error);
        salvarTicketLocal(ticketData);
        throw error;
    }
}

// Função auxiliar para salvar no localStorage
function salvarTicketLocal(ticketData) {
    try {
        let tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        tickets[ticketData.id] = ticketData;
        localStorage.setItem('dados_tickets', JSON.stringify(tickets));
        console.log('Ticket salvo localmente:', ticketData);
    } catch (error) {
        console.error('Erro ao salvar ticket localmente:', error);
    }
}

// Função para atualizar status do ticket
async function atualizarStatusTicket(ticketId, novoStatus) {
    try {
        let dados_tickets = {};

        if (typeof recuperarDados === 'function') {
            dados_tickets = await recuperarDados('dados_tickets') || {};
        } else {
            dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        }

        if (dados_tickets[ticketId]) {
            dados_tickets[ticketId].status = novoStatus;

            if (novoStatus === 'finalizado') {
                dados_tickets[ticketId].dataConclusao = new Date().toLocaleString('pt-BR');
            } else {
                dados_tickets[ticketId].dataConclusao = '';
            }

            if (typeof inserirDados === 'function' && typeof enviar === 'function') {
                await inserirDados(dados_tickets, 'dados_tickets');
                await enviar(`dados_tickets/${ticketId}`, dados_tickets[ticketId]);
            } else {
                localStorage.setItem('dados_tickets', JSON.stringify(dados_tickets));
            }

            console.log('Status do ticket atualizado:', ticketId, novoStatus);
            await carregarTickets();
        }

    } catch (error) {
        console.error('Erro ao atualizar status do ticket:', error);
    }
}

// Função para definir cores dos status
function coresStatus(status) {
    let coresStatus = {
        'não iniciado': '#B12425',
        'em andamento': '#e96300',
        'aguardando': '#24729d',
        'finalizado': '#4CAF50',
        'cancelado': '#666666'
    }

    return coresStatus[status] || '#938e28';
}

// Função para definir cores das prioridades
function coresPrioridade(prioridade) {
    let coresPrioridade = {
        'baixa': '#4CAF50',
        'media': '#FF9800',
        'alta': '#FF5722',
        'critica': '#F44336'
    }

    return coresPrioridade[prioridade] || '#938e28';
}

// Função para carregar tickets
async function carregarTickets() {
    try {
        console.log('Iniciando carregamento de tickets...');

        let dados_tickets = {};

        if (typeof recuperarDados === 'function') {
            dados_tickets = await recuperarDados('dados_tickets') || {};
        } else {
            dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        }

        console.log('Dados dos tickets carregados:', dados_tickets);

        let tabelas = { TODOS: { linhas: '', count: 0 } };

        if (Object.keys(dados_tickets).length === 0) {
            document.getElementById('tabelaRegistro').innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; padding: 5vw;">
                    <label class="novo_titulo">Nenhum ticket encontrado. Crie seu primeiro ticket!</label>
                </div>
            `;
            return;
        }

        // Verificar se usuário é admin para mostrar coluna de excluir
        const mostrarExcluir = isAdmin();

        // Processar tickets
        for (let ticketId in dados_tickets) {
            let ticket = dados_tickets[ticketId];
            let status = ticket.status || 'não iniciado';

            if (!tabelas[status]) {
                tabelas[status] = { linhas: '', count: 0 };
            }

            let prioridadeIcon = '';
            switch (ticket.prioridade) {
                case 'baixa': prioridadeIcon = '🟢'; break;
                case 'media': prioridadeIcon = '🟡'; break;
                case 'alta': prioridadeIcon = '🟠'; break;
                case 'critica': prioridadeIcon = '🔴'; break;
                default: prioridadeIcon = '⚪';
            }

            let categoriaIcon = '';
            switch (ticket.categoria) {
                case 'bug': categoriaIcon = '🐛'; break;
                case 'feature': categoriaIcon = '✨'; break;
                case 'suporte': categoriaIcon = '🛠️'; break;
                case 'duvida': categoriaIcon = '❓'; break;
                case 'melhoria': categoriaIcon = '📈'; break;
                default: categoriaIcon = '📋';
            }

            let dataConclusao = '';
            if (ticket.status === 'finalizado' && ticket.dataConclusao) {
                dataConclusao = ticket.dataConclusao;
            }

            // Coluna de excluir apenas para admins
            let colunaExcluir = '';
            if (mostrarExcluir) {
                colunaExcluir = `
                    <td style="text-align: center;">
                        <img src="imagens/excluir.png" onclick="excluirTicket('${ticketId}')" 
                                                         style="cursor: pointer; width: 2vw;" title="Excluir ticket">
                    </td>
                `;
            }

            let linha = `
                <tr>
                    <td class="num">${ticketId.substring(0, 8)}...</td>
                    <td>${ticket.titulo}</td>
                    <td style="text-align: center;">
                        <span class="formato_status" style="background-color: ${coresPrioridade(ticket.prioridade)};">
                            ${prioridadeIcon} ${ticket.prioridade?.toUpperCase()}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        ${categoriaIcon} ${ticket.categoria}
                    </td>
                    <td>${ticket.local || '-'}</td>
                    <td>${ticket.usuario}</td>
                    <td style="text-align: center;">${ticket.dataAbertura}</td>
                    <td style="text-align: center;">${dataConclusao}</td>
                    <td style="text-align: center;">
                        <span class="formato_status" style="background-color: ${coresStatus(ticket.status)};">
                            ${ticket.status?.toUpperCase()}
                        </span>
                    </td>
                    ${colunaExcluir}
                </tr>
            `;

            tabelas[status].linhas += linha;
            tabelas[status].count++;
            tabelas.TODOS.linhas += linha;
            tabelas.TODOS.count++;
        }

        // Gerar toolbar
        let toolbar = '';
        for (let tabela in tabelas) {
            if (tabelas[tabela].count > 0) {
                toolbar += `
                    <div onclick="mostrarTabelaTickets('${tabela}', this)" 
                    style="background-color:${tabela === 'TODOS' ? '#d2d2d2' : '#797979'}; 
                    color: #222; 
                    display: flex; 
                    flex-direction: column;
                    justify-content: center; 
                    align-items: center; 
                    gap: 3px;
                    cursor: pointer;
                    padding: 10px;
                    font-size: 0.8vw;
                    color: #222;
                    border-top-left-radius: 5px;
                    border-top-right-radius: 5px;
                    ">

                        <label>${inicial_maiuscula(tabela)}</label>
                        <label style="text-align: center; background-color: ${tabela === 'TODOS' ? '#222' : '#3d3c3c'}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${tabelas[tabela].count}</label>

                    </div>
                `;
            }
        }

        // Gerar tabelas
        let tabelasHTML = '';
        let colunas = ['ID', 'Título', 'Prioridade', 'Categoria', 'Local', 'Usuário', 'Data Abertura', 'Data Conclusão', 'Status'];

        // Adicionar coluna Excluir apenas para admins
        if (mostrarExcluir) {
            colunas.push('Excluir');
        }

        let ths = '';
        let tsh = '';
        colunas.forEach((col, i) => {
            ths += `<th style="color: white; text-align: center;">${col}</th>`;

            if (col !== 'Excluir') {
                tsh += `
                    <th style="background-color: white; border-radius: 0px;">
                        <div style="position: relative;">
                            <input placeholder="..." style="text-align: left;" oninput="filtrarTickets(${i}, this.value)">
                            <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                        </div>
                    </th>
                `;
            } else {
                tsh += `<th style="background-color: white; border-radius: 0px;"></th>`;
            }
        });

        for (let tabela in tabelas) {
            if (tabelas[tabela].count > 0) {
                tabelasHTML += `
                    <table class="tabela" id="tickets_${tabela}" style="display: none;" class="tabela" style="font-size: 0.8vw;">
                        <thead>
                            <tr>${ths}</tr>
                            <tr id="tsh">${tsh}</tr>
                        </thead>
                        <tbody>
                            ${tabelas[tabela].linhas}
                        </tbody>
                    </table>
                `;
            }
        }

        document.getElementById('tabelaRegistro').innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: start;">
                <div id="toolbar" style="margin-left: 2vw; display: flex; width: 100%; align-items: center; justify-content: start; gap: 10px;">
                    ${toolbar}
                </div>
                <div class="tabela" id="tickets">
                    ${tabelasHTML}
                </div>
            </div>
        `;

        // Mostrar primeira tabela
        let primeiraTabelaComDados = Object.keys(tabelas).find(tabela => tabelas[tabela].count > 0);
        if (primeiraTabelaComDados) {
            setTimeout(() => {
                mostrarTabelaTickets(primeiraTabelaComDados);
            }, 100);
        }

    } catch (error) {
        console.error('Erro ao carregar tickets:', error);
        document.getElementById('tabelaRegistro').innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; padding: 5vw;">
                <label class="novo_titulo">Erro ao carregar tickets: ${error.message}</label>
            </div>
        `;
    }
}

// Função para mostrar tabela específica
function mostrarTabelaTickets(tabela, elemento) {
    console.log('Mostrando tabela:', tabela);

    let tabelas = document.querySelectorAll('#tickets table');
    tabelas.forEach(tab => {
        tab.style.display = 'none';
    });

    let tabelaSelecionada = document.getElementById(`tickets_${tabela}`);
    if (tabelaSelecionada) {
        tabelaSelecionada.style.display = 'table';
    }

    let toolbarItems = document.querySelectorAll('#toolbar .menu_top');
    toolbarItems.forEach(item => {
        item.style.opacity = '0.7';
    });

    if (elemento) {
        elemento.style.opacity = '1';
    }

    let nomeFilterElement = document.getElementById('nome_filtro');
    if (nomeFilterElement) {
        nomeFilterElement.textContent = tabela === 'TODOS' ? 'Todos os Tickets' : `Filtro: ${tabela}`;
    }
}

// Função para filtrar tickets (similar ao orcamentos.js)
function filtrarTickets(col, texto) {
    let tabelaAtiva = document.querySelector('#tickets table[style*="table"]');
    if (!tabelaAtiva) return;

    let tbody = tabelaAtiva.querySelector('tbody');
    let trs = tbody.querySelectorAll('tr');

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        let mostrarLinha = true;

        if (texto && col < tds.length) {
            let conteudoCelula = tds[col].textContent.toLowerCase();
            if (!conteudoCelula.includes(texto.toLowerCase())) {
                mostrarLinha = false;
            }
        }

        tr.style.display = mostrarLinha ? 'table-row' : 'none';
    });
}

// Função para abrir detalhes do ticket
function abrirTicket(ticketId) {
    console.log('Abrir ticket:', ticketId);
    alert(`Funcionalidade em desenvolvimento.\nTicket ID: ${ticketId}`);
}

// Carregar tickets ao inicializar
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM carregado, iniciando carregamento de tickets...');
    carregarTickets();
});


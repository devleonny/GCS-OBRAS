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
                desenvolvedor: '',
                usuario: obterNomeUsuario(),
                tabela: 'tickets',
                timestamp: Date.now()
            };

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

// Atualizar função editarTicket para usar busca assíncrona
function editarTicket(ticketId) {
    buscarTicketParaEdicao(ticketId).then(ticket => {
        if (ticket) {
            abrirPopupEdicao(ticketId, ticket);
        } else {
            alert('Ticket não encontrado!');
        }
    });
}

// Função para abrir popup de edição
function abrirPopupEdicao(ticketId, ticket) {
    if (!ticket) {
        alert('Ticket não encontrado!');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'ticket-overlay';

    const popup = document.createElement('div');
    popup.className = 'ticket-popup edit-popup';

    popup.innerHTML = `
        <div class="ticket-header">
            <h2 class="ticket-title">Editar Ticket</h2>
            <p class="ticket-subtitle">Alterar status, prioridade e desenvolvedor</p>
            <button id="close-edit-popup" class="ticket-close-btn">&times;</button>
        </div>
        
        <form id="edit-form" class="edit-form">
            <div class="edit-field">
                <label for="edit-status" class="edit-label">Status</label>
                <select id="edit-status" name="status" class="edit-select">
                    <option value="não iniciado" ${ticket.status === 'não iniciado' ? 'selected' : ''}>Não Iniciado</option>
                    <option value="em andamento" ${ticket.status === 'em andamento' ? 'selected' : ''}>Em Andamento</option>
                    <option value="aguardando" ${ticket.status === 'aguardando' ? 'selected' : ''}>Aguardando</option>
                    <option value="finalizado" ${ticket.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                    <option value="cancelado" ${ticket.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </div>

                        <div class="edit-field">
                <label for="edit-prioridade" class="edit-label">Prioridade</label>
                <select id="edit-prioridade" name="prioridade" class="edit-select">
                    <option value="baixa" ${ticket.prioridade === 'baixa' ? 'selected' : ''}>🟢 Baixa</option>
                    <option value="media" ${ticket.prioridade === 'media' ? 'selected' : ''}>🟡 Média</option>
                    <option value="alta" ${ticket.prioridade === 'alta' ? 'selected' : ''}>🟠 Alta</option>
                    <option value="critica" ${ticket.prioridade === 'critica' ? 'selected' : ''}>🔴 Crítica</option>
                </select>
            </div>

            <div class="edit-field">
                <label for="edit-desenvolvedor" class="edit-label">Desenvolvedor</label>
                <input type="text" id="edit-desenvolvedor" name="desenvolvedor" 
                       class="edit-input" value="${ticket.desenvolvedor || ''}"
                       placeholder="Nome do desenvolvedor responsável">
            </div>

            <div class="edit-buttons">
                <button type="button" id="cancelar-edit" class="edit-btn edit-btn-cancel">
                    Cancelar
                </button>
                <button type="submit" class="edit-btn edit-btn-save">
                    Salvar Alterações
                </button>
            </div>
        </form>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Event listeners
    const closeBtn = document.getElementById('close-edit-popup');
    const cancelBtn = document.getElementById('cancelar-edit');
    const form = document.getElementById('edit-form');

    function fecharPopup() {
        document.body.removeChild(overlay);
    }

    closeBtn.addEventListener('click', fecharPopup);
    cancelBtn.addEventListener('click', fecharPopup);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            fecharPopup();
        }
    });

    // Submeter formulário de edição
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('.edit-btn-save');
        submitBtn.innerHTML = 'Salvando...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(form);

            // Atualizar dados do ticket
            ticket.status = formData.get('status');
            ticket.prioridade = formData.get('prioridade');
            ticket.desenvolvedor = formData.get('desenvolvedor');

            // Atualizar data de conclusão se finalizado
            if (ticket.status === 'finalizado') {
                ticket.dataConclusao = new Date().toLocaleString('pt-BR');
            } else {
                ticket.dataConclusao = '';
            }

            await salvarTicketEditado(ticketId, ticket);
            await carregarTickets();

            submitBtn.innerHTML = '✓ Salvo!';
            submitBtn.classList.add('ticket-btn-success');

            setTimeout(() => {
                fecharPopup();
            }, 1000);

        } catch (error) {
            console.error('Erro ao salvar ticket:', error);

            submitBtn.innerHTML = '❌ Erro ao salvar';
            submitBtn.classList.add('ticket-btn-error');
            submitBtn.disabled = false;

            setTimeout(() => {
                submitBtn.innerHTML = 'Salvar Alterações';
                submitBtn.classList.remove('ticket-btn-error');
            }, 2000);
        }
    });
}

// Função para salvar ticket editado
async function salvarTicketEditado(ticketId, ticketData) {
    try {
        if (typeof recuperarDados === 'function' && typeof inserirDados === 'function' && typeof enviar === 'function') {
            let dados_tickets = await recuperarDados('dados_tickets') || {};
            dados_tickets[ticketId] = ticketData;
            await inserirDados(dados_tickets, 'dados_tickets');
            await enviar(`dados_tickets/${ticketId}`, ticketData);
        } else {
            let dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
            dados_tickets[ticketId] = ticketData;
            localStorage.setItem('dados_tickets', JSON.stringify(dados_tickets));
        }

    } catch (error) {
        console.error('Erro ao salvar ticket editado:', error);
        throw error;
    }
}

// Função para buscar dados do ticket para edição
async function buscarTicketParaEdicao(ticketId) {
    try {
        let dados_tickets = {};

        if (typeof recuperarDados === 'function') {
            dados_tickets = await recuperarDados('dados_tickets') || {};
        } else {
            dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        }

        return dados_tickets[ticketId];

    } catch (error) {
        console.error('Erro ao buscar ticket:', error);
        return null;
    }
}

// Atualizar função mostrarDetalhesTicket para usar busca assíncrona  
function mostrarDetalhesTicket(ticketId) {
    buscarTicketParaEdicao(ticketId).then(ticket => {
        if (ticket) {
            abrirPopupDetalhes(ticket);
        } else {
            alert('Ticket não encontrado!');
        }
    });
}

// Função para abrir popup de detalhes
function abrirPopupDetalhes(ticket) {
    if (!ticket) {
        alert('Ticket não encontrado!');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'ticket-overlay';

    const popup = document.createElement('div');
    popup.className = 'ticket-popup';

    // Ícones para categorias
    let categoriaIcon = '';
    switch (ticket.categoria) {
        case 'bug': categoriaIcon = '🐛'; break;
        case 'feature': categoriaIcon = '✨'; break;
        case 'suporte': categoriaIcon = '🛠️'; break;
        case 'duvida': categoriaIcon = '❓'; break;
        case 'melhoria': categoriaIcon = '📈'; break;
        default: categoriaIcon = '📋';
    }

    popup.innerHTML = `
        <div class="ticket-header">
            <h2 class="ticket-title">Detalhes do Ticket</h2>
            <p class="ticket-subtitle">Informações completas</p>
            <button id="close-details-popup" class="ticket-close-btn">&times;</button>
        </div>
        
        <div class="ticket-details">
            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Título</div>
                <div class="ticket-detail-value">${ticket.titulo}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Descrição</div>
                <div class="ticket-detail-value">${ticket.descricao}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Status</div>
                <div class="ticket-detail-value">${ticket.status?.toUpperCase()}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Prioridade</div>
                <div class="ticket-detail-value">${ticket.prioridade?.toUpperCase()}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Categoria</div>
                <div class="ticket-detail-value">${categoriaIcon} ${ticket.categoria}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Local do Problema</div>
                <div class="ticket-detail-value">${ticket.local || 'Não informado'}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Usuário Solicitante</div>
                <div class="ticket-detail-value">${ticket.usuario}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Desenvolvedor Responsável</div>
                <div class="ticket-detail-value">${ticket.desenvolvedor || 'Não atribuído'}</div>
            </div>

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Data de Abertura</div>
                <div class="ticket-detail-value">${ticket.dataAbertura}</div>
            </div>

            ${ticket.dataConclusao ? `
            <div class="ticket-detail-item">
                <div class="ticket-detail-label">Data de Conclusão</div>
                <div class="ticket-detail-value">${ticket.dataConclusao}</div>
            </div>
            ` : ''}

            <div class="ticket-detail-item">
                <div class="ticket-detail-label">ID do Ticket</div>
                <div class="ticket-detail-value" style="font-family: monospace; font-size: 0.8rem;">${ticket.id}</div>
            </div>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Event listener para fechar
    const closeBtn = document.getElementById('close-details-popup');

    function fecharPopup() {
        document.body.removeChild(overlay);
    }

    closeBtn.addEventListener('click', fecharPopup);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            fecharPopup();
        }
    });
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
                if (typeof remover === 'function') {
                    await remover(`dados_tickets/${ticketId}`);
                }
            } else {
                localStorage.setItem('dados_tickets', JSON.stringify(dados_tickets));
            }

            await carregarTickets();
        }

    } catch (error) {
        console.error('Erro ao excluir ticket:', error);
        openPopup_v2('Erro ao excluir ticket. Tente novamente.');
    }
}

// Função para salvar ticket usando as funções do sistema
async function salvarTicket(ticketData) {
    try {
        // Usar as mesmas funções do sistema existente
        if (typeof recuperarDados === 'function' && typeof inserirDados === 'function' && typeof enviar === 'function') {
            let dados_tickets = await recuperarDados('dados_tickets') || {};
            dados_tickets[ticketData.id] = ticketData;
            await inserirDados(dados_tickets, 'dados_tickets');
            await enviar(`dados_tickets/${ticketData.id}`, ticketData);
        } else {
            // Fallback para localStorage
            let tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
            tickets[ticketData.id] = ticketData;
            localStorage.setItem('dados_tickets', JSON.stringify(tickets));
        }

    } catch (error) {
        console.error('Erro ao salvar ticket:', error);
        // Fallback para localStorage em caso de erro
        let tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        tickets[ticketData.id] = ticketData;
        localStorage.setItem('dados_tickets', JSON.stringify(tickets));
        throw error;
    }
}

// Função auxiliar para salvar no localStorage
function salvarTicketLocal(ticketData) {
    try {
        let tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        tickets[ticketData.id] = ticketData;
        localStorage.setItem('dados_tickets', JSON.stringify(tickets));
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

            // Definir desenvolvedor quando status muda para "em andamento"
            if (novoStatus === 'em andamento') {
                const acesso = JSON.parse(localStorage.getItem('acesso')) || {};
                if (acesso.permissao === 'adm' && acesso.usuario) {
                    dados_tickets[ticketId].desenvolvedor = acesso.usuario;
                }
            }

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

// Função para carregar tickets seguindo padrão do sistema
async function carregarTickets() {
    try {
        let dados_tickets = {};

        // Usar as mesmas funções do sistema existente
        if (typeof recuperarDados === 'function') {
            dados_tickets = await recuperarDados('dados_tickets') || {};
        } else {
            dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        }

        let div_tickets = document.getElementById('tabelaRegistro');
        if (!div_tickets) {
            return;
        }

        if (Object.keys(dados_tickets).length === 0) {
            div_tickets.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; padding: 5vw;">
                    <label class="novo_titulo">Nenhum ticket encontrado. Crie seu primeiro ticket!</label>
                </div>
            `;
            return;
        }

        // Ordenar por data (seguindo padrão do sistema)
        let desordenado = Object.entries(dados_tickets);
        desordenado.sort((a, b) => {
            let dataA = new Date(a[1].dataAbertura || 0);
            let dataB = new Date(b[1].dataAbertura || 0);
            return dataB - dataA;
        });
        dados_tickets = Object.fromEntries(desordenado);

        let linhas = '';
        const mostrarExcluir = isAdmin();

        for (let ticketId in dados_tickets) {
            let ticket = dados_tickets[ticketId];

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

            let colunaExcluir = '';
            if (mostrarExcluir) {
                colunaExcluir = `
                    <td style="text-align: center;">
                        <button class="action-btn" onclick="excluirTicket('${ticketId}')" title="Excluir ticket">
                            <img src="imagens/excluir.png" style="width: 18px;">
                        </button>
                    </td>
                `;
            }

            linhas += `
                <tr>
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
                    <td style="text-align: center;">${ticket.desenvolvedor || '-'}</td>
                    <td style="text-align: center;">${ticket.dataAbertura}</td>
                    <td style="text-align: center;">${dataConclusao}</td>
                    <td style="text-align: center;">${ticket.status?.toUpperCase()}</td>
                    <td style="text-align: center;">
                        <button class="action-btn" onclick="editarTicket('${ticketId}')" title="Editar ticket">
                            <img src="imagens/editar.png" style="width: 18px;">
                        </button>
                    </td>
                    <td style="text-align: center;">
                        <button class="action-btn" onclick="mostrarDetalhesTicket('${ticketId}')" title="Ver detalhes">
                            <img src="imagens/pesquisar2.png" style="width: 18px;">
                        </button>
                    </td>
                    ${colunaExcluir}
                </tr>
            `;
        }

        // Seguir padrão do orcamentos.js
        let colunas = ['Título', 'Prioridade', 'Categoria', 'Local', 'Usuário', 'Desenvolvedor', 'Data Abertura', 'Data Conclusão', 'Status', 'Editar', 'Detalhes'];

        if (mostrarExcluir) {
            colunas.push('Excluir');
        }

        let ths = '';
        let tsh = '';
        colunas.forEach((col, i) => {
            ths += `<th style="text-align: center;">${col}</th>`;

            if (col !== 'Excluir' && col !== 'Editar' && col !== 'Detalhes') {
                tsh += `
                    <th style="background-color: white; border-radius: 0px;">
                        <div style="position: relative;">
                            <input placeholder="..." style="text-align: left;" oninput="filtrarTickets(undefined, ${i}, this.value)">
                            <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                        </div>
                    </th>
                `;
            } else {
                tsh += `<th style="background-color: white; border-radius: 0px;"></th>`;
            }
        });

        if (linhas !== '') {
            let linhas_tickets = document.getElementById('linhas_tickets');

            if (linhas_tickets) {
                linhas_tickets.innerHTML = linhas;
            } else {
                div_tickets.innerHTML = '';
                let tabela = `
                    <div id="tabelas" style="display: flex; flex-direction: column; align-items: center; justify-content: start;">
                        <div id="toolbar"></div>
                        <div id="tickets" style="max-height: 70vh; height: max-content; width: 90vw; overflow-y: auto;">
                            <table id="tickets_" class="tabela" style="font-size: 0.8vw;">
                                <thead>
                                    <tr>${ths}</tr>
                                    <tr id="tsh">${tsh}</tr>
                                </thead>
                                <tbody id="linhas_tickets">
                                    ${linhas}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                div_tickets.insertAdjacentHTML('beforeend', tabela);
            }

            filtrarTickets('TODOS');
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

// Função para carregar tickets com debug
// async function carregarTickets() {
//     try {
//         let dados_tickets = {};

//         // Tentar diferentes métodos de carregamento
//         dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
//         dados_tickets = await recuperarDados('dados_tickets');
//         await sincronizarDados('dados_tickets');

//         // Se ainda estiver vazio, tentar buscar dados_orcamentos como referência
//         if (Object.keys(dados_tickets).length === 0) {
//             dados_tickets = criarDadosTesteSeNecessario();
//         }

//         let div_tickets = document.getElementById('tabelaRegistro');
//         if (!div_tickets) {
//             console.error('Elemento tabelaRegistro não encontrado!');
//             return;
//         }

//         if (Object.keys(dados_tickets).length === 0) {
//             div_tickets.innerHTML = `
//                 <div style="display: flex; justify-content: center; align-items: center; padding: 5vw;">
//                     <label class="novo_titulo">Nenhum ticket encontrado. Crie seu primeiro ticket!</label>
//                 </div>
//             `;
//             return;
//         }

//         // Continuar com a renderização...
//         renderizarTabelaTickets(dados_tickets, div_tickets);

//     } catch (error) {
//         console.error('Erro ao carregar tickets:', error);
//         console.error('Stack trace:', error.stack);

//         document.getElementById('tabelaRegistro').innerHTML = `
//             <div style="display: flex; justify-content: center; align-items: center; padding: 5vw;">
//                 <label class="novo_titulo">Erro ao carregar tickets: ${error.message}</label>
//             </div>
//         `;
//     }
// }

// Função para filtrar tickets seguindo padrão do sistema
function filtrarTickets(ultimo_status, col, texto, apenas_toolbar) {
    if (!window.filtrosAtivosTickets) {
        window.filtrosAtivosTickets = {};
    }

    let filtro;

    if (ultimo_status !== undefined) {
        filtro = ultimo_status;
    }

    if (col !== undefined) {
        window.filtrosAtivosTickets[col] = String(texto).toLowerCase();
    }

    let linhas_tickets = document.getElementById('linhas_tickets');
    if (!linhas_tickets) return;

    let contadores = {
        TODOS: 0,
        listas: ['TODOS']
    };

    let trs = linhas_tickets.querySelectorAll('tr');

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        if (tds.length === 0) return;

        // Status está na coluna 8 (apenas texto agora)
        let status = tds[8].textContent.toLowerCase().trim();

        let mostrarLinha = true;

        // Aplicar filtros de texto
        for (let col in window.filtrosAtivosTickets) {
            let filtroTexto = window.filtrosAtivosTickets[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent;
                let conteudoCelula = element.value ? element.value : element;
                let texto_campo = String(conteudoCelula).toLowerCase();

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        // Aplicar filtro de status
        if (filtro !== undefined) {
            mostrarLinha = mostrarLinha && (status === filtro.toLowerCase() || filtro === 'TODOS');
        }

        contadores.listas.push(status);
        if (!contadores[status]) {
            contadores[status] = 0;
        }

        if (mostrarLinha || status !== filtro) {
            contadores[status]++;
        }

        if (filtro !== 'TODOS' || (filtro === 'TODOS' && mostrarLinha)) {
            contadores['TODOS']++;
        }

        mostrarLinha = mostrarLinha && !apenas_toolbar;
        tr.style.display = mostrarLinha ? 'table-row' : 'none';
    });

    // Atualizar toolbar seguindo padrão do sistema
    let toolbar = document.getElementById('toolbar');
    if (toolbar) {
        toolbar.innerHTML = '';
        contadores.listas = [...new Set(contadores.listas)];

        let temp_fluxograma = {
            'TODOS': {},
            'não iniciado': {},
            'em andamento': {},
            'aguardando': {},
            'finalizado': {},
            'cancelado': {}
        };

        for (let st in temp_fluxograma) {
            if (contadores.listas.includes(st.toLowerCase()) || st === 'TODOS') {
                let bg = '#797979';
                let bg2 = '#3d3c3c';

                if ((filtro === st || (filtro === undefined && st === 'TODOS'))) {
                    bg = '#d2d2d2';
                    bg2 = '#222';
                }

                let label = `
                    <div onclick="filtrarTickets('${st}')" 
                        style="background-color:${bg}; 
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

                        <label>${inicial_maiuscula(st)}</label>
                        <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${contadores[st.toLowerCase()] || 0}</label>

                    </div>
                `;
                toolbar.insertAdjacentHTML('beforeend', label);
            }
        }
    }
}

// Função auxiliar para capitalizar primeira letra (seguindo padrão do sistema)
function inicial_maiuscula(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Função para atualizar tickets (similar ao recuperar_orcamentos)
async function recuperar_tickets() {
    if (typeof sincronizarDados === 'function') {
        await sincronizarDados('dados_tickets');
    }

    await carregarTickets();
}

// Função separada para renderizar a tabela
function renderizarTabelaTickets(dados_tickets, div_tickets) {
    // Ordenar por data
    let desordenado = Object.entries(dados_tickets);
    desordenado.sort((a, b) => {
        let dataA = new Date(a[1].dataAbertura || 0);
        let dataB = new Date(b[1].dataAbertura || 0);
        return dataB - dataA;
    });
    dados_tickets = Object.fromEntries(desordenado);

    let linhas = '';
    const mostrarExcluir = isAdmin();

    for (let ticketId in dados_tickets) {
        let ticket = dados_tickets[ticketId];

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

        let colunaExcluir = '';
        if (mostrarExcluir) {
            colunaExcluir = `
                <td style="text-align: center;">
                    <button class="action-btn" onclick="excluirTicket('${ticketId}')" title="Excluir ticket">
                        <img src="imagens/excluir.png" style="width: 18px;">
                    </button>
                </td>
            `;
        }

        linhas += `
            <tr>
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
                <td style="text-align: center;">${ticket.desenvolvedor || '-'}</td>
                <td style="text-align: center;">${ticket.dataAbertura}</td>
                <td style="text-align: center;">${dataConclusao}</td>
                <td style="text-align: center;">${ticket.status?.toUpperCase()}</td>
                <td style="text-align: center;">
                    <button class="action-btn" onclick="editarTicket('${ticketId}')" title="Editar ticket">
                        <img src="imagens/editar.png" style="width: 18px;">
                    </button>
                </td>
                <td style="text-align: center;">
                    <button class="action-btn" onclick="mostrarDetalhesTicket('${ticketId}')" title="Ver detalhes">
                        <img src="imagens/pesquisar2.png" style="width: 18px;">
                    </button>
                </td>
                ${colunaExcluir}
            </tr>
        `;
    }

    let colunas = ['Título', 'Prioridade', 'Categoria', 'Local', 'Usuário', 'Desenvolvedor', 'Data Abertura', 'Data Conclusão', 'Status', 'Editar', 'Detalhes'];

    if (mostrarExcluir) {
        colunas.push('Excluir');
    }

    let ths = '';
    let tsh = '';
    colunas.forEach((col, i) => {
        ths += `<th style="text-align: center;">${col}</th>`;

        if (col !== 'Excluir' && col !== 'Editar' && col !== 'Detalhes') {
            tsh += `
                <th style="background-color: white; border-radius: 0px;">
                    <div style="position: relative;">
                        <input placeholder="..." style="text-align: left;" oninput="filtrarTickets(undefined, ${i}, this.value)">
                        <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                    </div>
                </th>
            `;
        } else {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`;
        }
    });

    div_tickets.innerHTML = '';
    let tabela = `
        <div id="tabelas" style="display: flex; flex-direction: column; align-items: center; justify-content: start;">
            <div id="toolbar"></div>
            <div id="tickets" style="max-height: 70vh; height: max-content; width: 90vw; overflow-y: auto;">
                <table id="tickets_" class="tabela" style="font-size: 0.8vw;">
                    <thead>
                        <tr>${ths}</tr>
                        <tr id="tsh">${tsh}</tr>
                    </thead>
                    <tbody id="linhas_tickets">
                        ${linhas}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    div_tickets.insertAdjacentHTML('beforeend', tabela);

    filtrarTickets('TODOS');
}

// Verificar se as funções do sistema estão disponíveis no carregamento
document.addEventListener('DOMContentLoaded', function () {
    // Aguardar um pouco para garantir que todas as funções foram carregadas
    setTimeout(() => {
        carregarTickets();
    }, 500);
});

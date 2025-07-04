let desenvolvedores = {};
Object.keys(dados_setores)
    .filter(key => dados_setores[key].permissao === 'adm' && dados_setores[key].setor === 'SUPORTE')
    .map(key => desenvolvedores[key] = dados_setores[key]);

function novoTicket() {
    console.log('Usuários: ', dados_setores);

    let opcoesPrioridade = `
        <option value="">Selecionar</option>
        <option value="baixa">🟢 Baixa</option>
        <option value="media">🟡 Média</option>
        <option value="alta">🟠 Alta</option>
        <option value="critica">🔴 Crítica</option>
    `;

    let opcoesCategoria = `
        <option value="">Selecionar</option>
        <option value="bug">🐛 Bug/Erro</option>
        <option value="feature">✨ Nova Funcionalidade</option>
        <option value="suporte">🛠️ Suporte Técnico</option>
        <option value="duvida">❓ Dúvida</option>
        <option value="melhoria">📈 Melhoria</option>
        <option value="cadastrar item">➕ Cadastrar Item</option>
    `;

    let conteudo = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 20px; max-width: 500px;">
            <h3 style="margin: 0; color: #151749;">Novo Ticket</h3>
            <p style="margin: 0; color: #666;">Descreva seu problema ou solicitação</p>
            
            <form id="ticket-form" style="width: 100%; display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 600; color: #333;">Título</label>
                    <input type="text" id="ticket-titulo" name="titulo" required 
                           style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;"
                           placeholder="Descreva brevemente o problema">
                </div>

                <div style="display: flex; gap: 15px;">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                        <label style="font-weight: 600; color: #333;">Prioridade</label>
                        <select id="ticket-prioridade" name="prioridade" required 
                                style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
                            ${opcoesPrioridade}
                        </select>
                    </div>

                    <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                        <label style="font-weight: 600; color: #333;">Categoria</label>
                        <select id="ticket-categoria" name="categoria" required 
                                style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
                            ${opcoesCategoria}
                        </select>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 600; color: #333;">Local do Problema</label>
                    <input type="text" id="ticket-local" name="local" 
                           style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;"
                           placeholder="Ex: Orçamento, Criar Orçamento, Relatórios, Login...">
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 600; color: #333;">Descrição</label>
                    <textarea 
                        id="ticket-descricao" 
                        name="descricao" 
                        rows="4"
                        maxlength="1500"
                        style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; resize: vertical; font-family: inherit;"
                        placeholder="Descreva detalhadamente o problema ou solicitação... (máx. 1500 caracteres)"
                        required
                    ></textarea>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button type="button" onclick="removerPopup()" 
                            style="padding: 8px 20px; border: none; border-radius: 4px; background-color: #6c757d; color: white; font-weight: 600; cursor: pointer; min-width: 100px;">
                        Cancelar
                    </button>
                    <button type="submit" id="btn-criar-ticket"
                            style="padding: 8px 20px; border: none; border-radius: 4px; background-color: #151749; color: white; font-weight: 600; cursor: pointer; min-width: 100px;">
                        Criar Ticket
                    </button>
                </div>
            </form>
        </div>
    `;

    popup(conteudo, 'Novo Ticket');

    document.getElementById('ticket-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-criar-ticket');
        submitBtn.innerHTML = 'Criando...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(e.target);
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
            await recuperar_tickets();

            submitBtn.innerHTML = '✓ Criado!';
            submitBtn.style.backgroundColor = '#28a745';

            setTimeout(() => {
                removerPopup();
            }, 1000);

        } catch (error) {
            console.error('Erro ao criar ticket:', error);

            submitBtn.innerHTML = '❌ Erro ao criar';
            submitBtn.style.backgroundColor = '#dc3545';
            submitBtn.disabled = false;

            setTimeout(() => {
                submitBtn.innerHTML = 'Criar Ticket';
                submitBtn.style.backgroundColor = '#151749';
            }, 1000);
        }
    });

    setTimeout(() => {
        document.getElementById('ticket-titulo').focus();
    }, 100);
}

function abrirPopupEdicao(ticketId, ticket) {
    if (!ticket) {
        alert('Ticket não encontrado!');
        return;
    }

    let conteudo = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 20px; max-width: 400px;">
            <h3 style="margin: 0; color: #151749;">Editar Ticket</h3>
            <p style="margin: 0; color: #666;">Alterar status, prioridade e desenvolvedor</p>
            
            <form id="edit-form" style="width: 100%; display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 600; color: #333;">Status</label>
                    <select id="edit-status" name="status" 
                            style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
                        <option value="não iniciado" ${ticket.status === 'não iniciado' ? 'selected' : ''}>Não Iniciado</option>
                        <option value="em andamento" ${ticket.status === 'em andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="aguardando" ${ticket.status === 'aguardando' ? 'selected' : ''}>Aguardando</option>
                        <option value="finalizado" ${ticket.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                        <option value="cancelado" ${ticket.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 600; color: #333;">Prioridade</label>
                    <select id="edit-prioridade" name="prioridade" 
                            style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
                        <option value="baixa" ${ticket.prioridade === 'baixa' ? 'selected' : ''}>🟢 Baixa</option>
                        <option value="media" ${ticket.prioridade === 'media' ? 'selected' : ''}>🟡 Média</option>
                        <option value="alta" ${ticket.prioridade === 'alta' ? 'selected' : ''}>🟠 Alta</option>
                        <option value="critica" ${ticket.prioridade === 'critica' ? 'selected' : ''}>🔴 Crítica</option>
                    </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 600; color: #333;">Usuário</label>
                    <select id="edit-usuario" name="usuario" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;" required>
                        ${Object.values(dados_setores).map(user =>
        `<option value="${user.usuario}" ${ticket.usuario === user.usuario ? 'selected' : ''}>${user.usuario}</option>`
    ).join('')
        }
                    </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 600; color: #333;">Desenvolvedor</label>
                    <select id="edit-desenvolvedor" name="desenvolvedor" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
                        <option value="" ${!ticket.desenvolvedor ? 'selected' : ''}>Selecione o dev</option>
                        ${Object.values(desenvolvedores).map(dev =>
            `<option value="${dev.usuario}" ${ticket.desenvolvedor === dev.usuario ? 'selected' : ''}>${dev.usuario}</option>`
        ).join('')
        }
                    </select>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button type="button" onclick="removerPopup()" 
                            style="padding: 8px 20px; border: none; border-radius: 4px; background-color: #6c757d; color: white; font-weight: 600; cursor: pointer; min-width: 100px;">
                        Cancelar
                    </button>
                    <button type="submit" id="btn-salvar-ticket"
                            style="padding: 8px 20px; border: none; border-radius: 4px; background-color: #28a745; color: white; font-weight: 600; cursor: pointer; min-width: 100px;">
                        Salvar Alterações
                    </button>
                </div>
            </form>
        </div>
    `;

    popup(conteudo, 'Editar Ticket');

    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-salvar-ticket');
        submitBtn.innerHTML = 'Salvando...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(e.target);

            ticket.status = formData.get('status');
            ticket.prioridade = formData.get('prioridade');
            ticket.usuario = formData.get('usuario');
            ticket.desenvolvedor = formData.get('desenvolvedor');

            if (ticket.status === 'finalizado') {
                ticket.dataConclusao = new Date().toLocaleString('pt-BR');
            } else {
                ticket.dataConclusao = '';
            }

            await salvarTicketEditado(ticketId, ticket);
            await recuperar_tickets();

            submitBtn.innerHTML = '✓ Salvo!';
            submitBtn.style.backgroundColor = '#28a745';

            setTimeout(() => {
                removerPopup();
            }, 1000);
        } catch (error) {
            console.error('Erro ao salvar ticket:', error);

            submitBtn.innerHTML = '❌ Erro ao salvar';
            submitBtn.style.backgroundColor = '#dc3545';
            submitBtn.disabled = false;

            setTimeout(() => {
                submitBtn.innerHTML = 'Salvar Alterações';
                submitBtn.style.backgroundColor = '#28a745';
            }, 2000);
        }
    });
}

function abrirPopupDetalhes(ticket) {
    if (!ticket) {
        alert('Ticket não encontrado!');
        return;
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

    let conteudo = `
        <div style="display: flex; flex-direction: column; gap: 15px; padding: 20px; max-width: 500px;">
            <div style="text-align: center;">
                <h3 style="margin: 0; color: #151749;">Detalhes do Ticket</h3>
                <p style="margin: 5px 0 0 0; color: #666;">Informações completas</p>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                    <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Título</div>
                    <div style="color: #333; font-size: 0.9rem;">${ticket.titulo}</div>
                </div>

                <div style="padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                    <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Descrição</div>
                    <div style="color: #333; font-size: 0.9rem; line-height: 1.4;">${ticket.descricao}</div>
                                </div>

                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Status</div>
                        <div style="color: #333; font-size: 0.9rem;">${ticket.status?.toUpperCase()}</div>
                    </div>

                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Prioridade</div>
                        <div style="color: #333; font-size: 0.9rem;">${ticket.prioridade?.toUpperCase()}</div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Categoria</div>
                        <div style="color: #333; font-size: 0.9rem;">${categoriaIcon} ${ticket.categoria}</div>
                    </div>

                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Local</div>
                        <div style="color: #333; font-size: 0.9rem;">${ticket.local || 'Não informado'}</div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Usuário</div>
                        <div style="color: #333; font-size: 0.9rem;">${ticket.usuario}</div>
                    </div>

                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Desenvolvedor</div>
                        <div style="color: #333; font-size: 0.9rem;">${ticket.desenvolvedor || 'Não atribuído'}</div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Data Abertura</div>
                        <div style="color: #333; font-size: 0.9rem;">${ticket.dataAbertura}</div>
                    </div>

                    ${ticket.dataConclusao ? `
                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                        <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Data Conclusão</div>
                        <div style="color: #333; font-size: 0.9rem;">${ticket.dataConclusao}</div>
                    </div>
                    ` : `
                    <div style="flex: 1; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #ccc;">
                        <div style="font-weight: 600; color: #999; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">Data Conclusão</div>
                        <div style="color: #999; font-size: 0.9rem;">Não finalizado</div>
                    </div>
                    `}
                </div>

                <div style="padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #151749;">
                    <div style="font-weight: 600; color: #151749; margin-bottom: 5px; font-size: 0.8rem; text-transform: uppercase;">ID do Ticket</div>
                    <div style="color: #666; font-size: 0.8rem; font-family: monospace; word-break: break-all;">${ticket.id}</div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <button onclick="removerPopup()" 
                        style="padding: 8px 20px; border: none; border-radius: 4px; background-color: #151749; color: white; font-weight: 600; cursor: pointer; min-width: 100px;">
                    Fechar
                </button>
            </div>
        </div>
    `;

    popup(conteudo, 'Detalhes do Ticket');
}

function gerarUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function obterNomeUsuario() {
    try {
        if (typeof acesso !== 'undefined' && acesso) {
            return acesso.nome_completo || acesso.nome || 'Usuário Atual';
        }

        const acessoLocal = JSON.parse(localStorage.getItem('acesso')) || {};
        return acessoLocal.nome_completo || acessoLocal.nome || 'Usuário Atual';
    } catch (error) {
        console.error('Erro ao obter nome do usuário:', error);
        return 'Usuário Atual';
    }
}

function isAdmin() {
    try {
        if (typeof acesso !== 'undefined' && acesso && acesso.permissao) {
            return acesso.permissao === 'adm';
        }

        const acessoLocal = JSON.parse(localStorage.getItem('acesso')) || {};
        return acessoLocal.permissao === 'adm';
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        return false;
    }
}

async function excluirTicket(ticketId) {
    if (!isAdmin()) {
        popup(`
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
                <img src="imagens/cancel.png" style="width: 3vw;">
                <label>Apenas administradores podem excluir tickets.</label>
            </div>
        `, 'Acesso Negado');
        return;
    }

    let conteudo = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 20px;">
            <img src="gifs/alerta.gif" style="width: 3vw;">
            <label>Tem certeza que deseja excluir este ticket?</label>
            <div style="display: flex; gap: 10px;">
                <button onclick="removerPopup()" 
                        style="padding: 8px 20px; border: none; border-radius: 4px; background-color: #6c757d; color: white; font-weight: 600; cursor: pointer;">
                    Cancelar
                </button>
                <button onclick="confirmarExclusaoTicket('${ticketId}')" 
                        style="padding: 8px 20px; border: none; border-radius: 4px; background-color: #dc3545; color: white; font-weight: 600; cursor: pointer;">
                    Confirmar Exclusão
                </button>
            </div>
        </div>
    `;

    popup(conteudo, 'Confirmar Exclusão');
}

async function confirmarExclusaoTicket(ticketId) {
    try {
        let dados_tickets = {};

        if (typeof recuperarDados === 'function') {
            dados_tickets = await recuperarDados('dados_tickets') || {};
        } else {
            dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        }

        if (dados_tickets[ticketId]) {
            delete dados_tickets[ticketId];

            await inserirDados(dados_tickets, 'dados_tickets');
            await deletar(`dados_tickets/${ticketId}`);

            popup(`
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
                    <img src="imagens/concluido.png" style="width: 3vw;">
                    <label>Ticket excluído com sucesso!</label>
                </div>
            `, 'Sucesso');

            setTimeout(async () => {
                removerPopup();
                await recuperar_tickets();
            }, 300);
        }
    } catch (error) {
        console.error('Erro ao excluir ticket:', error);

        popup(`
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
                <img src="imagens/cancel.png" style="width: 3vw;">
                <label>Erro ao excluir ticket. Tente novamente.</label>
            </div>
        `, 'Erro');
    }
}

async function salvarTicket(ticketData) {
    try {
        if (typeof recuperarDados === 'function' && typeof inserirDados === 'function' && typeof enviar === 'function') {
            let dados_tickets = await recuperarDados('dados_tickets') || {};
            dados_tickets[ticketData.id] = ticketData;
            await inserirDados(dados_tickets, 'dados_tickets');
            await enviar(`dados_tickets/${ticketData.id}`, ticketData);
        } else {
            let tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
            tickets[ticketData.id] = ticketData;
            localStorage.setItem('dados_tickets', JSON.stringify(tickets));
        }

    } catch (error) {
        console.error('Erro ao salvar ticket:', error);
        let tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        tickets[ticketData.id] = ticketData;
        localStorage.setItem('dados_tickets', JSON.stringify(tickets));
        throw error;
    }
}

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

function editarTicket(ticketId) {
    buscarTicketParaEdicao(ticketId).then(ticket => {
        if (!ticket) {
            popup(`
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
                    <img src="imagens/cancel.png" style="width: 3vw;">
                    <label>Ticket não encontrado!</label>
                </div>
            `, 'Erro');
            return;
        }

        abrirPopupEdicao(ticketId, ticket);
    });
}

function mostrarDetalhesTicket(ticketId) {
    buscarTicketParaEdicao(ticketId).then(ticket => {
        if (!ticket) {
            popup(`
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
                    <img src="imagens/cancel.png" style="width: 3vw;">
                    <label>Ticket não encontrado!</label>
                </div>
            `, 'Erro');
            return;
        }

        abrirPopupDetalhes(ticket);
    });
}

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

function coresPrioridade(prioridade) {
    let coresPrioridade = {
        'baixa': '#4CAF50',
        'media': '#FF9800',
        'alta': '#FF5722',
        'critica': '#F44336'
    }

    return coresPrioridade[prioridade] || '#938e28';
}

async function carregarTickets() {
    try {
        let dados_tickets = {};

        if (typeof sincronizarDados === 'function') {
            await sincronizarDados('dados_tickets');
        }

        if (typeof recuperarDados === 'function') {
            dados_tickets = await recuperarDados('dados_tickets');
        } else {
            dados_tickets = JSON.parse(localStorage.getItem('dados_tickets') || '{}');
        }

        let div_tickets = document.getElementById('tabelaRegistro');
        if (!div_tickets) {
            console.error('Elemento tabelaRegistro não encontrado!');
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

        renderizarTabelaTickets(dados_tickets, div_tickets);
    } catch (error) {
        console.error('Erro ao carregar tickets:', error);
        console.error('Stack trace:', error.stack);

        document.getElementById('tabelaRegistro').innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; padding: 5vw;">
                <label class="novo_titulo">Erro ao carregar tickets: ${error.message}</label>
            </div>
        `;
    }
}

function renderizarTabelaTickets(dados_tickets, div_tickets) {
    let desordenado = Object.entries(dados_tickets);
    desordenado.sort((a, b) => {
        let dataA = new Date(a[1].dataAbertura || 0);
        let dataB = new Date(b[1].dataAbertura || 0);
        return dataB - dataA;
    });
    dados_tickets = Object.fromEntries(desordenado);

    let linhas = '';
    const mostrarExcluir = isAdmin();
    const mostrarEditar = isAdmin();

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

        let colunaEditar = '';
        if (mostrarEditar) {
            colunaEditar = `
                <td style="text-align: center;">
                    <img src="imagens/editar.png" onclick="editarTicket('${ticketId}')" 
                         style="cursor: pointer; width: 2vw;" title="Editar ticket">
                </td>
            `;
        }

        let colunaExcluir = '';
        if (mostrarExcluir) {
            colunaExcluir = `
                <td style="text-align: center;">
                    <img src="imagens/excluir.png" onclick="excluirTicket('${ticketId}')" 
                         style="cursor: pointer; width: 2vw;" title="Excluir ticket">
                </td>
            `;
        }

        linhas += `
            <tr>
                <td style="text-align: center;">#${ticket.id.substring(0, 8)}</td>
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
                <td style="text-align: center;">
                ${ticket.desenvolvedor ?
                `
                <p class="nome-desenvolvedor">${ticket.desenvolvedor}</p>
                <button 
                        class="ticket-contato-button"
                        onclick="mostrarContatoDesenvolvedor('${ticket.id}', '${ticket.usuario}')"
                    >
                    contato
                    </button>`
                : '-'}
                </td>
                <td style="text-align: center;">${ticket.dataAbertura}</td>
                <td style="text-align: center;">${dataConclusao}</td>
                <td style="text-align: center;">${ticket.status?.toUpperCase()}</td>
                <td style="text-align: center;">
                    <img src="imagens/pesquisar2.png" onclick="mostrarDetalhesTicket('${ticketId}')" 
                         style="cursor: pointer; width: 2vw;" title="Ver detalhes">
                </td>
                ${colunaEditar}
                ${colunaExcluir}
            </tr>
        `;
    }

    let colunas = ['ID', 'Título', 'Prioridade', 'Categoria', 'Local', 'Usuário', 'Desenvolvedor', 'Data Abertura', 'Data Conclusão', 'Status', 'Detalhes'];

    if (mostrarEditar) colunas.push('Editar');

    if (mostrarExcluir) colunas.push('Excluir');

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

async function mostrarContatoDesenvolvedor(ticketId, usuarioNome) {
    const linha = event.target.closest('tr');
    if (!linha) return;

    const desenvolvedorNome = linha.querySelector('.nome-desenvolvedor')?.textContent.trim();
    if (!desenvolvedorNome || desenvolvedorNome === '-') return;

    const devInfo = desenvolvedores[desenvolvedorNome];
    if (!devInfo) {
        popup(`
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
                <img src="imagens/cancel.png" style="width: 3vw;">
                <label>Informações do desenvolvedor não encontradas!</label>
            </div>
        `, 'Erro');
        return;
    }

    const mensagemPadrao = `
        Prezado ${desenvolvedorNome}, espero que esteja bem. Gostaria de tratar sobre o ticket #${ticketId}, aberto por ${usuarioNome}. Poderia, por gentileza, me auxiliar com este atendimento?
    `;

    const conteudo = `
        <div class="dev-contact-popup">
            <h3 class="popup-title">Contato do Desenvolvedor</h3>

            <div class="dev-info-container">
                <div class="info-row">
                    <span class="info-label">Nome:</span>
                    <span class="info-value">${devInfo.nome_completo || desenvolvedorNome}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">Cargo:</span>
                    <span class="info-value">${devInfo.setor || 'Desenvolvedor'}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">Telefone:</span>
                    <span class="info-value">${formatarTelefone(devInfo.telefone)}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${devInfo.email}</span>
                </div>
            </div>

            <div class="action-buttons">
                <button class="whatsapp-button" onclick="abrirWhatsApp('${devInfo.telefone}', '${encodeURIComponent(mensagemPadrao)}')">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" class="whatsapp-icon">
                    Enviar WhatsApp
                </button>
                
                <button class="copy-button" onclick="copiarParaAreaTransferencia('${devInfo.telefone}')">
                    Copiar Telefone
                </button>
            </div>
        </div>
    `;

    popup(conteudo, 'Contato do Desenvolvedor');
}

function abrirWhatsApp(telefone, mensagem) {
    const numero = telefone.replace(/\D/g, '');
    if (!numero) return;

    const url = `https://wa.me/55${numero}?text=${mensagem}`;
    window.open(url, '_blank');
    removerPopup();
}

function formatarTelefone(telefone) {
    if (!telefone) return 'Não informado';
    const nums = telefone.replace(/\D/g, '');
    if (nums.length === 11) {
        return `(${nums.substring(0, 2)}) ${nums.substring(2, 7)}-${nums.substring(7)}`;
    }
    return telefone;
}

function copiarParaAreaTransferencia(texto) {
    const input = document.createElement('input');
    input.value = texto.replace(/\D/g, '');
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);

    popup(`
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
            <img src="imagens/concluido.png" style="width: 2vw;">
            <label>Telefone copiado!</label>
        </div>
    `, 'Sucesso');

    setTimeout(removerPopup, 1500);
}

function filtrarTickets(ultimo_status, col, texto, apenas_toolbar) {
    if (!window.filtrosAtivosTickets) window.filtrosAtivosTickets = {};

    let filtro;
    if (ultimo_status !== undefined) filtro = ultimo_status;
    if (col !== undefined) window.filtrosAtivosTickets[col] = String(texto).toLowerCase();

    let linhas_tickets = document.getElementById('linhas_tickets');
    if (!linhas_tickets) return;

    let trs = linhas_tickets.querySelectorAll('tr');
    let contadores = { TODOS: 0, listas: ['TODOS'] };

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        if (tds.length === 0) return;
        let status = tds[9].textContent.toLowerCase().trim();
        if (!contadores.listas.includes(status)) contadores.listas.push(status);
        if (!contadores[status]) contadores[status] = 0;
    });

    let totaisPorStatus = {};
    contadores.listas.forEach(st => { if (st !== 'TODOS') totaisPorStatus[st] = 0; });
    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        if (tds.length === 0) return;
        let status = tds[9].textContent.toLowerCase().trim();
        if (status in totaisPorStatus) totaisPorStatus[status]++;
    });

    let totalAbsolutoTickets = trs.length;

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        if (tds.length === 0) return;
        let status = tds[9].textContent.toLowerCase().trim();
        let mostrarLinha = true;

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

        if (filtro !== undefined && filtro !== 'TODOS') {
            mostrarLinha = mostrarLinha && (status === filtro.toLowerCase());
        }

        if (mostrarLinha) contadores[status]++;

        tr.style.display = mostrarLinha ? 'table-row' : 'none';
    });

    contadores['TODOS'] = contadores.listas
        .filter(st => st !== 'TODOS')
        .reduce((acc, st) => acc + (contadores[st] || 0), 0);

    let toolbar = document.getElementById('toolbar');
    if (toolbar) {
        toolbar.innerHTML = '';
        let temp_fluxograma = {
            'TODOS': {},
            'não iniciado': {},
            'em andamento': {},
            'aguardando': {},
            'finalizado': {},
            'cancelado': {}
        };
        for (let st in temp_fluxograma) {
            if (contadores.listas.includes(st) || st === 'TODOS') {
                let bg = '#797979', bg2 = '#3d3c3c';
                if ((filtro === st || (filtro === undefined && st === 'TODOS'))) {
                    bg = '#d2d2d2'; bg2 = '#222';
                }
                let valor = (st === 'TODOS') ? totalAbsolutoTickets : totaisPorStatus[st] || 0;
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
                        border-top-right-radius: 5px;">
                        <label>${inicial_maiuscula(st)}</label>
                        <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${valor}</label>
                    </div>
                `;
                toolbar.insertAdjacentHTML('beforeend', label);
            }
        }
    }
}

async function recuperar_tickets() {
    await sincronizarDados('dados_tickets');
    await carregarTickets();
}

function inicial_maiuscula(str) {
    if (typeof str !== 'string') return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

document.addEventListener('DOMContentLoaded', async function () {
    setTimeout(async () => {
        await recuperar_tickets();
    }, 500);
});

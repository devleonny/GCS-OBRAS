// Variáveis globais para controle de tickets
let dadosTickets = {};
let filtrosAtivosTickets = {};

let permissao = dados_setores[acesso.usuario].permissao;

function novoTicket() {
    openPopup_v2(`
        <section style="padding: 20px; max-width: 600px;">
            <div style="display: flex; flex-direction: column; gap: 15px;">
                
                <div style="display: flex; flex-direction: column;">
                    <label style="font-weight: bold; margin-bottom: 5px; color: #333;">Título do Ticket *</label>
                    <input type="text" id="titulo-ticket" placeholder="Descreva brevemente o problema" 
                           style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>

                <div style="display: flex; flex-direction: column;">
                    <label style="font-weight: bold; margin-bottom: 5px; color: #333;">Módulo/Local *</label>
                    <select id="categoria-ticket" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="">Selecione o módulo</option>
                        <option value="ORCAMENTOS">Orçamentos</option>
                        <option value="COMPOSICOES">Composições</option>
                        <option value="ALUGUEL">Aluguel</option>
                        <option value="CHAMADOS">Chamados</option>
                        <option value="MANUTENCAO">Manutenção</option>
                        <option value="OBRAS">Obras</option>
                        <option value="CLIENTES">Clientes</option>
                        <option value="FORNECEDORES">Fornecedores</option>
                        <option value="ESTOQUE">Estoque</option>
                        <option value="FINANCEIRO">Financeiro</option>
                        <option value="RELATORIOS">Relatórios</option>
                        <option value="CONFIGURACOES">Configurações</option>
                        <option value="LOGIN">Login/Acesso</option>
                        <option value="SISTEMA_GERAL">Sistema Geral</option>
                        <option value="OUTROS">Outros</option>
                    </select>
                </div>

                <div style="display: flex; flex-direction: column;">
                    <label style="font-weight: bold; margin-bottom: 5px; color: #333;">Tipo de Problema</label>
                    <select id="tipo-problema" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="">Selecione o tipo</option>
                        <option value="BUG">Bug/Erro</option>
                        <option value="MELHORIA">Solicitação de Melhoria</option>
                        <option value="DUVIDA">Dúvida</option>
                        <option value="CONFIGURACAO">Problema de Configuração</option>
                        <option value="PERFORMANCE">Problema de Performance</option>
                        <option value="INTEGRACAO">Problema de Integração</option>
                        <option value="DADOS">Problema com Dados</option>
                        <option value="INTERFACE">Problema de Interface</option>
                    </select>
                </div>

                <div style="display: flex; flex-direction: column;">
                    <label style="font-weight: bold; margin-bottom: 5px; color: #333;">Prioridade</label>
                    <select id="prioridade-ticket" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="BAIXA">Baixa</option>
                        <option value="MEDIA" selected>Média</option>
                        <option value="ALTA">Alta</option>
                        <option value="URGENTE">Urgente</option>
                        <option value="CRITICA">Crítica</option>
                    </select>
                </div>

                <div style="display: flex; flex-direction: column;">
                    <label style="font-weight: bold; margin-bottom: 5px; color: #333;">Descrição Detalhada *</label>
                    <textarea id="descricao-ticket" placeholder="Descreva detalhadamente o problema, incluindo passos para reproduzir, mensagens de erro, etc." 
                              style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 90%; min-height: 120px; resize: vertical;"></textarea>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                    <button onclick="fecharPopup()" 
                            style="padding: 10px 20px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        Cancelar
                    </button>
                    <button onclick="criarTicket()" 
                            style="padding: 10px 20px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        Criar Ticket
                    </button>
                </div>

                <div style="margin-top: 10px;">
                    <small style="color: #666;">* Campos obrigatórios</small>
                </div>

            </div>
        </section>
    `,
    'Novo Ticket'
    );
}

// Função para gerar código único do ticket
function gerarCodigoTicket() {
    const timestamp = Date.now();
    const id = gerar_id_5_digitos();
    return `TK-${timestamp}-${id}`;
}

// Função para criar o ticket
async function criarTicket() {
    const titulo = document.getElementById('titulo-ticket').value.trim();
    const categoria = document.getElementById('categoria-ticket').value;
    const tipoProblema = document.getElementById('tipo-problema').value;
    const prioridade = document.getElementById('prioridade-ticket').value;
    const descricao = document.getElementById('descricao-ticket').value.trim();

    // Validação dos campos obrigatórios
    if (!titulo) {
        openPopup_v2('Por favor, preencha o título do ticket.');
        return;
    }

    if (!categoria) {
        openPopup_v2('Por favor, selecione o módulo/local.');
        return;
    }

    if (!descricao) {
        openPopup_v2('Por favor, preencha a descrição detalhada.');
        return;
    }

    // Criar objeto do ticket
    const novoTicket = {
        codigo: gerarCodigoTicket(),
        titulo: titulo,
        categoria: categoria,
        tipoProblema: tipoProblema || 'NÃO_ESPECIFICADO',
        prioridade: prioridade,
        descricao: descricao,
        status: 'NAO_INICIADO',
        criadoPor: localStorage.getItem('usuario_logado') || 'Usuario',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        podeEditar: false, // Será definido baseado nas permissões do usuário
        podeExcluir: true  // Criador sempre pode excluir inicialmente
    };

    try {
        // Carregar tickets existentes
        let ticketsExistentes = await recuperarDados('dados_tickets') || {};
        
        // Adicionar novo ticket
        ticketsExistentes[novoTicket.codigo] = novoTicket;
        
        // Salvar no banco de dados local
        await inserirDados(ticketsExistentes, 'dados_tickets');
        
        // Sincronizar com o servidor
        await sincronizarDados('dados_tickets');
        
        // Atualizar dados locais
        dadosTickets = ticketsExistentes;
        
        // Fechar popup
        fecharPopup();
        
        // Recarregar tabela se estiver na página de tickets
        if (typeof atualizarTabelaTickets === 'function') {
            atualizarTabelaTickets();
        }
        
        openPopup_v2('Ticket criado com sucesso!');

        console.log('Ticket criado:', novoTicket);
        
    } catch (error) {
        console.error('Erro ao criar ticket:', error);
        openPopup_v2('Erro ao criar ticket. Tente novamente.');
    }
}

// Função para carregar tickets do servidor
async function carregarTickets() {
    try {
        // Tentar carregar dados locais primeiro
        dadosTickets = await recuperarDados('dados_tickets') || {};
        
        // Se não houver dados locais, sincronizar com servidor
        if (Object.keys(dadosTickets).length === 0) {
            await sincronizarDados('dados_tickets');
            dadosTickets = await recuperarDados('dados_tickets') || {};
        }
        
        return dadosTickets;
    } catch (error) {
        console.error('Erro ao carregar tickets:', error);
        return {};
    }
}

// Função para atualizar status do ticket (apenas para admins)
async function atualizarStatusTicket(codigoTicket, novoStatus) {
    const usuarioLogado = localStorage.getItem('usuario_logado');
    const permissaoAdmin = localStorage.getItem('permissao_admin') === 'true';
    
    if (!permissaoAdmin) {
        alert('Apenas administradores podem alterar o status dos tickets.');
        return;
    }
    
    try {
        let tickets = await recuperarDados('dados_tickets') || {};
        
        if (tickets[codigoTicket]) {
            tickets[codigoTicket].status = novoStatus;
            tickets[codigoTicket].atualizadoEm = new Date().toISOString();
            tickets[codigoTicket].atualizadoPor = usuarioLogado;
            
            await inserirDados(tickets, 'dados_tickets');
            await sincronizarDados('dados_tickets');
            
            dadosTickets = tickets;
            
            if (typeof atualizarTabelaTickets === 'function') {
                atualizarTabelaTickets();
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert('Erro ao atualizar status do ticket.');
    }
}

// Função para atualizar prioridade do ticket (apenas para admins)
async function atualizarPrioridadeTicket(codigoTicket, novaPrioridade) {
    const usuarioLogado = localStorage.getItem('usuario_logado');
    const permissaoAdmin = localStorage.getItem('permissao_admin') === 'true';
    
    if (!permissaoAdmin) {
        alert('Apenas administradores podem alterar a prioridade dos tickets.');
        return;
    }
    
    try {
        let tickets = await recuperarDados('dados_tickets') || {};
        
        if (tickets[codigoTicket]) {
            tickets[codigoTicket].prioridade = novaPrioridade;
            tickets[codigoTicket].atualizadoEm = new Date().toISOString();
            tickets[codigoTicket].atualizadoPor = usuarioLogado;
            
            await inserirDados(tickets, 'dados_tickets');
            await sincronizarDados('dados_tickets');
            
            dadosTickets = tickets;
            
            if (typeof atualizarTabelaTickets === 'function') {
                atualizarTabelaTickets();
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar prioridade:', error);
        alert('Erro ao atualizar prioridade do ticket.');
    }
}

// Função para excluir ticket
async function excluirTicket(codigoTicket) {
    const usuarioLogado = localStorage.getItem('usuario_logado');
    const permissaoAdmin = localStorage.getItem('permissao_admin') === 'true';
    
    try {
        let tickets = await recuperarDados('dados_tickets') || {};
        const ticket = tickets[codigoTicket];
        
        if (!ticket) {
            alert('Ticket não encontrado.');
            return;
        }
        
        // Verificar permissões: apenas criador ou admin pode excluir
        if (ticket.criadoPor !== usuarioLogado && !permissaoAdmin) {
            alert('Você só pode excluir tickets criados por você.');
            return;
        }
        
        if (confirm(`Tem certeza que deseja excluir o ticket ${codigoTicket}?`)) {
            delete tickets[codigoTicket];
            
            await inserirDados(tickets, 'dados_tickets');
            await sincronizarDados('dados_tickets');
            
            dadosTickets = tickets;
            
            if (typeof atualizarTabelaTickets === 'function') {
                atualizarTabelaTickets();
            }
            
            alert('Ticket excluído com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao excluir ticket:', error);
        alert('Erro ao excluir ticket.');
    }
}

// Função para verificar permissões do usuário para um ticket específico
function verificarPermissoesTicket(ticket) {
    const usuarioLogado = localStorage.getItem('usuario_logado');
    const permissaoAdmin = localStorage.getItem('permissao_admin') === 'true';
    
    return {
        podeEditar: permissaoAdmin,
        podeExcluir: ticket.criadoPor === usuarioLogado || permissaoAdmin,
        podeAlterarStatus: permissaoAdmin,
        podeAlterarPrioridade: permissaoAdmin
    };
}

// Opções de status disponíveis
const statusTicket = {
    'NAO_INICIADO': 'Não Iniciado',
    'EM_ANDAMENTO': 'Em Andamento',
    'AGUARDANDO_FEEDBACK': 'Aguardando Feedback',
    'EM_TESTE': 'Em Teste',
    'RESOLVIDO': 'Resolvido',
    'FECHADO': 'Fechado',
    'CANCELADO': 'Cancelado'
};

// Opções de prioridade disponíveis
const prioridadeTicket = {
    'BAIXA': 'Baixa',
    'MEDIA': 'Média',
    'ALTA': 'Alta',
    'URGENTE': 'Urgente',
    'CRITICA': 'Crítica'
};

// Função para sincronizar tickets com o servidor
async function sincronizarTickets() {
    try {
        overlayAguarde();
        await sincronizar('tickets');
        let dadosTicketsServidor = await receber('dados_tickets');
        await inserirDados(dadosTicketsServidor, 'dados_tickets');
        dadosTickets = dadosTicketsServidor;
        remover_popup();
        return dadosTicketsServidor;
    } catch (error) {
        console.error('Erro ao sincronizar tickets:', error);
        remover_popup();
        return {};
    }
}

// Função para recuperar tickets do servidor
async function recuperarTickets() {
    await sincronizarDados('dados_tickets');
    await carregarTickets();
    if (typeof atualizarTabelaTickets === 'function') {
        atualizarTabelaTickets();
    }
}

// Função para filtrar tickets
function filtrarTickets(filtros = {}) {
    let ticketsFiltrados = { ...dadosTickets };
    
    // Filtro por status
    if (filtros.status && filtros.status !== 'TODOS') {
        ticketsFiltrados = Object.fromEntries(
            Object.entries(ticketsFiltrados).filter(([key, ticket]) => 
                ticket.status === filtros.status
            )
        );
    }
    
    // Filtro por prioridade
    if (filtros.prioridade && filtros.prioridade !== 'TODAS') {
        ticketsFiltrados = Object.fromEntries(
            Object.entries(ticketsFiltrados).filter(([key, ticket]) => 
                ticket.prioridade === filtros.prioridade
            )
        );
    }
    
    // Filtro por categoria
    if (filtros.categoria && filtros.categoria !== 'TODAS') {
        ticketsFiltrados = Object.fromEntries(
            Object.entries(ticketsFiltrados).filter(([key, ticket]) => 
                ticket.categoria === filtros.categoria
            )
        );
    }
    
    // Filtro por criador (meus tickets)
    if (filtros.meusTickers) {
        const usuarioLogado = localStorage.getItem('usuario_logado');
        ticketsFiltrados = Object.fromEntries(
            Object.entries(ticketsFiltrados).filter(([key, ticket]) => 
                ticket.criadoPor === usuarioLogado
            )
        );
    }
    
    return ticketsFiltrados;
}

// Função para obter cor da prioridade
function getCorPrioridade(prioridade) {
    const cores = {
        'BAIXA': '#28a745',
        'MEDIA': '#ffc107',
        'ALTA': '#fd7e14',
        'URGENTE': '#dc3545',
        'CRITICA': '#6f42c1'
    };
    return cores[prioridade] || '#6c757d';
}

// Função para obter cor do status
function getCorStatus(status) {
    const cores = {
        'NAO_INICIADO': '#6c757d',
        'EM_ANDAMENTO': '#007bff',
        'AGUARDANDO_FEEDBACK': '#ffc107',
        'EM_TESTE': '#17a2b8',
        'RESOLVIDO': '#28a745',
        'FECHADO': '#343a40',
        'CANCELADO': '#dc3545'
    };
    return cores[status] || '#6c757d';
}

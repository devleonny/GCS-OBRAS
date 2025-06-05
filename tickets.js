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
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const ticketData = {
            id: Date.now(),
            titulo: formData.get('titulo'),
            prioridade: formData.get('prioridade'),
            categoria: formData.get('categoria'),
            local: formData.get('local'),
            descricao: formData.get('descricao'),
            status: 'aberto',
            dataAbertura: new Date().toLocaleString('pt-BR'),
            usuario: 'Usuário Atual'
        };

        console.log('Novo ticket criado:', ticketData);
        salvarTicket(ticketData);
        
        // Feedback visual
        const submitBtn = e.target.querySelector('.ticket-btn-submit');
        submitBtn.innerHTML = '✓ Criado!';
        submitBtn.classList.add('ticket-btn-success');
        
        setTimeout(() => {
            fecharPopup();
        }, 1000);
    });

    // Focar no primeiro campo
    setTimeout(() => {
        document.getElementById('ticket-titulo').focus();
    }, 100);
}

// Função auxiliar para salvar o ticket
function salvarTicket(ticketData) {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    tickets.push(ticketData);
    localStorage.setItem('tickets', JSON.stringify(tickets));
}

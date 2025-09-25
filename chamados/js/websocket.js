let socket;
let reconnectInterval = 30000;

function connectWebSocket() {
    socket = new WebSocket(`${api}:8443`);

    socket.onopen = () => {
        if (acesso) socket.send(JSON.stringify({ tipo: 'autenticar', usuario: acesso.usuario }));
        console.log(`🟢🟢🟢 WS ${new Date().toLocaleString('pt-BR')} 🟢🟢🟢`);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.base == 'dados_ocorrencias' && acesso.usuario) {          
            const ocorrencia = dados_ocorrencias?.[data.id] || {}
            const idEmpresa = (data.objeto && data.objeto.empresa) ? data.objeto.empresa : ocorrencia?.empresa || ''
            const usuarioOcorrencia = (data.objeto && data.objeto.usuario) ? data.objeto.usuario : ocorrencia.usuario
            const solicitante = (data.objeto && data.objeto.solicitante) ? data.objeto.solicitante : ocorrencia.solicitante
            
            if (usuarioOcorrencia !== acesso.usuario) return
            
            notificacoes(`Chamado ${data.id} atualizado`, `${empresas?.[idEmpresa]?.nome || '??'} - Solicitado por ${solicitante || '??'}`)

        }

        if (data.base == 'dados_setores') {
            inserirDados({ [data.id]: data.objeto }, 'dados_setores')

            if (data.id == acesso.usuario) {
                localStorage.setItem('acesso', JSON.stringify(data.objeto))
                telaPrincipal()
                popup(mensagem('Seu acesso foi atualizado', 'imagens/concluido.png'), 'Alerta')
                inserirDados({}, 'dados_ocorrencias', true) // Reset na base;
            }
        }

        if (data.tipo == 'usuarios_online') localStorage.setItem('usuariosOnline', JSON.stringify(data.usuarios))

    };

    socket.onclose = () => {
        console.log(`🔴🔴🔴 WS ${new Date().toLocaleString('pt-BR')} 🔴🔴🔴`);
        console.log(`Tentando reconectar em ${reconnectInterval / 1000} segundos...`);
        setTimeout(connectWebSocket, reconnectInterval);
    };

}
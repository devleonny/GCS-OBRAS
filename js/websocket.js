let socket;
let reconnectInterval = 30000;
connectWebSocket();

function connectWebSocket() {
    socket = new WebSocket(`${api}:8443`)

    socket.onopen = () => {
        if (acesso) socket.send(JSON.stringify({ tipo: 'autenticar', usuario: acesso.usuario }))
        console.log(`🟢🟢🟢 WS ${new Date().toLocaleString()} 🟢🟢🟢`)
    }

    socket.onmessage = async (event) => {

        const data = JSON.parse(event.data)

        if (data.tabela == 'dados_orcamentos') {
            verificarPendencias()
        }

        if (data.tipo == 'exclusao') { // Só se for no nível
            await deletarDB(data.tabela, data.id)
            await refletir()
        }

        if (data.tipo == 'atualizacao') {
            await inserirDados({ [data.id]: data.dados }, data.tabela)
            await refletir()
        }

        if (data.tipo == 'status') {
            const user = await recuperarDado('dados_setores', data.usuario)
            if (user) {
                user.status = data.status
                await inserirDados({ [data.usuario]: user }, 'dados_setores')
            }
            
            try {
                usuariosToolbar()
                balaoUsuario(data.status, data.usuario)
            } catch { }
        }

    }

    socket.onclose = () => {
        console.log(`🔴🔴🔴 WS ${new Date().toLocaleString()} 🔴🔴🔴`);
        console.log(`Tentando reconectar em ${reconnectInterval / 1000} segundos...`)
        setTimeout(connectWebSocket, reconnectInterval);
    }

    async function refletir() {
        semOverlay = true
        await executar(funcaoTela)
        semOverlay = false
    }

}
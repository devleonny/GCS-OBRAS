let socket;
let reconnectInterval = 30000;
let emAtualizacao = false
connectWebSocket()

function connectWebSocket() {
    socket = new WebSocket(`${api}:8443`)

    function status(s) {
        const i = s == 'online'
            ? `🟢🟢🟢 Online ${new Date().toLocaleString()}`
            : s == 'pendente'
                ? '🟠🟠🟠 Validando...'
                : '🔴🔴🔴 Offline'

        const divMensagem = document.querySelector('.div-mensagem')
        if (divMensagem) divMensagem.insertAdjacentHTML('beforeend', `<span>${i}</span>`)
        console.log(i)
    }

    function msg(dados) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(dados))
        }
    }

    socket.onopen = () => {
        if (acesso) msg({ tipo: 'validar', usuario: acesso.usuario })
    }

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data)

        console.log(data)

        if (data.desconectar) {
            acesso = {}
            localStorage.removeItem('acesso')
            await resetarTudo()
            await telaLogin()
            popup(mensagem('Usuário removido do servidor'), 'GCS')
            return
        }

        if (data.validado) {

            if (data.validado == 'Sim') {
                status('online')

                if (bReset !== 2) return
                // Seguir este fluxo apenas em Ocorrências;
                listaOcorrencias = {}
                await atualizarOcorrencias()

                // Recuperar Filtros;
                filtrosAtivos = JSON.parse(localStorage.getItem('filtrosAtivos')) || {}

            } else if (bReset == 1) {
                status('online')
            } else {
                overlayAguarde()
                status('offline')
                status('pendente')
                await resetarTudo()
                await atualizarOcorrencias()
                msg({ tipo: 'confirmado', usuario: acesso.usuario })
                status('online')
                removerOverlay()
                return
            }

        }

        if (!appBases[bReset].includes(data.tabela)) return

        if (bReset == 1 && data.tabela == 'dados_orcamentos') {
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

            if (bReset == 2) return
            usuariosToolbar()
            balaoUsuario(data.status, data.usuario)
        }

    }

    socket.onclose = () => {
        status('offline')
        setTimeout(connectWebSocket, reconnectInterval);
    }

    async function refletir() {
        if (bReset == 2) return
        sOverlay = true
        await executar(funcaoTela)
        sOverlay = false
    }

}
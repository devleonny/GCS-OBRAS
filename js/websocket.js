let socket;
let reconnectInterval = 30000;
let emAtualizacao = false
let priExeGCS = true
let priExeOcorr = true
connectWebSocket()

function connectWebSocket() {

    app = localStorage.getItem('app') || 'OCORRÊNCIAS'
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

    socket.onopen = async () => {
        acesso = JSON.parse(localStorage.getItem('acesso'))
        if (acesso) {
            msg({ tipo: 'validar', usuario: acesso.usuario })
        } else {
            telaLogin()
        }
    }

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data)

        if (data.desconectar) {
            acesso = {}
            localStorage.removeItem('acesso')
            await resetarTudo()
            await telaLogin()
            popup({ mensagem: 'Usuário removido do servidor' })
            return
        }

        if (data.validado) { // Resetar ao receber atualizações de usuário;

            if (data.validado == 'Sim') {
                status('online')

                if (app == 'GCS') {

                    if (priExeGCS) {
                        await telaInicial()
                        priExeGCS = false
                    }

                } else {

                    // Seguir este fluxo apenas em Ocorrências;
                    listaOcorrencias = {}
                    await atualizarOcorrencias()

                    // Recuperar Filtros;
                    filtrosAtivos = JSON.parse(localStorage.getItem('filtrosAtivos')) || {}
                }

            } else {

                if (app == 'GCS') {
                    await telaInicial()
                    removerOverlay()
                    status('online')
                    return
                }

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

        // Se a base não pertencer ao app, retornar;
        if (app == 'OCORRÊNCIAS') return

        if (app == 'GCS' && data.tabela == 'dados_orcamentos') {
            verificarPendencias()
        }

        if (data.tipo == 'exclusao') { // Só se for no nível;
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

            await usuariosToolbar()
            balaoUsuario(data.status, data.usuario)
        }

    }

    socket.onclose = () => {
        status('offline')
        setTimeout(connectWebSocket, reconnectInterval)
    }

    async function refletir() {
        if (app !== 'GCS') return
        sOverlay = true
        await executar(funcaoTela)
        sOverlay = false
    }

}

async function carregarControles() {

    cUsuario.style.display = ''
    const modelo = (imagem, funcao, idElemento) => {
        return `
        <div onclick="${funcao}" style="${vertical};">
            <img src="imagens/${imagem}.png">
            <div id="${idElemento}" style="display: none;" class="labelQuantidade"></div>
        </div>
        `
    }

    const permitidosAprovacoes = ['adm', 'diretoria']
    const permitidosProdutos = ['LOGÍSTICA', 'SUPORTE', 'FINANCEIRO']
    const barraStatus = `
            <div id="divUsuarios"></div>

            ${modelo('projeto', 'verAprovacoes()', 'contadorPendencias')}
            ${permitidosAprovacoes.includes(acesso.permissao) ? modelo('construcao', 'configs()', '') : ''}
            ${permitidosProdutos.includes(acesso.setor) ? modelo('preco', 'precosDesatualizados()', 'contadorProdutos') : ''}

            <img title="Abrir mais 1 aba" src="imagens/aba.png" onclick="maisAba()">
        `
    const cabecalhoUsuario = document.querySelector('.cabecalho-usuario')
    if (cabecalhoUsuario) cabecalhoUsuario.innerHTML = barraStatus

    await usuariosToolbar()
    await precosDesatualizados(true) //Atualiza apenas a quantidade;
    await verificarPendencias() // Pendencias de aprovação;
}
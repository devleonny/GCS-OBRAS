let socket
let reconnectInterval = 30000
let reconnectTimeout = null
let reconectando = false

let emAtualizacao = false
let priExeGCS = true
let priExeOcorr = true

connectWebSocket()

function connectWebSocket() {

    if (reconectando) return
    reconectando = true

    if (socket) {
        try {
            socket.onopen = null
            socket.onmessage = null
            socket.onerror = null
            socket.onclose = null
            socket.close()
        } catch { }
    }

    socket = new WebSocket(`${api}:8443`)

    socket.onopen = async () => {
        reconectando = false
        clearTimeout(reconnectTimeout)

        msgStatus('Online', 1)
        await comunicacao()
        await validarAcesso()
    }

    socket.onerror = () => {
        socket.close()
    }

    socket.onclose = () => {
        reconectando = false
        msgStatus('Servidor offline', 3)

        clearTimeout(reconnectTimeout)
        reconnectTimeout = setTimeout(connectWebSocket, reconnectInterval)
    }
}


async function validarAcesso() {

    acesso = JSON.parse(localStorage.getItem('acesso'))
    msgStatus('Validando acesso...')
    if (acesso) {
        msg({ tipo: 'validar', usuario: acesso.usuario })
    } else {
        telaLogin()
    }

}

function msg(dados) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(dados))
    }
}

function msgStatus(msg, s = 2) {

    const simbolos = {
        1: '🟢🟢🟢',
        2: '🟠🟠🟠',
        3: '🔴🔴🔴'
    }

    msg = `${simbolos[s]} ${msg} ${new Date().toLocaleString()}`

    const divMensagem = document.querySelector('.div-mensagem')
    if (divMensagem) divMensagem.insertAdjacentHTML('beforeend', `<span>${msg}</span>`)
    console.log(msg)
}

async function refletir() {
    if (app !== 'GCS') return
    sOverlay = true
    ignorarMenus = true

    await executar(funcaoTela)

    sOverlay = false
    ignorarMenus = false
}

async function comunicacao() {

    app = localStorage.getItem('app') || 'OCORRÊNCIAS'

    socket.onmessage = async (event) => {

        const data = JSON.parse(event.data)
        const { tabela, desconectar, validado, tipo, id, dados, usuario, status } = data

        if (desconectar) {
            acesso = {}
            localStorage.removeItem('acesso')
            await resetarTudo()
            await telaLogin()
            popup({ mensagem: 'Usuário removido do servidor' })
            return
        }

        if (validado) {

            app = localStorage.getItem('app') || 'OCORRÊNCIAS'

            if (validado == 'Sim') {

                msgStatus('Acesso sem alterações')

                if (!telaAtiva) {
                    if (app == 'GCS')
                        await telaInicial()
                    else
                        await telaPrincipal()
                }

            } else {

                if (app == 'GCS') {

                    if (priExeGCS) {
                        await telaInicial()
                        priExeGCS = false
                    }

                } else {

                    overlayAguarde()
                    msgStatus('Offline', 3)
                    msgStatus('Alteração no acesso recebida...')
                    await resetarTudo()
                    await atualizarOcorrencias()
                    msg({ tipo: 'confirmado', usuario: acesso.usuario })
                    msgStatus('Tudo certo', 1)
                }
            }

            removerOverlay()
            nomeUsuario.innerHTML = `<span><strong>${inicialMaiuscula(acesso.permissao)}</strong> ${acesso.usuario}</span>`
        }

        if (app !== 'GCS') return

        if (tabela == 'dados_orcamentos') {
            db.dados_orcamentos = await sincronizarDados({ base: 'dados_orcamentos' })
            await verificarPendencias()
            await refletir()
            return
        }

        if (tipo == 'exclusao') {
            delete db[tabela][id]
            await deletarDB(tabela, id)
            await refletir()
        }

        if (tipo == 'atualizacao') {
            db[tabela][id] = dados
            await inserirDados({ [id]: dados }, tabela)
            await refletir()
        }

        if (tipo == 'status') {
            const tSetores = 'dados_setores'
            const user = await recuperarDado(tSetores, usuario)

            if (user) {
                user.status = status
                db[tSetores][usuario] = user
                await inserirDados({ [usuario]: user }, tSetores)
            }

            if (app == 'GCS') {
                await usuariosToolbar()
                balaoUsuario(status, usuario)
            }
        }
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
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

async function comunicacao() {

    app = localStorage.getItem('app') || 'OCORRÊNCIAS'

    socket.onmessage = async (event) => {

        const data = JSON.parse(event.data)
        const { tabela, desconectar, validado, tipo, usuario, status } = data

        if (desconectar) {
            acesso = {}
            localStorage.removeItem('acesso')
            await resetarTudo()
            await telaLogin()
            popup({ mensagem: 'Usuário desconectado' })
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
                    await atualizarGCS(true)
                    msg({ tipo: 'confirmado', usuario: acesso.usuario })
                    msgStatus('Tudo certo', 1)
                }
            }

            removerOverlay()
            nomeUsuario.innerHTML = `<span><strong>${inicialMaiuscula(acesso.permissao)}</strong> ${acesso.usuario}</span>`
        }

        if (app !== 'GCS')
            return

        if (tipo == 'atualizacao') {
            await sincronizarDados({ base: tabela })
            if (tabela == 'dados_orcamentos')
                await verificarPendencias()

            if (tabela == 'lista_pagamentos')
                await atualizarPainelEsquerdo()
        }

        if (tipo == 'status') {
            const tSetores = 'dados_setores'
            const user = await recuperarDado(tSetores, usuario)

            if (user) {
                user.status = status
                await inserirDados({ [usuario]: user }, tSetores)
            }

            await usuariosToolbar()
            balaoUsuario(status, usuario)

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

    const barraStatus = `
            <div id="divUsuarios"></div>

            ${modelo('projeto', 'verAprovacoes()', 'contadorPendencias')}
            ${permitidosAprovacoes.includes(acesso.permissao) ? modelo('construcao', 'configs()', '') : ''}

            <img title="Abrir mais 1 aba" src="imagens/aba.png" onclick="maisAba()">
        `
    const cabecalhoUsuario = document.querySelector('.cabecalho-usuario')
    if (cabecalhoUsuario) cabecalhoUsuario.innerHTML = barraStatus

    await usuariosToolbar()
    await verificarPendencias() // Pendencias de aprovação;
}
let socket
let reconnectInterval = 30000
let reconnectTimeout = null
let reconectando = false

let emAtualizacao = false
let priExeGCS = true

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

    socket.onmessage = async (event) => {

        const data = JSON.parse(event.data)
        const { tabela, desconectar, validado, tipo, usuario, status } = data

        if (desconectar) {
            acesso = {}
            localStorage.removeItem('acesso')
            indexedDB.deleteDatabase(nomeBase)
            await telaLogin()
            popup({ mensagem: 'Usuário desconectado' })
            return
        }

        if (validado) {

            if (validado == 'Sim') {

                msgStatus('Acesso sem alterações')
                await telaInicialGCS()
        
            } else {

                overlayAguarde()
                msgStatus('Offline', 3)
                msgStatus('Alteração no acesso recebida...')

                await atualizarGCS(true)
                await telaInicialGCS()

                msg({ tipo: 'confirmado', usuario: acesso.usuario })
                msgStatus('Tudo certo', 1)

            }

            await usuariosToolbar()
            removerOverlay()
        }

        if (tipo == 'atualizacao') {

            await sincronizarDados({ base: tabela })

            if (tabela == 'dados_orcamentos')
                await verificarPendencias()

            if (tabela == 'dados_ocorrencias')
                await auxPendencias()

            if (tabela == 'lista_pagamentos')
                await atualizarPainelEsquerdo()

            if (tabela == 'dados_setores') {
                const { usuario, permissao, empresa, timestamp = 0 } = JSON.parse(localStorage.getItem('acesso')) || {}
                const us = await recuperarDado('dados_setores', usuario)

                if (us?.timestamp !== timestamp) {

                    localStorage.setItem('acesso', JSON.stringify(us))

                    if (us.permissao !== permissao || us.empresa !== empresa) {

                        popup({ mensagem: '<b>Seu acesso foi alterado:</b> Salve seus trabalhos, o sistema será reiniciado em 5 minutos...' })

                        setTimeout(() => {
                            location.reload()
                        }, 5 * 60 * 1000)

                        await usuariosToolbar()
                    }

                }

            }
        }

        if (tipo == 'status') {

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
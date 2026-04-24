let socket
let reconnectInterval = 30000
let reconnectTimeout = null
let reconectando = false
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

    const acesso = JSON.parse(localStorage.getItem('acesso'))
    const token = acesso?.token

    msgStatus('Validando acesso...')

    if (!token || !acesso) {
        localStorage.removeItem('acesso')
        return await telaLogin()
    }

    try {

        const resp = await fetch(`${api}/validar-token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })

        if (resp.status === 401)
            throw new Error('Token inválido')

        const dados = await resp.json()

        localStorage.setItem('acesso', JSON.stringify({
            ...dados,
            token
        }))

        msg({ tipo: 'validar', usuario: dados.usuario })

    } catch {

        localStorage.removeItem('acesso')

        await telaLogin()
        popup({ mensagem: 'Sessão expirada, faça login novamente' })
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
    console.log(msg)
}

async function comunicacao() {

    socket.onmessage = async (event) => {

        const data = JSON.parse(event.data)
        const { tabela, desconectar, validado, tipo, usuario, status } = data

        if (desconectar) {
            localStorage.removeItem('acesso')
            await telaLogin()
            popup({ mensagem: 'Usuário desconectado' })
            return
        }

        if (validado) {

            if (validado == 'Sim') {

                msgStatus('Acesso sem alterações')
                if (priExeGCS)
                    await telaInicialGCS()

            } else {

                overlayAguarde()
                msgStatus('Offline', 3)
                msgStatus('Alteração no acesso recebida...')

                await telaInicialGCS()

                msg({ tipo: 'confirmado', usuario: acesso.usuario })
                msgStatus('Tudo certo', 1)

            }

            await usuariosToolbar()
            removerOverlay()
        }

        if (tipo == 'atualizacao') {

            if (tabela == 'acoes') {
                delete controles?.['orcamentos']?.ultimaAssinaturaConsulta
                delete controles?.['chamados']?.ultimaAssinaturaConsulta
                delete controles?.['tabelasIndicadores']?.ultimaAssinaturaConsulta
            }

            // Apenas as tabelas usadas;
            for (const dados of Object.values(controles)) {

                if (dados.base !== tabela)
                    continue

                await paginacao()

            }

            if (tabela == 'dados_orcamentos')
                await verificarPendencias()

            if (tabela == 'dados_ocorrencias')
                await auxPendencias()

            if (tabela == 'lista_pagamentos')
                await atualizarPainelEsquerdo()

            if (tabela == 'dados_setores') {
                const { usuario, permissao, empresa, timestamp = 0, token = null } = JSON.parse(localStorage.getItem('acesso')) || {}
                const us = await recuperarDado('dados_setores', usuario)

                if (us?.timestamp !== timestamp) {

                    localStorage.setItem('acesso', JSON.stringify({ ...us, token }))

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

    const { permissao } = JSON.parse(localStorage.getItem('acesso')) || {}

    cUsuario.style.display = ''
    const modelo = (imagem, funcao, idElemento) => {
        return `
        <div onclick="${funcao}" style="${vertical};">
            <img src="imagens/${imagem}.png">
            <div id="${idElemento}" style="display: none;" class="labelQuantidade"></div>
        </div>
        `
    }

    const barraStatus = ['<div id="divUsuarios"></div>']

    if (!['cliente', 'técnico'].includes(permissao))
        barraStatus.push(modelo('kanban', 'telaPIT()', 'contadorPostIt'), modelo('projeto', 'verAprovacoes()', 'contadorPendencias'))

    if (['adm', 'diretoria'].includes(permissao))
        barraStatus.push(modelo('construcao', 'configs()', ''))


    const cabecalhoUsuario = document.querySelector('.cabecalho-usuario')
    if (cabecalhoUsuario)
        cabecalhoUsuario.innerHTML = barraStatus.join('')

    await usuariosToolbar()
    await verificarPendencias() // Pendencias de aprovação;
    await verificarPostIts() // Post Its atrasados;
}

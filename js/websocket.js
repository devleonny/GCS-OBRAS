let socket
let reconnectInterval = 30000
let reconnectTimeout = null
let reconectando = false
let priExeGCS = true

const tabelasPendentesWS = new Set()
const intervaloAtualizacaoWS = 400

let timerAtualizacaoWS = null
let atualizacaoEmExecucaoWS = false
let atualizarTodasWS = false
let toolbarPendenteWS = false

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
        clearTimeout(timerAtualizacaoWS)
        timerAtualizacaoWS = null

        if (tabelasPendentesWS.size)
            atualizarTodasWS = true

        return
    }

    agendarAtualizacaoWS()
})

connectWebSocket()

function connectWebSocket() {
    if (reconectando)
        return

    reconectando = true

    if (socket) {
        try {
            socket.onopen = null
            socket.onmessage = null
            socket.onerror = null
            socket.onclose = null
            socket.close()
        } catch {}
    }

    socket = new WebSocket(`${api}:8443`)

    socket.onopen = async () => {
        reconectando = false
        clearTimeout(reconnectTimeout)

        try {
            msgStatus('Online', 1)
            await comunicacao()
            await validarAcesso()
        } catch (err) {
            console.error('Erro ao iniciar websocket:', err)
        }
    }

    socket.onerror = () => {
        socket.close()
    }

    socket.onclose = () => {
        reconectando = false
        msgStatus('Servidor offline', 3)

        clearTimeout(reconnectTimeout)
        reconnectTimeout = setTimeout(
            connectWebSocket,
            reconnectInterval
        )
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
                Authorization: `Bearer ${token}`
            }
        })

        if (resp.status === 401)
            throw new Error('Token inválido')

        const dados = await resp.json()

        localStorage.setItem('acesso', JSON.stringify({
            ...dados,
            token
        }))

        msg({
            tipo: 'validar',
            usuario: dados.usuario
        })
    } catch {
        localStorage.removeItem('acesso')
        location.reload()
        popup({ mensagem: 'Sessão expirada, faça login novamente' })
    }
}

function msg(dados) {
    if (socket && socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(dados))
}

function msgStatus(texto, s = 2) {
    const simbolos = {
        1: '🟢🟢🟢',
        2: '🟠🟠🟠',
        3: '🔴🔴🔴'
    }

    console.log(
        `${simbolos[s]} ${texto} ${new Date().toLocaleString()}`
    )
}

function agendarAtualizacaoWS() {
    if (document.visibilityState !== 'visible')
        return

    if (atualizacaoEmExecucaoWS || timerAtualizacaoWS !== null)
        return

    if (
        !tabelasPendentesWS.size &&
        !atualizarTodasWS &&
        !toolbarPendenteWS
    )
        return

    timerAtualizacaoWS = setTimeout(() => {
        timerAtualizacaoWS = null

        executarAtualizacaoWS().catch(err => {
            console.error('Erro na atualização do websocket:', err)
        })
    }, intervaloAtualizacaoWS)
}

function registrarAtualizacaoWS(tabela) {
    if (!tabela)
        return

    tabelasPendentesWS.add(tabela)

    if (document.visibilityState !== 'visible') {
        atualizarTodasWS = true
        return
    }

    agendarAtualizacaoWS()
}

function limparAtualizacoesWS() {
    clearTimeout(timerAtualizacaoWS)
    timerAtualizacaoWS = null

    tabelasPendentesWS.clear()
    atualizarTodasWS = false
    toolbarPendenteWS = false
}

async function executarAtualizacaoWS() {
    if (
        atualizacaoEmExecucaoWS ||
        document.visibilityState !== 'visible'
    )
        return

    const tabelas = new Set(tabelasPendentesWS)
    const atualizarTodas = atualizarTodasWS
    const atualizarToolbar = toolbarPendenteWS

    tabelasPendentesWS.clear()
    atualizarTodasWS = false
    toolbarPendenteWS = false
    atualizacaoEmExecucaoWS = true

    try {
        const tarefas = []

        if (atualizarTodas) {
            tarefas.push(() => paginacao())
        } else {
            const paginas = new Set()

            for (const { pag, base } of Object.values(controles)) {
                if (
                    tabelas.has(base) ||
                    (
                        tabelas.size > 0 &&
                        typeof base === 'string' &&
                        base.includes('vw')
                    )
                )
                    paginas.add(pag)
            }

            for (const pag of paginas)
                tarefas.push(() => paginacao(pag))
        }

        if (tabelas.has('dados_orcamentos'))
            tarefas.push(() => verificarPendencias())

        if (tabelas.has('dados_ocorrencias'))
            tarefas.push(() => auxPendencias())

        if (tabelas.has('lista_pagamentos'))
            tarefas.push(() => atualizarPainelEsquerdo())

        if (atualizarToolbar)
            tarefas.push(() => usuariosToolbar())

        for (const tarefa of tarefas) {
            if (!localStorage.getItem('acesso'))
                break

            if (document.visibilityState !== 'visible') {
                for (const tabela of tabelas)
                    tabelasPendentesWS.add(tabela)

                atualizarTodasWS = atualizarTodasWS ||
                    atualizarTodas ||
                    tabelas.size > 0

                toolbarPendenteWS = toolbarPendenteWS ||
                    atualizarToolbar

                break
            }

            try {
                await tarefa()
            } catch (err) {
                console.error('Erro ao atualizar pelo websocket:', err)
            }
        }
    } finally {
        atualizacaoEmExecucaoWS = false
        agendarAtualizacaoWS()
    }
}

async function comunicacao() {
    socket.onmessage = async event => {
        try {
            const data = JSON.parse(event.data)

            const {
                tabela,
                desconectar,
                validado,
                tipo,
                usuario,
                status
            } = data

            if (desconectar) {
                limparAtualizacoesWS()
                localStorage.removeItem('acesso')

                await telaLogin()
                popup({ mensagem: 'Usuário desconectado' })
                return
            }

            if (validado) {
                try {
                    if (validado === 'Sim') {
                        msgStatus('Acesso sem alterações')

                        if (priExeGCS)
                            await telaInicialGCS()
                    } else {
                        overlayAguarde()
                        msgStatus('Offline', 3)
                        msgStatus('Alteração no acesso recebida...')

                        await telaInicialGCS()

                        const acessoAtual = JSON.parse(
                            localStorage.getItem('acesso')
                        )

                        msg({
                            tipo: 'confirmado',
                            usuario: acessoAtual?.usuario
                        })

                        msgStatus('Tudo certo', 1)
                    }

                    await usuariosToolbar()
                } finally {
                    removerOverlay()
                }
            }

            if (tipo === 'atualizacao') {
                registrarAtualizacaoWS(tabela)
                return
            }

            if (tipo === 'status') {
                toolbarPendenteWS = true
                agendarAtualizacaoWS()

                if (document.visibilityState === 'visible') {
                    balaoNotificacao({
                        imagem: `imagens/${status}.png`,
                        texto: `${usuario} ${status}`
                    })
                }
            }
        } catch (err) {
            console.error('Erro ao processar mensagem do websocket:', err)
        }
    }
}

async function carregarControles() {
    const { permissao } = JSON.parse(
        localStorage.getItem('acesso')
    ) || {}

    cUsuario.style.display = ''

    const modelo = (imagem, funcao, idElemento) => {
        return `
            <div onclick="${funcao}" style="${horizontal};">
                <div
                    id="${idElemento}"
                    style="display: none;"
                    class="labelQuantidade"
                ></div>
                <img src="imagens/${imagem}.png">
            </div>
        `
    }

    const barraStatus = ['<div id="divUsuarios"></div>']

    if (!['cliente', 'técnico'].includes(permissao)) {
        barraStatus.push(
            modelo('kanban', 'telaPIT()', 'contadorPostIt'),
            modelo('projeto', 'verAprovacoes()', 'contadorPendencias')
        )
    }

    if (['adm', 'diretoria'].includes(permissao))
        barraStatus.push(modelo('construcao', 'f2()', ''))

    const cabecalhoUsuario = document.querySelector(
        '.cabecalho-usuario'
    )

    if (cabecalhoUsuario)
        cabecalhoUsuario.innerHTML = barraStatus.join('')

    await usuariosToolbar()
    await verificarPendencias()
    await verificarPostIts()
}
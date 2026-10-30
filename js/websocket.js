let socket
let reconnectTimeout = null
let reconectando = false
let priExeGCS = true

// Reconecta rápido nas primeiras tentativas: o servidor só marca offline depois de
// uma carência, então uma queda curta de rede não chega a aparecer para os outros.
const esperasReconexaoWS = [1000, 2000, 5000, 10000, 20000, 30000]
let tentativasReconexaoWS = 0

function agendarReconexaoWS() {
    clearTimeout(reconnectTimeout)
    const espera = esperasReconexaoWS[Math.min(tentativasReconexaoWS, esperasReconexaoWS.length - 1)]
    tentativasReconexaoWS++
    reconnectTimeout = setTimeout(connectWebSocket, espera)
}

function reconectarSeFechadoWS() {
    if (!socket || [WebSocket.CLOSED, WebSocket.CLOSING].includes(socket.readyState)) {
        tentativasReconexaoWS = 0
        clearTimeout(reconnectTimeout)
        connectWebSocket()
    }
}

// Rede voltou ou o PC acordou: não espera o próximo ciclo.
window.addEventListener('online', reconectarSeFechadoWS)

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

    sincronizarRelogioServidor(true).catch(err => console.error('Falha ao sincronizar horário:', err))
    agendarAtualizacaoWS()
    reconectarSeFechadoWS()
})

// Ausência automática: sem interação por TEMPO_AUSENCIA_MS em nenhuma aba, avisa o servidor
// (online -> Ausente); na primeira interação depois disso, volta (Ausente -> online). Quem decide
// é o servidor, que só troca entre esses dois status (gcs/websocket.js, tratarAusencia).
// O horário fica no localStorage para as abas abertas valerem como uma só.
const TEMPO_AUSENCIA_MS = 10 * 60 * 1000
const CHAVE_ATIVIDADE = 'ultimaAtividadeGCS'
let ultimaAtividadeGravada = 0
let ausenciaInformada = false

function ultimaAtividade() {
    let compartilhada = 0
    try { compartilhada = Number(localStorage.getItem(CHAVE_ATIVIDADE)) || 0 } catch {}
    return Math.max(ultimaAtividadeGravada, compartilhada)
}

function informarAusencia(ausente) {
    ausenciaInformada = ausente
    msg({ tipo: 'ausencia', ausente })
}

function registrarAtividade() {
    const agora = Date.now()

    // Gravar a cada movimento do mouse seria excessivo: no máximo a cada 5 s.
    if (agora - ultimaAtividadeGravada > 5000) {
        ultimaAtividadeGravada = agora
        try { localStorage.setItem(CHAVE_ATIVIDADE, String(agora)) } catch {}
    }

    if (ausenciaInformada)
        informarAusencia(false)
}

for (const evento of ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'])
    window.addEventListener(evento, registrarAtividade, { passive: true, capture: true })

setInterval(() => {
    const parado = Date.now() - ultimaAtividade() >= TEMPO_AUSENCIA_MS

    if (parado && !ausenciaInformada)
        informarAusencia(true)
    else if (!parado && ausenciaInformada)
        informarAusencia(false) // houve interação em outra aba
}, 30000)

registrarAtividade()

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
            // Ao reconectar o servidor volta o status para online; se continuar parado, avisa de novo.
            ausenciaInformada = false
            await sincronizarRelogioServidor()
            msgStatus('Online', 1)
            await comunicacao()
            await validarAcesso()
        } catch (err) {
            console.error('Erro ao iniciar websocket:', err)
            socket.close()
        }
    }

    socket.onerror = () => {
        socket.close()
    }

    socket.onclose = () => {
        reconectando = false
        msgStatus('Servidor offline', 3)

        agendarReconexaoWS()
    }
}

function sessaoExpirada() {
    localStorage.removeItem('acesso')
    location.reload()
    popup({ mensagem: 'Sessão expirada, faça login novamente' })
}

async function validarAcesso(tentouRenovar = false) {
    msgStatus('Validando acesso...')

    // Token de acesso perto de vencer (ou vencido com o PC dormindo): renova antes de validar.
    if (await renovarSessao() === 'expirada')
        return sessaoExpirada()

    const acessoAtual = JSON.parse(localStorage.getItem('acesso'))
    const token = acessoAtual?.token

    if (!token || !acessoAtual) {
        localStorage.removeItem('acesso')
        return await telaLogin()
    }

    let resp
    try {
        resp = await fetch(`${api}/validar-token`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
    } catch {
        // Falha de rede não é sessão expirada: mantém o login e tenta de novo na reconexão.
        msgStatus('Sem rede para validar o acesso', 3)
        socket?.close()
        return
    }

    if (resp.status === 401 || resp.status === 403) {
        // Última chance antes de deslogar: o token de renovação ainda pode estar válido.
        if (!tentouRenovar) {
            const renovacao = await renovarSessao({ forcar: true, tokenRecusado: token })
            if (renovacao === 'renovado')
                return validarAcesso(true)
            if (['sem-rede', 'erro'].includes(renovacao)) {
                socket?.close()
                return
            }
        }
        return sessaoExpirada()
    }

    try {
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status}`)

        const dados = await resp.json()

        // Mantém o que a validação não devolve (token de renovação, foto, empresa).
        // A página aberta também passa a usar os dados novos (ex.: permissão alterada),
        // senão ações como aprovar pagamento seguiriam com a permissão antiga até recarregar.
        const anterior = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        acesso = { ...anterior, ...dados, token }
        localStorage.setItem('acesso', JSON.stringify(acesso))

        msg({
            tipo: 'validar',
            usuario: dados.usuario
        })
    } catch (err) {
        // Servidor instável (5xx, resposta inválida): também não desloga.
        msgStatus(`Falha ao validar o acesso: ${err.message}`, 3)
        socket?.close()
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

        if (tabelas.has('dados_ocorrencias') || tabelas.has('colaboradores'))
            tarefas.push(() => auxPendencias())

        if (tabelas.has('colaboradores') || tabelas.has('requisicoes'))
            tarefas.push(() => atualizarColaboradoresWS())

        // Correção salva pode ocupar/liberar técnico: o letreiro de livres acompanha na hora.
        if ((atualizarTodas || tabelas.has('dados_ocorrencias')) && typeof atualizarTecnicosLivres === 'function')
            tarefas.push(() => atualizarTecnicosLivres())

        if (tabelas.has('lista_pagamentos'))
            tarefas.push(() => atualizarPainelEsquerdo(), () => verificarPagamentosReprovados())

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

            if (data.tipo === 'foto_usuario') {
                atualizarFotoUsuario(data)
                return
            }

            const {
                tabela,
                desconectar,
                validado,
                tipo,
                usuario,
                status,
                automatico
            } = data

            if (desconectar) {
                limparAtualizacoesWS()
                localStorage.removeItem('acesso')

                await telaLogin()
                popup({ mensagem: 'Usuário desconectado' })
                return
            }

            if (validado) {
                tentativasReconexaoWS = 0

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

                // Ausente/online automático atualiza a lista, sem balão para todos a cada ida e volta.
                if (document.visibilityState === 'visible' && !automatico) {
                    balaoNotificacao({
                        imagem: `imagens/${status}.png`,
                        usuario,
                        status,
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

    const modelo = (imagem, funcao, idElemento, extensao = 'png') => {
        return `
            <div class="atalho-cabecalho-gcs" onclick="${funcao}">
                <img src="imagens/${imagem}.${extensao}">
                <div
                    id="${idElemento}"
                    style="display: none;"
                    class="labelQuantidade contador-toolbar-gcs"
                ></div>
            </div>
        `
    }

    const barraStatus = ['<div id="divUsuarios"></div>']

    // Pagamentos reprovados de quem está logado: só aparece se houver algum (verificarPagamentosReprovados).
    if (permissao !== 'cliente')
        barraStatus.push(`
            <div id="atalhoReprovados" style="display: none;">
                ${modelo('pagamento', 'abrirPagamentosReprovados()', 'contadorReprovados')}
            </div>`)

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

    if (cabecalhoUsuario) {
        cabecalhoUsuario.innerHTML = barraStatus.join('')

        if (typeof mostrarLembreteComunicadosGCS === 'function')
            mostrarLembreteComunicadosGCS()
    }

    await Promise.allSettled([
        usuariosToolbar(),
        verificarPendencias(),
        verificarPostIts(),
        verificarPagamentosReprovados()
    ])
}

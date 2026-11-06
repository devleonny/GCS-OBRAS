// Notificações do GCS (PWA): sino no cabeçalho, ativação do push neste aparelho e caixa de avisos.
// Servidor: SCRIPTS/notificacoes.js (rotas /notificacoes/*). Service worker: sw.js.
//
// Sino desligado (sem permissão ou sem inscrição neste aparelho): o clique pergunta se a pessoa quer
// receber as notificações e, no "sim", pede a permissão do navegador e inscreve o aparelho.
// Sino ligado: o clique abre a caixa de avisos; o contador mostra os não lidos.

const estadoNotificacoes = { ativo: false, naoLidas: 0, verificado: false, temporizador: null }
const PERFIS_ENVIO_NOTIFICACAO = ['adm', 'diretoria']

async function chamarNotificacoes(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}/notificacoes/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok)
        throw new Error(dados.mensagem || `Falha (${resposta.status})`)
    return dados
}

const suportaPushGCS = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
// iPhone/iPad só recebem push com o GCS instalado na tela de início (iOS 16.4+).
const iosSemInstalarGCS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone)

async function registroServiceWorkerGCS() {
    const pronto = navigator.serviceWorker.ready
    const limite = new Promise((_, falhar) => setTimeout(() => falhar(new Error('Service worker indisponível')), 10000))
    return Promise.race([pronto, limite])
}

async function inscricaoPushAtual() {
    if (!suportaPushGCS()) return null
    try { return await (await registroServiceWorkerGCS()).pushManager.getSubscription() }
    catch { return null }
}

function chaveVapidParaBytes(base64) {
    const preenchido = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(preenchido), c => c.charCodeAt(0))
}

// ---------------- Sino ----------------
// Sino colorido no estilo chapado dos outros ícones do cabeçalho (metade direita em tom mais escuro).
// Reto e laranja, para não confundir com o sino amarelo inclinado da Central de atualizações.
const desenhoSinoGCS = ({ corpo, sombra, aro, badalo }) => `
    <circle cx="12" cy="3.4" r="1.5" fill="${aro}"/>
    <path d="M12 4.6C8.3 4.6 6.1 7.4 6.1 10.9V14.6L4.4 17.3H19.6L17.9 14.6V10.9C17.9 7.4 15.7 4.6 12 4.6Z" fill="${corpo}"/>
    <path d="M12 4.6C15.7 4.6 17.9 7.4 17.9 10.9V14.6L19.6 17.3H12Z" fill="${sombra}"/>
    <rect x="3.9" y="16.5" width="16.2" height="2.4" rx="1.2" fill="${aro}"/>
    <circle cx="12" cy="20.7" r="1.9" fill="${badalo}"/>
    <path d="M8.7 10.4C8.7 8.6 9.7 7.3 11 6.9" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.3" stroke-linecap="round"/>`

const SVG_SINO = `
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        ${desenhoSinoGCS({ corpo: '#ffa94d', sombra: '#fd7e14', aro: '#e8590c', badalo: '#c92a2a' })}
    </svg>`
const SVG_SINO_DESLIGADO = `
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        ${desenhoSinoGCS({ corpo: '#ced4da', sombra: '#adb5bd', aro: '#868e96', badalo: '#6c757d' })}
        <line x1="4" y1="3.5" x2="20.5" y2="21" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>
        <line x1="4" y1="3.5" x2="20.5" y2="21" stroke="#e03131" stroke-width="2" stroke-linecap="round"/>
    </svg>`

function renderizarSinoNotificacoes() {
    const local = document.getElementById('sinoNotificacoes')
    if (!local) return
    const { ativo, naoLidas } = estadoNotificacoes
    const titulo = !suportaPushGCS()
        ? 'Este navegador não recebe notificações'
        : ativo ? (naoLidas ? `${naoLidas} notificação(ões) não lida(s)` : 'Notificações ativas') : 'Notificações desativadas: clique para ativar'
    local.innerHTML = `
        <button type="button" class="atalho-cabecalho-gcs sino-notificacoes ${ativo ? 'ativo' : 'desativado'}"
            onclick="cliqueSinoNotificacoes()" title="${titulo}" aria-label="${titulo}">
            ${ativo ? SVG_SINO : SVG_SINO_DESLIGADO}
            ${ativo && naoLidas ? `<b class="contador-toolbar-gcs">${naoLidas > 99 ? '99+' : naoLidas}</b>` : ''}
        </button>`
}

async function avaliarSinoNotificacoes() {
    const inscricao = await inscricaoPushAtual()
    estadoNotificacoes.ativo = !!inscricao && Notification.permission === 'granted'
    estadoNotificacoes.verificado = true
    // Inscrição do aparelho sempre reafirmada para o usuário logado (troca de usuário no mesmo aparelho).
    if (estadoNotificacoes.ativo)
        chamarNotificacoes('inscrever', { inscricao: inscricao.toJSON() }).catch(() => { })
    renderizarSinoNotificacoes()
    if (estadoNotificacoes.ativo) await atualizarContadorNotificacoes()
}

async function atualizarContadorNotificacoes() {
    try {
        const { naoLidas } = await chamarNotificacoes('contar')
        estadoNotificacoes.naoLidas = naoLidas || 0
        renderizarSinoNotificacoes()
    } catch { }
}

async function cliqueSinoNotificacoes() {
    if (!suportaPushGCS())
        return popup({ titulo: 'Notificações', mensagem: 'Este navegador não recebe notificações do GCS.<br><small>Use o Chrome, o Edge ou o GCS instalado no celular.</small>' })
    if (estadoNotificacoes.ativo)
        return abrirCaixaNotificacoes()
    if (iosSemInstalarGCS())
        return popup({ titulo: 'Notificações', mensagem: 'No iPhone, as notificações só funcionam com o GCS instalado:<br>toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b> e abra o GCS por lá.' })
    if (Notification.permission === 'denied')
        return popup({ titulo: 'Notificações bloqueadas', mensagem: 'As notificações do GCS estão bloqueadas neste navegador.<br><small>Libere em: cadeado ao lado do endereço → Notificações → Permitir. Depois clique no sino de novo.</small>' })
    perguntarAtivarNotificacoes()
}

function perguntarAtivarNotificacoes() {
    popup({
        titulo: 'Notificações do GCS',
        modal: true,
        mensagem: `Deseja receber notificações do GCS neste aparelho?<br>
            <small>Pagamentos, aprovações, pendências e avisos que forem para você, mesmo com o GCS fechado.</small>`,
        botoes: [
            { texto: 'Agora não', img: 'cancel', fechar: true },
            { texto: 'Ativar', img: 'concluido', funcao: 'ativarNotificacoes(this)' }
        ]
    })
}

async function ativarNotificacoes(botao) {
    const janelaPergunta = botao?.closest?.('.popup')?.id
    if (janelaPergunta) removerPopup(janelaPergunta)
    overlayAguarde()
    try {
        const permissao = await Notification.requestPermission()
        if (permissao !== 'granted') {
            removerOverlay()
            return popup({ titulo: 'Notificações', mensagem: 'Sem a permissão do navegador o GCS não consegue avisar você.<br><small>Quando quiser, clique no sino de novo.</small>' })
        }
        const { chave } = await chamarNotificacoes('chave-publica')
        const registro = await registroServiceWorkerGCS()
        const inscricao = await registro.pushManager.getSubscription()
            || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapidParaBytes(chave) })
        await chamarNotificacoes('inscrever', { inscricao: inscricao.toJSON() })
        estadoNotificacoes.ativo = true
        renderizarSinoNotificacoes()
        await chamarNotificacoes('testar').catch(() => { })
        await atualizarContadorNotificacoes()
        removerOverlay()
        popup({ titulo: 'Notificações ativadas', mensagem: 'Pronto! Este aparelho vai receber as notificações do GCS.<br><small>Enviamos um aviso de teste.</small>', imagem: 'imagens/concluido.png', tempo: 4 })
    } catch (erro) {
        console.error('[NOTIFICACOES] ativar', erro)
        removerOverlay()
        popup({ titulo: 'Notificações', mensagem: `Não foi possível ativar as notificações: ${escaparAtributo(erro.message || 'erro desconhecido')}` })
    }
}

async function desativarNotificacoes() {
    overlayAguarde()
    try {
        const inscricao = await inscricaoPushAtual()
        if (inscricao) {
            await chamarNotificacoes('cancelar', { endpoint: inscricao.endpoint }).catch(() => { })
            await inscricao.unsubscribe()
        }
        estadoNotificacoes.ativo = false
        estadoNotificacoes.naoLidas = 0
        renderizarSinoNotificacoes()
        removerTodosPopups()
        popup({ titulo: 'Notificações', mensagem: 'Notificações desativadas neste aparelho.', tempo: 3 })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: `Falha ao desativar: ${escaparAtributo(erro.message)}` })
    }
}

// ---------------- Caixa de avisos ----------------
function quandoNotificacao(iso) {
    const data = new Date(iso)
    const minutos = Math.round((Date.now() - data) / 60000)
    if (minutos < 1) return 'agora'
    if (minutos < 60) return `há ${minutos} min`
    if (minutos < 24 * 60) return `há ${Math.round(minutos / 60)} h`
    return data.toLocaleDateString('pt-BR')
}

async function abrirCaixaNotificacoes() {
    overlayAguarde()
    try {
        const { notificacoes = [], naoLidas = 0 } = await chamarNotificacoes('listar', { limite: 60 })
        estadoNotificacoes.naoLidas = naoLidas
        renderizarSinoNotificacoes()
        window.listaCaixaNotificacoes = new Map(notificacoes.map(n => [String(n.id), n]))

        const itens = notificacoes.map(n => `
            <div class="notificacao-item ${n.lida_em ? '' : 'nao-lida'}" onclick="clicarNotificacao('${n.id}')">
                <div class="notificacao-item-topo">
                    <b>${escaparAtributo(n.titulo)}</b>
                    <small>${quandoNotificacao(n.criado_em)}</small>
                </div>
                ${n.corpo ? `<span>${escaparAtributo(n.corpo)}</span>` : ''}
            </div>`).join('')

        const botoes = [{ texto: 'Desativar neste aparelho', img: 'cancel', funcao: 'desativarNotificacoes()' }]
        if (PERFIS_ENVIO_NOTIFICACAO.includes(acesso?.permissao))
            botoes.push({ texto: 'Enviar aviso', img: 'baixar', funcao: 'formularioEnviarNotificacao()' })
        if (naoLidas)
            botoes.push({ texto: 'Marcar todas como lidas', img: 'concluido', funcao: 'marcarTodasNotificacoesLidas()' })

        const conteudo = `
            <div class="caixa-notificacoes" id="caixaNotificacoes">
                ${itens || '<p class="notificacoes-vazio">Nenhuma notificação por enquanto.</p>'}
            </div>`

        removerOverlay()
        const aberta = document.getElementById('caixaNotificacoes')
        if (aberta) {
            aberta.outerHTML = conteudo
            return trazerJanelaParaFrente(document.getElementById('caixaNotificacoes'))
        }
        popup({ titulo: 'Notificações', elemento: conteudo, botoes })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: `Falha ao carregar as notificações: ${escaparAtributo(erro.message)}` })
    }
}

async function clicarNotificacao(id) {
    const notificacao = window.listaCaixaNotificacoes?.get(String(id))
    if (!notificacao) return
    if (!notificacao.lida_em) {
        notificacao.lida_em = new Date().toISOString()
        chamarNotificacoes('lidas', { ids: [Number(id)] }).then(atualizarContadorNotificacoes).catch(() => { })
        document.querySelector(`.notificacao-item[onclick="clicarNotificacao('${id}')"]`)?.classList.remove('nao-lida')
    }
    await abrirAcaoNotificacao(notificacao.acao)
}

async function marcarTodasNotificacoesLidas() {
    await chamarNotificacoes('lidas', { todas: true }).catch(() => { })
    estadoNotificacoes.naoLidas = 0
    renderizarSinoNotificacoes()
    document.querySelectorAll('.notificacao-item.nao-lida').forEach(item => item.classList.remove('nao-lida'))
}

// O que cada notificação abre (acao vem do servidor).
async function abrirAcaoNotificacao(acao) {
    const { tipo } = acao || {}
    try {
        if (tipo === 'chamado' && acao.chamado) return await atalhoAuxiliar(acao.chamado, 'chamados', 'includes')
        if (tipo === 'pagamento' && acao.id) return await abrirDetalhesPagamentos(acao.id)
        if (tipo === 'colaborador' && acao.colaborador) return await irParaColaborador(acao.colaborador, acao.requisicao)
        if (tipo === 'documentos') return await abrirDocumentosAVencer()
        if (tipo === 'precos') return await abrirPrecosVencidos(acao.lpu || null)
        if (tipo === 'comunicado' && acao.id) {
            if (typeof carregarComunicadoGCS === 'function' && !comunicadoPorIdGCS(acao.id)) await carregarComunicadoGCS()
            return abrirComunicadoGCS(acao.id)
        }
        return await abrirCaixaNotificacoes()
    } catch (erro) {
        console.error('[NOTIFICACOES] abrir', erro)
    }
}

// ---------------- Documentos a renovar (do próprio usuário) ----------------
async function abrirDocumentosAVencer() {
    overlayAguarde()
    try {
        const { documentos = [] } = await chamarNotificacoes('documentos')
        removerOverlay()
        const linhas = documentos.map(d => `
            <tr>
                <td style="text-align: left;"><b>${escaparAtributo(d.doc)}</b></td>
                <td>${d.realizado.split('-').reverse().join('/')}</td>
                <td>${d.vencimento.split('-').reverse().join('/')}</td>
                <td><span class="documento-situacao ${d.fase}">${d.fase === 'vencido' ? `Vencido há ${-d.dias} dia(s)` : d.dias === 0 ? 'Vence hoje' : `Vence em ${d.dias} dia(s)`}</span></td>
            </tr>`).join('')
        popup({
            titulo: 'Documentos a renovar',
            elemento: documentos.length
                ? `<div class="documentos-a-vencer"><table class="tabela-documentos-vencer">
                        <thead><tr><th style="text-align: left;">Documento</th><th>Realizado</th><th>Vencimento</th><th>Situação</th></tr></thead>
                        <tbody>${linhas}</tbody></table>
                        <p><small>Procure o RH para agendar a renovação.</small></p></div>`
                : '<p style="padding: 1rem;">Nenhum documento seu vence nos próximos 30 dias.</p>'
        })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: `Falha ao carregar os documentos: ${escaparAtributo(erro.message)}` })
    }
}

// ---------------- Envio manual (adm/diretoria) ----------------
function formularioEnviarNotificacao() {
    popup({
        titulo: 'Enviar aviso',
        linhas: [
            { texto: 'Título', elemento: '<input name="tituloAviso" maxlength="120" placeholder="Ex.: Sistema em manutenção às 18h">' },
            { texto: 'Mensagem', elemento: '<textarea name="corpoAviso" maxlength="300" placeholder="Detalhes (opcional)"></textarea>' },
            { texto: 'Para todos', elemento: '<input type="checkbox" name="todosAviso" style="width: 1.5rem; height: 1.5rem;">' },
            { texto: 'Setores', elemento: '<input name="setoresAviso" placeholder="Ex.: LOGÍSTICA, FINANCEIRO">' },
            { texto: 'Permissões', elemento: '<input name="permissoesAviso" placeholder="Ex.: gerente, diretoria">' },
            { texto: 'Usuários', elemento: '<input name="usuariosAviso" placeholder="Ex.: Leonny, vaneli">' }
        ],
        botoes: [{ texto: 'Enviar', img: 'concluido', funcao: 'enviarNotificacaoManual(this)' }]
    })
}

async function enviarNotificacaoManual(botao) {
    const janela = botao.closest('.popup')
    const campo = nome => janela.querySelector(`[name="${nome}"]`)
    const lista = nome => String(campo(nome).value || '').split(',').map(v => v.trim()).filter(Boolean)
    const corpo = {
        titulo: campo('tituloAviso').value.trim(),
        corpo: campo('corpoAviso').value.trim(),
        todos: campo('todosAviso').checked,
        setores: lista('setoresAviso').map(s => s.toUpperCase()),
        permissoes: lista('permissoesAviso').map(p => p.toLowerCase()),
        usuarios: lista('usuariosAviso')
    }
    if (!corpo.titulo) return popup({ mensagem: 'Informe o título do aviso.' })
    overlayAguarde()
    try {
        const { destinatarios } = await chamarNotificacoes('enviar', corpo)
        removerOverlay()
        removerPopup(janela.id)
        popup({ titulo: 'Aviso enviado', mensagem: `Aviso registrado para <b>${destinatarios}</b> pessoa(s).<br><small>Recebem no aparelho quem ativou as notificações.</small>` })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: escaparAtributo(erro.message) })
    }
}

// ---------------- Início ----------------
// Chamado depois de montar o cabeçalho (websocket.js): sino, contador e clique vindo da notificação.
async function iniciarSinoNotificacoes() {
    renderizarSinoNotificacoes()
    await avaliarSinoNotificacoes()

    clearInterval(estadoNotificacoes.temporizador)
    estadoNotificacoes.temporizador = setInterval(() => {
        if (estadoNotificacoes.ativo && document.visibilityState === 'visible') atualizarContadorNotificacoes()
    }, 3 * 60 * 1000)

    // GCS aberto pela notificação (estava fechado): ?notificacao=<acao em base64>.
    const parametros = new URLSearchParams(location.search)
    const pendente = parametros.get('notificacao')
    if (pendente) {
        parametros.delete('notificacao')
        history.replaceState(null, '', `${location.pathname}${parametros.size ? `?${parametros}` : ''}${location.hash}`)
        try {
            const { acao, ids } = JSON.parse(decodeURIComponent(escape(atob(pendente))))
            if (ids?.length) chamarNotificacoes('lidas', { ids }).then(atualizarContadorNotificacoes).catch(() => { })
            await abrirAcaoNotificacao(acao)
        } catch { }
    }
}

// Clique numa notificação com o GCS já aberto (sw.js -> postMessage).
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', evento => {
        const { tipo, acao, ids } = evento.data || {}
        if (tipo !== 'gcs-notificacao') return
        if (ids?.length) chamarNotificacoes('lidas', { ids }).then(atualizarContadorNotificacoes).catch(() => { })
        abrirAcaoNotificacao(acao)
    })
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && estadoNotificacoes.verificado) avaliarSinoNotificacoes()
})

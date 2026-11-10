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
        await atualizarContadorNotificacoes()
        removerOverlay()
        popup({ titulo: 'Notificações ativadas', mensagem: 'Pronto! Este aparelho vai receber as notificações do GCS.', imagem: 'imagens/concluido.png', tempo: 4 })
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
            <div class="notificacao-item ${n.lida_em ? '' : 'nao-lida'} ${!n.acao?.tipo || n.acao.tipo === 'caixa' ? 'sem-destino' : ''}" onclick="clicarNotificacao('${n.id}')">
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
    // Aviso sem destino (teste, resumo, aviso manual sem tela): dentro da caixa só marca como lido;
    // abrir "a caixa" de novo só redesenhava a mesma lista (a tela piscava).
    const { tipo } = notificacao.acao || {}
    if (!tipo || tipo === 'caixa') return
    await abrirAcaoNotificacao(notificacao.acao, notificacao.titulo)
}

async function marcarTodasNotificacoesLidas() {
    await chamarNotificacoes('lidas', { todas: true }).catch(() => { })
    estadoNotificacoes.naoLidas = 0
    renderizarSinoNotificacoes()
    document.querySelectorAll('.notificacao-item.nao-lida').forEach(item => item.classList.remove('nao-lida'))
}

// O que cada notificação abre (acao vem do servidor).
async function abrirAcaoNotificacao(acao, titulo = '') {
    const { tipo } = acao || {}
    try {
        if (tipo === 'chamado' && acao.chamado) return await atalhoAuxiliar(acao.chamado, 'chamados', 'includes')
        if (tipo === 'pagamento' && acao.id) return await abrirDetalhesPagamentos(acao.id)
        if (tipo === 'colaborador' && acao.colaborador) return await irParaColaborador(acao.colaborador, acao.requisicao)
        if (tipo === 'documentos') return await abrirDocumentosAVencer()
        if (tipo === 'precos') return await abrirPrecosVencidos(acao.lpu || null)
        // Aviso manual com mensagem formatada (editor): abre a mensagem completa.
        if (tipo === 'aviso') return abrirAvisoNotificacao(acao, titulo)
        // Push de aviso formatado traz só o id (limite de tamanho do push): busca na caixa e abre.
        if (tipo === 'notificacao' && acao.id) {
            const { notificacoes = [] } = await chamarNotificacoes('listar', { limite: 100 })
            const achada = notificacoes.find(n => String(n.id) === String(acao.id))
            return achada?.acao?.tipo && achada.acao.tipo !== 'notificacao'
                ? abrirAcaoNotificacao(achada.acao, achada.titulo)
                : abrirCaixaNotificacoes()
        }
        if (tipo === 'comunicado' && acao.id) {
            if (typeof carregarComunicadoGCS === 'function' && !comunicadoPorIdGCS(acao.id)) await carregarComunicadoGCS()
            return abrirComunicadoGCS(acao.id)
        }
        return await abrirCaixaNotificacoes()
    } catch (erro) {
        console.error('[NOTIFICACOES] abrir', erro)
    }
}

function abrirAvisoNotificacao(acao, titulo) {
    const html = typeof htmlSeguroComunicadoGCS === 'function' ? htmlSeguroComunicadoGCS(acao?.html || '') : escaparAtributo(acao?.html || '')
    popup({
        titulo: acao?.titulo || titulo || 'Aviso',
        elemento: `<div class="aviso-mensagem">${html || '<p>Sem mensagem.</p>'}</div>`
    })
}

// ---------------- Documentos do RH (adm e fin) ----------------
// Funcionários com documento vencido ou obrigatório faltando (mesma conta da tela do RH).
const estadoPendenciasRH = { lista: [], busca: '', destaque: null }

async function abrirDocumentosAVencer(funcionario = null) {
    overlayAguarde()
    try {
        const { pendencias = [] } = await chamarNotificacoes('documentos')
        Object.assign(estadoPendenciasRH, { lista: pendencias, busca: '', destaque: funcionario })
        removerOverlay()
        // Cartão de um funcionário: só o recorte dele (a lista de todos fica no "Ver todos").
        if (funcionario) {
            const pessoa = pendencias.find(f => String(f.funcionario) === String(funcionario))
            if (pessoa) return abrirPendenciaRHFuncionario(pessoa)
        }
        const aberto = document.getElementById('painelPendenciasRH')
        if (aberto) {
            renderizarPendenciasRH()
            return trazerJanelaParaFrente(aberto)
        }
        const vencidos = pendencias.filter(f => f.vencidos.length).length
        const faltando = pendencias.filter(f => f.faltantes.length).length
        popup({
            titulo: 'Documentos do RH',
            elemento: `
                <div class="painel-pendencias-rh" id="painelPendenciasRH">
                    <p class="precos-vencidos-aviso">
                        <b>${pendencias.length}</b> funcionário(s) com pendência:
                        <b>${vencidos}</b> com documento vencido e <b>${faltando}</b> faltando obrigatório.
                    </p>
                    <div class="precos-vencidos-filtros">
                        <input type="search" placeholder="Buscar funcionário, cargo ou documento" oninput="estadoPendenciasRH.busca = this.value; renderizarPendenciasRH()">
                        <button type="button" class="precos-vencidos-recarregar" onclick="removerPopup(this.closest('.popup').id); telaRH()">Abrir tela do RH</button>
                    </div>
                    <div class="precos-vencidos-tabela">
                        <table>
                            <thead><tr><th class="rh-col-funcionario" style="text-align: left;">Funcionário</th><th>Estado</th><th>Vencidos</th><th>Faltam (obrigatórios)</th></tr></thead>
                            <tbody id="corpoPendenciasRH"></tbody>
                        </table>
                    </div>
                </div>`
        })
        renderizarPendenciasRH()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: `Falha ao carregar os documentos do RH: ${escaparAtributo(erro.message)}` })
    }
}

function abrirPendenciaRHFuncionario(f) {
    const aberto = document.querySelector(`.pendencia-rh-funcionario[data-funcionario="${CSS.escape(String(f.funcionario))}"]`)
    if (aberto) return trazerJanelaParaFrente(aberto)
    const lista = (itens, classe, vazio) => itens.length
        ? `<div class="rh-lista-vertical">${itens.map(t => `<span class="documento-situacao ${classe}">${t}</span>`).join('')}</div>`
        : `<small>${vazio}</small>`
    popup({
        titulo: `Documentos do RH · ${escaparAtributo(f.nome || 'Sem nome')}`,
        elemento: `
            <div class="pendencia-rh-funcionario" data-funcionario="${escaparAtributo(String(f.funcionario))}">
                <div class="pendencia-rh-cabecalho">
                    <b>${escaparAtributo(f.nome || 'Sem nome')}</b>
                    <small>${[f.cargo, (f.estados || []).join(', ')].filter(Boolean).map(escaparAtributo).join(' · ')}</small>
                </div>
                <div class="pendencia-rh-grupos">
                    <div><small>Vencidos</small>${lista(f.vencidos.map(v => `${escaparAtributo(v.doc)} · ${escaparAtributo(v.validade || '')}`), 'vencido', 'Nenhum vencido.')}</div>
                    <div><small>Faltam (obrigatórios)</small>${lista(f.faltantes.map(escaparAtributo), 'vence', 'Nenhum obrigatório faltando.')}</div>
                </div>
                <div class="pendencia-rh-acoes">
                    <button type="button" class="precos-vencidos-recarregar" onclick="abrirDocumentosAVencer(); removerPopup(this.closest('.popup').id)">Ver todos</button>
                    <button type="button" class="precos-vencidos-validar" data-nome="${escaparAtributo(f.nome || '')}" onclick="irParaRHFuncionario(this)">Abrir no RH</button>
                </div>
            </div>`
    })
}

// Atalho: tela do RH já filtrada pelo nome do funcionário (mesmo filtro da coluna Nome).
async function irParaRHFuncionario(botao) {
    const nome = botao.dataset.nome || ''
    const janela = botao.closest('.popup')?.id
    if (janela) removerPopup(janela)
    // Tela de documentos já filtrada na pessoa, com as pastas dela abertas.
    estadoRH.visao = 'pessoa'
    estadoRH.busca = nome
    await telaRH()
    const pessoa = estadoRH.pessoas.find(p => p.nome === nome)
    if (pessoa) { estadoRH.abertos.add(pessoa.id); renderizarRH() }
}

function renderizarPendenciasRH() {
    const corpo = document.getElementById('corpoPendenciasRH')
    if (!corpo) return
    const termo = normalizarAviso(estadoPendenciasRH.busca).trim()
    const lista = estadoPendenciasRH.lista.filter(f => !termo || normalizarAviso([f.nome, f.cargo, ...f.faltantes, ...f.vencidos.map(v => v.doc)].join(' ')).includes(termo))
    corpo.innerHTML = lista.map(f => `
        <tr class="${f.funcionario === estadoPendenciasRH.destaque ? 'linha-destaque' : ''}">
            <td class="rh-col-funcionario" style="text-align: left;" title="${f.funcionario === estadoPendenciasRH.destaque ? 'Aberto pelo cartão da tela inicial' : ''}"><b>${escaparAtributo(f.nome || 'Sem nome')}</b>${f.cargo ? `<br><small>${escaparAtributo(f.cargo)}</small>` : ''}</td>
            <td>${escaparAtributo((f.estados || []).join(', '))}</td>
            <td>${f.vencidos.length ? `<div class="rh-lista-vertical">${f.vencidos.map(v => `<span class="documento-situacao vencido" title="Venceu em ${escaparAtributo(v.validade || '')}">${escaparAtributo(v.doc)} · ${escaparAtributo(v.validade || '')}</span>`).join('')}</div>` : '—'}</td>
            <td>${f.faltantes.map(d => `<span class="documento-situacao vence">${escaparAtributo(d)}</span>`).join(' ') || '—'}</td>
        </tr>`).join('') || '<tr><td colspan="4" style="padding: 1rem;">Nenhum funcionário com pendência neste filtro.</td></tr>'
    corpo.querySelector('.linha-destaque')?.scrollIntoView({ block: 'center' })
}

// ---------------- Envio manual (adm/diretoria) ----------------
// Destinatários escolhidos de listas reais (rota /notificacoes/destinatarios), sem texto livre:
// permissões em botões liga/desliga, usuários por busca (nome ou login). O resumo mostra
// quantas pessoas recebem, e "ver quem" lista os nomes antes de enviar.
const estadoAviso = { opcoes: null, todos: false, permissoes: new Set(), usuarios: new Set() }
const normalizarAviso = texto => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

async function formularioEnviarNotificacao() {
    const aberto = document.querySelector('.aviso-destino')
    if (aberto) return trazerJanelaParaFrente(aberto)
    overlayAguarde()
    try {
        estadoAviso.opcoes = await chamarNotificacoes('destinatarios')
    } catch (erro) {
        removerOverlay()
        return popup({ mensagem: escaparAtributo(erro.message) })
    }
    Object.assign(estadoAviso, { todos: false, permissoes: new Set(), usuarios: new Set() })
    removerOverlay()
    popup({
        titulo: 'Enviar aviso',
        linhas: [
            { texto: 'Título', elemento: '<input name="tituloAviso" maxlength="120" placeholder="Ex.: Sistema em manutenção às 18h">' },
            { texto: 'Mensagem', editor: '' },
            {
                texto: 'Para',
                elemento: `
                <div class="aviso-destino">
                    <label class="aviso-todos"><input type="checkbox" onchange="estadoAviso.todos = this.checked; renderizarDestinoAviso()"> Todos os usuários</label>
                    <div class="aviso-grupo"><small>Permissões</small><div class="aviso-chips" data-grupo="permissoes"></div></div>
                    <div class="aviso-grupo">
                        <small>Usuários</small>
                        <div class="aviso-selecionados"></div>
                        <input type="search" class="aviso-busca" placeholder="Buscar por nome ou usuário" oninput="buscarUsuarioAviso(this.value)" autocomplete="off">
                        <div class="aviso-resultados"></div>
                    </div>
                    <div class="aviso-resumo"></div>
                </div>`
            }
        ],
        botoes: [{ texto: 'Enviar', img: 'concluido', funcao: 'enviarNotificacaoManual(this)' }]
    })
    renderizarDestinoAviso()
}

function destinatariosAviso() {
    const { opcoes, todos, permissoes, usuarios } = estadoAviso
    return (opcoes?.usuarios || []).filter(u => todos || usuarios.has(u.usuario) ||
        (u.permissao && permissoes.has(u.permissao)))
}

function renderizarDestinoAviso() {
    const destino = document.querySelector('.aviso-destino')
    if (!destino || !estadoAviso.opcoes) return
    destino.classList.toggle('para-todos', estadoAviso.todos)
    for (const grupo of ['permissoes']) {
        destino.querySelector(`[data-grupo="${grupo}"]`).innerHTML = estadoAviso.opcoes[grupo].map(({ valor, quantidade }) => `
            <button type="button" class="aviso-chip ${estadoAviso[grupo].has(valor) ? 'ativo' : ''}"
                data-grupo="${grupo}" data-valor="${escaparAtributo(valor)}" onclick="alternarChipAviso(this)">
                ${escaparAtributo(valor)} <small>${quantidade}</small>
            </button>`).join('')
    }
    const porLogin = new Map(estadoAviso.opcoes.usuarios.map(u => [u.usuario, u]))
    destino.querySelector('.aviso-selecionados').innerHTML = [...estadoAviso.usuarios].map(login => `
        <span class="aviso-chip ativo">
            ${escaparAtributo(porLogin.get(login)?.nome || login)} <small>${escaparAtributo(login)}</small>
            <button type="button" title="Tirar" data-usuario="${escaparAtributo(login)}" onclick="removerUsuarioAviso(this)">×</button>
        </span>`).join('')
    const total = destinatariosAviso().length
    destino.querySelector('.aviso-resumo').innerHTML = total
        ? `Vai para <b>${total}</b> pessoa(s). <button type="button" onclick="verDestinatariosAviso()">ver quem</button>`
        : 'Escolha para quem vai o aviso.'
}

function alternarChipAviso(botao) {
    const conjunto = estadoAviso[botao.dataset.grupo]
    conjunto.has(botao.dataset.valor) ? conjunto.delete(botao.dataset.valor) : conjunto.add(botao.dataset.valor)
    renderizarDestinoAviso()
}

function buscarUsuarioAviso(texto) {
    const resultados = document.querySelector('.aviso-destino .aviso-resultados')
    if (!resultados) return
    const termo = normalizarAviso(texto).trim()
    if (!termo) return resultados.innerHTML = ''
    const achados = estadoAviso.opcoes.usuarios
        .filter(u => !estadoAviso.usuarios.has(u.usuario) && (normalizarAviso(u.nome).includes(termo) || normalizarAviso(u.usuario).includes(termo)))
        .slice(0, 8)
    resultados.innerHTML = achados.map(u => `
        <button type="button" class="aviso-resultado" data-usuario="${escaparAtributo(u.usuario)}" onclick="adicionarUsuarioAviso(this)">
            <b>${escaparAtributo(u.nome || u.usuario)}</b>
            <small>${escaparAtributo(u.usuario)}${u.permissao ? ` · ${escaparAtributo(u.permissao)}` : ''}</small>
        </button>`).join('') || '<small class="aviso-sem-resultado">Ninguém com esse nome.</small>'
}

function adicionarUsuarioAviso(botao) {
    estadoAviso.usuarios.add(botao.dataset.usuario)
    const busca = document.querySelector('.aviso-destino .aviso-busca')
    if (busca) { busca.value = ''; busca.focus() }
    buscarUsuarioAviso('')
    renderizarDestinoAviso()
}

function removerUsuarioAviso(botao) {
    estadoAviso.usuarios.delete(botao.dataset.usuario)
    renderizarDestinoAviso()
}

function verDestinatariosAviso() {
    const lista = destinatariosAviso()
    popup({
        titulo: `Destinatários (${lista.length})`,
        elemento: `<div class="aviso-lista-destinatarios">${lista.map(u => `
            <div><b>${escaparAtributo(u.nome || u.usuario)}</b> <small>${escaparAtributo(u.usuario)}${u.permissao ? ` · ${escaparAtributo(u.permissao)}` : ''}</small></div>`).join('')}
        </div>`
    })
}

// Editor vazio (só <br>/espaços) = sem mensagem.
function textoEditorAviso(janela) {
    return (janela.querySelector('.editor-conteudo')?.innerText || '').trim()
}

async function enviarNotificacaoManual(botao) {
    const janela = botao.closest('.popup')
    const campo = nome => janela.querySelector(`[name="${nome}"]`)
    const corpo = {
        titulo: campo('tituloAviso').value.trim(),
        html: textoEditorAviso(janela) ? janela.querySelector('.editor-conteudo').innerHTML.trim() : '',
        todos: estadoAviso.todos,
        permissoes: [...estadoAviso.permissoes],
        usuarios: [...estadoAviso.usuarios]
    }
    if (!corpo.titulo) return popup({ mensagem: 'Informe o título do aviso.' })
    const total = destinatariosAviso().length
    if (!total) return popup({ mensagem: 'Escolha para quem vai o aviso.' })
    const ok = await confirmarPopup({ titulo: 'Enviar aviso', mensagem: `Enviar <b>${escaparAtributo(corpo.titulo)}</b> para <b>${total}</b> pessoa(s)?`, textoConfirmar: 'Enviar' })
    if (!ok) return
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
// Pergunta automática, uma vez por usuário em cada aparelho, enquanto as notificações não estão
// ativas nele. Depois de respondida ("Ativar" ou "Agora não"), só pelo sino.
function chavePerguntaNotificacoes() {
    return `gcs_notificacoes_perguntado_${acesso?.usuario || ''}`
}

function perguntarNotificacoesUmaVez() {
    if (!acesso?.usuario || estadoNotificacoes.ativo || !suportaPushGCS() || iosSemInstalarGCS()) return
    if (Notification.permission === 'denied') return
    try {
        if (localStorage.getItem(chavePerguntaNotificacoes())) return
        localStorage.setItem(chavePerguntaNotificacoes(), new Date().toISOString())
    } catch { return }
    // Espera a tela inicial assentar (aniversários, comunicados) antes de perguntar.
    setTimeout(() => { if (!estadoNotificacoes.ativo) perguntarAtivarNotificacoes() }, 4000)
}

async function iniciarSinoNotificacoes() {
    renderizarSinoNotificacoes()
    await avaliarSinoNotificacoes()
    perguntarNotificacoesUmaVez()

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

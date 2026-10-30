// Colaboradores: ferramentas e materiais em mãos de funcionários e parceiros.
// Fluxo próprio, fora de ocorrências: tabela `colaboradores` (uma linha por cadastro de clientes
// com usuário), com as requisições e, em cada uma, as etapas com status da tabela `correcoes`.
// O servidor junta cadastro, composições e nomes de status na hora (gcs/SCRIPTS/colaboradores.js):
// mudar o sistema de uma composição para FERRAMENTAS reflete sem regravar nada aqui.
// Status atual = última etapa entre todas as requisições; entra no saldo só a requisição solucionada.
// visao 'andamento': fila global das requisições não solucionadas (no lugar da lista).
// contextoEtapa: ficha carregada só para atualizar status a partir da fila, sem abrir a ficha.
// historico: id da requisição cujo histórico está aberto ao lado na ficha (botão "Ver").
// visao 'relatorio': relatório geral por item (balões do topo); relatorio guarda os dados e a aba.
const estadoColaboradores = { lista: [], filtroStatus: 'TODOS', busca: '', detalhe: null, aba: 'requisicoes', requisicao: null, visao: null, andamento: [], contextoEtapa: null, historico: null, relatorio: { dados: null, aba: 'ferramentas' } }

// Status com que a requisição nasce, o mesmo das requisições de chamados (js/requisicao.js).
const etapaInicialColaborador = { tipoCorrecao: '4Zmd3', setor: ['LOGÍSTICA'] }

async function chamarColaboradores(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}/colaboradores/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok)
        throw new Error(dados.mensagem || `Falha (${resposta.status})`)
    return dados
}

function avatarColaborador({ nome, foto }, classe = '') {
    if (foto)
        return `<img class="colab-avatar moldura-foto ${classe}" src="${urlFotoCliente(foto)}" alt="" onerror="this.onerror = null; this.src = logo">`

    const iniciais = String(nome || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0])
        .join('')
        .toUpperCase()

    return `<span class="colab-avatar colab-iniciais moldura-foto ${classe}">${escaparAtributo(iniciais)}</span>`
}

// Cidade do cadastro às vezes já vem com a UF ("SALVADOR (BA)"): não repete o estado.
function localColaborador({ cidade, estado }) {
    if (!cidade) return estado || ''
    if (!estado || String(cidade).toUpperCase().includes(String(estado).toUpperCase())) return cidade
    return `${cidade} / ${estado}`
}

const numeroColab = valor => Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const numeroFinitoColab = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0
const movimentoColab = movimento => movimento == 'DEVOLUÇÃO'
    ? '<span class="colab-chip devolucao">Devolução</span>'
    : '<span class="colab-chip saida">Saída</span>'
const podeGerenciarColab = usuario => usuario == acesso.usuario || autE.includes(acesso.permissao)

async function telaColaboradores() {

    if (['cliente', 'técnico'].includes(acesso?.permissao))
        return popup({ mensagem: 'Acesso restrito à equipe interna.' })

    estadoColaboradores.detalhe = null
    estadoColaboradores.visao = null

    tela.innerHTML = `
        <div class="tela-colaboradores">
            <div class="colab-cabecalho">
                <div>
                    <h2>Ferramentas e materiais</h2>
                    <small>Requisições de funcionários e parceiros. Entra no saldo quando a requisição é solucionada.</small>
                </div>
                <div class="colab-controles">
                    <input type="search" placeholder="Buscar por nome, usuário ou cidade" value="${escaparAtributo(estadoColaboradores.busca)}"
                        oninput="estadoColaboradores.busca = this.value; renderizarListaColaboradores()">
                    <select class="colab-filtro-status" aria-label="Status atual"
                        onchange="filtrarStatusColaboradores(this.value)"></select>
                    <button type="button" onclick="formularioRequisicaoColaborador()">Nova requisição</button>
                </div>
            </div>
            <div class="colab-conteudo"><div class="colab-vazio"><img src="gifs/loading-gcs.gif" alt=""></div></div>
        </div>
    `

    await carregarListaColaboradores()
}

async function carregarListaColaboradores() {
    try {
        const { colaboradores = [] } = await chamarColaboradores('lista')
        estadoColaboradores.lista = colaboradores
        renderizarListaColaboradores()
    } catch (erro) {
        const local = document.querySelector('.colab-conteudo')
        if (local) local.innerHTML = `<div class="colab-vazio">${escaparAtributo(erro.message)}</div>`
    }
}

// Também chamado pelos atalhos de status do menu lateral.
async function filtrarStatusColaboradores(nome) {
    estadoColaboradores.filtroStatus = nome || 'TODOS'
    estadoColaboradores.visao = null

    if (!document.querySelector('.tela-colaboradores') || estadoColaboradores.detalhe)
        return telaColaboradores()

    renderizarListaColaboradores()
}

function renderizarListaColaboradores() {
    const local = document.querySelector('.colab-conteudo')
    if (!local || estadoColaboradores.detalhe)
        return

    // A busca do cabeçalho também filtra a fila global e o relatório.
    if (estadoColaboradores.visao == 'andamento')
        return renderizarAndamentoColaboradores()
    if (estadoColaboradores.visao == 'relatorio')
        return renderizarRelatorioColaboradores()

    const { filtroStatus } = estadoColaboradores
    // Filtro pelo status atual ou por qualquer status acumulado no cartão.
    const statusDoColaborador = c => [c.status?.nome, ...(c.statusAbertos || []).map(s => s.nome)].filter(Boolean)
    const status = [...new Set(estadoColaboradores.lista.flatMap(statusDoColaborador))].sort()
    const select = document.querySelector('.colab-filtro-status')
    if (select)
        select.innerHTML = ['TODOS', ...status]
            .map(s => `<option value="${escaparAtributo(s)}" ${s == filtroStatus ? 'selected' : ''}>${s == 'TODOS' ? 'Todos os status' : escaparAtributo(s)}</option>`)
            .join('')

    const busca = estadoColaboradores.busca.trim().toLowerCase()
    const lista = estadoColaboradores.lista
        .filter(c => filtroStatus == 'TODOS' || statusDoColaborador(c).includes(filtroStatus))
        .filter(c => !busca || `${c.nome || ''} ${c.usuario || ''} ${c.cidade || ''}`.toLowerCase().includes(busca))

    const soma = campo => lista.reduce((s, c) => s + Number(c[campo] || 0), 0)

    // Ferramentas, valor e materiais abrem o relatório geral por item.
    const cards = `
        <div class="colab-cards">
            <div class="colab-card"><span>Colaboradores</span><b>${lista.length}</b></div>
            <button type="button" class="colab-card colab-card-acao" onclick="abrirRelatorioColaboradores('ferramentas')" title="Relatório geral de ferramentas">
                <span>Ferramentas em mãos</span><b>${dinheiro(soma('valorEmMaos'))}</b><small>${numeroColab(soma('unidadesFerramentas'))} unidade(s)</small><small class="colab-card-link">ver relatório ›</small></button>
            <button type="button" class="colab-card colab-card-acao" onclick="abrirRelatorioColaboradores('materiais')" title="Relatório geral de materiais">
                <span>Materiais entregues</span><b>${dinheiro(soma('valorMateriais'))}</b><small>entregue menos devolvido</small><small class="colab-card-link">ver relatório ›</small></button>
            <button type="button" class="colab-card colab-card-acao ${soma('emAndamento') ? 'alerta' : ''}" onclick="abrirAndamentoColaboradores()"
                title="Ver todas as requisições em andamento"><span>Requisições em andamento</span><b>${soma('emAndamento')}</b><small>ver todas ›</small></button>
        </div>`

    // Lista em linhas: um colaborador por linha, números em colunas para comparar de relance.
    // Em tela estreita cada linha vira um bloco (css/colaboradores.css, .colab-lista).
    const linhas = lista.map(c => {
        const avisos = [
            c.termo == 'DESATUALIZADO' ? '<span class="colab-pendente">Termo desatualizado</span>' : '',
            c.termo == 'PENDENTE' ? '<span class="colab-pendente falta">Sem termo assinado</span>' : ''
        ].join('')

        return `
            <button type="button" class="colab-linha" onclick="abrirColaborador('${escaparAtributo(c.id)}')">
                <div class="colab-linha-pessoa">
                    ${avatarColaborador(c)}
                    <div>
                        <b title="${escaparAtributo(c.nome || '')}">${escaparAtributo(c.nome || 'Sem cadastro')}</b>
                        <small>${escaparAtributo([c.usuario, localColaborador(c)].filter(Boolean).join(' · '))}</small>
                    </div>
                </div>
                <div class="colab-linha-status">
                    ${statusAbertosColaborador(c)}
                    ${avisos ? `<div class="colab-linha-avisos">${avisos}</div>` : ''}
                </div>
                <div class="colab-linha-num" data-rotulo="Ferramentas em mãos">
                    <b>${c.ferramentas}</b><small>${dinheiro(c.valorEmMaos)}</small>
                </div>
                <div class="colab-linha-num" data-rotulo="Materiais entregues">
                    <b>${c.materiais || 0}</b><small>${dinheiro(c.valorMateriais)}</small>
                </div>
                <div class="colab-linha-num" data-rotulo="Requisições">
                    <b>${c.requisicoes}</b>
                    <small class="${c.emAndamento ? 'alerta' : ''}">${c.emAndamento ? `${c.emAndamento} em andamento` : 'nenhuma aberta'}</small>
                </div>
                <span class="colab-linha-seta" aria-hidden="true">›</span>
            </button>
        `
    }).join('')

    const corpo = lista.length
        ? `
            <div class="colab-lista">
                <div class="colab-lista-cabecalho" aria-hidden="true">
                    <span>Colaborador</span>
                    <span>Status em aberto</span>
                    <span class="num">Ferramentas em mãos</span>
                    <span class="num">Materiais entregues</span>
                    <span class="num">Requisições</span>
                    <span></span>
                </div>
                ${linhas}
            </div>`
        : `<div class="colab-vazio">${estadoColaboradores.lista.length
            ? 'Nenhum colaborador com esse filtro.'
            : 'Nenhuma requisição ainda. Use "Nova requisição" e escolha o colaborador.'}</div>`

    local.innerHTML = `${cards}${corpo}`
}

// Cartão da lista: um selo por status das requisições não solucionadas, com a quantidade
// quando há mais de uma. Tudo solucionado: só o status atual.
function statusAbertosColaborador(c) {
    const abertos = c.statusAbertos || []
    if (!abertos.length)
        return formatacaoTipoCorrecao(c.status?.nome || 'NÃO ANALISADA')

    return `
        <div class="colab-status-abertos">
            ${abertos.map(s => `
                <span class="colab-status-aberto">
                    ${formatacaoTipoCorrecao(s.nome)}
                    ${s.quantidade > 1 ? `<span class="colab-contador" title="Requisições com este status">${s.quantidade}</span>` : ''}
                </span>
            `).join('')}
        </div>`
}

async function abrirColaborador(id) {
    estadoColaboradores.detalhe = { id }
    estadoColaboradores.aba = 'requisicoes'
    estadoColaboradores.historico = null

    const local = document.querySelector('.colab-conteudo')
    if (!local)
        return

    local.innerHTML = `<div class="colab-vazio"><img src="gifs/loading-gcs.gif" alt=""></div>`
    await atualizarPainelColaborador(id)
}

// Atalho da tela inicial: abre direto a ficha e, vindo de uma pendência, o histórico da requisição.
async function irParaColaborador(id, idRequisicao) {
    await telaColaboradores()
    await abrirColaborador(id)
    if (idRequisicao)
        verHistoricoColaborador(idRequisicao)
}

function voltarColaboradores() {
    estadoColaboradores.detalhe = null
    telaColaboradores()
}

// Chamado também depois de salvar uma requisição/etapa e pelo websocket.
async function atualizarPainelColaborador(id) {
    const local = document.querySelector('.colab-conteudo')
    if (!local || estadoColaboradores.detalhe?.id !== id)
        return

    try {
        estadoColaboradores.detalhe = { id, ...await chamarColaboradores('detalhe', { id }) }
        renderizarPainelColaborador()
    } catch (erro) {
        local.innerHTML = `<div class="colab-vazio">${escaparAtributo(erro.message)}</div>`
    }
}

// Websocket (tabela colaboradores): atualiza a tela aberta e os atalhos do menu.
async function atualizarColaboradoresWS() {
    if (document.querySelector('.tela-colaboradores')) {
        const id = estadoColaboradores.detalhe?.id
        if (id) await atualizarPainelColaborador(id)
        else if (estadoColaboradores.visao == 'andamento') await carregarAndamentoColaboradores()
        else if (estadoColaboradores.visao == 'relatorio') await carregarRelatorioColaboradores()
        else await carregarListaColaboradores()
    }
}

// ---------------- Fila global (requisições em andamento) ----------------

async function abrirAndamentoColaboradores() {
    estadoColaboradores.visao = 'andamento'
    const local = document.querySelector('.colab-conteudo')
    if (local)
        local.innerHTML = `<div class="colab-vazio"><img src="gifs/loading-gcs.gif" alt=""></div>`
    await carregarAndamentoColaboradores()
}

function voltarListaColaboradores() {
    estadoColaboradores.visao = null
    renderizarListaColaboradores()
}

async function carregarAndamentoColaboradores() {
    try {
        const { requisicoes = [] } = await chamarColaboradores('andamento')
        estadoColaboradores.andamento = requisicoes
        renderizarAndamentoColaboradores()
    } catch (erro) {
        const local = document.querySelector('.colab-conteudo')
        if (local) local.innerHTML = `<div class="colab-vazio">${escaparAtributo(erro.message)}</div>`
    }
}

function renderizarAndamentoColaboradores() {
    const local = document.querySelector('.colab-conteudo')
    if (!local || estadoColaboradores.detalhe || estadoColaboradores.visao != 'andamento')
        return

    const busca = estadoColaboradores.busca.trim().toLowerCase()
    const dataRequisicao = r => {
        const ts = Number(r.ts)
        if (Number.isFinite(ts) && ts > 0) return ts
        const data = toTimestamp(r.data)
        return Number.isFinite(data) ? data : Infinity
    }
    const lista = estadoColaboradores.andamento
        .filter(r => !busca || `${r.colaborador?.nome || ''} ${r.colaborador?.usuario || ''} ${r.colaborador?.cidade || ''}`.toLowerCase().includes(busca))
        .sort((a, b) => dataRequisicao(a) - dataRequisicao(b))

    const itensResumo = itens => {
        const visiveis = itens.slice(0, 4)
            .map(i => `<span class="colab-escolhido">${numeroColab(i.quantidade)} ${escaparAtributo(i.unidade)} · ${escaparAtributo(i.descricao || i.codigo)}</span>`)
            .join('')
        return visiveis + (itens.length > 4 ? `<small>+${itens.length - 4} item(ns)</small>` : '')
    }

    const cards = lista.map(r => {
        const { colaborador = {}, etapa } = r
        const responsavel = etapa?.executor?.length
            ? `Executores: ${etapa.executor.join(', ')}`
            : etapa?.setor?.length ? `Setor: ${etapa.setor.join(', ')}` : ''
        const idColab = escaparAtributo(colaborador.id)
        const idReq = escaparAtributo(r.id)

        return `
            <div class="colab-movimento colab-fila-item">
                <div class="colab-fila-colaborador">
                    ${avatarColaborador(colaborador)}
                    <div class="colab-movimento-info">
                        <b>${escaparAtributo(colaborador.nome || 'Sem cadastro')}</b>
                        <div>${movimentoColab(r.movimento)} ${formatacaoTipoCorrecao(r.status)}</div>
                        <small>${escaparAtributo(r.data)} · ${escaparAtributo(r.usuario)} · ${r.itens.length} item(ns) · ${dinheiro(r.total)}</small>
                        ${responsavel ? `<small>${escaparAtributo(responsavel)}</small>` : ''}
                        ${etapa?.descricao ? `<small class="colab-comentario">${escaparAtributo(etapa.descricao)}</small>` : ''}
                        <div class="colab-escolhidos-lista">${itensResumo(r.itens)}</div>
                    </div>
                </div>
                <div class="colab-movimento-acoes">
                    <button type="button" onclick="statusAndamentoColaborador('${idColab}', '${idReq}')">Atualizar status</button>
                    <button type="button" class="secundario" onclick="abrirColaborador('${idColab}')">Abrir ficha</button>
                </div>
            </div>
        `
    }).join('')

    local.innerHTML = `
        <div class="colab-fila">
            <div class="colab-fila-topo">
                <button type="button" class="colab-voltar" onclick="voltarListaColaboradores()" title="Voltar para a lista de colaboradores">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                        <path d="M19 12H5M11 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Voltar</span>
                </button>
                <div>
                    <h3>Requisições em andamento <span class="colab-contador ${lista.length ? 'alerta' : 'zerado'}">${lista.length}</span></h3>
                    <small>De todos os colaboradores, da mais antiga para a mais nova.</small>
                </div>
            </div>
            ${cards || '<div class="colab-vazio">Nenhuma requisição em andamento.</div>'}
        </div>
    `
}

// ---------------- Relatório geral (balões do topo) ----------------

async function abrirRelatorioColaboradores(aba = 'ferramentas') {
    estadoColaboradores.visao = 'relatorio'
    estadoColaboradores.relatorio.aba = aba
    const local = document.querySelector('.colab-conteudo')
    if (local)
        local.innerHTML = `<div class="colab-vazio"><img src="gifs/loading-gcs.gif" alt=""></div>`
    await carregarRelatorioColaboradores()
}

async function carregarRelatorioColaboradores() {
    try {
        estadoColaboradores.relatorio.dados = await chamarColaboradores('relatorio')
        renderizarRelatorioColaboradores()
    } catch (erro) {
        const local = document.querySelector('.colab-conteudo')
        if (local) local.innerHTML = `<div class="colab-vazio">${escaparAtributo(erro.message)}</div>`
    }
}

function trocarAbaRelatorioColab(aba) {
    estadoColaboradores.relatorio.aba = aba
    renderizarRelatorioColaboradores()
}

function renderizarRelatorioColaboradores() {
    const local = document.querySelector('.colab-conteudo')
    const { dados, aba } = estadoColaboradores.relatorio
    if (!local || !dados || estadoColaboradores.detalhe || estadoColaboradores.visao != 'relatorio')
        return

    const ferramenta = aba == 'ferramentas'
    const { totais = {} } = dados

    // A busca do cabeçalho filtra por item (código/descrição) ou por quem tem o item.
    const busca = estadoColaboradores.busca.trim().toLowerCase()
    const itens = (dados[aba] || [])
        .filter(i => !busca || [i.codigo, i.descricao, i.modelo, i.fabricante, ...i.colaboradores.map(c => c.nome)]
            .join(' ').toLowerCase().includes(busca))

    const total = itens.reduce((s, i) => s + i.valor, 0)

    const resumo = (titulo, t = {}, chave) => `
        <button type="button" class="colab-card colab-card-acao ${aba == chave ? 'selecionado' : ''}" onclick="trocarAbaRelatorioColab('${chave}')">
            <span>${titulo}</span><b>${dinheiro(t.valor)}</b>
            <small>${t.itens || 0} item(ns) · ${numeroColab(t.quantidade)} unidade(s)</small>
        </button>`

    const linhas = itens.map(i => `
        <tr>
            <td><img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
            <td>${escaparAtributo(i.codigo)}</td>
            <td>
                <div class="colab-relatorio-descricao">
                    <span>${escaparAtributo(i.descricao || '')}</span>
                    ${i.modelo || i.fabricante ? `<small>${escaparAtributo([i.modelo, i.fabricante].filter(Boolean).join(' · '))}</small>` : ''}
                </div>
            </td>
            <td>${escaparAtributo(i.unidade)}</td>
            <td class="num">${numeroColab(i.entregue)}</td>
            <td class="num">${numeroColab(i.devolvido)}</td>
            <td class="num"><b>${numeroColab(i.quantidade)}</b></td>
            <td class="num">${dinheiro(i.valor)}</td>
            <td>
                <div class="colab-relatorio-quem">
                    ${i.colaboradores.map(c => `
                        <button type="button" onclick="abrirColaborador('${escaparAtributo(c.id)}')"
                            title="Abrir a ficha">${escaparAtributo(c.nome || 'Sem cadastro')} · <b>${numeroColab(c.quantidade)}</b></button>
                    `).join('')}
                </div>
            </td>
        </tr>
    `).join('')

    local.innerHTML = `
        <div class="colab-fila">
            <div class="colab-fila-topo">
                <button type="button" class="colab-voltar" onclick="voltarListaColaboradores()" title="Voltar para a lista de colaboradores">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                        <path d="M19 12H5M11 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Voltar</span>
                </button>
                <div>
                    <h3>Relatório geral</h3>
                    <small>Todos os colaboradores somados por item. Conta só requisições solucionadas; valor pelo custo da última saída.</small>
                </div>
            </div>

            <div class="colab-cards">
                ${resumo('Ferramentas em mãos', totais.ferramentas, 'ferramentas')}
                ${resumo('Materiais entregues', totais.materiais, 'materiais')}
            </div>

            ${itens.length ? `
                <div class="colab-tabela-rolagem">
                    <table class="colab-tabela">
                        <thead>
                            <tr>
                                <th></th><th>Código</th><th>Descrição</th><th>Un.</th>
                                <th class="num">Entregue</th><th class="num">Devolvido</th>
                                <th class="num">${ferramenta ? 'Em mãos' : 'Líquido'}</th>
                                <th class="num">Valor</th>
                                <th>Com quem</th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="7" class="num"><b>Total${busca ? ' (filtrado)' : ''}</b></td>
                                <td class="num"><b>${dinheiro(total)}</b></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>`
            : `<div class="colab-vazio">${busca
                ? 'Nenhum item com essa busca.'
                : ferramenta ? 'Nenhuma ferramenta em mãos.' : 'Nenhum material entregue.'}</div>`}
        </div>
    `
}

// Atualizar status direto da fila: carrega a ficha sem sair da fila.
async function statusAndamentoColaborador(idColaborador, idRequisicao) {
    overlayAguarde()
    try {
        estadoColaboradores.contextoEtapa = { id: idColaborador, ...await chamarColaboradores('detalhe', { id: idColaborador }) }
    } catch (erro) {
        return popup({ mensagem: erro.message })
    }
    removerOverlay()
    await formularioEtapaColaborador(idRequisicao)
}

// Ficha usada pelo formulário de etapa: a aberta na tela ou a carregada pela fila.
function fichaEtapaColaborador() {
    return estadoColaboradores.detalhe?.requisicoes
        ? estadoColaboradores.detalhe
        : estadoColaboradores.contextoEtapa || {}
}

// Depois de salvar/excluir uma etapa: atualiza o que estiver aberto (ficha ou fila).
async function recarregarDepoisDaEtapa(id) {
    if (estadoColaboradores.detalhe?.id == id)
        return atualizarPainelColaborador(id)
    if (estadoColaboradores.visao == 'andamento')
        return carregarAndamentoColaboradores()
}

function renderizarPainelColaborador() {
    const local = document.querySelector('.colab-conteudo')
    const { id, colaborador = {}, itens = [], requisicoes = [], termo = {} } = estadoColaboradores.detalhe || {}
    if (!local)
        return

    const ferramentas = itens.filter(i => i.classe == 'FERRAMENTA' && i.saldo > 0)
    const materiais = itens.filter(i => i.classe == 'MATERIAL' && (i.entregue > 0 || i.utilizado > 0))
    const contador = n => `<span class="colab-contador ${n ? '' : 'zerado'}">${n}</span>`
    // Requisições: o contador só aparece com alguma ainda não solucionada (cancelada não conta).
    const emAndamento = requisicoes.filter(r => !r.concluida && !r.cancelada).length
    const abas = {
        requisicoes: `Requisições ${emAndamento ? `<span class="colab-contador alerta" title="Em andamento">${emAndamento}</span>` : ''}`,
        maos: `Ferramentas em mãos ${contador(ferramentas.length)}`,
        materiais: `Saldo de materiais ${contador(materiais.length)}`
    }

    const conteudoAba = {
        maos: () => tabelaItensColaborador(ferramentas, true),
        materiais: () => tabelaItensColaborador(materiais, false),
        requisicoes: () => listaRequisicoesColaborador(requisicoes)
    }[estadoColaboradores.aba]()

    // Requisição excluída (ou de outra ficha) fecha o painel do histórico.
    const requisicaoAberta = requisicoes.find(r => r.id == estadoColaboradores.historico)
    if (!requisicaoAberta)
        estadoColaboradores.historico = null
    // O histórico acompanha a lista de requisições: nas outras abas fica guardado, sem aparecer.
    const historicoVisivel = requisicaoAberta && estadoColaboradores.aba == 'requisicoes'

    local.innerHTML = `
        <div class="colab-painel">
            <div class="colab-painel-topo">
                <button type="button" class="colab-voltar" onclick="voltarColaboradores()" title="Voltar para a lista de colaboradores">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                        <path d="M19 12H5M11 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Voltar</span>
                </button>
                <div class="colab-identificacao">
                    ${avatarColaborador(colaborador, 'grande')}
                    <div>
                        <h3>${escaparAtributo(colaborador.nome || 'Sem cadastro')}</h3>
                        <small>${escaparAtributo([colaborador.usuario, colaborador.setor, colaborador.permissao, [colaborador.cidade, colaborador.estado].filter(Boolean).join(' / ')].filter(Boolean).join(' · '))}</small>
                    </div>
                </div>
                <div class="colab-acoes">
                    <button type="button" onclick="formularioRequisicaoColaborador({ colaborador: '${escaparAtributo(id)}' })">Nova requisição</button>
                    <button type="button" class="secundario" onclick="formularioRequisicaoColaborador({ colaborador: '${escaparAtributo(id)}', movimento: 'DEVOLUÇÃO' })" ${itens.some(i => i.saldo > 0) ? '' : 'disabled title="Nada em mãos para devolver"'}>Registrar devolução</button>
                </div>
            </div>

            ${blocoTermoColaborador(termo, ferramentas.length)}
            <div class="colab-cards">
                <div class="colab-card"><span>Ferramentas em mãos</span><b>${numeroColab(colaborador.unidadesFerramentas)}</b><small>${colaborador.ferramentas || 0} item(ns) diferentes</small></div>
                <div class="colab-card"><span>Valor em mãos</span><b>${dinheiro(colaborador.valorEmMaos)}</b><small>a recuperar na saída do colaborador</small></div>
                <div class="colab-card"><span>Materiais entregues</span><b>${colaborador.materiais || 0}</b><small>itens de consumo</small></div>
                <div class="colab-card ${colaborador.emAndamento ? 'alerta' : ''}"><span>Em andamento</span><b>${colaborador.emAndamento || 0}</b><small>só contam depois de solucionadas</small></div>
            </div>

            <div class="colab-ficha ${historicoVisivel ? 'com-historico' : ''}">

                <div class="colab-ficha-saldo">
                    <div class="colab-abas" role="tablist">
                        ${Object.entries(abas).map(([chave, texto]) => `
                            <button type="button" role="tab" class="${estadoColaboradores.aba == chave ? 'ativo' : ''}"
                                onclick="estadoColaboradores.aba = '${chave}'; renderizarPainelColaborador()">${texto}</button>
                        `).join('')}
                    </div>

                    <div class="colab-aba-conteudo">${conteudoAba}</div>
                </div>

                ${historicoVisivel ? historicoColaborador(requisicaoAberta) : ''}

            </div>
        </div>
    `
}

// Abre/fecha ao lado o histórico de uma requisição (botão "Ver" da lista).
function verHistoricoColaborador(idRequisicao) {
    estadoColaboradores.historico = estadoColaboradores.historico == idRequisicao ? null : idRequisicao
    renderizarPainelColaborador()
}

// Mesmo desenho do histórico de correções dos chamados: mais recente por cima e, no
// cabeçalho, uma aba com o status atual da requisição.
function historicoColaborador(requisicao) {

    const modelo = (titulo, valor) => valor
        ? `
            <div class="colab-etapa-linha">
                <label><b>${titulo}</b></label>
                <div>${valor}</div>
            </div>`
        : ''

    const etapas = requisicao.etapas.map(e => {
        const acoes = podeGerenciarColab(e.usuario)
            ? `
                <div class="colab-etapa-acoes">
                    <button type="button" onclick="formularioEtapaColaborador('${escaparAtributo(e.requisicao)}', '${escaparAtributo(e.id)}')">Editar</button>
                    <button type="button" style="background-color: #B12425;" onclick="confirmarExcluirEtapaColaborador('${escaparAtributo(e.requisicao)}', '${escaparAtributo(e.id)}')">Excluir</button>
                </div>`
            : ''

        return `
            <div class="detalhes-correcoes-1 colab-etapa">
                ${modelo('Status', formatacaoTipoCorrecao(e.nome))}
                ${modelo('Setor', escaparAtributo(e.setor.join(', ')))}
                ${modelo('Executores', escaparAtributo(e.executor.join(', ')))}
                ${modelo('Solicitante', escaparAtributo(e.usuario))}
                ${modelo('Descrição', `<div style="white-space: pre-wrap;">${escaparAtributo(e.descricao)}</div>`)}
                ${modelo('Criado em', escaparAtributo(e.data))}
                ${acoes}
            </div>`
    }).join('')

    const itens = requisicao.itens.map(i => `
        <div class="colab-req-item">
            <img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo">
            <div class="colab-req-item-info">
                <span>${escaparAtributo(i.descricao || i.codigo)}</span>
                <small>${escaparAtributo(i.codigo)} · ${i.classe == 'FERRAMENTA' ? 'Ferramenta' : 'Material'} · ${dinheiro(i.custo)} / ${escaparAtributo(i.unidade)}</small>
            </div>
            <div class="colab-req-item-qtde">
                <b>${numeroColab(i.quantidade)} ${escaparAtributo(i.unidade)}</b>
                <small>${dinheiro(i.quantidade * i.custo)}</small>
            </div>
        </div>
    `).join('')

    return `
        <div class="colab-historico">
            <div class="colab-req-itens">
                <div class="colab-req-itens-topo">
                    <b>Itens <span class="colab-contador">${requisicao.itens.length}</span></b>
                    <button type="button" class="secundario" onclick="pdfRequisicaoColaborador('${escaparAtributo(requisicao.id)}')">PDF</button>
                </div>
                <div class="colab-req-itens-lista">${itens || '<div class="colab-vazio">Sem itens.</div>'}</div>
                <div class="colab-req-itens-total"><span>Total</span><b>${dinheiro(requisicao.total)}</b></div>
            </div>
            <div class="colab-historico-topo">
                <div class="aba-correcao" title="Status atual">${formatacaoTipoCorrecao(requisicao.status || 'NÃO ANALISADA')}</div>
                <button type="button" class="colab-incluir-correcao" onclick="formularioEtapaColaborador('${escaparAtributo(requisicao.id)}')">Incluir Correção</button>
            </div>
            <div class="colab-historico-lista">
                ${etapas || '<div class="colab-vazio">Sem histórico ainda.</div>'}
            </div>
        </div>
    `
}

function tabelaItensColaborador(itens, ferramenta) {
    if (!itens.length)
        return `<div class="colab-vazio">${ferramenta ? 'Nenhuma ferramenta em mãos.' : 'Nenhum material entregue.'}</div>`

    return `
        <div class="colab-tabela-rolagem">
            <table class="colab-tabela">
                <thead>
                    <tr>
                        <th></th><th>Código</th><th>Descrição</th><th>Un.</th>
                        <th class="num">Entregue</th><th class="num">Devolvido</th>
                        <th class="num">Utilizado em Kit Técnico</th>
                        <th class="num">${ferramenta ? 'Em mãos' : 'Saldo'}</th>
                        <th class="num">Valor unit.</th>
                        ${ferramenta ? '<th class="num">Total em mãos</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${itens.map(i => `
                        <tr>
                            <td><img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
                            <td>${escaparAtributo(i.codigo)}</td>
                            <td>${escaparAtributo(i.descricao)}</td>
                            <td>${escaparAtributo(i.unidade)}</td>
                            <td class="num">${numeroColab(i.entregue)}</td>
                            <td class="num">${numeroColab(i.devolvido)}</td>
                            <td class="num">${numeroColab(i.utilizado)}</td>
                            <td class="num"><b>${numeroColab(i.saldo)}</b></td>
                            <td class="num">${dinheiro(i.custo)}</td>
                            ${ferramenta ? `<td class="num">${dinheiro(i.saldo * i.custo)}</td>` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `
}

function podeEditarRequisicaoColaborador(r) {
    const etapas = Object.values(r?.etapas || {})
    return !!r && podeGerenciarColab(r.usuario) && !r.concluida && !r.cancelada
        && etapas.length > 0 && etapas.every(e => e.tipoCorrecao == etapaInicialColaborador.tipoCorrecao)
}

function listaRequisicoesColaborador(requisicoes) {
    if (!requisicoes.length)
        return `<div class="colab-vazio">Nenhuma requisição.</div>`

    return `
        <div class="colab-movimentos">
            ${requisicoes.map(r => {
                const devolucao = r.movimento == 'DEVOLUÇÃO'
                const excluir = !r.concluida && podeGerenciarColab(r.usuario)
                    ? `<button type="button" class="perigo" onclick="confirmarExcluirRequisicaoColaborador('${escaparAtributo(r.id)}')">Excluir esta requisição</button>`
                    : ''
                const aberta = estadoColaboradores.historico == r.id
                return `
                    <div class="colab-movimento ${devolucao ? 'devolucao' : 'saida'} ${aberta ? 'selecionada' : ''}">
                        <div class="colab-movimento-info">
                            <div>${movimentoColab(r.movimento)} ${formatacaoTipoCorrecao(r.status)}</div>
                            <small>${escaparAtributo(r.data)} · ${escaparAtributo(r.usuario)} · ${r.itens.length} item(ns) · ${dinheiro(r.total)}</small>
                            ${r.comentario ? `<small class="colab-comentario">${escaparAtributo(r.comentario)}</small>` : ''}
                        </div>
                        <div class="colab-movimento-acoes">
                            ${podeEditarRequisicaoColaborador(r) ? `<button type="button" onclick="formularioRequisicaoColaborador({ colaborador: '${escaparAtributo(estadoColaboradores.detalhe.id)}', idRequisicao: '${escaparAtributo(r.id)}' })">Editar requisição</button>` : ''}
                            ${excluir}
                            <button type="button" ${aberta ? 'class="ativo"' : ''} onclick="verHistoricoColaborador('${escaparAtributo(r.id)}')">${aberta ? 'Ocultar' : 'Ver'}</button>
                        </div>
                    </div>
                `
            }).join('')}
        </div>
    `
}

// ---------------- Requisição ----------------

// LPUs mostradas nos detalhes da linha da requisição.
const lpusDetalheColab = ['lpu ferramentas', 'lpu hope', 'lpu peças']

const valorLpuColab = (produto, lpu) => {
    const tabela = produto?.[lpu]
    return Number(produto?.snapshots?.[lpu]?.[0] || tabela?.historico?.[tabela?.ativo]?.valor || 0)
}

// Preço da composição: a primeira LPU com valor, começando pela de ferramentas.
function lpuCustoColab(produto) {
    // LPUS começa null (ferramentas.js) e só é carregada por orçamentos/composições.
    const lpus = ['lpu ferramentas', 'lpu peças', 'lpu hope', ...(typeof LPUS !== 'undefined' && Array.isArray(LPUS) ? LPUS : [])]
        .map(l => String(l).toLowerCase())

    return lpus.find(lpu => valorLpuColab(produto, lpu) > 0) || null
}

function custoComposicaoColab(produto) {
    const lpu = lpuCustoColab(produto)
    return lpu ? valorLpuColab(produto, lpu) : 0
}

// colaborador: id em clientes (aberto pela ficha) ou vazio para escolher na hora.
async function formularioRequisicaoColaborador({ colaborador = null, movimento = 'SAÍDA', idRequisicao = null } = {}) {

    let existente
    if (idRequisicao) {
        const ficha = await chamarColaboradores('detalhe', { id: colaborador })
        existente = ficha.requisicoes?.find(r => r.id == idRequisicao)
        if (!podeEditarRequisicaoColaborador(existente))
            return popup({ mensagem: 'Só é possível editar requisições na etapa inicial de Logística, pelo autor ou gestores.' })
        movimento = existente.movimento
    }

    overlayAguarde()

    estadoColaboradores.requisicao = { colaborador, movimento, idRequisicao, itensOriginais: existente?.itens || [],
        itens: Object.fromEntries((existente?.itens || []).map(i => [i.codigo, {
            ...i, qtde: numeroFinitoColab(i.qtde ?? i.quantidade), custo: numeroFinitoColab(i.custo)
        }])) }

    const { nome } = colaborador ? await recuperarDado('clientes', colaborador) || {} : {}

    // Filtro oculto: só cadastros com usuário (funcionários e parceiros com acesso).
    controlesCxOpcoes.colaboradorRequisicao = {
        base: 'clientes',
        filtros: { usuario: { op: 'NOT_EMPTY' } },
        retornar: ['nome'],
        funcaoAdicional: 'trocarColaboradorRequisicao',
        colunas: {
            'Nome': { chave: 'nome' },
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' },
            'Cidade': { chave: 'cidade' }
        }
    }

    const campoColaborador = colaborador
        ? `<span>${escaparAtributo(nome || colaborador)}</span>`
        : `<span class="opcoes" name="colaboradorRequisicao" onclick="cxOpcoes('colaboradorRequisicao')">Selecione</span>`

    const elemento = `
        <div class="colab-requisicao">
            <div class="colab-requisicao-campos">
                <label>Colaborador ${campoColaborador}</label>
                <div class="colab-segmento" role="group" aria-label="Movimento">
                    ${['SAÍDA', 'DEVOLUÇÃO'].map(m => `
                        <button type="button" data-movimento="${m}" class="${m == movimento ? 'ativo' : ''}"
                            ${idRequisicao ? 'disabled' : ''} onclick="trocarMovimentoColab('${m}')">${m == 'SAÍDA' ? 'Saída' : 'Devolução'}</button>
                    `).join('')}
                </div>
                <label class="colab-requisicao-comentario">Comentário
                    <textarea id="comentarioColab" rows="2">${escaparAtributo(existente?.comentario || '')}</textarea>
                </label>
            </div>
            <div id="colabEscolhidos" class="colab-escolhidos"></div>
            <div id="colabItensRequisicao"></div>
        </div>
    `

    popup({
        elemento,
        titulo: 'Requisição de ferramentas e materiais',
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarRequisicaoColaborador()' }],
        autoDestruicao: ['colaboradorRequisicao', 'reqColab']
    })

    await renderizarItensRequisicaoColab()
    removerOverlay()
}

async function trocarColaboradorRequisicao() {
    const id = document.querySelector('[name="colaboradorRequisicao"]')?.id
    if (!id || !estadoColaboradores.requisicao)
        return

    estadoColaboradores.requisicao.colaborador = id
    if (estadoColaboradores.requisicao.movimento == 'DEVOLUÇÃO') {
        estadoColaboradores.requisicao.itens = {}
        await renderizarItensRequisicaoColab()
    }
}

async function trocarMovimentoColab(movimento) {
    const estado = estadoColaboradores.requisicao
    if (!estado || estado.movimento == movimento)
        return

    estado.movimento = movimento
    estado.itens = {}
    document.querySelectorAll('.colab-requisicao [data-movimento]')
        .forEach(b => b.classList.toggle('ativo', b.dataset.movimento == movimento))

    await renderizarItensRequisicaoColab()
}

// Saída: base de composições inteira, com pesquisa. Devolução: só o que está em mãos.
async function renderizarItensRequisicaoColab() {
    const local = document.getElementById('colabItensRequisicao')
    const { colaborador, movimento } = estadoColaboradores.requisicao || {}
    if (!local)
        return

    atualizarEscolhidosColab()

    if (movimento == 'DEVOLUÇÃO') {

        if (!colaborador) {
            local.innerHTML = '<div class="colab-vazio">Escolha o colaborador para ver o que está em mãos.</div>'
            return
        }

        local.innerHTML = '<div class="colab-vazio"><img src="gifs/loading-gcs.gif" alt=""></div>'

        let emMaos = []
        try {
            const { itens = [] } = await chamarColaboradores('detalhe', { id: colaborador })
            const estado = estadoColaboradores.requisicao
            emMaos = itens.filter(i => i.saldo > 0).map(i => {
                const original = estado.itensOriginais?.find(item => item.codigo == i.codigo)
                const propria = estado.idRequisicao ? numeroFinitoColab(original?.qtde ?? original?.quantidade) : 0
                return { ...i, disponivel: (i.disponivel ?? i.saldo) + propria, emDevolucao: Math.max(0, (i.emDevolucao || 0) - propria) }
            })
        } catch (erro) {
            emMaos = []
        }

        // Pode devolver = em mãos menos o que já está em outra devolução ainda não solucionada.
        const disponivel = i => i.disponivel ?? i.saldo
        const algumDisponivel = emMaos.some(i => disponivel(i) > 0)

        local.innerHTML = emMaos.length
            ? `
                <div class="colab-devolucao-ajuda">
                    <span>Informe <b>quanto volta de cada item</b> na coluna Devolver. Pode ser só parte da quantidade.
                        O que ficar em branco continua com o colaborador.</span>
                    <button type="button" class="secundario" onclick="devolverTudoColab()" ${algumDisponivel ? '' : 'disabled'}>Devolver tudo</button>
                </div>
                <div class="colab-tabela-rolagem">
                    <table class="colab-tabela">
                        <thead>
                            <tr>
                                <th></th><th>Código</th><th>Descrição</th><th>Un.</th>
                                <th class="num">Em mãos</th>
                                <th class="num" title="Em outra devolução ainda não solucionada">Em devolução</th>
                                <th class="num">Pode devolver</th>
                                <th class="num">Devolver</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${emMaos.map(i => `
                                <tr data-codigo="${escaparAtributo(i.codigo)}" data-custo="${i.custo}" data-descricao="${escaparAtributo(i.descricao)}" data-unidade="${escaparAtributo(i.unidade)}">
                                    <td><img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
                                    <td>${escaparAtributo(i.codigo)}</td>
                                    <td>${escaparAtributo(i.descricao)}</td>
                                    <td>${escaparAtributo(i.unidade)}</td>
                                    <td class="num">${numeroColab(i.saldo)}</td>
                                    <td class="num">${i.emDevolucao ? numeroColab(i.emDevolucao) : '—'}</td>
                                    <td class="num"><b>${numeroColab(disponivel(i))}</b></td>
                                    <td class="num">
                                        <div class="colab-devolver">
                                            <input class="colab-qtde" type="number" min="0" max="${disponivel(i)}" step="any" placeholder="0"
                                                value="${estadoColaboradores.requisicao.itens[i.codigo]?.qtde || ''}"
                                                ${disponivel(i) > 0 ? '' : 'disabled title="Tudo já está em outra devolução"'} oninput="qtdeItemColab(this)">
                                            <button type="button" class="secundario" onclick="devolverTudoColab(this)" ${disponivel(i) > 0 ? '' : 'disabled'}>Tudo</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`
            : `<div class="colab-vazio">Este colaborador não tem itens em mãos para devolver.
                Só entram em mãos as requisições de saída já solucionadas.</div>`
        return
    }

    // A pesquisa da tabela anterior não deve vazar para a nova requisição.
    delete controles.reqColab

    // Mesmo atalho do orçamento: cadastra a composição sem sair da requisição.
    const criarItem = permComposicoes.includes(acesso.permissao)
        ? `<button type="button" class="colab-criar-item" onclick="cadastrarItem()">
                <img src="imagens/baixar.png" alt="">Criar item
            </button>`
        : ''

    local.innerHTML = await modTab({
        base: 'dados_composicoes',
        pag: 'reqColab',
        body: 'bodyReqColab',
        btnExtras: criarItem,
        detalhes: true,
        // 60dvh é o teto da altura mínima em css/tabelas.css; com espaço sobrando no popup, cresce mais.
        alturaMinima: '60dvh',
        criarLinha: 'linhaComposicaoColab',
        colunas: {
            'Imagem': {},
            'Código': { chave: 'id' },
            'Descrição': { chave: 'descricao' },
            'Sistema': { chave: 'sistema', tipoPesquisa: 'select' },
            'Unidade': { chave: 'unidade' },
            'Valor': {},
            'Quantidade': {}
        }
    })

    await paginacao('reqColab')
}

function linhaComposicaoColab(produto) {
    const { descricao, sistema, unidade, imagem, modelo, fabricante } = produto || {}
    const codigo = String(produto?.id ?? produto?.codigo ?? '')
    const custo = custoComposicaoColab(produto)
    const qtde = estadoColaboradores.requisicao?.itens?.[codigo]?.qtde || ''
    const detalhes = [modelo, fabricante].filter(Boolean).join(' · ')

    // Detalhes (+): preço em cada LPU, no mesmo bloco de "Preços por tabela" de composições
    // (css/composicoes.css).
    const precos = `
        <div class="composicao-detalhes colab-detalhes-precos">
            <section class="composicao-bloco composicao-bloco-precos">
                <div class="composicao-bloco-topo"><h3>Preços por tabela</h3></div>
                <div class="composicao-tabela-contorno"><table class="composicao-tabela">
                    <thead><tr>${lpusDetalheColab.map(lpu => `<th>${lpu.toUpperCase()}</th>`).join('')}</tr></thead>
                    <tbody><tr>${lpusDetalheColab.map(lpu => {
                        const valor = valorLpuColab(produto, lpu)
                        return `
                            <td class="composicao-numero">
                                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
                                    ? `<button type="button" class="composicao-preco ${valor > 0 ? '' : 'sem-valor'}" title="Ver histórico de preços"
                                        onclick="abrirHistoricoPrecosSobre('${escaparAtributo(codigo)}', '${lpu}')">${dinheiro(valor)}</button>`
                                    : `<span class="composicao-preco ${valor > 0 ? '' : 'sem-valor'}">${dinheiro(valor)}</span>`}
                            </td>`
                    }).join('')}</tr></tbody>
                </table></div>
            </section>
        </div>`

    const linha = `
        <tr class="${qtde ? 'escolhido' : ''}" data-codigo="${escaparAtributo(codigo)}" data-custo="${custo}" data-descricao="${escaparAtributo(descricao)}" data-unidade="${escaparAtributo(unidade)}">
            <td><img class="colab-miniatura" src="${imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
            <td>${escaparAtributo(codigo)}</td>
            <td style="text-align: left;">
                <div style="${vertical}; gap: 2px;">
                    <span>${escaparAtributo(descricao)}</span>
                    ${detalhes ? `<small>${escaparAtributo(detalhes)}</small>` : ''}
                </div>
            </td>
            <td>${sistema == 'FERRAMENTAS' ? '<span class="colab-chip">FERRAMENTA</span>' : escaparAtributo(sistema)}</td>
            <td>${escaparAtributo(unidade)}</td>
            <td style="white-space: nowrap;">${dinheiro(custo)}</td>
            <td><input class="colab-qtde" type="number" min="0" step="any" value="${qtde}" oninput="qtdeItemColab(this)"></td>
        </tr>
    `

    return { linha, detalhes: precos }
}

function qtdeItemColab(input) {
    const estado = estadoColaboradores.requisicao
    const linha = input.closest('tr')
    if (!estado || !linha)
        return

    const maximo = Number(input.max)
    if (input.max !== '' && Number(input.value) > maximo)
        input.value = maximo

    const { codigo, custo, descricao, unidade } = linha.dataset
    const qtde = Number(input.value || 0)

    if (qtde > 0)
        estado.itens[codigo] = { codigo, qtde, custo: Number(custo) || 0, descricao, unidade }
    else
        delete estado.itens[codigo]

    linha.classList?.toggle('escolhido', qtde > 0)
    atualizarEscolhidosColab()
}

// Devolução: "Tudo" de uma linha (botao) ou de todas (sem botao) preenche o que pode devolver.
function devolverTudoColab(botao = null) {
    const linhas = botao
        ? [botao.closest('tr')]
        : [...document.querySelectorAll('#colabItensRequisicao tbody tr')]

    for (const linha of linhas) {
        const input = linha?.querySelector('.colab-qtde')
        if (!input || input.disabled)
            continue
        input.value = input.max
        qtdeItemColab(input)
    }
}

function removerItemColab(codigo) {
    const estado = estadoColaboradores.requisicao
    if (!estado)
        return

    delete estado.itens[codigo]
    const linha = document.querySelector(`#colabItensRequisicao tr[data-codigo="${CSS.escape(codigo)}"]`)
    const input = linha?.querySelector('.colab-qtde')
    if (input) input.value = ''
    linha?.classList.remove('escolhido')
    atualizarEscolhidosColab()
}

// Resumo do que já foi escolhido: a pesquisa troca as linhas da tabela, a escolha fica.
function atualizarEscolhidosColab() {
    const local = document.getElementById('colabEscolhidos')
    const itens = Object.values(estadoColaboradores.requisicao?.itens || {})
    if (!local)
        return

    const total = itens.reduce((s, i) => s + numeroFinitoColab(
        numeroFinitoColab(i.qtde ?? i.quantidade) * numeroFinitoColab(i.custo)), 0)
    const quantidadeTotal = itens.reduce((s, i) => s + numeroFinitoColab(i.qtde ?? i.quantidade), 0)

    local.innerHTML = itens.length
        ? `
            <div class="colab-escolhidos-topo">
                <b>Quantidade total: ${numeroColab(quantidadeTotal)}</b>
                <span>Total ${dinheiro(total)}</span>
            </div>
            <div class="colab-escolhidos-lista">
                ${itens.map(i => `
                    <span class="colab-escolhido">
                        ${numeroColab(numeroFinitoColab(i.qtde ?? i.quantidade))} ${escaparAtributo(i.unidade || 'UN')} · ${escaparAtributo(i.descricao || i.codigo)}
                        <button type="button" title="Remover" onclick="removerItemColab('${escaparAtributo(i.codigo)}')">&times;</button>
                    </span>
                `).join('')}
            </div>`
        : '<small>Nenhum item escolhido. Informe a quantidade nas linhas abaixo.</small>'
}

async function salvarRequisicaoColaborador() {

    const estado = estadoColaboradores.requisicao || {}
    const colaborador = estado.colaborador
    const itens = Object.values(estado.itens || {})

    if (!colaborador)
        return popup({ mensagem: 'Escolha o colaborador.' })

    if (!itens.length)
        return popup({ mensagem: 'Informe a quantidade de pelo menos um item.' })

    overlayAguarde()

    try {
        let anterior
        if (estado.idRequisicao) {
            const ficha = await chamarColaboradores('detalhe', { id: colaborador })
            if (!podeEditarRequisicaoColaborador(ficha.requisicoes?.find(r => r.id == estado.idRequisicao)))
                throw new Error('Esta requisição avançou no fluxo ou você não tem permissão para editá-la.')
            const registro = await recuperarDado('colaboradores', colaborador)
            anterior = registro?.requisicoes?.[estado.idRequisicao]
            if (!anterior)
                throw new Error('Requisição não encontrada. Atualize a tela.')
            if (!podeEditarRequisicaoColaborador(anterior))
                throw new Error('Esta requisição não está mais disponível para edição.')
        }
        const agora = dataServidor()
        const data = agora.toLocaleString()
        const devolucao = estado.movimento == 'DEVOLUÇÃO'

        // Grava só código, quantidade e custo: o resto é lido da composição na hora.
        const requisicao = {
            movimento: estado.movimento,
            data,
            ts: agora.getTime(),
            usuario: acesso.usuario,
            comentario: document.getElementById('comentarioColab')?.value.trim() || '',
            itens: Object.fromEntries(itens.map(({ codigo, qtde, custo }) => [codigo, { codigo, qtde, custo }])),
            etapas: {
                [crypto.randomUUID()]: {
                    ...etapaInicialColaborador,
                    executor: [],
                    data,
                    ts: agora.getTime(),
                    usuario: acesso.usuario,
                    descricao: devolucao
                        ? 'Devolução registrada: conferir e receber os itens.'
                        : 'Requisição criada: separar e entregar os itens.'
                }
            }
        }

        const dados = anterior ? {
            ...anterior,
            comentario: requisicao.comentario,
            itens: requisicao.itens,
            editadoPor: acesso.usuario,
            editadoEm: data
        } : requisicao
        const resultado = await enviar(`colaboradores/${colaborador}/requisicoes/${estado.idRequisicao || crypto.randomUUID()}`, dados)
        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao salvar a requisição.')

        removerPopup()

        if (estadoColaboradores.detalhe?.id == colaborador)
            await atualizarPainelColaborador(colaborador)
        else
            await irParaColaborador(colaborador)

    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao salvar a requisição: Fale com o suporte.' })
    }
}

async function confirmarExcluirRequisicaoColaborador(idRequisicao) {
    popup({
        mensagem: 'Excluir esta requisição e todo o histórico dela?',
        botoes: [{ texto: 'Excluir', img: 'concluido', funcao: `excluirRequisicaoColaborador('${idRequisicao}')` }]
    })
}

async function excluirRequisicaoColaborador(idRequisicao) {
    const id = estadoColaboradores.detalhe?.id
    if (!id)
        return

    overlayAguarde()
    const resultado = await deletar(`colaboradores/${id}/requisicoes/${idRequisicao}`)
    if (!resultado)
        return

    removerPopup()
    await atualizarPainelColaborador(id)
}

// ---------------- Etapas (status) ----------------

// A requisição vem de quem abriu o formulário (painel do histórico ou fila), sem escolha
// no formulário. Com idEtapa: edição.
async function formularioEtapaColaborador(idRequisicao, idEtapa = null) {

    const { id, requisicoes = [] } = fichaEtapaColaborador()
    const requisicao = requisicoes.find(r => r.id == idRequisicao)
    if (!id || !requisicao)
        return

    const etapa = idEtapa
        ? requisicao.etapas.find(e => e.id == idEtapa) || {}
        : {}

    if (!idEtapa) {
        const pesquisa = await pesquisarDB({
            base: 'correcoes',
            filtros: { nome: { op: '=', value: 'SOLUCIONADA' } },
            limite: 1
        })
        const solucionada = pesquisa?.resultados?.[0]
        if (solucionada?.id) {
            etapa.tipoCorrecao = solucionada.id
            etapa.nome = solucionada.nome
        }
    }

    controlesCxOpcoes.tipoCorrecaoColab = {
        base: 'correcoes',
        retornar: ['nome'],
        colunas: { 'Nome': { chave: 'nome' } }
    }

    const setorAtual = etapa.setor?.[0] || ''

    const linhas = [
        {
            texto: 'Status',
            elemento: `<span class="opcoes" name="tipoCorrecaoColab" ${etapa.tipoCorrecao ? `id="${escaparAtributo(etapa.tipoCorrecao)}"` : ''}
                onclick="cxOpcoes('tipoCorrecaoColab')">${escaparAtributo(etapa.nome || 'Selecione')}</span>`
        },
        {
            texto: 'Setor',
            elemento: `<select id="setorEtapaColab">${setores.map(s => `<option ${setorAtual == s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
        },
        {
            texto: `
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'executoresColab')">
                    <span>Executores</span>
                </div>
            `,
            elemento: `<div class="executoresColab"></div>`
        },
        {
            texto: 'Descrição',
            elemento: `<textarea id="descricaoEtapaColab" rows="4">${escaparAtributo(etapa.descricao || '')}</textarea>`
        }
    ]

    popup({
        linhas,
        titulo: idEtapa ? 'Editar etapa' : 'Atualizar status',
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarEtapaColaborador('${escaparAtributo(idRequisicao)}'${idEtapa ? `, '${escaparAtributo(idEtapa)}'` : ''})` }],
        autoDestruicao: ['tipoCorrecaoColab']
    })

    // Etapa nova já vem com o usuário atual de executor; na edição, os gravados.
    await maisUsuario(idEtapa ? etapa.executor || [] : [acesso.usuario], 'executoresColab')
}

async function salvarEtapaColaborador(idRequisicao, idEtapa = crypto.randomUUID()) {

    const { id, requisicoes = [] } = fichaEtapaColaborador()
    const tipoCorrecao = document.querySelector('[name="tipoCorrecaoColab"]')?.id
    const setor = document.getElementById('setorEtapaColab')?.value || ''
    const executor = [...document.querySelectorAll('.executoresColab span')]
        .filter(span => span.id)
        .map(span => span.textContent.trim())

    if (!id || !idRequisicao)
        return popup({ mensagem: 'Requisição não encontrada.' })

    if (!tipoCorrecao)
        return popup({ mensagem: 'Defina o <b>status</b>.' })

    if (!setor && !executor.length)
        return popup({ mensagem: 'Escolha o setor ou pelo menos 1 executor.' })

    overlayAguarde()

    // Edição mantém data e ordem originais no histórico.
    const anterior = requisicoes.find(r => r.id == idRequisicao)?.etapas.find(e => e.id == idEtapa)
    const agora = dataServidor()

    const etapa = {
        tipoCorrecao,
        setor: setor ? [setor] : [],
        executor,
        descricao: document.getElementById('descricaoEtapaColab')?.value.trim() || '',
        usuario: anterior?.usuario || acesso.usuario,
        data: anterior?.data || agora.toLocaleString(),
        ts: anterior?.ts || agora.getTime()
    }

    const resultado = await enviar(`colaboradores/${id}/requisicoes/${idRequisicao}/etapas/${idEtapa}`, etapa)
    if (!resultado?.success)
        return popup({ mensagem: resultado?.mensagem || 'Falha ao salvar a etapa: Fale com o suporte.' })

    removerPopup()
    await recarregarDepoisDaEtapa(id)
}

function confirmarExcluirEtapaColaborador(idRequisicao, idEtapa) {
    popup({
        mensagem: 'Excluir esta etapa do histórico?',
        botoes: [{ texto: 'Excluir', img: 'concluido', funcao: `excluirEtapaColaborador('${idRequisicao}', '${idEtapa}')` }]
    })
}

async function excluirEtapaColaborador(idRequisicao, idEtapa) {
    const id = fichaEtapaColaborador().id
    if (!id)
        return

    overlayAguarde()
    const resultado = await deletar(`colaboradores/${id}/requisicoes/${idRequisicao}/etapas/${idEtapa}`)
    if (!resultado)
        return

    removerPopup()
    await recarregarDepoisDaEtapa(id)
}

// ---------------- Atalhos do menu lateral ----------------

// Bloco reservado no topo dos atalhos (auxPendencias, js/ocorrencias.js): mesmo layout dos
// status de chamados, mas separado e abrindo a tela de colaboradores.
async function atalhosColaboradoresHTML() {
    if (['cliente', 'técnico'].includes(acesso?.permissao))
        return ''

    try {
        const { contagens = [] } = await chamarColaboradores('contagem')
        if (!contagens.length)
            return ''

        const pills = contagens
            .map(({ nome, quantidade, cor }) => `
                <div class="pill" onclick="filtrarStatusColaboradores('${escaparAtributo(nome)}')">
                    <span class="pill-a" style="background-color: ${cor};">${quantidade}</span>
                    <span class="pill-b">${escaparAtributo(nome)}</span>
                </div>
            `)
            .join('')

        return `
            <div class="atalhos-grupo-titulo">Ferramentas e materiais</div>
            ${pills}
            <div class="atalhos-grupo-titulo">Chamados</div>
        `
    } catch (erro) {
        console.error('Atalhos de colaboradores:', erro)
        return ''
    }
}

// ---------------- Documentos ----------------

// O PDF é renderizado no servidor: `logo` aponta para o endereço local (Live Server) e a
// variável nem existe na página do PDF, então item sem imagem usa o logo publicado.
const logoPdfColab = 'https://gcs.app.br/imagens/logo-centralizada.png'

async function pdfRequisicaoColaborador(idRequisicao) {

    const { colaborador = {}, requisicoes = [] } = estadoColaboradores.detalhe || {}
    const r = requisicoes.find(r => r.id == idRequisicao)
    if (!r)
        return

    const devolucao = r.movimento == 'DEVOLUÇÃO'
    const titulo = devolucao ? 'DEVOLUÇÃO DE FERRAMENTAS E MATERIAIS' : 'REQUISIÇÃO DE FERRAMENTAS E MATERIAIS'

    const linhas = r.itens.map(i => `
        <tr>
            <td><img src="${i.imagem || logoPdfColab}" style="width: 3rem;" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = '${logoPdfColab}'"></td>
            <td>${escaparAtributo(i.codigo)}</td>
            <td style="text-align: left;">${escaparAtributo([i.descricao, i.modelo, i.fabricante].filter(Boolean).join(' · '))}</td>
            <td>${i.classe == 'FERRAMENTA' ? 'Ferramenta' : 'Material'}</td>
            <td>${escaparAtributo(i.unidade)}</td>
            <td style="text-align: center;">${numeroColab(i.quantidade)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.custo)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.quantidade * i.custo)}</td>
        </tr>
    `).join('')

    const html = `
        <div id="pdf" style="${vertical}; gap: 1rem; width: 95%; padding: 1rem; font-size: 12px;">
            <div style="${horizontal}; gap: 1rem;">
                <img style="width: 7rem;" src="https://gcs.app.br/imagens/GrupoCostaSilva.png">
                <span style="font-size: 1.4rem;">${titulo}</span>
            </div>

            <div style="${vertical}; gap: 2px;">
                <span><b>Colaborador</b> ${escaparAtributo(colaborador.nome || '')}</span>
                <span><b>Usuário</b> ${escaparAtributo(colaborador.usuario || '')}</span>
                <span><b>Data</b> ${escaparAtributo(r.data)}</span>
                <span><b>Solicitante</b> ${escaparAtributo(r.usuario)}</span>
                <span><b>Status</b> ${escaparAtributo(r.status)}</span>
                ${r.comentario ? `<span><b>Comentário</b> ${escaparAtributo(r.comentario)}</span>` : ''}
            </div>

            <table class="tabela-v2">
                <thead>
                    <tr><th></th><th>Código</th><th>Descrição</th><th>Classe</th><th>Un.</th><th>Qtde</th><th>Valor unit.</th><th>Total</th></tr>
                </thead>
                <tbody>
                    ${linhas}
                    <tr><td colspan="7" style="text-align: right;"><b>Total</b></td><td><b>${dinheiro(r.total)}</b></td></tr>
                </tbody>
            </table>
        </div>
    `

    try {
        await pdf({ html, estilos: ['tabelas-parceiro'], nome: `${devolucao ? 'Devolucao' : 'Requisicao'}-${colaborador.nome || ''}-${String(r.data).slice(0, 10).replaceAll('/', '-')}` })
    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao gerar o PDF, tente novamente ou fale com o Suporte!' })
    }
}

// Termo assinado (upload) e a situação calculada no servidor: EM DIA, DESATUALIZADO
// (ferramentas mudaram desde o envio, com a lista do que mudou) ou PENDENTE (sem envio).
function blocoTermoColaborador(termo = {}, qtdeFerramentas = 0) {
    const { situacao, mudancas = [], nome, link, data, usuario } = termo
    if (!situacao && !link)
        return ''

    const rotulo = { 'EM DIA': 'Em dia', 'DESATUALIZADO': 'Desatualizado', 'PENDENTE': 'Não enviado' }[situacao] || ''
    const classe = { 'EM DIA': 'ok', 'DESATUALIZADO': 'atencao', 'PENDENTE': 'falta' }[situacao] || ''

    const listaMudancas = mudancas.length
        ? `
            <div class="colab-termo-mudancas">
                <small>Mudou desde o termo assinado:</small>
                ${mudancas.map(m => `
                    <span>${escaparAtributo(m.descricao || m.codigo)}: <b>${numeroColab(m.antes)} → ${numeroColab(m.agora)}</b></span>
                `).join('')}
            </div>`
        : ''

    return `
        <div class="colab-termo ${classe}">
            <div class="colab-termo-topo">
                <div>
                    <b>Termo de responsabilidade</b>
                    ${rotulo ? `<span class="colab-termo-situacao ${classe}">${rotulo}</span>` : ''}
                </div>
                <div class="colab-termo-acoes">
                    <button type="button" class="secundario" onclick="termoResponsabilidade()" ${qtdeFerramentas ? '' : 'disabled title="Nenhuma ferramenta em mãos"'}>Gerar termo</button>
                    <button type="button" onclick="document.getElementById('termoAssinadoColab').click()">${link ? 'Enviar novo assinado' : 'Enviar termo assinado'}</button>
                    <input type="file" id="termoAssinadoColab" accept=".pdf,image/*" hidden onchange="enviarTermoAssinado(this)">
                </div>
            </div>
            ${link ? `
                <div class="colab-termo-arquivo">
                    ${criarAnexoVisual(nome || 'termo.pdf', link, false)}
                    <small>Enviado em ${escaparAtributo(data || '')} por ${escaparAtributo(usuario || '')}</small>
                </div>` : '<small>Gere o termo, colete a assinatura e envie o arquivo assinado aqui.</small>'}
            ${listaMudancas}
        </div>
    `
}

// Guarda o arquivo assinado e as ferramentas em mãos agora: é a referência para
// sinalizar quando o saldo mudar (servidor, situacaoTermo).
async function enviarTermoAssinado(input) {
    const { id, itens = [] } = estadoColaboradores.detalhe || {}
    if (!id || !input?.files?.length)
        return

    overlayAguarde()

    try {
        const [arquivo] = await importarAnexos({ input }) || []
        if (!arquivo?.link)
            throw new Error('Falha no envio do arquivo.')

        const agora = dataServidor()
        const resultado = await enviar(`colaboradores/${id}/termo`, {
            nome: arquivo.nome || input.files[0].name,
            link: arquivo.link,
            data: agora.toLocaleString(),
            ts: agora.getTime(),
            usuario: acesso.usuario,
            ferramentas: Object.fromEntries(itens
                .filter(i => i.classe == 'FERRAMENTA' && i.saldo > 0)
                .map(i => [i.codigo, i.saldo]))
        })

        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao salvar o termo.')

        removerOverlay()
        await atualizarPainelColaborador(id)

    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao enviar o termo: Fale com o suporte.' })
    } finally {
        input.value = ''
    }
}

async function termoResponsabilidade() {

    const { id, colaborador = {}, itens = [] } = estadoColaboradores.detalhe || {}
    const ferramentas = itens.filter(i => i.classe == 'FERRAMENTA' && i.saldo > 0)
    if (!ferramentas.length)
        return popup({ mensagem: 'Nenhuma ferramenta em mãos.' })

    const cadastro = await recuperarDado('clientes', id) || {}
    const nome = cadastro.nome || colaborador.nome || ''
    const total = ferramentas.reduce((s, i) => s + i.saldo * i.custo, 0)
    const hoje = dataServidor().toLocaleDateString('pt-BR')

    const ressarcimento = 'Em caso de perda, extravio ou dano por mau uso, comprometo-me a ressarcir o valor de reposição dos itens; '
        + 'sendo empregado, estou ciente de que o valor poderá ser descontado, nos termos do art. 462, §1º, da CLT.'

    const linhas = ferramentas.map(i => `
        <tr>
            <td>${escaparAtributo(i.codigo)}</td>
            <td style="text-align: left;">${escaparAtributo(i.descricao)}</td>
            <td>${escaparAtributo(i.unidade)}</td>
            <td style="text-align: center;">${numeroColab(i.saldo)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.custo)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.saldo * i.custo)}</td>
        </tr>
    `).join('')

    const html = `
        <div id="pdf" style="${vertical}; gap: 1rem; width: 95%; padding: 1rem; font-size: 12px;">

            <div style="${horizontal}; gap: 1rem;">
                <img style="width: 7rem;" src="https://gcs.app.br/imagens/GrupoCostaSilva.png">
                <span style="font-size: 1.4rem;">TERMO DE RESPONSABILIDADE DE FERRAMENTAS</span>
            </div>

            <div style="${vertical}; gap: 2px;">
                <span><b>Colaborador</b> ${escaparAtributo(nome)}</span>
                ${cadastro.cnpj ? `<span><b>CPF/CNPJ</b> ${escaparAtributo(cadastro.cnpj)}</span>` : ''}
                ${colaborador.setor ? `<span><b>Setor</b> ${escaparAtributo(colaborador.setor)}</span>` : ''}
                <span><b>Data</b> ${hoje}</span>
            </div>

            <p style="text-align: justify; margin: 0;">
                Declaro ter recebido as ferramentas e equipamentos relacionados abaixo, em perfeito estado de conservação
                e funcionamento, para uso exclusivo nas atividades profissionais. Comprometo-me a zelar pela guarda e
                conservação dos itens e a devolvê-los quando solicitado ou ao término do vínculo. ${ressarcimento}
            </p>

            <table class="tabela-v2">
                <thead>
                    <tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Qtde</th><th>Valor unit.</th><th>Total</th></tr>
                </thead>
                <tbody>
                    ${linhas}
                    <tr><td colspan="5" style="text-align: right;"><b>Total em mãos</b></td><td><b>${dinheiro(total)}</b></td></tr>
                </tbody>
            </table>

            <div style="${horizontal}; justify-content: space-around; width: 100%; margin-top: 4rem; gap: 2rem;">
                <div style="${vertical}; align-items: center; width: 40%; border-top: 1px solid #000; padding-top: 4px;">
                    <span>${escaparAtributo(nome || 'Colaborador')}</span>
                    <small>Colaborador</small>
                </div>
                <div style="${vertical}; align-items: center; width: 40%; border-top: 1px solid #000; padding-top: 4px;">
                    <span>${escaparAtributo(acesso.nome_completo || acesso.usuario || '')}</span>
                    <small>Responsável pela entrega</small>
                </div>
            </div>

        </div>
    `

    popup({
        elemento: `<div>${html}</div>`,
        titulo: 'Termo de responsabilidade',
        botoes: [{ texto: 'Baixar PDF', img: 'pdf', funcao: 'baixarTermoResponsabilidade()' }]
    })

    estadoColaboradores.termo = { html, nome: `Termo-${nome || id}-${hoje.replaceAll('/', '-')}` }
}

async function baixarTermoResponsabilidade() {
    const { html, nome } = estadoColaboradores.termo || {}
    if (!html)
        return

    try {
        await pdf({ html, estilos: ['tabelas-parceiro'], nome })
    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao gerar o PDF, tente novamente ou fale com o Suporte!' })
    }
}

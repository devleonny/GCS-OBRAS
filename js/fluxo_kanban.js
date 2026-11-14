// ---------------- Fluxos em kanban (como o "3." do Omie): Vendas, Serviços e Compras ----------------
// Cada cartão anda sozinho pelos dados que já existem; não se arrasta. O clique abre o orçamento
// (abrirEsquema) ou a nota recebida (abrirDocumentoFiscal).
//   Vendas e Serviços: vw_fluxo_comercial (gcs/migrations/fluxo-kanban.sql), um cartão por orçamento com pedido,
//     etapa calculada no servidor pelo código ORC: pedido → requisição → NF do Omie → envio → recebimento.
//   Compras: notas recebidas do Fiscal (vw_fiscal_documentos, direção entrada), etapa calculada aqui.
// Período padrão: 30 dias (pela data do pedido / emissão). Desde 14/11/2026 o quadro mostra só o que está no
// período do filtro (os botões "+N parados" saíram a pedido). As tabelas seguem com tudo.

const QUADROS_FLUXO = {
    vendas: {
        titulo: 'Fluxo de Vendas',
        colunas: [['pedido', 'Pedido de Venda'], ['separar', 'Separar Estoque'], ['faturado', 'Faturado'],
            ['entrega', 'Em Entrega'], ['entregue', 'Entregue'], ['recebido', 'Recebido']],
        finais: ['recebido']
    },
    servicos: {
        titulo: 'Fluxo de Serviços',
        colunas: [['pedido', 'Ordem de Serviço'], ['execucao', 'Em Execução'], ['executada', 'Executada (faturar)'],
            ['faturado', 'Faturado'], ['recebido', 'Recebido']],
        finais: ['recebido']
    },
    // Quadro novo (gcs: fluxo_itens / vw_fluxo_itens): um item por venda que anda até Concluído.
    // Arraste: Pedido → Requisição (formulário) → Separado (NF-e salva) → Faturado (emissão) → Entregue → Concluído.
    itens_vendas: {
        titulo: 'Fluxo de Vendas',
        novo: true,
        colunas: [['pedido', 'Pedido de Venda'], ['requisicao', 'Requisição'], ['separado', 'Separado'],
            ['faturado', 'Faturado'], ['entregue', 'Entregue'], ['concluido', 'Concluído']],
        finais: ['concluido']
    },
    compras: {
        titulo: 'Fluxo de Compras',
        colunas: [['sefaz', 'Emitida pelo Fornecedor'], ['conferir', 'Ciência / Conferir Itens'], ['pronta', 'Pronta para Lançar'], ['lancada', 'Lançada no Estoque']],
        finais: ['lancada']
    }
}
const PERIODOS_FLUXO = [[30, 'Últimos 30 dias'], [60, 'Últimos 60 dias'], [90, 'Últimos 90 dias'], [180, 'Últimos 6 meses'], [365, 'Último ano'], [0, 'Todo o período']]
const estadoFluxo = { quadro: 'vendas', periodo: 30, busca: '', empresa: '', linhas: [], abertos: new Set(), carregando: 0 }
const EMPRESAS_FLUXO = [['', 'Todas as empresas'], ['AC', 'AC'], ['IAC', 'IAC'], ['HNK', 'HNK'], ['HNW', 'HNW'], ['-', 'Sem empresa']]

const reaisFluxo = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBrFluxo = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''
const isoDeBrFluxo = br => { const m = String(br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const normalFluxo = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function diasDesdeFluxo(iso, hoje = dataServidor()) {
    if (!iso) return null
    const base = new Date(hoje); base.setHours(12, 0, 0, 0)
    return Math.round((base - new Date(`${String(iso).slice(0, 10)}T12:00:00`)) / 86400000)
}

// ---------------- Regras (puras: testadas em tests/fluxo-kanban.test.cjs) ----------------

// Etapa de uma nota recebida (Compras). Cancelada, desconhecida ou "não realizada" ficam fora (null).
function etapaCompraFluxo(d) {
    const status = String(d.status || '').toUpperCase()
    const manif = String(d.manifestacao || '').toUpperCase()
    const estoque = String(d.estoque_status || '').toUpperCase()
    if (status === 'CANCELADA' || ['DESCONHECIMENTO', 'NAO_REALIZADA'].includes(manif)) return null
    if (['LANCADO', 'NAO_MOVIMENTA'].includes(estoque)) return 'lancada'
    if (estoque === 'PRONTO') return 'pronta'
    if (status === 'RESUMO' || !manif || manif === 'PENDENTE') return 'sefaz'
    return 'conferir'
}

// Linhas cruas → cartões no formato comum: { id, etapa, data (do período), desde (na etapa), ... }.
function cartoesFluxo(quadro, linhas) {
    if (quadro === 'compras')
        return linhas.filter(d => !d.excluido).map(d => ({ ...d, etapa: etapaCompraFluxo(d), data: d.dia, desde: d.dia })).filter(c => c.etapa)
    if (QUADROS_FLUXO[quadro]?.novo)
        return linhas.map(c => ({ ...c, data: c.data, desde: c.data }))
    const desde = {
        faturado: c => c.data_faturamento, entrega: c => c.data_saida, entregue: c => c.data_entrega
    }
    return linhas.map(c => ({ ...c, data: c.data_pedido, desde: (desde[c.etapa]?.(c)) || c.data_pedido }))
}

// Distribui nas colunas: no período (pela data) ou, se a coluna está em aberto, "parado" (mais antigo).
// Colunas finais só mostram o período. busca: cliente, ORC, pedido, NF, cidade, fornecedor.
function colunasFluxo(quadro, cartoes, { periodo = 30, busca = '', empresa = '', hoje = dataServidor() } = {}) {
    const config = QUADROS_FLUXO[quadro]
    const termo = normalFluxo(busca).trim()
    const daEmpresa = c => !empresa || (empresa === '-' ? !c.empresa : c.empresa === empresa)
    const combina = c => daEmpresa(c) && (!termo || normalFluxo([c.contrato, c.departamento, c.cliente, c.cidade, c.numero_pedido, c.participante_nome, c.numero,
        ...(Array.isArray(c.notas) ? c.notas.map(n => n.n_nota) : [])].join(' ')).includes(termo))
    return config.colunas.map(([etapa, titulo]) => {
        const daEtapa = cartoes.filter(c => c.etapa === etapa && combina(c))
            .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
        const noPeriodo = periodo ? daEtapa.filter(c => (diasDesdeFluxo(c.data, hoje) ?? 0) <= periodo) : daEtapa
        const parados = periodo && !config.finais.includes(etapa) ? daEtapa.filter(c => (diasDesdeFluxo(c.data, hoje) ?? 0) > periodo) : []
        // Total do cabeçalho: só o que está no período (os parados têm a contagem no botão deles).
        const valor = noPeriodo.reduce((s, c) => s + Number(c.valor_pedido ?? c.valor_total ?? c.valor ?? 0), 0)
        return { etapa, titulo, cartoes: noPeriodo, parados, valor, final: config.finais.includes(etapa) }
    })
}

// ---------------- Tela ----------------
// Entradas do menu (js/esquema_botoes.js chama window[funcao]): precisam ser "function", não const,
// porque const no topo do script não vira propriedade de window e o clique no menu não faria nada.
function telaFluxoVendas() { return telaFluxo('vendas') }
function telaFluxoServicos() { return telaFluxo('servicos') }
function telaFluxoCompras() { return telaFluxo('compras') }
function telaFluxoItensVendas() { return telaFluxo('itens_vendas') }

async function telaFluxo(quadro) {
    estadoFluxo.quadro = quadro
    estadoFluxo.abertos.clear()
    const novo = QUADROS_FLUXO[quadro].novo
    const lupa = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m13 13 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    tela.innerHTML = `
        <div class="pagina-conteudo fluxo-pagina" data-quadro="${quadro}">
            <header class="fluxo-topo">
                <div class="fluxo-titulo">
                    <h2>${QUADROS_FLUXO[quadro].titulo}</h2>
                    <small>${novo
                        ? 'Arraste o cartão para a próxima etapa · clique para abrir o orçamento'
                        : `${quadro === 'compras' ? 'Período pela emissão da nota' : 'Período pela data do pedido'} · os cartões andam sozinhos conforme os dados; clique para abrir`}</small>
                </div>
                <div class="fluxo-controles">
                    ${novo ? `
                    <label class="fluxo-campo fluxo-empresa">
                        <select aria-label="Empresa" onchange="estadoFluxo.empresa = this.value; estadoFluxo.abertos.clear(); renderizarFluxo()">
                            ${EMPRESAS_FLUXO.map(([v, t]) => `<option value="${v}" ${estadoFluxo.empresa === v ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </label>` : ''}
                    <label class="fluxo-campo fluxo-busca">
                        ${lupa}
                        <input type="search" placeholder="${quadro === 'compras' ? 'Fornecedor ou número da nota' : 'Cliente, ORC, pedido, NF ou cidade'}"
                            aria-label="Buscar" value="${escaparAtributo(estadoFluxo.busca)}" oninput="estadoFluxo.busca = this.value; renderizarFluxo()">
                    </label>
                    <label class="fluxo-campo fluxo-periodo">
                        <select aria-label="Período" onchange="estadoFluxo.periodo = Number(this.value); estadoFluxo.abertos.clear(); renderizarFluxo()">
                            ${PERIODOS_FLUXO.map(([v, t]) => `<option value="${v}" ${estadoFluxo.periodo === v ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </label>
                    <button type="button" class="fluxo-atualizar" onclick="carregarFluxo()" title="Buscar de novo os dados">Atualizar</button>
                </div>
            </header>
            <div class="fluxo-quadro"><div class="fluxo-carregando"><img src="gifs/loading-gcs.png" alt="Carregando"></div></div>
        </div>`
    ajustarAlturaFluxo()
    window.removeEventListener('resize', ajustarAlturaFluxo)
    window.addEventListener('resize', ajustarAlturaFluxo)
    await carregarFluxo()
}

async function carregarFluxo() {
    const consulta = ++estadoFluxo.carregando
    const quadro = estadoFluxo.quadro
    try {
        const novo = QUADROS_FLUXO[quadro].novo
        const base = quadro === 'compras' ? 'vw_fiscal_documentos' : novo ? 'vw_fluxo_itens' : 'vw_fluxo_comercial'
        const filtros = quadro === 'compras' ? { direcao: { op: '=', value: 'entrada' } }
            : novo ? { quadro_vendas: { op: '=', value: 'S' }, relevante: { op: '=', value: 'S' } }
                : { quadro: { op: '=', value: quadro } }
        const linhas = []
        let pagina = 1, paginas = 1
        do {
            const resposta = await pesquisarDB({ base, filtros, pagina, limite: 500 })
            linhas.push(...(resposta?.resultados || []))
            paginas = Number(resposta?.paginas) || 1
            pagina++
        } while (pagina <= paginas)
        if (consulta !== estadoFluxo.carregando || quadro !== estadoFluxo.quadro) return
        estadoFluxo.linhas = cartoesFluxo(quadro, linhas)
        renderizarFluxo()
    } catch (erro) {
        console.error('[FLUXO]', erro)
        const area = document.querySelector('.fluxo-quadro')
        if (area) area.innerHTML = '<button type="button" onclick="carregarFluxo()">Falha ao carregar. Tentar de novo</button>'
    }
}

function renderizarFluxo() {
    const area = document.querySelector('.fluxo-pagina .fluxo-quadro')
    if (!area) return
    const quadro = estadoFluxo.quadro
    const colunas = colunasFluxo(quadro, estadoFluxo.linhas, { periodo: estadoFluxo.periodo, busca: estadoFluxo.busca, empresa: estadoFluxo.empresa })
    const novo = QUADROS_FLUXO[quadro].novo
    area.innerHTML = colunas.map(col => {
        // Só o que está no período do filtro (os botões "+N parados" saíram: o filtro de período resolve).
        const lista = col.cartoes
        const total = col.cartoes.length
        const soltar = novo ? `ondragover="permitirSoltarFluxo(event, '${col.etapa}')" ondragleave="sairSoltarFluxo(event)" ondrop="soltarFluxo(event, '${col.etapa}')"` : ''
        return `
            <section class="fluxo-coluna ${col.final ? 'final' : ''}" data-etapa="${col.etapa}" ${soltar}>
                <header class="fluxo-coluna-topo">
                    <b>${col.titulo}</b>
                    <small>${total ? `${total} registro(s)${col.valor ? ` · ${reaisFluxo(col.valor)}` : ''}` : 'Nenhum registro no período'}</small>
                </header>
                ${novo && col.etapa === 'separado' ? `
                    <button type="button" class="fluxo-faturar-todas" onclick="faturarTodasFluxo()"
                        ${col.cartoes.some(c => !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status)) ? '' : 'disabled'}
                        title="Emite, uma por vez, as notas de todos os cartões de Separado da empresa escolhida">Faturar todas</button>` : ''}
                <div class="fluxo-cartoes">
                    ${lista.length ? lista.map(c => cartaoFluxo(quadro, c, col.parados.includes(c))).join('') : '<p class="fluxo-vazio">Nenhum registro</p>'}
                </div>
            </section>`
    }).join('')
}

// O quadro ocupa só a altura que sobra na tela, do topo dele até o fim da janela (sem barra vertical
// no quadro: os cartões rolam dentro de cada coluna). No celular as colunas crescem e a página rola.
function ajustarAlturaFluxo() {
    const quadro = document.querySelector('.fluxo-pagina .fluxo-quadro')
    if (!quadro) return window.removeEventListener('resize', ajustarAlturaFluxo)
    if (window.innerWidth <= 700) return quadro.style.removeProperty('height')
    const topo = quadro.getBoundingClientRect().top
    quadro.style.height = `${Math.max(320, Math.floor(window.innerHeight - topo - 12))}px`
}

function alternarParadosFluxo(etapa) {
    estadoFluxo.abertos.has(etapa) ? estadoFluxo.abertos.delete(etapa) : estadoFluxo.abertos.add(etapa)
    renderizarFluxo()
}

// Linha de contexto do cartão: o que aconteceu na etapa em que ele está.
function contextoCartaoFluxo(quadro, c) {
    const nfs = (Array.isArray(c.notas) ? c.notas : []).map(n => n.n_nota).filter(Boolean)
    const textoNf = nfs.length ? `NF ${nfs.map(n => String(n).replace(/^0+/, '')).join(', ')}` : ''
    const chamado = (Array.isArray(c.status_chamado) ? c.status_chamado : []).join(' · ')
    const juntar = (...partes) => partes.filter(Boolean).join(' · ')
    switch (quadro === 'compras' ? `c-${c.etapa}` : c.etapa) {
        case 'pedido': return quadro === 'servicos' ? (chamado || 'Aguardando início') : 'Aguardando separação'
        case 'separar': return `${c.requisicoes || 0} requisição(ões) · faturamento pendente`
        case 'execucao': return chamado || c.status_atual || 'Em andamento'
        case 'executada': return `Executada${chamado ? ` (${chamado})` : ''} · faturar`
        case 'faturado': return `${textoNf || 'Faturado'}${c.data_faturamento ? ` em ${dataBrFluxo(c.data_faturamento)}` : ''}`
        case 'entrega': return juntar(textoNf, c.situacao_envio || 'Em trânsito', c.previsao_entrega ? `previsão ${dataBrFluxo(c.previsao_entrega)}` : '')
        case 'entregue': return juntar(textoNf, `entregue${c.data_entrega ? ` em ${dataBrFluxo(c.data_entrega)}` : ''}`)
        case 'recebido': return juntar(textoNf, 'recebido')
        case 'c-sefaz': return String(c.status || '').toUpperCase() === 'RESUMO' ? 'Só o resumo da SEFAZ: manifeste para baixar o XML' : 'Aguardando manifestação'
        case 'c-conferir': return Number(c.itens_pendentes) ? `${c.itens_pendentes} item(ns) sem vínculo com o cadastro` : 'Conferir itens'
        case 'c-pronta': return 'Itens vinculados: pronta para lançar'
        case 'c-lancada': return String(c.estoque_status || '').toUpperCase() === 'NAO_MOVIMENTA' ? 'Não movimenta estoque' : 'Lançada no estoque'
        default: return ''
    }
}

// O campo "pedido" às vezes guarda texto ("Aprovado Via E-mail", "Sem Pedido"): "Pedido" só antes de número.
function pedidoCartaoFluxo(numero) {
    const texto = String(numero || '').trim()
    if (!texto) return ''
    return ` · ${/\d/.test(texto) ? `Pedido ${escaparAtributo(texto)}` : escaparAtributo(texto)}`
}

// ---------------- Quadro novo: arrastar para a próxima etapa ----------------
// Cada arraste faz o que a etapa pede (gcs: SCRIPTS/fluxo_itens.js):
//   Pedido → Requisição: abre o formulário de requisição com o pedido do cartão (salvar anda o item).
//   Requisição → Separado: abre a NF-e preenchida (cliente e itens das requisições), só "Salvar" (rascunho).
//   Separado → Faturado: emite; autorizada = verde e anda; erro = vermelho e fica em Separado.
//   Faturado → Entregue → Concluído: confirmação.
// Só por arraste (o botão "→" no cartão foi retirado a pedido em 13/11/2026).
const ORDEM_ITENS_FLUXO = ['pedido', 'requisicao', 'separado', 'faturado', 'entregue', 'concluido']
const ACAO_ITENS_FLUXO = { pedido: 'Requisição', requisicao: 'Separar (NF-e)', separado: 'Faturar', faturado: 'Entregue', entregue: 'Concluir' }
const proximaEtapaFluxo = etapa => ORDEM_ITENS_FLUXO[ORDEM_ITENS_FLUXO.indexOf(etapa) + 1] || null
const itemFluxo = id => estadoFluxo.linhas.find(c => c.id === id)
let arrasteFluxo = null

function iniciarArrasteFluxo(evento, id) {
    arrasteFluxo = id
    evento.dataTransfer.effectAllowed = 'move'
    evento.dataTransfer.setData('text/plain', id)
    const alvo = proximaEtapaFluxo(itemFluxo(id)?.etapa)
    document.querySelector(`.fluxo-pagina .fluxo-coluna[data-etapa="${alvo}"]`)?.classList.add('fluxo-alvo')
}

function terminarArrasteFluxo() {
    arrasteFluxo = null
    document.querySelectorAll('.fluxo-alvo, .fluxo-alvo-sobre').forEach(el => el.classList.remove('fluxo-alvo', 'fluxo-alvo-sobre'))
}

function permitirSoltarFluxo(evento, etapa) {
    if (proximaEtapaFluxo(itemFluxo(arrasteFluxo)?.etapa) !== etapa) return
    evento.preventDefault()
    evento.currentTarget.classList.add('fluxo-alvo-sobre')
}

function sairSoltarFluxo(evento) {
    if (!evento.currentTarget.contains(evento.relatedTarget)) evento.currentTarget.classList.remove('fluxo-alvo-sobre')
}

async function soltarFluxo(evento, etapa) {
    evento.preventDefault()
    const id = evento.dataTransfer.getData('text/plain') || arrasteFluxo
    terminarArrasteFluxo()
    const c = itemFluxo(id)
    if (!c) return
    if (proximaEtapaFluxo(c.etapa) !== etapa) return popup({ mensagem: 'O cartão só anda para a próxima etapa.' })
    await avancarItemFluxo(id)
}

async function avancarItemFluxo(id) {
    const c = itemFluxo(id)
    if (!c) return
    const nome = `<b>${escaparAtributo(c.cliente || 'cliente não informado')}</b> (${escaparAtributo(c.contrato || c.departamento || 'sem orçamento')})`
    try {
        if (c.etapa === 'pedido') return await abrirRequisicaoFluxo(c)
        if (c.etapa === 'requisicao') return await abrirNotaFluxo(c)
        if (c.etapa === 'separado') {
            if (!await confirmarPopup({ titulo: 'Faturar', mensagem: `Emitir agora a NF-e de ${nome}?`, textoConfirmar: 'Emitir' })) return
            // O cartão vai na hora para Faturado ("emitindo"); se a nota for recusada, volta para Separado em vermelho.
            await apiModuloFiscal('fluxo-itens/faturar', { id })
            return carregarFluxo()
        }
        if (c.etapa === 'faturado' || c.etapa === 'entregue') {
            const entregar = c.etapa === 'faturado'
            const ok = await confirmarPopup({
                titulo: entregar ? 'Entregue' : 'Concluir',
                mensagem: entregar ? `Marcar ${nome} como entregue?` : `Concluir ${nome}?`,
                textoConfirmar: entregar ? 'Entregue' : 'Concluir'
            })
            if (!ok) return
            overlayAguarde()
            await apiModuloFiscal('fluxo-itens/mover', { id, para: entregar ? 'ENTREGUE' : 'CONCLUIDO' })
            removerOverlay()
            return carregarFluxo()
        }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Pedido → Requisição: o formulário de sempre (js/requisicao.js), no ORC do cartão e com o pedido dele.
async function abrirRequisicaoFluxo(c) {
    if (!c.contrato) return popup({ mensagem: 'Este item não tem orçamento: crie a requisição pela tela de Ocorrências.' })
    controles.ocorrencias = { ...(controles.ocorrencias || {}), ativo: c.contrato }
    requisicaoPedidoPadrao = c.pedido_id || null
    try { await formularioRequisicao() } finally { requisicaoPedidoPadrao = null }
}

// Requisição → Separado: NF-e preenchida pelo servidor; salvar o rascunho leva o cartão para Separado.
async function abrirNotaFluxo(c) {
    overlayAguarde()
    const dados = await apiModuloFiscal('fluxo-itens/nota', { id: c.id })
    removerOverlay()
    await formularioEmissaoNFe({ ...dados, fluxo_item: c.id })
    if (!dados.itens?.length)
        popup({ mensagem: 'As requisições deste item não têm produtos: inclua os itens da nota antes de salvar.' })
}

// "Faturar todas" (topo de Separado): emite em fila só os cartões VISÍVEIS (empresa, busca e período do filtro).
async function faturarTodasFluxo() {
    const empresa = estadoFluxo.empresa
    const separado = colunasFluxo(estadoFluxo.quadro, estadoFluxo.linhas,
        { periodo: estadoFluxo.periodo, busca: estadoFluxo.busca, empresa }).find(col => col.etapa === 'separado')
    const prontos = (separado?.cartoes || []).filter(c => !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status))
    if (!prontos.length) return popup({ mensagem: 'Nenhum cartão em Separado para faturar.' })
    const ok = await confirmarPopup({
        titulo: 'Faturar todas',
        mensagem: `Emitir ${prontos.length} nota(s)${empresa ? ` da empresa ${empresa === '-' ? 'sem empresa' : escaparAtributo(empresa)}` : ''}?`,
        textoConfirmar: 'Emitir todas'
    })
    if (!ok) return
    try {
        // Os cartões vão na hora para Faturado; os recusados voltam para Separado em vermelho.
        await apiModuloFiscal('fluxo-itens/faturar', { ids: prontos.map(c => c.id) })
        carregarFluxo()
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------- Painel do item (clique no cartão) ----------------
// Resumo, notas emitidas pelo GCS com o histórico de comunicação com a SEFAZ (aberto), histórico do
// cartão e botão para o orçamento. Dados: gcs /fluxo-itens/detalhe.
const ETAPAS_NOME_FLUXO = { PEDIDO: 'Pedido de Venda', REQUISICAO: 'Requisição', SEPARADO: 'Separado', FATURADO: 'Faturado', ENTREGUE: 'Entregue', CONCLUIDO: 'Concluído' }
const STATUS_NOTA_FLUXO = { RASCUNHO: 'Rascunho', PROCESSANDO: 'Processando na SEFAZ', AUTORIZADA: 'Autorizada', REJEITADA: 'Recusada', DENEGADA: 'Denegada', CANCELADA: 'Cancelada' }
const dataHoraItemFluxo = v => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''

// Bloco "Venda no fluxo" (etapa, pedido, requisições, notas do Omie, histórico do cartão), usado na tela
// única da venda: dentro da nota emitida (js/fiscal.js htmlNotaEmitida) ou sozinho quando ainda não há NF-e.
function blocoItemFluxoHtml(d) {
    if (!d?.item) return ''
    const i = d.item
    const esc = escaparAtributo
    const lista = linhas => `<ul class="fis-lista">${linhas.join('')}</ul>`
    const contador = n => `<span class="fis-contador">${n}</span>`
    const linhaHist = (em, por, texto, detalhe) =>
        `<li><small>${esc(dataHoraItemFluxo(em))}${por ? ` · ${esc(por)}` : ''}</small> ${esc(texto)}${detalhe ? ` <small>— ${esc(detalhe)}</small>` : ''}</li>`
    const cor = i.emissao_status === 'ERRO' ? '#b91c1c' : i.emissao_status === 'OK' ? '#15803d' : '#2563eb'
    const omie = (i.notas_omie || []).filter(n => n.n_nota)
    const historico = (i.historico || []).slice().reverse()
    return `
        <div class="fis-secao">
            <div class="fis-secao-topo"><b>Venda no fluxo</b> ${etiquetaEst(ETAPAS_NOME_FLUXO[i.etapa] || i.etapa, cor)}</div>
            ${resumoDocumentoFis({}, [
                ['Orçamento', esc(i.contrato || i.departamento || '—')],
                ['Pedido', esc(i.numero_pedido || '—')],
                ['Valor do item', i.valor ? dinheiro(i.valor) : '—'],
                ['Requisições', esc(String(i.requisicoes || 0))]
            ])}
        </div>
        ${omie.length ? `
            <details class="fis-secao"><summary><b>Notas do Omie</b> ${contador(omie.length)}</summary>
                ${lista(omie.map(n => `<li><small>${esc(n.data || '')}</small> NF ${esc(String(n.n_nota).replace(/^0+/, ''))} · ${esc(n.categoria || '')}${n.total ? ` · ${dinheiro(n.total)}` : ''}${n.cancelado === 'S' ? ' · <small>cancelada</small>' : ''}</li>`))}
            </details>` : ''}
        <details class="fis-secao"><summary><b>Histórico do cartão</b> ${contador(historico.length)}</summary>
            ${historico.length ? lista(historico.map(h => linhaHist(h.em, h.por,
                h.de && h.para ? `${ETAPAS_NOME_FLUXO[h.de] || h.de} → ${ETAPAS_NOME_FLUXO[h.para] || h.para}` : (ETAPAS_NOME_FLUXO[h.para] || h.origem || ''),
                h.detalhe))) : '<small>Sem registros.</small>'}
        </details>`
}

// Clique no cartão: tela única da venda. Com NF-e do GCS, é a tela da nota (com o bloco da venda no fim);
// sem NF-e, a mesma tela só com os dados do item.
async function abrirItemFluxo(id) {
    let d, dadosNota
    try {
        overlayAguarde()
        d = await apiModuloFiscal('fluxo-itens/detalhe', { id })
        const nota = (d.documentos || [])[0]
        if (nota) dadosNota = await apiFiscal('documento', { id: nota.id })
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    if (dadosNota) {
        const anterior = document.querySelector(`[data-doc-fiscal="${CSS.escape(dadosNota.documento.id)}"]`)?.closest('.popup')?.id
        if (anterior) removerPopup(anterior)
        return popup({ titulo: 'Nota emitida', elemento: htmlNotaEmitida(dadosNota, d) })
    }

    const i = d.item
    const esc = escaparAtributo
    const faturada = i.emissao_status === 'OK' || (i.notas_omie || []).some(n => n.n_nota && n.cancelado !== 'S' && n.categoria !== 'remessa')
    const elemento = `
        <div class="fis-painel fis-doc fis-nota">
            <div class="fis-nota-topo ${faturada ? 'ok' : 'rascunho'}">
                <div class="fis-nota-titulo">
                    <b>${esc(d.cliente || 'Cliente não informado')}</b>
                    <div class="fis-nota-etiquetas">${i.empresa ? etiquetaEst(i.empresa, '#475569') : ''}</div>
                    <small>${esc([i.contrato || i.departamento, d.cidade].filter(Boolean).join(' · '))} · ainda sem NF-e do GCS</small>
                </div>
                <div class="fis-nota-valor"><span>Valor do item</span><b>${i.valor ? dinheiro(i.valor) : '—'}</b></div>
            </div>
            ${i.orcamento_id ? `<div class="fis-acoes-claras fis-nota-acoes"><button type="button" class="fis-mini" onclick="abrirEsquema('${esc(i.orcamento_id)}')">Histórico do Orçamento</button></div>` : ''}
            ${blocoItemFluxoHtml(d)}
        </div>`
    popup({ titulo: `Venda ${i.contrato || i.departamento || ''}`.trim(), elemento })
}

// ---------------- Menu ⋮ do cartão ----------------
// Atalhos conforme a situação: detalhes, orçamento, editar a NF-e salva (Separado), espelho, DANFE e XML.
// fiscal_ids pode vir como array ou como texto do Postgres ('{a,b}').
const notasItemFluxo = c => Array.isArray(c?.fiscal_ids) ? c.fiscal_ids : String(c?.fiscal_ids || '').replace(/[{}"]/g, '').split(',').filter(Boolean)

function fecharMenuItemFluxo() {
    document.querySelector('.fluxo-menu')?.remove()
    document.removeEventListener('click', fecharMenuItemFluxo, true)
    window.removeEventListener('scroll', fecharMenuItemFluxo, true)
}

function abrirMenuItemFluxo(evento, id) {
    evento.stopPropagation()
    const jaAberto = document.querySelector(`.fluxo-menu[data-id="${CSS.escape(id)}"]`)
    fecharMenuItemFluxo()
    if (jaAberto) return
    const c = itemFluxo(id)
    if (!c) return
    const nota = notasItemFluxo(c).at(-1)
    const opcoes = [
        c.orcamento_id ? ['Histórico do Orçamento', `abrirEsquema('${escaparAtributo(c.orcamento_id)}')`] : null,
        nota && c.etapa === 'separado' ? ['Editar NF-e', `editarNotaItemFluxo('${id}')`] : null,
        nota && c.emissao_status !== 'OK' ? ['Espelho (PDF)', `espelhoNotaItemFluxo('${escaparAtributo(nota)}')`] : null,
        nota && c.emissao_status === 'OK' ? ['DANFE', `baixarArquivoFiscal('${escaparAtributo(nota)}', 'danfe')`] : null,
        nota && c.emissao_status === 'OK' ? ['XML', `baixarArquivoFiscal('${escaparAtributo(nota)}', 'xml')`] : null,
    ].filter(Boolean)
    if (!opcoes.length) return
    const menu = document.createElement('div')
    menu.className = 'fluxo-menu'
    menu.dataset.id = id
    menu.innerHTML = opcoes.map(([texto, acao]) =>
        `<button type="button" onclick="event.stopPropagation(); fecharMenuItemFluxo(); ${acao}">${texto}</button>`).join('')
    document.body.appendChild(menu)
    // Abaixo do botão, alinhado à direita, sem sair da tela.
    const r = evento.currentTarget.getBoundingClientRect()
    const largura = menu.offsetWidth, altura = menu.offsetHeight
    menu.style.left = `${Math.max(8, Math.min(r.right - largura, window.innerWidth - largura - 8))}px`
    menu.style.top = `${r.bottom + altura + 8 > window.innerHeight ? Math.max(8, r.top - altura - 4) : r.bottom + 4}px`
    setTimeout(() => {
        document.addEventListener('click', fecharMenuItemFluxo, true)
        window.addEventListener('scroll', fecharMenuItemFluxo, true)
    })
}

// Nota salva do item (rascunho/recusada) de volta no formulário da separação, para corrigir e salvar.
async function editarNotaItemFluxo(id) {
    const c = itemFluxo(id)
    const notaId = notasItemFluxo(c).at(-1)
    if (!notaId) return
    try {
        overlayAguarde()
        const { documento } = await apiFiscal('documento', { id: notaId })
        removerOverlay()
        const entrada = documento?.payload?.entrada
        if (!entrada) return popup({ mensagem: 'Esta nota não tem os dados de emissão salvos.' })
        if (!['RASCUNHO', 'REJEITADA'].includes(documento.status))
            return popup({ mensagem: `A nota está ${String(documento.status || '').toLowerCase()} e não pode mais ser alterada.` })
        await formularioEmissaoNFe({ ...entrada, id: notaId, fluxo_item: id })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Espelho (PDF) a partir da nota salva do item (sem abrir o formulário).
async function espelhoNotaItemFluxo(notaId) {
    const aba = window.open('', '_blank')
    try {
        overlayAguarde()
        const { documento } = await apiFiscal('documento', { id: notaId })
        const entrada = documento?.payload?.entrada
        if (!entrada) throw new Error('Esta nota não tem os dados de emissão salvos.')
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/fiscal/emissao/espelho`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(entrada)
        })
        removerOverlay()
        if (!resposta.ok) {
            const r = await resposta.json().catch(() => ({}))
            throw Object.assign(new Error(r.mensagem || `Falha ao gerar o espelho (${resposta.status})`), { erros: r.erros })
        }
        const url = URL.createObjectURL(await resposta.blob())
        if (aba) aba.location = url
        else window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
    } catch (err) {
        removerOverlay()
        aba?.close()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Cartão do quadro novo (vw_fluxo_itens): item que anda até Concluído; marca verde/vermelha da emissão.
function cartaoItemFluxo(c, parado, tempo) {
    const nfs = (Array.isArray(c.notas) ? c.notas : [])
        .filter(n => n.n_nota && n.cancelado !== 'S' && n.categoria !== 'remessa')
        .map(n => String(n.n_nota).replace(/^0+/, ''))
    const contexto = [
        c.tipo && c.tipo !== 'VENDA' ? c.tipo : '',
        Number(c.requisicoes) ? `${c.requisicoes} requisição(ões)` : '',
        nfs.length ? `NF ${nfs.join(', ')}` : '',
        Number(c.envios) ? `${c.envios} envio(s)` : ''
    ].filter(Boolean).join(' · ')
    // Cor da lateral: azul (padrão), verde (nota faturada/emitida), vermelho (emissão recusada: o motivo
    // fica só no "title", ao passar o mouse). Enquanto emite, só a marquinha "Emitindo…".
    const faturada = c.emissao_status === 'OK' || (nfs.length > 0 && ['faturado', 'entregue', 'concluido'].includes(c.etapa))
    const estado = c.emissao_status === 'ERRO' ? 'erro' : faturada ? 'faturada' : ''
    const dica = c.emissao_status === 'ERRO' && c.emissao_mensagem ? `title="${escaparAtributo(`Emissão recusada: ${c.emissao_mensagem}`)}"` : ''
    const emissao = ['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status) ? '<small class="fluxo-emissao andando">Emitindo…</small>' : ''
    const id = escaparAtributo(c.id)
    // Avança só arrastando para a coluna seguinte (sem botão no cartão, a pedido).
    const podeAvancar = ACAO_ITENS_FLUXO[c.etapa] && !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status)
    const arrastavel = podeAvancar ? `draggable="true" ondragstart="iniciarArrasteFluxo(event, '${id}')" ondragend="terminarArrasteFluxo()"` : ''
    // Clique: painel do item (nota, histórico da SEFAZ, histórico do cartão e o orçamento).
    const abrir = `onclick="abrirItemFluxo('${id}')" onkeydown="if (event.key === 'Enter') abrirItemFluxo('${id}')"`
    return `
        <article class="fluxo-cartao fluxo-item ${estado} ${parado ? 'parado' : ''} ${c.orcamento_id ? 'clicavel' : ''}" data-id="${id}" tabindex="0" ${dica} ${arrastavel} ${abrir}>
            <span class="fluxo-cartao-linha"><span>${escaparAtributo(c.contrato || c.departamento || 'Sem orçamento')}${pedidoCartaoFluxo(c.numero_pedido)}</span>
                <span class="fluxo-cartao-cantos">${tempo}<button type="button" class="fluxo-menu-btn" title="Mais opções" aria-label="Mais opções"
                    onclick="abrirMenuItemFluxo(event, '${id}')">⋮</button></span></span>
            <b class="fluxo-cartao-nome">${escaparAtributo(c.cliente || 'Cliente não informado')}</b>
            ${c.cidade ? `<small>${escaparAtributo(c.cidade)}</small>` : ''}
            ${contexto ? `<small class="fluxo-cartao-contexto">${escaparAtributo(contexto)}</small>` : ''}
            <span class="fluxo-cartao-valor">${reaisFluxo(c.valor)} <small>${c.empresa ? `${escaparAtributo(c.empresa)} · ` : ''}desde ${dataBrFluxo(c.data)}</small></span>
            ${emissao}
        </article>`
}

function cartaoFluxo(quadro, c, parado) {
    const dias = diasDesdeFluxo(c.desde)
    const final = QUADROS_FLUXO[quadro].finais.includes(c.etapa)
    const tempo = !final && dias != null ? `<span class="fluxo-dias ${dias > 30 ? 'velho' : dias > 7 ? 'morno' : ''}" title="Dias nesta etapa">${dias} d</span>` : ''
    if (QUADROS_FLUXO[quadro].novo) return cartaoItemFluxo(c, parado, tempo)
    if (quadro === 'compras')
        return `
            <button type="button" class="fluxo-cartao ${parado ? 'parado' : ''}" data-id="${escaparAtributo(c.id)}" onclick="abrirDocumentoFiscal(this.dataset.id)">
                <span class="fluxo-cartao-linha"><span>NF Nº ${escaparAtributo(c.numero || '—')}${c.app ? ` · ${escaparAtributo(c.app)}` : ''}</span>${tempo}</span>
                <b class="fluxo-cartao-nome">${escaparAtributo(c.participante_nome || 'Fornecedor')}</b>
                <small>Emitida em ${dataBrFluxo(c.dia)}</small>
                <small class="fluxo-cartao-contexto">${escaparAtributo(contextoCartaoFluxo(quadro, c))}</small>
                <span class="fluxo-cartao-valor">${reaisFluxo(c.valor_total)}</span>
            </button>`
    const receber = Number(c.valor_a_receber) > 0 && !final
        ? `<small class="fluxo-receber ${Number(c.parcelas_atrasadas) ? 'atrasado' : ''}">${Number(c.parcelas_atrasadas) ? 'Atrasado: ' : 'A receber: '}${reaisFluxo(c.valor_a_receber)}${c.proximo_vencimento ? ` · vence ${dataBrFluxo(c.proximo_vencimento)}` : ''}</small>`
        : ''
    return `
        <button type="button" class="fluxo-cartao ${parado ? 'parado' : ''}" data-id="${escaparAtributo(c.orcamento_id)}" onclick="abrirEsquema(this.dataset.id)">
            <span class="fluxo-cartao-linha"><span>${escaparAtributo(c.contrato || '')}${pedidoCartaoFluxo(c.numero_pedido)}</span>${tempo}</span>
            <b class="fluxo-cartao-nome">${escaparAtributo(c.cliente || 'Cliente não informado')}</b>
            ${c.cidade ? `<small>${escaparAtributo(c.cidade)}</small>` : ''}
            <small class="fluxo-cartao-contexto">${escaparAtributo(contextoCartaoFluxo(quadro, c))}</small>
            <span class="fluxo-cartao-valor">${reaisFluxo(c.valor_pedido)} <small>pedido em ${dataBrFluxo(c.data_pedido)}</small></span>
            ${receber}
        </button>`
}

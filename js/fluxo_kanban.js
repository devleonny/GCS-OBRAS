// ---------------- Fluxos em kanban (como o "3." do Omie): Vendas, Serviços e Compras ----------------
// Cada cartão anda sozinho pelos dados que já existem; não se arrasta. O clique abre o orçamento
// (abrirEsquema) ou a nota recebida (abrirDocumentoFiscal).
//   Vendas e Serviços: vw_fluxo_comercial (gcs/migrations/fluxo-kanban.sql), um cartão por orçamento com pedido,
//     etapa calculada no servidor pelo código ORC: pedido → requisição → NF do Omie → envio → recebimento.
//   Compras: notas recebidas do Fiscal (vw_fiscal_documentos, direção entrada), etapa calculada aqui.
// Período padrão: 30 dias (pela data do pedido / emissão). Coluna em aberto mostra no topo quantos estão
// parados há mais tempo que o período ("+N parados"), que se abrem com um clique. As tabelas seguem com tudo.

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
        const aberto = estadoFluxo.abertos.has(col.etapa)
        const lista = [...col.cartoes, ...(aberto ? col.parados : [])]
        const total = col.cartoes.length
        const soltar = novo ? `ondragover="permitirSoltarFluxo(event, '${col.etapa}')" ondragleave="sairSoltarFluxo(event)" ondrop="soltarFluxo(event, '${col.etapa}')"` : ''
        return `
            <section class="fluxo-coluna ${col.final ? 'final' : ''}" data-etapa="${col.etapa}" ${soltar}>
                <header class="fluxo-coluna-topo">
                    <b>${col.titulo}</b>
                    <small>${total ? `${total} registro(s)${col.valor ? ` · ${reaisFluxo(col.valor)}` : ''}` : 'Nenhum registro no período'}</small>
                </header>
                ${col.parados.length ? `
                    <button type="button" class="fluxo-parados ${aberto ? 'aberto' : ''}" onclick="alternarParadosFluxo('${col.etapa}')"
                        title="Cartões desta etapa com data anterior ao período escolhido">
                        ${aberto ? 'Esconder' : '+'} ${col.parados.length} parado(s) há mais de ${estadoFluxo.periodo} dias</button>` : ''}
                ${novo && col.etapa === 'separado' ? `
                    <button type="button" class="fluxo-faturar-todas" onclick="faturarTodasFluxo()"
                        ${[...col.cartoes, ...col.parados].some(c => !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status)) ? '' : 'disabled'}
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

// "Faturar todas" (rodapé de Separado): emite em fila as notas da empresa escolhida no topo.
async function faturarTodasFluxo() {
    const empresa = estadoFluxo.empresa
    const prontos = estadoFluxo.linhas.filter(c => c.etapa === 'separado'
        && !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status)
        && (!empresa || (empresa === '-' ? !c.empresa : c.empresa === empresa)))
    if (!prontos.length) return popup({ mensagem: 'Nenhum cartão em Separado para faturar.' })
    const ok = await confirmarPopup({
        titulo: 'Faturar todas',
        mensagem: `Emitir ${prontos.length} nota(s)${empresa ? ` da empresa ${empresa === '-' ? 'sem empresa' : escaparAtributo(empresa)}` : ''}?`,
        textoConfirmar: 'Emitir todas'
    })
    if (!ok) return
    try {
        // Os cartões vão na hora para Faturado; os recusados voltam para Separado em vermelho.
        await apiModuloFiscal('fluxo-itens/faturar', { empresa: empresa || null })
        carregarFluxo()
    } catch (err) {
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
    const abrir = c.orcamento_id ? `data-orcamento="${escaparAtributo(c.orcamento_id)}" onclick="abrirEsquema(this.dataset.orcamento)" onkeydown="if (event.key === 'Enter') abrirEsquema(this.dataset.orcamento)"` : ''
    return `
        <article class="fluxo-cartao fluxo-item ${estado} ${parado ? 'parado' : ''} ${c.orcamento_id ? 'clicavel' : ''}" data-id="${id}" tabindex="0" ${dica} ${arrastavel} ${abrir}>
            <span class="fluxo-cartao-linha"><span>${escaparAtributo(c.contrato || c.departamento || 'Sem orçamento')}${pedidoCartaoFluxo(c.numero_pedido)}</span>${tempo}</span>
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

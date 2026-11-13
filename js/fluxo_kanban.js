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
    compras: {
        titulo: 'Fluxo de Compras',
        colunas: [['sefaz', 'Emitida pelo Fornecedor'], ['conferir', 'Ciência / Conferir Itens'], ['pronta', 'Pronta para Lançar'], ['lancada', 'Lançada no Estoque']],
        finais: ['lancada']
    }
}
const PERIODOS_FLUXO = [[30, 'Últimos 30 dias'], [60, 'Últimos 60 dias'], [90, 'Últimos 90 dias'], [180, 'Últimos 6 meses'], [365, 'Último ano'], [0, 'Todo o período']]
const estadoFluxo = { quadro: 'vendas', periodo: 30, busca: '', linhas: [], abertos: new Set(), carregando: 0 }

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
    const desde = {
        faturado: c => c.data_faturamento, entrega: c => c.data_saida, entregue: c => c.data_entrega
    }
    return linhas.map(c => ({ ...c, data: c.data_pedido, desde: (desde[c.etapa]?.(c)) || c.data_pedido }))
}

// Distribui nas colunas: no período (pela data) ou, se a coluna está em aberto, "parado" (mais antigo).
// Colunas finais só mostram o período. busca: cliente, ORC, pedido, NF, cidade, fornecedor.
function colunasFluxo(quadro, cartoes, { periodo = 30, busca = '', hoje = dataServidor() } = {}) {
    const config = QUADROS_FLUXO[quadro]
    const termo = normalFluxo(busca).trim()
    const combina = c => !termo || normalFluxo([c.contrato, c.cliente, c.cidade, c.numero_pedido, c.participante_nome, c.numero,
        ...(Array.isArray(c.notas) ? c.notas.map(n => n.n_nota) : [])].join(' ')).includes(termo)
    return config.colunas.map(([etapa, titulo]) => {
        const daEtapa = cartoes.filter(c => c.etapa === etapa && combina(c))
            .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
        const noPeriodo = periodo ? daEtapa.filter(c => (diasDesdeFluxo(c.data, hoje) ?? 0) <= periodo) : daEtapa
        const parados = periodo && !config.finais.includes(etapa) ? daEtapa.filter(c => (diasDesdeFluxo(c.data, hoje) ?? 0) > periodo) : []
        // Total do cabeçalho: só o que está no período (os parados têm a contagem no botão deles).
        const valor = noPeriodo.reduce((s, c) => s + Number(c.valor_pedido ?? c.valor_total ?? 0), 0)
        return { etapa, titulo, cartoes: noPeriodo, parados, valor, final: config.finais.includes(etapa) }
    })
}

// ---------------- Tela ----------------
// Entradas do menu (js/esquema_botoes.js chama window[funcao]): precisam ser "function", não const,
// porque const no topo do script não vira propriedade de window e o clique no menu não faria nada.
function telaFluxoVendas() { return telaFluxo('vendas') }
function telaFluxoServicos() { return telaFluxo('servicos') }
function telaFluxoCompras() { return telaFluxo('compras') }

async function telaFluxo(quadro) {
    estadoFluxo.quadro = quadro
    estadoFluxo.abertos.clear()
    tela.innerHTML = `
        <div class="pagina-conteudo fluxo-pagina" data-quadro="${quadro}">
            <div class="fluxo-topo">
                <h2>${QUADROS_FLUXO[quadro].titulo}</h2>
                <input type="search" class="fluxo-busca" placeholder="${quadro === 'compras' ? 'Buscar fornecedor ou número da nota' : 'Buscar cliente, ORC, pedido, NF ou cidade'}"
                    value="${escaparAtributo(estadoFluxo.busca)}" oninput="estadoFluxo.busca = this.value; renderizarFluxo()">
                <select class="fluxo-periodo" aria-label="Período" onchange="estadoFluxo.periodo = Number(this.value); estadoFluxo.abertos.clear(); renderizarFluxo()">
                    ${PERIODOS_FLUXO.map(([v, t]) => `<option value="${v}" ${estadoFluxo.periodo === v ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <small class="fluxo-ajuda">${quadro === 'compras' ? 'Período pela emissão da nota.' : 'Período pela data do pedido.'} Os cartões andam sozinhos; clique para abrir.</small>
            </div>
            <div class="fluxo-quadro"><p class="fluxo-vazio">Carregando…</p></div>
        </div>`
    await carregarFluxo()
}

async function carregarFluxo() {
    const consulta = ++estadoFluxo.carregando
    const quadro = estadoFluxo.quadro
    try {
        const base = quadro === 'compras' ? 'vw_fiscal_documentos' : 'vw_fluxo_comercial'
        const filtros = quadro === 'compras' ? { direcao: { op: '=', value: 'entrada' } } : { quadro: { op: '=', value: quadro } }
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
    const colunas = colunasFluxo(quadro, estadoFluxo.linhas, { periodo: estadoFluxo.periodo, busca: estadoFluxo.busca })
    area.innerHTML = colunas.map(col => {
        const aberto = estadoFluxo.abertos.has(col.etapa)
        const lista = [...col.cartoes, ...(aberto ? col.parados : [])]
        const total = col.cartoes.length
        return `
            <section class="fluxo-coluna ${col.final ? 'final' : ''}" data-etapa="${col.etapa}">
                <header class="fluxo-coluna-topo">
                    <b>${col.titulo}</b>
                    <small>${total ? `${total} registro(s)${col.valor ? ` · ${reaisFluxo(col.valor)}` : ''}` : 'Nenhum registro no período'}</small>
                </header>
                ${col.parados.length ? `
                    <button type="button" class="fluxo-parados ${aberto ? 'aberto' : ''}" onclick="alternarParadosFluxo('${col.etapa}')"
                        title="Cartões desta etapa com data anterior ao período escolhido">
                        ${aberto ? 'Esconder' : '+'} ${col.parados.length} parado(s) há mais de ${estadoFluxo.periodo} dias</button>` : ''}
                <div class="fluxo-cartoes">
                    ${lista.length ? lista.map(c => cartaoFluxo(quadro, c, col.parados.includes(c))).join('') : '<p class="fluxo-vazio">Nenhum registro</p>'}
                </div>
            </section>`
    }).join('')
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

function cartaoFluxo(quadro, c, parado) {
    const dias = diasDesdeFluxo(c.desde)
    const final = QUADROS_FLUXO[quadro].finais.includes(c.etapa)
    const tempo = !final && dias != null ? `<span class="fluxo-dias ${dias > 30 ? 'velho' : dias > 7 ? 'morno' : ''}" title="Dias nesta etapa">${dias} d</span>` : ''
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

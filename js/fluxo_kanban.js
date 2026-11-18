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
// -1 = Hoje (18/11/2026, a pedido): só o que tem a data de hoje.
const PERIODOS_FLUXO = [[-1, 'Hoje'], [30, 'Últimos 30 dias'], [60, 'Últimos 60 dias'], [90, 'Últimos 90 dias'], [180, 'Últimos 6 meses'], [365, 'Último ano'], [0, 'Todo o período']]
const estadoFluxo = { quadro: 'vendas', periodo: 30, busca: '', empresa: '', linhas: [], abertos: new Set(), carregando: 0 }
// Chave no topo de todos os quadros (Todos | AC | IAC | HNK | HNW). Compras: empresa destinatária da nota (app);
// Vendas: empresa do item; Serviços: empresa do pedido (ou da nota) pela vw_fluxo_comercial.empresa.
const EMPRESAS_FLUXO = [['', 'Todos'], ['AC', 'AC'], ['IAC', 'IAC'], ['HNK', 'HNK'], ['HNW', 'HNW']]
function chaveEmpresaFluxoHtml() {
    return `<div class="fluxo-chave-empresa" role="group" aria-label="Empresa">${EMPRESAS_FLUXO.map(([v, t]) =>
        `<button type="button" data-empresa="${v}" class="${estadoFluxo.empresa === v ? 'ativo' : ''}" aria-pressed="${estadoFluxo.empresa === v}"
            onclick="escolherEmpresaFluxo(this.dataset.empresa)">${t}</button>`).join('')}</div>`
}
function escolherEmpresaFluxo(empresa) {
    estadoFluxo.empresa = empresa
    estadoFluxo.abertos.clear()
    document.querySelectorAll('.fluxo-chave-empresa button').forEach(b => {
        const ativo = b.dataset.empresa === empresa
        b.classList.toggle('ativo', ativo)
        b.setAttribute('aria-pressed', ativo)
    })
    renderizarFluxo()
}

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
        return linhas.filter(d => !d.excluido).map(d => ({ ...d, empresa: d.app, etapa: etapaCompraFluxo(d), data: d.dia, desde: d.dia })).filter(c => c.etapa)
    if (QUADROS_FLUXO[quadro]?.novo)
        return linhas.map(c => ({ ...c, data: c.data, desde: c.data }))
    const desde = {
        faturado: c => c.data_faturamento, entrega: c => c.data_saida, entregue: c => c.data_entrega
    }
    // Período pela data mais recente (pedido ou última nota): nota nova num ORC antigo (contrato mensal)
    // traz o cartão de volta ao período (16/11/2026; antes contava só a data do pedido).
    const recente = c => [c.data_pedido, c.data_faturamento].filter(Boolean).map(String).sort().at(-1) || c.data_pedido
    return linhas.map(c => ({ ...c, data: recente(c), desde: (desde[c.etapa]?.(c)) || c.data_pedido }))
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
        const limite = periodo === -1 ? 0 : periodo  // Hoje: 0 dia
        const noPeriodo = periodo ? daEtapa.filter(c => (diasDesdeFluxo(c.data, hoje) ?? 0) <= limite) : daEtapa
        const parados = periodo && !config.finais.includes(etapa) ? daEtapa.filter(c => (diasDesdeFluxo(c.data, hoje) ?? 0) > limite) : []
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
    // A empresa é compartilhada entre os quadros.
    if (!EMPRESAS_FLUXO.some(([v]) => v === estadoFluxo.empresa)) estadoFluxo.empresa = ''
    const lupa = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m13 13 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    tela.innerHTML = `
        <div class="pagina-conteudo fluxo-pagina" data-quadro="${quadro}">
            <header class="fluxo-topo">
                <button type="button" class="fluxo-topo-mais" aria-expanded="false" aria-label="Mostrar filtros e legenda" title="Filtros e legenda"
                    onclick="alternarTopoFluxo(this)">⋮</button>
                <div class="fluxo-titulo">
                    <h2>${QUADROS_FLUXO[quadro].titulo}</h2>
                    <small>${novo
                        ? 'Arraste o cartão para a próxima etapa · clique para abrir o orçamento'
                        : `${quadro === 'compras' ? 'Período pela emissão da nota' : 'Período pela data do pedido'} · os cartões andam sozinhos conforme os dados; clique para abrir`}</small>
                </div>
                ${novo || quadro === 'servicos' ? `
                <div class="fluxo-legenda" aria-label="Legenda da cor dos cartões">
                    <span><i class="fluxo-bolinha emitida"></i> Nota emitida</span>
                    <span><i class="fluxo-bolinha cancelada"></i> Cancelada / recusada</span>
                    <span><i class="fluxo-bolinha sem-nota"></i> Não emitida</span>
                </div>` : ''}
                <div class="fluxo-controles">
                    ${chaveEmpresaFluxoHtml()}
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
                    <button type="button" class="fluxo-atualizar" onclick="atualizarFluxoBotao(this)" title="Buscar de novo os dados">Atualizar</button>
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
        // Página grande: cada página recalcula a view inteira no servidor (COUNT(*) OVER()); com 500 por página
        // o Fluxo de Vendas fazia 7 consultas seguidas de ~2 s. Se ainda vier mais de uma, as demais vão juntas.
        const LIMITE = 5000
        const primeira = await pesquisarDB({ base, filtros, pagina: 1, limite: LIMITE })
        const linhas = [...(primeira?.resultados || [])]
        const paginas = Number(primeira?.paginas) || 1
        if (paginas > 1) {
            const resto = await Promise.all(Array.from({ length: paginas - 1 },
                (_, i) => pesquisarDB({ base, filtros, pagina: i + 2, limite: LIMITE })))
            resto.forEach(r => linhas.push(...(r?.resultados || [])))
        }
        if (consulta !== estadoFluxo.carregando || quadro !== estadoFluxo.quadro) return true
        estadoFluxo.linhas = cartoesFluxo(quadro, linhas)
        renderizarFluxo()
        return true
    } catch (erro) {
        console.error('[FLUXO]', erro)
        const area = document.querySelector('.fluxo-quadro')
        if (area) area.innerHTML = '<button type="button" onclick="carregarFluxo()">Falha ao carregar. Tentar de novo</button>'
        return false
    }
}

// Botão "Atualizar": mostra que está buscando (girando, desativado) e confirma no fim, para ninguém achar
// que o clique não fez nada (o quadro quase sempre já está em dia pelo aviso em tempo real).
async function atualizarFluxoBotao(botao) {
    if (botao.disabled) return
    const texto = botao.textContent
    botao.disabled = true
    botao.classList.add('atualizando')
    botao.innerHTML = '<span class="fluxo-girando" aria-hidden="true"></span> Atualizando…'
    const inicio = Date.now()
    const ok = await carregarFluxo()
    // Pelo menos meio segundo de "Atualizando…": mais rápido que isso parece que nada aconteceu.
    await new Promise(r => setTimeout(r, Math.max(0, 500 - (Date.now() - inicio))))
    botao.classList.remove('atualizando')
    botao.classList.toggle('falhou', !ok)
    botao.textContent = ok ? 'Atualizado ✓' : 'Falhou, tente de novo'
    setTimeout(() => {
        botao.disabled = false
        botao.classList.remove('falhou')
        botao.textContent = texto
    }, ok ? 1500 : 2500)
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
// "⋮" do topo (só no celular): mostra/esconde a explicação, a legenda e os controles (busca, período...).
function alternarTopoFluxo(botao) {
    const topo = botao.closest('.fluxo-topo')
    if (!topo) return
    const abrir = !topo.classList.contains('aberto')
    topo.classList.toggle('aberto', abrir)
    botao.setAttribute('aria-expanded', String(abrir))
}

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
// Também (16/11/2026, a pedido): VOLTAR para qualquer coluna anterior e CONCLUIR direto de qualquer etapa.
// O que o item já tem fica: ao avançar de novo, a requisição já existe (só anda ou cria outra), a NF-e abre
// o rascunho já preenchido e a nota autorizada só anda o cartão.
const ORDEM_ITENS_FLUXO = ['pedido', 'requisicao', 'separado', 'faturado', 'entregue', 'concluido']
const ACAO_ITENS_FLUXO = { pedido: 'Requisição', requisicao: 'Separar (NF-e ou NFS-e)', separado: 'Faturar', faturado: 'Entregue', entregue: 'Concluir' }
const proximaEtapaFluxo = etapa => ORDEM_ITENS_FLUXO[ORDEM_ITENS_FLUXO.indexOf(etapa) + 1] || null
// Para onde o cartão pode ser solto: a próxima etapa, qualquer anterior e Concluído. Rodada (modelo novo) em
// Pedido também vai direto para Separado: serviço sem requisição, pela NFS-e.
const destinosItemFluxo = (etapa, c = null) => {
    const i = ORDEM_ITENS_FLUXO.indexOf(etapa)
    if (i < 0) return []
    return ORDEM_ITENS_FLUXO.filter((e, j) => j !== i && (j < i || j === i + 1 || e === 'concluido'
        || (etapa === 'pedido' && e === 'separado' && c?.rodada != null)))
}
const NOME_COLUNA_FLUXO = { pedido: 'Pedido de Venda', requisicao: 'Requisição', separado: 'Separado', faturado: 'Faturado', entregue: 'Entregue', concluido: 'Concluído' }
const itemFluxo = id => estadoFluxo.linhas.find(c => c.id === id)
let arrasteFluxo = null

function iniciarArrasteFluxo(evento, id) {
    arrasteFluxo = id
    evento.dataTransfer.effectAllowed = 'move'
    evento.dataTransfer.setData('text/plain', id)
    for (const alvo of destinosItemFluxo(itemFluxo(id)?.etapa, itemFluxo(id)))
        document.querySelector(`.fluxo-pagina .fluxo-coluna[data-etapa="${alvo}"]`)?.classList.add('fluxo-alvo')
}

function terminarArrasteFluxo() {
    arrasteFluxo = null
    document.querySelectorAll('.fluxo-alvo, .fluxo-alvo-sobre').forEach(el => el.classList.remove('fluxo-alvo', 'fluxo-alvo-sobre'))
}

function permitirSoltarFluxo(evento, etapa) {
    const arrastado = itemFluxo(arrasteFluxo)
    if (!destinosItemFluxo(arrastado?.etapa, arrastado).includes(etapa)) return
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
    if (!destinosItemFluxo(c.etapa, c).includes(etapa)) return
    // Pedido → Separado (rodada de serviço): NFS-e direto, sem requisição.
    if (c.etapa === 'pedido' && etapa === 'separado') return abrirNfseFluxo(c).catch(err => { removerOverlay(); popup({ mensagem: mensagemErroEst(err) }) })
    // Próxima etapa: o que ela pede (formulário, emissão, confirmação). Concluído direto e volta: confirmação.
    if (proximaEtapaFluxo(c.etapa) === etapa) return avancarItemFluxo(id)
    await moverItemFluxo(c, etapa)
}

function nomeItemFluxo(c) {
    return `<b>${escaparAtributo(c.cliente || 'cliente não informado')}</b> (${escaparAtributo(c.contrato || c.departamento || 'sem orçamento')})`
}

// Volta para uma etapa anterior (sem perguntar, a pedido em 16/11/2026) ou conclui direto (confirma).
async function moverItemFluxo(c, etapa) {
    const volta = ORDEM_ITENS_FLUXO.indexOf(etapa) < ORDEM_ITENS_FLUXO.indexOf(c.etapa)
    if (!volta) {
        const ok = await confirmarPopup({
            titulo: 'Concluir',
            mensagem: `Concluir ${nomeItemFluxo(c)} direto, sem passar pelas etapas que faltam?<br><small>Para itens que já passaram desse fluxo ou que não vão ter nota.</small>`,
            textoConfirmar: 'Concluir'
        })
        if (!ok) return
    }
    await moverOtimistaFluxo(c.id, etapa)
}

// Movimento instantâneo: o cartão muda de coluna na hora e o servidor confirma por trás
// (gcs /fluxo-itens/mover). Recusou: o cartão volta para onde estava, marcado, com o aviso do servidor.
// O aviso em tempo real (fluxo_itens) atualiza o resto do quadro depois.
async function moverOtimistaFluxo(id, etapa) {
    const c = itemFluxo(id)
    if (!c) return
    const anterior = { etapa: c.etapa }
    c.etapa = etapa
    renderizarFluxo()
    try {
        await apiModuloFiscal('fluxo-itens/mover', { id, para: etapa.toUpperCase() })
    } catch (err) {
        const atual = itemFluxo(id)
        if (atual && atual.etapa === etapa) Object.assign(atual, anterior)
        renderizarFluxo()
        const cartao = document.querySelector(`.fluxo-pagina .fluxo-cartao[data-id="${CSS.escape(id)}"]`)
        cartao?.classList.add('recusado')
        cartao?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        setTimeout(() => cartao?.classList.remove('recusado'), 2500)
        if (await tratarPendenciaFluxo(err, c)) return moverOtimistaFluxo(id, etapa)
    }
}

// Recusas do servidor com pendência do orçamento (gcs /fluxo-itens/mover e /faturar):
//   SALDO_ABERTO: concluir pede a baixa do saldo com motivo (fica registrada) e tenta de novo (devolve true).
//   PROMESSA_PEDIDO: o pedido ainda é promessa: oferece abrir o pedido para completar.
async function tratarPendenciaFluxo(err, c) {
    if (err?.codigo === 'SALDO_ABERTO' && c?.orcamento_id) {
        const motivo = await pedirTextoPopup({
            titulo: 'Concluir com saldo a faturar',
            mensagem: `${escEst(err.message)}<br><br>Motivo da baixa (${err.saldo?.escopo === 'SEM_PEDIDO' ? 'OC menor que o orçamento, item retirado na negociação...' : 'desconto, item cancelado, faturado em outro ORC...'}):`,
            textoConfirmar: 'Dar baixa e concluir', minimo: 10, maximo: 500
        })
        if (!motivo) return false
        try {
            await apiModuloFiscal('fluxo-itens/baixa', { orcamento_id: c.orcamento_id, motivo, escopo: err.saldo?.escopo, pedido_id: err.saldo?.pedido_id })
            return true
        } catch (e) {
            popup({ mensagem: mensagemErroEst(e) })
            return false
        }
    }
    if (err?.codigo === 'PROMESSA_PEDIDO') {
        popup({
            titulo: 'Falta o pedido do cliente',
            mensagem: escEst(err.message),
            botoes: c?.pedido_id && c?.contrato
                ? [{ texto: 'Completar pedido', img: 'editar', funcao: `removerPopup(); completarPedidoPrometido('${escaparAtributo(c.pedido_id)}', '${escaparAtributo(c.contrato)}')` }]
                : []
        })
        return false
    }
    popup({ titulo: 'Não foi possível mover', mensagem: mensagemErroEst(err) })
    return false
}

// Pedido → Requisição quando o item já tem requisição (voltou): só andar ou criar outra.
function escolherRequisicaoFluxo(c) {
    return new Promise(resolve => {
        const id = popup({
            titulo: 'Requisição',
            mensagem: `${nomeItemFluxo(c)} já tem ${Number(c.requisicoes)} requisição(ões).<br>Só avançar o cartão ou criar outra requisição?`,
            botoes: [
                { texto: 'Nova requisição', img: 'adicionar', funcao: `respostaRequisicaoFluxo(this, 'nova')` },
                { texto: 'Só avançar', img: 'concluido', funcao: `respostaRequisicaoFluxo(this, 'avancar')` }
            ]
        })
        respostasRequisicaoFluxo.set(id, resolve)
        const observador = new MutationObserver(() => {
            if (document.getElementById(id)) return
            observador.disconnect()
            respostasRequisicaoFluxo.get(id)?.(null)
            respostasRequisicaoFluxo.delete(id)
        })
        observador.observe(document.body, { childList: true })
    })
}
const respostasRequisicaoFluxo = new Map()
function respostaRequisicaoFluxo(botao, resposta) {
    const id = botao.closest('.popup')?.id
    const resolver = respostasRequisicaoFluxo.get(id)
    respostasRequisicaoFluxo.delete(id)
    removerPopup(id)
    resolver?.(resposta)
}

async function avancarItemFluxo(id) {
    const c = itemFluxo(id)
    if (!c) return
    const nome = nomeItemFluxo(c)
    try {
        if (c.etapa === 'pedido') {
            if (Number(c.requisicoes) > 0) {
                const escolha = await escolherRequisicaoFluxo(c)
                if (!escolha) return
                if (escolha === 'avancar') return moverOtimistaFluxo(id, 'requisicao')
            }
            return await abrirRequisicaoFluxo(c)
        }
        if (c.etapa === 'requisicao') {
            // Rodada do modelo novo: a nota dá a natureza (NF-e = venda; NFS-e = serviço, com o uso e consumo dentro).
            if (c.rodada != null) {
                const escolha = await escolherOpcaoFluxo('Separar', `Qual nota sai nesta rodada de ${nomeItemFluxo(c)}?`,
                    [['nfse', 'NFS-e (serviço)', 'servicos_nfse'], ['nfe', 'NF-e (venda)', 'concluido']])
                if (!escolha) return
                if (escolha === 'nfse') return await abrirNfseFluxo(c)
            }
            return await abrirNotaFluxo(c)
        }
        if (c.etapa === 'separado') {
            if (!await confirmarPopup({ titulo: 'Faturar', mensagem: `Emitir agora a NF-e de ${nome}?`, textoConfirmar: 'Emitir' })) return
            // O cartão vai na hora para Faturado ("emitindo"); se a nota for recusada, volta para Separado em vermelho.
            try {
                await apiModuloFiscal('fluxo-itens/faturar', { id })
            } catch (err) {
                if (err?.codigo === 'PROMESSA_PEDIDO') return tratarPendenciaFluxo(err, c)
                throw err
            }
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
            return moverOtimistaFluxo(id, entregar ? 'entregue' : 'concluido')
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

// Escolha simples num popup (promessa com o valor do botão; fechar = null).
function escolherOpcaoFluxo(titulo, mensagem, opcoes) {
    return new Promise(resolve => {
        const chave = crypto.randomUUID()
        respostasRequisicaoFluxo.set(chave, resolve)
        const id = popup({
            titulo, mensagem,
            botoes: opcoes.map(([valor, texto, img]) => ({ texto, img: img || 'concluido', funcao: `respostaOpcaoFluxo('${chave}', '${valor}', this)` }))
        })
        const observador = new MutationObserver(() => {
            if (document.getElementById(id)) return
            observador.disconnect()
            respostasRequisicaoFluxo.get(chave)?.(null)
            respostasRequisicaoFluxo.delete(chave)
        })
        observador.observe(document.body, { childList: true })
    })
}
function respostaOpcaoFluxo(chave, valor, botao) {
    const resolver = respostasRequisicaoFluxo.get(chave)
    respostasRequisicaoFluxo.delete(chave)
    removerPopup(botao.closest('.popup')?.id)
    resolver?.(valor)
}

// Rodada de serviço → Separado: NFS-e montada pelo servidor (gcs /fluxo-itens/nfse: tomador, ORC, condição e o
// saldo do pedido); salvar leva o cartão para Separado e Faturar emite. O Omie segue emitindo também: a NFS-e
// que chegar de lá pela sincronização fatura a rodada do mesmo jeito.
async function abrirNfseFluxo(c) {
    overlayAguarde()
    const dados = await apiModuloFiscal('fluxo-itens/nfse', { id: c.id })
    removerOverlay()
    if (dados.autorizada) {
        if (!await confirmarPopup({ titulo: 'Separado', mensagem: `${nomeItemFluxo(c)} já tem a nota autorizada. Avançar o cartão para Separado?`, textoConfirmar: 'Avançar' })) return
        return moverOtimistaFluxo(c.id, 'separado')
    }
    await formularioEmissaoNFSe({ ...dados, fluxo_item: c.id })
}

// Requisição → Separado: NF-e preenchida pelo servidor; salvar o rascunho leva o cartão para Separado.
async function abrirNotaFluxo(c) {
    overlayAguarde()
    const dados = await apiModuloFiscal('fluxo-itens/nota', { id: c.id })
    removerOverlay()
    // Voltou com a nota já autorizada: não há o que separar, o cartão só anda.
    if (dados.autorizada) {
        if (!await confirmarPopup({ titulo: 'Separado', mensagem: `${nomeItemFluxo(c)} já tem a NF-e autorizada. Avançar o cartão para Separado?`, textoConfirmar: 'Avançar' })) return
        return moverOtimistaFluxo(c.id, 'separado')
    }
    // Com rascunho (voltou): abre o rascunho, com tudo o que já foi preenchido.
    await formularioEmissaoNFe({ ...dados, fluxo_item: c.id })
    if (!dados.itens?.length)
        popup({ mensagem: 'As requisições deste item não têm produtos: inclua os itens da nota antes de salvar.' })
}

// Clique no cartão em Requisição: o mesmo formulário da separação, só para conferir (somente leitura).
async function abrirPreviaSeparacaoFluxo(id) {
    try {
        overlayAguarde()
        const dados = await apiModuloFiscal('fluxo-itens/nota', { id })
        removerOverlay()
        if (dados.autorizada) return abrirDocumentoFiscal(dados.autorizada.id)
        await formularioEmissaoNFe({ ...dados, fluxo_item: id, previa: true })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
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
    // Em Requisição o clique mostra a prévia da separação (formulário travado, sem salvar: o cartão fica).
    if (itemFluxo(id)?.etapa === 'requisicao') return abrirPreviaSeparacaoFluxo(id)
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
        // Opções do orçamento (18/11/2026, a pedido): os atalhos completos (Histórico, Painel de Custos, PDF, OS...).
        c.orcamento_id ? ['Opções do Orçamento', `abrirAtalhos('${escaparAtributo(c.orcamento_id)}')`] : null,
        nota && c.etapa === 'separado' ? ['Editar NF-e', `editarNotaItemFluxo('${id}')`] : null,
        nota && c.emissao_status !== 'OK' ? ['Espelho', `espelhoNotaItemFluxo('${escaparAtributo(nota)}')`] : null,
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

// Saldo a faturar do orçamento (gcs orcamento_saldo: pedidos − notas de venda/serviço − baixas). Só aparece
// quando passa da tolerância (R$ 10 ou 0,5% dos pedidos); acima do pedido costuma ser pedido com valor errado.
function saldoCartaoFluxo(c) {
    // "Sem pedido": parte do orçamento que ainda não tem OC (ex.: o serviço cuja OC chega no fim da obra).
    const total = Number(c.orcamento_total) || 0, semPedido = Number(c.orcamento_sem_pedido) || 0
    const htmlSemPedido = Number(c.orcamento_pedidos) > 0 && semPedido > Math.max(10, total * 0.005)
        ? `<small class="fluxo-saldo" title="${escaparAtributo(`Orçamento ${reaisFluxo(total)} · pedidos ${reaisFluxo(c.orcamento_pedidos)}`)}">Sem pedido ${reaisFluxo(semPedido)}</small>`
        : ''
    // Rodada (modelo novo): o valor do cartão já é o saldo (aberta) ou o faturado (fechada).
    if (c.rodada != null) return htmlSemPedido
    if (c.orcamento_saldo == null) return htmlSemPedido
    const saldo = Number(c.orcamento_saldo) || 0, pedidos = Number(c.orcamento_pedidos) || 0
    if (Math.abs(saldo) <= Math.max(10, pedidos * 0.005)) return ''
    const dica = escaparAtributo(`Pedidos do orçamento ${reaisFluxo(pedidos)} · faturado ${reaisFluxo(c.orcamento_faturado)}`)
    return (saldo > 0
        ? `<small class="fluxo-saldo" title="${dica}">Saldo a faturar ${reaisFluxo(saldo)}</small>`
        : `<small class="fluxo-saldo acima" title="${dica}">Faturado acima do pedido em ${reaisFluxo(-saldo)}</small>`) + htmlSemPedido
}

// Rodada de faturamento do pedido (modelo novo): "R2" e a natureza que a nota deu (ou "a definir").
function rodadaCartaoFluxo(c) {
    if (c.rodada == null) return ''
    const natureza = String(c.tipo || '').toUpperCase()
    // Rodada com NF-e e NFS-e: aqui (Fluxo de Vendas) vale a venda; a NFS-e aparece no Fluxo de Serviços.
    const nome = natureza.startsWith('SERVI') ? 'Serviço' : natureza.includes('VENDA') ? 'Venda' : ''
    const conferir = (Array.isArray(c.notas) ? c.notas : []).some(n => n.atribuicao === 'CONFERIR' && n.cancelado !== 'S')
    return `<span class="fluxo-cartao-balao" title="Rodada ${Number(c.rodada)} de faturamento do pedido">
        ${etiquetaEst(`Rodada ${Number(c.rodada)}${nome ? ` · ${nome}` : ''}`, nome === 'Serviço' ? '#7c3aed' : nome === 'Venda' ? '#2563eb' : '#6b7280')}
        ${conferir ? etiquetaEst('Conferir pedido da nota', '#b91c1c') : ''}</span>`
}

// Cartão do quadro novo (vw_fluxo_itens): item que anda até Concluído; marca verde/vermelha da emissão.
function cartaoItemFluxo(c, parado, tempo) {
    // Rodada com venda e serviço (18/11/2026): no Fluxo de Vendas só a NF-e; a NFS-e fica no Fluxo de Serviços.
    const soVenda = c.rodada != null && String(c.tipo || '').toUpperCase().includes('VENDA')
    const nfs = (Array.isArray(c.notas) ? c.notas : [])
        .filter(n => n.n_nota && n.cancelado !== 'S' && n.categoria !== 'remessa' && !(soVenda && n.categoria === 'serviço'))
        .map(n => String(n.n_nota).replace(/^0+/, ''))
    const contexto = [
        c.rodada == null && c.tipo && c.tipo !== 'VENDA' ? c.tipo : '',
        Number(c.requisicoes) ? `${c.requisicoes} requisição(ões)` : '',
        nfs.length ? `NF ${nfs.join(', ')}` : '',
        Number(c.envios) ? `${c.envios} envio(s)` : ''
    ].filter(Boolean).join(' · ')
    // Cor da lateral: azul (padrão), verde (nota faturada/emitida), vermelho (emissão recusada: o motivo
    // fica só no "title", ao passar o mouse). Enquanto emite, só a marquinha "Emitindo…".
    // NF-e do GCS cancelada: balão "Cancelada" e sem o verde de faturada.
    const cancelada = c.nota_status === 'CANCELADA'
    // Verde só com nota (do GCS autorizada ou do Omie), em qualquer coluna; sem nota fica azul, mesmo
    // concluído direto (16/11/2026, a pedido).
    const faturada = !cancelada && (c.nota_status === 'AUTORIZADA' || c.emissao_status === 'OK' || nfs.length > 0)
    const estado = c.emissao_status === 'ERRO' ? 'erro' : cancelada ? 'cancelada' : faturada ? 'faturada' : ''
    const dica = c.emissao_status === 'ERRO' && c.emissao_mensagem ? `title="${escaparAtributo(`Emissão recusada: ${c.emissao_mensagem}`)}"` : ''
    const emissao = ['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status) ? '<small class="fluxo-emissao andando">Emitindo…</small>' : ''
    const id = escaparAtributo(c.id)
    // Anda só arrastando (sem botão no cartão, a pedido): próxima coluna, qualquer anterior ou Concluído.
    const podeAvancar = ORDEM_ITENS_FLUXO.includes(c.etapa) && !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status)
    const arrastavel = podeAvancar ? `draggable="true" ondragstart="iniciarArrasteFluxo(event, '${id}')" ondragend="terminarArrasteFluxo()"` : ''
    // Clique: painel do item (nota, histórico da SEFAZ, histórico do cartão e o orçamento).
    const abrir = `onclick="abrirItemFluxo('${id}')" onkeydown="if (event.key === 'Enter') abrirItemFluxo('${id}')"`
    return `
        <article class="fluxo-cartao fluxo-item ${estado} ${parado ? 'parado' : ''} ${c.orcamento_id ? 'clicavel' : ''}" data-id="${id}" tabindex="0" ${dica} ${arrastavel} ${abrir}>
            <span class="fluxo-cartao-linha"><span>${escaparAtributo(c.contrato || c.departamento || 'Sem orçamento')}${pedidoCartaoFluxo(c.numero_pedido)}</span>
                <span class="fluxo-cartao-cantos">${tempo}<button type="button" class="fluxo-menu-btn" title="Mais opções" aria-label="Mais opções"
                    onclick="abrirMenuItemFluxo(event, '${id}')">⋮</button></span></span>
            <b class="fluxo-cartao-nome">${escaparAtributo(c.cliente || 'Cliente não informado')}</b>
            ${cancelada ? `<span class="fluxo-cartao-balao">${etiquetaEst('Cancelada', '#b91c1c')}</span>` : ''}
            ${rodadaCartaoFluxo(c)}
            ${c.pedido_prometido ? `<span class="fluxo-cartao-balao" title="Sem o pedido do cliente (ou com valor simbólico): a nota não sai até o pedido ser completado">${etiquetaEst('Pedido pendente', '#b45309')}</span>` : ''}
            ${c.cidade ? `<small>${escaparAtributo(c.cidade)}</small>` : ''}
            ${contexto ? `<small class="fluxo-cartao-contexto">${escaparAtributo(contexto)}</small>` : ''}
            <span class="fluxo-cartao-valor">${reaisFluxo(c.valor)} <small>${c.empresa ? `${escaparAtributo(c.empresa)} · ` : ''}desde ${dataBrFluxo(c.data)}</small></span>
            ${saldoCartaoFluxo(c)}
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
    // Serviços: mesma lateral do Fluxo de Vendas (4px; verde com nota, azul sem nota). As notas canceladas
    // do Omie já não vêm na vw_fluxo_comercial.
    const corNota = quadro === 'servicos'
        ? `fluxo-cor-nota ${(Array.isArray(c.notas) ? c.notas : []).some(n => n.n_nota) ? 'faturada' : ''}`
        : ''
    return `
        <button type="button" class="fluxo-cartao ${corNota} ${parado ? 'parado' : ''}" data-id="${escaparAtributo(c.orcamento_id)}" onclick="abrirEsquema(this.dataset.id)">
            <span class="fluxo-cartao-linha"><span>${escaparAtributo(c.contrato || '')}${pedidoCartaoFluxo(c.numero_pedido)}</span>${tempo}</span>
            <b class="fluxo-cartao-nome">${escaparAtributo(c.cliente || 'Cliente não informado')}</b>
            ${c.cidade ? `<small>${escaparAtributo(c.cidade)}</small>` : ''}
            <small class="fluxo-cartao-contexto">${escaparAtributo(contextoCartaoFluxo(quadro, c))}</small>
            <span class="fluxo-cartao-valor">${reaisFluxo(c.valor_pedido)} <small>pedido em ${dataBrFluxo(c.data_pedido)}</small></span>
            ${receber}
        </button>`
}

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
        colunas: [['pedido', 'Pedidos'], ['requisicao', 'Requisição'], ['separado', 'Separado'],
            ['faturado', 'Faturado'], ['entregue', 'Entregue'], ['concluido', 'Concluído']],
        finais: ['concluido']
    },
    // Fluxo de Serviços novo (19/11/2026, a pedido; gcs migrations/fluxo-servicos-novo-*.sql): mesmos itens do
    // de Vendas. "Pedidos" é o MESMO cartão nos dois quadros (quem pescar primeiro leva o valor; o que sobrar
    // continua em Pedidos com o saldo livre). Etapa pela coluna etapa_servico da vw_fluxo_itens:
    //   Pedidos → A faturar (chave 'concluido'; só automático desde 24/11/2026: chamado solucionado + saldo do
    //   pedido, sem pedido pendente nem liberação — gcs migrations/servico-a-faturar.sql) → Em preparação (NFS-e salva;
    //   "Faturar todas" como em Vendas) → Faturado (emissão) → Recebido (parcelas; com parcela pendente o cartão
    //   fica em Faturado E em Recebido; recebida a última, só em Recebido).
    itens_servicos: {
        titulo: 'Fluxo de Serviços',
        novo: true,
        servico: true,
        colunas: [['pedido', 'Pedidos'], ['concluido', 'A faturar'], ['preparacao', 'Em preparação'],
            ['faturado', 'Faturado'], ['recebido', 'Recebido']],
        finais: ['recebido']
    },
    compras: {
        titulo: 'Fluxo de Compras',
        colunas: [['sefaz', 'Emitida pelo Fornecedor'], ['conferir', 'Ciência / Conferir Itens'], ['pronta', 'Pronta para Lançar'], ['lancada', 'Lançada no Estoque']],
        finais: ['lancada']
    },
    // CT-e recebidos (26/11/2026, a pedido): a chave NF-e | CT-e no topo do Fluxo de Compras troca o quadro.
    // Etapa pela fatura a pagar do frete (vw_fiscal_ctes.fatura/fatura_pago — gcs migrations/fiscal-ctes-fluxo.sql).
    // O clique abre o CT-e (abrirCteFis), onde se responde "Gerar fatura a pagar?" e se abre a fatura.
    compras_cte: {
        titulo: 'Fluxo de Compras',
        colunas: [['emitido', 'Emitido pela Transportadora'], ['a_pagar', 'Fatura a Pagar'], ['pago', 'Pago'], ['sem_cobranca', 'Sem Cobrança']],
        finais: ['pago', 'sem_cobranca']
    }
}
const ehComprasFluxo = quadro => quadro === 'compras' || quadro === 'compras_cte'
// Chave NF-e | CT-e do Fluxo de Compras (mesmo visual da chave de empresa).
function chaveDocComprasFluxoHtml(quadro) {
    return `<div class="fluxo-chave-empresa fluxo-chave-doc" role="group" aria-label="Tipo de documento">${[['compras', 'NF-e'], ['compras_cte', 'CT-e']].map(([q, t]) =>
        `<button type="button" class="${quadro === q ? 'ativo' : ''}" aria-pressed="${quadro === q}" onclick="trocarDocComprasFluxo('${q}')">${t}</button>`).join('')}</div>`
}
function trocarDocComprasFluxo(quadro) {
    if (quadro === estadoFluxo.quadro) return
    estadoFluxo.docCompras = quadro
    telaFluxo(quadro)
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

// Etapa de um CT-e recebido. Cancelado fica fora. Tomador fora do grupo (frete de terceiro) ou "Não gerar
// fatura" = Sem cobrança. Fatura (do GCS ou a que veio do Omie) paga por inteiro = Pago.
function etapaCteFluxo(d) {
    if (String(d.situacao || '').toUpperCase() !== 'AUTORIZADO') return null
    const fatura = String(d.fatura || '').toUpperCase()
    if (d.paga_frete !== 'GRUPO' || fatura === 'NAO' || !fatura) return 'sem_cobranca'
    if (fatura === 'PENDENTE') return 'emitido'
    const omie = fatura === 'OMIE'
    const valor = Number(omie ? d.fatura_outra_valor : d.fatura_valor) || 0
    const pago = Number(omie ? d.fatura_outra_pago : d.fatura_pago) || 0
    return valor > 0 && pago + 0.005 >= valor ? 'pago' : 'a_pagar'
}

// NF-e do Fluxo de Compras ← CT-e que a transportou (pela chave), para o cartão mostrar o frete.
function freteDasNotasFluxo(ctes) {
    const mapa = new Map()
    for (const t of ctes || [])
        if (String(t.situacao || '').toUpperCase() === 'AUTORIZADO')
            for (const chave of Array.isArray(t.nfe_chaves) ? t.nfe_chaves : []) {
                if (!mapa.has(chave)) mapa.set(chave, [])
                mapa.get(chave).push({ id: t.id, numero: t.numero, transportadora: t.emitente_nome, valor: Number(t.valor_receber || t.valor_total) || 0 })
            }
    return mapa
}

// Linhas cruas → cartões no formato comum: { id, etapa, data (do período), desde (na etapa), ... }.
function cartoesFluxo(quadro, linhas) {
    if (quadro === 'compras_cte')
        return linhas.map(d => ({
            ...d, empresa: d.tomador_app || d.app, etapa: etapaCteFluxo(d), data: d.dia, participante_nome: d.emitente_nome,
            valor_total: Number(d.valor_receber || d.valor_total) || 0,
            desde: (['a_pagar', 'pago'].includes(etapaCteFluxo(d)) && d.fatura_em ? String(d.fatura_em).slice(0, 10) : d.dia)
        })).filter(c => c.etapa)
    if (quadro === 'compras')
        return linhas.filter(d => !d.excluido).map(d => ({ ...d, empresa: d.app, etapa: etapaCompraFluxo(d), data: d.dia, desde: d.dia })).filter(c => c.etapa)
    if (QUADROS_FLUXO[quadro]?.servico) return cartoesServicoFluxo(linhas)
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
// soRecorrentes (Fluxo de Serviços): só os cartões previstos e os gerados por nota recorrente.
function colunasFluxo(quadro, cartoes, { periodo = 30, busca = '', empresa = '', soRecorrentes = false, hoje = dataServidor() } = {}) {
    const config = QUADROS_FLUXO[quadro]
    const termo = normalFluxo(busca).trim()
    const daEmpresa = c => !empresa || (empresa === '-' ? !c.empresa : c.empresa === empresa)
    const daRecorrencia = c => !soRecorrentes || c.recorrente || String(c.origem || '').toUpperCase() === 'RECORRENCIA'
    const combina = c => daEmpresa(c) && daRecorrencia(c) &&(!termo || normalFluxo([c.contrato, c.departamento, c.cliente, c.cidade, c.numero_pedido, c.participante_nome, c.numero,
        c.notas_numeros, c.tomador_nome, c.trajeto,
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
function telaFluxoServicos() { return telaFluxo('itens_servicos') }
function telaFluxoCompras() { return telaFluxo(estadoFluxo.docCompras === 'compras_cte' ? 'compras_cte' : 'compras') }
function telaFluxoItensVendas() { return telaFluxo('itens_vendas') }

async function telaFluxo(quadro) {
    estadoFluxo.quadro = quadro
    estadoFluxo.abertos.clear()
    // Fluxo de Vendas e de Serviços: menu lateral recolhido ao abrir (o quadro precisa da largura).
    if (QUADROS_FLUXO[quadro].novo && typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()
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
                        : `${quadro === 'compras_cte' ? 'Período pela emissão do CT-e' : quadro === 'compras' ? 'Período pela emissão da nota' : 'Período pela data do pedido'} · os cartões andam sozinhos conforme os dados; clique para abrir`}</small>
                </div>
                ${novo || quadro === 'servicos' ? `
                <div class="fluxo-legenda" aria-label="Legenda da cor dos cartões">
                    <span><i class="fluxo-bolinha emitida"></i> Nota emitida</span>
                    <span><i class="fluxo-bolinha cancelada"></i> Cancelada / recusada</span>
                    <span><i class="fluxo-bolinha sem-nota"></i> Não emitida</span>
                </div>` : ''}
                <div class="fluxo-controles">
                    ${ehComprasFluxo(quadro) ? chaveDocComprasFluxoHtml(quadro) : ''}
                    ${chaveEmpresaFluxoHtml()}
                    ${QUADROS_FLUXO[quadro].servico && pode('servicos.recorrencias') ? `
                    <button type="button" class="fluxo-so-recorrentes ${estadoFluxo.soRecorrentes ? 'ativo' : ''}" aria-pressed="${!!estadoFluxo.soRecorrentes}"
                        title="Mostrar só as notas recorrentes (previstas do mês e as já geradas)" onclick="alternarSoRecorrentesFluxo(this)">Só recorrentes</button>` : ''}
                    <label class="fluxo-campo fluxo-busca">
                        ${lupa}
                        <input type="search" placeholder="${quadro === 'compras_cte' ? 'Transportadora, nº do CT-e ou da NF-e' : quadro === 'compras' ? 'Fornecedor ou número da nota' : 'Cliente, ORC, pedido, NF ou cidade'}"
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
        const base = quadro === 'compras_cte' ? 'vw_fiscal_ctes' : quadro === 'compras' ? 'vw_fiscal_documentos' : novo ? 'vw_fluxo_itens' : 'vw_fluxo_comercial'
        const filtros = quadro === 'compras_cte' ? {} : quadro === 'compras' ? { direcao: { op: '=', value: 'entrada' } }
            : novo ? { [QUADROS_FLUXO[quadro].servico ? 'quadro_servicos' : 'quadro_vendas']: { op: '=', value: 'S' }, relevante: { op: '=', value: 'S' } }
                : { quadro: { op: '=', value: quadro } }
        // Página grande: cada página recalcula a view inteira no servidor (COUNT(*) OVER()); com 500 por página
        // o Fluxo de Vendas fazia 7 consultas seguidas de ~2 s. Se ainda vier mais de uma, as demais vão juntas.
        const LIMITE = 5000
        // Notas recorrentes previstas do mês (só fin/adm/diretoria): vêm junto; falha nelas não derruba o quadro.
        const recorrentes = QUADROS_FLUXO[quadro].servico && pode('servicos.recorrencias')
        // NF-e de compra: os CT-e vêm junto para o cartão mostrar o frete (sem acesso aos CT-e, só não mostra).
        const [primeira, recorrencias, ctes] = await Promise.all([
            pesquisarDB({ base, filtros, pagina: 1, limite: LIMITE }),
            recorrentes ? apiModuloFiscal('fluxo-itens/recorrencias', {}).catch(err => (console.error('[FLUXO recorrências]', err), null)) : null,
            quadro === 'compras' ? pesquisarDB({ base: 'vw_fiscal_ctes', filtros: {}, pagina: 1, limite: LIMITE }).catch(() => null) : null
        ])
        estadoFluxo.fretes = freteDasNotasFluxo(ctes?.resultados)
        const linhas = [...(primeira?.resultados || [])]
        const paginas = Number(primeira?.paginas) || 1
        if (paginas > 1) {
            const resto = await Promise.all(Array.from({ length: paginas - 1 },
                (_, i) => pesquisarDB({ base, filtros, pagina: i + 2, limite: LIMITE })))
            resto.forEach(r => linhas.push(...(r?.resultados || [])))
        }
        if (consulta !== estadoFluxo.carregando || quadro !== estadoFluxo.quadro) return true
        estadoFluxo.recorrencias = recorrencias
        estadoFluxo.linhas = [...cartoesFluxo(quadro, linhas), ...cartoesRecorrentesFluxo(recorrencias)]
        renderizarFluxo()
        return true
    } catch (erro) {
        console.error('[FLUXO]', erro)
        const area = document.querySelector('.fluxo-quadro')
        if (area) area.innerHTML = `
            <div class="fluxo-erro" role="alert">
                <strong>Não foi possível carregar o quadro</strong>
                <span>O servidor não respondeu agora. Tente de novo em alguns segundos.</span>
                <button type="button" class="fluxo-atualizar" onclick="atualizarFluxoBotao(this)">Tentar de novo</button>
            </div>`
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
    const colunas = colunasFluxo(quadro, estadoFluxo.linhas, { periodo: estadoFluxo.periodo, busca: estadoFluxo.busca, empresa: estadoFluxo.empresa, soRecorrentes: soRecorrentesAtivoFluxo() })
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
                ${novo && col.etapa === colunaEmissaoFluxo(quadro) ? `
                    <button type="button" class="fluxo-faturar-todas" onclick="faturarTodasFluxo()"
                        ${col.cartoes.some(c => !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status)) ? '' : 'disabled'}
                        title="Emite, uma por vez, as notas de todos os cartões de ${col.titulo} da empresa escolhida">Faturar todas</button>` : ''}
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
    switch (quadro === 'compras_cte' ? `cte-${c.etapa}` : quadro === 'compras' ? `c-${c.etapa}` : c.etapa) {
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
        case 'cte-emitido': return 'Gerar fatura a pagar? Clique para responder'
        case 'cte-a_pagar': {
            const omie = String(c.fatura || '').toUpperCase() === 'OMIE'
            const valor = Number(omie ? c.fatura_outra_valor : c.fatura_valor) || 0
            const pago = Number(omie ? c.fatura_outra_pago : c.fatura_pago) || 0
            return juntar(omie ? `Fatura do Omie ${c.fatura_outra || ''}`.trim() : 'Fatura lançada', pago ? `pago ${reaisFluxo(pago)} de ${reaisFluxo(valor)}` : 'em aberto')
        }
        case 'cte-pago': return String(c.fatura || '').toUpperCase() === 'OMIE' ? 'Fatura do Omie paga' : 'Fatura paga'
        case 'cte-sem_cobranca': return c.paga_frete !== 'GRUPO'
            ? `Frete por conta de ${c.tomador_nome || 'terceiro'}`
            : 'Respondido: não gera fatura'
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
    if (QUADROS_FLUXO[estadoFluxo.quadro]?.servico) return destinosServicoFluxo(c)
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
    if (QUADROS_FLUXO[estadoFluxo.quadro]?.servico) return soltarServicoFluxo(c, etapa)
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
        { periodo: estadoFluxo.periodo, busca: estadoFluxo.busca, empresa, soRecorrentes: soRecorrentesAtivoFluxo() }).find(col => col.etapa === colunaEmissaoFluxo(estadoFluxo.quadro))
    const prontos = (separado?.cartoes || []).filter(c => !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status))
    if (!prontos.length) return popup({ mensagem: `Nenhum cartão em ${separado?.titulo || 'Separado'} para faturar.` })
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
    const opcoes = c.recorrente ? opcoesRecorrenteFluxo(c) : [
        ...opcoesRecorrenciaItemFluxo(c),
        // Opções do orçamento (18/11/2026, a pedido): os atalhos completos (Histórico, Painel de Custos, PDF, OS...).
        c.orcamento_id ? ['Opções do Orçamento', `abrirAtalhos('${escaparAtributo(c.orcamento_id)}')`] : null,
        nota && c.etapa === 'separado' ? ['Editar NF-e', `editarNotaItemFluxo('${id}')`] : null,
        // Fluxo de Serviços: NFS-e em preparação e o recebimento das parcelas (19/11/2026, a pedido).
        c.etapa === 'preparacao' ? ['Editar NFS-e', `abrirNfseFluxo(itemFluxo('${id}')).catch(err => { removerOverlay(); popup({ mensagem: mensagemErroEst(err) }) })`] : null,
        podeReceberFluxo(c) ? ['Registrar recebimento', `abrirRecebimentoFluxo('${id}')`] : null,
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
    // Nota recorrente: valor por período, não abate saldo de OC (o "faturado acima do pedido" não vale aqui).
    if (ehItemRecorrenteFluxo(c)) return ''
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

// Liberação sem pedido do cartão (vw_fluxo_itens.liberacao; js/status.js formularioLiberacao).
const LIBERACAO_CARTAO_FLUXO = { POC: 'POC · demonstração', GARANTIA: 'Garantia', INTERNO: 'Uso interno' }

// Cartão do quadro novo (vw_fluxo_itens): item que anda até Concluído; marca verde/vermelha da emissão.
function cartaoItemFluxo(c, parado, tempo) {
    // Rodada com venda e serviço (18/11/2026): no Fluxo de Vendas só a NF-e; a NFS-e fica no Fluxo de Serviços.
    // No Fluxo de Serviços, ao contrário: só a NFS-e.
    const servico = QUADROS_FLUXO[estadoFluxo.quadro]?.servico
    const misto = String(c.tipo || '').toUpperCase().includes('VENDA')
    const soVenda = !servico && c.rodada != null && misto
    const nfs = (Array.isArray(c.notas) ? c.notas : [])
        .filter(n => n.n_nota && n.cancelado !== 'S' && n.categoria !== 'remessa' && !(soVenda && n.categoria === 'serviço')
            && !(servico && misto && String(n.categoria || '').toLowerCase() === 'venda'))
        .map(n => String(n.n_nota).replace(/^0+/, ''))
    const contexto = [
        // Rodada: a natureza vem da nota ligada (NFS-e = SERVIÇO desde o rascunho; vw_fluxo_itens).
        !servico && c.tipo && c.tipo !== 'VENDA' ? c.tipo : '',
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
    // Nota recusada/denegada pela SEFAZ também é vermelha, mesmo emitida fora do arraste (tela do Fiscal) — 19/11/2026.
    const recusada = c.emissao_status === 'ERRO' || ['REJEITADA', 'DENEGADA'].includes(c.nota_status)
    const estado = recusada ? 'erro' : cancelada ? 'cancelada' : faturada ? 'faturada' : ''
    const dica = recusada ? `title="${escaparAtributo(c.emissao_mensagem ? `Emissão recusada: ${c.emissao_mensagem}` : 'Nota recusada pela SEFAZ: abra o cartão para ver o motivo')}"` : ''
    const emissao = ['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status) ? '<small class="fluxo-emissao andando">Emitindo…</small>' : ''
    const id = escaparAtributo(c.id)
    // Anda só arrastando (sem botão no cartão, a pedido): próxima coluna, qualquer anterior ou Concluído.
    const podeAvancar = destinosItemFluxo(c.etapa, c).length > 0 && !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status)
    const arrastavel = podeAvancar ? `draggable="true" ondragstart="iniciarArrasteFluxo(event, '${id}')" ondragend="terminarArrasteFluxo()"` : ''
    // Clique: painel do item (nota, histórico da SEFAZ, histórico do cartão e o orçamento). No Recebido do
    // Fluxo de Serviços: as parcelas, para dar o recebimento.
    const acao = servico && c.etapa === 'recebido' ? `abrirRecebimentoFluxo('${id}')` : `abrirItemFluxo('${id}')`
    const abrir = `onclick="${acao}" onkeydown="if (event.key === 'Enter') ${acao}"`
    return `
        <article class="fluxo-cartao fluxo-item ${estado} ${parado ? 'parado' : ''} ${c.orcamento_id ? 'clicavel' : ''}" data-id="${id}" ${c.espelho ? 'data-espelho="1"' : ''} tabindex="0" ${dica} ${arrastavel} ${abrir}>
            <span class="fluxo-cartao-linha"><span>${escaparAtributo(c.contrato || c.departamento || 'Sem orçamento')}${pedidoCartaoFluxo(c.numero_pedido)}</span>
                <span class="fluxo-cartao-cantos">${tempo}<button type="button" class="fluxo-menu-btn" title="Mais opções" aria-label="Mais opções"
                    onclick="abrirMenuItemFluxo(event, '${id}')">⋮</button></span></span>
            <b class="fluxo-cartao-nome">${escaparAtributo(c.cliente || 'Cliente não informado')}</b>
            ${cancelada ? `<span class="fluxo-cartao-balao">${etiquetaEst('Cancelada', '#b91c1c')}</span>` : ''}
            ${recusada ? `<span class="fluxo-cartao-balao">${etiquetaEst(c.nota_status === 'DENEGADA' ? 'Denegada' : 'Recusada', '#b91c1c')}</span>` : ''}
            ${rodadaCartaoFluxo(c)}
            ${ehItemRecorrenteFluxo(c) ? `<span class="fluxo-cartao-balao" title="NFS-e gerada pela nota recorrente">${etiquetaEst(`Recorrente${mesItemRecorrenteFluxo(c) ? ` · ${mesItemRecorrenteFluxo(c)}` : ''}`, '#0f766e')}</span>` : ''}
            ${c.pedido_prometido ? `<span class="fluxo-cartao-balao" title="Sem o pedido do cliente (ou com valor simbólico): a nota não sai até o pedido ser completado">${etiquetaEst('Pedido pendente', '#b45309')}</span>` : ''}
            ${c.liberacao ? `<span class="fluxo-cartao-balao" title="Orçamento liberado sem pedido: sai como remessa, não conta como faturamento">${etiquetaEst(LIBERACAO_CARTAO_FLUXO[c.liberacao] || 'Sem pedido', '#0e7490')}</span>` : ''}
            ${c.cidade ? `<small>${escaparAtributo(c.cidade)}</small>` : ''}
            ${contexto ? `<small class="fluxo-cartao-contexto">${escaparAtributo(contexto)}</small>` : ''}
            <span class="fluxo-cartao-valor" ${c.valor_misto != null && !c.sem_nfse ? `title="${escaparAtributo(`Só a NFS-e · cartão com venda e serviço: ${reaisFluxo(c.valor_misto)}`)}"` : ''}>${reaisFluxo(c.valor)} <small>${c.empresa ? `${escaparAtributo(c.empresa)} · ` : ''}desde ${dataBrFluxo(c.data)}</small></span>
            ${c.sem_nfse ? '<small class="fluxo-cartao-motivo" title="Cartão com venda e serviço sem NFS-e ligada: o valor é o da venda/pedido">Sem NFS-e ligada · valor com a venda</small>' : ''}
            ${saldoCartaoFluxo(c)}
            ${servico ? servicoCartaoFluxo(c) : ''}
            ${emissao}
        </article>`
}

function cartaoFluxo(quadro, c, parado) {
    if (c.recorrente) return cartaoRecorrenteFluxo(c)
    const dias = diasDesdeFluxo(c.desde)
    const final = QUADROS_FLUXO[quadro].finais.includes(c.etapa)
    const tempo = !final && dias != null ? `<span class="fluxo-dias ${dias > 30 ? 'velho' : dias > 7 ? 'morno' : ''}" title="Dias nesta etapa">${dias} d</span>` : ''
    if (QUADROS_FLUXO[quadro].novo) return cartaoItemFluxo(c, parado, tempo)
    if (quadro === 'compras_cte')
        return `
            <button type="button" class="fluxo-cartao fluxo-cartao-cte ${parado ? 'parado' : ''}" data-id="${escaparAtributo(c.id)}" onclick="abrirCteFis(this.dataset.id)">
                <span class="fluxo-cartao-linha"><span>CT-e Nº ${escaparAtributo(c.numero || '—')}${c.empresa ? ` · ${escaparAtributo(c.empresa)}` : ''}</span>${tempo}</span>
                <b class="fluxo-cartao-nome">${escaparAtributo(c.emitente_nome || 'Transportadora')}</b>
                <small>Emitido em ${dataBrFluxo(c.dia)}${c.trajeto ? ` · ${escaparAtributo(c.trajeto)}` : ''}</small>
                ${c.notas_numeros ? `<small>NF-e ${escaparAtributo(c.notas_numeros)}</small>` : Number(c.qtd_nfes) ? `<small>${Number(c.qtd_nfes)} NF-e fora do GCS</small>` : ''}
                <small class="fluxo-cartao-contexto">${escaparAtributo(contextoCartaoFluxo(quadro, c))}</small>
                <span class="fluxo-cartao-valor">${reaisFluxo(c.valor_total)}</span>
            </button>`
    if (quadro === 'compras') {
        const fretes = estadoFluxo.fretes?.get(c.chave) || []
        return `
            <button type="button" class="fluxo-cartao ${parado ? 'parado' : ''}" data-id="${escaparAtributo(c.id)}" onclick="abrirDocumentoFiscal(this.dataset.id)">
                <span class="fluxo-cartao-linha"><span>NF Nº ${escaparAtributo(c.numero || '—')}${c.app ? ` · ${escaparAtributo(c.app)}` : ''}</span>${tempo}</span>
                <b class="fluxo-cartao-nome">${escaparAtributo(c.participante_nome || 'Fornecedor')}</b>
                <small>Emitida em ${dataBrFluxo(c.dia)}</small>
                <small class="fluxo-cartao-contexto">${escaparAtributo(contextoCartaoFluxo(quadro, c))}</small>
                ${fretes.length ? `<small class="fluxo-cartao-frete" title="CT-e que transportou esta nota">Frete: ${fretes.map(f => `CT-e ${escaparAtributo(f.numero || '')} · ${escaparAtributo(f.transportadora || '')} · ${reaisFluxo(f.valor)}`).join(' / ')}</small>` : ''}
                <span class="fluxo-cartao-valor">${reaisFluxo(c.valor_total)}</span>
            </button>`
    }
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

// ---------------- Fluxo de Serviços novo (19/11/2026) ----------------
// Pedidos → Concluído → Em preparação → Faturado → Recebido (etapa_servico da vw_fluxo_itens). Ver QUADROS_FLUXO.
const hojeIsoFluxo = () => {
    const d = dataServidor()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Coluna do "Faturar todas": Separado (Vendas) / Em preparação (Serviços).
const colunaEmissaoFluxo = quadro => QUADROS_FLUXO[quadro]?.servico ? 'preparacao' : 'separado'

// Cartões do quadro: a etapa do serviço. Nota faturada sem nenhuma parcela recebida fica SÓ em Faturado; com
// parte recebida e parte pendente aparece também em Recebido (espelho, sempre visível enquanto houver o que
// receber); tudo recebido, só em Recebido (19/11/2026, a pedido). O recebimento é pelo ⋮ do cartão.
const parcelasRecebidasFluxo = c => Math.max((Number(c.parcelas_total) || 0) - (Number(c.parcelas_abertas) || 0), 0)
function cartoesServicoFluxo(linhas) {
    const hoje = hojeIsoFluxo()
    const cartoes = []
    for (const l of linhas) {
        const c = { ...l, etapa_item: l.etapa, etapa: l.etapa_servico || 'pedido', desde: l.data }
        // Venda + serviço com nota (Faturado/Recebido): aqui vale só a NFS-e (vw_fluxo_itens.valor_servico,
        // 24/11/2026, a pedido). Sem NFS-e ligada, fica o valor do cartão com o aviso.
        if (l.valor_servico != null) {
            c.valor_misto = Number(l.valor) || 0
            if (Number(l.valor_servico) > 0) c.valor = Number(l.valor_servico)
            else c.sem_nfse = true
        }
        if (c.etapa === 'recebido' && c.recebido_em) c.data = String(c.recebido_em).slice(0, 10)
        cartoes.push(c)
        if (c.etapa === 'faturado' && Number(c.parcelas_abertas) > 0 && parcelasRecebidasFluxo(c) > 0)
            cartoes.push({ ...c, etapa: 'recebido', espelho: true, data: hoje, desde: c.proximo_vencimento || c.data })
    }
    return cartoes
}

// ⋮ do cartão de serviço: "Registrar recebimento" na nota faturada que ainda tem o que receber.
const podeReceberFluxo = c => QUADROS_FLUXO[estadoFluxo.quadro]?.servico && ['faturado', 'recebido'].includes(c?.etapa)
    && c.nota_autorizada && c.etapa_item !== 'concluido' && (Number(c.parcelas_abertas) > 0 || !Number(c.parcelas_total))

// Para onde o cartão pode ir no Fluxo de Serviços.
//   Pedidos → Em preparação (NFS-e; quem precisa faturar antes pula o A faturar). Ninguém arrasta para
//     A faturar: o cartão vai sozinho (chamado solucionado + saldo do pedido; 24/11/2026, sem marcação à mão);
//   A faturar → Em preparação;
//   Em preparação → Faturado (emite) ou → Pedidos (devolve o saldo ao pedido; o rascunho fica guardado);
//   Faturado → Recebido não é arraste: vai sozinho ao registrar recebimento (⋮ → Registrar recebimento).
function destinosServicoFluxo(c) {
    if (c?.recorrente) return ['preparacao']  // nota recorrente prevista: soltar em Em preparação gera a NFS-e
    if (!c || c.espelho) return []
    const rodada = c.rodada != null
    switch (c.etapa) {
        case 'pedido':
        case 'concluido': return rodada ? ['preparacao'] : []
        case 'preparacao': return ['faturado', ...(rodada ? ['pedido'] : [])]
        default: return []
    }
}

async function soltarServicoFluxo(c, etapa) {
    if (c.recorrente) return etapa === 'preparacao' ? gerarRecorrenciaFluxo(c.recorrencia_id) : undefined
    const nome = nomeItemFluxo(c)
    // Formulário (NFS-e / parcelas): o cartão fica na coluna nova enquanto a janela está aberta; fechou sem
    // salvar, o quadro recarrega e ele volta.
    if (etapa === 'preparacao') return janelaServicoFluxo(c, etapa, () => abrirNfseFluxo(c))
    if (etapa === 'faturado') {
        if (!await confirmarPopup({ titulo: 'Faturar', mensagem: `Emitir agora a NFS-e de ${nome}?`, textoConfirmar: 'Emitir' })) return
        return otimistaServicoFluxo(c, etapa, () => apiModuloFiscal('fluxo-itens/faturar', { id: c.id }), { emissao_status: 'EMITINDO' })
    }
    if (etapa === 'pedido' && c.etapa === 'preparacao') {
        const ok = await confirmarPopup({
            titulo: 'Voltar para Pedidos',
            mensagem: `Voltar ${nome} para Pedidos?<br><small>O valor volta para o saldo do pedido; a NFS-e em rascunho fica guardada para a próxima vez.</small>`,
            textoConfirmar: 'Voltar'
        })
        if (!ok) return
        return otimistaServicoFluxo(c, etapa, () => apiModuloFiscal('fluxo-itens/mover', { id: c.id, para: 'PEDIDO' }))
    }
}

// Arraste instantâneo no Fluxo de Serviços: o cartão muda de coluna na hora e o servidor confirma por trás.
// Recusou: volta para onde estava, pisca em vermelho e mostra o motivo (pendência de pedido/saldo como em Vendas).
async function otimistaServicoFluxo(c, etapa, acao, extra = {}) {
    const antes = estadoFluxo.linhas.filter(x => x.id === c.id && !x.espelho).map(x => [x, { etapa: x.etapa, emissao_status: x.emissao_status }])
    antes.forEach(([x]) => Object.assign(x, { etapa }, extra))
    renderizarFluxo()
    try {
        await acao()
        carregarFluxo()
    } catch (err) {
        removerOverlay()
        antes.forEach(([x, v]) => Object.assign(x, v))
        renderizarFluxo()
        const cartao = document.querySelector(`.fluxo-pagina .fluxo-cartao[data-id="${CSS.escape(c.id)}"]:not([data-espelho])`)
        cartao?.classList.add('recusado')
        cartao?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        setTimeout(() => cartao?.classList.remove('recusado'), 2500)
        if (await tratarPendenciaFluxo(err, c)) return otimistaServicoFluxo(c, etapa, acao, extra)
    }
}

// Arraste que abre uma janela: move na hora, abre e, quando a janela fechar (salva ou não), recarrega o quadro
// (salvou: o cartão fica onde o servidor pôs; desistiu ou deu erro: volta).
async function janelaServicoFluxo(c, etapa, abrir) {
    const antes = estadoFluxo.linhas.filter(x => x.id === c.id && !x.espelho).map(x => [x, x.etapa])
    antes.forEach(([x]) => { x.etapa = etapa })
    renderizarFluxo()
    const abertas = new Set([...document.querySelectorAll('.popup')].map(p => p.id))
    try {
        await abrir()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
    const novas = [...document.querySelectorAll('.popup')].filter(p => p.id && !abertas.has(p.id)).map(p => p.id)
    if (!novas.length) return carregarFluxo()
    const observador = new MutationObserver(() => {
        if (novas.some(id => document.getElementById(id))) return
        observador.disconnect()
        carregarFluxo()
    })
    observador.observe(document.body, { childList: true, subtree: true })
}

// Linha do cartão no Fluxo de Serviços: em A faturar, o porquê; em Pedidos, por que ainda NÃO está em A faturar
// (afaturar_motivo da vw_fluxo_itens; "Pedido pendente" já tem o balão próprio); parcelas a receber / recebido.
function servicoCartaoFluxo(c) {
    if (c.etapa === 'concluido')
        return '<small class="fluxo-cartao-contexto">Serviço solucionado · pronto para emitir a nota</small>'
    if (c.etapa === 'pedido' && c.afaturar_motivo && !c.pedido_prometido)
        return `<small class="fluxo-cartao-motivo" title="O cartão vai sozinho para A faturar quando o chamado estiver solucionado e o pedido tiver saldo">${escaparAtributo(c.afaturar_motivo)}</small>`
    if (!['faturado', 'recebido'].includes(c.etapa)) return ''
    const total = Number(c.parcelas_total) || 0, abertas = Number(c.parcelas_abertas) || 0
    if (!total) return c.etapa === 'faturado' && c.nota_autorizada ? '<small class="fluxo-receber">Sem parcelas no financeiro</small>' : ''
    if (abertas) {
        const atrasada = c.proximo_vencimento && String(c.proximo_vencimento).slice(0, 10) < hojeIsoFluxo()
        return `<small class="fluxo-receber ${atrasada ? 'atrasado' : ''}" ${c.espelho ? 'title="Clique para dar o recebimento"' : ''}>${atrasada ? 'Atrasado: ' : 'A receber: '}${reaisFluxo(c.valor_a_receber)}`
            + ` · ${abertas} de ${total} parcela(s)${c.proximo_vencimento ? ` · vence ${dataBrFluxo(c.proximo_vencimento)}` : ''}</small>`
    }
    return `<small class="fluxo-receber">Recebido${c.recebido_em ? ` em ${dataBrFluxo(c.recebido_em)}` : ''}</small>`
}

// Recebido: parcelas das NFS-e do cartão (gcs /fluxo-itens/parcelas). Marca as recebidas, informa a data e
// "Receber" dá a baixa nas faturas a receber do Financeiro (/fluxo-itens/receber). Sem parcela no financeiro:
// só marca o cartão como recebido (Concluído).
async function abrirRecebimentoFluxo(id) {
    const c = itemFluxo(id)
    if (!c) return
    try {
        overlayAguarde()
        const r = await apiModuloFiscal('fluxo-itens/parcelas', { id })
        removerOverlay()
        const parcelas = r.parcelas || []
        if (!parcelas.length) {
            if (c.etapa_item === 'concluido') return popup({ mensagem: `${nomeItemFluxo(c)} já está recebido.` })
            const ok = await confirmarPopup({
                titulo: 'Recebido',
                mensagem: `${nomeItemFluxo(c)} não tem parcelas no financeiro.<br>Marcar como recebido?`,
                textoConfirmar: 'Marcar como recebido'
            })
            if (!ok) return
            try {
                await apiModuloFiscal('fluxo-itens/mover', { id, para: 'CONCLUIDO' })
            } catch (err) {
                if (!await tratarPendenciaFluxo(err, c)) return
                await apiModuloFiscal('fluxo-itens/mover', { id, para: 'CONCLUIDO' })
            }
            return carregarFluxo()
        }
        const hoje = r.hoje || hojeIsoFluxo()
        const abertas = parcelas.filter(p => p.aberta)
        const total = parcelas.reduce((s, p) => s + Number(p.valor || 0), 0)
        const aReceber = abertas.reduce((s, p) => s + Number(p.saldo || 0), 0)
        const linhas = parcelas.map(p => {
            const venc = String(p.vencimento || '').slice(0, 10)
            const atrasada = p.aberta && venc && venc < hoje
            const selo = !p.aberta ? `Recebida${p.recebido_em ? ` em ${dataBrFluxo(p.recebido_em)}` : ''}` : atrasada ? 'Atrasada' : 'A receber'
            return `
                <label class="fluxo-receb-parcela ${p.aberta ? '' : 'recebida'} ${atrasada ? 'atrasada' : ''}">
                    <input type="checkbox" data-parcela data-saldo="${Number(p.saldo || 0)}" data-titulo="${escaparAtributo(p.titulo_id || '')}"
                        data-recebimento="${escaparAtributo(p.recebimento_id || '')}" ${p.aberta ? 'checked' : 'disabled checked'}
                        onchange="atualizarRecebimentoFluxo(this)">
                    <span class="fluxo-receb-num">${escaparAtributo(String(p.parcela || '').replace(/^0+(\d)/, '$1').replace(/\/0+(\d)/, '/$1'))}</span>
                    <span class="fluxo-receb-info">
                        <b>${reaisFluxo(p.aberta ? p.saldo : p.valor)}</b>
                        <small>NF ${escaparAtributo(p.nota || '')}${p.origem === 'OMIE' ? ' (Omie)' : ''} · vence ${dataBrFluxo(venc)}</small>
                    </span>
                    <span class="fluxo-receb-selo">${selo}</span>
                </label>`
        }).join('')
        // Conta corrente: só pergunta quando a empresa tem mais de uma (senão vai a padrão).
        const porApp = {}
        for (const k of r.contas || []) (porApp[k.app] ||= []).push(k)
        const apps = [...new Set(abertas.map(p => p.app).filter(Boolean))]
        const seletores = apps.filter(a => (porApp[a] || []).length > 1).map(a => `
            <label class="fluxo-receb-campo"><span>Conta ${escaparAtributo(a)}</span>
                <select data-app="${escaparAtributo(a)}">${porApp[a].map(k => `<option value="${k.id}" ${k.padrao ? 'selected' : ''}>${escaparAtributo(k.nome)}</option>`).join('')}</select>
            </label>`).join('')
        const elemento = `
            <div class="fluxo-receb">
                <div class="fluxo-receb-topo">
                    <small>${escaparAtributo(c.contrato || c.departamento || '')}${c.numero_pedido ? ` · Pedido ${escaparAtributo(c.numero_pedido)}` : ''}</small>
                    <b>${escaparAtributo(c.cliente || 'Cliente não informado')}</b>
                </div>
                <div class="fluxo-receb-resumo">
                    <div><span>Total das parcelas</span><b>${reaisFluxo(total)}</b></div>
                    <div class="aberto"><span>A receber</span><b>${reaisFluxo(aReceber)}</b></div>
                    <div class="ok"><span>Recebidas</span><b>${parcelas.length - abertas.length} de ${parcelas.length}</b></div>
                </div>
                <div class="fluxo-receb-lista">${linhas}</div>
                ${abertas.length ? `
                    <div class="fluxo-receb-rodape">
                        <label class="fluxo-receb-campo"><span>Recebido em</span>
                            <input type="date" name="data-recebimento" value="${hoje}" max="${hoje}">
                        </label>
                        ${seletores}
                        <div class="fluxo-receb-marcado"><span>Marcado</span><b data-marcado>${reaisFluxo(aReceber)}</b></div>
                    </div>
                    <small class="fluxo-receb-nota">As parcelas marcadas são baixadas pelo saldo inteiro nesta data, em Financeiro → Faturas a receber.</small>`
                : '<p class="fluxo-receb-nota">Todas as parcelas já foram recebidas.</p>'}
            </div>`
        popup({
            titulo: 'Registrar recebimento',
            elemento,
            botoes: abertas.length ? [{ texto: 'Registrar recebimento', img: 'concluido', funcao: `receberParcelasFluxo(this, '${escaparAtributo(id)}')` }] : []
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Soma das parcelas marcadas no rodapé da janela.
function atualizarRecebimentoFluxo(caixa) {
    const janela = caixa.closest('.fluxo-receb')
    if (!janela) return
    const soma = [...janela.querySelectorAll('input[data-parcela]:checked:not(:disabled)')].reduce((s, i) => s + Number(i.dataset.saldo || 0), 0)
    const alvo = janela.querySelector('[data-marcado]')
    if (alvo) alvo.textContent = reaisFluxo(soma)
}

async function receberParcelasFluxo(botao, id) {
    const janela = botao.closest('.popup')
    if (!janela) return
    const marcadas = [...janela.querySelectorAll('input[data-parcela]:checked:not(:disabled)')]
        .map(i => ({ titulo_id: i.dataset.titulo || null, recebimento_id: i.dataset.recebimento || null }))
    if (!marcadas.length) return popup({ mensagem: 'Marque a(s) parcela(s) recebida(s).' })
    const data = janela.querySelector('[name="data-recebimento"]')?.value
    if (!data) return popup({ mensagem: 'Informe a data do recebimento.' })
    const contas = Object.fromEntries([...janela.querySelectorAll('select[data-app]')].map(s => [s.dataset.app, s.value]))
    try {
        overlayAguarde()
        const r = await apiModuloFiscal('fluxo-itens/receber', { id, parcelas: marcadas, data, contas })
        removerOverlay()
        removerPopup(janela.id)
        popup({
            mensagem: r.concluido
                ? 'Recebimento registrado. Todas as parcelas foram recebidas: o cartão ficou só em Recebido.'
                : `Recebimento registrado (${Number(r.recebidas) || 0} parcela(s)).`
        })
        carregarFluxo()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------- Notas recorrentes (22/11/2026, a pedido) ----------------
// gcs: SCRIPTS/fluxo_itens.js (rotas /fluxo-itens/recorrencia*) e migrations/fluxo-recorrencias.sql.
// Contrato mensal, preventiva e locação: no mês devido o Fluxo de Serviços mostra, em Pedidos, o cartão PREVISTO
// (tracejado) com os dados copiados da nota anterior. Só fin/adm/diretoria (acesso servicos.recorrencias).
//   Arrastar para Em preparação (ou ⋮ → Gerar NFS-e): rascunho da NFS-e + cartão real, que segue o fluxo de sempre.
//   ⋮ → Descartar este mês: some só neste mês. ⋮ → Desativar recorrência: para de vez (recorrência sem fim
//   conhecido o usuário encerra assim; "PARCELA 19/36" termina sozinha). Passou o mês: o previsto some.
// Cartão de serviço faturado: ⋮ → Repetir todo mês (a última NFS-e dele vira o modelo).
const MESES_CURTOS_FLUXO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS_FLUXO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesCurtoFluxo = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})/); return m ? `${MESES_CURTOS_FLUXO[Number(m[2]) - 1]}/${m[1]}` : '' }
const mesLongoFluxo = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})/); return m ? `${MESES_LONGOS_FLUXO[Number(m[2]) - 1]}/${m[1]}` : '' }
const ehItemRecorrenteFluxo = c => !c?.recorrente && String(c?.origem || '').toUpperCase() === 'RECORRENCIA'
// Cartão gerado: id IT_R_<recorrência>_<AAAAMM>.
const recorrenciaDoItemFluxo = c => { const m = String(c?.id || '').match(/^IT_R_(\d+)_(\d{4})(\d{2})$/); return m ? { id: Number(m[1]), mes: `${m[2]}-${m[3]}-01` } : null }
const mesItemRecorrenteFluxo = c => mesCurtoFluxo(recorrenciaDoItemFluxo(c)?.mes)
const ativaDoContratoFluxo = c => (estadoFluxo.recorrencias?.ativas || []).find(r => r.contrato === (c?.contrato || c?.departamento) && (!c?.empresa || r.app === c.empresa))

// Botão "Só recorrentes" do topo (vale só no Fluxo de Serviços, para quem tem o acesso; fica ligado ao voltar).
const soRecorrentesAtivoFluxo = () => !!estadoFluxo.soRecorrentes && !!QUADROS_FLUXO[estadoFluxo.quadro]?.servico && pode('servicos.recorrencias')
function alternarSoRecorrentesFluxo(botao) {
    estadoFluxo.soRecorrentes = !estadoFluxo.soRecorrentes
    botao.classList.toggle('ativo', estadoFluxo.soRecorrentes)
    botao.setAttribute('aria-pressed', String(estadoFluxo.soRecorrentes))
    renderizarFluxo()
}

function cartoesRecorrentesFluxo(recorrencias) {
    const hoje = hojeIsoFluxo()
    return (recorrencias?.previstas || []).map(p => ({
        id: `REC_${p.recorrencia_id}`, recorrente: true, recorrencia_id: Number(p.recorrencia_id),
        etapa: 'pedido', data: hoje, desde: hoje, mes: String(p.mes || '').slice(0, 10),
        contrato: p.contrato, orcamento_id: p.orcamento_id, empresa: p.empresa, cliente: p.cliente, cidade: p.cidade,
        valor: Number(p.valor) || 0, valor_pedido: 0,  // não soma no total de Pedidos: ainda não é nota
        parcela: p.parcela, parcelas_total: p.parcelas_total, base_texto: p.base_texto,
        dia: Number(p.dia) || null, data_emissao: dataEmissaoRecorrenteFluxo(p.mes, p.dia)
    }))
}

// Dia da emissão no mês (31 em fevereiro = último dia do mês). Sem dia: null.
function dataEmissaoRecorrenteFluxo(mes, dia) {
    const m = String(mes || '').match(/^(\d{4})-(\d{2})/)
    if (!m || !(Number(dia) >= 1)) return null
    const ultimo = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()
    return `${m[1]}-${m[2]}-${String(Math.min(Number(dia), ultimo)).padStart(2, '0')}`
}

// "Emitir dia 15 · faltam 3 dias" / "Emitir hoje" / "Atrasada desde dia 15".
function prazoRecorrenteFluxo(c) {
    if (!c.data_emissao) return { texto: 'Prevista: gere a NFS-e ou descarte este mês', classe: '' }
    const dia = Number(c.data_emissao.slice(8, 10))
    const faltam = -diasDesdeFluxo(c.data_emissao)
    if (faltam > 0) return { texto: `Emitir dia ${dia} · falta${faltam > 1 ? 'm' : ''} ${faltam} dia${faltam > 1 ? 's' : ''}`, classe: '' }
    if (faltam === 0) return { texto: 'Emitir hoje', classe: 'hoje' }
    return { texto: `Atrasada desde dia ${dia}`, classe: 'atrasado' }
}

function cartaoRecorrenteFluxo(c) {
    const id = escaparAtributo(c.id)
    const acao = `abrirRecorrenciaFluxo(${Number(c.recorrencia_id)})`
    const parcela = c.parcela ? `Parcela ${c.parcela}${c.parcelas_total ? `/${c.parcelas_total}` : ''} · ` : ''
    const prazo = prazoRecorrenteFluxo(c)
    return `
        <article class="fluxo-cartao fluxo-item fluxo-recorrente clicavel" data-id="${id}" tabindex="0"
            title="Nota recorrente prevista para ${escaparAtributo(mesLongoFluxo(c.mes))}: arraste para Em preparação para gerar a NFS-e"
            draggable="true" ondragstart="iniciarArrasteFluxo(event, '${id}')" ondragend="terminarArrasteFluxo()"
            onclick="${acao}" onkeydown="if (event.key === 'Enter') ${acao}">
            <span class="fluxo-cartao-linha"><span>${escaparAtributo(c.contrato || 'Sem orçamento')}</span>
                <span class="fluxo-cartao-cantos"><button type="button" class="fluxo-menu-btn" title="Mais opções" aria-label="Mais opções"
                    onclick="abrirMenuItemFluxo(event, '${id}')">⋮</button></span></span>
            <b class="fluxo-cartao-nome">${escaparAtributo(c.cliente || 'Cliente não informado')}</b>
            <span class="fluxo-cartao-balao">${etiquetaEst(`Recorrente · ${mesCurtoFluxo(c.mes)}`, '#0f766e')}</span>
            ${c.cidade ? `<small>${escaparAtributo(c.cidade)}</small>` : ''}
            <small class="fluxo-cartao-contexto">${parcela}<span class="fluxo-rec-prazo ${prazo.classe}">${escaparAtributo(prazo.texto)}</span></small>
            <span class="fluxo-cartao-valor">${reaisFluxo(c.valor)} <small>${c.empresa ? `${escaparAtributo(c.empresa)} · ` : ''}como a nota anterior</small></span>
        </article>`
}

function opcoesRecorrenteFluxo(c) {
    const r = Number(c.recorrencia_id)
    return [
        ['Gerar NFS-e', `gerarRecorrenciaFluxo(${r})`],
        ['Descartar este mês', `descartarRecorrenciaFluxo(${r})`],
        ['Detalhes da recorrência', `abrirRecorrenciaFluxo(${r})`],
        ['Desativar recorrência', `desativarRecorrenciaFluxo(${r})`],
        c.orcamento_id ? ['Opções do Orçamento', `abrirAtalhos('${escaparAtributo(c.orcamento_id)}')`] : null
    ].filter(Boolean)
}

// ⋮ dos cartões reais do Fluxo de Serviços: os da recorrência (detalhes, descartar o gerado, desativar) e o
// "Repetir todo mês" na nota de serviço faturada de um orçamento que ainda não repete.
function opcoesRecorrenciaItemFluxo(c) {
    if (!QUADROS_FLUXO[estadoFluxo.quadro]?.servico || !pode('servicos.recorrencias') || c.espelho) return []
    const id = escaparAtributo(c.id)
    const ativa = ativaDoContratoFluxo(c)
    const daRecorrencia = recorrenciaDoItemFluxo(c)
    if (ehItemRecorrenteFluxo(c) && daRecorrencia) return [
        ['Detalhes da recorrência', `abrirRecorrenciaFluxo(${daRecorrencia.id})`],
        c.etapa === 'preparacao' && !['EMITINDO', 'PROCESSANDO'].includes(c.emissao_status) ? ['Descartar NFS-e recorrente', `descartarItemRecorrenteFluxo('${id}')`] : null,
        ativa?.id === daRecorrencia.id ? ['Desativar recorrência', `desativarRecorrenciaFluxo(${daRecorrencia.id})`] : null
    ].filter(Boolean)
    if (ativa) return [['Detalhes da recorrência', `abrirRecorrenciaFluxo(${Number(ativa.id)})`]]
    if (['faturado', 'recebido'].includes(c.etapa) && c.nota_autorizada && (c.contrato || c.departamento))
        return [['Repetir todo mês (recorrente)', `criarRecorrenciaFluxo('${id}')`]]
    return []
}

// Gera a NFS-e do mês (rascunho) e o cartão em Em preparação; oferece conferir a nota na hora.
async function gerarRecorrenciaFluxo(recorrenciaId) {
    const c = estadoFluxo.linhas.find(x => x.recorrente && x.recorrencia_id === Number(recorrenciaId))
    if (c) { c.etapa = 'preparacao'; renderizarFluxo() }
    try {
        overlayAguarde()
        const r = await apiModuloFiscal('fluxo-itens/recorrencia-gerar', { id: recorrenciaId })
        removerOverlay()
        await carregarFluxo()
        const item = itemFluxo(r.item_id)
        const pendencias = [...(r.erros || []), ...(r.avisos || [])]
        const conferir = item
            ? [{ texto: 'Conferir NFS-e', img: 'editar', funcao: `removerPopup(this.closest('.popup')?.id); conferirNfseRecorrenteFluxo('${escaparAtributo(item.id)}')` }]
            : []
        popup({
            titulo: 'NFS-e recorrente gerada',
            mensagem: `${item ? nomeItemFluxo(item) : 'A nota'} está em <b>Em preparação</b>, com os dados da nota anterior.`
                + (pendencias.length
                    ? `<br><br>Antes de faturar, confira:<ul class="fis-lista-erros">${pendencias.map(p => `<li>${escEst(p)}</li>`).join('')}</ul>`
                    : '<br>Confira o valor e a descrição e fature.'),
            botoes: conferir
        })
    } catch (err) {
        removerOverlay()
        if (c) { c.etapa = 'pedido'; renderizarFluxo() }
        popup({ titulo: 'Não foi possível gerar', mensagem: mensagemErroEst(err) })
    }
}

async function conferirNfseRecorrenteFluxo(id) {
    const c = itemFluxo(id)
    if (!c) return
    try {
        await abrirNfseFluxo(c)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Fecha a janela de detalhes da recorrência (se aberta) depois de descartar/desativar.
function fecharDetalheRecorrenciaFluxo(recorrenciaId) {
    document.querySelectorAll('.popup [data-recorrencia]').forEach(el => {
        if (Number(el.dataset.recorrencia) === Number(recorrenciaId)) removerPopup(el.closest('.popup')?.id)
    })
}

async function descartarRecorrenciaFluxo(recorrenciaId) {
    const c = estadoFluxo.linhas.find(x => x.recorrente && x.recorrencia_id === Number(recorrenciaId))
    const ok = await confirmarPopup({
        titulo: 'Descartar este mês',
        mensagem: `Descartar a nota recorrente de ${escEst(mesLongoFluxo(c?.mes) || 'este mês')}${c ? ` de ${nomeItemFluxo(c)}` : ''}?`
            + '<br><small>Só este mês: no próximo ela volta. Para parar de vez, use "Desativar recorrência".</small>',
        textoConfirmar: 'Descartar'
    })
    if (!ok) return
    try {
        await apiModuloFiscal('fluxo-itens/recorrencia-descartar', { id: recorrenciaId })
        fecharDetalheRecorrenciaFluxo(recorrenciaId)
        carregarFluxo()
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function descartarItemRecorrenteFluxo(id) {
    const c = itemFluxo(id)
    if (!c) return
    const mes = mesItemRecorrenteFluxo(c)
    const ok = await confirmarPopup({
        titulo: 'Descartar NFS-e recorrente',
        mensagem: `Descartar a NFS-e recorrente de ${nomeItemFluxo(c)}${mes ? ` (${escEst(mes)})` : ''}?`
            + '<br><small>O rascunho é apagado e a nota não sai neste mês. A recorrência continua nos próximos.</small>',
        textoConfirmar: 'Descartar'
    })
    if (!ok) return
    try {
        await apiModuloFiscal('fluxo-itens/recorrencia-descartar', { item_id: id })
        carregarFluxo()
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function desativarRecorrenciaFluxo(recorrenciaId) {
    const motivo = await pedirTextoPopup({
        titulo: 'Desativar recorrência',
        mensagem: 'A nota para de aparecer nos próximos meses (o que já foi emitido fica como está).<br>Motivo (contrato encerrado, cliente cancelou...):',
        textoConfirmar: 'Desativar', minimo: 3, maximo: 300
    })
    if (!motivo) return
    try {
        await apiModuloFiscal('fluxo-itens/recorrencia-desativar', { id: recorrenciaId, motivo })
        fecharDetalheRecorrenciaFluxo(recorrenciaId)
        carregarFluxo()
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

const textoPeriodicidadeFluxo = p => Number(p) === 1 ? 'Todo mês' : `A cada ${Number(p)} meses`
const opcoesPeriodicidadeFluxo = atual => [1, 2, 3, 4, 6, 12]
    .map(p => `<option value="${p}" ${Number(atual) === p ? 'selected' : ''}>${textoPeriodicidadeFluxo(p)}</option>`).join('')

// Detalhes: o previsto do mês, a regra (valor, a cada quantos meses, até quando), a descrição e o histórico.
async function abrirRecorrenciaFluxo(recorrenciaId) {
    let d
    try {
        overlayAguarde()
        d = await apiModuloFiscal('fluxo-itens/recorrencia', { id: recorrenciaId })
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const r = d.recorrencia, p = d.previsto, esc = escEst
    const fim = r.parcelas_total ? `Até a parcela ${r.parcelas_total}`
        : r.meses ? `${r.meses} nota(s) desde ${mesLongoFluxo(String(r.inicio).slice(0, 10))}` : 'Até desativar'
    const situacao = !r.ativo ? etiquetaEst('Desativada', '#64748b')
        : p ? etiquetaEst(`Prevista para ${mesCurtoFluxo(String(p.mes).slice(0, 10))}`, '#0f766e')
            : etiquetaEst('Nada previsto neste mês', '#475569')
    const SIT = { GERADO: ['Gerada', '#15803d'], DESCARTADO: ['Descartada', '#b45309'] }
    const historico = [
        ...(d.meses || []).map(m => `<li><small>${esc(mesCurtoFluxo(String(m.mes).slice(0, 10)))}</small> ${etiquetaEst(...(SIT[m.situacao] || [m.situacao, '#475569']))}`
            + `${m.por ? ` <small>por ${esc(m.por)}</small>` : ''}${m.motivo ? ` <small>— ${esc(m.motivo)}</small>` : ''}</li>`),
        ...(d.notas || []).map(n => `<li><small>${esc(dataBrFluxo(String(n.emissao).slice(0, 10)))}</small> NFS-e ${esc(String(n.numero || n.ref || '').replace(/^0+/, ''))}`
            + `${n.origem === 'OMIE' ? ' (Omie)' : ''} · ${reaisFluxo(n.valor)}</li>`)
    ]
    const parcela = p?.parcela ? ` · parcela ${esc(p.parcela)}${r.parcelas_total ? `/${esc(r.parcelas_total)}` : ''}` : ''
    const desativada = !r.ativo && r.desativado_em
        ? `<br>Desativada em ${esc(dataHoraItemFluxo(r.desativado_em))}${r.desativado_por ? ` por ${esc(r.desativado_por)}` : ''}${r.desativado_motivo ? `: ${esc(r.desativado_motivo)}` : ''}.`
        : ''
    const elemento = `
        <div class="fis-painel fluxo-rec" data-recorrencia="${Number(r.id)}">
            <div class="fluxo-receb-topo">
                <small>${esc([r.contrato, r.app, r.cidade].filter(Boolean).join(' · '))}</small>
                <b>${esc(r.cliente || 'Cliente não informado')}</b>
                <div>${situacao}</div>
            </div>
            <div class="fluxo-receb-resumo">
                <div><span>${p ? 'Valor previsto' : 'Valor'}</span><b>${reaisFluxo(p?.valor ?? r.valor)}</b></div>
                <div><span>Periodicidade</span><b>${esc(textoPeriodicidadeFluxo(r.periodicidade_meses))}${r.dia ? `, dia ${esc(r.dia)}` : ''}</b></div>
                <div><span>Até quando</span><b>${esc(fim)}</b></div>
            </div>
            ${p ? `<div class="fluxo-rec-bloco"><span>Descrição da nota de ${esc(mesLongoFluxo(String(p.mes).slice(0, 10)))}${parcela}</span>
                <pre class="fluxo-rec-descricao">${esc(p.descricao || '')}</pre></div>` : ''}
            <small class="fluxo-receb-nota">Copiada da ${esc(r.base_texto || 'nota anterior')}. Cada nota nova da série vira o modelo da próxima.${desativada}</small>
            ${historico.length ? `<details class="fis-secao"><summary><b>Histórico</b> <span class="fis-contador">${historico.length}</span></summary><ul class="fis-lista">${historico.join('')}</ul></details>` : ''}
        </div>`
    const id = Number(r.id)
    const fechar = `removerPopup(this.closest('.popup')?.id); `
    popup({
        titulo: 'Nota recorrente',
        elemento,
        botoes: !r.ativo ? [] : [
            ...(p ? [
                { texto: 'Gerar NFS-e', img: 'concluido', funcao: `${fechar}gerarRecorrenciaFluxo(${id})` },
                { texto: 'Descartar este mês', img: 'cancel', funcao: `descartarRecorrenciaFluxo(${id})` }
            ] : []),
            { texto: 'Editar', img: 'editar', funcao: `${fechar}editarRecorrenciaFluxo(${id})` },
            { texto: 'Desativar', img: 'excluir', funcao: `desativarRecorrenciaFluxo(${id})` }
        ]
    })
}

// Ajuste da regra: valor, periodicidade, quantidade de notas, parcelas e a descrição (modelo).
async function editarRecorrenciaFluxo(recorrenciaId) {
    let d
    try {
        overlayAguarde()
        d = await apiModuloFiscal('fluxo-itens/recorrencia', { id: recorrenciaId })
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const r = d.recorrencia, esc = escEst
    const parcelaProxima = d.previsto?.parcela ?? (r.parcela_base != null ? Number(r.parcela_base) + 1 : '')
    const elemento = `
        <div class="fis-form fluxo-rec-form" data-recorrencia="${Number(r.id)}">
            <div class="fluxo-receb-topo"><small>${esc([r.contrato, r.app].filter(Boolean).join(' · '))}</small><b>${esc(r.cliente || '')}</b></div>
            <div class="fluxo-rec-grade">
                <label class="fluxo-receb-campo"><span>Valor da nota (R$)</span><input name="valor" type="number" min="0.01" step="0.01" value="${esc(Number(r.valor))}"></label>
                <label class="fluxo-receb-campo"><span>Periodicidade</span><select name="periodicidade_meses">${opcoesPeriodicidadeFluxo(r.periodicidade_meses)}</select></label>
                <label class="fluxo-receb-campo"><span>Dia da emissão</span><input name="dia" type="number" min="1" max="31" step="1" value="${esc(r.dia ?? '')}" placeholder="qualquer dia"></label>
                <label class="fluxo-receb-campo"><span>Quantidade de notas</span><input name="meses" type="number" min="1" step="1" value="${esc(r.meses ?? '')}" placeholder="vazio = até desativar"></label>
                <label class="fluxo-receb-campo"><span>Parcela da próxima nota</span><input name="parcela_atual" type="number" min="1" step="1" value="${esc(parcelaProxima)}" placeholder="sem parcela"></label>
                <label class="fluxo-receb-campo"><span>Total de parcelas</span><input name="parcelas_total" type="number" min="1" step="1" value="${esc(r.parcelas_total ?? '')}" placeholder="sem fim"></label>
            </div>
            <label class="fluxo-receb-campo"><span>Descrição da nota</span>
                <textarea name="descricao_modelo" rows="7">${esc(r.descricao_modelo || '')}</textarea></label>
        </div>`
    popup({ titulo: 'Editar nota recorrente', elemento, botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarRecorrenciaFluxo(this, ${Number(r.id)})` }] })
}

async function salvarRecorrenciaFluxo(botao, recorrenciaId) {
    const janela = botao.closest('.popup')
    if (!janela) return
    const campo = nome => janela.querySelector(`[name="${nome}"]`)?.value ?? ''
    try {
        overlayAguarde()
        await apiModuloFiscal('fluxo-itens/recorrencia-editar', {
            id: recorrenciaId, valor: Number(campo('valor')), periodicidade_meses: Number(campo('periodicidade_meses')),
            meses: campo('meses'), dia: campo('dia'), parcela_atual: campo('parcela_atual'), parcelas_total: campo('parcelas_total'),
            descricao_modelo: campo('descricao_modelo')
        })
        removerOverlay()
        removerPopup(janela.id)
        await carregarFluxo()
        abrirRecorrenciaFluxo(recorrenciaId)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// "Repetir todo mês" num cartão de serviço faturado: a última NFS-e dele vira o modelo das próximas.
function criarRecorrenciaFluxo(id) {
    const c = itemFluxo(id)
    if (!c) return
    const elemento = `
        <div class="fis-form fluxo-rec-form">
            <div class="fluxo-receb-topo"><small>${escEst([c.contrato || c.departamento, c.empresa].filter(Boolean).join(' · '))}</small><b>${escEst(c.cliente || '')}</b></div>
            <p class="fluxo-receb-nota">A última NFS-e deste cartão vira o modelo: no mês devido aparece em Pedidos uma nota prevista, com o mesmo
                cliente, valor e descrição (o mês e a parcela são trocados sozinhos), para gerar ou descartar.</p>
            <div class="fluxo-rec-grade">
                <label class="fluxo-receb-campo"><span>Periodicidade</span><select name="periodicidade_meses">${opcoesPeriodicidadeFluxo(1)}</select></label>
                <label class="fluxo-receb-campo"><span>Dia da emissão</span><input name="dia" type="number" min="1" max="31" step="1" placeholder="o da nota"></label>
                <label class="fluxo-receb-campo"><span>Quantidade de notas</span><input name="meses" type="number" min="1" step="1" placeholder="vazio = até desativar"></label>
            </div>
        </div>`
    popup({ titulo: 'Repetir esta nota', elemento, botoes: [{ texto: 'Tornar recorrente', img: 'concluido', funcao: `confirmarCriarRecorrenciaFluxo(this, '${escaparAtributo(id)}')` }] })
}

async function confirmarCriarRecorrenciaFluxo(botao, id) {
    const janela = botao.closest('.popup')
    if (!janela) return
    try {
        overlayAguarde()
        const r = await apiModuloFiscal('fluxo-itens/recorrencia-criar', {
            item_id: id,
            periodicidade_meses: Number(janela.querySelector('[name="periodicidade_meses"]')?.value) || 1,
            meses: janela.querySelector('[name="meses"]')?.value ?? '',
            dia: janela.querySelector('[name="dia"]')?.value ?? ''
        })
        removerOverlay()
        removerPopup(janela.id)
        await carregarFluxo()
        abrirRecorrenciaFluxo(r.id)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

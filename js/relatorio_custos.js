// Relatório de Custos por Departamento: vw_relatorio_custos_departamentos
// (gcs/SQL/relatorio_custos_departamentos.sql), com as mesmas fontes do Painel de Custos
// (orçado e custo), para não divergir do centro de custo.

// Acima deste percentual de custo sobre o orçado o departamento fica em alerta (mesmo limite do velocímetro).
const LIMITE_CUSTO_ORCADO = 40

function moedaCC(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function percentualCC(valor) {
    return Number.isFinite(valor)
        ? `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
        : '—'
}


// ---------------------------------------------------------------------------
// Custos por Departamento: duas abas.
// - Por departamento: um registro por departamento (vw_relatorio_custos_departamentos); cada
//   orçamento é um centro de custo, então esta lista é também a de orçamentos.
// - Por responsável: totais por quem criou o orçamento; "Ver" abre a lista filtrada pela pessoa.
// Abas e filtros rápidos ficam na barra da própria tabela (btnExtras do modTab). A pesquisa por
// coluna é a do modTab; os filtros rápidos (situação e responsável) entram como filtros fixos.
// ---------------------------------------------------------------------------

const SEM_RESPONSAVEL_CC = 'Sem responsável'

const relatorioCustosDep = { aba: 'departamentos', situacao: '', responsavel: '' }

// Chave = valor de "situacao" nas views (sem acento/separador). "Acima de 40%" inclui os estourados.
const SITUACOES_CUSTOS_DEP = [
    { chave: '', titulo: 'Todos' },
    { chave: 'acima', titulo: `Acima de ${LIMITE_CUSTO_ORCADO}%`, filtro: { percentual: { op: '>=', value: String(LIMITE_CUSTO_ORCADO) } } },
    { chave: 'estourado', titulo: 'Estourados (> 100%)', filtro: { situacao: { op: '=', value: 'estourado' } } },
    { chave: 'semorcamento', titulo: 'Sem orçamento', filtro: { situacao: { op: '=', value: 'semorcamento' } } }
]

// Nos números a pesquisa é "a partir de": 40 em Custo / Orçado mostra quem está em 40% ou mais.
const ABAS_CUSTOS_DEP = {
    departamentos: {
        titulo: 'Por departamento',
        pag: 'custosDepartamentos',
        base: 'vw_relatorio_custos_departamentos',
        body: 'bodyCustosDepartamentos',
        criarLinha: 'criarLinhaCustoDepartamento',
        filtrosRapidos: true,
        // Desempate pelo nome: sem ele, linhas com o mesmo custo trocam de página.
        ordenar: [
            { path: 'custo', direcao: 'desc', tipoOrdenacao: 'numero' },
            { path: 'departamento', direcao: 'asc' }
        ],
        colunas: {
            'Centro de custo': {},
            'Departamento': { chave: 'departamento' },
            'Custo / Orçado': { chave: 'percentual', op: '>=', tipoOrdenacao: 'numero' },
            'Orçado': { chave: 'orcado', op: '>=', tipoOrdenacao: 'numero' },
            'Custo': { chave: 'custo', op: '>=', tipoOrdenacao: 'numero' },
            'Responsável': { chave: 'responsavel' },
            'Cliente': { chave: 'cliente' },
            'Cidade': { chave: 'cidade' }
        }
    },
    responsaveis: {
        titulo: 'Por responsável',
        pag: 'custosResponsaveis',
        base: 'vw_relatorio_custos_responsaveis',
        body: 'bodyCustosResponsaveis',
        criarLinha: 'criarLinhaCustoResponsavel',
        filtrosRapidos: false,
        ordenar: [
            { path: 'custo', direcao: 'desc', tipoOrdenacao: 'numero' },
            { path: 'responsavel', direcao: 'asc' }
        ],
        colunas: {
            'Orçamentos': {},
            'Custo / Orçado': { chave: 'percentual', op: '>=', tipoOrdenacao: 'numero' },
            'Orçado': { chave: 'orcado', op: '>=', tipoOrdenacao: 'numero' },
            'Custo': { chave: 'custo', op: '>=', tipoOrdenacao: 'numero' },
            'Responsável': { chave: 'responsavel' },
            'Qtd. orçamentos': { chave: 'orcamentos', op: '>=', tipoOrdenacao: 'numero' },
            [`Acima de ${LIMITE_CUSTO_ORCADO}%`]: { chave: 'acima_limite', op: '>=', tipoOrdenacao: 'numero' },
            'Estourados': { chave: 'estourados', op: '>=', tipoOrdenacao: 'numero' }
        }
    }
}

async function telaCustosDepartamentos() {

    relatorioCustosDep.situacao = ''
    relatorioCustosDep.responsavel = ''

    tela.innerHTML = `
        <div class="pagina-conteudo relatorio-departamentos">
            <div class="cabecalho-pagina"><h2>Custos por Departamento</h2></div>
            <div class="relatorio-dep-conteudo"></div>
        </div>
    `

    await abrirAbaCustosDep('departamentos')
}

// Abas + filtros rápidos, dentro da barra verde da tabela (mesmo padrão das outras telas).
function barraCustosDep(chaveAtiva) {
    const abas = Object.entries(ABAS_CUSTOS_DEP)
        .map(([chave, aba]) => `
            <button type="button" class="${chave === chaveAtiva ? 'ativa' : ''}" aria-selected="${chave === chaveAtiva}"
                onclick="abrirAbaCustosDep('${chave}')">${aba.titulo}</button>`)
        .join('')
    return `
        <div class="relatorio-dep-barra">
            <nav class="relatorio-dep-abas" role="tablist">${abas}</nav>
            ${ABAS_CUSTOS_DEP[chaveAtiva].filtrosRapidos ? '<div class="relatorio-dep-filtros"></div>' : ''}
        </div>`
}

async function abrirAbaCustosDep(chave) {

    const aba = ABAS_CUSTOS_DEP[chave]
    if (!aba) return

    // Sem overlay: a própria tabela mostra o carregando enquanto busca os dados.
    try {

        relatorioCustosDep.aba = chave

        const conteudo = document.querySelector('.relatorio-dep-conteudo')
        if (!conteudo) return

        const { titulo, filtrosRapidos, ...config } = aba
        conteudo.innerHTML = await modTab({
            ...config,
            topoEmLinha: true,
            btnExtras: barraCustosDep(chave),
            ...(filtrosRapidos ? { filtrosFixos: filtrosRapidosCustosDep(), funcaoAdicional: ['contarSituacoesCustosDep'] } : {})
        })

        if (filtrosRapidos) renderizarFiltrosCustosDep()

        await paginacao(aba.pag)

    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o relatório de custos: ${err.message || 'fale com o suporte.'}` })
    } finally {
        // Não abre overlay, mas fecha algum que tenha ficado de antes (ex.: aberto pelo menu).
        removerOverlay()
    }
}

// Situação escolhida + responsável vindo da aba "Por responsável".
function filtrosRapidosCustosDep() {
    const { situacao, responsavel } = relatorioCustosDep
    const filtros = { ...(SITUACOES_CUSTOS_DEP.find(s => s.chave === situacao)?.filtro || {}) }
    if (responsavel)
        filtros.responsavel = responsavel === SEM_RESPONSAVEL_CC
            ? { op: 'IS_EMPTY' }
            : { op: '=', value: responsavel }
    return Object.keys(filtros).length ? filtros : null
}

function renderizarFiltrosCustosDep(contagem = null) {
    const div = document.querySelector('.relatorio-dep-filtros')
    if (!div) return

    const quantidade = chave => {
        if (!contagem) return ''
        const n = chave === '' ? contagem.todos
            : chave === 'acima' ? (contagem.acima || 0) + (contagem.estourado || 0)
            : contagem[chave] || 0
        return `<b>${Number(n || 0).toLocaleString('pt-BR')}</b>`
    }

    const { situacao, responsavel } = relatorioCustosDep
    div.innerHTML = `
        ${SITUACOES_CUSTOS_DEP.map(s => `
            <button type="button" class="relatorio-dep-chip relatorio-dep-chip--${s.chave || 'todos'}${situacao === s.chave ? ' ativo' : ''}"
                onclick="filtrarSituacaoCustosDep('${s.chave}')">${s.titulo} ${quantidade(s.chave)}</button>`).join('')}
        ${responsavel ? `
            <span class="relatorio-dep-responsavel">Responsável: <b>${escaparAtributo(responsavel)}</b>
                <button type="button" title="Tirar filtro" aria-label="Tirar filtro de responsável" onclick="filtrarResponsavelCustosDep('')">✕</button>
            </span>` : ''}`
}

async function aplicarFiltrosRapidosCustosDep() {
    const ctrl = controles[ABAS_CUSTOS_DEP[relatorioCustosDep.aba]?.pag]
    if (!ctrl) return
    ctrl.filtrosFixos = filtrosRapidosCustosDep()
    ctrl.pagina = 1
    renderizarFiltrosCustosDep()
    await paginacao(ctrl.pag)
}

async function filtrarSituacaoCustosDep(chave) {
    relatorioCustosDep.situacao = chave
    await aplicarFiltrosRapidosCustosDep()
}

// "Ver" da aba "Por responsável" abre a lista de centros de custo da pessoa; o ✕ tira o filtro.
async function filtrarResponsavelCustosDep(responsavel) {
    relatorioCustosDep.responsavel = responsavel
    if (responsavel && relatorioCustosDep.aba !== 'departamentos')
        return abrirAbaCustosDep('departamentos')
    await aplicarFiltrosRapidosCustosDep()
}

// Contadores dos filtros rápidos: seguem a pesquisa das colunas e o responsável, não a situação escolhida.
async function contarSituacoesCustosDep() {
    const aba = ABAS_CUSTOS_DEP[relatorioCustosDep.aba]
    if (!aba?.filtrosRapidos) return
    const { situacao, percentual, ...fixos } = filtrosRapidosCustosDep() || {}
    try {
        const contagem = await contarPorCampo({
            base: aba.base,
            path: 'situacao',
            filtros: combinarFiltros(controles[aba.pag]?.filtros || {}, Object.keys(fixos).length ? fixos : null)
        })
        renderizarFiltrosCustosDep(contagem)
    } catch (err) {
        console.error(err)
    }
}

function criarLinhaCustoResponsavel(r) {
    const percentual = r.percentual === null || r.percentual === '' ? NaN : Number(r.percentual)
    const numero = valor => Number(valor || 0).toLocaleString('pt-BR')
    const acima = Number(r.acima_limite) || 0
    const estourados = Number(r.estourados) || 0
    return `
        <tr>
            <td style="text-align: center;">
                <button type="button" class="relatorio-dep-ver" title="Ver os orçamentos de ${escaparAtributo(r.responsavel)}"
                    onclick="filtrarResponsavelCustosDep(this.dataset.responsavel)" data-responsavel="${escaparAtributo(r.responsavel)}">Ver</button>
            </td>
            <td class="relatorio-departamentos-medidor">${medidorCustoDepartamento(percentual)}</td>
            <td class="relatorio-departamentos-numero">${moedaCC(r.orcado)}</td>
            <td class="relatorio-departamentos-numero">${moedaCC(r.custo)}</td>
            <td>${escaparAtributo(r.responsavel)}</td>
            <td class="relatorio-departamentos-numero">${numero(r.orcamentos)}</td>
            <td class="relatorio-departamentos-numero${acima ? ' relatorio-dep-alerta' : ''}">${numero(acima)}</td>
            <td class="relatorio-departamentos-numero${estourados ? ' relatorio-dep-estourado' : ''}">${numero(estourados)}</td>
        </tr>`
}

// Mesmas faixas do velocímetro: atenção 10 pontos antes do limite, crítico no limite, azul acima de 100%.
function faixaCustoDepartamento(percentual) {
    if (percentual > 100) return 'estourado'
    if (percentual >= LIMITE_CUSTO_ORCADO) return 'critico'
    if (percentual >= LIMITE_CUSTO_ORCADO - 10) return 'alerta'
    return 'ok'
}

// Meio arco compacto. pathLength="100" faz o traço preenchido ser o próprio percentual.
function arcoCustoDepartamento(percentual) {
    const preenchido = Math.max(0, Math.min(100, percentual))
    const arco = 'M 8 44 A 36 36 0 0 1 80 44'
    return `
        <svg class="medidor-cc__arco" viewBox="0 0 88 50" aria-hidden="true">
            <path class="medidor-cc__trilha" d="${arco}" pathLength="100"></path>
            <path class="medidor-cc__progresso" d="${arco}" pathLength="100" stroke-dasharray="${preenchido} 100"></path>
            <line class="medidor-cc__limite" x1="${44 - 36 * Math.cos(Math.PI * LIMITE_CUSTO_ORCADO / 100)}" y1="${44 - 36 * Math.sin(Math.PI * LIMITE_CUSTO_ORCADO / 100)}"
                x2="${44 - 26 * Math.cos(Math.PI * LIMITE_CUSTO_ORCADO / 100)}" y2="${44 - 26 * Math.sin(Math.PI * LIMITE_CUSTO_ORCADO / 100)}"></line>
        </svg>`
}

function medidorCustoDepartamento(percentual) {
    if (!Number.isFinite(percentual))
        return '<span class="medidor-cc medidor-cc--vazio" title="Sem orçamento vinculado">—</span>'

    return `
        <span class="medidor-cc medidor-cc--${faixaCustoDepartamento(percentual)}" title="${percentualCC(percentual)} do orçado (limite ${LIMITE_CUSTO_ORCADO}%)">
            ${arcoCustoDepartamento(percentual)}
            <b>${percentualCC(percentual)}</b>
        </span>`
}

function criarLinhaCustoDepartamento(d) {

    const orcado = Number(d.orcado) || 0
    const custo = Number(d.custo) || 0
    const percentual = d.percentual === null || d.percentual === '' ? NaN : Number(d.percentual)

    const texto = valor => escaparAtributo(valor || '—')

    return `
        <tr>
            <td style="text-align: center;">
                ${d.tem_centro_custo
                    ? `<img src="imagens/pesquisar.svg" style="width: 1.5rem; cursor: pointer;" title="Painel de custos"
                        onclick="painelCustos(this.dataset.departamento)" data-departamento="${escaparAtributo(d.departamento)}">`
                    : '<span title="Sem centro de custo criado">—</span>'}
            </td>
            <td>${escaparAtributo(d.departamento)}</td>
            <td class="relatorio-departamentos-medidor">${medidorCustoDepartamento(percentual)}</td>
            <td class="relatorio-departamentos-numero">${orcado ? moedaCC(orcado) : '—'}</td>
            <td class="relatorio-departamentos-numero">${moedaCC(custo)}</td>
            <td>${texto(d.responsavel)}</td>
            <td>${texto(d.cliente)}</td>
            <td>${texto(d.cidade)}</td>
        </tr>`
}

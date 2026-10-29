// Relatórios de custos.
// - Custos por Departamento: vw_relatorio_custos_departamentos (gcs/SQL/relatorio_custos_departamentos.sql),
//   com as mesmas fontes do Painel de Custos (orçado e custo), para não divergir do centro de custo.
// - Custos por Período: vw_relatorio_cc_contratos (gcs/SQL/relatorio_custos_cc.sql).

// Acima deste percentual de custo sobre o orçado o contrato fica em alerta (mesmo limite do velocímetro).
const LIMITE_CUSTO_ORCADO = 40

function rotuloMesCC(mes) {
    if (!mes) return 'Sem data'
    const [ano, numero] = mes.split('-').map(Number)
    return new Date(ano, numero - 1, 1)
        .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        .replace('.', '')
}

function moedaCC(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function percentualCC(valor) {
    return Number.isFinite(valor)
        ? `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
        : '—'
}

// Valores numeric do Postgres chegam como texto.
async function carregarContratosCC() {
    const resposta = await pesquisarDB({ base: 'vw_relatorio_cc_contratos', limite: 100000 })
    return (resposta?.resultados || []).map(c => ({
        ...c,
        total_orcado: Number(c.total_orcado) || 0,
        custo_realizado: Number(c.custo_realizado) || 0,
        custo_previsto: Number(c.custo_previsto) || 0,
        receita_realizada: Number(c.receita_realizada) || 0,
        receita_prevista: Number(c.receita_prevista) || 0
    }))
}


// ---------------------------------------------------------------------------
// Custos por Departamento: lista paginada de todos os departamentos, com o somatório
// e o custo sobre o orçado. A pesquisa por coluna é a do modTab; os totais seguem os filtros.
// ---------------------------------------------------------------------------

const PAG_CUSTOS_DEPARTAMENTOS = 'custosDepartamentos'
const BASE_CUSTOS_DEPARTAMENTOS = 'vw_relatorio_custos_departamentos'

async function telaCustosDepartamentos() {

    try {

        overlayAguarde()

        const tabela = await modTab({
            pag: PAG_CUSTOS_DEPARTAMENTOS,
            base: BASE_CUSTOS_DEPARTAMENTOS,
            body: 'bodyCustosDepartamentos',
            criarLinha: 'criarLinhaCustoDepartamento',
            funcaoAdicional: ['totaisCustosDepartamentos'],
            // Desempate pelo nome: sem ele, departamentos com o mesmo custo trocam de página.
            ordenar: [
                { path: 'custo', direcao: 'desc', tipoOrdenacao: 'numero' },
                { path: 'departamento', direcao: 'asc' }
            ],
            colunas: {
                'Departamento': { chave: 'departamento' },
                'Cliente': { chave: 'cliente' },
                'Cidade': { chave: 'cidade' },
                // Nos números a pesquisa é "a partir de": 40 em Custo / Orçado mostra quem está em 40% ou mais.
                'Orçado': { chave: 'orcado', op: '>=', tipoOrdenacao: 'numero' },
                'Custo': { chave: 'custo', op: '>=', tipoOrdenacao: 'numero' },
                'Custo / Orçado': { chave: 'percentual', op: '>=', tipoOrdenacao: 'numero' },
                'Centro de custo': {}
            }
        })

        tela.innerHTML = `
            <div class="pagina-conteudo relatorio-departamentos">
                <div class="cabecalho-pagina"><h2>Custos por Departamento</h2></div>
                <div class="relatorio-departamentos-totais"></div>
                ${tabela}
            </div>
        `

        await paginacao(PAG_CUSTOS_DEPARTAMENTOS)

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o relatório de custos: ${err.message || 'fale com o suporte.'}` })
    }

}

function velocimetroCustoDepartamento(percentual, tamanho) {
    return criarVelocimetroHTML({ rotulo: 'do orçado', limite: LIMITE_CUSTO_ORCADO, valor: percentual, tamanho })
}

function criarLinhaCustoDepartamento(d) {

    const orcado = Number(d.orcado) || 0
    const custo = Number(d.custo) || 0
    const percentual = d.percentual === null || d.percentual === '' ? NaN : Number(d.percentual)

    const texto = valor => escaparAtributo(valor || '—')

    return `
        <tr>
            <td>${escaparAtributo(d.departamento)}</td>
            <td>${texto(d.cliente)}</td>
            <td>${texto(d.cidade)}</td>
            <td class="relatorio-departamentos-numero">${orcado ? moedaCC(orcado) : '—'}</td>
            <td class="relatorio-departamentos-numero">${moedaCC(custo)}</td>
            <td class="relatorio-departamentos-medidor">
                ${Number.isFinite(percentual) ? velocimetroCustoDepartamento(percentual, 110) : '<span title="Sem orçamento vinculado">—</span>'}
            </td>
            <td style="text-align: center;">
                ${d.tem_centro_custo
                    ? `<img src="imagens/pesquisar.svg" style="width: 1.5rem; cursor: pointer;" title="Painel de custos"
                        onclick="painelCustos(this.dataset.departamento)" data-departamento="${escaparAtributo(d.departamento)}">`
                    : '<span title="Sem centro de custo criado">—</span>'}
            </td>
        </tr>`
}

// Somas no servidor com os mesmos filtros da tabela (valem para todas as páginas, não só a visível).
// O percentual geral considera só departamentos com orçado: custo sem orçamento não tem base de comparação.
async function totaisCustosDepartamentos() {

    const div = document.querySelector('.relatorio-departamentos-totais')
    if (!div) return

    const filtros = controles[PAG_CUSTOS_DEPARTAMENTOS]?.filtros || {}
    const comOrcado = combinarFiltros(filtros, { orcado: { op: '>', value: '0' } })
    const somar = (path, filtros) => contarPorCampo({ base: BASE_CUSTOS_DEPARTAMENTOS, path, filtros, modo: 'soma' })

    try {

        const [orcado, custo, custoComOrcado] = await Promise.all([
            somar('orcado', filtros),
            somar('custo', filtros),
            somar('custo', comOrcado)
        ])

        const percentual = orcado.total ? Math.round(custoComOrcado.total / orcado.total * 1000) / 10 : NaN

        const indicador = (titulo, valor, detalhe = '') => `
            <div class="relatorio-departamentos-indicador">
                <span>${titulo}</span>
                <strong>${valor}</strong>
                ${detalhe ? `<small>${detalhe}</small>` : ''}
            </div>`

        div.innerHTML = `
            <div class="relatorio-departamentos-indicadores">
                ${indicador('Departamentos', custo.todos.toLocaleString('pt-BR'))}
                ${indicador('Orçado', moedaCC(orcado.total))}
                ${indicador('Custo', moedaCC(custo.total), custo.total !== custoComOrcado.total
                    ? `${moedaCC(custo.total - custoComOrcado.total)} em departamentos sem orçado`
                    : '')}
                ${indicador('Saldo', moedaCC(orcado.total - custoComOrcado.total), 'orçado − custo dos orçados')}
            </div>
            <div class="relatorio-departamentos-geral">
                ${Number.isFinite(percentual)
                    ? velocimetroCustoDepartamento(percentual, 200)
                    : '<span>Sem orçado nos filtros escolhidos</span>'}
            </div>
        `

    } catch (err) {
        console.error(err)
        div.innerHTML = '<p class="relatorio-cc-vazio">Não foi possível somar os custos.</p>'
    }

}

// Colunas reaproveitadas pelas tabelas do relatório por período.
const colunasTabelaCC = [
    { titulo: 'Contrato', chave: 'contrato', tipo: 'texto' },
    { titulo: 'Mês do orçamento', chave: 'mes_orcamento', tipo: 'mes' },
    { titulo: 'Cliente', chave: 'cliente', tipo: 'texto' },
    { titulo: 'Cidade', chave: 'cidade', tipo: 'texto' },
    { titulo: 'Orçado', chave: 'orcado', tipo: 'moeda' },
    { titulo: 'Custo realizado', chave: 'custoRealizado', tipo: 'moeda' },
    { titulo: 'Custo previsto', chave: 'custoPrevisto', tipo: 'moeda' },
    { titulo: 'Custo total', chave: 'custoTotal', tipo: 'moeda' },
    { titulo: 'Custo / Orçado', chave: 'percentual', tipo: 'percentual' },
    { titulo: 'Receita', chave: 'receita', tipo: 'moeda' },
    { titulo: 'Saldo (Orçado − Custo)', chave: 'saldo', tipo: 'moeda' }
]

function celulaCC(linha, { chave, tipo }) {
    const valor = linha[chave]

    if (tipo === 'moeda')
        return Number.isFinite(valor)
            ? `<td class="relatorio-cc-numero${valor < 0 ? ' negativo-relatorio' : ''}">${moedaCC(valor)}</td>`
            : '<td class="relatorio-cc-numero">—</td>'

    if (tipo === 'percentual') {
        if (!Number.isFinite(valor)) return '<td class="relatorio-cc-numero">—</td>'
        const classe = valor > 100 ? 'estourado' : valor > LIMITE_CUSTO_ORCADO ? 'alerta' : 'ok'
        return `
            <td class="relatorio-cc-numero">
                <div class="relatorio-cc-barra ${classe}" title="${percentualCC(valor)}">
                    <span style="width: ${Math.min(valor, 100)}%"></span>
                    <label>${percentualCC(valor)}</label>
                </div>
            </td>`
    }

    if (tipo === 'mes')
        return `<td>${valor ? rotuloMesCC(valor) : '—'}</td>`

    return `<td>${escaparAtributo(String(valor || ''))}</td>`
}


// ---------------------------------------------------------------------------
// Custos por Período: hierarquia Ano > Mês (estrutura do Omie) > Contratos.
// ---------------------------------------------------------------------------

const relatorioPeriodos = {
    contratos: [],
    // Blocos abertos, preservados entre filtros; começa tudo recolhido.
    abertos: new Set()
}

const SEM_MES_CC = 'sem-mes'

function nomeMesCC(mes) {
    if (!mes || mes === SEM_MES_CC) return 'Sem mês de referência'
    const [ano, numero] = mes.split('-').map(Number)
    const nome = new Date(ano, numero - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return nome.charAt(0).toUpperCase() + nome.slice(1)
}

async function telaCustosPorPeriodo() {

    try {

        overlayAguarde()

        relatorioPeriodos.contratos = await carregarContratosCC()
        relatorioPeriodos.abertos = new Set()

        const anos = [...new Set(relatorioPeriodos.contratos
            .map(c => c.mes_orcamento?.slice(0, 4))
            .filter(Boolean))]
            .sort()
            .reverse()

        tela.innerHTML = `
            <div class="pagina-conteudo relatorio-periodos">
                <div class="cabecalho-pagina"><h2>Custos por Período</h2></div>

                <div class="relatorio-cc-filtros">
                    <label>Ano
                        <select name="ano" onchange="atualizarRelatorioPeriodos()">
                            <option value="">Todos</option>
                            ${anos.map(a => `<option>${a}</option>`).join('')}
                            <option value="${SEM_MES_CC}">Sem mês de referência</option>
                        </select>
                    </label>
                    <div class="relatorio-cc-busca">
                        <span>Pesquisar</span>
                        <div class="relatorio-cc-pesquisa">
                            <input type="search" name="busca" placeholder="Contrato, cliente ou cidade" aria-label="Pesquisar"
                                onkeydown="if (event.key === 'Enter') atualizarRelatorioPeriodos()"
                                oninput="if (!this.value) atualizarRelatorioPeriodos()">
                            <button type="button" title="Pesquisar" aria-label="Pesquisar" onclick="atualizarRelatorioPeriodos()">
                                <img src="imagens/pesquisar.svg" alt="">
                            </button>
                        </div>
                    </div>
                    <label class="relatorio-cc-check">
                        <input type="checkbox" name="previstos" checked onchange="atualizarRelatorioPeriodos()">
                        Incluir previstos (a pagar / a receber)
                    </label>
                </div>

                <div class="relatorio-periodos-arvore"></div>
            </div>
        `

        atualizarRelatorioPeriodos()

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o relatório por período: ${err.message || 'fale com o suporte.'}` })
    }

}

function linhaPeriodoCC(c, previstos) {
    const custoRealizado = c.custo_realizado
    const custoPrevisto = previstos ? c.custo_previsto : 0
    const custoTotal = custoRealizado + custoPrevisto
    const orcado = c.total_orcado
    return {
        ...c,
        orcado,
        custoRealizado,
        custoPrevisto,
        custoTotal,
        receita: c.receita_realizada + (previstos ? c.receita_prevista : 0),
        percentual: orcado ? custoTotal / orcado * 100 : NaN,
        saldo: orcado ? orcado - custoTotal : NaN
    }
}

function totaisPeriodoCC(linhas) {
    const soma = chave => linhas.reduce((total, l) => total + l[chave], 0)
    const orcado = soma('orcado')
    const custoTotal = soma('custoTotal')
    return {
        quantidade: linhas.length,
        orcado,
        custoTotal,
        receita: soma('receita'),
        percentual: orcado ? custoTotal / orcado * 100 : NaN,
        saldo: orcado - custoTotal
    }
}

function resumoPeriodoCC(t) {
    const classe = t.percentual > 100 ? 'estourado' : t.percentual > LIMITE_CUSTO_ORCADO ? 'alerta' : 'ok'
    const barra = Number.isFinite(t.percentual)
        ? `<span class="relatorio-cc-barra ${classe}"><span style="width: ${Math.min(t.percentual, 100)}%"></span><label>${percentualCC(t.percentual)}</label></span>`
        : '<b>—</b>'

    return `
        <span class="relatorio-periodos-resumo">
            <span><small>Orçamentos</small><b>${t.quantidade}</b></span>
            <span><small>Orçado</small><b>${moedaCC(t.orcado)}</b></span>
            <span><small>Custo</small><b>${moedaCC(t.custoTotal)}</b></span>
            <span class="relatorio-periodos-percentual"><small>Custo / Orçado</small>${barra}</span>
            <span><small>Receita</small><b>${moedaCC(t.receita)}</b></span>
            <span><small>Saldo</small><b class="${t.saldo < 0 ? 'negativo-relatorio' : ''}">${moedaCC(t.saldo)}</b></span>
        </span>`
}

// Larguras em px; Cliente fica sem largura para ocupar o espaço que sobra.
// Moeda: cabe "R$ -9.999.999,99" sem vazar para a coluna ao lado.
const LARGURAS_PERIODO_CC = {
    contrato: 130,
    cidade: 120,
    orcado: 135,
    custoRealizado: 135,
    custoPrevisto: 135,
    custoTotal: 135,
    percentual: 130,
    receita: 135,
    saldo: 140
}

const LARGURA_CLIENTE_PERIODO_CC = 220
const LARGURA_ACOES_PERIODO_CC = 250

function tabelaPeriodoCC(linhas, previstos) {

    // O mês já é o agrupador; o previsto some quando não está incluído.
    const colunas = colunasTabelaCC.filter(c =>
        c.chave !== 'mes_orcamento' && (previstos || c.chave !== 'custoPrevisto'))

    const trs = [...linhas]
        .sort((a, b) => b.custoTotal - a.custoTotal || String(a.contrato).localeCompare(String(b.contrato)))
        .map(l => `
            <tr>
                ${colunas.map(c => celulaCC(l, c)).join('')}
                <td>
                    <div class="relatorio-periodos-acoes">
                        <button type="button" ${l.orcamento_id ? '' : 'disabled title="Contrato sem orçamento"'}
                            onclick="abrirAtalhos(this.dataset.id)" data-id="${escaparAtributo(String(l.orcamento_id || ''))}">Orçamento</button>
                        <button type="button" class="secundario"
                            onclick="painelCustos(this.dataset.contrato)" data-contrato="${escaparAtributo(l.contrato)}">Centro de custo</button>
                    </div>
                </td>
            </tr>`)
        .join('')

    const ths = colunas
        .map(c => `<th class="${['texto', 'mes'].includes(c.tipo) ? '' : 'relatorio-cc-numero'}">${c.titulo}</th>`)
        .join('')

    // Larguras fixas: as tabelas de todos os meses ficam com as mesmas colunas.
    const cols = colunas
        .map(c => `<col style="width: ${LARGURAS_PERIODO_CC[c.chave] ? `${LARGURAS_PERIODO_CC[c.chave]}px` : 'auto'}">`)
        .join('')

    // A largura mínima reserva espaço para a coluna sem largura (Cliente); sem isso ela fica com zero.
    const larguraMinima = colunas.reduce((total, c) => total + (LARGURAS_PERIODO_CC[c.chave] || LARGURA_CLIENTE_PERIODO_CC), 0)
        + LARGURA_ACOES_PERIODO_CC

    return `
        <div class="relatorio-cc-tabela">
            <table class="relatorio-cc-tab relatorio-periodos-tab" style="min-width: ${larguraMinima}px">
                <colgroup>${cols}<col style="width: ${LARGURA_ACOES_PERIODO_CC}px"></colgroup>
                <thead><tr>${ths}<th>Ações</th></tr></thead>
                <tbody>${trs}</tbody>
            </table>
        </div>`
}

function atualizarRelatorioPeriodos() {

    const arvore = document.querySelector('.relatorio-periodos-arvore')
    if (!arvore) return

    const campo = nome => document.querySelector(`.relatorio-periodos [name="${nome}"]`)
    const ano = campo('ano').value
    const busca = campo('busca').value.trim().toLocaleLowerCase('pt-BR')
    const previstos = campo('previstos').checked

    // Ano > Mês > contratos.
    const anos = new Map()
    for (const c of relatorioPeriodos.contratos) {
        if (busca && ![c.contrato, c.cliente, c.cidade]
            .some(t => String(t || '').toLocaleLowerCase('pt-BR').includes(busca))) continue

        const mes = c.mes_orcamento || SEM_MES_CC
        const chaveAno = mes === SEM_MES_CC ? SEM_MES_CC : mes.slice(0, 4)
        if (ano && ano !== chaveAno) continue

        if (!anos.has(chaveAno)) anos.set(chaveAno, new Map())
        const meses = anos.get(chaveAno)
        if (!meses.has(mes)) meses.set(mes, [])
        meses.get(mes).push(linhaPeriodoCC(c, previstos))
    }

    // Do mais recente para o mais antigo; "sem mês" fica por último.
    const ordemDesc = (a, b) => (a === SEM_MES_CC) - (b === SEM_MES_CC) || b.localeCompare(a)
    const chavesAnos = [...anos.keys()].sort(ordemDesc)

    if (!chavesAnos.length) {
        arvore.innerHTML = '<p class="relatorio-cc-vazio relatorio-cc-cartao">Nenhum orçamento para os filtros escolhidos.</p>'
        return
    }

    const aberto = chave => relatorioPeriodos.abertos.has(chave) ? 'open' : ''

    arvore.innerHTML = chavesAnos.map(chaveAno => {
        const meses = anos.get(chaveAno)
        const chavesMeses = [...meses.keys()].sort(ordemDesc)

        const blocosMeses = chavesMeses.map(mes => `
            <details class="relatorio-periodos-mes" data-chave="mes:${mes}" ontoggle="lembrarPeriodoCC(this)" ${aberto(`mes:${mes}`)}>
                <summary>
                    <span class="relatorio-periodos-titulo">${nomeMesCC(mes)}</span>
                    ${resumoPeriodoCC(totaisPeriodoCC(meses.get(mes)))}
                </summary>
                ${tabelaPeriodoCC(meses.get(mes), previstos)}
            </details>`)
            .join('')

        // "Sem mês" não tem nível de ano: vai direto para a lista.
        if (chaveAno === SEM_MES_CC)
            return blocosMeses

        return `
            <details class="relatorio-periodos-ano" data-chave="ano:${chaveAno}" ontoggle="lembrarPeriodoCC(this)" ${aberto(`ano:${chaveAno}`)}>
                <summary>
                    <span class="relatorio-periodos-titulo">${chaveAno}</span>
                    ${resumoPeriodoCC(totaisPeriodoCC(chavesMeses.flatMap(m => meses.get(m))))}
                </summary>
                <div class="relatorio-periodos-meses">${blocosMeses}</div>
            </details>`
    }).join('')
}

function lembrarPeriodoCC(details) {
    const { abertos } = relatorioPeriodos
    details.open ? abertos.add(details.dataset.chave) : abertos.delete(details.dataset.chave)
}

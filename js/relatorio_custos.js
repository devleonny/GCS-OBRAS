// Relatório de Custos por Centro de Custo (contrato).
// Dados: vw_relatorio_cc_contratos e vw_relatorio_cc_movimentos (gcs/SQL/relatorio_custos_cc.sql).

const relatorioCC = {
    contratos: [],
    movimentos: [],
    ordenacao: { chave: 'custoTotal', direcao: -1 },
    linhas: []
}

// Acima deste percentual de custo sobre o orçado o contrato fica em alerta (mesmo limite do velocímetro).
const LIMITE_CUSTO_ORCADO = 40

const LIMITE_LINHAS_RELATORIO_CC = 500

function mesAtualCC(deslocamento = 0) {
    const data = dataServidor()
    data.setDate(1)
    data.setMonth(data.getMonth() + deslocamento)
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function rotuloMesCC(mes) {
    if (!mes) return 'Sem data'
    const [ano, numero] = mes.split('-').map(Number)
    return new Date(ano, numero - 1, 1)
        .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        .replace('.', '')
}

function mesesEntreCC(de, ate) {
    const meses = []
    let [ano, mes] = de.split('-').map(Number)
    const [anoFim, mesFim] = ate.split('-').map(Number)
    while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
        meses.push(`${ano}-${String(mes).padStart(2, '0')}`)
        if (++mes > 12) { mes = 1; ano++ }
        if (meses.length > 120) break
    }
    return meses
}

function moedaCC(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function moedaCurtaCC(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1
    })
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

async function telaCustosCentroCusto() {

    try {

        overlayAguarde()

        const [contratos, movimentos] = await Promise.all([
            carregarContratosCC(),
            pesquisarDB({ base: 'vw_relatorio_cc_movimentos', limite: 500000 })
        ])

        relatorioCC.contratos = contratos
        relatorioCC.movimentos = (movimentos?.resultados || []).map(m => ({
            ...m,
            valor: Number(m.valor) || 0
        }))

        const empresas = [...new Set(relatorioCC.movimentos.map(m => m.app).filter(Boolean))].sort()

        tela.innerHTML = `
            <div class="pagina-conteudo relatorio-cc">
                <div class="cabecalho-pagina"><h2>Custos por Centro de Custo</h2></div>

                <div class="relatorio-cc-filtros">
                    <label>Visão
                        <select name="visao" onchange="atualizarRelatorioCC()">
                            <option value="vencimento">Por mês de vencimento</option>
                            <option value="orcamento">Por mês do orçamento</option>
                        </select>
                    </label>
                    <label>De
                        <input type="month" name="de" value="${mesAtualCC(-11)}" onchange="atualizarRelatorioCC()">
                    </label>
                    <label>Até
                        <input type="month" name="ate" value="${mesAtualCC()}" onchange="atualizarRelatorioCC()">
                    </label>
                    <label>Empresa
                        <select name="empresa" onchange="atualizarRelatorioCC()">
                            <option value="">Todas</option>
                            ${empresas.map(e => `<option>${escaparAtributo(e)}</option>`).join('')}
                        </select>
                    </label>
                    <div class="relatorio-cc-busca">
                        <span>Pesquisar</span>
                        <div class="relatorio-cc-pesquisa">
                            <input type="search" name="busca" placeholder="Contrato, cliente ou cidade" aria-label="Pesquisar"
                                onkeydown="if (event.key === 'Enter') atualizarRelatorioCC()"
                                oninput="if (!this.value) atualizarRelatorioCC()">
                            <button type="button" title="Pesquisar" aria-label="Pesquisar" onclick="atualizarRelatorioCC()">
                                <img src="imagens/pesquisar.svg" alt="">
                            </button>
                        </div>
                    </div>
                    <label class="relatorio-cc-check">
                        <input type="checkbox" name="previstos" checked onchange="atualizarRelatorioCC()">
                        Incluir previstos (a pagar / a receber)
                    </label>
                </div>

                <div class="relatorio-cc-indicadores"></div>

                <div class="relatorio-cc-graficos">
                    <section class="relatorio-cc-cartao relatorio-cc-cartao-largo">
                        <h3>Mês a mês</h3>
                        <div class="relatorio-cc-grafico"><canvas id="relatorio-cc-mensal"></canvas></div>
                    </section>
                    <section class="relatorio-cc-cartao">
                        <h3>Custos por categoria</h3>
                        <div class="relatorio-cc-grafico"><canvas id="relatorio-cc-categorias"></canvas></div>
                    </section>
                    <section class="relatorio-cc-cartao">
                        <h3>Maiores custos por contrato</h3>
                        <div class="relatorio-cc-grafico"><canvas id="relatorio-cc-contratos"></canvas></div>
                    </section>
                </div>

                <section class="relatorio-cc-cartao">
                    <h3>Contratos <span class="relatorio-cc-contagem"></span></h3>
                    <div class="relatorio-cc-tabela"></div>
                </section>
            </div>
        `

        atualizarRelatorioCC()

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o relatório de custos: ${err.message || 'fale com o suporte.'}` })
    }

}

function filtrosRelatorioCC() {
    const valor = nome => document.querySelector(`.relatorio-cc-filtros [name="${nome}"]`)
    let de = valor('de').value || mesAtualCC(-11)
    let ate = valor('ate').value || mesAtualCC()
    if (de > ate) [de, ate] = [ate, de]

    return {
        visao: valor('visao').value,
        de,
        ate,
        empresa: valor('empresa').value,
        busca: valor('busca').value.trim().toLocaleLowerCase('pt-BR'),
        previstos: valor('previstos').checked
    }
}

// Agrega os movimentos conforme a visão:
// - vencimento: custos e receitas datados pelo vencimento dentro do período (fluxo de caixa);
// - orçamento: contratos cujo mês de referência (estrutura) está no período, com todos os seus custos (orçado x realizado).
function agregarRelatorioCC(filtros) {

    const { visao, de, ate, empresa, busca, previstos } = filtros
    const meses = mesesEntreCC(de, ate)
    const noPeriodo = mes => mes && mes >= de && mes <= ate

    const contratos = new Map(relatorioCC.contratos.map(c => [c.contrato, c]))

    const combinaBusca = contrato => {
        if (!busca) return true
        const c = contratos.get(contrato) || {}
        return [contrato, c.cliente, c.cidade]
            .some(texto => String(texto || '').toLocaleLowerCase('pt-BR').includes(busca))
    }

    const contratoNaVisao = contrato => visao !== 'orcamento' || noPeriodo(contratos.get(contrato)?.mes_orcamento)

    const porContrato = new Map()
    const porMes = new Map(meses.map(m => [m, { custoRealizado: 0, custoPrevisto: 0, receita: 0, orcado: 0 }]))
    const porCategoria = new Map()

    const linhaContrato = contrato => {
        if (!porContrato.has(contrato)) {
            porContrato.set(contrato, {
                contrato,
                ...contratos.get(contrato),
                custoRealizado: 0,
                custoPrevisto: 0,
                receitaRealizada: 0,
                receitaPrevista: 0
            })
        }
        return porContrato.get(contrato)
    }

    for (const m of relatorioCC.movimentos) {
        if (empresa && m.app !== empresa) continue
        if (!previstos && m.situacao === 'PREVISTO') continue
        if (!combinaBusca(m.contrato) || !contratoNaVisao(m.contrato)) continue
        if (visao === 'vencimento' && !noPeriodo(m.mes)) continue

        const linha = linhaContrato(m.contrato)
        const realizado = m.situacao === 'REALIZADO'

        // Na visão por orçamento o eixo é o mês de referência do contrato.
        const mesEixo = visao === 'orcamento' ? linha.mes_orcamento : m.mes
        const mes = porMes.get(mesEixo)

        if (m.tipo === 'CUSTO') {
            linha[realizado ? 'custoRealizado' : 'custoPrevisto'] += m.valor
            if (mes) mes[realizado ? 'custoRealizado' : 'custoPrevisto'] += m.valor
            porCategoria.set(m.categoria, (porCategoria.get(m.categoria) || 0) + m.valor)
        } else {
            linha[realizado ? 'receitaRealizada' : 'receitaPrevista'] += m.valor
            if (mes) mes.receita += m.valor
        }
    }

    // Orçamentos do mês: contratos cuja estrutura aponta para o mês, independentemente de terem custo.
    for (const c of relatorioCC.contratos) {
        if (!noPeriodo(c.mes_orcamento) || !combinaBusca(c.contrato)) continue
        porMes.get(c.mes_orcamento).orcado += c.total_orcado
        if (visao === 'orcamento') linhaContrato(c.contrato)
    }

    const linhas = [...porContrato.values()].map(l => {
        const custoTotal = l.custoRealizado + l.custoPrevisto
        const orcado = Number(l.total_orcado) || 0
        return {
            ...l,
            orcado,
            custoTotal,
            receita: l.receitaRealizada + l.receitaPrevista,
            percentual: orcado ? custoTotal / orcado * 100 : NaN,
            saldo: orcado ? orcado - custoTotal : NaN
        }
    })

    return { meses, porMes, porCategoria, linhas }
}

function atualizarRelatorioCC() {

    if (!document.querySelector('.relatorio-cc')) return

    const filtros = filtrosRelatorioCC()
    const dados = agregarRelatorioCC(filtros)
    relatorioCC.linhas = dados.linhas

    renderIndicadoresCC(dados, filtros)
    renderGraficoMensalCC(dados)
    renderGraficoCategoriasCC(dados)
    renderGraficoContratosCC(dados)
    renderTabelaCC()
}

function renderIndicadoresCC({ linhas, porMes }, { visao }) {

    const soma = chave => linhas.reduce((total, l) => total + (Number(l[chave]) || 0), 0)

    const custoRealizado = soma('custoRealizado')
    const custoPrevisto = soma('custoPrevisto')
    const custoTotal = custoRealizado + custoPrevisto
    const receita = soma('receita')

    // Na visão por vencimento o orçado é o dos orçamentos do período; na outra, o dos contratos listados.
    const orcado = visao === 'orcamento'
        ? soma('orcado')
        : [...porMes.values()].reduce((total, m) => total + m.orcado, 0)

    const percentual = orcado ? custoTotal / orcado * 100 : NaN
    const alerta = percentual > LIMITE_CUSTO_ORCADO

    const indicador = (titulo, valor, detalhe = '', classe = '') => `
        <div class="relatorio-cc-indicador ${classe}">
            <span>${titulo}</span>
            <strong>${valor}</strong>
            ${detalhe ? `<small>${detalhe}</small>` : ''}
        </div>`

    document.querySelector('.relatorio-cc-indicadores').innerHTML = [
        indicador('Orçado', moedaCC(orcado), visao === 'orcamento' ? 'contratos do período' : 'orçamentos do período'),
        indicador('Custo realizado', moedaCC(custoRealizado), 'pago'),
        indicador('Custo previsto', moedaCC(custoPrevisto), 'a pagar'),
        indicador('Custo total', moedaCC(custoTotal)),
        indicador('Custo / Orçado', percentualCC(percentual), `alerta acima de ${LIMITE_CUSTO_ORCADO}%`, alerta ? 'alerta' : 'ok'),
        indicador('Receita', moedaCC(receita), 'recebimentos lançados'),
        indicador('Receita − Custo', moedaCC(receita - custoTotal), '', receita - custoTotal < 0 ? 'alerta' : 'ok')
    ].join('')
}

function graficoCC(seletor, configuracao) {
    const canvas = document.querySelector(seletor)
    if (!canvas || typeof Chart === 'undefined') return
    Chart.getChart(canvas)?.destroy()
    return new Chart(canvas, configuracao)
}

const coresCC = {
    realizado: '#356443',
    previsto: '#9cc5a7',
    orcado: '#24729d',
    receita: '#d97302',
    categorias: ['#356443', '#24729d', '#d97302', '#a63c3c', '#6b4c9a', '#2a9d8f', '#e9c46a', '#8d6e63', '#5c7cfa', '#b5838d', '#7a8b80']
}

const tooltipMoedaCC = {
    callbacks: {
        label: contexto => `${contexto.dataset.label || contexto.label}: ${moedaCC(contexto.raw)}`
    }
}

function renderGraficoMensalCC({ meses, porMes }) {

    const serie = chave => meses.map(m => porMes.get(m)[chave])

    graficoCC('#relatorio-cc-mensal', {
        data: {
            labels: meses.map(rotuloMesCC),
            datasets: [
                { type: 'bar', label: 'Custo realizado', data: serie('custoRealizado'), backgroundColor: coresCC.realizado, stack: 'custo', order: 2 },
                { type: 'bar', label: 'Custo previsto', data: serie('custoPrevisto'), backgroundColor: coresCC.previsto, stack: 'custo', order: 2 },
                { type: 'line', label: 'Orçado', data: serie('orcado'), borderColor: coresCC.orcado, backgroundColor: coresCC.orcado, tension: 0.25, order: 1 },
                { type: 'line', label: 'Receita', data: serie('receita'), borderColor: coresCC.receita, backgroundColor: coresCC.receita, borderDash: [6, 4], tension: 0.25, order: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: tooltipMoedaCC, legend: { position: 'bottom' } },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, ticks: { callback: moedaCurtaCC } }
            }
        }
    })
}

function renderGraficoCategoriasCC({ porCategoria }) {

    // Mantém as 10 maiores e agrupa o restante para o gráfico continuar legível.
    const ordenadas = [...porCategoria].sort((a, b) => b[1] - a[1])
    const principais = ordenadas.slice(0, 10)
    const outras = ordenadas.slice(10).reduce((total, [, valor]) => total + valor, 0)
    if (outras) principais.push(['Outras', outras])

    graficoCC('#relatorio-cc-categorias', {
        type: 'doughnut',
        plugins: typeof porcentagensRosca !== 'undefined' ? [porcentagensRosca] : [],
        data: {
            labels: principais.map(([categoria]) => categoria),
            datasets: [{ data: principais.map(([, valor]) => valor), backgroundColor: coresCC.categorias }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } },
                tooltip: { callbacks: { label: c => `${c.label}: ${moedaCC(c.parsed)}` } }
            }
        }
    })
}

function renderGraficoContratosCC({ linhas }) {

    const maiores = [...linhas]
        .filter(l => l.custoTotal > 0)
        .sort((a, b) => b.custoTotal - a.custoTotal)
        .slice(0, 10)

    graficoCC('#relatorio-cc-contratos', {
        type: 'bar',
        data: {
            labels: maiores.map(l => l.contrato),
            datasets: [
                { label: 'Custo total', data: maiores.map(l => l.custoTotal), backgroundColor: coresCC.realizado },
                { label: 'Orçado', data: maiores.map(l => l.orcado), backgroundColor: coresCC.orcado }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: tooltipMoedaCC, legend: { position: 'bottom' } },
            scales: { x: { beginAtZero: true, ticks: { callback: moedaCurtaCC } } },
            onClick: (_, elementos) => {
                const contrato = maiores[elementos[0]?.index]?.contrato
                if (contrato) painelCustos(contrato)
            }
        }
    })
}

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

function ordenarTabelaCC(chave) {
    const { ordenacao } = relatorioCC
    ordenacao.direcao = ordenacao.chave === chave ? -ordenacao.direcao : -1
    ordenacao.chave = chave
    renderTabelaCC()
}

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

function renderTabelaCC() {

    const { chave, direcao } = relatorioCC.ordenacao
    const comparar = (a, b) => {
        const va = a[chave], vb = b[chave]
        const vazioA = va == null || va === '' || Number.isNaN(va)
        const vazioB = vb == null || vb === '' || Number.isNaN(vb)
        if (vazioA || vazioB) return vazioA - vazioB
        return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')) * direcao
    }

    const linhas = [...relatorioCC.linhas].sort(comparar)
    const visiveis = linhas.slice(0, LIMITE_LINHAS_RELATORIO_CC)

    const ths = colunasTabelaCC
        .map(c => `
            <th onclick="ordenarTabelaCC('${c.chave}')" class="${c.tipo !== 'texto' && c.tipo !== 'mes' ? 'relatorio-cc-numero' : ''}">
                ${c.titulo}${c.chave === chave ? (direcao < 0 ? ' ▼' : ' ▲') : ''}
            </th>`)
        .join('')

    const trs = visiveis
        .map(l => `
            <tr>
                ${colunasTabelaCC.map(c => celulaCC(l, c)).join('')}
                <td style="text-align: center;">
                    <img src="imagens/pesquisar.svg" style="width: 1.5rem; cursor: pointer;" title="Painel de custos"
                        onclick="painelCustos(this.dataset.contrato)" data-contrato="${escaparAtributo(l.contrato)}">
                </td>
            </tr>`)
        .join('')

    document.querySelector('.relatorio-cc-contagem').textContent = linhas.length > visiveis.length
        ? `(${visiveis.length} de ${linhas.length}, refine os filtros)`
        : `(${linhas.length})`

    document.querySelector('.relatorio-cc-tabela').innerHTML = linhas.length
        ? `<table class="relatorio-cc-tab">
                <thead><tr>${ths}<th>Custos</th></tr></thead>
                <tbody>${trs}</tbody>
            </table>`
        : '<p class="relatorio-cc-vazio">Nenhum dado para os filtros escolhidos.</p>'
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

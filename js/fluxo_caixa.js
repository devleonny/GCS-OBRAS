// ---------------- Financeiro → Fluxo de Caixa (21/11/2026; período e empresas combináveis em 25/11/2026) ----------------
// Dados: POST financeiro/fluxo { apps, de, ate } (gcs SCRIPTS/financeiro_fluxo.js). A tela responde, nesta ordem:
//   temos caixa hoje? tivemos caixa no período (ficamos no vermelho algum dia)? teremos caixa (pelo que está lançado)?
//   e como fica o saldo dia a dia, mês a mês e semana a semana no período escolhido.
// Período: um mês (‹ mês ›) ou de/até livre (passado, futuro ou os dois). Empresas: caixinhas combináveis; todas
// marcadas = consolidado (os mútuos entre elas se anulam).
// Passado = extrato do banco (Conciliação bancária); contas sem extrato, pela conferência manual (Conferir saldos).
// Para frente = o que está lançado no GCS (faturas em aberto + reembolsos pedidos); "com previsões" soma a média do
// que costuma acontecer e ainda não foi lançado. O bloco "Daqui para frente" (livre para gastar, semana que vem,
// indicadores) é sempre a partir de hoje, qualquer que seja o período.
// Cores (dataviz): saldo azul; acima do zero fundo verde claro, abaixo vermelho claro (status); previsões violeta
// tracejado; reserva vermelho; um eixo por gráfico; zero marcado.

const CORES_CX = {
    entrada: '#2a78d6', entradaClara: '#9ec5f4',
    saida: '#eb6834', saidaClara: '#f6b899',
    saldo: '#2a78d6', previsao: '#6250d6', reserva: '#e34948',
    positivo: 'rgba(31, 122, 58, 0.12)', negativo: 'rgba(198, 40, 40, 0.20)',
    texto: '#52514e', grade: '#ecebe7', zero: '#52514e'
}
const estadoCx = { apps: null, modo: 'MES', mes: '', de: '', ate: '', empresas: [], dados: null, graficos: [] }
const MESES_CX = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS_CX = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const ROTULO_ATRASO_CX = { NAO: 'Não entram', 30: 'Só os de até 30 dias', TODOS: 'Todos' }
const ROTULO_TRAVA_CX = {
    DESLIGADA: 'Desligada: todos pedem pagamento normalmente',
    AUTOMATICA: 'Automática: trava sozinha quando o caixa previsto não comporta',
    LIGADA: 'Ligada: ninguém (fora os liberados) pede pagamento'
}

const diaCx = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : ''
const diaAnoCx = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''
const mesCx = ym => `${MESES_CX[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`
const mesLongoCx = ym => `${MESES_LONGOS_CX[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`
const semanaCx = iso => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${iso}T12:00:00Z`).getUTCDay()]
const somarDiasCx = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const segundaCx = iso => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const somarMesesCx = (ym, n) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7) }
const fimDoMesCx = ym => somarDiasCx(`${somarMesesCx(ym, 1)}-01`, -1)
const hojeCx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
// R$ curto para eixos e cartões pequenos: R$ 1,2 mi / R$ 350 mil / R$ 980.
function curtoCx(v) {
    const n = Number(v) || 0, a = Math.abs(n), s = n < 0 ? '−' : ''
    if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    if (a >= 1e4) return `${s}R$ ${Math.round(a / 1e3).toLocaleString('pt-BR')} mil`
    return `${s}R$ ${Math.round(a).toLocaleString('pt-BR')}`
}
const sinalCx = v => Number(v) < 0 ? 'cx-neg' : ''

// Saldo do dia: até ontem, o real (extrato); de hoje em diante, o lançado no GCS.
const saldoDiaCx = (x, hoje) => x.dia < hoje ? x.saldo ?? null : x.saldo_lancado ?? x.saldo ?? null
// Entrou/saiu do dia: real no passado; hoje = real + o que vence hoje; futuro = lançado.
function movDiaCx(x, hoje) {
    const real = { e: x.entradas || 0, s: x.saidas || 0 }
    const lanc = { e: x.entradas_previstas || 0, s: (x.saidas_previstas || 0) + (x.reembolsos || 0) }
    return x.dia < hoje ? real : x.dia === hoje ? { e: real.e + lanc.e, s: real.s + lanc.s } : lanc
}

function periodoCx() {
    if (estadoCx.modo === 'MES') return { de: `${estadoCx.mes}-01`, ate: fimDoMesCx(estadoCx.mes) }
    return { de: estadoCx.de, ate: estadoCx.ate }
}

async function telaFluxoCaixa() {
    if (typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()
    // Overlay desde o clique no menu: a consulta leva alguns segundos e a tela parecia travada.
    overlayAguarde()
    let op = { empresas: [] }
    try { op = await carregarOpcoesFin() } catch { }
    const hoje = hojeCx()
    if (!estadoCx.mes) estadoCx.mes = hoje.slice(0, 7)
    if (!estadoCx.de) estadoCx.de = `${somarMesesCx(hoje.slice(0, 7), -2)}-01`
    if (!estadoCx.ate) estadoCx.ate = fimDoMesCx(somarMesesCx(hoje.slice(0, 7), 2))
    estadoCx.empresas = (op.empresas || []).filter(e => e.tipo !== 'SOCIO').map(e => e.app).sort()
    tela.innerHTML = `
        <div class="fis-pagina cx-pagina">
            <header class="cx-topo">
                <div class="cx-topo-titulo">
                    <div>
                        <h2>Fluxo de Caixa</h2>
                        <small>Temos caixa? Tivemos? Vamos ter? Escolha as empresas e o período.</small>
                    </div>
                    <div class="cx-acoes" data-cx-acoes></div>
                </div>
                <div class="cx-filtros" data-cx-filtros></div>
            </header>
            <div data-cx-corpo><div class="cx-carregando">Calculando o fluxo…</div></div>
        </div>`
    desenharFiltrosCx()
    await carregarFluxoCaixa()
}

function desenharFiltrosCx() {
    const caixa = document.querySelector('[data-cx-filtros]')
    if (!caixa) return
    const marcadas = estadoCx.apps || estadoCx.empresas
    const hoje = hojeCx()
    const atalho = (rotulo, de, ate) => `<button type="button" class="cx-atalho ${estadoCx.de === de && estadoCx.ate === ate ? 'ativo' : ''}" onclick="estadoCx.de = '${de}'; estadoCx.ate = '${ate}'; desenharFiltrosCx(); carregarFluxoCaixa()">${rotulo}</button>`
    const mesAtual = hoje.slice(0, 7)
    caixa.innerHTML = `
        <div class="cx-filtro">
            <span class="cx-filtro-rotulo">Empresas</span>
            <div class="cx-chips" role="group" aria-label="Empresas">
                ${estadoCx.empresas.map(a => `
                    <button type="button" class="cx-chip ${marcadas.includes(a) ? 'ativo' : ''}" data-app="${escFin(a)}" aria-pressed="${marcadas.includes(a)}" onclick="mudarEmpresasCx(this)">${escFin(a)}</button>`).join('')}
                <button type="button" class="cx-atalho ${estadoCx.apps ? '' : 'ativo'}" onclick="estadoCx.apps = null; desenharFiltrosCx(); carregarFluxoCaixa()" title="Todas juntas: os empréstimos (mútuo) entre elas se anulam">Todas</button>
            </div>
        </div>
        <div class="cx-filtro">
            <span class="cx-filtro-rotulo">Período</span>
            <div class="cx-linha-filtro">
                <div class="cx-segmento" role="group" aria-label="Tipo de período">
                    <button type="button" aria-pressed="${estadoCx.modo === 'MES'}" class="${estadoCx.modo === 'MES' ? 'ativo' : ''}" onclick="estadoCx.modo = 'MES'; desenharFiltrosCx(); carregarFluxoCaixa()">Mês</button>
                    <button type="button" aria-pressed="${estadoCx.modo === 'PERIODO'}" class="${estadoCx.modo === 'PERIODO' ? 'ativo' : ''}" onclick="estadoCx.modo = 'PERIODO'; desenharFiltrosCx(); carregarFluxoCaixa()">De / até</button>
                </div>
                ${estadoCx.modo === 'MES' ? `
                    <div class="cx-mes-nav">
                        <button type="button" class="cx-seta" title="Mês anterior" onclick="estadoCx.mes = somarMesesCx(estadoCx.mes, -1); desenharFiltrosCx(); carregarFluxoCaixa()">‹</button>
                        <input type="month" value="${escFin(estadoCx.mes)}" onchange="if (this.value) { estadoCx.mes = this.value; desenharFiltrosCx(); carregarFluxoCaixa() }">
                        <button type="button" class="cx-seta" title="Próximo mês" onclick="estadoCx.mes = somarMesesCx(estadoCx.mes, 1); desenharFiltrosCx(); carregarFluxoCaixa()">›</button>
                        ${estadoCx.mes !== mesAtual ? `<button type="button" class="cx-atalho" onclick="estadoCx.mes = '${mesAtual}'; desenharFiltrosCx(); carregarFluxoCaixa()">Este mês</button>` : ''}
                    </div>` : `
                    <div class="cx-datas">
                        <label>de <input type="date" value="${escFin(estadoCx.de)}" onchange="if (this.value) { estadoCx.de = this.value; desenharFiltrosCx(); carregarFluxoCaixa() }"></label>
                        <label>até <input type="date" value="${escFin(estadoCx.ate)}" onchange="if (this.value) { estadoCx.ate = this.value; desenharFiltrosCx(); carregarFluxoCaixa() }"></label>
                    </div>
                    <div class="cx-atalhos">
                        ${atalho('Últimos 3 meses', `${somarMesesCx(mesAtual, -3)}-01`, hoje)}
                        ${atalho('Próximos 3 meses', hoje, fimDoMesCx(somarMesesCx(mesAtual, 2)))}
                        ${atalho('3 antes e 3 depois', `${somarMesesCx(mesAtual, -2)}-01`, fimDoMesCx(somarMesesCx(mesAtual, 2)))}
                        ${atalho(`Ano de ${hoje.slice(0, 4)}`, `${hoje.slice(0, 4)}-01-01`, `${hoje.slice(0, 4)}-12-31`)}
                    </div>`}
            </div>
        </div>`
}

// Botões de empresa (liga/desliga): todas ligadas = consolidado (null). Não deixa desligar a última.
let esperaEmpresasCx = null
function mudarEmpresasCx(botao) {
    const ligar = !botao.classList.contains('ativo')
    const ligadas = document.querySelectorAll('[data-cx-filtros] .cx-chip.ativo').length
    if (!ligar && ligadas <= 1) return
    botao.classList.toggle('ativo', ligar)
    botao.setAttribute('aria-pressed', ligar)
    const marcadas = [...document.querySelectorAll('[data-cx-filtros] .cx-chip.ativo')].map(b => b.dataset.app)
    estadoCx.apps = marcadas.length === estadoCx.empresas.length ? null : marcadas
    document.querySelector('[data-cx-filtros] .cx-chips > .cx-atalho')?.classList.toggle('ativo', !estadoCx.apps)
    clearTimeout(esperaEmpresasCx)
    esperaEmpresasCx = setTimeout(carregarFluxoCaixa, 450)
}

async function carregarFluxoCaixa() {
    const corpo = document.querySelector('[data-cx-corpo]')
    if (!corpo) return removerOverlay()
    corpo.classList.add('cx-atualizando')
    overlayAguarde()
    const { de, ate } = periodoCx()
    try {
        estadoCx.dados = await apiFin('fluxo', { apps: estadoCx.apps, de, ate })
        desenharFluxoCaixa()
    } catch (err) {
        corpo.innerHTML = `<div class="fis-vazio">Não deu para calcular o fluxo: ${mensagemErroEst(err)}
            <button type="button" class="fis-mini" onclick="carregarFluxoCaixa()">Tentar de novo</button></div>`
    } finally {
        corpo.classList.remove('cx-atualizando')
        removerOverlay()
    }
}

// Resumo do período a partir da série diária: dias passados (real) e daqui para frente (lançado).
function resumoPeriodoCx(d) {
    const hoje = d.hoje
    const serie = d.serie
    const valor = x => saldoDiaCx(x, hoje)
    const pior = lista => lista.reduce((m, x) => { const v = valor(x); return v !== null && (!m || v < m.valor) ? { valor: v, dia: x.dia } : m }, null)
    const passado = serie.filter(x => x.dia <= hoje)
    const futuro = serie.filter(x => x.dia >= hoje)
    const negPassado = passado.filter(x => x.dia < hoje && valor(x) !== null && valor(x) < 0)
    const negFuturo = futuro.filter(x => valor(x) !== null && valor(x) < 0)
    let entrou = 0, saiu = 0
    for (const x of serie) { const m = movDiaCx(x, hoje); entrou += m.e; saiu += m.s }
    const ultimo = serie[serie.length - 1]
    const previsaoMin = futuro.reduce((m, x) => x.saldo_previsao !== undefined && (!m || x.saldo_previsao < m.valor) ? { valor: x.saldo_previsao, dia: x.dia } : m, null)
    return {
        passado, futuro, negPassado, negFuturo, entrou, saiu,
        piorPassado: pior(passado.filter(x => x.dia < hoje).concat(passado.filter(x => x.dia === hoje).map(x => ({ ...x, saldo_lancado: x.saldo })))),
        piorFuturo: pior(futuro), previsaoMin,
        fim: ultimo ? { valor: valor(ultimo), dia: ultimo.dia } : null
    }
}

function desenharFluxoCaixa() {
    const d = estadoCx.dados
    const k = d.kpis
    const corpo = document.querySelector('[data-cx-corpo]')
    if (!corpo) return
    document.querySelector('[data-cx-acoes]').innerHTML = `
        ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="conferirSaldosCx()">Conferir saldos</button>' : ''}
        ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="planejamentoCx()">Planejamento e trava</button>' : ''}
        ${pode('financeiro.lote_salarios') ? '<button type="button" class="fis-mini" onclick="telaLotesSalarios()">Lote de salários</button>' : ''}`

    const r = resumoPeriodoCx(d)
    const { de, ate } = d.periodo
    const nomePeriodo = estadoCx.modo === 'MES' ? mesLongoCx(de.slice(0, 7)) : `${diaAnoCx(de)} a ${diaAnoCx(ate)}`
    const quem = d.apps ? d.apps.join(' + ') : 'todas as empresas'
    const meses = mesesCx(d)
    const semanas = semanasCx(d)
    const semSaldo = !d.tem_saldo

    corpo.innerHTML = `
        ${avisosCx(d)}
        <div class="cx-faixa-periodo"><b>${escFin(nomePeriodo)}</b> · ${escFin(quem)}</div>
        <section class="cx-respostas" aria-label="Respostas rápidas">
            ${respostaCx({
                titulo: 'Temos caixa hoje?', valor: semSaldo ? null : d.saldo_hoje,
                selo: semSaldo ? null : d.saldo_hoje >= 0 ? ['ok', 'Sim'] : ['perigo', 'No vermelho'],
                nota: semSaldo ? 'Nenhum extrato importado nem conta conferida ainda.' : notaSaldoCx(d)
            })}
            ${respostaCx({
                titulo: `Tivemos caixa? ${r.passado.length ? `(${diaCx(r.passado[0].dia)} a ${diaCx(r.passado[r.passado.length - 1].dia)})` : ''}`,
                valor: !r.passado.length || semSaldo || !r.piorPassado ? null : r.piorPassado.valor, rotuloValor: 'menor saldo',
                selo: !r.passado.length || semSaldo ? null : r.negPassado.length ? ['perigo', `${r.negPassado.length} ${r.negPassado.length === 1 ? 'dia' : 'dias'} no vermelho`] : ['ok', 'Sempre positivo'],
                nota: !r.passado.length ? 'O período escolhido ainda não começou.'
                    : semSaldo ? 'Sem saldo de partida.'
                    : r.negPassado.length ? `Pior dia: ${diaCx(r.piorPassado.dia)} (${semanaCx(r.piorPassado.dia)}). Primeiro dia no vermelho: ${diaCx(r.negPassado[0].dia)}.`
                    : `Menor saldo em ${diaCx(r.piorPassado.dia)} (${semanaCx(r.piorPassado.dia)}).`
            })}
            ${respostaCx({
                titulo: `Teremos caixa? ${r.futuro.length ? `(até ${diaCx(r.futuro[r.futuro.length - 1].dia)})` : ''}`,
                valor: !r.futuro.length || semSaldo || !r.piorFuturo ? null : r.piorFuturo.valor, rotuloValor: 'menor saldo previsto',
                selo: !r.futuro.length || semSaldo ? null : r.negFuturo.length ? ['perigo', `Vermelho a partir de ${diaCx(r.negFuturo[0].dia)}`] : ['ok', 'Positivo no período'],
                nota: !r.futuro.length ? 'O período escolhido já passou.'
                    : semSaldo ? 'Sem saldo de partida.'
                    : `Pelo que está lançado, o pior dia é ${diaCx(r.piorFuturo.dia)} (${semanaCx(r.piorFuturo.dia)}).${r.previsaoMin && Math.abs(r.previsaoMin.valor - r.piorFuturo.valor) > 1 ? ` Somando as previsões pela média: ${dinheiro(r.previsaoMin.valor)}.` : ''}`
            })}
            ${respostaCx({
                titulo: `Saldo no fim (${r.fim ? diaCx(r.fim.dia) : '—'})`, valor: semSaldo || !r.fim ? null : r.fim.valor,
                nota: `No período: entrou ${dinheiro(r.entrou)} e saiu ${dinheiro(r.saiu)} (${r.entrou - r.saiu >= 0 ? 'sobrou' : 'faltou'} ${dinheiro(Math.abs(r.entrou - r.saiu))}).`
            })}
        </section>

        ${blocoInvestimentosCx(d, semSaldo)}

        <section class="cx-bloco">
            <div class="cx-bloco-topo">
                <h3>Saldo dia a dia</h3>
                <small>Acima do zero (verde): com caixa. Abaixo (vermelho): no vermelho. Linha cheia: o que aconteceu (extrato). Tracejada: o que está lançado no GCS.${r.futuro.length ? ' Roxa: somando as previsões pela média.' : ''}${k.reserva ? ' Vermelha fina: reserva mínima.' : ''}</small>
            </div>
            <div class="cx-grafico cx-grafico-alto"><canvas data-cx-saldo aria-label="Saldo diário no período" role="img"></canvas></div>
        </section>

        ${meses.length > 1 || estadoCx.modo === 'PERIODO' ? `
        <section class="cx-bloco">
            <div class="cx-bloco-topo"><h3>Mês a mês</h3><small>Clique num mês para abrir só ele. Entrou/saiu não contam transferências entre contas, resgates e aplicações nem mútuo entre as empresas: por isso o saldo pode variar diferente do resultado.</small></div>
            ${tabelaMesesCx(meses, k.reserva)}
        </section>` : ''}

        ${semanas.length ? `
        <section class="cx-bloco">
            <div class="cx-bloco-topo"><h3>Semana a semana</h3><small>De segunda a domingo, dentro do período (até uns 2 meses).</small></div>
            ${tabelaSemanasCx(semanas, k.reserva)}
        </section>` : ''}

        <section class="cx-bloco" data-cx-entre>
            <div class="cx-bloco-topo"><h3>Entre empresas</h3><small>Dinheiro de uma empresa usado pela outra: conta paga pela conta da outra, recebimento que caiu na conta da outra e transferências entre elas (pelo extrato). Clique numa linha para ver um por um.</small></div>
            <div data-cx-entre-corpo><div class="cx-carregando">Calculando…</div></div>
        </section>

        <section class="cx-bloco cx-daqui">
            <div class="cx-bloco-topo"><h3>Daqui para frente</h3><small>Sempre a partir de hoje, para planejar (não muda com o período).</small></div>
            <div class="cx-respostas">
                ${cartaoCx({
                    titulo: `Livre para gastar nos próximos ${k.horizonte} dias`, valor: d.tem_saldo ? k.livre : null, destaque: true,
                    nota: !d.tem_saldo ? 'Precisa do saldo das contas conferido com o extrato para calcular.' : k.livre > 0
                        ? `Menor saldo previsto: ${dinheiro(k.menor_horizonte.valor)} em ${diaCx(k.menor_horizonte.dia)}${k.reserva ? `, menos a reserva de ${dinheiro(k.reserva)}` : ''}.`
                        : `Sem folga: no dia ${diaCx(k.menor_horizonte.dia)} o saldo previsto fica em ${dinheiro(k.menor_horizonte.valor)}${k.reserva ? ` (reserva: ${dinheiro(k.reserva)})` : ''}.`
                })}
                ${cartaoCx({
                    titulo: 'Dá para gastar por dia útil', valor: d.tem_saldo ? k.por_dia : null,
                    nota: !d.tem_saldo ? 'Idem: depende do saldo de partida.' : k.por_dia > 0 ? `${dinheiro(k.por_semana)} por semana · ${k.dias_uteis} dias úteis no período` : 'Novos gastos só com nova entrada ou adiando contas.'
                })}
                ${cartaoCx({
                    titulo: `Semana que vem (${diaCx(k.proxima_semana.de)} a ${diaCx(k.proxima_semana.ate)})`, valor: k.proxima_semana.saldo_fim,
                    nota: `Entra ${dinheiro(k.proxima_semana.entradas)} · sai ${dinheiro(k.proxima_semana.saidas)}${k.proxima_semana.saidas_provaveis ? ` · mais ${dinheiro(k.proxima_semana.saidas_provaveis)} previstos` : ''}`
                })}
            </div>
            <div class="cx-indicadores">
                ${miniCx('Gasto médio por dia (30 dias)', dinheiro(k.gasto_dia_30), comparacaoCx(k.gasto_dia_30, k.gasto_dia_90, 'que a média de 90 dias', true))}
                ${miniCx('Entrada média por dia (90 dias)', dinheiro(k.entrada_dia_90), k.gasto_dia_90 ? `${k.entrada_dia_90 >= k.gasto_dia_90 ? 'Acima' : 'Abaixo'} do gasto médio (${dinheiro(k.gasto_dia_90)})` : '')}
                ${miniCx('Cobertura dos próximos 30 dias', k.cobertura_30 === null ? '—' : `${k.cobertura_30.toLocaleString('pt-BR')}×`, `Entra ${dinheiro(k.entradas_30)} para ${dinheiro(k.saidas_30)} lançados`, k.cobertura_30 !== null && k.cobertura_30 < 1)}
                ${miniCx('A receber em atraso', dinheiro(d.atrasados.RECEBER.valor), `${d.atrasados.RECEBER.n} faturas · ${d.atrasados.RECEBER.incluido ? `${dinheiro(d.atrasados.RECEBER.incluido)} contados hoje` : 'fora do saldo previsto'}`, d.atrasados.RECEBER.valor > 0)}
                ${miniCx('A pagar em atraso', dinheiro(d.atrasados.PAGAR.valor), `${d.atrasados.PAGAR.n} faturas · ${dinheiro(d.atrasados.PAGAR.incluido)} contados hoje`, d.atrasados.PAGAR.valor > 0)}
                ${miniCx('Reembolsos esperando aprovação', dinheiro(d.reembolsos_pendentes), 'Já entram no saldo lançado')}
            </div>
        </section>

        <div class="cx-duas">
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Maiores contas a pagar (14 dias)</h3></div>
                ${listaProximosCx(d.proximos.filter(p => p.tipo === 'PAGAR'))}
            </section>
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Maiores entradas esperadas (14 dias)</h3></div>
                ${listaProximosCx(d.proximos.filter(p => p.tipo === 'RECEBER'))}
            </section>
        </div>

        <div class="cx-duas">
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Para onde vai o dinheiro (30 dias)</h3><small>Faturas a pagar já lançadas, por categoria.</small></div>
                ${barrasCategoriasCx(d.categorias_30.filter(c => c.tipo === 'PAGAR'))}
            </section>
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Contas em atraso</h3><small>Pelo tempo de atraso. Atraso antigo costuma ser fatura paga sem baixa.</small></div>
                ${tabelaAtrasosCx(d.atrasados)}
            </section>
        </div>

        <section class="cx-bloco">
            <details>
                <summary><b>Previsões pela média</b> — ${d.provaveis.length} itens que costumam acontecer todo mês e ainda não foram lançados</summary>
                ${tabelaProvaveisCx(d.provaveis)}
            </details>
        </section>

        <section class="cx-bloco cx-explica">
            <details>
                <summary><b>Como ler este painel</b></summary>
                <ul>
                    <li><b>Empresas</b>: marque uma ou várias. Todas marcadas = o grupo inteiro: os empréstimos (mútuo) e transferências entre as empresas mexem no saldo de cada uma, mas não contam como entrada nem saída.</li>
                    <li><b>Período</b>: um mês (setas ‹ ›) ou de/até livre. Pode ser só passado, só futuro ou os dois. O bloco <b>Daqui para frente</b> é sempre a partir de hoje.</li>
                    <li><b>O que já aconteceu vem do banco</b>: nas contas com extrato importado na Conciliação bancária, o saldo é o do banco e as entradas e saídas são as linhas do extrato.${d.extrato_desde ? ` Há extrato desde ${diaAnoCx(d.extrato_desde)}; antes disso o saldo é estimado pelas baixas do GCS.` : ''}</li>
                    <li><b>Contas sem extrato</b>: entram pelo saldo conferido à mão (botão Conferir saldos) mais as baixas do GCS. Sem conferência ficam fora para não distorcer.</li>
                    <li><b>O que vem pela frente vem do GCS</b>: tudo que está nas faturas a pagar e a receber, no dia do vencimento, mais os reembolsos pedidos que esperam aprovação. Fatura em aberto que já aparece no extrato com o mesmo valor fica fora, para não contar duas vezes.</li>
                    <li><b>Com previsões</b> (linha roxa): soma o que acontece todo mês (categoria presente em 3 dos 4 últimos meses) e ainda falta lançar, pela média dos 3 últimos meses.</li>
                    <li><b>Livre para gastar</b>: o menor saldo dos próximos dias, pelo pior das duas linhas, menos a reserva mínima.</li>
                    <li><b>Atrasados</b>: hoje ${escFin(ROTULO_ATRASO_CX[d.plan.atrasados_pagar].toLowerCase())} os a pagar e ${escFin(ROTULO_ATRASO_CX[d.plan.atrasados_receber].toLowerCase())} os a receber (entram como se fossem pagos hoje). Muda em Planejamento e trava.</li>
                    <li><b>Trava</b>: com a trava ligada ou automática sem folga, o servidor recusa novos pedidos em Reembolsos → Solicitar Pagamento (menos para quem estiver liberado na Central de acessos).</li>
                </ul>
            </details>
        </section>`

    estadoCx.graficos.forEach(g => g?.destroy())
    estadoCx.graficos = [graficoSaldoCx(d)]
    carregarEntreEmpresasCx()
}

// ---------------- investimentos (26/11/2026; gcs migrations/financeiro-aplicacoes.sql, financeiro_fluxo.js → investimentos)
// Conta tipo Aplicação (CDB Itaú · IAC): aplicações e resgates entram pela conciliação (Transferência); a posição que
// o banco mostra, informada de tempos em tempos, lança a diferença como rendimento do período.

function blocoInvestimentosCx(d, semSaldo) {
    const inv = d.investimentos
    if (!inv || !inv.contas.length) return ''
    const rend = inv.contas.reduce((a, c) => a + Number(c.rendimento || 0), 0)
    const desde = inv.contas.map(c => c.rendimento_desde).filter(Boolean).sort()[0]
    return `
        <section class="cx-bloco">
            <div class="cx-bloco-topo">
                <h3>Investimentos</h3>
                <small>Fora do "Temos caixa hoje?". Aplicações e resgates entram pela conciliação bancária (Transferência → conta do investimento); a posição que o banco mostra lança o rendimento do período.</small>
                <span class="cx-inv-acoes">
                    ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="posicaoInvestimentoCx()">Informar posição</button>' : ''}
                    <button type="button" class="fis-mini" onclick="historicoInvestimentosCx()">Histórico</button>
                </span>
            </div>
            <div class="cx-indicadores">
                ${inv.contas.map(c => miniCx(c.nome, dinheiro(c.saldo),
                    `Última posição: ${c.posicao_data ? `${dinheiro(c.posicao_saldo)} em ${diaAnoCx(c.posicao_data)}` : '—'} · no ano: aplicou ${dinheiro(c.aplicado_ano)}, resgatou ${dinheiro(c.resgatado_ano)}`)).join('')}
                ${miniCx('Rendimento lançado', dinheiro(rend), desde ? `Pelas posições informadas desde ${diaAnoCx(desde)} (líquido do IR)` : '')}
                ${miniCx('Caixa + investimentos', semSaldo ? '—' : dinheiro(Math.round((d.saldo_hoje + inv.total) * 100) / 100),
                    semSaldo ? 'Sem saldo de caixa de partida.' : `${dinheiro(d.saldo_hoje)} em caixa + ${dinheiro(inv.total)} aplicados`)}
            </div>
        </section>`
}

function posicaoInvestimentoCx() {
    const d = estadoCx.dados
    popup({
        titulo: 'Informar posição do investimento',
        confirmarFechar: false,
        linhas: [{ elemento: `
            <div class="fis-form" data-cx-posicao>
                <p class="cx-plan-nota">Digite o <b>saldo bruto</b> que o app do banco mostra na data. A diferença para o saldo do GCS
                    (posição anterior + aplicações − resgates lançados na conciliação) vira o rendimento do período.
                    Antes, importe o extrato e lance as aplicações e os resgates até essa data.</p>
                <label>Conta <select class="fis-input" name="conta">${d.investimentos.contas.map(c => `<option value="${c.id}">${escFin(c.nome)} (GCS: ${dinheiro(c.saldo)})</option>`).join('')}</select></label>
                <label>Data da posição <input class="fis-input" type="date" name="data" value="${d.hoje}" max="${d.hoje}"></label>
                <label>Saldo no banco <input class="fis-input fis-num" type="number" step="0.01" min="0" name="saldo"></label>
            </div>` }],
        botoes: [{ texto: 'Salvar posição', img: 'salvo', funcao: 'salvarPosicaoInvestimentoCx(this)' }]
    })
}

async function salvarPosicaoInvestimentoCx(botao) {
    const f = document.querySelector('[data-cx-posicao]')
    const saldo = f.querySelector('[name="saldo"]').value
    if (saldo === '') return popup({ mensagem: 'Digite o saldo que o banco mostra.' })
    try {
        overlayAguarde()
        const r = await apiFin('aplicacoes/posicao', { conta_id: Number(f.querySelector('[name="conta"]').value), data: f.querySelector('[name="data"]').value, saldo: Number(saldo) })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        await carregarFluxoCaixa()
        popup({ mensagem: r.rendimento > 0 ? `Rendimento do período: ${dinheiro(r.rendimento)}` : 'Posição igual ao saldo do GCS: nenhum rendimento lançado.' })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function historicoInvestimentosCx() {
    const inv = estadoCx.dados.investimentos
    const nome = new Map(inv.contas.map(c => [Number(c.id), c.nome]))
    const ultima = new Map()
    for (const p of inv.posicoes) if (!ultima.has(Number(p.conta_id))) ultima.set(Number(p.conta_id), Number(p.id))
    popup({
        titulo: 'Posições dos investimentos',
        linhas: [{ elemento: `
            <div class="fis-tabela-rolagem">
                <table class="fis-tabela">
                    <thead><tr><th>Data</th><th>Conta</th><th class="fis-num">Saldo no banco</th><th class="fis-num">GCS antes</th><th class="fis-num">Rendimento</th><th>Por</th><th></th></tr></thead>
                    <tbody>${inv.posicoes.map(p => `
                        <tr>
                            <td>${escFin(dataFin(p.data))}</td>
                            <td>${escFin(nome.get(Number(p.conta_id)) || '')}</td>
                            <td class="fis-num">${dinheiro(p.saldo)}</td>
                            <td class="fis-num">${p.saldo_gcs === null ? '—' : dinheiro(p.saldo_gcs)}</td>
                            <td class="fis-num">${p.rendimento === null ? '<small>abertura</small>' : dinheiro(p.rendimento)}</td>
                            <td><small>${escFin(p.criado_por || '')}</small></td>
                            <td>${estadoCx.dados.pode_planejar && p.rendimento !== null && ultima.get(Number(p.conta_id)) === Number(p.id)
                                ? `<button type="button" class="fis-mini" onclick="desfazerPosicaoCx(${p.id}, this)">desfazer</button>` : ''}</td>
                        </tr>${p.observacao ? `<tr><td></td><td colspan="6"><small>${escFin(p.observacao)}</small></td></tr>` : ''}`).join('')}
                    </tbody>
                </table>
            </div>` }]
    })
}

async function desfazerPosicaoCx(id, botao) {
    if (!await confirmarPopup({ titulo: 'Desfazer posição', mensagem: 'O rendimento lançado por esta posição é cancelado e a posição sai do histórico. Continuar?', textoConfirmar: 'Desfazer' })) return
    try {
        overlayAguarde()
        await apiFin('aplicacoes/posicao/desfazer', { id })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        await carregarFluxoCaixa()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------- entre empresas (26/11/2026; gcs SCRIPTS/financeiro_fluxo.js → entreEmpresas)
// Movimentos por dia desde 01/01/2026 (primeiro extrato): credor = de quem era o dinheiro, devedor = quem usou.
// No período: quanto foi de uma para a outra. Saldo: acumulado desde o início até o fim do período (ou hoje).

const NATUREZAS_CX = {
    pagou: (c, d) => `${c} pagou conta da ${d}`,
    recebeu: (c, d) => `Recebimento da ${c} caiu na ${d}`,
    transferiu: (c, d) => `${c} transferiu para a ${d}`
}

async function carregarEntreEmpresasCx() {
    const caixa = document.querySelector('[data-cx-entre-corpo]')
    if (!caixa) return
    const { ate } = periodoCx()
    try {
        estadoCx.entre = await apiFin('fluxo/entre-empresas', { ate })
        desenharEntreEmpresasCx()
    } catch (err) {
        caixa.innerHTML = `<div class="fis-vazio">Não deu para calcular: ${escFin(mensagemErroEst(err))}</div>`
    }
}

// Pares de empresas (A × B) com o que foi de uma para a outra no período e o saldo acumulado.
function paresEntreEmpresasCx() {
    const e = estadoCx.entre
    const { de, ate } = periodoCx()
    const fim = e.ate < ate ? e.ate : ate
    const apps = e.empresas.map(x => x.app)
    const marcadas = estadoCx.apps
    const pares = []
    for (let i = 0; i < apps.length; i++) for (let j = i + 1; j < apps.length; j++) {
        const a = apps[i], b = apps[j]
        if (marcadas && !marcadas.includes(a) && !marcadas.includes(b)) continue
        const p = { a, b, ab: 0, ba: 0, abNat: {}, baNat: {}, saldo: 0 }
        for (const m of e.movimentos) {
            const ida = m.credor === a && m.devedor === b, volta = m.credor === b && m.devedor === a
            if (!ida && !volta) continue
            if (m.dia <= fim) p.saldo += ida ? m.valor : -m.valor
            if (m.dia < de || m.dia > ate) continue
            const nat = ida ? p.abNat : p.baNat
            nat[m.natureza] = (nat[m.natureza] || 0) + m.valor
            if (ida) p.ab += m.valor; else p.ba += m.valor
        }
        p.saldo = r2Fin(p.saldo)
        if (p.ab || p.ba || Math.abs(p.saldo) >= 0.01) pares.push(p)
    }
    return { pares: pares.sort((x, y) => Math.abs(y.saldo) - Math.abs(x.saldo)), fim }
}

// Saldo > 0 = dinheiro da A ficou com a B: "B deve à A".
const textoSaldoEntreCx = p => Math.abs(p.saldo) < 0.01 ? 'Quites'
    : p.saldo > 0 ? `<b>${escFin(p.b)}</b> deve à <b>${escFin(p.a)}</b>` : `<b>${escFin(p.a)}</b> deve à <b>${escFin(p.b)}</b>`

const detalheNatCx = nat => ['pagou', 'transferiu', 'recebeu'].filter(k => nat[k])
    .map(k => `${k === 'pagou' ? 'contas' : k === 'transferiu' ? 'transf.' : 'receb.'} ${dinheiro(nat[k])}`).join(' · ')

function desenharEntreEmpresasCx() {
    const caixa = document.querySelector('[data-cx-entre-corpo]')
    if (!caixa || !estadoCx.entre) return
    const { pares, fim } = paresEntreEmpresasCx()
    if (!pares.length) { caixa.innerHTML = '<div class="fis-vazio">Nenhuma empresa usou dinheiro da outra neste período.</div>'; return }
    caixa.innerHTML = `
        <div class="fis-tabela-rolagem">
            <table class="fis-tabela cx-entre">
                <thead><tr><th>Empresas</th><th class="fis-num">Da 1ª para a 2ª no período</th><th class="fis-num">Da 2ª para a 1ª no período</th>
                    <th class="fis-num" title="Desde ${diaAnoCx(estadoCx.entre.inicio)} (primeiro extrato) até ${diaAnoCx(fim)}">Saldo até ${diaCx(fim)}</th><th>Quem deve</th></tr></thead>
                <tbody>${pares.map(p => `
                    <tr class="cx-linha-clicavel" onclick="itensEntreEmpresasCx('${escFin(p.a)}', '${escFin(p.b)}')" title="Ver um por um">
                        <td><b>${escFin(p.a)}</b> × <b>${escFin(p.b)}</b></td>
                        <td class="fis-num">${p.ab ? `${dinheiro(p.ab)}<small class="cx-entre-nat">${detalheNatCx(p.abNat)}</small>` : '—'}</td>
                        <td class="fis-num">${p.ba ? `${dinheiro(p.ba)}<small class="cx-entre-nat">${detalheNatCx(p.baNat)}</small>` : '—'}</td>
                        <td class="fis-num"><b>${dinheiro(Math.abs(p.saldo))}</b></td>
                        <td>${textoSaldoEntreCx(p)}</td>
                    </tr>`).join('')}</tbody>
            </table>
        </div>
        <p class="cx-entre-nota">Saldo acumulado desde ${diaAnoCx(estadoCx.entre.inicio)} (primeiro extrato), sem saldo de abertura. Ficam fora: sócios (ALEX e COSTA são retirada), cartões e contas sem extrato (Caixa Econômica). Transferência casada na conciliação com uma venda ou compra de verdade conta como negócio, não como empréstimo.</p>`
}

async function itensEntreEmpresasCx(a, b) {
    const { de, ate } = periodoCx()
    const par = paresEntreEmpresasCx().pares.find(p => p.a === a && p.b === b) || { a, b, ab: 0, ba: 0, saldo: 0 }
    overlayAguarde()
    let itens
    try { ({ itens } = await apiFin('fluxo/entre-empresas/itens', { credor: a, devedor: b, de, ate })) } catch (err) { removerOverlay(); return popup({ mensagem: mensagemErroEst(err) }) }
    removerOverlay()
    const ida = itens.filter(i => i.credor === a)
    const linha = i => {
        const oQue = NATUREZAS_CX[i.natureza](i.credor, i.devedor)
        const quem = i.participante || i.descricao || '—'
        const busca = [oQue, i.participante, i.descricao, i.conta].join(' ').toLowerCase()
        return `
            <tr data-tipo="${i.credor === a ? 'E' : 'S'}" data-busca="${escFin(busca)}">
                <td class="fin-extrato-data">${dataFin(i.data)}</td>
                <td>${escFin(oQue)}</td>
                <td class="fin-extrato-quem">
                    ${i.titulo_id ? `<span class="fis-link" onclick="abrirFaturaFin('${escFin(i.titulo_id)}')" title="${escFin(quem)}">${escFin(quem)}</span>` : `<span title="${escFin(quem)}">${escFin(quem)}</span>`}
                    ${i.participante && i.descricao ? `<small title="${escFin(i.descricao)}">${escFin(i.descricao)}</small>` : ''}
                </td>
                <td class="fin-extrato-cat" title="${escFin(i.conta || '')}">${escFin(i.conta || '—')}</td>
                <td class="fis-num"><b>${dinheiro(i.valor)}</b></td>
            </tr>`
    }
    popup({
        titulo: `${a} × ${b} · ${diaAnoCx(de)} a ${diaAnoCx(ate)}`,
        elemento: `
            <div class="fis-painel popup-consulta cx-entre-popup">
                ${resumoDocumentoFis({}, [
                    ['Saldo acumulado', `${dinheiro(Math.abs(par.saldo))} <small>${textoSaldoEntreCx(par).replace(/<[^>]+>/g, '')}</small>`],
                    [`Da ${escFin(a)} para a ${escFin(b)}`, dinheiro(par.ab)], [`Da ${escFin(b)} para a ${escFin(a)}`, dinheiro(par.ba)],
                    ['Lançamentos no período', String(itens.length)]
                ])}
                <div class="fin-extrato-barra">
                    <input type="search" class="fis-input fin-extrato-busca" placeholder="Buscar favorecido, descrição, conta..." oninput="filtrarExtratoFin(this)">
                    <div class="fin-extrato-chips" data-tipo="">
                        <button type="button" class="ativo" data-filtro="" onclick="filtrarExtratoFin(this)">Todos <small>${itens.length}</small></button>
                        <button type="button" data-filtro="E" onclick="filtrarExtratoFin(this)">${escFin(a)} → ${escFin(b)} <small>${ida.length}</small></button>
                        <button type="button" data-filtro="S" onclick="filtrarExtratoFin(this)">${escFin(b)} → ${escFin(a)} <small>${itens.length - ida.length}</small></button>
                    </div>
                </div>
                ${itens.length ? `
                <div class="fis-tabela-rolagem fin-extrato-rolagem">
                    <table class="fis-tabela fin-extrato">
                        <thead><tr><th>Data</th><th>O quê</th><th>Favorecido / descrição</th><th>Conta</th><th class="fis-num">Valor</th></tr></thead>
                        <tbody>${itens.map(linha).join('')}</tbody>
                    </table>
                </div>` : '<div class="fis-vazio">Nada entre as duas neste período.</div>'}
            </div>`
    })
}

// ---------------- pedaços

function avisosCx(d) {
    const k = d.kpis
    const avisos = []
    const conciliar = typeof telaConciliacaoFin === 'function' && pode('financeiro.conciliacao')
        ? '<button type="button" class="fis-mini" onclick="telaConciliacaoFin()">Conciliação bancária</button>' : ''
    if (!d.tem_saldo) avisos.push(['alerta', `O saldo de partida está em R$ 0: nenhum extrato importado na Conciliação bancária e nenhuma conta conferida. As linhas mostram só a variação do caixa.
        ${conciliar} ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="conferirSaldosCx()">Conferir saldos agora</button>' : ''}`])
    else {
        const faltam = d.contas.filter(c => !c.extrato && !c.conferida && !c.fora && Math.abs(Number(c.saldo)) > 0.009)
        if (faltam.length) avisos.push(['info', `${faltam.length} conta(s) com movimento sem extrato importado nem conferência ficaram fora do saldo.
            ${conciliar} ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="conferirSaldosCx()">Conferir</button>' : ''}`])
    }
    if (d.extrato_desde && d.periodo.de < d.extrato_desde)
        avisos.push(['info', `Antes de ${diaAnoCx(d.extrato_desde)} não há extrato importado: o saldo desses dias é estimado pelas baixas do GCS e pode não bater com o banco.`])
    for (const b of (d.bancos || []).filter(b => !b.fora && b.dias_sem_extrato > 3))
        avisos.push(['alerta', `O extrato de <b>${escFin(b.nome)}</b> vai só até ${diaCx(b.fim)} (${b.dias_sem_extrato} dias). Depois disso o saldo soma o que foi registrado no GCS. ${conciliar}`])
    const ja = d.ja_no_extrato
    if (ja && (ja.PAGAR.n || ja.RECEBER.n)) avisos.push(['info', `${[
        ja.RECEBER.n ? `${ja.RECEBER.n} fatura(s) a receber <b>${dinheiroTexto(ja.RECEBER.valor)}</b>` : '',
        ja.PAGAR.n ? `${ja.PAGAR.n} a pagar <b>${dinheiroTexto(ja.PAGAR.valor)}</b>` : ''].filter(Boolean).join(' e ')}
        já aparecem no extrato com o mesmo valor, mas sem baixa no GCS: ficaram fora da previsão para não contar duas vezes. Concilie para dar a baixa. ${conciliar}`])
    if (d.tem_saldo && k.negativo_em) avisos.push(['perigo', `<b>Caixa negativo em ${diaCx(k.negativo_em)} (${semanaCx(k.negativo_em)})</b> pelo que já está lançado.`])
    else if (d.tem_saldo && k.abaixo_reserva_em && k.reserva) avisos.push(['alerta', `<b>Abaixo da reserva em ${diaCx(k.abaixo_reserva_em)}</b> (${semanaCx(k.abaixo_reserva_em)}).`])
    const t = d.trava
    if (t && t.modo !== 'DESLIGADA')
        avisos.push([t.travado ? 'perigo' : 'info', t.travado
            ? `<b>Pedidos de pagamento travados</b> (${t.motivo === 'LIGADA' ? 'trava ligada' : `caixa sem folga nos próximos ${t.dias} dias`}).`
            : t.sem_saldo ? 'Trava automática ligada, mas sem efeito: ela só funciona depois que pelo menos uma conta tiver o saldo conferido com o extrato.'
            : t.modo === 'AUTOMATICA' ? `Trava automática ativa: hoje os pedidos estão liberados (folga de ${dinheiro(t.livre)} nos próximos ${t.dias} dias).` : ''])
    if (t?.teto_semanal > 0) {
        const s = d.pedidos_semana
        avisos.push([s.valor >= t.teto_semanal ? 'perigo' : 'info',
            `Teto semanal de pedidos: ${dinheiro(s.valor)} de ${dinheiro(t.teto_semanal)} usados desde ${diaCx(s.de)} (${s.n} pedidos).`])
    }
    return avisos.length ? `<div class="cx-avisos">${avisos.map(([tipo, html]) => `<div class="cx-aviso cx-aviso-${tipo}" role="${tipo === 'perigo' ? 'alert' : 'status'}">${html}</div>`).join('')}</div>` : ''
}

// "2 bancos pelo extrato (até 25/11) + 1 conta conferida à mão".
function notaSaldoCx(d) {
    const bancos = (d.bancos || []).filter(b => !b.fora)
    const manuais = d.contas.filter(c => c.no_saldo).length
    const partes = []
    if (bancos.length) partes.push(`${bancos.length} ${bancos.length > 1 ? 'bancos' : 'banco'} pelo extrato (até ${diaCx(bancos.map(b => b.fim).sort()[0])})`)
    if (manuais) partes.push(`${manuais} ${manuais > 1 ? 'contas conferidas' : 'conta conferida'} à mão`)
    return partes.join(' + ')
}

// Cartão de resposta: pergunta, valor grande, selo de situação (ícone + texto, nunca só cor) e a explicação.
function respostaCx({ titulo, valor, selo = null, nota = '', rotuloValor = '' }) {
    return `
        <article class="cx-cartao cx-resposta ${selo ? `cx-resposta-${selo[0]}` : ''}">
            <span class="cx-cartao-titulo">${escFin(titulo)}</span>
            ${selo ? `<span class="cx-selo cx-selo-${selo[0]}">${selo[0] === 'ok' ? '●' : '▲'} ${escFin(selo[1])}</span>` : ''}
            <b class="cx-cartao-valor ${sinalCx(valor)}">${valor === null ? '—' : dinheiro(valor)}${rotuloValor && valor !== null ? ` <small>${escFin(rotuloValor)}</small>` : ''}</b>
            <small>${nota}</small>
        </article>`
}

function cartaoCx({ titulo, valor, nota = '', destaque = false }) {
    return `
        <article class="cx-cartao ${destaque ? 'cx-cartao-destaque' : ''}">
            <span class="cx-cartao-titulo">${escFin(titulo)}</span>
            <b class="cx-cartao-valor ${sinalCx(valor)}">${valor === null ? "—" : dinheiro(valor)}</b>
            <small>${nota}</small>
        </article>`
}

const miniCx = (titulo, valor, nota = '', atencao = false) => `
    <div class="cx-mini ${atencao ? 'cx-mini-atencao' : ''}">
        <span>${escFin(titulo)}</span><b>${valor}</b>${nota ? `<small>${nota}</small>` : ''}
    </div>`

function comparacaoCx(atual, base, texto, subirRuim) {
    if (!base) return ''
    const pct = Math.round((atual - base) * 100 / base)
    if (!pct) return `Igual ${texto}`
    return `<span class="${(pct > 0) === subirRuim ? 'cx-ruim' : 'cx-bom'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span> ${pct > 0 ? 'acima' : 'abaixo'} ${texto.replace(/^que /, 'da ')}`
}

// Agrupa a série do período (real no passado, lançado para frente) em blocos: mês ou semana.
function agruparCx(d, chaveDe) {
    const hoje = d.hoje
    const grupos = new Map()
    for (const x of d.serie) {
        const ch = chaveDe(x.dia)
        if (!grupos.has(ch)) grupos.set(ch, { chave: ch, de: x.dia, ate: x.dia, entradas: 0, saidas: 0, menor: null, menor_dia: null, negativos: 0, abaixo: 0, fim: null, passado: 0, futuro: 0 })
        const g = grupos.get(ch)
        const m = movDiaCx(x, hoje)
        const v = saldoDiaCx(x, hoje)
        g.ate = x.dia
        g.entradas += m.e
        g.saidas += m.s
        if (v !== null) {
            if (g.menor === null || v < g.menor) { g.menor = v; g.menor_dia = x.dia }
            if (v < 0) g.negativos++
            if (v < (d.kpis.reserva || 0)) g.abaixo++
            g.fim = v
        }
        if (x.dia < hoje) g.passado++; else g.futuro++
    }
    return [...grupos.values()]
}
const mesesCx = d => agruparCx(d, dia => dia.slice(0, 7))
const semanasCx = d => d.serie.length > 70 ? [] : agruparCx(d, segundaCx)

function situacaoCx(g, reserva) {
    if (g.menor === null) return ['', '—']
    if (g.negativos) return ['perigo', `${g.negativos} ${g.negativos === 1 ? 'dia' : 'dias'} no vermelho`]
    if (reserva && g.abaixo) return ['alerta', `${g.abaixo} ${g.abaixo === 1 ? 'dia' : 'dias'} abaixo da reserva`]
    return ['ok', 'Sempre positivo']
}

function linhaGrupoCx(g, rotulo, reserva, clique = '') {
    const res = g.entradas - g.saidas
    const sit = situacaoCx(g, reserva)
    const tempo = !g.futuro ? 'aconteceu' : !g.passado ? 'lançado' : 'real + lançado'
    return `
        <tr ${clique ? `class="cx-linha-clicavel" onclick="${clique}" title="Abrir só este mês"` : ''}>
            <td>${rotulo} <small class="cx-tempo">${tempo}</small></td>
            <td class="fis-num">${dinheiro(g.entradas)}</td>
            <td class="fis-num">${dinheiro(g.saidas)}</td>
            <td class="fis-num ${sinalCx(res)}">${dinheiro(res)}</td>
            <td class="fis-num ${sinalCx(g.fim)}"><b>${g.fim === null ? '—' : dinheiro(g.fim)}</b></td>
            <td class="fis-num ${sinalCx(g.menor)}">${g.menor === null ? '—' : `${dinheiro(g.menor)} <small>${diaCx(g.menor_dia)}</small>`}</td>
            <td>${sit[0] ? `<span class="cx-selo cx-selo-${sit[0]}">${sit[0] === 'ok' ? '●' : '▲'} ${sit[1]}</span>` : sit[1]}</td>
        </tr>`
}

const cabecaGruposCx = primeira => `<thead><tr><th>${primeira}</th><th class="fis-num">Entrou</th><th class="fis-num">Saiu</th><th class="fis-num">Resultado</th>
    <th class="fis-num">Saldo no fim</th><th class="fis-num">Menor saldo</th><th>Situação</th></tr></thead>`

function tabelaMesesCx(meses, reserva) {
    return `
        <div class="fis-tabela-rolagem cx-tabela-semanas">
            <table class="fis-tabela">
                ${cabecaGruposCx('Mês')}
                <tbody>${meses.map(g => linhaGrupoCx(g, mesCx(g.chave), reserva, `estadoCx.modo = 'MES'; estadoCx.mes = '${g.chave}'; desenharFiltrosCx(); carregarFluxoCaixa()`)).join('')}</tbody>
            </table>
        </div>`
}

function tabelaSemanasCx(semanas, reserva) {
    return `
        <div class="fis-tabela-rolagem cx-tabela-semanas">
            <table class="fis-tabela">
                ${cabecaGruposCx('Semana')}
                <tbody>${semanas.map(g => linhaGrupoCx(g, `${diaCx(g.de)} a ${diaCx(g.ate)}`, reserva)).join('')}</tbody>
            </table>
        </div>`
}

function listaProximosCx(lista) {
    if (!lista.length) return '<div class="fis-vazio">Nada nos próximos 14 dias.</div>'
    return `<ol class="cx-proximos">${lista.map(p => {
        const ids = Array.isArray(p.ids) ? p.ids : []
        const nome = ids.length === 1 ? `<span class="fis-link" onclick="abrirFaturaFin('${escFin(ids[0])}')">${escFin(p.nome)}</span>` : escFin(p.nome)
        return `
        <li>
            <span class="cx-proximo-dia">${diaCx(p.dia)} <small>${semanaCx(p.dia)}</small></span>
            <span class="cx-proximo-nome">${nome}<small>${escFin(p.categoria || '')}${p.n > 1 ? ` · ${p.n} faturas` : ''}</small></span>
            <b>${dinheiro(p.valor)}</b>
        </li>`
    }).join('')}</ol>`
}

function barrasCategoriasCx(lista) {
    if (!lista.length) return '<div class="fis-vazio">Nada lançado para os próximos 30 dias.</div>'
    const topo = lista.slice(0, 10)
    const resto = lista.slice(10).reduce((a, c) => a + Number(c.valor), 0)
    if (resto > 0) topo.push({ categoria: `Outras ${lista.length - 10} categorias`, valor: resto })
    const max = Math.max(...topo.map(c => Number(c.valor)))
    const total = lista.reduce((a, c) => a + Number(c.valor), 0)
    return `<div class="cx-barras">${topo.map(c => `
        <div class="cx-barra" title="${escFin(c.categoria)}: ${escFin(dinheiroTexto(c.valor))}">
            <span class="cx-barra-nome">${escFin(c.categoria)}${c.pessoal ? ' <small>pessoal</small>' : ''}</span>
            <span class="cx-barra-trilho"><span style="width:${Math.max(1, Number(c.valor) * 100 / max)}%"></span></span>
            <span class="cx-barra-valor">${curtoCx(c.valor)} <small>${Math.round(Number(c.valor) * 100 / total)}%</small></span>
        </div>`).join('')}</div>`
}

function tabelaAtrasosCx(a) {
    const faixas = [['ate30', 'Até 30 dias'], ['ate90', '31 a 90'], ['ate180', '91 a 180'], ['mais', 'Mais de 180']]
    return `
        <table class="fis-tabela cx-atrasos">
            <thead><tr><th>Atraso</th><th class="fis-num">A pagar</th><th class="fis-num">A receber</th></tr></thead>
            <tbody>${faixas.map(([k, n]) => `<tr><td>${n}</td><td class="fis-num">${dinheiro(a.PAGAR.faixas[k])}</td><td class="fis-num">${dinheiro(a.RECEBER.faixas[k])}</td></tr>`).join('')}</tbody>
            <tfoot><tr><th>Total</th><th class="fis-num">${dinheiro(a.PAGAR.valor)}</th><th class="fis-num">${dinheiro(a.RECEBER.valor)}</th></tr></tfoot>
        </table>
        <div class="fis-acoes-claras">
            <button type="button" class="fis-mini" onclick="telaFaturasFin('PAGAR', { situacao: { op: '=', value: 'ATRASADO' } })">Ver a pagar em atraso</button>
            <button type="button" class="fis-mini" onclick="telaFaturasFin('RECEBER', { situacao: { op: '=', value: 'ATRASADO' } })">Ver a receber em atraso</button>
        </div>`
}

function tabelaProvaveisCx(lista) {
    if (!lista.length) return '<div class="fis-vazio">Nada previsto além do que já está lançado.</div>'
    return `
        <div class="fis-tabela-rolagem cx-tabela-provaveis">
            <table class="fis-tabela">
                <thead><tr><th>Dia</th><th>Tipo</th><th>Categoria</th><th class="fis-num">Média mensal</th><th class="fis-num">Falta lançar</th></tr></thead>
                <tbody>${lista.map(p => `
                    <tr><td>${diaCx(p.dia)}</td><td>${p.tipo === 'PAGAR' ? 'Saída' : 'Entrada'}</td><td>${escFin(p.categoria)}</td>
                        <td class="fis-num">${dinheiro(p.media)}</td><td class="fis-num"><b>${dinheiro(p.falta)}</b></td></tr>`).join('')}
                </tbody>
            </table>
        </div>`
}

// ---------------- gráfico do saldo (Chart.js, um eixo)

const linhaHojeCx = hojeIdx => ({
    id: 'linhaHojeCx',
    afterDatasetsDraw(chart) {
        if (hojeIdx < 0) return
        const x = chart.scales.x.getPixelForValue(hojeIdx)
        const { top, bottom } = chart.chartArea
        const c = chart.ctx
        c.save()
        c.strokeStyle = '#8a8984'
        c.setLineDash([3, 3])
        c.lineWidth = 1
        c.beginPath(); c.moveTo(x, top); c.lineTo(x, bottom); c.stroke()
        c.setLineDash([])
        c.fillStyle = '#52514e'
        c.font = '11px sans-serif'
        c.fillText('hoje', x + 4, top + 10)
        c.restore()
    }
})

function graficoSaldoCx(d) {
    const canvas = document.querySelector('[data-cx-saldo]')
    if (!canvas || typeof Chart === 'undefined' || !d.serie.length) return null
    const hoje = d.hoje
    const serie = d.serie
    const hojeIdx = serie.findIndex(x => x.dia === hoje)
    const reserva = d.kpis.reserva
    const temFuturo = serie.some(x => x.dia > hoje)
    const saldos = serie.map(x => saldoDiaCx(x, hoje))
    // Índice a partir do qual a linha é "lançado" (tracejada): hoje, ou o começo se o período é todo futuro.
    const inicioFuturo = hojeIdx >= 0 ? hojeIdx : serie[0].dia > hoje ? 0 : serie.length
    const datasets = [{
        label: 'Saldo', data: saldos,
        borderColor: CORES_CX.saldo, backgroundColor: CORES_CX.saldo, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
        fill: { target: { value: 0 }, above: CORES_CX.positivo, below: CORES_CX.negativo },
        segment: { borderDash: c => c.p0DataIndex >= inicioFuturo ? [6, 4] : undefined }
    }]
    const comPrev = serie.map(x => x.dia >= hoje && x.saldo_previsao !== undefined ? x.saldo_previsao : null)
    if (temFuturo && comPrev.some((v, i) => v !== null && Math.abs(v - (saldos[i] ?? v)) > 1)) datasets.push({
        label: 'Com previsões pela média', data: comPrev,
        borderColor: CORES_CX.previsao, backgroundColor: CORES_CX.previsao, borderWidth: 1.5, borderDash: [2, 3], pointRadius: 0, pointHoverRadius: 3, fill: false
    })
    if (reserva > 0) datasets.push({
        label: 'Reserva mínima', data: serie.map(() => reserva),
        borderColor: CORES_CX.reserva, backgroundColor: CORES_CX.reserva, borderWidth: 1, borderDash: [2, 3], pointRadius: 0, pointHoverRadius: 0, fill: false
    })
    const opcoes = {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: datasets.length > 1, position: 'bottom', labels: { color: CORES_CX.texto, boxWidth: 12, boxHeight: 12 } },
            tooltip: {
                callbacks: {
                    title: itens => { const x = serie[itens[0].dataIndex]; return x ? `${semanaCx(x.dia)} ${diaAnoCx(x.dia)}${x.dia > hoje ? ' (lançado)' : x.dia === hoje ? ' (hoje)' : ''}` : '' },
                    label: c => c.raw === null || c.raw === undefined ? null : `${c.dataset.label}: ${dinheiroTexto(c.raw)}`,
                    afterBody: itens => {
                        const x = serie[itens[0].dataIndex]
                        if (!x) return ''
                        const m = movDiaCx(x, hoje)
                        return [`Entrou: ${dinheiroTexto(m.e)}`, `Saiu: ${dinheiroTexto(m.s)}`]
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: CORES_CX.texto, maxRotation: 0, autoSkipPadding: 16, callback: v => serie[v] ? diaCx(serie[v].dia) : '' }
            },
            y: {
                border: { display: false },
                // A linha do zero marcada: acima tem caixa, abaixo está no vermelho.
                grid: { color: c => c.tick.value === 0 ? CORES_CX.zero : CORES_CX.grade, lineWidth: c => c.tick.value === 0 ? 1.5 : 1 },
                ticks: { color: CORES_CX.texto, callback: v => curtoCx(v) }
            }
        }
    }
    return new Chart(canvas, { type: 'line', data: { labels: serie.map((_, i) => i), datasets }, options: opcoes, plugins: [linhaHojeCx(hojeIdx)] })
}

// ---------------- planejamento e trava

async function planejamentoCx() {
    const d = estadoCx.dados
    const p = d.plan
    const t = p.trava
    const opcoesAtraso = atual => Object.entries(ROTULO_ATRASO_CX).map(([v, n]) => `<option value="${v}" ${String(atual) === v ? 'selected' : ''}>${n}</option>`).join('')
    popup({
        titulo: 'Planejamento do caixa e trava dos pedidos',
        confirmarFechar: false,
        linhas: [{ elemento: `
            <div class="fis-form cx-plan" data-cx-plan>
                <h4>Limites</h4>
                <div class="fis-grade">
                    <label class="fis-campo"><span>Reserva mínima (R$)</span>
                        <input class="fis-input" type="number" min="0" step="1000" name="reserva_minima" value="${p.reserva_minima}">
                        <small>Dinheiro que nunca deve ser usado. O "livre para gastar" já desconta.</small></label>
                    <label class="fis-campo"><span>Horizonte do "livre para gastar"</span>
                        <select class="fis-input" name="horizonte_dias">${[7, 14, 30, 45, 60, 90].map(n => `<option value="${n}" ${p.horizonte_dias === n ? 'selected' : ''}>${n} dias</option>`).join('')}</select></label>
                </div>
                <h4>Contas em atraso no saldo previsto</h4>
                <div class="fis-grade">
                    <label class="fis-campo"><span>A pagar em atraso</span><select class="fis-input" name="atrasados_pagar">${opcoesAtraso(p.atrasados_pagar)}</select>
                        <small>Entram como pagas hoje. Atraso muito antigo costuma ser conta já paga sem baixa.</small></label>
                    <label class="fis-campo"><span>A receber em atraso</span><select class="fis-input" name="atrasados_receber">${opcoesAtraso(p.atrasados_receber)}</select>
                        <small>Com o saldo conferido pelo extrato, o que já caiu na conta não pode entrar de novo.</small></label>
                </div>
                <h4>Trava dos pedidos de pagamento</h4>
                <div class="cx-radios">${Object.entries(ROTULO_TRAVA_CX).map(([v, n]) => `
                    <label class="fis-check"><input type="radio" name="trava_modo" value="${v}" ${t.modo === v ? 'checked' : ''}> ${n}</label>`).join('')}
                </div>
                <div class="fis-grade">
                    <label class="fis-campo"><span>Automática olha os próximos</span>
                        <select class="fis-input" name="trava_dias">${[3, 7, 14, 30].map(n => `<option value="${n}" ${t.dias === n ? 'selected' : ''}>${n} dias</option>`).join('')}</select>
                        <small>Trava quando o menor saldo nesses dias, menos a reserva, não cobre o pedido.</small></label>
                    <label class="fis-campo"><span>Teto semanal de pedidos (R$)</span>
                        <input class="fis-input" type="number" min="0" step="500" name="teto_semanal" value="${t.teto_semanal}">
                        <small>0 = sem teto. Soma os pedidos de segunda a domingo; vale mesmo com a trava desligada.</small></label>
                </div>
                <label class="fis-campo"><span>Mensagem para quem tentar pedir (opcional)</span>
                    <input class="fis-input" name="trava_mensagem" maxlength="300" value="${escFin(t.mensagem || '')}" placeholder="ex.: Caixa reservado para a folha até o dia 05/12.">
                </label>
                <p class="cx-plan-nota">Quem pode pedir mesmo travado: quem tiver <b>Financeiro → Pedir pagamento mesmo com a trava</b> na Central de acessos (padrão: adm, diretoria e financeiro).
                    ${t.atualizado_por ? `<br>Trava mudada por último por ${escFin(t.atualizado_por)} em ${new Date(t.atualizado_em).toLocaleString('pt-BR')}.` : ''}</p>
            </div>` }],
        botoes: [{ texto: 'Salvar', img: 'salvo', funcao: 'salvarPlanejamentoCx(this)' }]
    })
}

async function salvarPlanejamentoCx(botao) {
    const f = document.querySelector('[data-cx-plan]')
    const v = n => f.querySelector(`[name="${n}"]`)?.value
    try {
        overlayAguarde()
        await apiFin('planejamento/salvar', {
            reserva_minima: Number(v('reserva_minima')) || 0, horizonte_dias: Number(v('horizonte_dias')),
            atrasados_pagar: v('atrasados_pagar'), atrasados_receber: v('atrasados_receber'),
            trava: {
                modo: f.querySelector('[name="trava_modo"]:checked')?.value || 'DESLIGADA', dias: Number(v('trava_dias')),
                teto_semanal: Number(v('teto_semanal')) || 0, mensagem: v('trava_mensagem')
            }
        })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        await carregarFluxoCaixa()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------- conferir saldos com o extrato

async function conferirSaldosCx() {
    const d = estadoCx.dados
    const ontem = somarDiasCx(d.hoje, -1)
    const porApp = new Map()
    for (const c of d.contas.filter(c => c.tipo !== 'APLICACAO')) { if (!porApp.has(c.app)) porApp.set(c.app, []); porApp.get(c.app).push(c) }
    popup({
        titulo: 'Conferir saldos com o extrato',
        confirmarFechar: false,
        linhas: [{ elemento: `
            <div class="fis-form cx-conferir" data-cx-conferir>
                ${(d.bancos || []).length ? `<p class="cx-plan-nota">Contas ligadas a um banco com extrato importado na Conciliação bancária não precisam de conferência: o saldo vem do banco
                    (${d.bancos.map(b => `<b>${escFin(b.nome)}</b> ${dinheiro(b.saldo_hoje)}`).join(' · ')}). "No fluxo" do banco é o da conta principal dele.</p>` : ''}
                <p class="cx-plan-nota">Nas outras, digite o saldo que o <b>extrato do banco</b> mostra no <b>fim do dia</b> escolhido. A partir do dia seguinte o GCS soma
                    só os pagamentos e recebimentos registrados aqui. Deixe em branco o que não for conferir agora.
                    Desmarque "No fluxo" para contas que não são dinheiro disponível (cartão, empréstimo, conta de outra empresa).</p>
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>Conta</th><th class="fis-num">Saldo no GCS</th><th>Conferida</th><th class="fis-num">Saldo do extrato</th><th>No fim do dia</th><th>No fluxo</th></tr></thead>
                        <tbody>${[...porApp].map(([app, contas]) => `
                            <tr class="cx-grupo"><td colspan="6">${escFin(app)}</td></tr>
                            ${contas.map(c => c.extrato ? `
                            <tr data-conta="${c.id}">
                                <td>${escFin(c.nome)} <small>${escFin(TIPOS_CONTA_FIN[c.tipo] || c.tipo)}</small></td>
                                <td class="fis-num ${sinalCx(c.saldo)}">${dinheiro(c.saldo)}</td>
                                <td colspan="3"><small>Pelo extrato de <b>${escFin(c.extrato.banco)}</b>, até ${escFin(dataFin(c.extrato.ate))}</small></td>
                                <td><label class="fis-check"><input type="checkbox" name="no_fluxo" ${c.fora ? '' : 'checked'}></label></td>
                            </tr>` : `
                            <tr data-conta="${c.id}">
                                <td>${escFin(c.nome)} <small>${escFin(TIPOS_CONTA_FIN[c.tipo] || c.tipo)}</small></td>
                                <td class="fis-num ${sinalCx(c.saldo)}">${dinheiro(c.saldo)}</td>
                                <td>${c.conferencia ? `<small>${escFin(dataFin(c.conferencia.data))} por ${escFin(c.conferencia.por)}</small>
                                    <button type="button" class="fis-mini" title="Voltar ao saldo de antes da conferência" onclick="desconferirCx(${c.id}, this)">desfazer</button>` : '<small>não</small>'}</td>
                                <td class="fis-num"><input class="fis-input fis-num" type="number" step="0.01" name="saldo" placeholder="${c.conferencia ? escFin(c.conferencia.valor) : ''}"></td>
                                <td><input class="fis-input" type="date" name="data" value="${ontem}" max="${d.hoje}"></td>
                                <td><label class="fis-check"><input type="checkbox" name="no_fluxo" ${c.fora ? '' : 'checked'}></label></td>
                            </tr>`).join('')}`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` }],
        botoes: [{ texto: 'Salvar conferência', img: 'salvo', funcao: 'salvarConferenciaCx(this)' }]
    })
}

async function salvarConferenciaCx(botao) {
    const linhas = [...document.querySelectorAll('[data-cx-conferir] tr[data-conta]')]
    const contas = linhas.filter(l => (l.querySelector('[name="saldo"]')?.value ?? '') !== '')
        .map(l => ({ id: Number(l.dataset.conta), saldo: Number(l.querySelector('[name="saldo"]').value), data: l.querySelector('[name="data"]').value }))
    const fora = linhas.filter(l => !l.querySelector('[name="no_fluxo"]').checked).map(l => Number(l.dataset.conta))
    // Contas de outra empresa (filtro) continuam como estavam.
    const visiveis = new Set(linhas.map(l => Number(l.dataset.conta)))
    const foraTotal = [...(estadoCx.dados.plan.contas_fora || []).filter(id => !visiveis.has(Number(id))), ...fora]
    try {
        overlayAguarde()
        if (contas.length) await apiFin('saldos/conferir', { contas })
        await apiFin('planejamento/salvar', { contas_fora: foraTotal })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        await carregarFluxoCaixa()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function desconferirCx(id, botao) {
    if (!await confirmarPopup({ titulo: 'Desfazer conferência', mensagem: 'A conta volta ao saldo inicial de antes da conferência e sai do saldo do fluxo. Continuar?', textoConfirmar: 'Desfazer' })) return
    try {
        overlayAguarde()
        await apiFin('saldos/conferir', { contas: [{ id, remover: true }] })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        await carregarFluxoCaixa()
        conferirSaldosCx()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

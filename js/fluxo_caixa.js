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
    // Investimentos (26/11/2026): aplicação azul, resgate laranja, rendimento/saldo aplicado verde-água
    // (validados juntos: dataviz validate_palette, modo claro).
    aplicado: '#2a78d6', resgatado: '#eb6834', investido: '#1f9e89', investidoFundo: 'rgba(31, 158, 137, 0.12)',
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
                        <h2>Fluxo de Caixa <span class="cx-mais" title="Fluxo de caixa e mais: distribuição dos custos, pessoal por setor e mapa">+</span></h2>
                        <small>Temos caixa? Tivemos? Vamos ter? E para onde vai o dinheiro. Escolha as empresas e o período.</small>
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
        ${pode('financeiro.lote_salarios') ? '<button type="button" class="fis-mini" onclick="telaLotesSalarios()">Lote de salários</button>' : ''}
        <button type="button" class="fis-mini" onclick="almanaqueCx()" title="As referências que a Leitura do sistema usa para comparar os números">Almanaque</button>`

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
        ${secaoCx('Caixa', 'Temos, tivemos e teremos dinheiro em conta?')}
        ${leituraCaixaCx(d, r)}
        <section class="cx-respostas" aria-label="Respostas rápidas">
            ${respostaCx({
                titulo: 'Temos caixa hoje?', valor: semSaldo ? null : d.saldo_hoje,
                selo: semSaldo ? null : d.saldo_hoje >= 0 ? ['ok', 'Sim'] : ['perigo', 'No vermelho'],
                nota: semSaldo ? 'Nenhum extrato importado nem conta conferida ainda.'
                    : d.com_investimentos ? `${dinheiro(d.saldo_caixa)} em conta + ${dinheiro(d.saldo_investido)} investidos (dá para resgatar). ${notaSaldoCx(d)}`
                    : notaSaldoCx(d)
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

        ${secaoCx('Saldo e movimento', 'Dia a dia, mês a mês e semana a semana no período escolhido.')}
        ${leituraSaldoCx(d, r, meses)}
        <section class="cx-bloco">
            <div class="cx-bloco-topo">
                <h3>Saldo dia a dia</h3>
                <small>Acima do zero (verde): com caixa. Abaixo (vermelho): no vermelho. Linha cheia: o que aconteceu (extrato). Tracejada: o que está lançado no GCS.${r.futuro.length ? ' Roxa: somando as previsões pela média.' : ''}${k.reserva ? ' Vermelha fina: reserva mínima.' : ''}${d.com_investimentos ? ' O saldo inclui os investimentos; a linha verde-água fina é só o que está em conta.' : ''}</small>
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

        ${secaoCx('Entre empresas', 'Uma empresa do grupo bancando a outra.')}
        <div data-cx-leitura-entre></div>
        <section class="cx-bloco" data-cx-entre>
            <div class="cx-bloco-topo"><h3>Quem bancou quem</h3><small>Dinheiro de uma empresa usado pela outra: conta paga pela conta da outra, recebimento que caiu na conta da outra e transferências entre elas (pelo extrato). Clique numa linha para ver um por um.</small></div>
            <div data-cx-entre-corpo><div class="cx-carregando">Calculando…</div></div>
        </section>

        ${secaoCx('Daqui para frente', 'Sempre a partir de hoje: quanto dá para gastar, o que vence e o que está atrasado.')}
        ${leituraFrenteCx(d)}
        <section class="cx-bloco cx-daqui">
            <div class="cx-bloco-topo"><h3>Quanto dá para gastar</h3><small>Sempre a partir de hoje, para planejar (não muda com o período).</small></div>
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

        <div data-cx-distribuicao>
            ${secaoCx('Distribuição dos custos', 'Faturas a pagar do período, pagas e em aberto, pelo vencimento, mais os reembolsos pedidos.')}
            <div class="cx-carregando">Calculando a distribuição…</div>
        </div>

        ${secaoCx('Ajuda')}
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
                    <li><b>Investimentos</b>: ${d.com_investimentos ? 'o saldo aplicado (CDB) entra no caixa, porque dá para resgatar; aplicação e resgate só trocam o dinheiro de lugar e não mudam o total.' : 'hoje estão fora do caixa.'} Muda em Planejamento e trava. Os investimentos não rendem na previsão: o rendimento só entra quando a posição do banco é informada.</li>
                    <li><b>Livre para gastar</b>: o menor saldo dos próximos dias, pelo pior das duas linhas, menos a reserva mínima.</li>
                    <li><b>Atrasados</b>: hoje ${escFin(ROTULO_ATRASO_CX[d.plan.atrasados_pagar].toLowerCase())} os a pagar e ${escFin(ROTULO_ATRASO_CX[d.plan.atrasados_receber].toLowerCase())} os a receber (entram como se fossem pagos hoje). Muda em Planejamento e trava.</li>
                    <li><b>Trava</b>: com a trava ligada ou automática sem folga, o servidor recusa novos pedidos em Reembolsos → Solicitar Pagamento (menos para quem estiver liberado na Central de acessos).</li>
                </ul>
            </details>
        </section>`

    estadoCx.graficos.forEach(g => g?.destroy())
    estadoCx.graficos = [graficoSaldoCx(d), ...graficosInvestimentosCx(d)]
    carregarEntreEmpresasCx()
    carregarDistribuicaoCx()
}

// ---------------- investimentos (26/11/2026; gcs migrations/financeiro-aplicacoes.sql, financeiro_fluxo.js → investimentos)
// Conta tipo Aplicação (CDB Itaú · IAC): aplicações e resgates entram pela conciliação (Transferência); a posição que
// o banco mostra, informada de tempos em tempos, lança a diferença como rendimento do período.

function blocoInvestimentosCx(d, semSaldo) {
    const inv = d.investimentos
    if (!inv || !inv.contas.length) return ''
    const rend = inv.contas.reduce((a, c) => a + Number(c.rendimento || 0), 0)
    const desde = inv.contas.map(c => c.rendimento_desde).filter(Boolean).sort()[0]
    const meses = inv.meses || []
    const aplicado = meses.reduce((a, m) => a + m.aplicado, 0), resgatado = meses.reduce((a, m) => a + m.resgatado, 0)
    const serie = inv.serie || []
    const maior = serie.reduce((m, x) => !m || x.saldo > m.saldo ? x : m, null)
    const media = serie.length ? serie.reduce((a, x) => a + x.saldo, 0) / serie.length : 0
    return `
        <section class="cx-bloco">
            <div class="cx-bloco-topo">
                <h3>Investimentos</h3>
                <small>${d.com_investimentos ? 'Contam no "Temos caixa hoje?" e no saldo dia a dia, porque dá para resgatar.' : 'Fora do "Temos caixa hoje?" (Planejamento e trava).'} Aplicações e resgates entram pela conciliação bancária (Transferência → conta do investimento); a posição que o banco mostra lança o rendimento do período.</small>
                <span class="cx-inv-acoes">
                    ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="posicaoInvestimentoCx()">Informar posição</button>' : ''}
                    <button type="button" class="fis-mini" onclick="historicoInvestimentosCx()">Histórico</button>
                </span>
            </div>
            <div class="cx-indicadores">
                ${inv.contas.map(c => miniCx(c.nome, dinheiro(c.saldo),
                    `Última posição: ${c.posicao_data ? `${dinheiro(c.posicao_saldo)} em ${diaAnoCx(c.posicao_data)}` : '—'} · no ano: aplicou ${dinheiro(c.aplicado_ano)}, resgatou ${dinheiro(c.resgatado_ano)}`)).join('')}
                ${miniCx('Rendimento lançado', dinheiro(rend), desde ? `Pelas posições informadas desde ${diaAnoCx(desde)} (líquido do IR)` : '')}
                ${d.com_investimentos
                    ? miniCx('Só em conta (sem investimentos)', semSaldo ? '—' : dinheiro(d.saldo_caixa), 'O que dá para pagar hoje sem resgatar nada', d.saldo_caixa < 0)
                    : miniCx('Caixa + investimentos', semSaldo ? '—' : dinheiro(Math.round((d.saldo_hoje + inv.saldo_hoje) * 100) / 100),
                        semSaldo ? 'Sem saldo de caixa de partida.' : `${dinheiro(d.saldo_hoje)} em caixa + ${dinheiro(inv.saldo_hoje)} aplicados`)}
                ${serie.length ? miniCx(`Desde ${diaAnoCx(serie[0].dia)}`, `${dinheiro(aplicado)} aplicados`,
                    `${dinheiro(resgatado)} resgatados · saldo médio ${dinheiro(Math.round(media * 100) / 100)} · maior ${maior ? `${dinheiro(maior.saldo)} em ${diaCx(maior.dia)}` : '—'}`) : ''}
            </div>
            ${serie.length > 1 ? `
            <div class="cx-duas cx-inv-graficos">
                <figure class="cx-inv-figura">
                    <figcaption>Saldo investido dia a dia <small>Pontos: posições informadas pelo banco.</small></figcaption>
                    <div class="cx-grafico"><canvas data-cx-inv-saldo aria-label="Saldo investido dia a dia" role="img"></canvas></div>
                </figure>
                <figure class="cx-inv-figura">
                    <figcaption>Mês a mês <small>Quanto foi aplicado, resgatado e quanto rendeu (pelas posições).</small></figcaption>
                    <div class="cx-grafico"><canvas data-cx-inv-meses aria-label="Aplicações, resgates e rendimento por mês" role="img"></canvas></div>
                </figure>
            </div>
            <details class="cx-inv-tabela">
                <summary>Ver a tabela mês a mês</summary>
                <table class="fis-tabela">
                    <thead><tr><th>Mês</th><th class="fis-num">Aplicado</th><th class="fis-num">Resgatado</th><th class="fis-num">Rendimento</th><th class="fis-num">Saldo no fim</th></tr></thead>
                    <tbody>${meses.map(m => `<tr><td>${escFin(mesCx(m.mes))}</td><td class="fis-num">${dinheiro(m.aplicado)}</td><td class="fis-num">${dinheiro(m.resgatado)}</td>
                        <td class="fis-num">${m.rendimento ? dinheiro(m.rendimento) : '—'}</td><td class="fis-num">${dinheiro(m.saldo_fim)}</td></tr>`).join('')}</tbody>
                </table>
            </details>` : ''}
        </section>`
}

// Dois gráficos do investimento, um eixo cada: saldo dia a dia (com as posições do banco) e barras por mês.
function graficosInvestimentosCx(d) {
    const inv = d.investimentos
    if (typeof Chart === 'undefined' || !inv?.serie?.length) return []
    const serie = inv.serie
    const graficos = []
    const eixoX = rotulo => ({ grid: { display: false }, ticks: { color: CORES_CX.texto, maxRotation: 0, autoSkipPadding: 16, callback: rotulo } })
    const eixoY = { border: { display: false }, beginAtZero: true, grid: { color: CORES_CX.grade }, ticks: { color: CORES_CX.texto, callback: v => curtoCx(v) } }
    const c1 = document.querySelector('[data-cx-inv-saldo]')
    if (c1) {
        const posicoes = new Map((inv.posicoes || []).map(p => [p.data, p]))
        graficos.push(new Chart(c1, {
            type: 'line',
            data: {
                labels: serie.map((_, i) => i),
                datasets: [{
                    label: 'Saldo investido', data: serie.map(x => x.saldo),
                    borderColor: CORES_CX.investido, backgroundColor: CORES_CX.investidoFundo, borderWidth: 2, fill: 'origin', stepped: true,
                    pointRadius: serie.map(x => posicoes.has(x.dia) ? 5 : 0), pointHoverRadius: 4,
                    pointBackgroundColor: CORES_CX.investido, pointBorderColor: '#fff', pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: itens => { const x = serie[itens[0].dataIndex]; return x ? `${semanaCx(x.dia)} ${diaAnoCx(x.dia)}` : '' },
                            label: c => `Saldo: ${dinheiroTexto(c.raw)}`,
                            afterBody: itens => {
                                const x = serie[itens[0].dataIndex]
                                if (!x) return ''
                                const l = []
                                if (x.aplicado) l.push(`Aplicou: ${dinheiroTexto(x.aplicado)}`)
                                if (x.resgatado) l.push(`Resgatou: ${dinheiroTexto(x.resgatado)}`)
                                if (x.rendimento) l.push(`Rendimento lançado: ${dinheiroTexto(x.rendimento)}`)
                                if (posicoes.has(x.dia)) l.push(`Posição do banco: ${dinheiroTexto(posicoes.get(x.dia).saldo)}`)
                                return l
                            }
                        }
                    }
                },
                scales: { x: eixoX(v => serie[v] ? diaCx(serie[v].dia) : ''), y: eixoY }
            }
        }))
    }
    const c2 = document.querySelector('[data-cx-inv-meses]')
    const meses = inv.meses || []
    if (c2 && meses.length) {
        const barra = { borderRadius: 4, borderSkipped: 'bottom', borderWidth: 0, maxBarThickness: 18, categoryPercentage: 0.7, barPercentage: 0.9 }
        graficos.push(new Chart(c2, {
            type: 'bar',
            data: {
                labels: meses.map(m => mesCx(m.mes)),
                datasets: [
                    { ...barra, label: 'Aplicado', data: meses.map(m => m.aplicado), backgroundColor: CORES_CX.aplicado },
                    { ...barra, label: 'Resgatado', data: meses.map(m => m.resgatado), backgroundColor: CORES_CX.resgatado },
                    { ...barra, label: 'Rendimento', data: meses.map(m => m.rendimento), backgroundColor: CORES_CX.investido }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom', labels: { color: CORES_CX.texto, boxWidth: 12, boxHeight: 12 } },
                    tooltip: {
                        callbacks: {
                            label: c => `${c.dataset.label}: ${dinheiroTexto(c.raw)}`,
                            afterBody: itens => { const m = meses[itens[0].dataIndex]; return m ? [`Saldo no fim do mês: ${dinheiroTexto(m.saldo_fim)}`] : '' }
                        }
                    }
                },
                scales: { x: { grid: { display: false }, ticks: { color: CORES_CX.texto } }, y: eixoY }
            }
        }))
    }
    return graficos
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
    const leitura = document.querySelector('[data-cx-leitura-entre]')
    if (leitura) leitura.innerHTML = leituraEntreCx(pares, fim)
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
        label: d.com_investimentos ? 'Saldo (conta + investimentos)' : 'Saldo', data: saldos,
        borderColor: CORES_CX.saldo, backgroundColor: CORES_CX.saldo, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
        fill: { target: { value: 0 }, above: CORES_CX.positivo, below: CORES_CX.negativo },
        segment: { borderDash: c => c.p0DataIndex >= inicioFuturo ? [6, 4] : undefined }
    }]
    // Com investimentos no caixa: linha fina do que está só em conta (saldo − investido), mesma escala.
    if (d.com_investimentos && serie.some(x => x.investido)) datasets.push({
        label: 'Só em conta (sem investimentos)', data: saldos.map((v, i) => v === null || serie[i].investido === undefined ? null : Math.round((v - serie[i].investido) * 100) / 100),
        borderColor: CORES_CX.investido, backgroundColor: CORES_CX.investido, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, fill: false,
        segment: { borderDash: c => c.p0DataIndex >= inicioFuturo ? [6, 4] : undefined }
    })
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
                        return [`Entrou: ${dinheiroTexto(m.e)}`, `Saiu: ${dinheiroTexto(m.s)}`,
                            ...(x.investido ? [`Investido (incluso no saldo): ${dinheiroTexto(x.investido)}`] : [])]
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

// ---------------- Fluxo de Caixa + (26/11/2026): seções com título e a distribuição dos custos
// Dados: POST financeiro/fluxo/distribuicao { apps, de, ate } (gcs financeiro_fluxo.js → distribuicao), pelo mesmo
// período e empresas do fluxo. Roscas pedidas pelo dono (categoria, departamento, setor): no máximo 7 fatias com
// cor (paleta categórica do dataviz, ordem fixa) + "Outras" em cinza; a lista ao lado é a legenda e a tabela.
// Setor = ficha do RH na hora da consulta: corrigir o setor (no RH ou aqui, em "Sem setor definido") muda o painel.
// O mapa reaproveita o do antigo Dashboard do Financeiro (mapaDash, js/dashboard_chamados.js).

const CATEGORICAS_CX = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2']
const OUTRAS_CX = '#a8a6a0'
// Cor do setor presa ao setor (não à posição): trocar empresa ou período não repinta.
const ORDEM_SETORES_CX = ['PROJETOS', 'ASSISTÊNCIA TÉCNICA', 'FINANCEIRO', 'LOGÍSTICA', 'COMERCIAL', 'ADMINISTRATIVO', 'EMPRESA']
const corSetorCx = nome => nome === 'Sem setor definido' ? OUTRAS_CX : CATEGORICAS_CX[ORDEM_SETORES_CX.indexOf(nome)] || OUTRAS_CX

const secaoCx = (titulo, sub = '') => `
    <h2 class="cx-secao"><span>${escFin(titulo)}</span>${sub ? `<small>${escFin(sub)}</small>` : ''}</h2>`

const pctCx = (v, total) => total ? `${(v / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'

// Até 7 fatias com nome + "Outras" com o resto (soma e quantos itens entraram nela).
function fatiasCx(lista, { cor = null, max = 7 } = {}) {
    const positivos = lista.filter(x => Number(x.valor) > 0)
    const cabe = positivos.length <= max + 1 ? positivos : positivos.slice(0, max)
    const resto = positivos.slice(cabe.length)
    const fatias = cabe.map((x, i) => ({ ...x, cor: cor ? cor(x) : CATEGORICAS_CX[i] || OUTRAS_CX }))
    if (resto.length) fatias.push({ nome: `Outras (${resto.length})`, valor: resto.reduce((s, x) => s + Number(x.valor), 0), cor: OUTRAS_CX, outras: true })
    return fatias
}

let esperaDistribuicaoCx = 0
async function carregarDistribuicaoCx() {
    const alvo = document.querySelector('[data-cx-distribuicao]')
    const d = estadoCx.dados
    if (!alvo || !d) return
    const pedido = ++esperaDistribuicaoCx
    try {
        const dist = await apiFin('fluxo/distribuicao', { apps: estadoCx.apps, de: d.periodo.de, ate: d.periodo.ate, anterior: periodoAnteriorCx(d.periodo) })
        if (pedido !== esperaDistribuicaoCx || !document.body.contains(alvo)) return
        estadoCx.dist = dist
        desenharDistribuicaoCx()
    } catch (err) {
        if (pedido !== esperaDistribuicaoCx) return
        alvo.innerHTML = `${secaoCx('Distribuição dos custos')}<div class="fis-vazio">Não deu para calcular a distribuição: ${mensagemErroEst(err)}
            <button type="button" class="fis-mini" onclick="carregarDistribuicaoCx()">Tentar de novo</button></div>`
    }
}

function desenharDistribuicaoCx() {
    const alvo = document.querySelector('[data-cx-distribuicao]')
    const x = estadoCx.dist
    if (!alvo || !x) return
    const cats = fatiasCx(x.categorias)
    const deps = fatiasCx(x.departamentos)
    const setores = fatiasCx(x.setores, { cor: s => corSetorCx(s.nome), max: 8 })
    const totalSetores = x.setores.reduce((s, v) => s + Number(v.valor), 0)
    const semSetor = x.pessoas.filter(p => p.setor === 'Sem setor definido')
    const contratos = x.departamentos.filter(dp => dp.tipo === 'CONTRATO').slice(0, 12)
    const vazio = !x.categorias.length
    alvo.innerHTML = `
        ${secaoCx('Distribuição dos custos', 'Faturas a pagar do período, pagas e em aberto, pelo vencimento, mais os reembolsos pedidos.')}
        ${vazio ? '' : leituraDistribuicaoCx(x)}
        ${vazio ? '<div class="fis-vazio">Nenhuma fatura a pagar com vencimento no período.</div>' : `
        <div class="cx-faixa-periodo">Total ${dinheiro(x.total)} · já pago ${dinheiro(x.pago)} · em aberto ${dinheiro(x.total - x.pago)}</div>
        <div class="cx-duas">
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Por categoria</h3><small>${x.categorias.length} categorias. Fatura com várias categorias entra pela parte de cada uma.</small></div>
                ${roscaCx('categorias', cats, x.total)}
            </section>
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Por departamento</h3><small>${x.departamentos.length} departamentos, pelo rateio de cada fatura. Clique num ORC para abrir o painel de custos.</small></div>
                ${roscaCx('departamentos', deps, x.total, true)}
            </section>
        </div>`}

        ${secaoCx('Pessoal por setor', 'Salários, refeição e transporte das pessoas, pelo setor da ficha do RH.')}
        ${x.setores.length ? leituraPessoalCx(x) : ''}
        ${!x.setores.length ? '<div class="fis-vazio">Nenhuma despesa com pessoal no período.</div>' : `
        <div class="cx-duas">
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Quanto cada setor custa</h3><small>Total ${dinheiro(totalSetores)} em despesas com pessoal (categorias 2.03).</small></div>
                ${roscaCx('setores', setores, totalSetores)}
            </section>
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Setor × tipo de despesa</h3><small>Outros = férias, plano, adiantamento e o resto das despesas com pessoal.</small></div>
                ${tabelaSetoresCx(x)}
            </section>
        </div>
        ${semSetor.length ? `
        <section class="cx-bloco">
            <div class="cx-bloco-topo"><h3>Sem setor definido (${semSetor.length})</h3>
                <small>Defina o setor aqui mesmo: grava na ficha do RH e o painel já se atualiza.</small></div>
            <div class="cx-sem-setor">${semSetor.map(p => `
                <span class="cx-pessoa-setor">${escFin(p.nome || 'Sem nome')}${p.valor != null ? ` <small>${dinheiro(p.valor)}</small>` : ''}
                    ${p.cliente_id ? `<button type="button" class="fis-mini" onclick="definirSetorCx('${escFin(p.cliente_id)}', this)" data-nome="${escFin(p.nome || '')}">Definir setor</button>` : ''}</span>`).join('')}
            </div>
        </section>` : ''}
        ${x.pessoas.some(p => p.valor != null && p.setor !== 'Sem setor definido') ? `
        <section class="cx-bloco">
            <details>
                <summary><b>Pessoas por setor</b> — valores do período (só para quem abre o Lote de Salários)</summary>
                ${tabelaPessoasCx(x.pessoas)}
            </details>
        </section>` : ''}`}

        ${secaoCx('Custos por estado', 'Pelo estado do cliente do orçamento (ORC) de cada departamento.')}
        ${leituraEstadosCx(x)}
        <div class="cx-duas cx-duas-mapa">
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Mapa</h3><small>${x.estados.length} estados${x.sem_estado ? ` · ${dinheiro(x.sem_estado)} sem estado (setores, sem departamento ou cliente sem UF)` : ''}.</small></div>
                <div class="dash cx-mapa">${typeof mapaDash === 'function' ? mapaDash(x.estados, { formatar: curtoCx, descrever: v => dinheiroTexto(v) }) : ''}</div>
            </section>
            <section class="cx-bloco">
                <div class="cx-bloco-topo"><h3>Orçamentos com mais custo no período</h3><small>Clique para abrir o painel de custos.</small></div>
                ${contratos.length ? `
                <div class="fis-tabela-rolagem"><table class="fis-tabela">
                    <thead><tr><th>Departamento</th><th>Cliente</th><th>UF</th><th class="fis-num">Custo</th></tr></thead>
                    <tbody>${contratos.map(c => `
                        <tr class="cx-clicavel" tabindex="0" onclick="painelCustos('${escFin(c.nome)}')" onkeydown="if (event.key === 'Enter') painelCustos('${escFin(c.nome)}')">
                            <td>${escFin(c.nome)}</td><td>${escFin(c.cliente || '—')}</td><td>${escFin(c.uf || '')}</td><td class="fis-num">${dinheiro(c.valor)}</td>
                        </tr>`).join('')}</tbody>
                </table></div>` : '<div class="fis-vazio">Nenhum custo ligado a orçamento no período.</div>'}
            </section>
        </div>`
    if (typeof ligarTooltipsDash === 'function') ligarTooltipsDash(alvo)
    estadoCx.roscas?.forEach(g => g?.destroy())
    estadoCx.roscas = vazio ? [] : [
        graficoRoscaCx('categorias', cats, x.total), graficoRoscaCx('departamentos', deps, x.total),
        ...(x.setores.length ? [graficoRoscaCx('setores', setores, totalSetores)] : [])]
}

// Rosca + lista (legenda com valor e %: identidade nunca só pela cor).
function roscaCx(chave, fatias, total, clicavel = false) {
    return `
        <div class="cx-rosca">
            <div class="cx-rosca-grafico"><canvas data-cx-rosca="${chave}" role="img" aria-label="Divisão ${escFin(chave)}"></canvas></div>
            <ul class="cx-rosca-lista">${fatias.map(f => {
                const abre = clicavel && !f.outras && /^ORC_/.test(f.nome)
                return `
                <li${abre ? ` class="cx-clicavel" tabindex="0" onclick="painelCustos('${escFin(f.nome)}')" title="Abrir o painel de custos"` : ''}>
                    <i style="background: ${f.cor}"></i>
                    <span class="cx-rosca-nome">${escFin(f.nome)}${f.cliente ? ` <small>${escFin(f.cliente)}</small>` : ''}</span>
                    <b>${dinheiro(f.valor)}</b><small>${pctCx(f.valor, total)}</small>
                </li>`
            }).join('')}</ul>
        </div>`
}

function graficoRoscaCx(chave, fatias, total) {
    const canvas = document.querySelector(`[data-cx-rosca="${chave}"]`)
    if (!canvas || typeof Chart === 'undefined' || !fatias.length) return null
    return new Chart(canvas, {
        type: 'doughnut',
        data: { labels: fatias.map(f => f.nome), datasets: [{ data: fatias.map(f => Number(f.valor)), backgroundColor: fatias.map(f => f.cor), borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false, cutout: '58%',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.label}: ${dinheiroTexto(c.raw)} (${pctCx(c.raw, total)})` } }
            }
        }
    })
}

function tabelaSetoresCx(x) {
    const grupos = x.grupos_pessoal || ['Salários', 'Refeição', 'Transporte', 'Outros']
    const soma = g => x.setores.reduce((s, v) => s + Number(v.grupos?.[g] || 0), 0)
    return `
        <div class="fis-tabela-rolagem"><table class="fis-tabela">
            <thead><tr><th>Setor</th>${grupos.map(g => `<th class="fis-num">${escFin(g)}</th>`).join('')}<th class="fis-num">Total</th><th class="fis-num">Pessoas</th></tr></thead>
            <tbody>${x.setores.map(s => `
                <tr><td><i class="cx-ponto" style="background: ${corSetorCx(s.nome)}"></i>${escFin(s.nome)}</td>
                    ${grupos.map(g => `<td class="fis-num">${s.grupos?.[g] ? dinheiro(s.grupos[g]) : '—'}</td>`).join('')}
                    <td class="fis-num"><b>${dinheiro(s.valor)}</b></td><td class="fis-num">${s.pessoas}</td></tr>`).join('')}
            </tbody>
            <tfoot><tr><th>Total</th>${grupos.map(g => `<th class="fis-num">${dinheiro(soma(g))}</th>`).join('')}
                <th class="fis-num">${dinheiro(x.setores.reduce((s, v) => s + Number(v.valor), 0))}</th><th></th></tr></tfoot>
        </table></div>`
}

function tabelaPessoasCx(pessoas) {
    return `
        <div class="fis-tabela-rolagem"><table class="fis-tabela">
            <thead><tr><th>Setor</th><th>Pessoa</th><th class="fis-num">Valor no período</th><th></th></tr></thead>
            <tbody>${pessoas.map(p => `
                <tr><td>${escFin(p.setor)}</td><td>${escFin(p.nome || '—')}</td><td class="fis-num">${dinheiro(p.valor || 0)}</td>
                    <td>${p.cliente_id ? `<button type="button" class="fis-mini" onclick="definirSetorCx('${escFin(p.cliente_id)}', this)" data-nome="${escFin(p.nome || '')}" data-setor="${escFin(p.setor)}">Trocar setor</button>` : ''}</td></tr>`).join('')}
            </tbody>
        </table></div>`
}

// Setor da pessoa: grava na ficha do RH (rh_funcionarios.setor, como no Controle de Faturamento) e recalcula.
function definirSetorCx(clienteId, botao) {
    const atual = botao?.dataset.setor && botao.dataset.setor !== 'Sem setor definido' ? botao.dataset.setor : ''
    const opcoes = typeof SETORES_PADRAO_RH !== 'undefined' ? SETORES_PADRAO_RH : ORDEM_SETORES_CX
    popup({
        titulo: 'Setor da pessoa',
        linhas: [
            { texto: 'Pessoa', elemento: `<b>${escFin(botao?.dataset.nome || '')}</b>` },
            { texto: 'Setor', elemento: `<select name="setor"><option value="">— sem setor —</option>${opcoes.map(s => `<option value="${escFin(s)}" ${s === atual ? 'selected' : ''}>${escFin(s)}</option>`).join('')}</select>` },
            { elemento: '<small>Grava na ficha do RH: vale para o Fluxo de Caixa +, o Controle de Faturamento e o rateio dos lotes.</small>' }
        ],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarSetorCx(this, '${escFin(clienteId)}')` }]
    })
}

async function salvarSetorCx(botao, clienteId) {
    const janela = botao.closest('.popup')
    const setor = janela?.querySelector('[name="setor"]')?.value || null
    const resposta = await enviar(`rh_funcionarios/${clienteId}/setor`, setor)
    if (!resposta?.success) return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar o setor.' })
    removerPopup(janela?.id)
    await carregarDistribuicaoCx()
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
                <label class="fis-check"><input type="checkbox" name="investimentos_no_caixa" ${p.investimentos_no_caixa !== false ? 'checked' : ''}>
                    Contar os investimentos (CDB) como caixa disponível</label>
                <small class="cx-plan-nota">Ligado: o saldo aplicado entra no "Temos caixa hoje?", no saldo dia a dia, no "livre para gastar" e na trava automática, porque dá para resgatar.</small>
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
            investimentos_no_caixa: Boolean(f.querySelector('[name="investimentos_no_caixa"]')?.checked),
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

// ---------------- Leitura do sistema (26/11/2026)
// Cada seção do Fluxo de Caixa + abre com uma análise feita com os números da própria tela, comparada com o
// almanaque financeiro (fin_almanaque, gcs migrations/financeiro-almanaque.sql: faixa boa e aceitável de cada
// indicador, editáveis em "Almanaque") e com o período anterior (mês anterior, ou o mesmo tamanho logo antes).
// Achado = { nivel: alerta | atencao | ok | info, texto, ref (chave do almanaque), acao (HTML de botão) }.
// Ordem: alerta → atenção → informação → ok. Dentro da faixa boa vira "ok" curto, para o painel não gritar à toa.

const ORDEM_NIVEL_CX = { alerta: 0, atencao: 1, info: 2, ok: 3 }
const ROTULO_NIVEL_CX = { alerta: 'Alerta', atencao: 'Atenção', info: 'Para saber', ok: 'Em ordem' }
const numCx = (v, casas = 1) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas })
const pctNumCx = (parte, todo) => todo ? parte / todo * 100 : 0

const refCx = chave => (estadoCx.dados?.almanaque || []).find(a => a.chave === chave) || null

// Valor contra a faixa do almanaque: ok (faixa boa), atencao (aceitável), alerta (fora).
function avaliarCx(chave, valor) {
    const a = refCx(chave)
    if (!a || valor === null || valor === undefined || !Number.isFinite(Number(valor))) return null
    const v = Number(valor)
    const dentro = (min, max) => (min === null || v >= min) && (max === null || v <= max)
    return dentro(a.ok_min, a.ok_max) ? 'ok' : dentro(a.aceitavel_min, a.aceitavel_max) ? 'atencao' : 'alerta'
}

function unidadeCx(v, unidade) {
    if (unidade === '%') return `${numCx(v)}%`
    if (unidade === 'x') return `${numCx(v, 2)}×`
    if (unidade === 'R$') return curtoCx(v)
    if (unidade === 'meses') return `${numCx(v)} ${Number(v) === 1 ? 'mês' : 'meses'}`
    if (unidade === 'dias') return `${numCx(v, 0)} dia${Number(v) === 1 ? '' : 's'}`
    return numCx(v)
}

function faixaTextoCx(a, qual = 'ok') {
    const min = a[`${qual}_min`], max = a[`${qual}_max`]
    if (min !== null && max !== null) return `${unidadeCx(min, a.unidade)} a ${unidadeCx(max, a.unidade)}`
    if (min !== null) return `${unidadeCx(min, a.unidade)} ou mais`
    if (max !== null) return `até ${unidadeCx(max, a.unidade)}`
    return 'qualquer valor'
}

// Achado com régua do almanaque: o texto de cada nível vem pronto (ok, atencao, alerta).
function medirCx(chave, valor, textos) {
    const nivel = avaliarCx(chave, valor)
    if (!nivel) return null
    const t = typeof textos === 'function' ? textos(nivel) : textos[nivel] || textos.padrao
    return t ? { nivel, texto: t, ref: chave, valor } : null
}

function leituraCx(achados) {
    const lista = achados.filter(Boolean).sort((a, b) => ORDEM_NIVEL_CX[a.nivel] - ORDEM_NIVEL_CX[b.nivel])
    if (!lista.length) return ''
    const piores = lista.filter(a => a.nivel === 'alerta').length
    const atencao = lista.filter(a => a.nivel === 'atencao').length
    const resumo = piores ? `${piores} alerta${piores === 1 ? '' : 's'}` : atencao ? `${atencao} ponto${atencao === 1 ? '' : 's'} de atenção` : 'tudo dentro do esperado'
    return `
        <div class="cx-leitura cx-leitura-${piores ? 'alerta' : atencao ? 'atencao' : 'ok'}" role="note">
            <div class="cx-leitura-topo"><b>Leitura do sistema</b><small>${resumo}</small></div>
            <ul>${lista.map(a => {
                const r = a.ref ? refCx(a.ref) : null
                const regua = r ? `<button type="button" class="cx-leitura-ref" onclick="almanaqueCx('${escFin(r.chave)}')"
                    title="${escFin(`${r.titulo}\nBom: ${faixaTextoCx(r)} · aceitável: ${faixaTextoCx(r, 'aceitavel')}\n${r.explicacao}${r.fonte ? `\nFonte: ${r.fonte}` : ''}`)}">referência: ${escFin(faixaTextoCx(r))}</button>` : ''
                return `<li class="cx-leitura-${a.nivel}"><span class="cx-leitura-nivel">${ROTULO_NIVEL_CX[a.nivel]}</span>
                    <div>${a.texto} ${regua}${a.acao ? `<div class="cx-leitura-acoes">${a.acao}</div>` : ''}</div></li>`
            }).join('')}</ul>
        </div>`
}

// Mês anterior (modo mês) ou o mesmo número de dias logo antes (de/até).
function periodoAnteriorCx({ de, ate }) {
    if (estadoCx.modo === 'MES') { const m = somarMesesCx(de.slice(0, 7), -1); return { de: `${m}-01`, ate: fimDoMesCx(m) } }
    const dias = Math.round((new Date(`${ate}T12:00:00Z`) - new Date(`${de}T12:00:00Z`)) / 864e5) + 1
    return { de: somarDiasCx(de, -dias), ate: somarDiasCx(de, -1) }
}
const nomeAnteriorCx = a => estadoCx.modo === 'MES' ? mesLongoCx(a.de.slice(0, 7)) : `${diaAnoCx(a.de)} a ${diaAnoCx(a.ate)}`

// ---- Caixa
function leituraCaixaCx(d, r) {
    const k = d.kpis
    const achados = []
    if (!d.tem_saldo) return leituraCx([{ nivel: 'alerta', texto: 'Sem saldo de partida (nenhum extrato importado nem conta conferida): as respostas desta seção mostram só a variação do caixa, não quanto existe de verdade. Importe o extrato na Conciliação bancária antes de decidir qualquer pagamento grande.' }])
    const saidaMes = (k.gasto_dia_90 || 0) * 30
    if (saidaMes > 0) {
        const meses = d.saldo_hoje / saidaMes
        achados.push(medirCx('reserva_meses', meses, n => ({
            ok: `O caixa de hoje (${curtoCx(d.saldo_hoje)}) cobre <b>${numCx(meses)} meses</b> das saídas médias (${curtoCx(saidaMes)}/mês). Folga confortável.`,
            atencao: `O caixa de hoje (${curtoCx(d.saldo_hoje)}) cobre <b>${numCx(meses)} ${meses < 1.05 ? 'mês' : 'meses'}</b> das saídas médias (${curtoCx(saidaMes)}/mês): dá para operar, mas sem margem para um cliente grande atrasar.`,
            alerta: d.saldo_hoje < 0 ? `O caixa está <b>negativo</b> (${curtoCx(d.saldo_hoje)}) contra saídas médias de ${curtoCx(saidaMes)}/mês.`
                : `O caixa de hoje (${curtoCx(d.saldo_hoje)}) cobre só <b>${numCx(meses * 30, 0)} dias</b> das saídas médias (${curtoCx(saidaMes)}/mês). Priorize cobrar os atrasados e segure o que puder ser adiado.`
        })[n]))
    }
    if (d.com_investimentos && d.saldo_investido > 0)
        achados.push({ nivel: 'info', texto: `${numCx(pctNumCx(d.saldo_investido, d.saldo_hoje), 0)}% do caixa (${curtoCx(d.saldo_investido)}) está investido: conta como caixa porque dá para resgatar, mas o resgate leva tempo e pode ter IR.` })
    const negPassados = r.negPassado.length
    if (r.passado.length) achados.push(medirCx('dias_vermelho', negPassados, {
        ok: 'Nenhum dia no vermelho no período que já passou.',
        atencao: `<b>${negPassados} dia(s) no vermelho</b> no período (pior: ${curtoCx(r.piorPassado?.valor)} em ${diaCx(r.piorPassado?.dia)}). Pouco, mas já gera juros de cheque especial.`,
        alerta: `<b>${negPassados} dias no vermelho</b> no período (pior: ${curtoCx(r.piorPassado?.valor)} em ${diaCx(r.piorPassado?.dia)}). Esse padrão costuma custar caro em juros: vale antecipar recebíveis ou renegociar datas de pagamento para o começo do mês.`
    }))
    if (r.negFuturo.length) achados.push({ nivel: 'alerta', texto: `Pelo que está lançado, o caixa fica <b>negativo a partir de ${diaCx(r.negFuturo[0].dia)}</b> (${semanaCx(r.negFuturo[0].dia)}), chegando a ${curtoCx(r.piorFuturo?.valor)}. Veja em "Daqui para frente" o que dá para adiar.` })
    const bancos = (d.bancos || []).filter(b => !b.fora)
    if (bancos.length) {
        const pior = bancos.reduce((m, b) => (b.dias_sem_extrato || 0) > (m.dias_sem_extrato || 0) ? b : m, bancos[0])
        achados.push(medirCx('extrato_dias', pior.dias_sem_extrato || 0, {
            ok: 'Extratos em dia: o saldo é o do banco.',
            atencao: `O extrato de <b>${escFin(pior.nome)}</b> está ${pior.dias_sem_extrato} dias atrás: o saldo desses dias depende do que foi baixado no GCS.`,
            alerta: `O extrato de <b>${escFin(pior.nome)}</b> está <b>${pior.dias_sem_extrato} dias atrás</b>: o saldo mostrado pode estar bem diferente do banco. Importe o OFX antes de confiar nesta seção.`
        }))
    }
    return leituraCx(achados)
}

// ---- Saldo e movimento
function leituraSaldoCx(d, r, meses) {
    const k = d.kpis
    const achados = []
    const resultado = r.entrou - r.saiu
    if (r.entrou || r.saiu) achados.push({
        nivel: resultado >= 0 ? 'ok' : r.saiu && -resultado / r.saiu > 0.1 ? 'atencao' : 'info',
        texto: `No período entrou ${curtoCx(r.entrou)} e saiu ${curtoCx(r.saiu)}: <b>${resultado >= 0 ? 'sobrou' : 'faltou'} ${curtoCx(Math.abs(resultado))}</b>${r.entrou ? ` (as saídas foram ${numCx(pctNumCx(r.saiu, r.entrou), 0)}% das entradas)` : ''}.${resultado < 0 ? ' Quem cobriu a diferença foi o caixa que já existia.' : ''}`
    })
    const fechados = meses.filter(m => m.passado && !m.futuro)
    if (fechados.length >= 2) {
        const res = m => m.entradas - m.saidas
        const melhor = fechados.reduce((a, m) => res(m) > res(a) ? m : a)
        const pior = fechados.reduce((a, m) => res(m) < res(a) ? m : a)
        achados.push({ nivel: 'info', texto: `Melhor mês: <b>${mesCx(melhor.chave)}</b> (${curtoCx(res(melhor))}); pior: <b>${mesCx(pior.chave)}</b> (${curtoCx(res(pior))}).${res(pior) < 0 ? ' Olhe o que concentrou saídas nele (Distribuição dos custos, com o período desse mês).' : ''}` })
    }
    const te = k.tendencia_entradas, ts = k.tendencia_saidas
    if (te && ts) {
        const gap = ts.pct - te.pct
        achados.push({
            nivel: gap > 3 ? 'atencao' : 'info',
            texto: `Tendência dos meses fechados: entradas ${te.pct >= 0 ? 'sobem' : 'caem'} ${numCx(Math.abs(te.pct))}% ao mês e saídas ${ts.pct >= 0 ? 'sobem' : 'caem'} ${numCx(Math.abs(ts.pct))}% ao mês.${gap > 3 ? ' <b>As saídas crescem mais rápido que as entradas</b>: mantido o ritmo, a margem vai encolhendo mês a mês.' : gap < -3 ? ' As entradas crescem mais rápido que as saídas: a margem está melhorando.' : ''}`
        })
    }
    const abaixo = meses.reduce((s, m) => s + m.abaixo, 0)
    if (k.reserva && abaixo) achados.push({ nivel: 'atencao', texto: `${abaixo} dia(s) do período abaixo da reserva mínima de ${curtoCx(k.reserva)}.` })
    return leituraCx(achados)
}

// ---- Entre empresas (desenhada quando os movimentos chegam)
function leituraEntreCx(pares, fim) {
    if (!pares.length) return leituraCx([{ nivel: 'ok', texto: 'Nenhuma empresa usou dinheiro da outra no período.' }])
    const achados = pares.slice(0, 4).map(p => {
        const deve = p.saldo > 0 ? p.b : p.a, credor = p.saldo > 0 ? p.a : p.b
        return medirCx('entre_empresas_saldo', Math.abs(p.saldo), {
            ok: `${escFin(deve)} deve ${curtoCx(Math.abs(p.saldo))} à ${escFin(credor)}: valor pequeno, acerto simples.`,
            atencao: `<b>${escFin(deve)} deve ${curtoCx(Math.abs(p.saldo))} à ${escFin(credor)}</b> até ${diaCx(fim)}. Já é mútuo de valor relevante: combine o acerto ou formalize com a contabilidade.`,
            alerta: `<b>${escFin(deve)} deve ${curtoCx(Math.abs(p.saldo))} à ${escFin(credor)}</b> até ${diaCx(fim)}. Mútuo desse tamanho precisa de contrato e acerto periódico (IOF e efeito no imposto de cada empresa): leve à contabilidade.`
        })
    })
    const giro = pares.reduce((s, p) => s + p.ab + p.ba, 0)
    if (giro) achados.push({ nivel: 'info', texto: `No período, ${curtoCx(giro)} passaram de uma empresa para outra. Pagar conta da outra empresa pela própria conta é o que mais cria esse saldo: sempre que der, pague pela conta da dona da fatura.` })
    return leituraCx(achados)
}

// ---- Daqui para frente
function leituraFrenteCx(d) {
    const k = d.kpis
    const a = d.atrasados
    const achados = []
    if (k.cobertura_30 !== null && k.cobertura_30 !== undefined) achados.push(medirCx('cobertura_30', k.cobertura_30, {
        ok: `Nos próximos 30 dias entram ${curtoCx(k.entradas_30)} para ${curtoCx(k.saidas_30)} lançados (${numCx(k.cobertura_30, 2)}×): as entradas pagam as contas com folga.`,
        atencao: `Nos próximos 30 dias entram ${curtoCx(k.entradas_30)} para ${curtoCx(k.saidas_30)} lançados (<b>${numCx(k.cobertura_30, 2)}×</b>): fica no zero a zero, qualquer atraso de cliente sai do caixa.`,
        alerta: `Nos próximos 30 dias entram só ${curtoCx(k.entradas_30)} para ${curtoCx(k.saidas_30)} lançados (<b>${numCx(k.cobertura_30, 2)}×</b>): faltam ${curtoCx(k.saidas_30 - k.entradas_30)} que vão sair do caixa. Confira se há faturamento ainda não lançado como fatura a receber.`
    }))
    if (k.gasto_dia_90 > 0) {
        const v = (k.gasto_dia_30 / k.gasto_dia_90 - 1) * 100
        achados.push(medirCx('gasto_variacao_pct', v, {
            ok: v < -10 ? `O gasto por dia caiu ${numCx(-v, 0)}% nos últimos 30 dias (${curtoCx(k.gasto_dia_30)}/dia contra ${curtoCx(k.gasto_dia_90)} na média de 90).` : `Gasto por dia estável (${curtoCx(k.gasto_dia_30)}/dia nos últimos 30 dias).`,
            atencao: `O gasto por dia subiu <b>${numCx(v, 0)}%</b> nos últimos 30 dias (${curtoCx(k.gasto_dia_30)} contra ${curtoCx(k.gasto_dia_90)} na média de 90). Veja na Distribuição dos custos o que puxou.`,
            alerta: `O gasto por dia subiu <b>${numCx(v, 0)}%</b> nos últimos 30 dias (${curtoCx(k.gasto_dia_30)} contra ${curtoCx(k.gasto_dia_90)}). Se não for algo pontual (compra grande, 13º), o caixa não acompanha por muito tempo.`
        }))
    }
    const entradaMes = (k.entrada_dia_90 || 0) * 30
    if (a.RECEBER.valor > 0 && entradaMes > 0) {
        const v = pctNumCx(a.RECEBER.valor, entradaMes)
        const antigo = (a.RECEBER.faixas.ate180 || 0) + (a.RECEBER.faixas.mais || 0)
        achados.push(medirCx('inadimplencia_pct', v, {
            ok: `A receber em atraso: ${curtoCx(a.RECEBER.valor)} (${numCx(v, 0)}% do que entra num mês). Normal.`,
            atencao: `A receber em atraso: <b>${curtoCx(a.RECEBER.valor)}</b> em ${a.RECEBER.n} faturas, ${numCx(v, 0)}% do que entra num mês. Uma rodada de cobrança agora evita que vire perda.`,
            alerta: `A receber em atraso: <b>${curtoCx(a.RECEBER.valor)}</b> em ${a.RECEBER.n} faturas, <b>${numCx(v, 0)}% do que entra num mês</b>.${antigo ? ` ${curtoCx(antigo)} passaram de 90 dias: confira se não foram recebidos sem baixa (Conciliação) antes de cobrar.` : ''}`
        }))
        if (achados[achados.length - 1]) achados[achados.length - 1].acao = `<button type="button" class="fis-mini" onclick="telaFaturasFin('RECEBER', { situacao: { op: '=', value: 'ATRASADO' } })">Ver a receber em atraso</button>`
    }
    if (a.PAGAR.valor > 0) {
        const antigo = (a.PAGAR.faixas.ate180 || 0) + (a.PAGAR.faixas.mais || 0)
        const v = pctNumCx(antigo, a.PAGAR.valor)
        const x = medirCx('atraso_pagar_antigo_pct', v, {
            ok: `A pagar em atraso: ${curtoCx(a.PAGAR.valor)}, quase tudo recente.`,
            atencao: `A pagar em atraso: ${curtoCx(a.PAGAR.valor)}, dos quais <b>${curtoCx(antigo)} há mais de 90 dias</b>. Provavelmente pagos sem baixa: concilie para limpar a previsão.`,
            alerta: `A pagar em atraso: ${curtoCx(a.PAGAR.valor)}, dos quais <b>${curtoCx(antigo)} (${numCx(v, 0)}%) há mais de 90 dias</b>. Isso quase sempre é fatura paga sem baixa ou lançada em dobro, e distorce a previsão: vale um mutirão na Conciliação.`
        })
        if (x) { x.acao = `<button type="button" class="fis-mini" onclick="telaFaturasFin('PAGAR', { situacao: { op: '=', value: 'ATRASADO' } })">Ver a pagar em atraso</button>`; achados.push(x) }
    }
    if (d.tem_saldo && k.proxima_semana && k.proxima_semana.saldo_fim < 0)
        achados.push({ nivel: 'alerta', texto: `A <b>semana que vem</b> fecha com saldo de ${curtoCx(k.proxima_semana.saldo_fim)} pelo que está lançado.` })
    else if (d.tem_saldo && k.livre <= 0)
        achados.push({ nivel: 'atencao', texto: `Sem folga para gastos novos nos próximos ${k.horizonte} dias: só com nova entrada ou adiando contas.` })
    const ja = d.ja_no_extrato
    if (ja && (ja.PAGAR.n + ja.RECEBER.n) > 0)
        achados.push({ nivel: 'info', texto: `${ja.PAGAR.n + ja.RECEBER.n} fatura(s) em aberto já aparecem no extrato: ficaram fora da previsão, mas precisam da baixa na Conciliação para os números baterem.` })
    return leituraCx(achados)
}

// ---- Distribuição dos custos
function leituraDistribuicaoCx(x) {
    const achados = []
    const total = Number(x.total) || 0
    const semCat = x.categorias.find(c => c.nome === 'Sem categoria')
    const vSemCat = pctNumCx(semCat?.valor || 0, total)
    achados.push(medirCx('sem_categoria_pct', vSemCat, {
        ok: semCat ? `Só ${numCx(vSemCat)}% do custo está sem categoria: a leitura por categoria é confiável.` : 'Todo o custo do período tem categoria.',
        atencao: `<b>${numCx(vSemCat)}% do custo (${curtoCx(semCat?.valor)}) está sem categoria</b>: as fatias por categoria ficam aproximadas.`,
        alerta: `<b>${numCx(vSemCat, 0)}% do custo (${curtoCx(semCat?.valor)}) está sem categoria</b>: não dá para avaliar com precisão para onde o dinheiro foi. Categorize essas faturas antes de tirar conclusões.`
    }))
    const semDep = x.departamentos.find(dp => dp.tipo === 'NENHUM')
    const vSemDep = pctNumCx(semDep?.valor || 0, total)
    achados.push(medirCx('sem_departamento_pct', vSemDep, {
        ok: semDep ? `${numCx(vSemDep)}% do custo sem departamento: o custo das obras está bem apropriado.` : 'Todo o custo do período tem departamento.',
        atencao: `<b>${numCx(vSemDep, 0)}% do custo (${curtoCx(semDep?.valor)}) está sem departamento</b>: esse valor não chega a nenhuma obra nem setor.`,
        alerta: `<b>${numCx(vSemDep, 0)}% do custo (${curtoCx(semDep?.valor)}) está sem departamento</b>: a margem dos orçamentos aparece melhor do que é. Rateie as faturas (e use o rateio automático nos lotes).`
    }))
    const semPessoal = x.categorias.filter(c => !String(c.codigo || '').startsWith('2.03') && c.nome !== 'Sem categoria')
    if (semPessoal.length) {
        const maior = semPessoal[0]
        const v = pctNumCx(maior.valor, total)
        achados.push(medirCx('concentracao_categoria_pct', v, {
            ok: `Maior categoria fora pessoal: ${escFin(maior.nome)} (${numCx(v, 0)}%). Custos bem distribuídos.`,
            atencao: `<b>${escFin(maior.nome)}</b> sozinha é ${numCx(v, 0)}% do custo do período (${curtoCx(maior.valor)}): acompanhe de perto e negocie preço/prazo com os principais fornecedores dela.`,
            alerta: `<b>${escFin(maior.nome)}</b> sozinha é ${numCx(v, 0)}% do custo do período (${curtoCx(maior.valor)}). Qualquer variação nela muda o resultado do mês inteiro.`
        }))
    }
    const setores = x.departamentos.filter(dp => dp.tipo === 'SETOR').reduce((s, dp) => s + Number(dp.valor), 0)
    const obras = x.departamentos.filter(dp => dp.tipo === 'CONTRATO').reduce((s, dp) => s + Number(dp.valor), 0)
    if (setores + obras > 0) achados.push({ nivel: 'info', texto: `${numCx(pctNumCx(obras, total), 0)}% do custo foi para obras (ORC) e ${numCx(pctNumCx(setores, total), 0)}% para setores (estrutura). Quanto maior a parte da estrutura, mais cada obra precisa render para pagá-la.` })
    const ant = x.anterior
    if (ant && Number(ant.total) > 0) {
        const v = (total / Number(ant.total) - 1) * 100
        const antes = new Map(ant.categorias.map(c => [c.nome, Number(c.valor)]))
        const subiu = x.categorias.map(c => ({ nome: c.nome, dif: Number(c.valor) - (antes.get(c.nome) || 0) })).sort((a, b) => b.dif - a.dif).filter(c => c.dif > 0).slice(0, 3)
        const puxou = subiu.length ? ` Mais subiram: ${subiu.map(c => `${escFin(c.nome)} (+${curtoCx(c.dif)})`).join(', ')}.` : ''
        achados.push(medirCx('custo_variacao_pct', v, n => ({
            ok: `Custo ${v >= 0 ? 'subiu' : 'caiu'} ${numCx(Math.abs(v), 0)}% contra ${nomeAnteriorCx(ant)} (${curtoCx(ant.total)}): estável.`,
            atencao: `Custo <b>${v >= 0 ? 'subiu' : 'caiu'} ${numCx(Math.abs(v), 0)}%</b> contra ${nomeAnteriorCx(ant)} (${curtoCx(ant.total)} → ${curtoCx(total)}).${v >= 0 ? puxou : ' Confira se não ficou fatura sem lançar.'}`,
            alerta: `Custo <b>${v >= 0 ? 'subiu' : 'caiu'} ${numCx(Math.abs(v), 0)}%</b> contra ${nomeAnteriorCx(ant)} (${curtoCx(ant.total)} → ${curtoCx(total)}).${v >= 0 ? puxou : ' Queda grande assim costuma ser lançamento faltando (folha, impostos, fornecedores do mês).'}`
        })[n]))
    }
    const aberto = total - Number(x.pago)
    if (aberto > 0 && x.periodo.ate < hojeCx()) achados.push({ nivel: 'atencao', texto: `O período já acabou e ainda há ${curtoCx(aberto)} em aberto (${numCx(pctNumCx(aberto, total), 0)}%): ou está atrasado, ou foi pago sem baixa.` })
    return leituraCx(achados)
}

// ---- Pessoal por setor
function leituraPessoalCx(x) {
    const achados = []
    const totalPessoal = x.setores.reduce((s, v) => s + Number(v.valor), 0)
    const v = pctNumCx(totalPessoal, x.total)
    achados.push(medirCx('pessoal_pct', v, {
        ok: `Pessoal é ${numCx(v, 0)}% do custo do período (${curtoCx(totalPessoal)}), dentro do usual para empresa de serviço técnico.`,
        atencao: v > 50 ? `Pessoal é <b>${numCx(v, 0)}% do custo</b> (${curtoCx(totalPessoal)}): acima do usual, a margem depende muito de produtividade nas obras.`
            : `Pessoal é só <b>${numCx(v, 0)}% do custo</b> (${curtoCx(totalPessoal)}): confira se salários, vales ou prestadores não estão em outras categorias.`,
        alerta: v > 50 ? `Pessoal é <b>${numCx(v, 0)}% do custo</b>: bem acima do usual. Compare com o faturamento do período antes de contratar.`
            : `Pessoal é só <b>${numCx(v, 0)}% do custo</b>: quase certo que parte da folha não foi lançada neste período ou está em outra categoria.`
    }))
    const soma = g => x.setores.reduce((s, st) => s + Number(st.grupos?.[g] || 0), 0)
    const salarios = soma('Salários'), beneficios = soma('Refeição') + soma('Transporte')
    if (salarios > 0) {
        const b = pctNumCx(beneficios, salarios)
        achados.push(medirCx('beneficios_pct', b, {
            ok: `Refeição + transporte = ${numCx(b, 0)}% dos salários.`,
            atencao: b < 8 ? `Refeição + transporte = só <b>${numCx(b, 0)}% dos salários</b>: algum lote do mês (vale refeição ou transporte) pode não ter sido lançado.` : `Refeição + transporte = <b>${numCx(b, 0)}% dos salários</b>: acima do usual, vale conferir os dias e valores dos lotes.`,
            alerta: b < 8 ? `Refeição + transporte = <b>${numCx(b, 0)}% dos salários</b>: os lotes de vale refeição/transporte do mês provavelmente não foram lançados.` : `Refeição + transporte = <b>${numCx(b, 0)}% dos salários</b>: muito acima do usual; confira lançamentos em dobro.`
        }))
    }
    const sem = x.setores.find(s => s.nome === 'Sem setor definido')
    achados.push(medirCx('sem_setor_pct', pctNumCx(sem?.valor || 0, totalPessoal), {
        ok: sem ? `Só ${curtoCx(sem.valor)} de pessoal sem setor.` : 'Todo o pessoal do período tem setor.',
        atencao: `<b>${curtoCx(sem?.valor)} (${numCx(pctNumCx(sem?.valor, totalPessoal), 0)}%) de pessoal sem setor</b> (${sem?.pessoas} pessoas): use "Definir setor" na lista abaixo.`,
        alerta: `<b>${curtoCx(sem?.valor)} (${numCx(pctNumCx(sem?.valor, totalPessoal), 0)}%) de pessoal sem setor</b> (${sem?.pessoas} pessoas): a divisão por setor ainda não é confiável. Defina o setor na lista abaixo.`
    }))
    const com = x.setores.filter(s => s.nome !== 'Sem setor definido' && s.pessoas)
    if (com.length) {
        const maior = com[0]
        const porPessoa = com.map(s => ({ nome: s.nome, v: Number(s.valor) / s.pessoas })).sort((a, b) => b.v - a.v)
        achados.push({ nivel: 'info', texto: `<b>${escFin(maior.nome)}</b> é o setor que mais custa (${curtoCx(maior.valor)}, ${numCx(pctNumCx(maior.valor, totalPessoal), 0)}% do pessoal). Custo médio por pessoa no período: ${porPessoa.slice(0, 4).map(s => `${escFin(s.nome)} ${curtoCx(s.v)}`).join(' · ')}.` })
    }
    const ant = x.anterior
    if (ant?.setores?.length) {
        const antes = new Map(ant.setores.map(s => [s.nome, Number(s.valor)]))
        const mudou = x.setores.map(s => ({ nome: s.nome, dif: Number(s.valor) - (antes.get(s.nome) || 0), antes: antes.get(s.nome) || 0 }))
            .filter(s => s.antes > 0 && Math.abs(s.dif) / s.antes > 0.2 && Math.abs(s.dif) > 1000)
        if (mudou.length) achados.push({ nivel: 'atencao', texto: `Mudou mais de 20% contra ${nomeAnteriorCx(ant)}: ${mudou.map(s => `${escFin(s.nome)} ${s.dif > 0 ? '+' : '−'}${curtoCx(Math.abs(s.dif))}`).join(' · ')}. Admissão, desligamento, troca de setor ou lote faltando?` })
    }
    return leituraCx(achados)
}

// ---- Custos por estado
function leituraEstadosCx(x) {
    const achados = []
    const comEstado = x.estados.reduce((s, e) => s + Number(e.quantidade), 0)
    if (!comEstado) return leituraCx([{ nivel: 'info', texto: 'Nenhum custo do período está ligado a orçamento com estado: o mapa fica vazio.' }])
    const maior = x.estados[0]
    const v = pctNumCx(maior.quantidade, comEstado)
    achados.push(medirCx('concentracao_estado_pct', v, {
        ok: `${escFin(maior.uf)} concentra ${numCx(v, 0)}% do custo de obras do período; o restante se espalha por ${x.estados.length - 1} estado(s).`,
        atencao: `<b>${escFin(maior.uf)} concentra ${numCx(v, 0)}%</b> do custo de obras do período (${curtoCx(maior.quantidade)}).`,
        alerta: `<b>${escFin(maior.uf)} concentra ${numCx(v, 0)}%</b> do custo de obras: a operação depende quase toda de uma região.`
    }))
    const longe = x.estados.filter(e => e.uf !== maior.uf)
    if (longe.length) {
        const somaLonge = longe.reduce((s, e) => s + Number(e.quantidade), 0)
        achados.push({ nivel: 'info', texto: `Fora de ${escFin(maior.uf)}: ${curtoCx(somaLonge)} em ${longe.length} estado(s), ${longe.reduce((s, e) => s + Number(e.departamentos || 0), 0)} orçamento(s). Obra longe costuma ter deslocamento, hospedagem e alimentação extras: confira se o preço desses orçamentos cobriu isso.` })
    }
    const sem = pctNumCx(x.sem_estado, x.total)
    if (sem > 40) achados.push({ nivel: 'info', texto: `${numCx(sem, 0)}% do custo do período não tem estado (setores, sem departamento ou cliente sem UF): o mapa mostra só a parte das obras.` })
    return leituraCx(achados)
}

// ---- Almanaque: as réguas da leitura (ver e, com financeiro.planejamento, ajustar)
function almanaqueCx(foco = null) {
    const lista = estadoCx.dados?.almanaque || []
    if (!lista.length) return popup({ mensagem: 'O almanaque ainda não foi carregado.' })
    const editar = Boolean(estadoCx.dados?.pode_planejar)
    const campo = (a, k) => `<input class="fis-input fis-num cx-alm-num" type="number" step="any" name="${k}" value="${a[k] ?? ''}" placeholder="—" ${editar ? '' : 'disabled'}>`
    const grupos = [...new Set(lista.map(a => a.grupo))]
    popup({
        titulo: 'Almanaque financeiro',
        linhas: [{ elemento: `
            <div class="cx-almanaque">
                <p>As réguas que a <b>Leitura do sistema</b> usa. Dentro da faixa <b>boa</b> = em ordem; fora dela mas dentro da <b>aceitável</b> = atenção; fora das duas = alerta. Vazio = sem limite.
                ${editar ? 'Ajuste para a realidade da empresa: cada troca fica no histórico.' : 'Só quem define o planejamento ajusta.'}</p>
                ${grupos.map(g => `
                <h4>${escFin(g)}</h4>
                ${lista.filter(a => a.grupo === g).map(a => `
                <div class="cx-alm-item${a.chave === foco ? ' foco' : ''}" data-alm="${escFin(a.chave)}">
                    <div class="cx-alm-titulo"><b>${escFin(a.titulo)}</b> <small>(${escFin(a.unidade)})</small></div>
                    <div class="cx-alm-faixas">
                        <label>Boa ${campo(a, 'ok_min')} a ${campo(a, 'ok_max')}</label>
                        <label>Aceitável ${campo(a, 'aceitavel_min')} a ${campo(a, 'aceitavel_max')}</label>
                        ${editar ? `<button type="button" class="fis-mini" onclick="salvarAlmanaqueCx(this)">Salvar</button>` : ''}
                    </div>
                    <small>${escFin(a.explicacao)}${a.fonte ? `<br><i>Fonte: ${escFin(a.fonte)}</i>` : ''}${a.atualizado_por ? `<br>Ajustado por ${escFin(a.atualizado_por)} em ${escFin(String(a.atualizado_em || '').slice(0, 10).split('-').reverse().join('/'))}` : ''}</small>
                </div>`).join('')}`).join('')}
            </div>` }]
    })
    if (foco) setTimeout(() => document.querySelector(`.cx-alm-item.foco`)?.scrollIntoView({ block: 'center' }), 50)
}

async function salvarAlmanaqueCx(botao) {
    const item = botao.closest('[data-alm]')
    const v = k => item.querySelector(`[name="${k}"]`).value
    try {
        botao.disabled = true
        const r = await apiFin('almanaque/salvar', { chave: item.dataset.alm, ok_min: v('ok_min'), ok_max: v('ok_max'), aceitavel_min: v('aceitavel_min'), aceitavel_max: v('aceitavel_max') })
        estadoCx.dados.almanaque = r.almanaque
        botao.textContent = 'Salvo'
        desenharFluxoCaixa()
        if (estadoCx.dist) desenharDistribuicaoCx()
    } catch (err) {
        botao.disabled = false
        popup({ mensagem: mensagemErroEst(err) })
    }
}

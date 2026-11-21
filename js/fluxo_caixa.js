// ---------------- Financeiro → Fluxo de Caixa (21/11/2026) ----------------
// Dados: POST financeiro/fluxo (gcs SCRIPTS/financeiro_fluxo.js). Responde, nesta ordem:
//   quanto dá para gastar (livre = menor saldo previsto no horizonte − reserva mínima; por dia útil),
//   se há dinheiro na semana que vem, quando o saldo fica abaixo da reserva, e de onde vem / para onde vai.
// Duas linhas para frente: "Lançado" (faturas em aberto + reembolsos pedidos) e "Com previsões" (+ o que costuma
// acontecer todo mês e ainda não foi lançado). O livre usa o pior das duas.
// Saldo de partida = só contas conferidas com o extrato (Conferir saldos). Planejamento = reserva, regras dos
// atrasados e a trava dos pedidos de pagamento (só quem tem financeiro.planejamento).
// Cores (dataviz): entradas azul, saídas laranja, previsões violeta tracejado, reserva vermelho; um eixo por gráfico.

const CORES_CX = {
    entrada: '#2a78d6', entradaClara: '#9ec5f4',
    saida: '#eb6834', saidaClara: '#f6b899',
    saldo: '#2a78d6', previsao: '#6250d6', reserva: '#e34948',
    texto: '#52514e', grade: '#ecebe7'
}
const estadoCx = { app: '', futuro: 90, passado: 90, dados: null, graficos: [] }
const MESES_CX = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const ROTULO_ATRASO_CX = { NAO: 'Não entram', 30: 'Só os de até 30 dias', TODOS: 'Todos' }
const ROTULO_TRAVA_CX = {
    DESLIGADA: 'Desligada: todos pedem pagamento normalmente',
    AUTOMATICA: 'Automática: trava sozinha quando o caixa previsto não comporta',
    LIGADA: 'Ligada: ninguém (fora os liberados) pede pagamento'
}

const diaCx = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : ''
const mesCx = ym => `${MESES_CX[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`
const semanaCx = iso => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${iso}T12:00:00Z`).getUTCDay()]
const somarDiasCx = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const segundaCx = iso => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
// R$ curto para eixos e cartões pequenos: R$ 1,2 mi / R$ 350 mil / R$ 980.
function curtoCx(v) {
    const n = Number(v) || 0, a = Math.abs(n), s = n < 0 ? '−' : ''
    if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    if (a >= 1e4) return `${s}R$ ${Math.round(a / 1e3).toLocaleString('pt-BR')} mil`
    return `${s}R$ ${Math.round(a).toLocaleString('pt-BR')}`
}
const sinalCx = v => Number(v) < 0 ? 'cx-neg' : ''

async function telaFluxoCaixa() {
    if (typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()
    // Overlay desde o clique no menu: a consulta leva alguns segundos e a tela parecia travada.
    overlayAguarde()
    let op = { empresas: [] }
    try { op = await carregarOpcoesFin() } catch { }
    tela.innerHTML = `
        <div class="fis-pagina cx-pagina">
            <header class="cx-topo">
                <div>
                    <h2>Fluxo de Caixa</h2>
                    <small>Quanto dá para gastar, se há dinheiro na semana que vem e o que está por vir.</small>
                </div>
                <div class="cx-filtros" role="group" aria-label="Filtros">
                    <label>Empresa
                        <select onchange="estadoCx.app = this.value; carregarFluxoCaixa()">
                            <option value="">Todas (consolidado)</option>
                            ${(op.empresas || []).map(e => `<option value="${escFin(e.app)}" ${estadoCx.app === e.app ? 'selected' : ''}>${escFin(e.app)}</option>`).join('')}
                        </select>
                    </label>
                    <label>Olhar para frente
                        <select onchange="estadoCx.futuro = Number(this.value); carregarFluxoCaixa()">
                            ${[30, 60, 90, 180].map(n => `<option value="${n}" ${estadoCx.futuro === n ? 'selected' : ''}>${n} dias</option>`).join('')}
                        </select>
                    </label>
                    <label>Histórico
                        <select onchange="estadoCx.passado = Number(this.value); carregarFluxoCaixa()">
                            ${[30, 90, 180].map(n => `<option value="${n}" ${estadoCx.passado === n ? 'selected' : ''}>${n} dias</option>`).join('')}
                        </select>
                    </label>
                    <div class="cx-acoes" data-cx-acoes></div>
                </div>
            </header>
            <div data-cx-corpo><div class="cx-carregando">Calculando o fluxo…</div></div>
        </div>`
    await carregarFluxoCaixa()
}

async function carregarFluxoCaixa() {
    const corpo = document.querySelector('[data-cx-corpo]')
    if (!corpo) return removerOverlay()
    corpo.classList.add('cx-atualizando')
    overlayAguarde()
    try {
        estadoCx.dados = await apiFin('fluxo', { app: estadoCx.app || null, futuro: estadoCx.futuro, passado: estadoCx.passado })
        desenharFluxoCaixa()
    } catch (err) {
        corpo.innerHTML = `<div class="fis-vazio">Não deu para calcular o fluxo: ${mensagemErroEst(err)}
            <button type="button" class="fis-mini" onclick="carregarFluxoCaixa()">Tentar de novo</button></div>`
    } finally {
        corpo.classList.remove('cx-atualizando')
        removerOverlay()
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

    const semanas = semanasCx(d)
    corpo.innerHTML = `
        ${avisosCx(d)}
        <section class="cx-respostas" aria-label="Respostas rápidas">
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
            ${cartaoCx({
                titulo: 'Saldo hoje (contas conferidas)', valor: k.saldo_hoje,
                nota: d.tem_saldo
                    ? `${d.contas.filter(c => c.no_saldo).length} de ${d.contas.length} contas no saldo${k.folego_dias !== null ? ` · dá para ${k.folego_dias} dias no ritmo atual` : ''}`
                    : 'Nenhuma conta conferida com o extrato ainda.'
            })}
        </section>

        <section class="cx-indicadores" aria-label="Indicadores">
            ${miniCx('Gasto médio por dia (30 dias)', dinheiro(k.gasto_dia_30), comparacaoCx(k.gasto_dia_30, k.gasto_dia_90, 'que a média de 90 dias', true))}
            ${miniCx('Entrada média por dia (90 dias)', dinheiro(k.entrada_dia_90), k.gasto_dia_90 ? `${k.entrada_dia_90 >= k.gasto_dia_90 ? 'Acima' : 'Abaixo'} do gasto médio (${dinheiro(k.gasto_dia_90)})` : '')}
            ${miniCx('Cobertura dos próximos 30 dias', k.cobertura_30 === null ? '—' : `${k.cobertura_30.toLocaleString('pt-BR')}×`, `Entra ${dinheiro(k.entradas_30)} para ${dinheiro(k.saidas_30)} lançados`, k.cobertura_30 !== null && k.cobertura_30 < 1)}
            ${miniCx('Tendência das saídas', tendenciaCx(k.tendencia_saidas), 'Ritmo dos últimos 12 meses fechados', k.tendencia_saidas?.por_mes > 0)}
            ${miniCx('Tendência das entradas', tendenciaCx(k.tendencia_entradas), 'Ritmo dos últimos 12 meses fechados', k.tendencia_entradas?.por_mes < 0)}
            ${miniCx('A receber em atraso', dinheiro(d.atrasados.RECEBER.valor), `${d.atrasados.RECEBER.n} faturas · ${d.atrasados.RECEBER.incluido ? `${dinheiro(d.atrasados.RECEBER.incluido)} contados hoje` : 'fora do saldo previsto'}`, d.atrasados.RECEBER.valor > 0)}
            ${miniCx('A pagar em atraso', dinheiro(d.atrasados.PAGAR.valor), `${d.atrasados.PAGAR.n} faturas · ${dinheiro(d.atrasados.PAGAR.incluido)} contados hoje`, d.atrasados.PAGAR.valor > 0)}
            ${miniCx('Reembolsos esperando aprovação', dinheiro(d.reembolsos_pendentes), 'Já entram no saldo lançado')}
        </section>

        <section class="cx-bloco">
            <div class="cx-bloco-topo">
                <h3>Saldo dia a dia</h3>
                <small>Linha cheia: real até hoje e o que já está lançado. Tracejada: com as previsões pela média.${k.reserva ? ' Vermelha: reserva mínima.' : ''}</small>
            </div>
            <div class="cx-grafico cx-grafico-alto"><canvas data-cx-saldo aria-label="Saldo diário" role="img"></canvas></div>
        </section>

        <section class="cx-bloco">
            <div class="cx-bloco-topo">
                <h3>Semana a semana</h3>
                <small>Cada semana de segunda a domingo. A parte clara das barras é previsão pela média (ainda não lançada).</small>
            </div>
            <div class="cx-grafico"><canvas data-cx-semanas aria-label="Entradas e saídas por semana" role="img"></canvas></div>
            ${tabelaSemanasCx(semanas, k.reserva)}
        </section>

        <section class="cx-bloco">
            <div class="cx-bloco-topo">
                <h3>Mês a mês e tendência</h3>
                <small>Meses fechados: o que entrou e saiu de verdade. Mês atual e próximos: realizado + lançado + previsão (parte clara). Linhas tracejadas: tendência.</small>
            </div>
            <div class="cx-grafico"><canvas data-cx-meses aria-label="Entradas e saídas por mês" role="img"></canvas></div>
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
                    <li><b>Saldo hoje</b>: só as contas que o financeiro conferiu com o extrato (botão Conferir saldos). Conta sem conferência fica fora para não distorcer.</li>
                    <li><b>Lançado</b>: saldo + tudo que está nas faturas a pagar e a receber, no dia do vencimento, mais os reembolsos pedidos que esperam aprovação.</li>
                    <li><b>Com previsões</b>: soma o que acontece todo mês (categoria presente em 3 dos 4 últimos meses) e ainda falta lançar, no dia de costume, pela média dos 3 últimos meses.</li>
                    <li><b>Livre para gastar</b>: o menor saldo do período, pelo pior das duas linhas, menos a reserva mínima. É o que dá para comprometer sem o caixa furar a reserva em nenhum dia.</li>
                    <li><b>Atrasados</b>: hoje ${escFin(ROTULO_ATRASO_CX[d.plan.atrasados_pagar].toLowerCase())} os a pagar e ${escFin(ROTULO_ATRASO_CX[d.plan.atrasados_receber].toLowerCase())} os a receber (entram como se fossem pagos hoje). Muda em Planejamento e trava.</li>
                    <li><b>Trava</b>: com a trava ligada ou automática sem folga, o servidor recusa novos pedidos em Reembolsos → Solicitar Pagamento (menos para quem estiver liberado na Central de acessos).</li>
                </ul>
            </details>
        </section>`

    estadoCx.graficos.forEach(g => g?.destroy())
    estadoCx.graficos = [graficoSaldoCx(d), graficoSemanasCx(semanas), graficoMesesCx(d)]
}

// ---------------- pedaços

function avisosCx(d) {
    const k = d.kpis
    const avisos = []
    if (!d.tem_saldo) avisos.push(['alerta', `O saldo de partida está em R$ 0 porque nenhuma conta foi conferida com o extrato. As linhas mostram só a variação do caixa.
        ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="conferirSaldosCx()">Conferir saldos agora</button>' : ''}`])
    else {
        const faltam = d.contas.filter(c => !c.conferida && !c.fora && Math.abs(Number(c.saldo)) > 0.009)
        if (faltam.length) avisos.push(['info', `${faltam.length} conta(s) com movimento ainda sem conferência ficaram fora do saldo.
            ${d.pode_planejar ? '<button type="button" class="fis-mini" onclick="conferirSaldosCx()">Conferir</button>' : ''}`])
    }
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

const tendenciaCx = t => !t ? '—' : `${t.por_mes >= 0 ? '▲' : '▼'} ${curtoCx(Math.abs(t.por_mes))}/mês <small>(${t.pct > 0 ? '+' : ''}${t.pct.toLocaleString('pt-BR')}%)</small>`

function semanasCx(d) {
    const futuro = d.serie.filter(x => x.dia >= d.hoje)
    const semanas = new Map()
    for (const x of futuro) {
        const seg = segundaCx(x.dia)
        if (!semanas.has(seg)) semanas.set(seg, { de: seg, ate: somarDiasCx(seg, 6), entradas: 0, saidas: 0, entradas_prov: 0, saidas_prov: 0, menor: Infinity })
        const s = semanas.get(seg)
        s.entradas += x.entradas_previstas
        s.saidas += x.saidas_previstas + x.reembolsos
        s.entradas_prov += x.entradas_provaveis
        s.saidas_prov += x.saidas_provaveis
        s.fim = x.saldo_lancado
        s.fim_prev = x.saldo_previsao
        s.menor = Math.min(s.menor, x.saldo_lancado, x.saldo_previsao)
    }
    return [...semanas.values()]
}

function tabelaSemanasCx(semanas, reserva) {
    return `
        <div class="fis-tabela-rolagem cx-tabela-semanas">
            <table class="fis-tabela">
                <thead><tr><th>Semana</th><th class="fis-num">Entra (lançado)</th><th class="fis-num">Sai (lançado)</th><th class="fis-num">Resultado</th>
                    <th class="fis-num">Previsão a mais</th><th class="fis-num">Saldo no fim</th><th class="fis-num">Com previsões</th><th>Situação</th></tr></thead>
                <tbody>${semanas.map(s => {
                    const res = s.entradas - s.saidas
                    const prev = s.entradas_prov - s.saidas_prov
                    const situacao = s.menor < 0 ? ['perigo', 'Caixa negativo'] : s.menor < reserva ? ['alerta', 'Abaixo da reserva'] : ['ok', 'Com folga']
                    return `
                    <tr>
                        <td>${diaCx(s.de)} a ${diaCx(s.ate)}</td>
                        <td class="fis-num">${dinheiro(s.entradas)}</td>
                        <td class="fis-num">${dinheiro(s.saidas)}</td>
                        <td class="fis-num ${sinalCx(res)}">${dinheiro(res)}</td>
                        <td class="fis-num ${sinalCx(prev)}">${prev ? dinheiro(prev) : '—'}</td>
                        <td class="fis-num ${sinalCx(s.fim)}"><b>${dinheiro(s.fim)}</b></td>
                        <td class="fis-num ${sinalCx(s.fim_prev)}">${dinheiro(s.fim_prev)}</td>
                        <td><span class="cx-selo cx-selo-${situacao[0]}">${situacao[0] === 'ok' ? '●' : '▲'} ${situacao[1]}</span></td>
                    </tr>`
                }).join('')}</tbody>
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

// ---------------- gráficos (Chart.js, um eixo cada)

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

function baseOpcoesCx({ empilhado = false } = {}) {
    return {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { color: CORES_CX.texto, boxWidth: 12, boxHeight: 12, usePointStyle: false } },
            tooltip: {
                callbacks: {
                    label: c => c.raw === null || c.raw === undefined ? null : `${c.dataset.label}: ${dinheiroTexto(c.raw)}`
                }
            }
        },
        scales: {
            x: { stacked: empilhado, grid: { display: false }, ticks: { color: CORES_CX.texto, maxRotation: 0, autoSkipPadding: 14 } },
            y: { stacked: empilhado, grid: { color: CORES_CX.grade }, border: { display: false }, ticks: { color: CORES_CX.texto, callback: v => curtoCx(v) } }
        }
    }
}

function graficoSaldoCx(d) {
    const canvas = document.querySelector('[data-cx-saldo]')
    if (!canvas || typeof Chart === 'undefined') return null
    const serie = d.serie
    const hojeIdx = serie.findIndex(x => x.dia === d.hoje)
    const reserva = d.kpis.reserva
    const datasets = [
        {
            label: 'Real (até hoje)', data: serie.map(x => x.dia <= d.hoje ? x.saldo ?? null : null),
            borderColor: '#0b0b0b', backgroundColor: '#0b0b0b', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, spanGaps: false
        },
        {
            label: 'Lançado', data: serie.map(x => x.dia >= d.hoje ? x.saldo_lancado : null),
            borderColor: CORES_CX.saldo, backgroundColor: CORES_CX.saldo, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4
        },
        {
            label: 'Com previsões', data: serie.map(x => x.dia >= d.hoje ? x.saldo_previsao : null),
            borderColor: CORES_CX.previsao, backgroundColor: CORES_CX.previsao, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 4
        }
    ]
    if (reserva > 0) datasets.push({
        label: 'Reserva mínima', data: serie.map(() => reserva),
        borderColor: CORES_CX.reserva, backgroundColor: CORES_CX.reserva, borderWidth: 1.5, borderDash: [2, 3], pointRadius: 0, pointHoverRadius: 0
    })
    const opcoes = baseOpcoesCx()
    opcoes.scales.x.ticks.callback = function (v) { const dia = serie[v]?.dia; return dia ? diaCx(dia) : '' }
    opcoes.plugins.tooltip.callbacks.title = itens => { const dia = serie[itens[0].dataIndex]?.dia; return dia ? `${semanaCx(dia)} ${diaCx(dia)}` : '' }
    return new Chart(canvas, { type: 'line', data: { labels: serie.map((_, i) => i), datasets }, options: opcoes, plugins: [linhaHojeCx(hojeIdx)] })
}

function graficoSemanasCx(semanas) {
    const canvas = document.querySelector('[data-cx-semanas]')
    if (!canvas || typeof Chart === 'undefined') return null
    const barra = (label, data, cor, pilha) => ({
        label, data, backgroundColor: cor, stack: pilha, borderRadius: 4, borderSkipped: 'bottom',
        borderColor: '#fff', borderWidth: { top: 2 }, maxBarThickness: 26
    })
    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels: semanas.map(s => diaCx(s.de)),
            datasets: [
                barra('Entradas lançadas', semanas.map(s => s.entradas), CORES_CX.entrada, 'e'),
                barra('Entradas previstas', semanas.map(s => s.entradas_prov), CORES_CX.entradaClara, 'e'),
                barra('Saídas lançadas', semanas.map(s => s.saidas), CORES_CX.saida, 's'),
                barra('Saídas previstas', semanas.map(s => s.saidas_prov), CORES_CX.saidaClara, 's')
            ]
        },
        options: (() => {
            const o = baseOpcoesCx({ empilhado: true })
            o.plugins.tooltip.callbacks.title = itens => { const s = semanas[itens[0].dataIndex]; return `Semana ${diaCx(s.de)} a ${diaCx(s.ate)}` }
            return o
        })()
    })
}

// Tendência: reta pelos meses fechados (mínimos quadrados), esticada até o último mês do gráfico.
function retaCx(ys) {
    const n = ys.length
    if (n < 3) return null
    const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n
    let num = 0, den = 0
    ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2 })
    const b = den ? num / den : 0
    return i => my + b * (i - mx)
}

function graficoMesesCx(d) {
    const canvas = document.querySelector('[data-cx-meses]')
    if (!canvas || typeof Chart === 'undefined') return null
    const meses = d.mensal
    const fechados = meses.filter(m => !m.atual && !m.futuro)
    const retaE = retaCx(fechados.map(m => m.entradas))
    const retaS = retaCx(fechados.map(m => m.saidas))
    const barra = (label, data, cor, pilha) => ({
        type: 'bar', label, data, backgroundColor: cor, stack: pilha, borderRadius: 4, borderSkipped: 'bottom',
        borderColor: '#fff', borderWidth: { top: 2 }, maxBarThickness: 28, order: 2
    })
    const reta = (label, f, cor) => ({
        type: 'line', label, data: f ? meses.map((_, i) => Math.max(0, f(i))) : [], borderColor: cor, backgroundColor: cor,
        borderWidth: 2, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 3, stack: undefined, order: 1
    })
    const opcoes = baseOpcoesCx()
    opcoes.scales.x.stacked = true
    opcoes.scales.y.stacked = true // barras por pilha (entradas | saídas); cada reta tem pilha própria
    return new Chart(canvas, {
        data: {
            labels: meses.map(m => mesCx(m.mes)),
            datasets: [
                barra('Entradas', meses.map(m => m.entradas + m.entradas_lancadas), CORES_CX.entrada, 'e'),
                barra('Entradas previstas', meses.map(m => m.entradas_provaveis), CORES_CX.entradaClara, 'e'),
                barra('Saídas', meses.map(m => m.saidas + m.saidas_lancadas), CORES_CX.saida, 's'),
                barra('Saídas previstas', meses.map(m => m.saidas_provaveis), CORES_CX.saidaClara, 's'),
                { ...reta('Tendência das entradas', retaE, '#184f95'), stack: 'te' },
                { ...reta('Tendência das saídas', retaS, '#a8431b'), stack: 'ts' }
            ]
        },
        options: opcoes
    })
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
    for (const c of d.contas) { if (!porApp.has(c.app)) porApp.set(c.app, []); porApp.get(c.app).push(c) }
    popup({
        titulo: 'Conferir saldos com o extrato',
        confirmarFechar: false,
        linhas: [{ elemento: `
            <div class="fis-form cx-conferir" data-cx-conferir>
                <p class="cx-plan-nota">Digite o saldo que o <b>extrato do banco</b> mostra no <b>fim do dia</b> escolhido. A partir do dia seguinte o GCS soma
                    só os pagamentos e recebimentos registrados aqui. Deixe em branco o que não for conferir agora.
                    Desmarque "No fluxo" para contas que não são dinheiro disponível (cartão, empréstimo, conta de outra empresa).</p>
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>Conta</th><th class="fis-num">Saldo no GCS</th><th>Conferida</th><th class="fis-num">Saldo do extrato</th><th>No fim do dia</th><th>No fluxo</th></tr></thead>
                        <tbody>${[...porApp].map(([app, contas]) => `
                            <tr class="cx-grupo"><td colspan="6">${escFin(app)}</td></tr>
                            ${contas.map(c => `
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
    const contas = linhas.filter(l => l.querySelector('[name="saldo"]').value !== '')
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

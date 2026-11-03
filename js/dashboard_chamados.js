// DASHBOARD DE CHAMADOS (Ocorrências > Dashboard)
// Indicadores de uma empresa no período, para apresentar ao cliente. Os números vêm prontos de
// /dashboard-chamados (dashboard_chamados.js no servidor); aqui só desenha. Usuário "cliente"
// vê apenas a própria empresa (o servidor garante) e não tem o seletor.

const estadoDashChamados = { empresa: '', preset: '12m', inicio: '', fim: '', ultimo: null }

// Rampa sequencial (um tom, claro → escuro) do mapa e das barras.
const RAMPA_DASH = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']
const MESES_DASH = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const numeroDash = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
// Reais em texto puro (dinheiro() devolve HTML e não serve dentro de atributos).
const moedaCompletaDash = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// Reais resumidos para números grandes: R$ 10,7 mi · R$ 507 mil · R$ 980.
const moedaDash = v => {
    const n = Number(v || 0), abs = Math.abs(n)
    if (abs >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    if (abs >= 1e4) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
    return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
const dataDash = iso => String(iso || '').split('-').reverse().join('/')
const textoDash = s => escaparAtributo(String(s ?? ''))

function periodoPresetDash(preset) {
    const hoje = dataServidor()
    const iso = d => d.toLocaleDateString('en-CA')
    const menos = dias => { const d = new Date(hoje); d.setDate(d.getDate() - dias); return iso(d) }
    if (preset === '30d') return { inicio: menos(29), fim: iso(hoje) }
    if (preset === '90d') return { inicio: menos(89), fim: iso(hoje) }
    if (preset === 'ano') return { inicio: `${hoje.getFullYear()}-01-01`, fim: iso(hoje) }
    return { inicio: menos(364), fim: iso(hoje) }
}

async function telaDashboardChamados() {

    const { inicio, fim } = periodoPresetDash(estadoDashChamados.preset)
    estadoDashChamados.inicio ||= inicio
    estadoDashChamados.fim ||= fim

    tela.innerHTML = `
        <div class="dash">
            <div class="dash-topo">
                <div>
                    <h2 class="dash-titulo">Dashboard de chamados</h2>
                    <p class="dash-subtitulo" id="dashSubtitulo"></p>
                </div>
                <div class="dash-filtros">
                    <label class="dash-filtro" id="dashFiltroEmpresa" hidden>
                        <span>Empresa</span>
                        <select id="dashEmpresa" onchange="filtrarDashChamados()"></select>
                    </label>
                    <label class="dash-filtro">
                        <span>Período</span>
                        <select id="dashPreset" onchange="filtrarDashChamados(true)">
                            <option value="30d">Últimos 30 dias</option>
                            <option value="90d">Últimos 90 dias</option>
                            <option value="ano">Este ano</option>
                            <option value="12m">Últimos 12 meses</option>
                            <option value="personalizado">Personalizado</option>
                        </select>
                    </label>
                    <label class="dash-filtro dash-datas" id="dashDatas">
                        <span>De / até</span>
                        <div>
                            <input type="date" id="dashInicio" onchange="filtrarDashChamados()">
                            <input type="date" id="dashFim" onchange="filtrarDashChamados()">
                        </div>
                    </label>
                </div>
            </div>
            <div id="dashConteudo" class="dash-conteudo">
                <div class="dash-carregando"><img src="gifs/loading-gcs.png" alt="Carregando"></div>
            </div>
        </div>`

    document.getElementById('dashPreset').value = estadoDashChamados.preset
    document.getElementById('dashInicio').value = estadoDashChamados.inicio
    document.getElementById('dashFim').value = estadoDashChamados.fim
    document.getElementById('dashDatas').hidden = estadoDashChamados.preset !== 'personalizado'

    await carregarDashChamados()
}

async function filtrarDashChamados(trocouPreset = false) {
    const preset = document.getElementById('dashPreset').value
    estadoDashChamados.preset = preset
    estadoDashChamados.empresa = document.getElementById('dashEmpresa')?.value || ''
    document.getElementById('dashDatas').hidden = preset !== 'personalizado'

    if (preset !== 'personalizado') {
        Object.assign(estadoDashChamados, periodoPresetDash(preset))
    } else if (!trocouPreset) {
        estadoDashChamados.inicio = document.getElementById('dashInicio').value || estadoDashChamados.inicio
        estadoDashChamados.fim = document.getElementById('dashFim').value || estadoDashChamados.fim
    }
    document.getElementById('dashInicio').value = estadoDashChamados.inicio
    document.getElementById('dashFim').value = estadoDashChamados.fim

    await carregarDashChamados()
}

async function carregarDashChamados() {
    const conteudo = document.getElementById('dashConteudo')
    if (!conteudo) return

    // Recarga mantém o desenho anterior esmaecido (sem piscar); na primeira carga o
    // conteúdo é o próprio loading, que fica com a cor normal.
    if (!conteudo.querySelector('.dash-carregando'))
        conteudo.classList.add('atualizando')

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/dashboard-chamados`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                empresa: estadoDashChamados.empresa || null,
                inicio: estadoDashChamados.inicio,
                fim: estadoDashChamados.fim
            })
        })
        const retorno = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(retorno.mensagem || 'Falha ao carregar o dashboard.')

        if (!document.getElementById('dashConteudo')) return
        estadoDashChamados.ultimo = retorno
        desenharDashChamados(retorno)
    } catch (err) {
        console.error(err)
        conteudo.innerHTML = `<p class="dash-vazio">${textoDash(err.message)}</p>`
    } finally {
        conteudo.classList.remove('atualizando')
    }
}

function desenharDashChamados({ empresa, periodo, empresas, cliente, dados }) {

    // Seletor de empresa só para a equipe interna.
    const filtroEmpresa = document.getElementById('dashFiltroEmpresa')
    filtroEmpresa.hidden = cliente
    if (!cliente) {
        const select = document.getElementById('dashEmpresa')
        select.innerHTML = `<option value="">Todas as empresas</option>` +
            empresas.map(e => `<option value="${textoDash(e.id)}">${textoDash(e.nome)}</option>`).join('')
        select.value = empresa?.id || ''
    }

    document.getElementById('dashSubtitulo').textContent =
        `${empresa?.nome || 'Todas as empresas'} · ${dataDash(periodo.inicio)} a ${dataDash(periodo.fim)}`

    const conteudo = document.getElementById('dashConteudo')

    if (!dados.abertos && !dados.solucionados) {
        conteudo.innerHTML = `<p class="dash-vazio">Nenhum chamado aberto ou solucionado neste período.</p>`
        return
    }

    const a = dados.atividades || {}
    // O gráfico mensal é desenhado na largura real do cartão (texto em tamanho 1:1).
    const larguraMensal = Math.max(520, conteudo.clientWidth - 34)

    conteudo.innerHTML = `
        <section class="dash-kpis">
            <div class="dash-hero">
                <span class="dash-rotulo">Chamados solucionados</span>
                <span class="dash-hero-valor">${numeroDash(dados.solucionados)}</span>
                ${deltaDash(dados.solucionados, dados.solucionadosAnterior, true)}
            </div>
            ${tileDash('Chamados abertos', numeroDash(dados.abertos), deltaDash(dados.abertos, dados.abertosAnterior, null))}
            ${tileDash('Em aberto hoje', numeroDash(dados.emAberto), '<span class="dash-nota">todos os períodos</span>')}
            ${tileDash('Tempo mediano até a solução', dados.tempoMediano == null ? '—' : `${numeroDash(dados.tempoMediano)} ${Math.round(dados.tempoMediano) === 1 ? 'dia' : 'dias'}`, '<span class="dash-nota">da abertura à solução</span>')}
            ${tileDash('Unidades atendidas', numeroDash(dados.unidades), '<span class="dash-nota">com chamado no período</span>')}
        </section>

        <section class="dash-atividades" aria-label="Atividades de campo no período">
            ${atividadeDash('Visitas técnicas', a.visitas)}
            ${atividadeDash('Preventivas', a.preventivas)}
            ${atividadeDash('Retornos técnicos', a.retornos)}
            ${atividadeDash('Atendimentos em garantia', a.garantia)}
            ${atividadeDash('Peças aplicadas', a.pecas)}
        </section>

        <section class="dash-linha dash-linha-mapa">
            <div class="dash-card">
                <h3>Chamados abertos por estado</h3>
                ${mapaDash(dados.porEstado)}
            </div>
            <div class="dash-card">
                <h3>Ranking de estados</h3>
                ${barrasDash(dados.porEstado.map(e => ({ nome: e.uf, quantidade: e.quantidade })), { total: dados.abertos })}
            </div>
        </section>

        <section class="dash-card">
            <h3>Abertos e solucionados por mês</h3>
            ${mensalDash(dados.mensal, larguraMensal)}
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Situação atual dos chamados do período</h3>
                ${barrasDash(dados.fases, { total: dados.abertos })}
            </div>
            <div class="dash-card">
                <h3>Status das correções lançadas</h3>
                ${barrasDash(dados.statusCorrecoes)}
            </div>
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Chamados por sistema</h3>
                ${barrasDash(dados.sistemas, { total: dados.abertos })}
            </div>
            <div class="dash-card">
                <h3>Chamados por tipo</h3>
                ${barrasDash(dados.tipos, { total: dados.abertos })}
            </div>
        </section>

        <section class="dash-card">
            <h3>Unidades com mais chamados</h3>
            ${unidadesDash(dados.unidadesTop)}
        </section>`

    ligarTooltipsDash(conteudo)
}

function tileDash(rotulo, valor, rodape = '') {
    return `<div class="dash-tile"><span class="dash-rotulo">${rotulo}</span><span class="dash-valor">${valor}</span>${rodape}</div>`
}

function atividadeDash(rotulo, valor) {
    return `<div class="dash-atividade"><span class="dash-valor">${numeroDash(valor)}</span><span class="dash-rotulo">${rotulo}</span></div>`
}

// Variação contra o período anterior de mesma duração. bom: true = subir é bom; null = neutro.
function deltaDash(atual, anterior, bom, formatar = numeroDash) {
    if (!anterior) return '<span class="dash-nota">sem período anterior para comparar</span>'
    const variacao = (atual - anterior) / anterior * 100
    const sinal = variacao > 0 ? '+' : ''
    const classe = bom === null || Math.round(variacao) === 0 ? '' : (variacao > 0) === bom ? 'bom' : 'ruim'
    const seta = variacao > 0 ? '▲' : variacao < 0 ? '▼' : '■'
    return `<span class="dash-delta ${classe}">${seta} ${sinal}${variacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% <span class="dash-nota">vs período anterior (${formatar(anterior)})</span></span>`
}

// Barras horizontais de um tom, ordenadas; valor na ponta (e % do total, quando faz sentido).
// complemento(item) acrescenta um texto discreto depois do valor (ex.: valor em R$ de uma contagem).
function barrasDash(itens = [], { total, formatar = numeroDash, complemento } = {}) {
    if (!itens.length) return '<p class="dash-vazio">Sem dados no período.</p>'
    const maximo = Math.max(...itens.map(i => i.quantidade)) || 1
    return `<div class="dash-barras">${itens.map(item => {
        const { nome, quantidade } = item
        const pct = total ? ` <span class="dash-nota">${Math.round(quantidade / total * 100)}%</span>` : ''
        const extra = complemento ? ` <span class="dash-nota">${complemento(item)}</span>` : ''
        return `
            <div class="dash-barra-linha">
                <span class="dash-barra-nome" title="${textoDash(nome)}">${textoDash(nome)}</span>
                <span class="dash-barra-trilho"><i style="width: ${Math.max(quantidade / maximo * 100, 0.5)}%"></i></span>
                <span class="dash-barra-valor">${formatar(quantidade)}${pct}${extra}</span>
            </div>`
    }).join('')}</div>`
}

// Mapa coroplético: cor pela raiz da proporção do máximo, em 6 faixas (a legenda mostra os limites).
// descrever(valor) monta o texto da dica (padrão: "N chamados").
function mapaDash(porEstado = [], { formatar = numeroDash, descrever = v => `${numeroDash(v)} ${v === 1 ? 'chamado' : 'chamados'}` } = {}) {
    if (typeof MAPA_BR === 'undefined') return '<p class="dash-vazio">Mapa indisponível.</p>'

    const valores = Object.fromEntries(porEstado.map(e => [e.uf, e.quantidade]))
    const total = porEstado.reduce((s, e) => s + e.quantidade, 0)
    const maximo = Math.max(0, ...porEstado.map(e => e.quantidade))
    const faixa = v => v > 0 ? Math.min(RAMPA_DASH.length - 1, Math.ceil(Math.sqrt(v / maximo) * RAMPA_DASH.length) - 1) : -1
    const limite = i => Math.round(maximo * ((i + 1) / RAMPA_DASH.length) ** 2)

    const estados = Object.entries(MAPA_BR.estados).map(([uf, d]) => {
        const v = valores[uf] || 0
        const f = faixa(v)
        const dica = textoDash(`${uf} · ${descrever(v)}${total ? ` (${Math.round(v / total * 100)}%)` : ''}`)
        return `<path d="${d}" class="dash-uf" fill="${f < 0 ? 'var(--dash-vazio)' : RAMPA_DASH[f]}"
            tabindex="0" role="img" aria-label="${dica}" data-dica="${dica}"></path>`
    }).join('')

    const legenda = maximo
        ? `<div class="dash-mapa-legenda" aria-hidden="true">
                <span><i style="background: var(--dash-vazio)"></i>0</span>
                ${RAMPA_DASH.map((cor, i) => `<span><i style="background: ${cor}"></i>até ${formatar(limite(i))}</span>`).join('')}
            </div>`
        : ''

    return `
        <svg class="dash-mapa" viewBox="0 0 ${MAPA_BR.largura} ${MAPA_BR.altura}" role="group" aria-label="Mapa do Brasil com chamados por estado">${estados}</svg>
        ${legenda}`
}

// Colunas agrupadas por mês (duas séries), um eixo só; tabela logo abaixo.
const SERIES_CHAMADOS = [{ chave: 'abertos', nome: 'Abertos' }, { chave: 'solucionados', nome: 'Solucionados' }]

function mensalDash(mensal = [], L = 760, { series = SERIES_CHAMADOS, formatar = numeroDash, eixo = numeroDash } = {}) {
    if (!mensal.length) return '<p class="dash-vazio">Sem dados no período.</p>'

    const [s1, s2] = series
    const A = 240, margem = { e: eixo === numeroDash ? 40 : 64, d: 8, t: 12, b: 28 }
    const largura = L - margem.e - margem.d, altura = A - margem.t - margem.b
    const maximo = Math.max(1, ...mensal.flatMap(m => [m[s1.chave], m[s2.chave]]))
    const passo = 10 ** Math.floor(Math.log10(maximo / 4 || 1))
    const tick = [1, 2, 5, 10].map(f => f * passo).find(t => maximo / t <= 5) || passo * 10
    const topo = Math.ceil(maximo / tick) * tick
    const y = v => margem.t + altura - v / topo * altura
    const banda = largura / mensal.length
    const barra = Math.min(24, Math.max(3, (banda - 10) / 2))
    const pularRotulo = mensal.length > 18 ? 2 : 1

    // Coluna com ponta arredondada (4px) e base reta.
    const coluna = (x, v, cor) => {
        if (!v) return ''
        const h = altura - (y(v) - margem.t), r = Math.min(4, h, barra / 2), base = margem.t + altura, t = y(v)
        return `<path fill="${cor}" d="M${x},${base}V${t + r}Q${x},${t} ${x + r},${t}H${x + barra - r}Q${x + barra},${t} ${x + barra},${t + r}V${base}Z"></path>`
    }

    const grades = []
    for (let v = 0; v <= topo; v += tick)
        grades.push(`<line class="dash-grade${v === 0 ? ' base' : ''}" x1="${margem.e}" x2="${L - margem.d}" y1="${y(v)}" y2="${y(v)}"></line>
            <text class="dash-eixo" x="${margem.e - 6}" y="${y(v) + 4}" text-anchor="end">${eixo(v)}</text>`)

    const meses = mensal.map((m, i) => {
        const [ano, mes] = m.mes.split('-')
        const nome = `${MESES_DASH[Number(mes) - 1]}/${ano.slice(2)}`
        const x0 = margem.e + i * banda, centro = x0 + banda / 2
        const dica = textoDash(`${nome} · ${s1.nome} ${formatar(m[s1.chave])} · ${s2.nome} ${formatar(m[s2.chave])}`)
        return `
            <g>
                ${coluna(centro - barra - 1, m[s1.chave], 'var(--dash-serie-1)')}
                ${coluna(centro + 1, m[s2.chave], 'var(--dash-serie-2)')}
                ${i % pularRotulo === 0 ? `<text class="dash-eixo" x="${centro}" y="${A - 8}" text-anchor="middle">${nome}</text>` : ''}
                <rect class="dash-alvo" x="${x0}" y="${margem.t}" width="${banda}" height="${altura}" tabindex="0" role="img" aria-label="${dica}" data-dica="${dica}"></rect>
            </g>`
    }).join('')

    const tabela = mensal.map(m => {
        const [ano, mes] = m.mes.split('-')
        return `<tr><td>${MESES_DASH[Number(mes) - 1]}/${ano}</td><td>${formatar(m[s1.chave])}</td><td>${formatar(m[s2.chave])}</td></tr>`
    }).join('')

    return `
        <div class="dash-legenda">
            <span><i style="background: var(--dash-serie-1)"></i>${s1.nome}</span>
            <span><i style="background: var(--dash-serie-2)"></i>${s2.nome}</span>
        </div>
        <svg class="dash-mensal" viewBox="0 0 ${L} ${A}" role="group" aria-label="${s1.nome} e ${s2.nome} por mês">${grades.join('')}${meses}</svg>
        <details class="dash-tabela-detalhe">
            <summary>Ver em tabela</summary>
            <table class="dash-tabela"><thead><tr><th>Mês</th><th>${s1.nome}</th><th>${s2.nome}</th></tr></thead><tbody>${tabela}</tbody></table>
        </details>`
}

function unidadesDash(unidades = []) {
    if (!unidades.length) return '<p class="dash-vazio">Sem dados no período.</p>'
    const maximo = Math.max(...unidades.map(u => u.quantidade)) || 1
    return `
        <table class="dash-tabela dash-unidades">
            <thead><tr><th>Unidade</th><th>Cidade</th><th>UF</th><th>Chamados</th></tr></thead>
            <tbody>${unidades.map(u => `
                <tr>
                    <td>${textoDash(u.nome)}</td>
                    <td>${textoDash(u.cidade)}</td>
                    <td>${textoDash(u.uf)}</td>
                    <td><span class="dash-celula-barra"><i style="width: ${u.quantidade / maximo * 100}%"></i><b>${numeroDash(u.quantidade)}</b></span></td>
                </tr>`).join('')}
            </tbody>
        </table>`
}

// Uma dica flutuante para mapa e colunas (mouse e teclado). Texto via textContent.
function ligarTooltipsDash(raiz) {
    let dica = document.getElementById('dashDica')
    if (!dica) {
        dica = document.createElement('div')
        dica.id = 'dashDica'
        dica.className = 'dash-dica'
        dica.hidden = true
        document.body.appendChild(dica)
    }

    const mostrar = (alvo, x, y) => {
        dica.textContent = alvo.dataset.dica
        dica.hidden = false
        const { width, height } = dica.getBoundingClientRect()
        dica.style.left = `${Math.min(window.innerWidth - width - 8, x + 14)}px`
        dica.style.top = `${Math.max(8, y - height - 10)}px`
    }
    const esconder = () => { dica.hidden = true }

    for (const alvo of raiz.querySelectorAll('[data-dica]')) {
        alvo.addEventListener('pointermove', e => mostrar(alvo, e.clientX, e.clientY))
        alvo.addEventListener('pointerleave', esconder)
        alvo.addEventListener('focus', () => {
            const r = alvo.getBoundingClientRect()
            mostrar(alvo, r.left + r.width / 2, r.top)
        })
        alvo.addEventListener('blur', esconder)
    }
}

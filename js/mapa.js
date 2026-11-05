// Mapa do Brasil por estado (telas de ocorrências e de clientes), no desenho do dashboard: cada UF
// pintada pela quantidade, com a mesma escala de cores (RAMPA_DASH, js/dashboard_chamados.js) e a
// malha do IBGE (MAPA_BR, js/mapa_br.js). Dica com o número ao passar o mouse.
//
// Clicar numa UF liga/desliga o filtro de estado da tela (o mesmo do dropdown de Estado).
// Contagem sem pesar as pesquisas: só com o mapa aberto e só quando os filtros mudam (trocar de
// página reaproveita a última). O filtro do próprio estado fica fora da contagem: o mapa continua
// mostrando a distribuição e destaca as UFs escolhidas (sem recontar a cada clique).

// Siglas das UFs (a tela de clientes usa as chaves como opções do filtro de estados).
const posicoesEstados = Object.fromEntries(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => [uf, true]))

// base: tabela contada; path: campo do estado; unidade: [singular, plural] da dica.
// ativo: já nasce aberto (sem interruptor), como nas ocorrências.
function criarMapa({ apenasMapa, path, pag, base = null, unidade = ['chamado', 'chamados'], ativo = false } = {}) {
    controles.mapa = { path, pag, base, unidade, chave: null, dados: {} }

    const mapa = `
        <div class="fundo-mapa ${ativo ? 'ativo' : ''}">
            <div class="mapa-cabecalho">
                <b>Por estado</b>
                <small id="mapaResumo"></small>
            </div>
            <div id="mapaOverlay" class="mapa-br"></div>
        </div>`

    return apenasMapa ? mapa : `<div class="painel-mapa">${mapa}</div>`
}

const mapaVisivel = () => !!document.querySelector('.fundo-mapa.ativo')

// Chamado pelas telas depois de cada paginação (funcaoAdicional do modTab).
async function atualizarMapa() {
    const estado = controles.mapa
    if (!estado?.path || !estado.base || !mapaVisivel()) return

    const filtros = controles?.[estado.pag]?.filtros || {}
    const semEstado = Object.fromEntries(Object.entries(filtros).filter(([p]) => p !== estado.path))
    const chave = JSON.stringify([estado.base, semEstado])

    if (estado.chave !== chave) {
        estado.chave = chave
        try {
            const dados = await contarPorCampo({ base: estado.base, path: estado.path, filtros: semEstado })
            if (estado.chave !== chave) return // outra contagem começou depois desta
            estado.dados = dados || {}
        } catch (erro) {
            estado.chave = null
            console.error('Mapa:', erro)
            return
        }
    }

    auxMapa(estado.dados)
}

function ufsMarcadasMapa() {
    const { path, pag } = controles.mapa || {}
    if (!path || !pag || typeof valoresMarcadosDropdown !== 'function') return []
    return valoresMarcadosDropdown(path, pag)
}

// Desenha o mapa com a contagem { UF: quantidade }.
function auxMapa(dados = {}) {
    const local = document.getElementById('mapaOverlay')
    if (!local || typeof MAPA_BR === 'undefined') return
    if (controles.mapa) controles.mapa.dados = dados

    const rampa = typeof RAMPA_DASH !== 'undefined' ? RAMPA_DASH : ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']
    const [um, varios] = controles.mapa?.unidade || ['chamado', 'chamados']
    // A contagem do servidor traz { todos, 'EM BRANCO', UF: n, ... }: "todos" é o total (o mesmo da
    // paginação, sem o filtro de estado) e não é estado; sem estado ou com valor fora das UFs fica à parte.
    const valores = {}
    let todos = null
    for (const [chave, q] of Object.entries(dados || {})) {
        if (chave === 'todos') { todos = Number(q) || 0; continue }
        const uf = String(chave).trim().toUpperCase()
        if (MAPA_BR.estados[uf]) valores[uf] = (valores[uf] || 0) + (Number(q) || 0)
    }
    const total = Object.values(valores).reduce((s, q) => s + q, 0)
    const geral = todos ?? total
    const semEstado = Math.max(0, geral - total)
    const maximo = Math.max(0, ...Object.values(valores))
    // Cor pela raiz da proporção do máximo, em faixas (igual ao mapa do dashboard).
    const faixa = v => v > 0 ? Math.min(rampa.length - 1, Math.ceil(Math.sqrt(v / maximo) * rampa.length) - 1) : -1
    const limite = i => Math.round(maximo * ((i + 1) / rampa.length) ** 2)
    const numero = v => Number(v || 0).toLocaleString('pt-BR')
    const marcadas = ufsMarcadasMapa()

    const estados = Object.entries(MAPA_BR.estados).map(([uf, d]) => {
        const v = valores[uf] || 0
        const f = faixa(v)
        const dica = `${uf} · ${numero(v)} ${v === 1 ? um : varios}${geral ? ` (${Math.round(v / geral * 100)}%)` : ''} · clique para ${marcadas.includes(uf) ? 'tirar do' : 'pôr no'} filtro`
        const classes = ['mapa-uf', marcadas.includes(uf) ? 'marcada' : '', marcadas.length && !marcadas.includes(uf) ? 'apagada' : ''].filter(Boolean).join(' ')
        return `<path d="${d}" class="${classes}" data-uf="${uf}" fill="${f < 0 ? '#e9ecea' : rampa[f]}"
            tabindex="0" role="button" aria-pressed="${marcadas.includes(uf)}" aria-label="${dica}" data-dica="${dica}"></path>`
    })
    // UF escolhida por cima, para o contorno grosso não ficar escondido pelas vizinhas.
    const ordem = [...estados.filter(e => !e.includes(' marcada')), ...estados.filter(e => e.includes(' marcada'))]

    const legenda = maximo
        ? `<div class="mapa-legenda" aria-hidden="true">
                <span><i style="background: #e9ecea"></i>0</span>
                ${rampa.map((cor, i) => `<span><i style="background: ${cor}"></i>até ${numero(limite(i))}</span>`).join('')}
            </div>`
        : ''

    local.innerHTML = `
        <svg viewBox="0 0 ${MAPA_BR.largura} ${MAPA_BR.altura}" role="group" aria-label="Mapa do Brasil por estado">${ordem.join('')}</svg>
        ${legenda}`

    const resumo = document.getElementById('mapaResumo')
    // Sem estado escolhido: o total bate com a paginação. Com escolha: "X de Y" (X é o que a tabela mostra).
    const escolhidos = marcadas.reduce((s, uf) => s + (valores[uf] || 0), 0)
    if (resumo) resumo.innerHTML = marcadas.length
        ? `${numero(escolhidos)} de ${numero(geral)} ${varios} · ${marcadas.join(', ')} <button type="button" class="mapa-limpar" onclick="limparEstadosMapa()">limpar</button>`
        : `${numero(geral)} ${geral === 1 ? um : varios}`
            + (semEstado ? ` · <span title="Sem estado no cadastro do cliente (ou com valor que não é UF)">${numero(semEstado)} sem estado</span>` : '')

    if (!local.dataset.ligado) {
        local.dataset.ligado = 'S'
        local.addEventListener('click', ev => {
            const uf = ev.target.closest?.('[data-uf]')?.dataset.uf
            if (uf) alternarEstadoMapa(uf)
        })
        local.addEventListener('keydown', ev => {
            const uf = ev.target.closest?.('[data-uf]')?.dataset.uf
            if (uf && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); alternarEstadoMapa(uf) }
        })
    }
    if (typeof ligarTooltipsDash === 'function') ligarTooltipsDash(local)
}

// Liga/desliga a UF no filtro de estado da tela (o mesmo grupo do dropdown, que fica marcado junto).
function alternarEstadoMapa(uf) {
    const { path, pag } = controles.mapa || {}
    if (!path || !pag) return
    const atuais = ufsMarcadasMapa()
    aplicarEstadosMapa(atuais.includes(uf) ? atuais.filter(v => v !== uf) : [...atuais, uf])
}

function limparEstadosMapa() {
    aplicarEstadosMapa([])
}

function aplicarEstadosMapa(ufs) {
    const { path, pag } = controles.mapa || {}
    if (!path || !pag) return
    const drop = typeof getDropdownElement === 'function' ? getDropdownElement(path, pag) : null
    if (drop) aplicarSelecaoDropdown(drop, ufs)
    else {
        salvarFiltroDropdown(path, pag, ufs.map(value => ({ op: '=', value })))
        paginacao(pag)
    }
    // Destaque na hora; a tabela recarrega pelo filtro e o mapa reaproveita a contagem.
    auxMapa(controles.mapa.dados)
}

// Nome antigo (clique no estado), mantido para quem ainda chama.
async function filtrarEspecial(uf) {
    alternarEstadoMapa(uf)
}

// Interruptor "Mapa": mostra/esconde. Ao abrir, só conta (a tabela não recarrega).
function mostrarMapa() {
    document.querySelector('.fundo-mapa')?.classList.toggle('ativo')
    document.querySelector('.painel-mapa')?.classList.toggle('ativo')
    atualizarMapa()
}

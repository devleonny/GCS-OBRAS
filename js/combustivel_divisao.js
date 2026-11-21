// ---------------- Veículos → Divisão do combustível (21/11/2026) ----------------
// O km de cada carro rastreado é dividido DEPOIS, pelo que aconteceu: paradas perto de lojas/obras com chamado
// ou orçamento ativo, chamados que o motorista corrigiu no dia, e o resto do dia dividido entre esses destinos.
// Dia sem destino: horário comercial = "a classificar"; fora do horário/fim de semana = possível uso particular.
// Cálculo no servidor (gcs SCRIPTS/combustivel_apropriacao.js, de hora em hora); rotas em combustivel_rotas.js.
// Acesso: veiculos.divisao (ver) e veiculos.classificar_km (classificar a fila).

const DIVISAO_COMB = { de: null, ate: null, dados: null, filtro: 'pendentes' }

async function apiCombustivel(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/veiculos/combustivel/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.mensagem || 'Falha ao consultar a divisão do combustível.')
    return dados
}

const kmComb = n => `${Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`
const pctComb = (a, b) => b ? `${Math.round(100 * a / b)}%` : '—'
const diaSemanaComb = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
const placaComb = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

async function telaDivisaoCombustivel() {
    if (!pode('veiculos.divisao')) return popup({ mensagem: 'Você não tem acesso à divisão do combustível.' })
    const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    DIVISAO_COMB.ate ??= hoje
    DIVISAO_COMB.de ??= `${hoje.slice(0, 8)}01`

    tela.innerHTML = `
        <div class="pagina-conteudo comb-div">
            <header class="comb-cabeca">
            <h2>Divisão do combustível</h2>
            <div class="comb-topo">
                <label>De <input type="date" id="comb-de" value="${DIVISAO_COMB.de}"></label>
                <label>Até <input type="date" id="comb-ate" value="${DIVISAO_COMB.ate}"></label>
                <button type="button" onclick="carregarDivisaoCombustivel()">Atualizar</button>
                <small class="comb-calculado" data-comb-calculado></small>
            </div>
            </header>
            <div data-comb-corpo></div>
        </div>`
    await carregarDivisaoCombustivel()
}

async function carregarDivisaoCombustivel() {
    const de = document.getElementById('comb-de')?.value
    const ate = document.getElementById('comb-ate')?.value
    if (!de || !ate || ate < de) return popup({ mensagem: 'Escolha um período válido.' })
    Object.assign(DIVISAO_COMB, { de, ate })
    overlayAguarde()
    try {
        DIVISAO_COMB.dados = await apiCombustivel('divisao', { de, ate })
        desenharDivisaoCombustivel()
        removerOverlay()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}

// Junta as linhas: por carro (com R$/km), por departamento e a fila sem destino.
function montarDivisaoCombustivel() {
    const { linhas = [], gastos = [] } = DIVISAO_COMB.dados || {}
    const gastoPorPlaca = new Map(gastos.map(g => [placaComb(g.placa), Number(g.valor) || 0]))
    const carros = new Map()
    for (const l of linhas) {
        const c = carros.get(l.veiculo_id) || { veiculo_id: l.veiculo_id, placa: l.placa, modelo: l.modelo, km: 0, TRABALHO: 0, A_CLASSIFICAR: 0, PARTICULAR: 0, motoristas: new Set() }
        c.km += l.km
        c[l.tipo] += l.km
        String(l.motorista || '').split(', ').filter(Boolean).forEach(m => c.motoristas.add(m))
        carros.set(l.veiculo_id, c)
    }
    for (const c of carros.values()) {
        c.gasto = gastoPorPlaca.get(placaComb(c.placa)) || 0
        c.rsKm = c.km ? c.gasto / c.km : 0
    }
    const valorDe = l => l.km * (carros.get(l.veiculo_id)?.rsKm || 0)

    const deps = new Map()
    for (const l of linhas.filter(l => l.tipo === 'TRABALHO')) {
        const d = deps.get(l.departamento) || { departamento: l.departamento, km: 0, valor: 0, carros: new Set(), dias: new Set(), existe: l.departamento_existe, lojas: new Set() }
        d.km += l.km
        d.valor += valorDe(l)
        d.carros.add(l.placa)
        d.dias.add(l.dia)
        if (l.detalhes?.loja) d.lojas.add(l.detalhes.loja)
        deps.set(l.departamento, d)
    }

    const fila = linhas.filter(l => l.tipo !== 'TRABALHO' || l.origem === 'manual')
        .map(l => ({ ...l, valor: valorDe(l) }))

    const total = { km: 0, TRABALHO: 0, A_CLASSIFICAR: 0, PARTICULAR: 0, valor: 0 }
    for (const c of carros.values()) {
        total.km += c.km; total.TRABALHO += c.TRABALHO; total.A_CLASSIFICAR += c.A_CLASSIFICAR; total.PARTICULAR += c.PARTICULAR
        total.valor += c.gasto
    }
    return { carros: [...carros.values()].sort((a, b) => b.km - a.km), deps: [...deps.values()].sort((a, b) => b.km - a.km), fila, total, valorDe }
}

function desenharDivisaoCombustivel() {
    const corpo = document.querySelector('[data-comb-corpo]')
    if (!corpo) return
    const { carros, deps, fila, total } = montarDivisaoCombustivel()
    const calculado = DIVISAO_COMB.dados?.calculado_em
    const aviso = document.querySelector('[data-comb-calculado]')
    if (aviso) aviso.textContent = calculado ? `Calculado em ${new Date(calculado).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · recalcula de hora em hora` : ''

    if (!carros.length) {
        corpo.innerHTML = '<p class="comb-vazio">Nenhum km de carro rastreado neste período.</p>'
        return
    }

    const pendentes = fila.filter(l => l.origem !== 'manual')
    const cartao = (titulo, km, classe, extra = '') => `
        <div class="comb-cartao ${classe}">
            <span>${titulo}</span>
            <b>${kmComb(km)}</b>
            <small>${pctComb(km, total.km)} do total${extra}</small>
        </div>`

    corpo.innerHTML = `
        <div class="comb-cartoes">
            <div class="comb-cartao"><span>Rodado pelos carros com rastreador</span><b>${kmComb(total.km)}</b><small>${dinheiro(total.valor)} de combustível no período</small></div>
            ${cartao('Trabalho (com departamento)', total.TRABALHO, 'trabalho')}
            ${cartao('A classificar', total.A_CLASSIFICAR, 'classificar')}
            ${cartao('Possível uso particular', total.PARTICULAR, 'particular')}
        </div>

        <section class="comb-bloco">
            <header>
                <h3>Sem destino <small>${pendentes.length} dia(s) pendente(s)</small></h3>
                <div class="comb-abas">
                    ${['pendentes', 'classificados'].map(f => `<button type="button" class="${DIVISAO_COMB.filtro === f ? 'ativa' : ''}" onclick="filtroFilaCombustivel('${f}')">${f === 'pendentes' ? 'Pendentes' : 'Já classificados'}</button>`).join('')}
                </div>
            </header>
            <div class="comb-tabela-rolagem">${tabelaFilaCombustivel(fila)}</div>
        </section>

        <section class="comb-bloco">
            <header><h3>Por departamento <small>${deps.length} departamento(s)</small></h3></header>
            <div class="comb-tabela-rolagem">
                <table class="comb-tabela">
                    <thead><tr><th>Departamento</th><th>Lojas/obras onde parou</th><th class="num">Km</th><th class="num">R$ estimado</th><th class="num">Dias</th><th>Carros</th></tr></thead>
                    <tbody>${deps.map(d => `
                        <tr>
                            <td><b>${escaparAtributo(d.departamento)}</b>${d.existe ? '' : ' <span class="comb-alerta" title="Este chamado ainda não tem departamento no Financeiro">sem departamento</span>'}</td>
                            <td class="comb-lojas">${escaparAtributo([...d.lojas].slice(0, 2).join(' · '))}${d.lojas.size > 2 ? ` +${d.lojas.size - 2}` : ''}</td>
                            <td class="num">${kmComb(d.km)}</td>
                            <td class="num">${dinheiro(d.valor)}</td>
                            <td class="num">${d.dias.size}</td>
                            <td>${[...d.carros].join(', ')}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </section>

        <section class="comb-bloco">
            <header><h3>Por carro</h3></header>
            <div class="comb-tabela-rolagem">
                <table class="comb-tabela">
                    <thead><tr><th>Carro</th><th>Motoristas (rastreio)</th><th class="num">Km</th><th class="num">Trabalho</th><th class="num">A classificar</th><th class="num">Particular?</th><th class="num">Combustível</th><th class="num">R$/km</th></tr></thead>
                    <tbody>${carros.map(c => `
                        <tr>
                            <td><span data-rastreio-placa="${escaparAtributo(c.placa)}" data-rastreio-de="${DIVISAO_COMB.de}" data-rastreio-ate="${DIVISAO_COMB.ate}"><b>${escaparAtributo(c.placa)}</b></span> <small>${escaparAtributo(c.modelo || '')}</small></td>
                            <td class="comb-lojas">${escaparAtributo([...c.motoristas].join(', ') || '—')}</td>
                            <td class="num">${kmComb(c.km)}</td>
                            <td class="num">${pctComb(c.TRABALHO, c.km)}</td>
                            <td class="num">${pctComb(c.A_CLASSIFICAR, c.km)}</td>
                            <td class="num ${c.PARTICULAR / (c.km || 1) > 0.25 ? 'comb-destaque' : ''}">${pctComb(c.PARTICULAR, c.km)}</td>
                            <td class="num">${c.gasto ? dinheiro(c.gasto) : '<span title="Sem combustível lançado para esta placa no período">—</span>'}</td>
                            <td class="num">${c.rsKm ? dinheiro(c.rsKm) : '—'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </section>`
}

function tabelaFilaCombustivel(fila) {
    const classificar = pode('veiculos.classificar_km')
    const lista = fila.filter(l => DIVISAO_COMB.filtro === 'pendentes' ? l.origem !== 'manual' : l.origem === 'manual')
        .sort((a, b) => a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : b.km - a.km)
    if (!lista.length)
        return `<p class="comb-vazio">${DIVISAO_COMB.filtro === 'pendentes' ? 'Nada pendente neste período.' : 'Nada classificado neste período.'}</p>`

    return `
        <table class="comb-tabela">
            <thead><tr><th>Dia</th><th>Carro</th><th>Motorista (rastreio)</th><th>Situação</th><th class="num">Km</th><th class="num">R$ estimado</th><th></th></tr></thead>
            <tbody>${lista.map(l => {
        const original = l.detalhes?.tipo_original || l.tipo
        const chave = `${l.veiculo_id}|${l.dia}|${original}`
        const situacao = l.origem === 'manual'
            ? (l.tipo === 'TRABALHO'
                ? `→ <b>${escaparAtributo(l.departamento)}</b>`
                : `Particular confirmado`) + `<small>${escaparAtributo(l.detalhes?.classificado_por || '')}${l.detalhes?.justificativa ? `: ${escaparAtributo(l.detalhes.justificativa)}` : ''}</small>`
            : (l.tipo === 'PARTICULAR' ? '<span class="comb-tag particular">Possível particular</span>' : '<span class="comb-tag classificar">A classificar</span>')
        const acoes = !classificar ? '' : l.origem === 'manual'
            ? `<button type="button" class="comb-mini" onclick="desfazerClassificacaoComb('${escaparAtributo(chave)}')">Desfazer</button>`
            : `<button type="button" class="comb-mini" onclick="escolherDepartamentoComb('${escaparAtributo(chave)}')">Departamento</button>
               <button type="button" class="comb-mini" onclick="justificarParticularComb('${escaparAtributo(chave)}')">${original === 'PARTICULAR' ? 'Confirmar particular' : 'Não é trabalho'}</button>`
        return `
                <tr>
                    <td>${diaSemanaComb(l.dia)}</td>
                    <td><span data-rastreio-placa="${escaparAtributo(l.placa)}" data-rastreio-de="${l.dia}">${escaparAtributo(l.placa)}</span></td>
                    <td class="comb-lojas">${escaparAtributo(l.motorista || '—')}</td>
                    <td class="comb-situacao">${situacao}</td>
                    <td class="num">${kmComb(l.km)}</td>
                    <td class="num">${l.valor ? dinheiro(l.valor) : '—'}</td>
                    <td class="comb-acoes">${acoes}</td>
                </tr>`
    }).join('')}
            </tbody>
        </table>`
}

function filtroFilaCombustivel(filtro) {
    DIVISAO_COMB.filtro = filtro
    desenharDivisaoCombustivel()
}

const partesChaveComb = chave => {
    const [veiculo_id, dia, tipo_original] = chave.split('|')
    return { veiculo_id, dia, tipo_original }
}

async function enviarClassificacaoComb(corpo) {
    overlayAguarde()
    try {
        await apiCombustivel('classificar', corpo)
        DIVISAO_COMB.dados = await apiCombustivel('divisao', { de: DIVISAO_COMB.de, ate: DIVISAO_COMB.ate })
        desenharDivisaoCombustivel()
        removerOverlay()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}

// Escolher o departamento pelo seletor padrão (cxOpcoes em mesc_departamentos).
function escolherDepartamentoComb(chave) {
    const nome = `comb-dep-${crypto.randomUUID().slice(0, 8)}`
    const retorno = `retornoDepComb_${nome.replace(/-/g, '_')}`
    let idPopup = null
    // cxOpcoes grava o id escolhido no span e chama esta função (sem argumentos) depois de fechar a lista.
    window[retorno] = async () => {
        const departamento = document.querySelector(`[name="${nome}"]`)?.id
        if (idPopup) removerPopup(idPopup)
        delete window[retorno]
        delete controlesCxOpcoes[nome]
        if (departamento) await enviarClassificacaoComb({ ...partesChaveComb(chave), departamento })
    }
    controlesCxOpcoes[nome] = {
        base: 'mesc_departamentos',
        retornar: ['id'],
        funcaoAdicional: retorno,
        colunas: { 'Departamento': { chave: 'id' } }
    }
    const { dia } = partesChaveComb(chave)
    idPopup = popup({
        titulo: `Km de ${diaSemanaComb(dia)} vai para`,
        confirmarFechar: false,
        linhas: [{
            texto: 'Departamento (ORC, chamado ou setor)',
            elemento: `<span class="opcoes" name="${nome}" onclick="cxOpcoes('${nome}')">Selecionar</span>`
        }]
    })
}

async function justificarParticularComb(chave) {
    const { tipo_original } = partesChaveComb(chave)
    const justificativa = await pedirTextoPopup({
        titulo: tipo_original === 'PARTICULAR' ? 'Confirmar uso particular' : 'Km sem trabalho',
        mensagem: 'Explique o que foi este deslocamento (ex.: levou o carro para casa no fim de semana, revisão, uso pessoal autorizado).',
        minimo: 5, maximo: 500
    })
    if (!justificativa) return
    await enviarClassificacaoComb({ ...partesChaveComb(chave), justificativa })
}

async function desfazerClassificacaoComb(chave) {
    if (!await confirmarPopup({ mensagem: 'Desfazer a classificação deste dia? Ele volta para a fila.' })) return
    await enviarClassificacaoComb({ ...partesChaveComb(chave), remover: true })
}

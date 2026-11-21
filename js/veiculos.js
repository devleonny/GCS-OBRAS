let totalDepartamentos = {}

// Combustíveis marcados para o pagamento da Ticket Log: id do custo → { deps: { departamento: R$ }, pronto }.
// Fica fora do DOM porque a tabela redesenha sozinha as linhas que mudam (websocket → paginacao()) e a
// linha nova perderia o "checked"; criarLinhaCusto devolve a marcação e atualiza os valores daqui.
const MARCADOS_COMBUSTIVEL = new Map()

const centavos = n => Math.round((Number(n) || 0) * 100) / 100

// Valor dividido na proporção dos pesos ({ departamento: peso }); a diferença de centavos fica no maior,
// para a soma bater com o valor.
function distribuirPorPesos(pesos, valor) {
    const total = Object.values(pesos || {}).reduce((s, p) => s + (Number(p) || 0), 0)
    const deps = {}
    if (!total || !valor) return deps
    for (const [departamento, peso] of Object.entries(pesos))
        if (Number(peso) > 0) deps[departamento] = centavos((deps[departamento] || 0) + valor * peso / total)
    const chaves = Object.keys(deps)
    if (chaves.length) {
        const soma = chaves.reduce((s, k) => s + deps[k], 0)
        const maior = chaves.reduce((a, b) => deps[a] >= deps[b] ? a : b)
        deps[maior] = centavos(deps[maior] + valor - soma)
    }
    return deps
}

// Lançamento antigo (com distribuição digitada): realizado dividido pelos km de cada departamento.
function valoresDepsCombustivel(distribuicao, realizado) {
    const pesos = {}
    for (const d of Object.values(distribuicao || {})) {
        const departamento = String(d?.departamento || d?.nomeDepartamento || '')
        pesos[departamento] = (pesos[departamento] || 0) + (Number(d?.km) || 0)
    }
    const valor = Number(realizado) || 0
    const deps = distribuirPorPesos(pesos, valor)
    const chaves = Object.keys(deps)
    const pronto = valor > 0 && chaves.length > 0 && !chaves.includes('')
    return { deps, pronto }
}

const temDistribuicaoCombustivel = distribuicao => Object.keys(distribuicao || {}).length > 0

// Divisão de cada combustível por departamento, nesta ordem (21/11/2026):
//   1. rateio_manual: dividido à mão pelo botão "Dividir" (mesmo editor das faturas, em % ou R$);
//   2. distribuição antiga, digitada no formulário de antes (km por departamento);
//   3. automática pelo uso depois do abastecimento (gcs SCRIPTS/combustivel_rotas.js → /veiculos/combustivel/rateio:
//      km do rastreio, senão chamados dos motoristas).
// Na tela aparecem só os departamentos conhecidos; o que a automática não soube para onde foi fica como
// "sem divisão" (no pagamento da Ticket Log essa parte vai para EMPRESA).
const SEM_DESTINO_COMBUSTIVEL = 'EMPRESA'
const RATEIOS_COMBUSTIVEL = new Map() // id do custo → { pesos, fonte, de, ate, motivo, sem_departamento }
const LINHAS_COMBUSTIVEL = new Map()  // id do custo → { distribuicao, rateio_manual, realizado, custo_total }
const DIVISOR_COMBUSTIVEL_POPUP = new Map()

const temManualCombustivel = r => Array.isArray(r) && r.some(l => l?.departamento && Number(l.percentual) > 0)

async function buscarRateiosCombustivel(ids) {
    const faltam = ids.filter(id => !RATEIOS_COMBUSTIVEL.has(id))
    if (!faltam.length) return
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/veiculos/combustivel/rateio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: faltam })
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.mensagem || 'Falha ao buscar a divisão do combustível.')
    for (const [id, r] of Object.entries(dados.rateios || {})) RATEIOS_COMBUSTIVEL.set(id, r)
}

// { deps (R$ por departamento, somando o valor; a parte sem destino em EMPRESA), pesos, pronto, origem, rateio }
function divisaoCombustivel(id, linha = LINHAS_COMBUSTIVEL.get(id) || {}) {
    const { distribuicao, rateio_manual, realizado } = linha
    const valor = Number(realizado) || 0
    if (temManualCombustivel(rateio_manual)) {
        const pesos = Object.fromEntries(rateio_manual.filter(l => l.departamento).map(l => [l.departamento, Number(l.percentual) || 0]))
        return { deps: distribuirPorPesos(pesos, valor), pesos, pronto: valor > 0, origem: 'manual' }
    }
    if (temDistribuicaoCombustivel(distribuicao)) {
        const { deps, pronto } = valoresDepsCombustivel(distribuicao, realizado)
        return { deps, pronto, origem: 'antiga' }
    }
    const r = RATEIOS_COMBUSTIVEL.get(id)
    if (!r) return { deps: {}, pesos: {}, pronto: false, origem: 'carregando' }
    const pesos = Object.keys(r.pesos || {}).length ? r.pesos : { [SEM_DESTINO_COMBUSTIVEL]: 1 }
    return { deps: distribuirPorPesos(pesos, valor), pesos, pronto: valor > 0, origem: r.fonte || 'sem', rateio: r }
}

// Texto da origem da divisão automática, para a dica.
function origemRateioCombustivel(r) {
    if (!r) return 'Calculando a divisão…'
    if (!r.fonte) return `${r.motivo} No pagamento, vai para ${SEM_DESTINO_COMBUSTIVEL}.`
    const periodo = r.de === r.ate ? conversorData(r.de) : `${conversorData(r.de)} a ${conversorData(r.ate)}`
    const semDep = r.sem_departamento?.length
        ? ` · ${r.sem_departamento.join(', ')} sem departamento no Financeiro (fica sem divisão)`
        : ''
    return `${r.fonte === 'rastreio' ? 'Km do rastreio' : 'Chamados dos motoristas'} em ${periodo}${r.ampliada ? ' (7 dias após o abastecimento)' : ''}${semDep}`
}

// Coluna Departamentos (formulário simples ou divisão manual): só os departamentos conhecidos, com R$
// (ou % sem Realizado); o resto como "sem divisão"; botão Dividir para quem edita combustível.
function htmlDepsSimplesCombustivel(id, editavel) {
    const botao = editavel ? `<button type="button" class="comb-dividir" onclick="dividirCombustivel('${escaparAtributo(id)}')">Dividir</button>` : ''
    const d = divisaoCombustivel(id)
    if (d.origem === 'carregando')
        return editavel ? '<small class="comb-uso">Calculando a divisão…</small>' : '<small class="comb-uso">Divisão pelo uso</small>'
    const pesos = d.pesos || {}
    const totalPeso = Object.values(pesos).reduce((s, p) => s + p, 0) || 1
    const conhecidos = Object.entries(pesos).filter(([dep]) => d.origem === 'manual' || dep !== SEM_DESTINO_COMBUSTIVEL)
    const resto = d.origem === 'manual' ? 0 : (pesos[SEM_DESTINO_COMBUSTIVEL] || 0)
    const valorOuPct = (dep, peso) => d.deps[dep] ? dinheiro(d.deps[dep]) : `${Math.round(100 * peso / totalPeso)}%`
    const tags = conhecidos.sort((a, b) => b[1] - a[1]).map(([dep, peso]) => `
        <div class="tag-pendencias pagamento-balao pagamento-balao-departamento" name="departamento" data-departamento="${escaparAtributo(dep)}">
            <span>${escaparAtributo(dep)}</span>
            <strong style="margin-left: 6px; white-space: nowrap;">${valorOuPct(dep, peso)}</strong>
        </div>`).join('')
    const origem = d.origem === 'manual' ? 'dividido à mão'
        : d.origem === 'rastreio' ? 'pelo rastreio' : d.origem === 'chamados' ? 'pelos chamados' : ''
    const semDivisao = resto ? `<small class="comb-uso">sem divisão ${valorOuPct(SEM_DESTINO_COMBUSTIVEL, resto)}</small>` : ''
    const dica = d.origem === 'manual' ? 'Dividido à mão' : origemRateioCombustivel(d.rateio)
    return `${tags}${semDivisao}<div class="comb-uso-linha"><small class="comb-uso" title="${escaparAtributo(dica)}">${origem}</small>${botao}</div>`
}

const FILA_RATEIO_COMBUSTIVEL = new Set()
let timerRateioCombustivel = null

// As linhas pedem a divisão em lote (uma consulta para a página toda) e se atualizam quando ela chega.
function agendarRateioCombustivel(id) {
    FILA_RATEIO_COMBUSTIVEL.add(id)
    clearTimeout(timerRateioCombustivel)
    timerRateioCombustivel = setTimeout(async () => {
        const ids = [...FILA_RATEIO_COMBUSTIVEL]
        FILA_RATEIO_COMBUSTIVEL.clear()
        try {
            await buscarRateiosCombustivel(ids)
        } catch (erro) {
            console.error(erro)
            return
        }
        ids.forEach(aplicarRateioNaLinhaCombustivel)
        viabilidadeOmie()
    }, 80)
}

function aplicarRateioNaLinhaCombustivel(id) {
    const container = document.querySelector(`[data-deps-custo="${CSS.escape(id)}"]`)
    const { deps, pronto, origem } = divisaoCombustivel(id)
    // Distribuição antiga: a coluna mostra as tags dela (com a autorização); a tabela redesenha a linha.
    if (container && origem !== 'antiga') container.innerHTML = htmlDepsSimplesCombustivel(id, pode('veiculos.editar_combustivel'))
    const caixa = document.querySelector(`[name="marcador"][data-custo="${CSS.escape(id)}"]`)
    if (caixa) {
        caixa.dataset.deps = JSON.stringify(deps)
        caixa.dataset.pronto = pronto ? 'S' : ''
    }
    if (MARCADOS_COMBUSTIVEL.has(id)) MARCADOS_COMBUSTIVEL.set(id, { deps, pronto })
}

// Botão "Dividir": editor de rateio das faturas (js/financeiro.js editorRateioFin), em % ou R$, base = Realizado
// (ou o valor pedido, sem Realizado). Vem preenchido com a divisão de agora (sem a parte sem destino).
async function dividirCombustivel(id) {
    const linha = LINHAS_COMBUSTIVEL.get(id)
    if (!linha) return
    overlayAguarde()
    try {
        await carregarOpcoesFin()
    } catch (erro) {
        return popup({ mensagem: erro.message || 'Falha ao carregar os departamentos.' })
    }
    removerOverlay()
    const total = centavos(Number(linha.realizado) || Number(linha.custo_total) || 0)
    const manual = temManualCombustivel(linha.rateio_manual)
    let atual = linha.rateio_manual || []
    if (!manual) {
        const d = divisaoCombustivel(id)
        const pesos = d.origem === 'antiga'
            ? Object.fromEntries(Object.entries(d.deps).map(([dep, v]) => [dep, v || 1]))
            : (d.pesos || {})
        const soma = Object.values(pesos).reduce((s, p) => s + p, 0)
        atual = Object.entries(pesos)
            .filter(([dep]) => dep && dep !== SEM_DESTINO_COMBUSTIVEL)
            .map(([departamento, peso]) => ({ departamento, percentual: soma ? pctCampoFin(100 * peso / soma) : '' }))
    }
    const idPopup = popup({
        titulo: `Dividir combustível · ${dinheiro(total)}`,
        confirmarFechar: false,
        elemento: `
            <div class="comb-divisor" data-divisor-comb="${escaparAtributo(id)}">
                ${editorRateioFin(null, atual, { total })}
                <small class="comb-uso">A divisão feita aqui vale no lugar da automática.</small>
            </div>`,
        botoes: [
            ...(manual ? [{ texto: 'Voltar à automática', img: 'cancel', funcao: `salvarDivisaoCombustivel('${escaparAtributo(id)}', true)` }] : []),
            { texto: 'Salvar divisão', img: 'concluido', funcao: `salvarDivisaoCombustivel('${escaparAtributo(id)}')` }
        ]
    })
    const bloco = document.querySelector(`[data-divisor-comb="${CSS.escape(id)}"] [data-rateio]`)
    if (bloco) somarRateioFin(bloco)
    DIVISOR_COMBUSTIVEL_POPUP.set(id, idPopup)
}

async function salvarDivisaoCombustivel(id, voltarAutomatica = false) {
    let lista = null
    if (!voltarAutomatica) {
        const raiz = document.querySelector(`[data-divisor-comb="${CSS.escape(id)}"]`)
        if (!raiz) return
        if (lerRateioFin(raiz, true).some(l => !l.departamento && l.percentual))
            return popup({ mensagem: 'Escolha o departamento de todas as linhas (clique num item da lista).' })
        lista = lerRateioFin(raiz).filter(l => l.percentual > 0)
        const soma = lista.reduce((s, l) => s + l.percentual, 0)
        if (!lista.length) return popup({ mensagem: 'Escolha pelo menos um departamento.' })
        if (Math.abs(soma - 100) > 0.01)
            return popup({ mensagem: `A divisão precisa somar 100% (está em ${Number(soma.toFixed(2)).toLocaleString('pt-BR')}%).` })
    }
    overlayAguarde()
    const resultado = await enviar(`custo_veiculos/${id}/rateio_manual`, lista)
    if (resultado && resultado.success === false)
        return popup({ mensagem: resultado.mensagem || 'Falha ao salvar a divisão. Tente novamente.' })
    const linha = LINHAS_COMBUSTIVEL.get(id)
    if (linha) linha.rateio_manual = lista
    if (!lista && linha && !temDistribuicaoCombustivel(linha.distribuicao)) {
        RATEIOS_COMBUSTIVEL.delete(id)
        agendarRateioCombustivel(id)
    }
    aplicarRateioNaLinhaCombustivel(id)
    viabilidadeOmie()
    removerOverlay()
    const idPopup = DIVISOR_COMBUSTIVEL_POPUP.get(id)
    DIVISOR_COMBUSTIVEL_POPUP.delete(id)
    if (idPopup) removerPopup(idPopup)
}

const modeloLabel = (valor1, elemento) => `
<div style="text-align: left; width: 100%; display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 5px;">
    <label>${valor1}</label>
    ${elemento}
</div>
`
const labelDupla = (valor1, valor2) => `
    <div style="display: flex; flex-direction: column; align-items: start;">
        <label style="font-size: 0.7vw;"><strong>${valor1}</strong></label>
        <label style="font-size: 0.9vw;">${valor2}</label>
    </div>
`
const botaoVeiculos = (valor1, funcao, cor) => `
    <div class="botoes" style="background-color: ${cor};" onclick="${funcao}">
        <label>${valor1}</label>
    </div>
`
async function telaVeiculos() {

    try {

        const colunas = {
            'Data de registro': { chave: 'timestamp', tipoPesquisa: 'data' },
            'Usuário': { chave: 'usuario' },
            'Motorista': { chave: 'nomes_motoristas' },
            'Data Pagamento': { chave: 'data_pagamento', tipoPesquisa: 'data' },
            'Marcador': {},
            'Valor': { chave: 'custo_total' },
            'Realizado': { chave: 'realizado' },
            'Cartão': { chave: 'veiculo.cartao' },
            'Departamentos': { chave: 'snapshots.departamentos' },
            'Editar': {}
        }

        const btnExtras = pode('veiculos.editar_combustivel')
            ? `<div id="viabilidade"></div>`
            : ''

        MARCADOS_COMBUSTIVEL.clear()
        RATEIOS_COMBUSTIVEL.clear() // a divisão é recalculada de hora em hora no servidor
        totalDepartamentos = {}

        // vw_custo_veiculos = custo_veiculos + nomes_motoristas (nomes do cadastro, pesquisáveis).
        // As gravações continuam em custo_veiculos.
        const tabela = await modTab({
            pag: 'custoVeiculos',
            detalhes: true,
            btnExtras,
            body: 'bodyCustoVeiculos',
            base: 'vw_custo_veiculos',
            colunas,
            criarLinha: 'criarLinhaCusto'
        })

        tela.innerHTML = `
            <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Combustíveis</h2></div>
                ${tabela}
            </div>
        `

        await paginacao()
        viabilidadeOmie()

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir tabela de Combustíveis: Fale com o suporte.' })
    }

}

async function auxVeiculos() {

    // vw_veiculos traz os nomes dos motoristas resolvidos (nomes_motoristas), pesquisáveis.
    const colunas = {
        'Cartão': { chave: 'cartao' },
        'Motoristas': { chave: 'nomes_motoristas' },
        'Modelo': { chave: 'modelo' },
        'Placa': { chave: 'placa' },
        'Editar': {}
    }

    const btnExtras = `<img src="imagens/baixar.png" onclick="novoVeiculo()">`

    const tabela = await modTab({
        btnExtras,
        pag: 'veiculos',
        body: 'bodyVeiculos',
        colunas,
        base: 'vw_veiculos',
        criarLinha: 'criarLinhaVeiculo'
    })

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
            ${tabela}
        </div>`

    popup({ elemento, titulo: 'Veículos' })
    await paginacao()
}

async function criarLinhaVeiculo(veiculo) {

    const nomes = veiculo?.nomes_motoristas || []

    return `
    <tr>
        <td>${veiculo?.cartao || 'Sem cartão'}</td>
        <td>
            ${nomes.join('<br>')}
        </td>
        <td>
            <label name="veículo">${veiculo?.modelo || ''}</label>
        </td>
        <td>
            <label name="veículo" data-rastreio-placa="${escaparAtributo(veiculo?.placa || '')}">${veiculo?.placa || ''}</label>
        </td>
        <td>
            <img src="imagens/pesquisar.svg" onclick="novoVeiculo('${veiculo.id}')">
        </td>
    </tr>
    `

}

async function criarLinhaCusto(custo) {

    const { veiculo, id, usuario, data_pagamento, comentario, data, realizado, custo_total, distribuicao = {} } = custo
    const { cartao, placa, modelo } = veiculo || {}
    const editavel = pode('veiculos.editar_combustivel')

    const nomes = (custo.nomes_motoristas || [])
        .map(nome => `<b>${escaparAtributo(nome)}</b>`)
        .join('<br>')

    const deps = []
    // Divisão da linha (manual > distribuição antiga > automática pelo uso; ver divisaoCombustivel).
    LINHAS_COMBUSTIVEL.set(id, { distribuicao, rateio_manual: custo.rateio_manual, realizado, custo_total })
    const { deps: valoresDeps, pronto, origem } = divisaoCombustivel(id)
    const antiga = origem === "antiga"
    if (origem === "carregando" && editavel) agendarRateioCombustivel(id)

    // Linha redesenhada (websocket) de um custo marcado: mantém a marcação com os valores novos.
    const marcado = MARCADOS_COMBUSTIVEL.has(id)
    if (marcado) {
        MARCADOS_COMBUSTIVEL.set(id, { deps: valoresDeps, pronto })
        setTimeout(viabilidadeOmie)
    }

    if (!antiga) deps.push(htmlDepsSimplesCombustivel(id, editavel))

    for (const dados of Object.values(antiga ? distribuicao : {})) {

        const { nomeDepartamento, departamento, autorizacao } = dados || {}
        const departamentoEstavel = String(departamento || nomeDepartamento || '')
        // Setor autorizado (js/autorizacao_departamento.js): quem, quando e o comentário na dica.
        const dicaAutorizacao = autorizacao?.aprovado_por
            ? `title="${escaparAtributo(`✔ Autorizado por ${autorizacao.aprovado_por} às ${new Date(Number(autorizacao.aprovado_em)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${autorizacao.comentario ? ` — ${autorizacao.comentario}` : ''}`)}"`
            : ''

        const valor = valoresDeps[departamentoEstavel] || 0

        deps.push(`
            <div style="${horizontal}; gap: 2px;">
                <div class="tag-pendencias pagamento-balao pagamento-balao-departamento"
                name="departamento"
                data-departamento="${escaparAtributo(departamentoEstavel)}"
                data-codigo="${escaparAtributo(departamentoEstavel)}" ${dicaAutorizacao}>
                    <span>${escaparAtributo(departamentoEstavel || '...')}${autorizacao?.aprovado_por ? ' ✔' : ''}</span>
                    ${valor ? `<strong style="margin-left: 6px; white-space: nowrap;">${dinheiro(valor)}</strong>` : ''}
                </div>
            </div>`)
    }
    // Distribuição antiga digitada: também pode ser refeita pelo divisor.
    if (antiga && editavel) deps.push(`<div class="comb-uso-linha"><small class="comb-uso">digitado no pedido</small><button type="button" class="comb-dividir" onclick="dividirCombustivel('${escaparAtributo(id)}')">Dividir</button></div>`)

    const tds = `
        <td>${data || ''}</td>
        <td>${usuario}</td>

        <td>
            <div style="${horizontal}; justify-content: start; gap: 0.5rem; width: 300px;">
                <span data-rastreio-placa="${escaparAtributo(placa || '')}" data-rastreio-sem="cinza" data-rastreio-de="${/^\d{4}-\d{2}-\d{2}$/.test(data || '') ? data : ''}"></span>
                <div style="${vertical}; text-align: left;">
                    <label>${nomes || ''}</label>
                    <label>${placa || ''}</label>
                    <label>${modelo || ''}</label>
                </div>
            </div>
        </td>

        <td>
            <label>${conversorData(data_pagamento)}</label>
        </td>

        <td style="text-align: center;">
            <input type="checkbox" name="marcador" ${marcado ? 'checked' : ''} data-custo="${escaparAtributo(id)}"
                data-deps="${escaparAtributo(JSON.stringify(valoresDeps))}" data-pronto="${pronto ? 'S' : ''}"
                onchange="marcarCustoVeiculo(this, '${escaparAtributo(id)}')" style="width: 2rem; height: 2rem;">
        </td>

        <td>
            <label style="white-space: nowrap;" name="valido">${dinheiro(custo_total)}</label>
        </td>

        <td>
            <div style="${horizontal}; gap: 2px;">
                <span>R$</span>
                <input oninput="mostrarBtn(this)" class="realizado" type="number" min="0" step="0.01" value="${realizado || ''}" ${editavel ? '' : 'readOnly'}>
                <img onclick="atualizarRealizado(this, '${escaparAtributo(id)}')" style="display: none; width: 1.5rem; cursor: pointer;" src="imagens/concluido.png" title="Salvar realizado">
            </div>
        </td>

        <td>${cartao || ''}</td>


        <td>
            <div class="comb-deps" style="${vertical}; gap: 1px;" data-deps-custo="${escaparAtributo(id)}" data-realizado="${Number(realizado) || 0}">${deps.join('')}</div>
        </td>

        <td>
            <img src="imagens/pesquisar.svg" onclick="painelAtalhos('${id}')">
        </td>`

    const detalhes = `
        <div class="veiculo-detalhes">
            <div><strong>Data de Registro</strong><span>${escaparAtributo(data || 'Sem data')}</span></div>
            <div><strong>Comentário</strong><span>${escaparAtributo(comentario || 'Sem comentário')}</span></div>
        </div>
    `

    return { linha: `<tr>${tds}</tr>`, detalhes }
}

function marcarCustoVeiculo(caixa, id) {
    if (caixa.checked) {
        let deps = {}
        try { deps = JSON.parse(caixa.dataset.deps || '{}') } catch { }
        MARCADOS_COMBUSTIVEL.set(id, { deps, pronto: caixa.dataset.pronto === 'S' })
    } else {
        MARCADOS_COMBUSTIVEL.delete(id)
    }
    viabilidadeOmie()
}

// Botão "Criar pagamento": soma o que está marcado (mesmo em outra página da tabela).
function viabilidadeOmie() {

    const viabilidade = document.getElementById('viabilidade')
    if (!viabilidade) return

    totalDepartamentos = {}
    let total = 0
    let semValor = 0

    for (const { deps, pronto } of MARCADOS_COMBUSTIVEL.values()) {
        if (!pronto) semValor++
        for (const [departamento, valor] of Object.entries(deps || {})) {
            if (!valor) continue
            totalDepartamentos[departamento] = centavos((totalDepartamentos[departamento] || 0) + valor)
            total = centavos(total + valor)
        }
    }

    const marcados = MARCADOS_COMBUSTIVEL.size
    const possibilidade = marcados > 0 && semValor === 0 && total > 0
    const dica = !marcados
        ? 'Marque os combustíveis que entram no pagamento'
        : semValor
            ? `${semValor} marcado(s) sem Realizado ou sem departamento: preencha e salve o Realizado (✔)`
            : `${marcados} combustível(is) marcado(s)`

    viabilidade.innerHTML = `
        <div ${possibilidade ? `onclick="criarPagamentoVeiculo()"` : ''} title="${escaparAtributo(dica)}"
            class="botao-criar-pagamento" style="${possibilidade ? '' : 'cursor: not-allowed; opacity: .7;'}">
            <img src="imagens/${possibilidade ? 'concluido' : 'proibido'}.png">
            <span>Criar pagamento${marcados ? ` (${marcados})` : ''}</span>
            <span style="white-space: nowrap;">${dinheiro(total)}</span>
        </div>
    `
}

function limparMarcadosCombustivel() {
    MARCADOS_COMBUSTIVEL.clear()
    document.querySelectorAll('#bodyCustoVeiculos [name="marcador"]').forEach(c => c.checked = false)
    viabilidadeOmie()
}

async function criarPagamentoVeiculo() {

    let totalDeps = 0

    const deps = []

    for (const [descricao, valor] of Object.entries(totalDepartamentos)) {

        totalDeps += valor
        deps.push(`
            <div class="tag-pendencias pagamento-balao pagamento-veiculo-resumo">
                <span>${escaparAtributo(descricao || 'Desatualizado...')}</span>
                <strong>${dinheiro(valor)}</strong>
            </div>`)
    }

    const linhas = [
        { texto: 'App', elemento: `<select id="app">${['AC', 'IAC'].map(op => `<option>${op}</option>`).join('')}</select>` },
        {
            texto: 'Taxa', elemento: `
                <div class="campo-moeda-combustivel">
                    <span>R$</span>
                    <input id="taxa" oninput="somarTaxa(this)" type="number">
                </div>`
        },
        { texto: 'Valor', elemento: `<span id="total" data-total="${totalDeps}">${dinheiro(totalDeps)}</span>` },
        // Vem com o dia de hoje; vira o vencimento da fatura no Financeiro como está (sem ajuste de dia útil).
        { texto: 'Data', elemento: `<input id="data" type="date" value="${dataServidor().toLocaleDateString('en-CA')}">` },
        { texto: 'Observação', elemento: `<textarea id="observacao"></textarea>` },
        { texto: 'Departamentos', elemento: `<div style="${vertical}; gap: 1px;">${deps.join('')}</div>` }
    ]

    const botoes = [
        { img: 'salvo', funcao: 'salvarPagamentoVeiculo()', texto: 'Lançar no Financeiro' }
    ]

    popup({ linhas, botoes, titulo: 'Pagamento Ticket Log' })

}

// Ticket Log: sem aprovação, direto ao Financeiro (fatura a pagar) com a data informada. O servidor confere de novo
// a permissão e o fornecedor (gcs/SCRIPTS/pagamento_aprovacao.js).
const perfisTicketLog = ['fin', 'diretoria', 'adm']

async function salvarPagamentoVeiculo() {
    if (!perfisTicketLog.includes(acesso?.permissao))
        return popup({ mensagem: 'Pagamento da Ticket Log: apenas fin, diretoria e adm.' })

    const el = (id) => {
        const elem = document.getElementById(id)
        return elem.value
    }

    const app = el('app')
    const observacao = el('observacao')
    const taxa = centavos(el('taxa'))
    const inpData = el('data')

    if (!Number.isFinite(taxa) || taxa < 0 || !inpData)
        return popup({ mensagem: 'Preencha a data e/ou o valor da taxa' })

    if (!Object.keys(totalDepartamentos).length)
        return popup({ mensagem: 'Nenhum combustível marcado. Feche e marque de novo.' })

    overlayAguarde()

    try {
        const dt = (data) => {
            const [ano, mes, dia] = data.split('-')
            return `${dia}/${mes}/${ano}`
        }

        const data = dt(inpData)
        const idPagamento = crypto.randomUUID()

        const valoresPorDepartamento = { ...totalDepartamentos }
        valoresPorDepartamento.EMPRESA = Number(valoresPorDepartamento.EMPRESA || 0) + taxa

        const itensDistribuicao = Object.entries(valoresPorDepartamento).map(([departamento, valor]) => ({
            cCodDep: String(departamento),
            nValDep: Number(valor || 0)
        }))

        const distribuicaoAgrupada = {}
        let totalGeral = 0

        for (const item of itensDistribuicao) {
            const { cCodDep, nValDep } = item

            if (!distribuicaoAgrupada[cCodDep]) {
                distribuicaoAgrupada[cCodDep] = { cCodDep, nValDep: 0 }
            }

            distribuicaoAgrupada[cCodDep].nValDep = centavos(distribuicaoAgrupada[cCodDep].nValDep + nValDep)
            totalGeral = centavos(totalGeral + nValDep)
        }

        const distribuicao = Object.values(distribuicaoAgrupada)

        const codigoCategoria = 'Combustível'

        const codigoCliente = 6066446384

        const pagamento = {
            app,
            // O servidor troca "fin" pela permissão real de quem lança.
            status: 'Aprovado por fin',
            criado: acesso.usuario,
            data_registro: dataServidor().toLocaleString(),
            param_estavel: {
                origem: 'TICKET LOG',
                codigo_cliente_fornecedor: codigoCliente,
                chave_pix: '',
                data_vencimento: data,
                data_previsao: data,
                distribuicao,
                observacao,
                valor_documento: totalGeral,
                categorias: [{ codigo_categoria: codigoCategoria, valor: totalGeral }]
            },
            snapshots: {
                cliente: 'TICKET LOG',
                valor: totalGeral,
                categorias: [{ categoria: codigoCategoria, valor: totalGeral }],
                departamentos: distribuicao.map(({ cCodDep, nValDep }) => ({
                    departamento: cCodDep,
                    valor: nValDep
                }))
            }
        }

        const resultado = await enviar(`lista_pagamentos/${idPagamento}`, pagamento)
        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao criar pagamento')

        // Lança na hora (vira fatura a pagar no Financeiro); se falhar, o pagamento fica salvo no GCS com o erro.
        const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        const resposta = await fetch(`${api}/pagamentos/ticket-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: idPagamento })
        })
        const lancamento = await resposta.json().catch(() => ({}))
        if (!resposta.ok)
            throw new Error(`Salvo no GCS, mas não foi lançado: ${lancamento.mensagem || `falha ${resposta.status}`}`)

        removerPopup()
        limparMarcadosCombustivel()
        popup({ mensagem: lancamento.mensagem || `Lançado no Financeiro para ${data}`, imagem: 'imagens/concluido.png' })

    } catch (err) {
        removerPopup()
        popup({ mensagem: err.message || 'Erro ao criar pagamento' })
    } finally {
        removerOverlay()
    }
}

function somarTaxa(input) {
    const elemTotal = document.getElementById('total')
    const total = Number(elemTotal.dataset.total)
    elemTotal.innerHTML = dinheiro(centavos(total + (Number(input.value) || 0)))
}

async function atualizarRealizado(img, idCusto) {

    const input = img.previousElementSibling
    const realizado = centavos(input.value)

    if (!Number.isFinite(realizado) || realizado < 0)
        return popup({ mensagem: 'Realizado inválido.' })

    img.style.display = 'none'

    const resultado = await enviar(`custo_veiculos/${idCusto}/realizado`, realizado)
    if (resultado && resultado.success === false) {
        img.style.display = ''
        return popup({ mensagem: resultado.mensagem || 'Falha ao salvar o realizado. Tente novamente.' })
    }

    // Atualiza já a marcação e os valores da linha (sem esperar a tabela redesenhar).
    const linha = LINHAS_COMBUSTIVEL.get(idCusto)
    if (linha) linha.realizado = realizado
    aplicarRateioNaLinhaCombustivel(idCusto)
    viabilidadeOmie()
}

async function painelAtalhos(idCusto) {

    const { usuario } = await recuperarDado('custo_veiculos', idCusto)

    const botoes = [
        { texto: 'Duplicar Pagamento', img: 'duplicar', funcao: `painelValores('${idCusto}', true)` },
        { texto: 'Editar Pagamento', img: 'editar', funcao: `painelValores('${idCusto}')` },
    ]

    if ((pode('veiculos.excluir') || acesso.usuario == usuario))
        botoes.push({ texto: 'Excluir Pagamento', img: 'cancel', funcao: `painelExcluir('${idCusto}')` })

    popup({ botoes, mensagem: 'Escolha uma opção', titulo: 'Atalhos' })
}

function painelExcluir(idCusto) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', fechar: true, funcao: `excluirCusto('${idCusto}')` }
    ]

    popup({ botoes, mensagem: 'Deseja excluir este lançamento?', removerAnteriores: true })
}

async function excluirCusto(idCusto) {

    await deletar(`custo_veiculos/${idCusto}`)

}

async function prepararVeiculoCombustivel(veiculo) {
    if (!veiculo) return {}
    if (!Array.isArray(veiculo.motoristas)) return veiculo

    const clientes = await Promise.all(veiculo.motoristas.map(m =>
        recuperarDado('clientes', typeof m === 'object' ? m.id : m)))
    const motoristas = [...new Set(clientes.filter(c => c && !c.excluido && c.nome).map(c => c.nome))]
    return { ...veiculo, snapshots: { ...veiculo.snapshots, motoristas } }
}

// Prazo de solicitação de combustível (horário de Brasília, pelo relógio do servidor):
// dias anteriores sempre bloqueados; o próprio dia só até 15:30. O servidor confere de novo
// (gcs/SCRIPTS/combustivel_prazo.js). O lembrete das 15:00 fica em js/lembrete_combustivel.js.
const HORA_LIMITE_COMBUSTIVEL = '15:30'

function agoraBrasiliaCombustivel() {
    let agora
    try { agora = dataServidor() } catch { agora = new Date() }
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(agora).map(p => [p.type, p.value]))
    return { dia: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` }
}

function somarDiaCombustivel(dia, n) {
    const [a, m, d] = dia.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

// Primeiro dia que ainda aceita solicitação: hoje antes das 15:30, senão amanhã.
function primeiroDiaCombustivel() {
    const { dia, hora } = agoraBrasiliaCombustivel()
    return hora < HORA_LIMITE_COMBUSTIVEL ? dia : somarDiaCombustivel(dia, 1)
}

function erroPrazoCombustivel(dataPagamento) {
    const { dia: hoje, hora } = agoraBrasiliaCombustivel()
    if (dataPagamento < hoje) return 'Não é possível solicitar combustível para dias anteriores.'
    if (dataPagamento === hoje && hora >= HORA_LIMITE_COMBUSTIVEL)
        return `Solicitações de combustível para hoje vão até ${HORA_LIMITE_COMBUSTIVEL}. Escolha a partir de amanhã.`
    return null
}

// Formulário simples (21/11/2026): só carro, valor, data e comentário. A divisão por departamento é feita
// depois, pelo uso do carro (rastreio e chamados; gcs SCRIPTS/combustivel_rotas.js → rateio). Lançamento
// antigo editado mantém a distribuição digitada que já tinha (não aparece mais no formulário).
async function painelValores(idCusto, duplicar) {

    await sincronizarRelogioServidor().catch(() => { })

    const custo = await recuperarDado('custo_veiculos', idCusto) || {}
    // Lançamento novo/duplicado: o calendário começa no primeiro dia ainda liberado. Na edição,
    // a data já gravada fica como está (só trocar a data passa pelo prazo).
    const minimoData = primeiroDiaCombustivel()
    const novoLancamento = !idCusto || duplicar
    const veiculo = await prepararVeiculoCombustivel(custo.veiculo)
    const motoristas = Array.isArray(veiculo?.snapshots?.motoristas)
        ? veiculo.snapshots.motoristas
        : []

    const termos = [
        veiculo?.cartao,
        ...motoristas,
        veiculo?.placa,
        veiculo?.modelo
    ].filter(Boolean)

    const linhas = [
        {
            texto: 'Motorista & Veículo',
            elemento: `
                <span ${veiculo?.id ? `id="${veiculo?.id}"` : ''}
                    class="opcoes"
                    name="veiculo"
                    onclick="cxOpcoes('veiculo')">
                        ${veiculo?.id ? termos.join('<br>') : 'Selecionar'}
                </span>`
        },
        {
            texto: 'Valor',
            elemento: `
                <div class="campo-moeda-combustivel">
                    <span>R$</span>
                    <input value="${custo?.custo_total || ''}" id="custo_total" type="number" min="0" step="0.01" placeholder="0,00">
                </div>`
        },
        {
            texto: 'Data Pagamento', elemento: `
            <div style="${vertical}; align-items: start; gap: 2px;">
                <input id="data_pagamento" type="date" min="${minimoData}"
                    value="${novoLancamento && (custo?.data_pagamento || '') < minimoData ? '' : custo?.data_pagamento || ''}">
                <small style="opacity: 0.75;">Para o mesmo dia, solicite até ${HORA_LIMITE_COMBUSTIVEL}.</small>
            </div>` },
        { texto: 'Comentário', elemento: `<textarea rows="4" style="padding: 0.5rem;" id="comentario">${custo?.comentario || ''}</textarea>` },
        {
            elemento: `<small style="opacity: .75; text-align: left;">A divisão por departamento é feita depois, pelo uso do carro (rastreio e chamados).</small>`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: (!idCusto || duplicar) ? `salvarValores()` : `salvarValores('${idCusto}')` }
    ]

    popup({ linhas, botoes, titulo: 'Solicitar combustível' })

    // Controles;
    controlesCxOpcoes.veiculo = {
        base: 'vw_veiculos',
        retornar: ['cartao', 'nomes_motoristas', 'placa', 'modelo'],
        colunas: {
            'Final do Cartão': { chave: 'cartao' },
            'Placa': { chave: 'placa' },
            'Modelo': { chave: 'modelo' },
            'Motoristas': { chave: 'nomes_motoristas' }
        }
    }
}

async function salvarValores(idCusto = crypto.randomUUID()) {

    overlayAguarde()

    const painel = document.querySelector('.painel-padrao')
    const idVeiculo = painel.querySelector('[name="veiculo"]').id

    if (!idVeiculo)
        return popup({ mensagem: `Preencha o Veículo` })

    const veiculo = await recuperarDado('veiculos', idVeiculo)
    // Edição mantém o que já estava gravado (quem registrou, quando e a distribuição antiga, se tiver);
    // novo (ou duplicado, que ganha outro id) nasce sem distribuição.
    const anterior = await recuperarDado('custo_veiculos', idCusto) || {}

    const custo_total = centavos(obterValores('custo_total'))
    const data_pagamento = obterValores('data_pagamento')

    if (!veiculo)
        return popup({ mensagem: `Veículo não encontrado no cadastro. Selecione de novo.` })

    if (!(custo_total > 0))
        return popup({ mensagem: `Preencha o valor` })

    if (data_pagamento == '')
        return popup({ mensagem: `Preencha a data de pagamento` })

    if (data_pagamento !== anterior.data_pagamento) {
        await sincronizarRelogioServidor().catch(() => { })
        const erroPrazo = erroPrazoCombustivel(data_pagamento)
        if (erroPrazo) return popup({ mensagem: erroPrazo })
    }

    const dados = {
        ...anterior,
        id: idCusto,
        distribuicao: anterior.distribuicao || {},
        veiculo,
        categoria: 'Combustível',
        custo_total,
        comentario: obterValores('comentario'),
        data_pagamento,
        data: anterior.data || dataServidor().toLocaleString(),
        usuario: anterior.usuario || acesso.usuario
    }
    // Campos que vêm da view (vw_custo_veiculos) e não são da tabela.
    delete dados.nomes_motoristas

    // Lançamento antigo com setor no rateio: a autorização já gravada é mantida pelo servidor.
    if (temDistribuicaoCombustivel(dados.distribuicao)) {
        try {
            await autorizarSetoresCombustivel(dados)
        } catch (erro) {
            return popup({ mensagem: erro.message || 'Falha na autorização do departamento.' })
        }
        overlayAguarde()
    }

    const resultado = await enviar(`custo_veiculos/${idCusto}`, dados)
    if (!resultado?.success)
        return popup({ mensagem: resultado?.mensagem || 'Falha ao salvar o combustível. Tente novamente.' })

    RATEIOS_COMBUSTIVEL.delete(idCusto)
    removerPopup()
}

async function novoVeiculo(idVeiculo) {

    overlayAguarde()

    const veiculo = await recuperarDado('veiculos', idVeiculo) || {}

    const motoristas = []

    for (const m of (veiculo.motoristas || [])) {
        const id = typeof m === 'object' ? m?.id : m
        if (!id) continue
        // Motorista apagado do cadastro: mostra o código em vez de travar a tela.
        const motorista = await recuperarDado('clientes', id).catch(() => null)
        motoristas.push(adicionarMotorista({ id, nome: motorista?.nome || `Cadastro ${id} não encontrado` }))
    }

    const linhas = [
        { texto: 'Placa', elemento: `<input value="${veiculo?.placa || ''}" id="placa" placeholder="Placa">` },
        { texto: 'Modelo', elemento: `<input value="${veiculo?.modelo || ''}" id="modelo" placeholder="Modelo">` },
        { texto: 'Final do Cartão', elemento: `<input value="${veiculo?.cartao || ''}" id="cartao" placeholder="Final do Cartão">` },
        {
            texto: `<div style="${horizontal}; gap: 1rem;"><span>Motoristas</span> <img src="imagens/baixar.png" onclick="adicionarMotorista()"></div>`,
            elemento: `
            <div class="motoristas">
                ${motoristas.join('')}
            </div>`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            img: 'concluido',
            funcao: idVeiculo
                ? `salvarVeiculo('${idVeiculo}')`
                : 'salvarVeiculo()'
        }
    ]

    if (pode('veiculos.excluir') && idVeiculo)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirVeiculo('${idVeiculo}')` })

    popup({ linhas, botoes, titulo: 'Gerenciar Veículo' })

}

function confirmarExcluirVeiculo(idVeiculo) {

    // Fecha só a confirmação e o "Gerenciar Veículo" (a janela de onde veio o clique),
    // sem derrubar as outras janelas abertas.
    const popups = [...document.querySelectorAll('.popup')]
    const idFormulario = popups[popups.length - 1]?.id || ''

    const botoes = [
        {
            fechar: true,
            texto: 'Confirmar',
            img: 'concluido',
            funcao: `excluirVeiculo('${idVeiculo}', '${idFormulario}')`
        }
    ]

    popup({ mensagem: 'Excluir Veículo', botoes })
}

async function excluirVeiculo(idVeiculo, idFormulario) {

    await deletar(`veiculos/${idVeiculo}`)

    if (idFormulario) removerPopup(idFormulario)

}

function adicionarMotorista({ id, nome } = {}) {

    const div = document.querySelector('.motoristas')
    const aleatorio = id || crypto.randomUUID()
    const label = `
        <div style="${horizontal}; gap: 1rem;">
            <span 
            class="opcoes"
            ${id ? `id="${aleatorio}"` : ''}
            name="${aleatorio}"
            onclick="cxOpcoes('${aleatorio}')">
                ${nome || 'Selecione'}
            </span>
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
        </div>
    `

    // Controles;
    controlesCxOpcoes[aleatorio] = {
        base: 'clientes',
        retornar: ['nome'],
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Matrícula': { chave: 'matricula' },
            'Nome': { chave: 'nome' },
            'Estado': { chave: 'estado' },
            'Cidade': { chave: 'cidade' }
        }
    }

    if (id)
        return label

    div.insertAdjacentHTML('beforeend', label)
}

function obterValores(id) {
    const elemento = document.getElementById(id);
    const tipo = elemento.type;

    if (tipo === "number")
        return Number(elemento.value);

    return elemento.value;
}

async function salvarVeiculo(idVeiculo = crypto.randomUUID()) {

    overlayAguarde()

    const motoristas = [...document.querySelectorAll('.motoristas span')]
        .filter(m => m.id)
        .map(m => ({ id: Number(m.id) }))

    const veiculo = {
        id: idVeiculo,
        modelo: obterValores('modelo'),
        placa: obterValores('placa'),
        cartao: obterValores('cartao'),
        motoristas
    }

    const resultado = await enviar(`veiculos/${idVeiculo}`, veiculo)
    if (resultado && resultado.success === false)
        return popup({ mensagem: resultado.mensagem || 'Falha ao salvar o veículo. Tente novamente.' })

    removerPopup()
}

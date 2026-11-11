// Locação por tabela de coeficientes: a mensalidade de cada equipamento é
//   valor do equipamento × coeficiente do prazo
// Só itens classificados como Equipamento no cadastro (dados_composicoes.classificacao = 'EQUIPAMENTO') entram no cálculo;
// material de consumo vai em orçamento comum.
// A tabela fica em config_locacao/padrao (editável por adm e diretoria) e é copiada para o orçamento
// (orcamento.locacao): mudar a tabela depois não altera orçamentos já feitos.

const ID_CONFIG_LOCACAO = 'padrao'
// Valor de orcamento.lpu_ativa (e tipo dos itens) na locação; 'ALUGUEL' é o nome antigo.
const MODO_LOCACAO = 'LOCAÇÃO'

function ehOrcamentoLocacao(lpuAtiva) {
    return lpuAtiva === MODO_LOCACAO || lpuAtiva === 'ALUGUEL'
}

// Orçamento de locação (criar, editar, duplicar): só adm e diretoria.
const PERMISSOES_LOCACAO = ['adm', 'diretoria']

function podeUsarLocacao() {
    return PERMISSOES_LOCACAO.includes(acesso?.permissao)
}

// Devolve true se bloqueou (e avisa); quem chama só segue quando der false.
function bloquearLocacao() {
    if (podeUsarLocacao()) return false
    popup({ mensagem: 'O orçamento de locação é liberado só para as permissões <b>adm</b> e <b>diretoria</b>.' })
    return true
}
const PERMISSOES_CONFIG_LOCACAO = ['adm', 'diretoria']

// Valores padrão (validade 30/06/2026); usados só enquanto não houver tabela salva no banco.
const CONFIG_LOCACAO_PADRAO = {
    validade: '2026-06-30',
    coeficientes: { 12: 0.10348, 24: 0.05653, 36: 0.04278, 48: 0.03636, 60: 0.03309, 72: 0.03125 }
}

let configLocacaoAtual = null

async function carregarConfigLocacao() {
    const salva = await recuperarDado('config_locacao', ID_CONFIG_LOCACAO)
    configLocacaoAtual = salva?.coeficientes
        ? normalizarConfigLocacao(salva)
        : { ...structuredClone(CONFIG_LOCACAO_PADRAO), padrao: true }
    return configLocacaoAtual
}

function normalizarConfigLocacao(config) {
    const coeficientes = {}
    for (const [prazo, coef] of Object.entries(config?.coeficientes || {})) {
        const n = Number(prazo), c = Number(coef)
        if (n > 0 && c > 0) coeficientes[n] = c
    }
    return {
        validade: config?.validade || '',
        coeficientes
    }
}

// Prazo em meses a partir do período do orçamento; DIAS e SEMANAS não usam a tabela.
function prazoLocacaoMeses(periodo, quantidade) {
    const q = Number(quantidade)
    if (!(q > 0)) return null
    if (periodo === 'MESES') return q
    if (periodo === 'ANOS') return q * 12
    return null
}

// Conta pura: mensalidade unitária de um equipamento. Sem coeficiente para o prazo, devolve null.
function mensalidadeLocacao({ valor, meses, config }) {
    const coeficiente = Number(config?.coeficientes?.[meses]) || 0
    if (!coeficiente || !(valor > 0)) return null
    return {
        coeficiente,
        mensalidade: Math.round(valor * coeficiente * 100) / 100
    }
}

function tabelaLocacaoVencida(config) {
    if (!config?.validade) return false
    const limite = new Date(`${config.validade}T23:59:59`)
    return !isNaN(limite) && limite < dataServidor()
}

function dataBrLocacao(iso) {
    const [a, m, d] = String(iso || '').split('-')
    return a && m && d ? `${d}/${m}/${a}` : '--'
}

function mesmaTabelaLocacao(a, b) {
    const n = c => JSON.stringify(normalizarConfigLocacao(c))
    return n(a) === n(b)
}

function podeEditarConfigLocacao() {
    return PERMISSOES_CONFIG_LOCACAO.includes(acesso?.permissao)
}

// Tabela que vale para o orçamento: a copiada nele; sem cópia, a atual.
function configLocacaoDoOrcamento(orcamento) {
    return orcamento?.locacao?.coeficientes
        ? normalizarConfigLocacao(orcamento.locacao)
        : normalizarConfigLocacao(configLocacaoAtual || CONFIG_LOCACAO_PADRAO)
}

async function usarTabelaLocacaoAtual() {
    const orcamento = baseOrcamento()
    await carregarConfigLocacao()
    orcamento.locacao = { ...(orcamento.locacao || {}), ...normalizarConfigLocacao(configLocacaoAtual) }
    baseOrcamento(orcamento)
    await total()
}

function painelInfoLocacao({ config, meses, periodo }) {
    const prazos = Object.keys(config.coeficientes).map(Number).sort((a, b) => a - b)
    const partes = []

    if (meses === null)
        partes.push(`<span class="locacao-aviso">Cálculo por coeficiente só para MESES ou ANOS${periodo ? ` (período atual: ${periodo})` : ''}</span>`)
    else if (!config.coeficientes[meses])
        partes.push(`<span class="locacao-aviso">Sem coeficiente para ${meses} meses. Prazos da tabela: ${prazos.join(', ')}</span>`)
    else
        partes.push(`<span>Coeficiente ${meses} meses: <b>${config.coeficientes[meses].toLocaleString('pt-BR', { maximumFractionDigits: 5 })}</b></span>`)

    partes.push(tabelaLocacaoVencida(config)
        ? `<span class="locacao-aviso">Tabela vencida em ${dataBrLocacao(config.validade)}: confirme os coeficientes</span>`
        : `<span>Tabela válida até ${dataBrLocacao(config.validade)}</span>`)

    if (configLocacaoAtual && !configLocacaoAtual.padrao && !mesmaTabelaLocacao(config, configLocacaoAtual))
        partes.push(`<button type="button" class="locacao-botao" onclick="usarTabelaLocacaoAtual()">Usar tabela atual</button>`)

    if (podeEditarConfigLocacao())
        partes.push(`<button type="button" class="locacao-botao" onclick="abrirConfigLocacao()">Coeficientes</button>`)

    return partes.join('')
}

async function abrirConfigLocacao() {
    if (!podeEditarConfigLocacao())
        return popup({ mensagem: 'Só adm e diretoria alteram a tabela de coeficientes.' })

    overlayAguarde()
    const config = await carregarConfigLocacao()
    const prazos = Object.keys(config.coeficientes).map(Number).sort((a, b) => a - b)

    const linhas = [
        { texto: 'Validade da tabela', elemento: `<input type="date" name="validade_locacao" value="${config.validade || ''}">` },
        ...prazos.map(n => ({
            texto: `${n} meses`,
            elemento: `<input type="number" step="0.00001" min="0" name="coef_locacao" data-prazo="${n}" value="${config.coeficientes[n]}">`
        }))
    ]

    if (config.padrao)
        linhas.unshift({ elemento: `<span>Ainda não há tabela salva: estes são os valores padrão.</span>` })

    popup({
        titulo: 'Coeficientes de locação',
        linhas,
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarConfigLocacao()' }]
    })
}

async function salvarConfigLocacao() {
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const coeficientes = {}
    for (const input of painel.querySelectorAll('[name="coef_locacao"]')) {
        const valor = Number(input.value)
        if (!(valor > 0))
            return popup({ mensagem: `Informe o coeficiente de ${input.dataset.prazo} meses.` })
        coeficientes[input.dataset.prazo] = valor
    }

    const validade = painel.querySelector('[name="validade_locacao"]').value
    if (!validade)
        return popup({ mensagem: 'Informe a validade da tabela.' })

    const config = {
        validade,
        coeficientes,
        usuario: acesso.usuario
    }

    overlayAguarde()
    const resposta = await enviar(`config_locacao/${ID_CONFIG_LOCACAO}`, config)
    if (!resposta || resposta.mensagem)
        return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar a tabela. Fale com o suporte.' })

    await carregarConfigLocacao()
    removerPopup()
    if (document.getElementById('orcamento_locacao')) await total()
}

// Preço do item na LPU escolhida (histórico ativo).
function precoLpuLocacao(produto, lpu) {
    const dadosLpu = produto?.[lpu]
    return Number(dadosLpu?.historico?.[dadosLpu?.ativo]?.valor) || 0
}

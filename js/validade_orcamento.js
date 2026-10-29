// Validade do orçamento: 15 dias corridos a partir da data de registro.
// - dados_orcam.data_registro: "dd/mm/aaaa, hh:mm", gravada uma vez e nunca mais alterada
//   (dados_orcam.data continua mudando a cada salvamento: é a data da última atualização).
// - dados_orcam.validade_ate: "aaaa-mm-dd". No registro, data_registro + 15 dias; ao estender,
//   hoje + 15 dias (somar a uma data já vencida continuaria vencido).
// - dados_orcam.prorrogacoes: histórico das extensões [{ em, usuario, ate }].
// Orçamento antigo, sem esses campos: o registro cai para a última "data" gravada, que congela no
// próximo salvamento (garantirValidadeOrcamento).

const VALIDADE_ORCAMENTO_DIAS = 15

const TEXTO_VALIDADE_ORCAMENTO = `VALIDADE DO ORÇAMENTO: ${VALIDADE_ORCAMENTO_DIAS} dias corridos, sujeito à revalidação após esse prazo. ` +
    'Os preços consideram faturamento até 31/12/2026. Para faturamento a partir de 01/01/2027, os valores ' +
    'estarão sujeitos à revisão em razão dos impactos da Reforma Tributária, mediante prévia concordância entre as partes.'

// "dd/mm/aaaa" ou "dd/mm/aaaa, hh:mm[:ss]" -> Date (ou null).
function lerDataBrOrcamento(texto) {
    const partes = String(texto || '').match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*(\d{2}):(\d{2}))?/)
    if (!partes) return null
    const [, dia, mes, ano, hh = '00', mm = '00'] = partes
    return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm))
}

const isoDataOrcamento = data =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`

const brDataOrcamento = data =>
    `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`

function somarDiasOrcamento(data, dias) {
    const nova = new Date(data)
    nova.setDate(nova.getDate() + dias)
    return nova
}

// Registro e validade calculados (sem gravar nada). Datas como Date; null se não houver como saber.
function validadeOrcamento(dados_orcam = {}) {
    const registro = lerDataBrOrcamento(dados_orcam.data_registro) || lerDataBrOrcamento(dados_orcam.data)
    const ate = /^\d{4}-\d{2}-\d{2}$/.test(dados_orcam.validade_ate || '')
        ? new Date(`${dados_orcam.validade_ate}T23:59:59`)
        : registro ? somarDiasOrcamento(registro, VALIDADE_ORCAMENTO_DIAS) : null
    // Vale até o fim do último dia.
    if (ate) ate.setHours(23, 59, 59, 999)
    return { registro, ate, vencido: Boolean(ate) && dataServidor() > ate }
}

// Antes de salvar: fixa a data de registro e a validade se ainda não existirem.
function garantirValidadeOrcamento(dados_orcam) {
    if (!dados_orcam) return dados_orcam
    const agora = dataServidor()
    if (!lerDataBrOrcamento(dados_orcam.data_registro)) {
        const anterior = lerDataBrOrcamento(dados_orcam.data)
        dados_orcam.data_registro = (anterior ? anterior : agora).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados_orcam.validade_ate || ''))
        dados_orcam.validade_ate = isoDataOrcamento(somarDiasOrcamento(lerDataBrOrcamento(dados_orcam.data_registro), VALIDADE_ORCAMENTO_DIAS))
    dados_orcam.validade = VALIDADE_ORCAMENTO_DIAS
    return dados_orcam
}

// Ao abrir o orçamento: se venceu (e ainda não virou centro de custo), oferece estender.
function perguntarProrrogacaoOrcamento(id, orcamento) {
    if (!orcamento?.dados_orcam || orcamento.departamento_existente) return
    const { ate, vencido } = validadeOrcamento(orcamento.dados_orcam)
    if (!vencido) return

    const novaData = brDataOrcamento(somarDiasOrcamento(dataServidor(), VALIDADE_ORCAMENTO_DIAS))
    popup({
        titulo: 'Orçamento vencido',
        mensagem: `
            A validade deste orçamento terminou em <b>${brDataOrcamento(ate)}</b>.<br>
            Deseja estender por mais ${VALIDADE_ORCAMENTO_DIAS} dias, até <b>${novaData}</b>?`,
        botoes: [{ texto: `Estender ${VALIDADE_ORCAMENTO_DIAS} dias`, img: 'concluido', funcao: `estenderValidadeOrcamento('${id}')` }]
    })
}

async function estenderValidadeOrcamento(id) {
    overlayAguarde()
    try {
        const { dados_orcam } = await recuperarDado('dados_orcamentos', id) || {}
        if (!dados_orcam) throw new Error('Orçamento não encontrado.')

        const ate = isoDataOrcamento(somarDiasOrcamento(dataServidor(), VALIDADE_ORCAMENTO_DIAS))
        garantirValidadeOrcamento(dados_orcam)
        const prorrogacoes = [...(Array.isArray(dados_orcam.prorrogacoes) ? dados_orcam.prorrogacoes : []),
            { em: dataServidor().toLocaleString('pt-BR'), usuario: acesso.usuario, ate }]

        // Só os campos de validade: não toca no resto do orçamento.
        for (const [campo, valor] of [['data_registro', dados_orcam.data_registro], ['validade', VALIDADE_ORCAMENTO_DIAS],
            ['validade_ate', ate], ['prorrogacoes', prorrogacoes]]) {
            const { success, mensagem } = await enviar(`dados_orcamentos/${id}/dados_orcam/${campo}`, valor) || {}
            if (!success) throw new Error(mensagem || 'Falha ao salvar a nova validade.')
        }

        removerPopup()
        popup({ mensagem: `Validade estendida até ${brDataOrcamento(new Date(`${ate}T12:00:00`))}.`, imagem: 'imagens/concluido.png' })
    } catch (erro) {
        console.error(erro)
        popup({ mensagem: erro.message || 'Falha ao estender a validade.' })
    }
}

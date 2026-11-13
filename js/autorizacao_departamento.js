// Autorização em tempo real de departamento de setor (servidor: SCRIPTS/autorizacao_departamento.js).
// Setor = nome que não é contrato (ORC_...) nem G...: ao salvar um pagamento com setor novo no rateio,
// o pedido vai para quem é diretoria/adm/fin e está online; o primeiro que responder decide.

const PERFIS_APROVADORES_DEP = ['diretoria', 'adm', 'fin']
const esperasAutorizacaoDep = new Map()   // id do pedido → função que recebe a resposta
const popupsAutorizacaoDep = new Map()    // id do pedido → id do popup aberto para o aprovador

const ehSetorDepartamento = nome => {
    const texto = String(nome ?? '').trim()
    return !!texto && !/^ORC_/i.test(texto) && !/^G/i.test(texto)
}

async function apiAutorizacaoDep(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}/autorizacao-departamento/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok || !dados.success) throw new Error(dados.mensagem || 'Falha na comunicação com o servidor.')
    return dados
}

const horaAutorizacaoDep = ms => new Date(Number(ms)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Linha mostrada no detalhe do pagamento, abaixo do departamento.
function rastreioAutorizacaoDepartamento(autorizacao) {
    if (!autorizacao?.aprovado_por) return ''
    const comentario = autorizacao.comentario ? ` — “${escaparAtributo(autorizacao.comentario)}”` : ''
    return `<small class="autorizacao-dep-rastreio">✔ Autorizado por <b>${escaparAtributo(autorizacao.aprovado_por)}</b> às ${horaAutorizacaoDep(autorizacao.aprovado_em)}${comentario}</small>`
}

// Chamado por salvarPagamento antes de enviar. Resolve quando não precisa ou foi aprovado (marca os
// itens do rateio com o id do pedido; o servidor troca pelo rastreio); lança erro se negado/expirado.
async function autorizarSetoresPagamento(pagamento, idPagamento) {
    const estavel = pagamento?.param_estavel || {}
    const distribuicao = Array.isArray(estavel.distribuicao) ? estavel.distribuicao : []
    distribuicao.forEach(d => delete d.autorizacao)

    const pedido = await autorizarSetores({
        origem: 'pagamento',
        referenciaId: idPagamento,
        departamentos: distribuicao.map(d => d.cCodDep),
        contexto: {
            fornecedor: pagamento.snapshots?.cliente || '',
            valor: estavel.valor_documento,
            observacao: estavel.observacao || '',
            rateio: distribuicao.map(d => ({ departamento: d.cCodDep, valor: d.nValDep }))
        }
    })
    if (!pedido) return
    for (const d of distribuicao)
        if (pedido.departamentos.includes(String(d.cCodDep).trim())) d.autorizacao = { id: pedido.id }
}

// Abastecimento (js/veiculos.js → salvarValores): distribuicao = { [departamento]: { departamento, km } }.
async function autorizarSetoresCombustivel(dados) {
    const itens = Object.values(dados?.distribuicao || {})
    itens.forEach(d => delete d.autorizacao)

    const pedido = await autorizarSetores({
        origem: 'combustivel',
        referenciaId: dados.id,
        departamentos: itens.map(d => d.departamento),
        contexto: {
            veiculo: [dados.veiculo?.placa, dados.veiculo?.modelo].filter(Boolean).join(' - '),
            valor: dados.custo_total,
            observacao: dados.comentario || '',
            rateio: itens.map(d => ({ departamento: d.departamento, km: d.km }))
        }
    })
    if (!pedido) return
    for (const d of itens)
        if (pedido.departamentos.includes(String(d.departamento).trim())) d.autorizacao = { id: pedido.id }
}

// Pede e espera. Devolve null se não precisa, o pedido se aprovado; lança erro se negado/expirado.
async function autorizarSetores({ origem, referenciaId, departamentos, contexto }) {
    if (!departamentos.some(ehSetorDepartamento)) return null
    if (PERFIS_APROVADORES_DEP.includes(acesso?.permissao)) return null

    const pedido = await apiAutorizacaoDep('solicitar', { origem, referencia_id: referenciaId, departamentos, contexto })
    if (!pedido.necessaria) return null

    const resposta = await esperarAutorizacaoDep(pedido)
    if (resposta.status !== 'APROVADO') {
        const motivo = resposta.comentario ? `<br><i>“${escaparAtributo(resposta.comentario)}”</i>` : ''
        throw new Error(resposta.status === 'NEGADO'
            ? `<b>${escaparAtributo(resposta.respondido_por)}</b> negou o uso de ${escaparAtributo(pedido.departamentos.join(', '))}.${motivo}`
            : resposta.status === 'CANCELADO' ? 'Pedido de autorização cancelado.'
                : 'Ninguém respondeu a tempo. Tente de novo ou use um contrato (ORC_...).')
    }

    balaoNotificacao({ imagem: 'imagens/concluido.png', texto: `${resposta.respondido_por} autorizou ${pedido.departamentos.join(', ')}` })
    return pedido
}

function esperarAutorizacaoDep(pedido) {
    return new Promise(resolve => {
        const fim = Date.now() + (pedido.prazo_ms || 300000)
        const chave = crypto.randomUUID()
        const idPopup = popup({
            titulo: 'Autorização necessária',
            modal: true,
            elemento: `
                <div class="autorizacao-dep">
                    <img src="gifs/loading-gcs.png" style="width: 3rem;">
                    <span><b>${escaparAtributo(pedido.departamentos.join(', '))}</b> é departamento de setor.</span>
                    <span>Aguardando a resposta de: ${pedido.aprovadores.map(a => `<b>${escaparAtributo(a)}</b>`).join(', ')}</span>
                    <small id="relogio-${chave}"></small>
                </div>`,
            botoes: [{ id: `cancelar-${chave}`, texto: 'Cancelar pedido', img: 'cancel' }]
        })

        let encerrado = false
        const terminar = resposta => {
            if (encerrado) return
            encerrado = true
            clearInterval(relogio)
            clearInterval(consulta)
            esperasAutorizacaoDep.delete(pedido.id)
            removerPopup(idPopup)
            resolve(resposta)
        }

        // Resposta chega pelo websocket; a consulta a cada 5 s cobre uma queda da conexão.
        esperasAutorizacaoDep.set(pedido.id, terminar)
        const relogio = setInterval(() => {
            const resta = Math.max(0, Math.round((fim - Date.now()) / 1000))
            const el = document.getElementById(`relogio-${chave}`)
            if (el) el.textContent = `Expira em ${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`
            if (!document.getElementById(idPopup)) cancelar()
        }, 1000)
        const consulta = setInterval(async () => {
            try {
                const atual = await apiAutorizacaoDep('consultar', { id: pedido.id })
                if (atual.status !== 'PENDENTE') terminar(atual)
            } catch { }
        }, 5000)

        function cancelar() {
            apiAutorizacaoDep('cancelar', { id: pedido.id }).catch(() => { })
            terminar({ status: 'CANCELADO' })
        }
        document.getElementById(`cancelar-${chave}`)?.addEventListener('click', cancelar, { once: true })
    })
}

// websocket.js: mensagens do fluxo.
function receberAutorizacaoDepartamento(data) {
    if (data.tipo === 'autorizacao_departamento_resposta') {
        esperasAutorizacaoDep.get(data.id)?.(data)
        return
    }
    if (data.tipo === 'autorizacao_departamento_encerrada') {
        const idPopup = popupsAutorizacaoDep.get(data.id)
        popupsAutorizacaoDep.delete(data.id)
        if (idPopup && document.getElementById(idPopup)) {
            removerPopup(idPopup)
            balaoNotificacao({
                imagem: 'imagens/alerta.png',
                texto: data.respondido_por ? `${data.respondido_por} já respondeu o pedido de departamento`
                    : data.status === 'CANCELADO' ? 'O pedido de departamento foi cancelado' : 'O pedido de departamento expirou'
            })
        }
        return
    }
    if (data.tipo === 'autorizacao_departamento')
        mostrarPedidoAutorizacaoDep(data)
}

function mostrarPedidoAutorizacaoDep({ id, solicitante, departamentos = [], contexto = {} }) {
    if (popupsAutorizacaoDep.has(id)) return
    const combustivel = contexto.origem === 'combustivel'
    const rateio = (contexto.rateio || []).map(r => {
        const setor = departamentos.includes(String(r.departamento).trim())
        const quanto = combustivel ? `${Number(r.km || 0).toLocaleString('pt-BR')} km` : dinheiro(r.valor)
        return `<li class="${setor ? 'autorizacao-dep-setor' : ''}">${escaparAtributo(r.departamento)} → ${quanto}</li>`
    }).join('')

    const idPopup = popup({
        titulo: 'Pedido de autorização',
        modal: true,
        confirmarFechar: false,
        elemento: `
            <div class="autorizacao-dep" style="align-items: stretch; text-align: left;">
                <span><b>${escaparAtributo(solicitante)}</b> quer lançar ${combustivel ? 'um abastecimento' : 'um pagamento'} em
                    <b>${escaparAtributo(departamentos.join(', '))}</b> (departamento de setor).</span>
                ${contexto.fornecedor ? `<span>Recebedor: <b>${escaparAtributo(contexto.fornecedor)}</b></span>` : ''}
                ${contexto.veiculo ? `<span>Veículo: <b>${escaparAtributo(contexto.veiculo)}</b></span>` : ''}
                <span>Valor: <b>${dinheiro(contexto.valor || 0)}</b></span>
                ${rateio ? `<ul class="autorizacao-dep-rateio">${rateio}</ul>` : ''}
                ${contexto.observacao ? `<small style="white-space: pre-wrap;">${escaparAtributo(contexto.observacao)}</small>` : ''}
                <textarea id="comentario-autorizacao-${id}" rows="3" placeholder="Comentário (obrigatório para negar)"></textarea>
            </div>`,
        botoes: [
            { texto: 'Negar', img: 'cancel', funcao: `responderAutorizacaoDep('${id}', false)` },
            { texto: 'Autorizar', img: 'concluido', funcao: `responderAutorizacaoDep('${id}', true)` }
        ]
    })
    popupsAutorizacaoDep.set(id, idPopup)
    try { navigator.vibrate?.(200) } catch { }
}

async function responderAutorizacaoDep(id, aprovado) {
    const comentario = document.getElementById(`comentario-autorizacao-${id}`)?.value.trim() || ''
    if (!aprovado && !comentario) return popup({ mensagem: 'Escreva o motivo para negar.' })
    try {
        await apiAutorizacaoDep('responder', { id, aprovado, comentario })
        const idPopup = popupsAutorizacaoDep.get(id)
        popupsAutorizacaoDep.delete(id)
        removerPopup(idPopup)
        balaoNotificacao({ imagem: 'imagens/concluido.png', texto: aprovado ? 'Autorizado' : 'Negado' })
    } catch (erro) {
        const idPopup = popupsAutorizacaoDep.get(id)
        popupsAutorizacaoDep.delete(id)
        removerPopup(idPopup)
        popup({ mensagem: erro.message })
    }
}

let comunicadosGCS = []
let leiturasComunicadosGCS = new Map()

function dataComunicadoGCS(valor) {
    if (!valor) return null
    const timestamp = Date.parse(valor)
    return Number.isFinite(timestamp) ? timestamp : null
}

function comunicadoGCSVigente(comunicado) {
    if (!comunicado || comunicado.ativo === false || !comunicado.id || !comunicado.html)
        return false

    const agora = agoraServidor()
    const inicio = dataComunicadoGCS(comunicado.inicio)
    const fim = dataComunicadoGCS(comunicado.fim)
    return !(inicio !== null && agora < inicio) && !(fim !== null && agora > fim)
}

function htmlSeguroComunicadoGCS(html) {
    const documento = new DOMParser().parseFromString(String(html || ''), 'text/html')
    documento.querySelectorAll('script, iframe, object, embed, form').forEach(elemento => elemento.remove())
    documento.querySelectorAll('*').forEach(elemento => {
        for (const atributo of [...elemento.attributes]) {
            const nome = atributo.name.toLowerCase()
            const valor = atributo.value.trim().toLowerCase()
            if (nome.startsWith('on') || ((nome === 'href' || nome === 'src') && valor.startsWith('javascript:')))
                elemento.removeAttribute(atributo.name)
        }
        if (elemento.tagName === 'A' && elemento.hasAttribute('href')) {
            elemento.setAttribute('target', '_blank')
            elemento.setAttribute('rel', 'noopener noreferrer')
        }
    })
    return documento.body.innerHTML
}

function usuarioComunicadoGCS() {
    return String(acesso?.id || acesso?.usuario || '')
}

function chaveComunicadoGCS(comunicado) {
    return `${String(comunicado.id)}:${String(comunicado.versao || '1')}`
}

function idLeituraComunicadoGCS(comunicado) {
    return `${usuarioComunicadoGCS()}__${comunicado.id}__${comunicado.versao || '1'}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
}

function leituraComunicadoGCS(comunicado) {
    return leiturasComunicadosGCS.get(chaveComunicadoGCS(comunicado)) || null
}

function comunicadoPorIdGCS(id) {
    return comunicadosGCS.find(comunicado => String(comunicado.id) === String(id))
}

function ordenarComunicadosGCS(a, b) {
    const prioridade = Number(b.prioridade || 0) - Number(a.prioridade || 0)
    if (prioridade) return prioridade
    const dataB = dataComunicadoGCS(b.publicado_em || b.inicio) || 0
    const dataA = dataComunicadoGCS(a.publicado_em || a.inicio) || 0
    return dataB - dataA
}

async function registrarLeituraComunicadoGCS(comunicado, confirmar = false) {
    const usuario_id = usuarioComunicadoGCS()
    if (!usuario_id || !comunicado) return false

    const existente = leituraComunicadoGCS(comunicado) || {}
    const agora = dataServidor().toISOString()
    const leitura = {
        ...existente,
        id: idLeituraComunicadoGCS(comunicado),
        usuario_id,
        comunicado_id: String(comunicado.id),
        versao: String(comunicado.versao || '1'),
        aberto_em: existente.aberto_em || agora,
        confirmado_em: confirmar ? (existente.confirmado_em || agora) : (existente.confirmado_em || null)
    }

    const chave = chaveComunicadoGCS(comunicado)
    leiturasComunicadosGCS.set(chave, leitura)

    try {
        const resposta = await enviar(`comunicados_gcs_leituras/${leitura.id}`, leitura)
        if (!resposta?.success)
            throw new Error(resposta?.mensagem || 'Não foi possível registrar a leitura do comunicado.')
    } catch (erro) {
        const atual = leiturasComunicadosGCS.get(chave)
        if (atual === leitura) {
            if (existente.id) leiturasComunicadosGCS.set(chave, existente)
            else leiturasComunicadosGCS.delete(chave)
        }
        throw erro
    }

    const atual = leiturasComunicadosGCS.get(chave)
    if (!atual?.confirmado_em || leitura.confirmado_em)
        leiturasComunicadosGCS.set(chave, leitura)
    mostrarLembreteComunicadosGCS()
    atualizarCentralComunicadosGCS()
    return true
}

function conteudoComunicadoGCS(comunicado) {
    return `<article class="comunicado-gcs-conteudo">${htmlSeguroComunicadoGCS(comunicado.html)}</article>`
}

function abrirComunicadoGCS(id) {
    const comunicado = comunicadoPorIdGCS(id)
    if (!comunicadoGCSVigente(comunicado)) return

    const leitura = leituraComunicadoGCS(comunicado)
    const popupId = popup({
        titulo: comunicado.titulo || 'Atualização do GCS',
        elemento: conteudoComunicadoGCS(comunicado),
        conteudoRodape: leitura?.confirmado_em
            ? ''
            : '<button type="button" class="comunicado-gcs-confirmar">Entendi</button>'
    })

    registrarLeituraComunicadoGCS(comunicado).catch(erro =>
        console.error('Falha ao registrar abertura do comunicado:', erro)
    )

    const botao = document.getElementById(popupId)?.querySelector('.comunicado-gcs-confirmar')
    botao?.addEventListener('click', async () => {
        try {
            botao.disabled = true
            await registrarLeituraComunicadoGCS(comunicado, true)
            removerPopup(popupId)
        } catch (erro) {
            botao.disabled = false
            popup({ mensagem: erro.message || 'Falha ao confirmar a leitura.' })
        }
    })
}

function cartoesCentralComunicadosGCS() {
    if (!comunicadosGCS.length)
        return '<div class="central-atualizacoes-vazia">Nenhuma atualização disponível.</div>'

    return comunicadosGCS.map(comunicado => {
        const leitura = leituraComunicadoGCS(comunicado)
        const estado = leitura?.confirmado_em ? 'Lido' : leitura?.aberto_em ? 'Aberto' : 'Novo'
        const data = comunicado.publicado_em || comunicado.inicio
        const dataFormatada = dataComunicadoGCS(data) !== null
            ? new Date(data).toLocaleDateString('pt-BR')
            : ''

        return `
            <button type="button" class="central-atualizacoes-item ${leitura?.confirmado_em ? 'lido' : 'nao-lido'}"
                data-comunicado-id="${escaparAtributo(String(comunicado.id))}">
                <span class="central-atualizacoes-marcador"></span>
                <span class="central-atualizacoes-textos">
                    <strong>${escaparAtributo(comunicado.titulo || 'Atualização do GCS')}</strong>
                    <small>${escaparAtributo(comunicado.resumo || '')}</small>
                </span>
                <span class="central-atualizacoes-meta">
                    ${dataFormatada ? `<time>${escaparAtributo(dataFormatada)}</time>` : ''}
                    <b>${estado}</b>
                </span>
            </button>`
    }).join('')
}

function ligarCentralComunicadosGCS(container) {
    container?.querySelectorAll('[data-comunicado-id]').forEach(botao => {
        botao.addEventListener('click', () => abrirComunicadoGCS(botao.dataset.comunicadoId))
    })
}

function atualizarCentralComunicadosGCS() {
    document.querySelectorAll('.central-atualizacoes-gcs').forEach(container => {
        container.innerHTML = cartoesCentralComunicadosGCS()
        ligarCentralComunicadosGCS(container)
    })
}

function abrirCentralComunicadosGCS() {
    const popupId = popup({
        titulo: 'Central de atualizações',
        elemento: `<div class="central-atualizacoes-gcs">${cartoesCentralComunicadosGCS()}</div>`
    })
    const container = document.getElementById(popupId)?.querySelector('.central-atualizacoes-gcs')
    ligarCentralComunicadosGCS(container)
}

function mostrarLembreteComunicadosGCS() {
    const cabecalho = document.querySelector('.cabecalho-usuario')
    if (!cabecalho) return

    cabecalho.querySelector('#lembreteComunicadoGCS')?.remove()
    if (!comunicadosGCS.length) return

    const naoLidos = comunicadosGCS.filter(comunicado => !leituraComunicadoGCS(comunicado)?.confirmado_em).length
    const referencia = cabecalho.querySelector('#divUsuarios')
    const posicao = referencia ? 'afterend' : 'afterbegin'
    ;(referencia || cabecalho).insertAdjacentHTML(posicao, `
        <button id="lembreteComunicadoGCS" class="lembrete-comunicado-gcs" type="button"
            onclick="abrirCentralComunicadosGCS()" title="Abrir central de atualizações"
            aria-label="Abrir central de atualizações">
            <img src="imagens/sino.png" alt="">
            ${naoLidos ? `<b class="lembrete-comunicado-contador contador-toolbar-gcs">${naoLidos}</b>` : ''}
        </button>`)
}

async function pesquisarTodosComunicadosGCS(base, filtros) {
    const limite = 200
    const primeira = await pesquisarDB({ base, pagina: 1, limite, filtros })
    const resultados = [...(primeira?.resultados || [])]
    const paginas = Math.max(1, Number(primeira?.paginas || 1))

    if (paginas > 1) {
        const restantes = await Promise.all(
            Array.from({ length: paginas - 1 }, (_, indice) =>
                pesquisarDB({ base, pagina: indice + 2, limite, filtros })
            )
        )
        restantes.forEach(resposta => resultados.push(...(resposta?.resultados || [])))
    }

    return resultados
}

async function carregarComunicadoGCS() {
    try {
        const usuario_id = usuarioComunicadoGCS()
        if (!usuario_id) return

        const [resultadosComunicados, resultadosLeituras] = await Promise.all([
            pesquisarTodosComunicadosGCS('comunicados_gcs', {
                ativo: { op: '=', value: true }
            }),
            pesquisarTodosComunicadosGCS('comunicados_gcs_leituras', {
                usuario_id: { op: '=', value: usuario_id }
            })
        ])

        comunicadosGCS = resultadosComunicados
            .filter(comunicadoGCSVigente)
            .sort(ordenarComunicadosGCS)

        leiturasComunicadosGCS = new Map(
            resultadosLeituras.map(leitura => [
                `${String(leitura.comunicado_id)}:${String(leitura.versao || '1')}`,
                leitura
            ])
        )

        mostrarLembreteComunicadosGCS()

        const automatico = comunicadosGCS.find(comunicado =>
            comunicado.exibir_automaticamente !== false &&
            !leituraComunicadoGCS(comunicado)?.confirmado_em
        )
        if (automatico)
            abrirComunicadoGCS(automatico.id)
    } catch (erro) {
        comunicadosGCS = []
        leiturasComunicadosGCS = new Map()
        mostrarLembreteComunicadosGCS()
        console.error('Falha ao carregar central de atualizações:', erro)
    }
}

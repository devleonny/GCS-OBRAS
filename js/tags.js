const cLinear = (cor) => `background: linear-gradient(90deg, ${cor} 0%, ${cor}91 85%)`

function isDark(cor) {
    if (!cor) return false
    const c = cor.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) < 150
}

const modeloTag = ({ cor = '#999', nome, id }, idOrcamento = null) => {

    const branco = isDark(cor)
        ? 'color: #fff;'
        : ''

    const funcao = idOrcamento
        ? `confirmarRemocaoTag('${id}', '${idOrcamento}')`
        : `vincularTag('${id}')`

    const modelo = `
        <div class="tag" style="${cLinear(cor)}; ${branco}">
            <span onclick="${funcao}">
                ${nome || '--'}
            </span>
            <img src="imagens/tag_${branco == 'color: #fff;' ? 'branca' : 'preta'}.png"
                style="width:1.4rem"
                onclick="abrirEdicaoTag('${id}')">
        </div>
        `

    return modelo
}

async function criarLinhaTag(tag) {

    return `
        <tr>
            <td>${modeloTag(tag)}</td>
        </tr>`

}

async function renderPainel(idOrcamento) {

    const colunas = {
        'Etiquetas': { chave: 'nome' }
    }

    const pag = 'etiquetas'
    const tabela = await modTab({
        pag,
        colunas,
        criarLinha: 'criarLinhaTag',
        body: 'bodyEtiquetas',
        base: 'tags_orcamentos'
    })

    controles.etiquetas.idOrcamento = idOrcamento

    const botoes = [
        { texto: 'Criar Etiqueta', img: 'etiqueta', funcao: `abrirEdicaoTag()` }
    ]

    const elemento = `<div style="padding: 1rem;">${tabela}</div>`

    popup({ titulo: 'Gerenciar Etiquetas', elemento, botoes })

    await paginacao(pag)

}

async function vincularTag(idTag) {
    overlayAguarde()
    const id = controles.etiquetas.idOrcamento

    const tag = {
        data: new Date().toLocaleString(),
        usuario: acesso.usuario
    }

    if (id == 'novo') {

        const tag = await recuperarDado('tags_orcamentos', idTag) || {}
        const orcamento = baseOrcamento()

        // Snapshots;
        orcamento.snapshots ??= {}
        orcamento.snapshots.tags ??= {}
        orcamento.snapshots.tags[idTag] = tag

        // Padrão;
        orcamento.tags ??= {}
        orcamento.tags[idTag] = tag

        // Devolver pra memória;
        baseOrcamento(orcamento)

    } else {
        await enviar(`dados_orcamentos/${id}/tags/${idTag}`, tag)
    }

    // Não precisa esperar;
    carregarTags(id)

    removerOverlay()
}

function confirmarRemocaoTag(idTag, idOrcamento) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `removerTag('${idTag}', '${idOrcamento}')` }
    ]

    popup({ mensagem: 'Remover tag?', botoes })
}

async function removerTag(idTag, idOrcamento) {

    try {
        if (idOrcamento == 'novo') {

            const orcamento = baseOrcamento()

            delete orcamento.tags[idTag]
            delete orcamento.snapshots.tags[idTag]

            baseOrcamento(orcamento)

        } else {
            await deletar(`dados_orcamentos/${idOrcamento}/tags/${idTag}`)
        }

        removerPopup() // Confirmação;

        // Não precisa esperar;
        carregarTags()

    } catch (err) {
        removerPopup() // Confirmação;
        popup({ mensagem: 'Falha ao remover Tag' })
    }

}

async function abrirEdicaoTag(id = crypto.randomUUID()) {
    const tag = await recuperarDado('tags_orcamentos', id) || {}

    const elemento = `
        <div class="painel-adicionar-etiqueta">
            <input name="nome" placeholder="Nome" value="${tag.nome || ''}">
            <input name="cor" type="color" value="${tag.cor || '#999'}">
        </div>
    `
    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarTag('${id}')` }
    ]

    popup({ elemento, botoes, titulo: 'Tags' })
}

async function salvarTag(id) {
    overlayAguarde()

    const painel = document.querySelector('.painel-adicionar-etiqueta')
    const nome = painel.querySelector('[name="nome"]').value
    const cor = painel.querySelector('[name="cor"]').value

    if (!nome)
        return removerPopup()

    const tag = { nome, cor, id }

    await enviar(`tags_orcamentos/${id}`, tag)

    removerPopup()
}

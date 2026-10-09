const cLinear = (cor) => `background: linear-gradient(90deg, ${cor} 0%, ${cor}91 85%)`

function isDark(cor) {
    if (!cor) return false
    const c = cor.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) < 150
}

const modeloTag = (tag, idOrcamento = null) => {

    const { cor = '#999', nome, id } = tag || {}

    const branco = isDark(cor)
        ? 'color: #fff;'
        : ''

    const funcao = idOrcamento == 'N'
        ? ''
        : idOrcamento
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

        overlayAguarde()

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

async function abrirEdicaoTag(id = null) {

    try {
        overlayAguarde()

        const { nome, cor } = id
            ? await recuperarDado('tags_orcamentos', id) || {}
            : {}

        id = id || crypto.randomUUID()

        const cores = [
            '#e11d48',
            '#f472b6',
            '#fb923c',
            '#facc15',
            '#84cc16',
            '#10b981',
            '#0ea5e9',
            '#3b82f6',
            '#8b5cf6',
            '#a78bfa'
        ]
            .map(cor => `<button onclick="escolherCor('${cor}')" class="item-color" style="--color: ${cor}"></button>`)
            .join('')

        const linhas = [
            {
                texto: 'Nome da Tag',
                elemento: `<input name="nome" placeholder="Nome" value="${nome || ''}">`
            },
            {
                texto: 'Cor',
                elemento: `
                    <div style="${horizontal}; gap: 1rem;">
                        <button data-cor="${cor}" style="background-color: ${cor || '#222'};" class="cor-atual"></button>
                        <div class="container-items">
                            ${cores}
                        </div>
                    </div>
                `
            }
        ]

        const botoes = [
            { texto: 'Salvar', img: 'concluido', funcao: `salvarTag('${id}')` }
        ]

        popup({ linhas, botoes, titulo: 'Tags' })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Não foi possível abrir a tag: Fale com o suporte.' })
    }
}

function escolherCor(cor) {
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const local = painel.querySelector('.cor-atual')
    local.style.backgroundColor = cor
    local.dataset.cor = cor
}

async function salvarTag(id) {

    try {

        overlayAguarde()

        const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
        const nome = painel.querySelector('[name="nome"]').value
        const cor = painel.querySelector('.cor-atual').dataset.cor

        if (!nome)
            return removerPopup()

        const tag = { nome, cor, id }

        await enviar(`tags_orcamentos/${id}`, tag)

        removerPopup()
        
    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao criar a Etiqueta: Fale com o suporte.' })
    }
}

async function carregarTags() {

    const id = controles.etiquetas.idOrcamento
    const localTags = document.getElementById('tags')

    if (!localTags)
        return

    localTags.innerHTML = '<img src="gifs/loading.gif" style="width: 5rem;">'

    const { snapshots } = id !== 'novo'
        ? await recuperarDado('dados_orcamentos', id) || {}
        : baseOrcamento()

    // Tags;
    const listaTags = Object.values(snapshots?.tags || {})
        .map(tag => modeloTag(tag, id))
        .join('')

    localTags.innerHTML = listaTags

}

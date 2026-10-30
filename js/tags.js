const cLinear = (cor) => `background: linear-gradient(90deg, ${cor} 0%, ${cor}91 85%)`

function isDark(cor) {
    if (!cor) return false
    const c = cor.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) < 150
}

// Vincular/remover muda a tela na hora e grava em seguida; se o servidor recusar,
// a tela volta. A lista de orçamentos só atualizaria depois do refresh da
// mvw_dados_orcamentos + aviso do websocket, o que dava a sensação de não ter vinculado.
const estadoTags = {
    idOrcamento: null,
    vinculadas: new Set(),
    pendentes: new Set(),
    catalogo: null
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
        <div class="tag" data-tag="${escaparAtributo(String(id || ''))}" style="${cLinear(cor)}; ${branco}">
            <span onclick="${funcao}">${nome || '--'}</span>
            <img class="tag-editar" src="imagens/tag_${branco == 'color: #fff;' ? 'branca' : 'preta'}.png"
                title="Editar tag" alt=""
                onclick="event.stopPropagation(); abrirEdicaoTag('${id}')">
        </div>
        `

    return modelo
}

// Catálogo de tags (nome e cor), carregado uma vez; renovado ao salvar uma tag.
async function catalogoTags(recarregar = false) {
    if (estadoTags.catalogo && !recarregar) return estadoTags.catalogo
    const { resultados } = await pesquisarDB({ base: 'tags_orcamentos', limite: 5000 }) || {}
    estadoTags.catalogo = new Map((resultados || []).map(tag => [String(tag.id), tag]))
    return estadoTags.catalogo
}

async function idsTagsDoOrcamento(idOrcamento) {
    const { tags } = idOrcamento === 'novo'
        ? baseOrcamento()
        : await recuperarDado('dados_orcamentos', idOrcamento) || {}
    return new Set(Object.keys(tags || {}))
}

// Redesenha as tags do orçamento onde ele estiver na tela: linha da lista e dados do orçamento.
async function atualizarTagsNaTela(idOrcamento, ids) {
    const catalogo = await catalogoTags()
    const html = [...ids]
        .map(idTag => catalogo.get(String(idTag)))
        .filter(Boolean)
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
        .map(tag => modeloTag(tag, idOrcamento))
        .join('')

    document.querySelectorAll(`[name="tags"][data-orcamento="${CSS.escape(String(idOrcamento))}"]`)
        .forEach(local => { local.innerHTML = html })

    const formulario = document.getElementById('tags')
    if (formulario && controles?.etiquetas?.idOrcamento === idOrcamento)
        formulario.innerHTML = html
}

async function criarLinhaTag(tag) {

    const id = String(tag?.id || '')
    const vinculada = estadoTags.vinculadas.has(id)

    return `
        <tr>
            <td>
                <div class="tag-opcao${vinculada ? ' vinculada' : ''}" data-tag-opcao="${escaparAtributo(id)}"
                    role="button" tabindex="0" aria-pressed="${vinculada}"
                    onclick="alternarTag(this.dataset.tagOpcao)"
                    onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); alternarTag(this.dataset.tagOpcao) }">
                    ${modeloTag(tag, 'N')}
                    <span class="tag-opcao-estado">${vinculada ? '✓ Vinculada' : 'Vincular'}</span>
                </div>
            </td>
        </tr>`

}

function marcarOpcaoTag(idTag) {
    const opcao = document.querySelector(`[data-tag-opcao="${CSS.escape(String(idTag))}"]`)
    if (!opcao) return
    const vinculada = estadoTags.vinculadas.has(String(idTag))
    opcao.classList.toggle('vinculada', vinculada)
    opcao.classList.toggle('salvando', estadoTags.pendentes.has(String(idTag)))
    opcao.setAttribute('aria-pressed', String(vinculada))
    opcao.querySelector('.tag-opcao-estado').textContent = vinculada ? '✓ Vinculada' : 'Vincular'
}

async function renderPainel(idOrcamento) {

    try {

        estadoTags.idOrcamento = idOrcamento
        controles.etiquetas ??= {}
        controles.etiquetas.idOrcamento = idOrcamento

        // O estado de cada tag precisa estar pronto antes de desenhar as linhas.
        const [vinculadas] = await Promise.all([idsTagsDoOrcamento(idOrcamento), catalogoTags()])
        estadoTags.vinculadas = vinculadas

        const pag = 'etiquetas'
        const tabela = await modTab({
            pag,
            colunas: { 'Etiquetas': { chave: 'nome' } },
            criarLinha: 'criarLinhaTag',
            body: 'bodyEtiquetas',
            base: 'tags_orcamentos'
        })

        const botoes = [
            { texto: 'Criar Etiqueta', img: 'etiqueta', funcao: `abrirEdicaoTag()` }
        ]

        popup({ titulo: 'Gerenciar Etiquetas', elemento: `<div class="painel-tags">${tabela}</div>`, botoes })

        await paginacao(pag)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Não foi possível abrir as etiquetas: Fale com o suporte.' })
    }

}

// Grava o vínculo; devolve true se o servidor aceitou.
async function gravarVinculoTag(idOrcamento, idTag, vincular) {

    if (idOrcamento === 'novo') {
        const orcamento = baseOrcamento()
        orcamento.tags ??= {}
        orcamento.snapshots ??= {}
        orcamento.snapshots.tags ??= {}

        if (vincular) {
            orcamento.tags[idTag] = { data: dataServidor().toLocaleString(), usuario: acesso.usuario }
            orcamento.snapshots.tags[idTag] = (await catalogoTags()).get(String(idTag)) || {}
        } else {
            delete orcamento.tags[idTag]
            delete orcamento.snapshots.tags[idTag]
        }

        baseOrcamento(orcamento)
        return true
    }

    const resultado = vincular
        ? await enviar(`dados_orcamentos/${idOrcamento}/tags/${idTag}`, {
            data: dataServidor().toLocaleString(),
            usuario: acesso.usuario
        })
        : await deletar(`dados_orcamentos/${idOrcamento}/tags/${idTag}`)

    // enviar falha com null ou { mensagem }; deletar com null ou o id do popup que já abriu.
    return Boolean(resultado) && typeof resultado === 'object' && !resultado.mensagem
}

// Muda a tela primeiro e grava depois; se falhar, volta ao estado anterior.
async function definirTag(idOrcamento, idTag, vincular) {

    idTag = String(idTag)
    if (estadoTags.pendentes.has(idTag)) return

    const ids = idOrcamento === estadoTags.idOrcamento
        ? estadoTags.vinculadas
        : await idsTagsDoOrcamento(idOrcamento)

    const anterior = ids.has(idTag)
    if (anterior === vincular) return

    vincular ? ids.add(idTag) : ids.delete(idTag)
    estadoTags.pendentes.add(idTag)
    marcarOpcaoTag(idTag)
    atualizarTagsNaTela(idOrcamento, ids)

    let gravou = false
    try {
        gravou = await gravarVinculoTag(idOrcamento, idTag, vincular)
    } catch (err) {
        console.error(err)
    }

    estadoTags.pendentes.delete(idTag)

    if (!gravou) {
        anterior ? ids.add(idTag) : ids.delete(idTag)
        atualizarTagsNaTela(idOrcamento, ids)
        if (!document.querySelector('.popup .mensagem'))
            popup({ mensagem: vincular ? 'Não foi possível vincular a etiqueta.' : 'Não foi possível remover a etiqueta.' })
    }

    marcarOpcaoTag(idTag)
}

async function alternarTag(idTag) {
    const idOrcamento = estadoTags.idOrcamento
    if (!idOrcamento) return
    await definirTag(idOrcamento, idTag, !estadoTags.vinculadas.has(String(idTag)))
}

// Mantido para chamadas antigas: vincula ao orçamento do painel aberto.
async function vincularTag(idTag) {
    if (estadoTags.idOrcamento)
        await definirTag(estadoTags.idOrcamento, idTag, true)
}

function confirmarRemocaoTag(idTag, idOrcamento) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `removerTag('${idTag}', '${idOrcamento}')` }
    ]

    popup({ mensagem: 'Remover tag?', botoes })
}

async function removerTag(idTag, idOrcamento) {
    removerPopup() // Confirmação;
    await definirTag(idOrcamento, idTag, false)
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
                elemento: `<input name="nome" placeholder="Nome" value="${escaparAtributo(nome || '')}">`
            },
            {
                texto: 'Cor',
                elemento: `
                    <div style="${horizontal}; gap: 1rem;">
                        <button data-cor="${cor || ''}" style="background-color: ${cor || '#222'};" class="cor-atual"></button>
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
        const nome = painel.querySelector('[name="nome"]').value.trim()
        const cor = painel.querySelector('.cor-atual').dataset.cor || '#222'

        if (!nome)
            return removerPopup()

        const tag = { nome, cor, id }

        const resultado = await enviar(`tags_orcamentos/${id}`, tag)
        if (!resultado || resultado.mensagem)
            return popup({ mensagem: resultado?.mensagem || 'Falha ao salvar a Etiqueta: Fale com o suporte.' })

        removerPopup()

        // Nome/cor novos aparecem no painel e nas tags já exibidas.
        await catalogoTags(true)
        if (controles.etiquetas?.pag || document.getElementById('bodyEtiquetas'))
            await paginacao('etiquetas')
        if (estadoTags.idOrcamento)
            atualizarTagsNaTela(estadoTags.idOrcamento, estadoTags.vinculadas)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao criar a Etiqueta: Fale com o suporte.' })
    }
}

// Tags do orçamento nos dados do orçamento (#tags), a partir do vínculo + catálogo.
async function carregarTags(idOrcamento = controles?.etiquetas?.idOrcamento) {

    const localTags = document.getElementById('tags')

    if (!localTags || !idOrcamento)
        return

    localTags.innerHTML = '<img src="gifs/loading-gcs.gif" style="width: 5rem;">'

    try {
        const ids = await idsTagsDoOrcamento(idOrcamento)
        if (idOrcamento === estadoTags.idOrcamento) estadoTags.vinculadas = ids
        await atualizarTagsNaTela(idOrcamento, ids)
    } catch (err) {
        console.error(err)
        localTags.innerHTML = ''
    }

}

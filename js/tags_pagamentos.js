// Tags de pagamento (26/11/2026): um cadastro só do favorecido (ex.: EMBASA) e a tag diz de onde é a conta
// (GALPÃO 6, ALEX, COSTA...). Catálogo próprio (tags_pagamentos: nome + cor), editável como o dos orçamentos
// (js/tags.js: cLinear, isDark e escolherCor vêm de lá). Usado no formulário da fatura (Financeiro), na lista
// de faturas e no formulário de pagamento (Reembolsos). Guardadas como lista de ids.
//
// Campo: htmlTagsPag(ids, { editavel }) → <div class="tags-pag" data-tags-pag="[...]">; lerTagsPag(campo) → ids.

const estadoTagsPag = { catalogo: null, carregando: null, campo: null }

async function catalogoTagsPag(recarregar = false) {
    if (estadoTagsPag.catalogo && !recarregar) return estadoTagsPag.catalogo
    if (!estadoTagsPag.carregando || recarregar)
        estadoTagsPag.carregando = pesquisarDB({ base: 'tags_pagamentos', limite: 5000 })
            .then(r => new Map((r?.resultados || []).filter(t => !t.excluido).map(t => [String(t.id), t])))
            .catch(err => { console.error('[TAGS PAG]', err); return new Map() })
            .finally(() => { estadoTagsPag.carregando = null })
    estadoTagsPag.catalogo = await estadoTagsPag.carregando
    return estadoTagsPag.catalogo
}

// Catálogo já carregado (para desenhar linhas de tabela sem esperar); vazio até a 1ª carga.
const catalogoTagsPagPronto = () => estadoTagsPag.catalogo || new Map()

const idsTagsPag = lista => (Array.isArray(lista) ? lista : []).map(String).filter(Boolean)

function chipTagPag(tag, { remover = false } = {}) {
    const cor = tag?.cor || '#94a3b8'
    const escura = isDark(cor)
    return `<span class="tag-pag${escura ? ' escura' : ''}" style="${cLinear(cor)}" title="${escaparAtributo(tag?.nome || '')}">
        ${escaparAtributo(tag?.nome || '--')}${remover ? `<button type="button" class="tag-pag-tirar" title="Tirar a tag"
            onclick="event.stopPropagation(); tirarTagPag(this, '${escaparAtributo(String(tag?.id || ''))}')">×</button>` : ''}
    </span>`
}

// Chips só de leitura (linha da tabela, cartões). Tag que não está no catálogo (excluída) não aparece.
function chipsTagsPag(ids, catalogo = catalogoTagsPagPronto()) {
    return idsTagsPag(ids)
        .map(id => catalogo.get(id))
        .filter(Boolean)
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
        .map(tag => chipTagPag(tag))
        .join('')
}

function htmlTagsPag(ids = [], { editavel = true } = {}) {
    const lista = idsTagsPag(ids)
    return `<div class="tags-pag${editavel ? ' editavel' : ''}" data-tags-pag="${escaparAtributo(JSON.stringify(lista))}">
        <div class="tags-pag-chips" data-tags-pag-chips></div>
        ${editavel ? `<button type="button" class="tags-pag-mais" onclick="abrirTagsPag(this.closest('.tags-pag'))" title="Escolher ou criar tags">+ Tag</button>` : ''}
    </div>`
}

function lerTagsPag(campo) {
    if (!campo) return []
    try { return idsTagsPag(JSON.parse(campo.dataset.tagsPag || '[]')) } catch { return [] }
}

// Desenha os chips de todos os campos de tags da tela (depois de pôr o htmlTagsPag no DOM).
async function desenharCamposTagsPag(raiz = document) {
    const campos = [...raiz.querySelectorAll('.tags-pag[data-tags-pag]')]
    if (!campos.length) return
    const catalogo = await catalogoTagsPag()
    for (const campo of campos) {
        const editavel = campo.classList.contains('editavel')
        const html = lerTagsPag(campo)
            .map(id => catalogo.get(id))
            .filter(Boolean)
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .map(tag => chipTagPag(tag, { remover: editavel }))
            .join('')
        const local = campo.querySelector('[data-tags-pag-chips]')
        if (local) local.innerHTML = html || (editavel ? '' : '<span class="tags-pag-vazio">Sem tags</span>')
    }
}

function gravarTagsNoCampoPag(campo, ids) {
    campo.dataset.tagsPag = JSON.stringify(idsTagsPag(ids))
    desenharCamposTagsPag(campo.parentElement || document)
    // Formulário de pagamento: recalcula o que vai ser salvo.
    if (campo.closest('[data-tags-pagamento]') && typeof calculadoraPagamento === 'function') calculadoraPagamento()
}

function tirarTagPag(botao, id) {
    const campo = botao.closest('.tags-pag')
    if (!campo) return
    gravarTagsNoCampoPag(campo, lerTagsPag(campo).filter(t => t !== String(id)))
}

// ------------------------------------------------------------------ escolher / criar / editar

async function abrirTagsPag(campo) {
    if (!campo) return
    estadoTagsPag.campo = campo
    overlayAguarde()
    const catalogo = await catalogoTagsPag()
    removerOverlay()
    const anterior = document.querySelector('[data-escolha-tags-pag]')?.closest('.popup')?.id
    if (anterior) removerPopup(anterior)
    popup({
        titulo: 'Tags',
        elemento: `
            <div class="tags-pag-escolha" data-escolha-tags-pag>
                <div class="tags-pag-escolha-topo">
                    <input type="search" placeholder="Buscar tag…" oninput="filtrarTagsPag(this.value)" data-busca-tags-pag>
                    <button type="button" onclick="editarTagPag()">+ Criar tag</button>
                </div>
                <small>Clique na tag para pôr ou tirar. O lápis edita o nome e a cor (vale para todos os pagamentos).</small>
                <div class="tags-pag-lista" data-lista-tags-pag>${listaEscolhaTagsPag(catalogo)}</div>
            </div>`
    })
    setTimeout(() => document.querySelector('[data-busca-tags-pag]')?.focus(), 50)
}

function listaEscolhaTagsPag(catalogo = catalogoTagsPagPronto()) {
    const marcadas = new Set(lerTagsPag(estadoTagsPag.campo))
    const tags = [...catalogo.values()].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
    if (!tags.length) return '<div class="tags-pag-vazio">Nenhuma tag ainda: crie a primeira.</div>'
    return tags.map(tag => {
        const id = escaparAtributo(String(tag.id))
        const marcada = marcadas.has(String(tag.id))
        return `<div class="tags-pag-opcao${marcada ? ' marcada' : ''}" data-tag-pag-opcao="${id}" data-nome="${escaparAtributo(String(tag.nome || '').toLowerCase())}">
            <button type="button" class="tags-pag-alternar" onclick="alternarTagPag('${id}')" aria-pressed="${marcada}">
                ${chipTagPag(tag)}<span class="tags-pag-estado">${marcada ? '✓' : ''}</span>
            </button>
            <button type="button" class="tags-pag-lapis" title="Editar nome e cor" onclick="editarTagPag('${id}')">✎</button>
        </div>`
    }).join('')
}

function filtrarTagsPag(texto) {
    const t = String(texto || '').trim().toLowerCase()
    document.querySelectorAll('[data-tag-pag-opcao]').forEach(op => { op.hidden = Boolean(t) && !op.dataset.nome.includes(t) })
}

function alternarTagPag(id) {
    const campo = estadoTagsPag.campo
    if (!campo?.isConnected) return
    const ids = lerTagsPag(campo)
    gravarTagsNoCampoPag(campo, ids.includes(String(id)) ? ids.filter(x => x !== String(id)) : [...ids, String(id)])
    redesenharEscolhaTagsPag()
}

function redesenharEscolhaTagsPag() {
    const lista = document.querySelector('[data-lista-tags-pag]')
    if (!lista) return
    lista.innerHTML = listaEscolhaTagsPag()
    filtrarTagsPag(document.querySelector('[data-busca-tags-pag]')?.value)
}

const CORES_TAGS_PAG = ['#e11d48', '#f472b6', '#fb923c', '#facc15', '#84cc16', '#10b981', '#0ea5e9', '#3b82f6', '#8b5cf6', '#64748b']

async function editarTagPag(id = null) {
    const tag = id ? catalogoTagsPagPronto().get(String(id)) || {} : {}
    const nova = !id
    const cor = tag.cor || CORES_TAGS_PAG[Math.floor(Math.random() * CORES_TAGS_PAG.length)]
    const busca = document.querySelector('[data-busca-tags-pag]')?.value || ''
    popup({
        titulo: nova ? 'Nova tag' : 'Editar tag',
        linhas: [
            { texto: 'Nome', elemento: `<input name="nome" maxlength="40" placeholder="Ex.: GALPÃO 6" value="${escaparAtributo(tag.nome || (nova ? busca.toUpperCase() : ''))}">` },
            {
                texto: 'Cor',
                elemento: `
                    <div style="${horizontal}; gap: 1rem;">
                        <button type="button" data-cor="${escaparAtributo(cor)}" style="background-color: ${escaparAtributo(cor)};" class="cor-atual"></button>
                        <div class="container-items">
                            ${CORES_TAGS_PAG.map(c => `<button type="button" onclick="escolherCor('${c}')" class="item-color" style="--color: ${c}"></button>`).join('')}
                        </div>
                    </div>`
            }
        ],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarTagPag('${escaparAtributo(String(id || ''))}')` }]
    })
}

async function salvarTagPag(id) {
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const nome = String(painel?.querySelector('[name="nome"]')?.value || '').trim().toUpperCase()
    const cor = painel?.querySelector('.cor-atual')?.dataset.cor || '#64748b'
    if (!nome) return popup({ mensagem: 'Dê um nome para a tag.' })
    const catalogo = await catalogoTagsPag()
    const repetida = [...catalogo.values()].find(t => String(t.nome || '').trim().toUpperCase() === nome && String(t.id) !== String(id))
    if (repetida) return popup({ mensagem: `Já existe a tag <b>${escaparAtributo(nome)}</b>.` })

    const novaId = id || crypto.randomUUID()
    overlayAguarde()
    const resultado = await enviar(`tags_pagamentos/${novaId}`, { id: novaId, nome, cor })
    removerOverlay()
    if (!resultado || resultado.mensagem)
        return popup({ mensagem: resultado?.mensagem || 'Não foi possível salvar a tag: fale com o suporte.' })

    removerPopup() // edição
    await catalogoTagsPag(true)
    // Criada pela escolha: já entra no campo.
    if (!id && estadoTagsPag.campo?.isConnected) {
        const ids = lerTagsPag(estadoTagsPag.campo)
        gravarTagsNoCampoPag(estadoTagsPag.campo, [...ids, novaId])
    } else {
        desenharCamposTagsPag()
    }
    redesenharEscolhaTagsPag()
    // Lista de faturas aberta: nome/cor novos aparecem nas linhas.
    if (id && document.getElementById('bodyFaturasFin') && typeof paginacao === 'function') paginacao('faturasFin')
}

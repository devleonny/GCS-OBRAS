// Tags de pagamento (26/11/2026): um cadastro só do favorecido (ex.: EMBASA) e a tag diz de onde é a conta
// (GALPÃO 6, ALEX, COSTA...). Catálogo próprio (tags_pagamentos: nome + cor). Visual do financeiro (estilo Omie):
// chip chapado com fundo leve da cor e bolinha, painel branco com busca e lista; criar/editar no próprio painel.
// Usado no formulário da fatura (Financeiro), na lista de faturas e no formulário de pagamento (Reembolsos).
//
// Campo: htmlTagsPag(ids, { editavel }) → <div class="tags-pag" data-tags-pag="[...]">; lerTagsPag(campo) → ids.

const estadoTagsPag = { catalogo: null, carregando: null, campo: null, editando: null }

// Tons pastel, como as etiquetas da lista de clientes (FORNECEDOR, FUNCIONÁRIO, TÉCNICO).
const CORES_TAGS_PAG = ['#f4a39a', '#f6c177', '#f0dc7a', '#b9dc8c', '#8fd3a8', '#8fd3e0', '#9fc2f0', '#c3a9ee', '#f1a7cf', '#9e9e9e']

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

const ordenarTagsPag = tags => [...tags].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))

const corValidaPag = cor => /^#[0-9a-f]{6}$/i.test(String(cor || '')) ? cor : '#9e9e9e'

// Texto branco só em fundo mais escuro (o cinza das etiquetas de clientes leva branco).
function textoTagPag(cor) {
    const c = corValidaPag(cor)
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
    return (0.299 * r + 0.587 * g + 0.114 * b) < 170 ? '#fff' : '#1f2a24'
}

// Etiqueta cheia na cor, caixa alta, cantos pouco arredondados (igual às tags da lista de clientes).
const estiloTagPag = cor => `--tag-fundo: ${corValidaPag(cor)}; --tag-texto: ${textoTagPag(cor)};`

function chipTagPag(tag, { remover = false } = {}) {
    return `<span class="tag-pag" style="${estiloTagPag(tag?.cor)}" title="${escaparAtributo(tag?.nome || '')}"><span class="tag-pag-nome">${escaparAtributo(tag?.nome || '--')}</span>${remover ? `<button type="button" class="tag-pag-tirar" title="Tirar a tag" aria-label="Tirar a tag ${escaparAtributo(tag?.nome || '')}"
            onclick="event.stopPropagation(); tirarTagPag(this, '${escaparAtributo(String(tag?.id || ''))}')">×</button>` : ''}</span>`
}

// Chips só de leitura (linha da tabela, cartões). Tag que não está no catálogo (excluída) não aparece.
function chipsTagsPag(ids, catalogo = catalogoTagsPagPronto()) {
    return ordenarTagsPag(idsTagsPag(ids).map(id => catalogo.get(id)).filter(Boolean))
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
        const html = ordenarTagsPag(lerTagsPag(campo).map(id => catalogo.get(id)).filter(Boolean))
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

// ------------------------------------------------------------------ painel: escolher / criar / editar

// Busca + lista + editor; o mesmo miolo vai no popup (pagamento) e embutido na aba Tags da fatura.
function corpoPainelTagsPag() {
    return `
                <div class="tags-pag-barra">
                    <input type="search" class="fin-extrato-busca" placeholder="Buscar tag" autocomplete="off"
                        oninput="filtrarTagsPag(this.value)" onkeydown="if (event.key === 'Enter') { event.preventDefault(); enterBuscaTagsPag(this.value) }"
                        data-busca-tags-pag>
                    <button type="button" class="tags-pag-nova" onclick="editarTagPag()">+ Nova tag</button>
                </div>
                <div class="tags-pag-editor" data-editor-tags-pag hidden></div>
                <div class="tags-pag-lista" data-lista-tags-pag role="listbox" aria-multiselectable="true"></div>
                <div class="tags-pag-rodape" data-rodape-tags-pag></div>`
}

async function abrirTagsPag(campo) {
    if (!campo) return
    // Aba Tags da fatura aberta: a lista já está na tela.
    if (document.querySelector('[data-tags-pag-embutido]')) return document.querySelector('[data-busca-tags-pag]')?.focus()
    estadoTagsPag.campo = campo
    estadoTagsPag.editando = null
    overlayAguarde()
    await catalogoTagsPag()
    removerOverlay()
    const anterior = document.querySelector('[data-escolha-tags-pag]')?.closest('.popup')?.id
    if (anterior) removerPopup(anterior)
    popup({
        titulo: 'Tags do pagamento',
        elemento: `<div class="fis-painel popup-consulta tags-pag-painel" data-escolha-tags-pag>${corpoPainelTagsPag()}</div>`
    })
    redesenharEscolhaTagsPag()
    setTimeout(() => document.querySelector('[data-busca-tags-pag]')?.focus(), 50)
}

function redesenharEscolhaTagsPag() {
    const lista = document.querySelector('[data-lista-tags-pag]')
    if (!lista) return
    const marcadas = new Set(lerTagsPag(estadoTagsPag.campo))
    const tags = ordenarTagsPag(catalogoTagsPagPronto().values())
    lista.innerHTML = tags.length
        ? tags.map(tag => {
            const id = escaparAtributo(String(tag.id))
            const marcada = marcadas.has(String(tag.id))
            return `<div class="tags-pag-linha${marcada ? ' marcada' : ''}" data-tag-pag-opcao="${id}" data-nome="${escaparAtributo(String(tag.nome || '').toLowerCase())}"
                    role="option" aria-selected="${marcada}" tabindex="0" onclick="alternarTagPag('${id}')"
                    onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); alternarTagPag('${id}') }">
                <span class="tags-pag-caixa" aria-hidden="true"></span>
                ${chipTagPag(tag)}
                <button type="button" class="tags-pag-lapis" title="Editar nome e cor" aria-label="Editar ${escaparAtributo(tag.nome || '')}"
                    onclick="event.stopPropagation(); editarTagPag('${id}')">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
            </div>`
        }).join('') + '<div class="tags-pag-vazio tags-pag-sem-resultado" hidden>Nenhuma tag com esse nome. <b>Enter</b> cria.</div>'
        : '<div class="tags-pag-vazio">Nenhuma tag ainda. Crie a primeira em <b>+ Nova tag</b>.</div>'
    filtrarTagsPag(document.querySelector('[data-busca-tags-pag]')?.value)
    const rodape = document.querySelector('[data-rodape-tags-pag]')
    if (rodape) rodape.textContent = marcadas.size
        ? `${marcadas.size} marcada${marcadas.size > 1 ? 's' : ''} · clique para pôr ou tirar`
        : 'Clique na tag para pôr no pagamento'
}

function filtrarTagsPag(texto) {
    const t = String(texto || '').trim().toLowerCase()
    let visiveis = 0
    document.querySelectorAll('[data-tag-pag-opcao]').forEach(op => {
        op.hidden = Boolean(t) && !op.dataset.nome.includes(t)
        if (!op.hidden) visiveis++
    })
    const aviso = document.querySelector('.tags-pag-sem-resultado')
    if (aviso) aviso.hidden = visiveis > 0
}

// Enter na busca: uma tag só na lista → marca; nenhuma → abre a criação com o nome digitado.
function enterBuscaTagsPag(texto) {
    const visiveis = [...document.querySelectorAll('[data-tag-pag-opcao]')].filter(op => !op.hidden)
    if (visiveis.length === 1) return alternarTagPag(visiveis[0].dataset.tagPagOpcao)
    if (!visiveis.length && String(texto || '').trim()) editarTagPag()
}

function alternarTagPag(id) {
    const campo = estadoTagsPag.campo
    if (!campo?.isConnected) return
    const ids = lerTagsPag(campo)
    gravarTagsNoCampoPag(campo, ids.includes(String(id)) ? ids.filter(x => x !== String(id)) : [...ids, String(id)])
    redesenharEscolhaTagsPag()
}

// Criar / editar dentro do painel (sem outro popup).
function editarTagPag(id = null) {
    const editor = document.querySelector('[data-editor-tags-pag]')
    if (!editor) return
    const tag = id ? catalogoTagsPagPronto().get(String(id)) || {} : {}
    const busca = document.querySelector('[data-busca-tags-pag]')?.value || ''
    const usadas = new Set([...catalogoTagsPagPronto().values()].map(t => t.cor))
    const cor = tag.cor || CORES_TAGS_PAG.find(c => !usadas.has(c)) || CORES_TAGS_PAG[0]
    estadoTagsPag.editando = { id: id ? String(id) : null, cor }
    editor.hidden = false
    editor.innerHTML = `
        <div class="tags-pag-editor-topo">${id ? 'Editar tag' : 'Nova tag'}</div>
        <label class="fin-campo"><span>Nome</span>
            <input class="fis-input" name="nome_tag_pag" maxlength="40" placeholder="Ex.: GALPÃO 6"
                value="${escaparAtributo(tag.nome || (id ? '' : busca.trim().toUpperCase()))}"
                oninput="previaTagPag()" onkeydown="if (event.key === 'Enter') { event.preventDefault(); salvarTagPag() } else if (event.key === 'Escape') { event.stopPropagation(); fecharEditorTagPag() }"></label>
        <div class="fin-campo"><span>Cor</span>
            <div class="tags-pag-cores" role="radiogroup" aria-label="Cor da tag">
                ${CORES_TAGS_PAG.map(c => `<button type="button" class="tags-pag-cor${c === cor ? ' ativa' : ''}" style="--c: ${c}" data-cor="${c}"
                    role="radio" aria-checked="${c === cor}" aria-label="Cor ${c}" onclick="escolherCorTagPag('${c}')"></button>`).join('')}
            </div>
        </div>
        <div class="tags-pag-editor-pe">
            <span class="tags-pag-previa" data-previa-tag-pag></span>
            <button type="button" class="tags-pag-cancelar" onclick="fecharEditorTagPag()">Cancelar</button>
            <button type="button" class="tags-pag-salvar" onclick="salvarTagPag()">${id ? 'Salvar' : 'Criar tag'}</button>
        </div>`
    previaTagPag()
    const input = editor.querySelector('[name="nome_tag_pag"]')
    input.focus()
    input.select()
}

function escolherCorTagPag(cor) {
    if (!estadoTagsPag.editando) return
    estadoTagsPag.editando.cor = cor
    document.querySelectorAll('.tags-pag-cor').forEach(b => {
        const ativa = b.dataset.cor === cor
        b.classList.toggle('ativa', ativa)
        b.setAttribute('aria-checked', String(ativa))
    })
    previaTagPag()
}

function previaTagPag() {
    const local = document.querySelector('[data-previa-tag-pag]')
    if (!local || !estadoTagsPag.editando) return
    const nome = String(document.querySelector('[name="nome_tag_pag"]')?.value || '').trim().toUpperCase()
    local.innerHTML = chipTagPag({ nome: nome || 'PRÉVIA', cor: estadoTagsPag.editando.cor })
}

function fecharEditorTagPag() {
    const editor = document.querySelector('[data-editor-tags-pag]')
    if (editor) { editor.hidden = true; editor.innerHTML = '' }
    estadoTagsPag.editando = null
    document.querySelector('[data-busca-tags-pag]')?.focus()
}

async function salvarTagPag() {
    const edicao = estadoTagsPag.editando
    if (!edicao) return
    const nome = String(document.querySelector('[name="nome_tag_pag"]')?.value || '').trim().toUpperCase()
    if (!nome) return popup({ mensagem: 'Dê um nome para a tag.' })
    const catalogo = await catalogoTagsPag()
    const repetida = [...catalogo.values()].find(t => String(t.nome || '').trim().toUpperCase() === nome && String(t.id) !== edicao.id)
    if (repetida) return popup({ mensagem: `Já existe a tag <b>${escaparAtributo(nome)}</b>.` })

    const id = edicao.id || crypto.randomUUID()
    overlayAguarde()
    const resultado = await enviar(`tags_pagamentos/${id}`, { id, nome, cor: edicao.cor })
    removerOverlay()
    if (!resultado || resultado.mensagem)
        return popup({ mensagem: resultado?.mensagem || 'Não foi possível salvar a tag: fale com o suporte.' })

    await catalogoTagsPag(true)
    fecharEditorTagPag()
    const busca = document.querySelector('[data-busca-tags-pag]')
    if (busca && !edicao.id) busca.value = ''
    // Criada pelo painel: já entra no pagamento.
    if (!edicao.id && estadoTagsPag.campo?.isConnected)
        gravarTagsNoCampoPag(estadoTagsPag.campo, [...lerTagsPag(estadoTagsPag.campo), id])
    else
        desenharCamposTagsPag()
    redesenharEscolhaTagsPag()
    // Lista de faturas aberta: nome/cor novos aparecem nas linhas.
    if (edicao.id && document.getElementById('bodyFaturasFin') && typeof paginacao === 'function') paginacao('faturasFin')
}

// Aba Tags da fatura: as marcadas em cima (chips) e a lista inteira embaixo, sem popup.
// Só leitura (fatura excluída): só os chips.
function abaTagsPag(ids = [], { editavel = true } = {}) {
    return `
        <div class="tags-pag-aba">
            <div class="tags-pag-aba-marcadas">
                <span>Marcadas</span>
                ${htmlTagsPag(ids, { editavel: false })}
            </div>
            ${editavel ? `<div class="tags-pag-painel tags-pag-embutido" data-escolha-tags-pag data-tags-pag-embutido>${corpoPainelTagsPag()}</div>` : ''}
        </div>`
}

// Depois de desenhar o formulário: liga a lista ao campo de chips da aba.
async function prepararAbaTagsPag(raiz = document) {
    const aba = raiz.querySelector('.tags-pag-aba')
    if (!aba) return
    await catalogoTagsPag()
    const campo = aba.querySelector('.tags-pag')
    if (aba.querySelector('[data-tags-pag-embutido]')) {
        estadoTagsPag.campo = campo
        estadoTagsPag.editando = null
        redesenharEscolhaTagsPag()
    }
    await desenharCamposTagsPag(aba)
}

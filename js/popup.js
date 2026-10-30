let autoDestruicaoGlobal = {}
let configPopupGlobal = {}

function confirmarPopup({ mensagem, titulo = 'Confirmar', textoConfirmar = 'Confirmar' }) {
    return new Promise(resolve => {
        const chave = crypto.randomUUID()
        const id = popup({
            titulo, mensagem,
            botoes: [
                { id: `cancelar-${chave}`, texto: 'Cancelar', img: 'cancel' },
                { id: `confirmar-${chave}`, texto: textoConfirmar }
            ]
        })
        const observador = new MutationObserver(() => {
            if (!document.getElementById(id)) finalizar(false)
        })
        function finalizar(confirmado) {
            observador.disconnect()
            removerPopup(id)
            resolve(confirmado)
        }
        document.getElementById(`cancelar-${chave}`).addEventListener('click', () => finalizar(false), { once: true })
        document.getElementById(`confirmar-${chave}`).addEventListener('click', () => finalizar(true), { once: true })
        observador.observe(document.body, { childList: true })
    })
}

function popup({
    tempo = null,
    autoDestruicao = [],
    elemento,
    mensagem,
    imagem,
    cor = '#ebebeb',
    linhas = [],
    botoes = [],
    conteudoRodape = '',
    titulo,
    removerAnteriores = false
}) {

    if (!elemento && !mensagem)
        mensagem = 'Função <b>inativa</b>. <br>Fale com o suporte para reativação.'

    const idPopup = crypto.randomUUID()

    autoDestruicaoGlobal[idPopup] = autoDestruicao
    configPopupGlobal[idPopup] = { removerAnteriores }

    const arredondado = botoes.length || conteudoRodape
        ? ''
        : 'border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;'

    const linhaFormulario = ({ texto, elemento, editor }) => {
        if (texto) texto = `<span style="text-align: left;">${texto}</span>`

        if (editor !== undefined) {
            // O ID vira só interno para não conflitar caso existam dois editores,
            // mas você não precisa se preocupar com ele na hora de chamar a função
            const idGerado = `editor-${crypto.randomUUID()}`

            elemento = `
                <div class="editor-container">
                    ${barraEditor()}
                    <div id="${idGerado}"
                    class="editor-conteudo"
                    onpaste="colarNoEditor(event)"
                    contenteditable="true">${editor}</div>
                </div>
            `
        }

        return `
            <div class="linha-padrao${editor !== undefined ? ' linha-editor' : ''}">
                ${texto || ''}
                ${elemento || ''}
            </div>`
    }

    const botaoPadrao = ({ id, funcao = '', img = 'concluido', texto, fechar = false }) => {

        img = img.includes('/')
            ? img 
            : `imagens/${img}.png` 
            
        return `
        <div ${id ? `id="${escaparAtributo(id)}"` : ''} onclick="${funcao}${fechar ? `${funcao ? ';' : ''}${removerAnteriores ? 'removerTodosPopups()' : `removerPopup('${idPopup}')`}` : ''}" class="botoes-rodape">
            <img src="${img}">
            <span>${texto}</span>
        </div>
    `
    }

    let conteudo = ''

    if (linhas.length) {
        conteudo = `
            <div class="painel-padrao">
                ${linhas.map(linhaFormulario).join('')}
            </div>
        `
    } else if (mensagem) {
        conteudo = `
            <div class="mensagem" style="${arredondado}; background-color: ${cor};">
                <img src="${imagem || 'gifs/alerta.gif'}">
                <label>${mensagem}</label>
            </div>
        `
    } else {
        conteudo = `
            <div class="janela" style="background-color: ${cor}; ${arredondado};">
                ${elemento}
            </div>
        `
    }

    const rodape = botoes.length || conteudoRodape
        ? `<div class="rodape-padrao">
            ${conteudoRodape ? `<div class="rodape-conteudo">${conteudoRodape}</div>` : ''}
            ${botoes.length ? `<div class="rodape-acoes">${botoes.map(botaoPadrao).join('')}</div>` : ''}
        </div>`
        : ''

    const html = `
        <div id="${idPopup}" class="popup">
            <div class="popup-janela-fora">
                <div class="popup-top">
                    <label style="color:white;margin:0 1rem;">${titulo || 'GCS'}</label>
                    <span onclick="removerPopup('${idPopup}')">×</span>
                </div>
                ${conteudo}
                ${rodape}
            </div>
        </div>
    `

    document.querySelector('.aguarde')?.remove()
    document.body.insertAdjacentHTML('beforeend', html)
    document.body.style.overflow = 'hidden'

    if (tempo)
        setTimeout(() => removerPopup(idPopup), tempo * 1000)

    return idPopup
}

function limparRecursosPopup(id) {
    ; (autoDestruicaoGlobal?.[id] || []).forEach(chave => {
        delete controles?.[chave]
        delete controlesCxOpcoes?.[chave]
    })

    delete autoDestruicaoGlobal[id]
    delete configPopupGlobal[id]
}

function removerTodosPopups() {

    removerOverlay()

    const popups = [...document.querySelectorAll('.popup')]
    if (!popups.length)
        return

    popups.forEach(p => {
        limparRecursosPopup(p.id)
        p.remove()
    })

    document.querySelector('.aguarde')?.remove()
    document.body.style.overflow = 'auto'
}

function removerPopup(id = null) {
    const popups = [...document.querySelectorAll('.popup')]
    if (!popups.length) return

    const alvo = id
        ? document.getElementById(id)
        : popups[popups.length - 1]

    if (!alvo) return

    limparRecursosPopup(alvo.id)
    alvo.remove()

    document.querySelector('.aguarde')?.remove()
    document.body.style.overflow = 'auto'
}

function colarNoEditor(event) {
    event.preventDefault()

    const texto = event.clipboardData?.getData('text/plain') || ''
    const linhas = texto.replace(/\r\n/g, '\n').split('\n')
    const sel = window.getSelection()

    if (!sel || !sel.rangeCount) return

    const range = sel.getRangeAt(0)
    range.deleteContents()

    const fragment = document.createDocumentFragment()

    linhas.forEach((linha, i) => {
        if (i > 0) fragment.appendChild(document.createElement('br'))
        fragment.appendChild(document.createTextNode(linha))
    })

    range.insertNode(fragment)
    range.collapse(false)

    sel.removeAllRanges()
    sel.addRange(range)
}

// Editor de texto dos formulários (linhas com "editor" no popup).
// A seleção de cada editor fica guardada: clicar num botão, na paleta ou no seletor de cor tira o
// foco do texto, e sem restaurar a seleção o comando não tem onde aplicar (era o que fazia a cor
// não pintar nada). Botões usam mousedown + preventDefault para não roubar o foco.
const CORES_EDITOR = [
    ['#000000', 'Preto'], ['#434343', 'Cinza escuro'], ['#666666', 'Cinza'], ['#999999', 'Cinza médio'], ['#cccccc', 'Cinza claro'], ['#ffffff', 'Branco'],
    ['#b3202a', 'Vermelho'], ['#e8590c', 'Laranja'], ['#f2c200', 'Amarelo'], ['#249f41', 'Verde'], ['#0a4dff', 'Azul'], ['#6f42c1', 'Roxo'],
    ['#f8d7da', 'Vermelho claro'], ['#ffe8cc', 'Laranja claro'], ['#fff3bf', 'Amarelo claro'], ['#d3f9d8', 'Verde claro'], ['#d0ebff', 'Azul claro'], ['#e5dbff', 'Roxo claro']
]
const selecoesEditor = new WeakMap()

function barraEditor() {
    const botao = (comando, titulo, conteudo, estado = false) => `
        <button type="button" class="editor-botao" title="${titulo}" aria-label="${titulo}"
            ${estado ? `data-estado="${comando}"` : ''}
            onmousedown="event.preventDefault()" onclick="comandoEditor(this, '${comando}')">${conteudo}</button>`

    const paleta = (tipo, comando, semCor) => `
        <div class="editor-paleta" data-paleta="${tipo}" hidden>
            <div class="editor-paleta-cores">
                ${CORES_EDITOR.map(([cor, nome]) => `
                    <button type="button" class="editor-cor" style="background: ${cor};" title="${nome}" aria-label="${nome}"
                        onmousedown="event.preventDefault()" onclick="aplicarCorEditor(this, '${comando}', '${cor}')"></button>`).join('')}
            </div>
            <div class="editor-paleta-acoes">
                <button type="button" onmousedown="event.preventDefault()" onclick="aplicarCorEditor(this, '${comando}', '${semCor.valor}')">${semCor.texto}</button>
                <label>Outra cor…
                    <input type="color" onchange="aplicarCorEditor(this, '${comando}', this.value)">
                </label>
            </div>
        </div>`

    return `
        <div class="editor-toolbar" role="toolbar" aria-label="Formatação">
            <div class="editor-grupo">
                ${botao('bold', 'Negrito', '<b>B</b>', true)}
                ${botao('italic', 'Itálico', '<i>I</i>', true)}
                ${botao('underline', 'Sublinhado', '<u>U</u>', true)}
                ${botao('strikeThrough', 'Riscado', '<s>S</s>', true)}
            </div>
            <div class="editor-grupo">
                <button type="button" class="editor-botao editor-botao-cor" title="Cor do texto" aria-label="Cor do texto"
                    onmousedown="event.preventDefault()" onclick="alternarPaletaEditor(this, 'texto')">
                    <span>A</span><i data-cor-atual="texto" style="background: #b3202a;"></i>
                </button>
                <button type="button" class="editor-botao editor-botao-cor" title="Marca-texto" aria-label="Marca-texto"
                    onmousedown="event.preventDefault()" onclick="alternarPaletaEditor(this, 'destaque')">
                    <span>✎</span><i data-cor-atual="destaque" style="background: #fff3bf;"></i>
                </button>
            </div>
            <div class="editor-grupo">
                ${botao('insertUnorderedList', 'Lista com marcadores', '•', true)}
                ${botao('insertOrderedList', 'Lista numerada', '1.', true)}
            </div>
            <div class="editor-grupo">
                ${botao('justifyLeft', 'Alinhar à esquerda', '<span class="editor-alinhar" data-alinhar="esquerda"></span>', true)}
                ${botao('justifyCenter', 'Centralizar', '<span class="editor-alinhar" data-alinhar="centro"></span>', true)}
                ${botao('justifyRight', 'Alinhar à direita', '<span class="editor-alinhar" data-alinhar="direita"></span>', true)}
            </div>
            <div class="editor-grupo">
                ${botao('removeFormat', 'Limpar formatação', 'T<sub>×</sub>')}
                ${botao('undo', 'Desfazer', '↶')}
                ${botao('redo', 'Refazer', '↷')}
            </div>
            ${paleta('texto', 'foreColor', { valor: '#324b3c', texto: 'Automático' })}
            ${paleta('destaque', 'hiliteColor', { valor: 'transparent', texto: 'Sem destaque' })}
        </div>`
}

function editorDoElemento(elemento) {
    return elemento.closest('.editor-container')?.querySelector('.editor-conteudo')
}

// Devolve o foco ao texto com a última seleção feita nele.
function restaurarSelecaoEditor(editor) {
    editor.focus()
    const range = selecoesEditor.get(editor)
    if (!range) return
    const selecao = window.getSelection()
    selecao.removeAllRanges()
    selecao.addRange(range)
}

function comandoEditor(botao, comando, valor = null) {
    const editor = editorDoElemento(botao)
    if (!editor) return
    restaurarSelecaoEditor(editor)
    // Cores em <span style>, não em <font> (styleWithCSS só para elas: negrito etc. seguem <b>, <i>...).
    const comCss = ['foreColor', 'hiliteColor'].includes(comando)
    if (comCss) document.execCommand('styleWithCSS', false, true)
    document.execCommand(comando, false, valor)
    if (comCss) document.execCommand('styleWithCSS', false, false)
    guardarSelecaoEditor(editor)
    atualizarBarraEditor(editor)
}

function alternarPaletaEditor(botao, tipo) {
    const barra = botao.closest('.editor-toolbar')
    barra.querySelectorAll('.editor-paleta').forEach(paleta => {
        paleta.hidden = paleta.dataset.paleta !== tipo || !paleta.hidden
    })
}

function aplicarCorEditor(elemento, comando, cor) {
    const barra = elemento.closest('.editor-toolbar')
    comandoEditor(elemento, comando, cor)
    const tipo = comando === 'foreColor' ? 'texto' : 'destaque'
    const indicador = barra.querySelector(`[data-cor-atual="${tipo}"]`)
    if (indicador && cor !== 'transparent') indicador.style.background = cor
    barra.querySelectorAll('.editor-paleta').forEach(paleta => { paleta.hidden = true })
}

function guardarSelecaoEditor(editor) {
    const selecao = window.getSelection()
    if (selecao.rangeCount && editor.contains(selecao.anchorNode))
        selecoesEditor.set(editor, selecao.getRangeAt(0).cloneRange())
}

// Botões ativos conforme o trecho do cursor (negrito, lista, alinhamento...).
function atualizarBarraEditor(editor) {
    editor.closest('.editor-container')?.querySelectorAll('[data-estado]').forEach(botao => {
        let ativo = false
        try { ativo = document.queryCommandState(botao.dataset.estado) } catch { }
        botao.classList.toggle('ativo', ativo)
    })
}

document.addEventListener('selectionchange', () => {
    const selecao = window.getSelection()
    const no = selecao.anchorNode
    const editor = (no?.nodeType === Node.ELEMENT_NODE ? no : no?.parentElement)?.closest?.('.editor-conteudo')
    if (!editor) return
    guardarSelecaoEditor(editor)
    atualizarBarraEditor(editor)
})

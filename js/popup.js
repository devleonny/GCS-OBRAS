let autoDestruicaoGlobal = {}
let configPopupGlobal = {}

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

    // vertical: true posiciona o texto acima do elemento da linha.
    const linhaFormulario = ({ texto, elemento, editor, overlay = false, vertical = false }) => {
        if (texto) texto = `<span style="text-align: left;">${texto}</span>`

        if (editor !== undefined) {
            // O ID vira só interno para não conflitar caso existam dois editores,
            // mas você não precisa se preocupar com ele na hora de chamar a função
            const idGerado = `editor-${crypto.randomUUID()}`

            elemento = `
                <div class="editor-container">
                    
                    <div class="editor-toolbar">

                        <span 
                            onclick="document.execCommand('bold', false, null)" 
                            class="editor-botao"
                            onmousedown="event.preventDefault()"
                            style="font-weight: bold;">B</span>
                        
                        <span 
                            onclick="document.execCommand('italic', false, null)"
                            class="editor-botao"
                            onmousedown="event.preventDefault()"
                            style="font-style: italic;">I</span>
                        
                        <span 
                            onclick="document.execCommand('underline', false, null)"
                            class="editor-botao" 
                            onmousedown="event.preventDefault()"
                            style="text-decoration: underline;">U</span>
                    
                        <span onclick="document.execCommand('insertUnorderedList', false, null)"
                            class="editor-botao"
                            onmousedown="event.preventDefault()"
                            style="width: 30px; height: 30px;">•</span>
                        
                        <input 
                            type="color"
                            onmousedown="event.preventDefault()"
                            onchange="document.execCommand('foreColor', false, this.value)" 
                            style="width: 30px; height: 30px; padding: 0; border: none;">

                    </div>
                    
                    <div id="${idGerado}" 
                    class="editor-conteudo" 
                    onpaste="colarNoEditor(event)"
                    contenteditable="true">${editor}</div>
                
                </div>
            `
        }

        return `
            <div class="linha-padrao${vertical ? ' linha-vertical' : ''}${editor !== undefined ? ' linha-editor' : ''}${overlay ? ' linha-popup-bloqueada' : ''}">
                ${overlay ? '<div class="linha-popup-conteudo" inert>' : ''}
                ${texto || ''}
                ${elemento || ''}
                ${overlay ? `</div><button type="button" class="linha-popup-overlay" onclick="liberarLinhaPopup(this)">Clique para editar</button>` : ''}
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

function liberarLinhaPopup(botao) {
    const linha = botao.closest('.linha-popup-bloqueada')
    if (!linha) return
    const conteudo = linha.querySelector('.linha-popup-conteudo')
    conteudo.replaceWith(...conteudo.childNodes)
    linha.classList.remove('linha-popup-bloqueada')
    botao.remove()
    linha.querySelector('input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [contenteditable="true"], .opcoes')?.focus()
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

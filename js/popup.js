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
    titulo,
    removerAnteriores = false
}) {
    if (!elemento && !mensagem)
        mensagem = 'Função <b>inativa</b>. <br>Fale com o suporte para reativação.'

    const idPopup = crypto.randomUUID()

    autoDestruicaoGlobal[idPopup] = autoDestruicao
    configPopupGlobal[idPopup] = { removerAnteriores }

    const arredondado = botoes.length
        ? ''
        : 'border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;'

    const linhaFormulario = ({ texto, elemento }) => `
        <div class="linha-padrao">
            ${texto ? `<span style="text-align: left;">${texto}</span>` : ''}
            ${typeof elemento === 'function' ? elemento() : elemento}
        </div>
    `

    const botaoPadrao = ({ funcao = '', img, texto, fechar = false }) => `
        <div onclick="${funcao}${fechar ? `${funcao ? ';' : ''}${removerAnteriores ? 'removerTodosPopups()' : `removerPopup('${idPopup}')`}` : ''}" class="botoes-rodape">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>
    `

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

    const rodape = botoes.length
        ? `<div class="rodape-padrao">${botoes.map(botaoPadrao).join('')}</div>`
        : ''

    const html = `
        <div id="${idPopup}" class="popup">
            <div class="popup-janela-fora">
                <div class="popup-top">
                    <label style="color:white;margin-left:1rem;">${titulo || 'GCS'}</label>
                    <span onclick="removerPopup('${idPopup}')">×</span>
                </div>
                ${conteudo}
                ${rodape}
            </div>
        </div>
    `

    document.querySelector('.aguarde')?.remove()
    document.body.insertAdjacentHTML('beforeend', html)

    if (tempo)
        setTimeout(() => removerPopup(idPopup), tempo * 1000)

    return idPopup
}

function limparRecursosPopup(id) {
    ;(autoDestruicaoGlobal?.[id] || []).forEach(chave => {
        delete controles?.[chave]
        delete controlesCxOpcoes?.[chave]
    })

    delete autoDestruicaoGlobal[id]
    delete configPopupGlobal[id]
}

function removerTodosPopups() {
    const popups = [...document.querySelectorAll('.popup')]
    if (!popups.length) return

    popups.forEach(p => {
        limparRecursosPopup(p.id)
        p.remove()
    })

    document.querySelector('.aguarde')?.remove()
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
}
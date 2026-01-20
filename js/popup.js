

function popup({
    tempo = null,
    elemento,
    mensagem,
    imagem,
    cor = '#ebebeb',
    linhas = [],
    botoes = [],
    titulo,
    nra = true
}) {

    const idPopup = ID5digitos()

    const arredondado = botoes.length
        ? ''
        : `border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;`

    const linhaFormulario = ({ texto, elemento }) => {

        if (texto) texto = `<span style="text-align: left;">${texto}</span>`

        return `
            <div class="linha-padrao">
                ${texto || ''}
                ${elemento}
            </div>`
    }

    const botaoPadrao = ({ funcao, img, texto }) => `
        <div onclick="${funcao}" class="botoes-rodape">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>`

    if (linhas.length) {

        const lins = linhas
            .map(l => linhaFormulario(l))
            .join('')

        elemento = `
            <div class="painel-padrao">
                ${lins}
            </div>`

    } else if (mensagem) {

        elemento = `
        <div style="${arredondado} ${horizontal}; background-color: ${cor}; gap: 1rem; padding: 1rem;">
            <img src="${imagem || 'gifs/alerta.gif'}">
            <label>${mensagem}</label>
        </div>`

    } else {

        elemento = `
            <div class="janela" style="background-color: ${cor}; ${arredondado};">
                ${elemento}
            </div>
        `
    }

    const bts = botoes
        .map(b => botaoPadrao(b))
        .join('')

    const rodapePadrao = botoes.length
        ? `
            <div class="rodape-padrao">
                ${bts}
            </div>`
        : ''

    const p = `
        <div id="${idPopup}" class="popup">

            <div class="popup-janela-fora">
                
                <div class="popup-top">

                    <label style="background-color: transparent; color: white; margin-left: 1rem;">${titulo || 'GCS'}</label>
                    <span onclick="removerPopup({id:'${idPopup}', nra: ${nra}})">×</span>

                </div>
                
                ${elemento}

                ${rodapePadrao}

            </div>

        </div>`

    const aguarde = document.querySelector('.aguarde')
    if (aguarde) aguarde.remove()

    document.body.insertAdjacentHTML('beforeend', p)

    if (tempo) {
        const pop = document.getElementById(idPopup)

        setTimeout(() => {
            if (pop) pop.remove()
        }, tempo * 1000)
    }

}

async function removerPopup({ id, nra = true } = {}) {
    const popups = document.querySelectorAll('.popup')

    if (id) {
        document.getElementById(id)?.remove()
    } else if (nra) {
        popups[popups.length - 1]?.remove()
    } else {
        for (const p of popups) p.remove()
    }

    document.querySelector('.aguarde')?.remove()
}

function verificarClique(event) {
    const menu = document.querySelector('.side-menu')
    if (menu && menu.classList.contains('active') && !menu.contains(event.target)) menu.classList.remove('active')
}

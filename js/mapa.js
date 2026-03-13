const posicoesEstados = {
    "AC": { x: 80, y: 230 },
    "AL": { x: 575, y: 225 },
    "AP": { x: 340, y: 60 },
    "AM": { x: 150, y: 150 },
    "BA": { x: 480, y: 270 },
    "CE": { x: 515, y: 150 },
    "DF": { x: 395, y: 322 },
    "ES": { x: 500, y: 380 },
    "GO": { x: 365, y: 325 },
    "MA": { x: 435, y: 155 },
    "MG": { x: 450, y: 360 },
    "MS": { x: 295, y: 390 },
    "MT": { x: 280, y: 280 },
    "PA": { x: 320, y: 165 },
    "PB": { x: 580, y: 190 },
    "PE": { x: 540, y: 210 },
    "PI": { x: 470, y: 200 },
    "PR": { x: 345, y: 455 },
    "RJ": { x: 470, y: 420 },
    "RN": { x: 570, y: 155 },
    "RO": { x: 175, y: 250 },
    "RR": { x: 200, y: 60 },
    "RS": { x: 320, y: 530 },
    "SC": { x: 365, y: 495 },
    "SE": { x: 565, y: 255 },
    "SP": { x: 385, y: 415 },
    "TO": { x: 390, y: 240 }
}

function criarMapa({ apenasMapa, path, pag } = {}) {

    // SavePoint
    controles.mapa = { path, pag }

    const mapa = `
        <div class="fundo-mapa">
            <img src="imagens/mapa.png" class="mapa">

            <svg id="mapaOverlay"
                viewBox="0 0 600 600"
                style="position:absolute; top:0; left:0; width:100%; height:100%;">
            </svg>
        </div>`

    if (apenasMapa)
        return mapa

    const elemento = `
        <div class="painel-mapa">
            <button onclick="mostrarMapa()">Mapa</button>
            ${mapa}
        </div>
        `
    return elemento

}

function auxMapa(dados = {}) {
    const svg = document.getElementById("mapaOverlay")

    svg.querySelectorAll(".overlay-estado").forEach(el => el.remove())

    for (const [estado, total] of Object.entries(dados)) {
        preencherMapa(estado, total)
    }

}

function preencherMapa(estado, numero) {
    const svg = document.getElementById("mapaOverlay")
    const pos = posicoesEstados[estado]
    if (!pos) return

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
    group.classList.add("overlay-estado")

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    bg.setAttribute("x", pos.x - 18)
    bg.setAttribute("y", pos.y - 14)
    bg.setAttribute("width", "36")
    bg.setAttribute("height", "28")
    bg.setAttribute("rx", "8")
    bg.setAttribute("fill", "#ffffff")
    bg.setAttribute("stroke", "#333")
    bg.setAttribute("stroke-width", "1.2")
    bg.setAttribute("cursor", "pointer")

    const texto = document.createElementNS("http://www.w3.org/2000/svg", "text")
    texto.setAttribute("x", pos.x)
    texto.setAttribute("y", pos.y + 2)
    texto.setAttribute("font-size", "16")
    texto.setAttribute("font-weight", "bold")
    texto.setAttribute("fill", "#333")
    texto.setAttribute("text-anchor", "middle")
    texto.setAttribute("dominant-baseline", "middle")
    texto.setAttribute("cursor", "pointer")
    texto.textContent = numero

    group.addEventListener('click', async () => {
        await filtrarEspecial(estado)
    })

    group.appendChild(bg)
    group.appendChild(texto)
    svg.appendChild(group)
}

async function filtrarEspecial(value) {

    const { path, pag } = controles.mapa || {}

    controles[pag].filtros ??= {}

    // Se existir, remove a pesquisa; (toggle)
    if (controles[pag].filtros?.[path]?.value == value)
        delete controles[pag].filtros[path]
    else
        controles[pag].filtros[path] = { op: '=', value }

    await paginacao()

}

function mostrarMapa() {
    const fMapa = document.querySelector('.fundo-mapa')
    const pMapa = document.querySelector('.painel-mapa')

    if (fMapa)
        fMapa.classList.toggle('ativo')

    if (pMapa)
        pMapa.classList.toggle('ativo')
}

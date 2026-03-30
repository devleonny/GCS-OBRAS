
// natal() 

function ocultarTemp(balao) {
    balao.style.display = 'none'
    setTimeout(() => {
        balao.style.display = ''
    }, 15000);
}

function natal() {

    const imgs = ['b1', 'b2', 'b3', 'b4', 'b5']
    const especial = `
    <div class="topo-natal">
        ${imgs.map(img => `
            <div class="pendurada" onclick="ocultarTemp(this)">
                <span class="fio"></span>
                <img src="imagens/${img}.png">
            </div>
            `).join('')
        }
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', especial)

    document.querySelectorAll('.pendurada').forEach(el => {
        let timer

        el.addEventListener('mouseenter', () => {
            clearTimeout(timer)
            el.classList.add('balancando')
        })

        el.addEventListener('mouseleave', () => {
            timer = setTimeout(() => {
                el.classList.remove('balancando')
            }, 15000) //15s
        })
    })
}

// PÁSCOA
const framesCoelho = [
    { x: 60, y: 50 },
    { x: 250, y: 50 },
    { x: 450, y: 50 },
    { x: 620, y: 50 },
    { x: 800, y: 50 },

    { x: 70, y: 245 },
    { x: 245, y: 245 },
    { x: 420, y: 245 },
    { x: 620, y: 245 },
    { x: 790, y: 245 },

    { x: 70, y: 450 },
    { x: 255, y: 450 },
    { x: 420, y: 450 },
    { x: 620, y: 450 },
    { x: 810, y: 450 },

    { x: 70, y: 640 },
    { x: 250, y: 640 },
    { x: 420, y: 640 },
    { x: 620, y: 640 },
    { x: 810, y: 660 },

    { x: 80, y: 835 },
    { x: 292, y: 796 }
]

const FRAME_W = 170
const FRAME_H = 170
const SPRITE_W = 1024
const SPRITE_H = 1024

function criarCoelhoSprite({
    x = 0,
    y = -3,
    src,
    largura = 48,
    altura = 48,
    container = document.querySelector('.toolbar-interno')
} = {}) {
    const el = document.createElement('div')

    el.addEventListener('click', () => {
        acaoAleatoriaCoelho()
    })

    el.style.marginLeft = '10rem'
    el.style.cursor = 'pointer'
    el.style.position = 'absolute'
    el.style.left = x + 'px'
    el.style.top = y + 'px'
    el.style.width = largura + 'px'
    el.style.height = altura + 'px'
    el.style.backgroundImage = `url(${src})`
    el.style.backgroundRepeat = 'no-repeat'
    el.style.imageRendering = 'pixelated'
    el.style.zIndex = '9999'

    el.coelhoEstado = {
        raf: null,
        x,
        y,
        direcao: 1,
        largura,
        altura,
        container
    }

    container.appendChild(el)
    return el
}

function definirFrame(el, frame, largura = 48, altura = 48) {
    const escalaX = largura / FRAME_W
    const escalaY = altura / FRAME_H

    el.style.width = largura + 'px'
    el.style.height = altura + 'px'
    el.style.backgroundSize = `${SPRITE_W * escalaX}px ${SPRITE_H * escalaY}px`
    el.style.backgroundPosition = `-${frame.x * escalaX}px -${frame.y * escalaY}px`
}

function acaoAleatoriaCoelho() {
    const acoes = [
        correr,
        parar,
        vergonha,
        dormir,
        exclamar
    ]

    const acao = acoes[Math.floor(Math.random() * acoes.length)]
    acao()
}

function aplicarDirecao(el) {
    el.style.transform = el.coelhoEstado.direcao === -1 ? 'scaleX(-1)' : 'scaleX(1)'
}

function pararCoelho(el) {
    if (el.coelhoEstado?.raf) {
        cancelAnimationFrame(el.coelhoEstado.raf)
        el.coelhoEstado.raf = null
    }
}

function animarCoelho(el, {
    container = el.coelhoEstado.container,
    frames = [],
    largura = el.coelhoEstado.largura,
    altura = el.coelhoEstado.altura,
    velocidade = 140,
    velocidadeMovimento = 2,
    loop = true
} = {}) {
    if (!frames.length) return

    pararCoelho(el)

    let indice = 0
    let ultimoFrame = 0

    function tick(agora) {
        const estado = el.coelhoEstado

        if (velocidadeMovimento) {
            const limite = container.clientWidth - largura

            estado.x += velocidadeMovimento * estado.direcao

            if (estado.x >= limite) {
                estado.x = limite
                estado.direcao = -1
                aplicarDirecao(el)
            }

            if (estado.x <= 0) {
                estado.x = 0
                estado.direcao = 1
                aplicarDirecao(el)
            }

            el.style.left = estado.x + 'px'
        }

        if (velocidade > 0 && agora - ultimoFrame >= velocidade) {
            definirFrame(el, frames[indice], largura, altura)
            ultimoFrame = agora
            indice = indice < frames.length - 1 ? indice + 1 : loop ? 0 : indice
        }

        if (loop || velocidadeMovimento > 0) {
            estado.raf = requestAnimationFrame(tick)
        } else {
            estado.raf = null
        }
    }

    definirFrame(el, frames[0], largura, altura)
    aplicarDirecao(el)
    el.coelhoEstado.raf = requestAnimationFrame(tick)
}

const coelho = criarCoelhoSprite({
    src: 'imagens/coelho.png',
    largura: 48,
    altura: 48,
    container: document.querySelector('.toolbar-interno')
})

function correr() {
    animarCoelho(coelho, {
        frames: [
            framesCoelho[5],
            framesCoelho[6],
            framesCoelho[0],

            framesCoelho[10],
            framesCoelho[11],
            framesCoelho[1]
        ],
        largura: 48,
        altura: 48,
        velocidade: 140,
        velocidadeMovimento: 2,
        loop: true
    })
}

function dormir() {
    animarCoelho(coelho, {
        frames: [framesCoelho[21]],
        largura: 48,
        altura: 48,
        velocidade: 0,
        velocidadeMovimento: 0,
        loop: false
    })
}

function exclamar() {
    animarCoelho(coelho, {
        frames: [framesCoelho[19]],
        largura: 48,
        altura: 48,
        velocidade: 0,
        velocidadeMovimento: 0,
        loop: false
    })
}

function vergonha() {
    animarCoelho(coelho, {
        frames: [
            framesCoelho[9],
            framesCoelho[7],
            framesCoelho[12],
            framesCoelho[13]
        ],
        largura: 48,
        altura: 48,
        velocidade: 350,
        velocidadeMovimento: 0,
        loop: true
    })
}

function parar() {
    animarCoelho(coelho, {
        frames: [framesCoelho[2]],
        largura: 48,
        altura: 48,
        velocidade: 0,
        velocidadeMovimento: 0,
        loop: false
    })
}
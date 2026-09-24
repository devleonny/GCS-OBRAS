let canvasJogo = null
let ctxJogo = null

const jogador = {
    x: 55,
    y: 125,
    largura: 25,
    altura: 25,
    velocidadeY: 0,
    pulando: false
}

let obstaculos = []
let pontos = 0
let velocidade = 4
let ultimoObstaculo = 0
let jogoAtivo = false
let gameOver = false
let animationId

function pular() {
    if (!canvasJogo || !ctxJogo) return

    if (gameOver || !jogoAtivo) {
        iniciar()
    }

    if (!jogador.pulando) {
        jogador.velocidadeY = -11
        jogador.pulando = true
    }
}

function iniciar() {
    cancelAnimationFrame(animationId)

    jogador.y = 125
    jogador.velocidadeY = 0
    jogador.pulando = false
    obstaculos = []
    pontos = 0
    velocidade = 4
    ultimoObstaculo = 0
    gameOver = false
    jogoAtivo = true

    atualizar()
}

function criarObstaculo() {
    const altura = 22 + Math.random() * 28

    obstaculos.push({
        x: canvasJogo.width,
        y: 150 - altura,
        largura: 18 + Math.random() * 14,
        altura
    })
}

function desenhar() {
    ctxJogo.clearRect(0, 0, canvasJogo.width, canvasJogo.height)

    ctxJogo.strokeStyle = '#d2d9e4'
    ctxJogo.lineWidth = 2
    ctxJogo.beginPath()
    ctxJogo.moveTo(0, 151)
    ctxJogo.lineTo(canvasJogo.width, 151)
    ctxJogo.stroke()

    const imagemJogador = new Image()
    imagemJogador.src = 'imagens/LG.png'

    ctxJogo.drawImage(
        imagemJogador,
        jogador.x,
        jogador.y,
        jogador.largura,
        jogador.altura
    )

    ctxJogo.fillStyle = '#ef4444'

    for (const obstaculo of obstaculos) {
        ctxJogo.fillRect(
            obstaculo.x,
            obstaculo.y,
            obstaculo.largura,
            obstaculo.altura
        )
    }

    ctxJogo.fillStyle = '#475569'
    ctxJogo.font = 'bold 15px Arial'
    ctxJogo.fillText(`Pontos: ${pontos}`, 18, 28)

    if (!jogoAtivo && !gameOver) {
        ctxJogo.fillStyle = '#64748b'
        ctxJogo.font = '16px Arial'
        ctxJogo.fillText('Clique ou aperte espaço para começar', 175, 90)
    }

    if (gameOver) {
        ctxJogo.fillStyle = '#1e293b'
        ctxJogo.font = 'bold 24px Arial'
        ctxJogo.fillText('Fim de jogo!', 240, 75)

        ctxJogo.font = '15px Arial'
        ctxJogo.fillText('Clique, espaço ou ↑ para tentar novamente', 175, 105)
    }
}

function colisao(obstaculo) {
    return (
        jogador.x < obstaculo.x + obstaculo.largura &&
        jogador.x + jogador.largura > obstaculo.x &&
        jogador.y < obstaculo.y + obstaculo.altura &&
        jogador.y + jogador.altura > obstaculo.y
    )
}

function atualizar() {
    jogador.velocidadeY += 0.65
    jogador.y += jogador.velocidadeY

    if (jogador.y >= 125) {
        jogador.y = 125
        jogador.velocidadeY = 0
        jogador.pulando = false
    }

    const agora = Date.now()

    if (agora - ultimoObstaculo > 950 + Math.random() * 550) {
        criarObstaculo()
        ultimoObstaculo = agora
    }

    obstaculos = obstaculos.filter(obstaculo => {
        obstaculo.x -= velocidade

        if (colisao(obstaculo)) {
            gameOver = true
            jogoAtivo = false
        }

        if (obstaculo.x + obstaculo.largura < 0) {
            pontos++
            velocidade += 0.08
            return false
        }

        return true
    })

    desenhar()

    if (!gameOver) {
        animationId = requestAnimationFrame(atualizar)
    }
}

function atribuirFuncoesJogo() {
    canvasJogo = document.querySelector('#jogoPendencias')

    if (!canvasJogo) return

    ctxJogo = canvasJogo.getContext('2d')

    canvasJogo.addEventListener('click', pular)

    document.addEventListener('keydown', evento => {
        if (evento.code === 'Space' || evento.code === 'ArrowUp') {
            evento.preventDefault()
            pular()
        }
    })

    desenhar()
}
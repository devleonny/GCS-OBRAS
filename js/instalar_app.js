// GCS no celular (PWA).
// - Menu "GCS no celular" (esquema_botoes.js): QR code com o endereço de instalação (?instalar=1).
// - No celular, aberto pelo QR: Android/Chrome mostra o botão "Instalar o GCS" (o navegador só instala
//   com um toque da pessoa); iPhone/Safari mostra o passo a passo (Compartilhar → Tela de Início).
//   Já aberto como aplicativo (standalone): nada.
// QR gerado no navegador (qrcodejs, carregado só quando o menu é aberto).

// Sempre o endereço público: aberto de um endereço local/de teste, o QR levaria o celular a um
// endereço que ele não acessa.
const ENDERECO_INSTALAR_GCS = 'https://gcs.app.br/?instalar=1'
let pedidoInstalacaoGCS = null

const gcsInstalado = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
const ehIphoneGCS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const ehCelularGCS = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || ehIphoneGCS()

// O Chrome avisa que dá para instalar: guarda o pedido para o botão usar.
window.addEventListener('beforeinstallprompt', evento => {
    evento.preventDefault()
    pedidoInstalacaoGCS = evento
    document.querySelectorAll('.instalar-gcs-botao').forEach(b => { b.disabled = false })
})

window.addEventListener('appinstalled', () => {
    pedidoInstalacaoGCS = null
    document.querySelectorAll('.instalar-gcs').forEach(e => e.closest('.popup')?.remove())
})

function carregarQrCodeGCS() {
    if (window.QRCode) return Promise.resolve()
    return new Promise((resolver, falhar) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
        script.onload = () => resolver()
        script.onerror = () => falhar(new Error('não foi possível carregar o gerador de QR code'))
        document.head.appendChild(script)
    })
}

// Menu: QR code para abrir/instalar no celular.
async function abrirGCSNoCelular() {
    // Já no celular: vai direto para a instalação.
    if (ehCelularGCS()) return mostrarInstalacaoGCS()

    popup({
        titulo: 'GCS no celular',
        elemento: `
            <div class="instalar-gcs instalar-gcs-qr">
                <div class="instalar-gcs-codigo" aria-label="QR code para instalar o GCS"></div>
                <ol>
                    <li>Aponte a câmera do celular para o código.</li>
                    <li>Abra o link e toque em <b>Instalar o GCS</b>.<br><small>No iPhone: <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.</small></li>
                    <li>Pronto: o GCS fica na tela inicial como um aplicativo.</li>
                </ol>
                <a class="instalar-gcs-link" href="${ENDERECO_INSTALAR_GCS}" target="_blank" rel="noopener">${ENDERECO_INSTALAR_GCS.replace(/^https?:\/\//, '')}</a>
            </div>`
    })
    const alvo = [...document.querySelectorAll('.instalar-gcs-codigo')].pop()
    try {
        await carregarQrCodeGCS()
        new QRCode(alvo, { text: ENDERECO_INSTALAR_GCS, width: 220, height: 220, colorDark: '#14532d', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M })
    } catch (erro) {
        alvo.innerHTML = `<small>${escaparAtributo(erro.message)}. Use o link abaixo.</small>`
    }
}

// Celular: botão de instalar (Android) ou passo a passo (iPhone).
function mostrarInstalacaoGCS() {
    if (gcsInstalado()) return popup({ titulo: 'GCS no celular', mensagem: 'O GCS já está instalado neste aparelho.', imagem: 'imagens/concluido.png' })

    const iphone = ehIphoneGCS()
    const compartilhar = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4M5 11v9h14v-9"/></svg>'
    popup({
        titulo: 'Instalar o GCS',
        elemento: `
            <div class="instalar-gcs">
                <img src="/icons/icon-192.png" alt="" class="instalar-gcs-icone">
                ${iphone ? `
                    <ol>
                        <li>Toque em <b>Compartilhar</b> ${compartilhar} na barra do Safari.</li>
                        <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
                        <li>Toque em <b>Adicionar</b>.</li>
                    </ol>
                    <small>Use o Safari: em outros navegadores do iPhone essa opção pode não aparecer.</small>`
                : `
                    <button type="button" class="instalar-gcs-botao" ${pedidoInstalacaoGCS ? '' : 'disabled'} onclick="instalarGCS()">Instalar o GCS</button>
                    <small class="instalar-gcs-alternativa">Se o botão não liberar: menu <b>⋮</b> do navegador → <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</small>`}
            </div>`
    })
}

async function instalarGCS() {
    if (!pedidoInstalacaoGCS) return
    const pedido = pedidoInstalacaoGCS
    pedidoInstalacaoGCS = null
    pedido.prompt()
    const { outcome } = await pedido.userChoice.catch(() => ({}))
    if (outcome === 'accepted') document.querySelectorAll('.instalar-gcs').forEach(e => e.closest('.popup')?.remove())
}

// Aberto pelo QR (?instalar=1): mostra a instalação e limpa o endereço.
window.addEventListener('load', () => {
    const parametros = new URLSearchParams(location.search)
    if (!parametros.has('instalar')) return
    parametros.delete('instalar')
    history.replaceState(null, '', location.pathname + (parametros.toString() ? `?${parametros}` : '') + location.hash)
    if (gcsInstalado()) return
    setTimeout(() => { if (typeof popup === 'function') mostrarInstalacaoGCS() }, 800)
})

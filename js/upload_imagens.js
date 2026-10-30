// Imagem de item de orçamento vem sempre da composição (dados_composicoes.imagem), pelo código:
// o orçamento não guarda cópia. Basta renderizar <img data-composicao="CODIGO" src="${logo}">;
// o observador abaixo preenche quando a imagem entra na tela. Sem composição (ex.: item avulso),
// fica o logo. Cada código é buscado uma vez por sessão.
const imagensComposicoes = new Map()

function imagemDaComposicao(codigo) {
    if (!imagensComposicoes.has(codigo)) {
        imagensComposicoes.set(codigo, recuperarDado('dados_composicoes', codigo)
            .then(composicao => composicao?.imagem || null)
            .catch(() => {
                // Falha de rede não fica guardada: na próxima aparição tenta de novo.
                imagensComposicoes.delete(codigo)
                return null
            }))
    }
    return imagensComposicoes.get(codigo)
}

function preencherImagensComposicoes(raiz) {
    const seletor = 'img[data-composicao]:not([data-composicao-lida])'
    const imagens = [...(raiz.matches?.(seletor) ? [raiz] : []), ...(raiz.querySelectorAll?.(seletor) || [])]
    for (const img of imagens) {
        img.dataset.composicaoLida = 'sim'
        imagemDaComposicao(img.dataset.composicao).then(src => {
            if (src) img.src = src
        })
    }
}

new MutationObserver(mutacoes => {
    for (const mutacao of mutacoes)
        for (const no of mutacao.addedNodes)
            if (no.nodeType === Node.ELEMENT_NODE) preencherImagensComposicoes(no)
}).observe(document.documentElement, { childList: true, subtree: true })

function abrirImagem(codigo) {

    const localImagem = document.getElementsByName(codigo)[0]

    const elemento = `
        <div style="${vertical}; gap: 1rem; padding: 1rem;">
            
            <img id="imgPreview" referrerpolicy="no-referrer" src="${localImagem.src}" style="background-color:white;width:30vw;margin:auto;border-radius:5px;">
            
            <input 
                id="fileInput" 
                type="file" 
                accept="image/*" 
                style="display:none"
                onchange="imagemSelecionada(this)"
            >
        </div>
    `

    const botoes = [
        {
            texto: 'Selecionar Imagem',
            img: 'pasta',
            funcao: `document.getElementById('fileInput').click()`
        },
        {
            fechar: true,
            texto: 'Salvar',
            img: 'concluido',
            funcao: `importarImagem('${codigo}')`
        }
    ]

    popup({ elemento, botoes, titulo: 'Imagem', removerAnteriores: true })
}

// Lado maior da imagem guardada: foto de celular chega com vários MB e no orçamento aparece pequena.
const LADO_MAXIMO_IMAGEM_COMPOSICAO = 1600

// Reduz no navegador antes de enviar. PNG continua PNG (pode ter transparência); o resto vira JPEG.
async function reduzirImagemComposicao(dataUrl) {
    const imagem = await new Promise((resolver, rejeitar) => {
        const img = new Image()
        img.onload = () => resolver(img)
        img.onerror = rejeitar
        img.src = dataUrl
    })
    const escala = Math.min(1, LADO_MAXIMO_IMAGEM_COMPOSICAO / Math.max(imagem.naturalWidth, imagem.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(imagem.naturalWidth * escala)
    canvas.height = Math.round(imagem.naturalHeight * escala)
    canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height)
    const png = /^data:image\/png/i.test(dataUrl)
    const blob = await new Promise(resolver => canvas.toBlob(resolver, png ? 'image/png' : 'image/jpeg', 0.85))
    return { blob, extensao: png ? 'png' : 'jpg' }
}

// A imagem fica no próprio servidor (/uploads), não mais no imgur: o PDF do orçamento lê do disco.
async function importarImagem(codigo) {

    const base64String = document.getElementById('base64Output')?.value || ''
    if (!base64String) return removerPopup()

    overlayAguarde()

    try {
        const { blob, extensao } = await reduzirImagemComposicao(base64String)
        const formData = new FormData()
        // Com nome e extensão: o servidor grava "<timestamp>.<ext>" e serve com o tipo certo.
        formData.append('arquivos', blob, `composicao.${extensao}`)

        // /upload exige login: o token vai no cabeçalho (sem Content-Type: o FormData define).
        const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        const resposta = await fetch(`${api}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
        const [arquivo] = await resposta.json().catch(() => [])
        if (!resposta.ok || !arquivo?.link)
            return popup({ mensagem: 'Ocorreu um erro no upload. Tente novamente.' })

        const srcRetornado = `${api}/uploads/${arquivo.link}`

        await enviar(`dados_composicoes/${codigo}/imagem`, srcRetornado)
        imagensComposicoes.set(codigo, Promise.resolve(srcRetornado))

        document.getElementsByName(codigo).forEach(elemento => {
            elemento.src = srcRetornado
        })
        removerOverlay()
    } catch (erro) {
        console.error(erro)
        popup({ mensagem: 'Não foi possível ler ou enviar a imagem. Tente outra imagem.' })
    }
}

function imagemSelecionada(input) {
    const file = input.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
        document.getElementById('base64Output')?.remove()
        document.body.insertAdjacentHTML(
            'beforeend',
            `<textarea id="base64Output" style="display:none">${e.target.result}</textarea>`
        )
        document.getElementById('imgPreview').src = e.target.result
    }
    reader.readAsDataURL(file)
}

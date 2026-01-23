function abrirImagem(codigo) {

    const localImagem = document.getElementsByName(codigo)[0]

    const elemento = `
        <div style="${vertical}; gap: 1rem; padding: 1rem;">
            
            <img id="imgPreview" src="${localImagem.src}" style="background-color:white;width:30vw;margin:auto;border-radius:5px;">
            
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
            texto: 'Salvar',
            img: 'concluido',
            funcao: `importarImagem('${codigo}')`
        }
    ]

    popup({ elemento, botoes, titulo: 'Imagem', nra: false })
}

async function importarImagem(codigo) {

    overlayAguarde()

    const apiUrl = 'https://api.imgur.com/3/image';
    const base64String = document.getElementById('base64Output').value;

    if (base64String == '') return removerPopup()

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Client-ID 9403017266f9102',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: base64String.replace(/^data:image\/\w+;base64,/, ''),
            type: 'base64',
        }),
    });

    const responseData = await response.json();

    if (responseData.data.error)
        return popup({ mensagem: 'Ocorreu um erro no upload. Tente novamente' })

    let srcRetornado = responseData.data.link

    db.dados_composicoes[codigo].imagem = srcRetornado

    enviar(`dados_composicoes/${codigo}/imagem`, srcRetornado)
    await inserirDados({ [codigo]: db.dados_composicoes[codigo] }, 'dados_composicoes')

    let localImagens = document.getElementsByName(codigo)
    localImagens.forEach(elemt => {
        elemt.src = srcRetornado
    })

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

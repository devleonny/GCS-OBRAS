function abrirImagem(codigo) {

    const localImagem = document.getElementsByName(codigo)[0] // Todos são iguais, então estou pegando o primeiro como exemplo;

    const elemento = `
        <div style="${vertical}">
            
            <img id="img" src="${localImagem.src}" style="background-color: white; width: 30vw; margin: auto; border-radius: 5px;">
            
            <input id="fileInput" type="file" accept="image/*" style="display: none;" onchange="imagemSelecionada()">

            <button for="fileInput" class="contorno-botoes" style="background-color: #007bff;">
                Selecione uma Imagem
            </button>
                    
            <textarea id="base64Output" style="display: none;"></textarea>
        </div>
    `
    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `importarImagem('${codigo}')` }
    ]

    popup({ elemento, botoes, titulo: 'Imagem' })
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

    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    let srcRetornado = responseData.data.link

    dados_composicoes[codigo].imagem = srcRetornado

    enviar(`dados_composicoes/${codigo}/imagem`, srcRetornado)
    await inserirDados(dados_composicoes, 'dados_composicoes')

    let localImagens = document.getElementsByName(codigo)
    localImagens.forEach(elemt => {
        elemt.src = srcRetornado
    })

    removerPopup()
}

function imagemSelecionada() {
    const file = event.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var base64String = e.target.result;
            document.getElementById('base64Output').value = base64String;
            document.getElementById('img').src = base64String;
        };
        reader.readAsDataURL(file);
    }
}
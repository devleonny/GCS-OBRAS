function abrirImagem(codigo) {

    const localImagem = document.getElementsByName(codigo)[0] // Todos são iguais, então estou pegando o primeiro como exemplo;

    let acumulado = `
        <div style="background-color: #d2d2d2; display: flex; flex-direction: column; padding: 2vw; gap: 10px;">
            
            <img id="img" src="${localImagem.src}" style="width: 30vw; margin: auto; border-radius: 5px;">
            
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                <input id="fileInput" type="file" accept="image/*" style="display: none;" onchange="imagemSelecionada()">

                <label for="fileInput" class="contorno_botoes" style="padding: 10px 20px; background-color: #007bff; color: white; border-radius: 5px; cursor: pointer; text-align: center;">
                    Selecione uma Imagem
                </label>

                ${botao('Salvar', `importarImagem('${codigo}')"`, 'green')}

            </div>
                    
            <textarea id="base64Output" style="display: none;"></textarea>
        </div>
    `;


    popup(acumulado, 'Imagem', true)
}

async function importarImagem(codigo) {

    overlayAguarde()

    const apiUrl = 'https://api.imgur.com/3/image';
    const base64String = document.getElementById('base64Output').value;

    if(base64String == '') return removerPopup()

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

    if (responseData.data.error) return popup(mensagem('Ocorreu um erro no upload. Tente novamente'), 'AVISO', true)

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
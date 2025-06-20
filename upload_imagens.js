function ampliar_especial(local_img, codigo) {

    let funcao = `importar_imagem('${local_img}')`;

    if (codigo !== undefined) {
        funcao = `importar_imagem('${local_img}', '${codigo}')`;
    }

    let acumulado = `
        <div id="imagem_upload" style="display: flex; flex-direction: column; padding: 20px; border-radius: 8px;">
            
            <img id="img" src="${local_img.src}" style="width: 20vw; margin: auto; border-radius: 8px; border: 1px solid #ddd;">
            
            <div id="carregamento_imagem" style="display: none; align-items: center; justify-content: center; margin-top: 10px;">
                <img src="gifs/loading.gif" style="width: 60px;">
                <label style="color: #222; margin-left: 10px;">Salvando...</label>
            </div>

            <div id="painel" style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 20px;">
                <input id="fileInput" type="file" accept="image/*" style="display: none;" onchange="imagem_selecionada()">
                <label for="fileInput" class="contorno_botoes" style="padding: 10px 20px; background-color: #007bff; color: white; border-radius: 5px; cursor: pointer; text-align: center;">
                    Selecione uma Imagem
                </label>
                <button id="uploadButton" class="contorno_botoes" style="display: none; padding: 10px 20px; background-color: green; color: white; border-radius: 5px; cursor: pointer;" onclick="${funcao}">
                    Salvar
                </button>
            </div>
                    
            <textarea id="base64Output" style="display: none;"></textarea>
        </div>
    `;


    openPopup_v2(acumulado, 'Imagem', true)
}

async function importar_imagem(local_img, codigo) {
    var apiUrl = 'https://api.imgur.com/3/image';
    var base64String = document.getElementById('base64Output').value;

    var painel = document.getElementById('painel')
    if (painel) {
        painel.style.display = 'none'
    }

    var carregamento_imagem = document.getElementById('carregamento_imagem')
    carregamento_imagem.style.display = 'flex'

    try {
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

        if (responseData.data.error) {
            carregamento_imagem.innerHTML = `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                <img src="gifs/alerta.gif" style="width: 5vw">
                <label>Ocorreu um erro aqui, mas tudo bem... tenta de novo!</label>
            </div>
            `
            console.log(responseData.data.error);
        } else {

            var dados_composicoes = await recuperarDados('dados_composicoes') || {};

            var src_ = responseData.data.link

            if (codigo !== undefined) {

                if (!dados_composicoes[codigo]) { // Se o código não existir, o motivo é Orçamento livre;
                    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

                    if (orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo]) {
                        orcamento_v2.dados_composicoes[codigo].imagem = src_
                    }

                    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

                    return carregamento_imagem.innerHTML = `
                    <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                        <img src="imagens/concluido.png" style="width: 5vw">
                        <label>Imagem salva neste Orçamento Flex</label>
                    </div>
                    `

                } else { // No caso de existir, vem de item existente;

                    dados_composicoes[codigo].imagem = src_

                    enviar(`dados_composicoes/${codigo}/imagem`, src_)
                    inserirDados(dados_composicoes, 'dados_composicoes')

                }
            }

            local_img.src = src_

            carregamento_imagem.innerHTML = `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                <img src="imagens/concluido.png" style="width: 5vw">
                <label>Imagem salva na memória</label>
            </div>
            `
        }

        if (document.title == 'COMPOSIÇÕES') await retomarPaginacao()

    } catch (error) {

        carregamento_imagem.innerHTML = `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <img src="gifs/alerta.gif" style="width: 5vw">
            <label>Ocorreu um erro aqui, mas tudo bem... tenta de novo!</label>
        </div>
        <br>
        <label>${error}</label>
        `
    }
}

function imagem_selecionada() {
    var file = event.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var base64String = e.target.result;
            document.getElementById('base64Output').value = base64String;
            document.getElementById('img').src = base64String;
            document.getElementById('uploadButton').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}
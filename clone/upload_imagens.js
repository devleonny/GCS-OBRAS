function ampliar_especial(local_img, codigo) {
    var imagem_upload = document.getElementById('imagem_upload');
    if (imagem_upload) {
        imagem_upload.remove();
    }

    var funcao = `importar_imagem('${local_img}')`;

    if (codigo !== undefined) {
        funcao = `importar_imagem('${local_img}', '${codigo}')`;
    }

    var acumulado = `
        <div id="imagem_upload" class="status" style="display: flex; flex-direction: column; background-color: #f9f9f9; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <span class="close" onclick="fechar()" style="align-self: flex-end; cursor: pointer;">&times;</span>
            <img id="img" src="${local_img.src}" style="height: 20vw; width: 20vw; margin: auto; border-radius: 8px; border: 1px solid #ddd;">
            
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

    var overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'block';
    }
    document.body.insertAdjacentHTML('beforeend', acumulado);
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

                } else { //No caso de existir, vem de item existente;

                    dados_composicoes[codigo].imagem = src_

                    inserirDados(dados_composicoes, 'dados_composicoes')

                    var composicao = {
                        'tabela': 'composicoes',
                        'imagem': src_,
                        'campo': 'imagem',
                        'codigo': codigo,
                    }

                    // Enviando dados para a API
                    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(composicao)
                    });
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
    } catch (error) {

        carregamento_imagem.innerHTML = `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <img src="gifs/alerta.gif" style="width: 5vw">
            <label>Ocorreu um erro aqui, mas tudo bem... tenta de novo!</label>
        </div>
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

function fechar() {
    var imagem_upload = document.getElementById('imagem_upload');
    if (imagem_upload) {
        imagem_upload.remove();
    }

    remover_popup()
}

function fechar() {

    f5()

    remover_popup()
}
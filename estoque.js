let filtrosAtivosEstoques = {}
carregar_estoque()

async function carregar_estoque() {

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let autorizado = false

    if (acesso.permissao == 'adm' || acesso.permissao == 'log') {
        autorizado = true
        document.getElementById('adicionar_item').style.display = 'flex'
    }

    let apenas_leitura = autorizado ? '' : 'readonly'

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let colunas = ['partnumber', 'categoria', 'marca', 'descricao', 'estoque', 'localizacao', 'estoque_usado', 'inventario']
    let thc = ''
    let ths = ''
    let linhas = ''
    colunas.forEach((col, i) => {
        let coluna = String(col).toUpperCase()
        thc += `<th>${coluna}</th>`
        ths += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" style="text-align: center;" placeholder="${coluna}" oninput="pesquisar_em_estoque(${i}, this.value)">
            </th>
            `
    })

    for (item in dados_estoque) {
        let dados_item = dados_estoque[item]

        let tds = ''
        for (chave in dados_item) {

            let info = dados_item[chave]
            let elemento = `<input style="cursor: pointer; text-align: center; padding: 10px; border-radius: 3px;" value="${info}" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>`

            if (chave == 'descricao' || chave == 'inventario') {
                elemento = `<textarea style="border: none;" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>${info}</textarea>`

            } else if (chave.includes('estoque')) {

                let cor = conversor(info) > 0 ? '#4CAF50' : '#B12425'

                elemento = `<input type="number" class="numero-bonito" style="font-size: 25px; background-color: ${cor};" value="${info}" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>`

            }

            if (chave !== 'id') {
                tds += `
                    <td>
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                            ${elemento}
                            <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_estoque(this, '${item}', '${chave}')">
                        </div>
                    </td>
                `
            }
        }

        linhas += `
            <tr>${tds}</tr>
        `
    }

    let acumulado = `
        <div style="height: max-content; max-height: 70vh; width: max-content; max-width: 90vw; overflow: auto; background-color: #222; border-radius: 5px;">
            <table class="table">
                <thead>
                    <tr>${thc}</tr>
                    <tr id="thead_pesquisa">${ths}</tr>
                </thead>  
                <tbody id="body">${linhas}</tbody>
            </table>
        </div>
    
    `

    document.getElementById('estoque').innerHTML = acumulado

}

async function recuperar_estoque() {
    return new Promise((resolve, reject) => {
        fetch('https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=estoque')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao carregar os dados');
                }
                return response.json();
            })
            .then(data => {

                inserirDados(data, 'dados_estoque')
                resolve()
            })
            .catch(error => {
                console.error('Ocorreu um erro:', error);
                reject(error);
            });

    })

}

async function atualizar_estoque() {
    let div = document.getElementById('estoque')

    if (div) {
        carregamento('estoque')
    }

    await recuperar_estoque()

    carregar_estoque()
}

function exibir_botao(elemento, chave) {

    if (String(chave).includes('estoque')) {
        if (conversor(elemento.value) > 0) {
            elemento.style.backgroundColor = '#4CAF50'
        } else {
            elemento.style.backgroundColor = '#B12425'
        }
    }

    let img = elemento.nextElementSibling;
    img.style.display = 'block'

}

function incluir_linha() {
    let codigo = gerar_id_5_digitos()
    let body = document.getElementById('body')

    let campos = ['partnumber', 'categoria', 'marca', 'descricao', 'estoque', 'localizacao', 'estoque_usado', 'inventario']
    let tds = ''

    campos.forEach(campo => {
        let elemento = `<input style="cursor: pointer; text-align: center; padding: 10px; border-radius: 3px;" oninput="exibir_botao(this, '${campo}')">`

        if (campo == 'descricao' || campo == 'inventario') {
            elemento = `<textarea style="border: none;" oninput="exibir_botao(this, '${campo}')"></textarea>`

        } else if (campo.includes('estoque')) {
            elemento = `<input type="number" class="numero-bonito" style="font-size: 25px; background-color: '#4CAF50';" oninput="exibir_botao(this, '${campo}')">`

        }

        tds += `
            <td>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    ${elemento}
                    <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_estoque(this, '${codigo}', '${campo}')">
                </div>
            </td>
        `
    })

    let linha = `
    <tr>${tds}</tr>
    `

    body.insertAdjacentHTML('beforebegin', linha)
}

async function salvar_dados_estoque(img, codigo, chave) {

    img.style.display = 'none'

    let elemento = img.previousElementSibling;

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (dados_estoque[codigo] && Object.hasOwn(dados_estoque[codigo], chave)) {
        dados_estoque[codigo][chave] = elemento.value

        let dados = {
            tabela: 'estoque',
            operacao: 'alteracao',
            id: codigo,
            chave: chave,
            valor: elemento.value
        }

        enviar_dados_generico(dados)
        await inserirDados(dados_estoque, 'dados_estoque')

    } else if (!dados_estoque[codigo]) {

        dados_estoque[codigo] = {
            id: codigo,
            partnumber: '',
            categoria: '',
            marca: '',
            descricao: '',
            estoque: 0,
            localizacao: '',
            estoque_usado: '',
            inventario: ''
        }

        dados_estoque[codigo][chave] = elemento.value
        await inserirDados(dados_estoque, 'dados_estoque')

        let dados = {
            tabela: 'estoque',
            operacao: 'incluir',
            id: codigo,
            item: dados_estoque[codigo]
        }
        enviar_dados_generico(dados)
    }

}

function pesquisar_em_estoque(coluna, texto) {

    filtrosAtivosEstoques[coluna] = texto.toLowerCase();

    var tabela_itens = document.getElementById('body');
    var trs = tabela_itens.querySelectorAll('tr');

    var thead_pesquisa = document.getElementById('thead_pesquisa');
    var inputs = thead_pesquisa.querySelectorAll('input');
    inputs[coluna].value = texto

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');
        var mostrarLinha = true;

        for (var col in filtrosAtivosEstoques) {
            var filtroTexto = filtrosAtivosEstoques[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea')
                var conteudoCelula = String(element.value).toLowerCase();

                if (!conteudoCelula.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        tr.style.display = mostrarLinha ? '' : 'none';
    });

}
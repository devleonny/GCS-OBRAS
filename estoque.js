let filtrosAtivosEstoques = {}
carregar_estoque()


async function primeira_vez() {

    await recuperar_estoque()

    await carregar_estoque()

}

async function carregar_estoque() {

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let autorizado = false
    let colunas = ['partnumber', 'categoria', 'marca', 'descricao', 'estoque', 'localizacao', 'estoque_usado', 'inventario', 'valor_compra']

    if (acesso.permissao == 'adm' || acesso.permissao == 'log') {
        autorizado = true
        document.getElementById('adicionar_item').style.display = 'flex'
        colunas.unshift('Excluir')
    }

    let apenas_leitura = autorizado ? '' : 'readonly'

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (Object.keys(dados_estoque).length == 0) {
        return primeira_vez()
    }

    let thc = ''
    let ths = ''
    let linhas = ''
    colunas.forEach((col, i) => {

        let indice_correto = i + 1
        let coluna = String(col).toUpperCase()
        thc += `<th>${coluna}</th>`

        if (coluna == 'EXCLUIR') {
            ths = `<th style="background-color: white; position: relative; border-radius: 0px;"></th>`
        } else {
            ths += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" style="text-align: center;" placeholder="${coluna}" oninput="pesquisar_em_estoque(${indice_correto}, this.value)">
            </th>
            `
        }
    })

    for (item in dados_estoque) {
        let dados_item = dados_estoque[item]

        let tds = ''

        colunas.forEach(chave => {

            let info = dados_item[chave] || ''
            let elemento = `<input style="background-color: transparent; cursor: pointer; text-align: center; padding: 10px; border-radius: 3px;" value="${info}" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>`
            let quantidade = ''
            let cor = ''

            if (chave == 'descricao' || chave == 'inventario') {
                elemento = `<textarea style="border: none; border-radius: 0px;" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>${info}</textarea>`

            } else if (chave == 'Excluir') {

                elemento = `
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <img src="imagens/cancel.png" style="cursor: pointer; width: 25px; height: 25px;" onclick="remover_linha_excluir_item(this)">
                    </div>
                `

            } else if (chave.includes('estoque')) {

                quantidade = info.quantidade

                for (his in info.historico) {

                    let historico = info.historico[his]

                    if (historico.operacao == 'entrada') {
                        quantidade += historico.quantidade
                    } else if (historico.operacao == 'saida') {
                        quantidade -= historico.quantidade
                    }

                }

                elemento = `<label style="cursor: pointer; font-size: 25px; text-align: center; color: white; width: 100%;" onclick="abrir_estoque('${item}', '${chave}')">${quantidade}</label>`

            }

            if (chave !== 'id') {

                if (quantidade !== '') {
                    cor = conversor(quantidade) > 0 ? '#4CAF50' : '#B12425'
                }

                tds += `
                    <td style="background-color: ${cor}">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                            <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_estoque(this, '${item}', '${chave}')">
                            ${elemento}
                        </div>
                    </td>
                `
            }

        })

        linhas += `
            <tr>
                <td style="display: none;">${item}</td>
                ${tds}
            </tr>
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

function parseDataBR(dataBR) {
    const [dia, mes, anoHora] = dataBR.split('/');
    const [ano, hora] = anoHora.split(', ');
    return new Date(`${ano}-${mes}-${dia}T${hora}:00`);
}

async function abrir_estoque(codigo, stq) {

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let item = dados_estoque[codigo]
    let estoque = item[stq] || {}
    let atual = 0
    let inicial = 0
    let linhas = ''

    if (estoque.historico) {
        atual = estoque.quantidade
        inicial = estoque.quantidade

        let historicoArray = Object.entries(estoque.historico);
        historicoArray.sort((a, b) => {
            const dataA = parseDataBR(a[1].data);
            const dataB = parseDataBR(b[1].data);
            return dataB - dataA;
        });
        estoque.historico = Object.fromEntries(historicoArray);

        for (chave in estoque.historico) {

            let historico = estoque.historico[chave]

            let img = historico.operacao == 'entrada' ? 'imagens/up_estoque.png' : historico.operacao == 'inicial' ? 'imagens/zero.png' : 'imagens/down_estoque.png'

            let exclusao = ''
            if (
                (historico.operacao == 'inicial' && acesso.permissao == 'adm') ||
                (historico.operacao !== 'inicial' && (acesso.permissao == 'adm' || acesso.usuario == historico.usuario))
            ) {
                exclusao = `<img src="imagens/cancel.png" style="cursor: pointer; width: 25px; height: 25px;" onclick="remover_historico('${codigo}', '${stq}','${chave}')">`
            }

            linhas += `
            <tr style="font-size: 0.7em;">
                <td><img src="${img}" style="width: 15px; height: 15px;"></td>
                <td>${historico.quantidade}</td>
                <td>${historico.operacao}</td>
                <td><label style="padding: 5px;">${historico.data}</label></td>
                <td>${historico.usuario}</td>
                <td><textarea style="padding: 0px; border: none; border-radius: 0px;" readonly>${historico.comentario}</textarea></td>
                <td>
                    <div style="display: flex; justify-content: center; align-items: center;">
                        ${exclusao}
                    </div>
                </td>
            </tr>
            `

            if (historico.operacao == 'entrada') {
                atual += historico.quantidade

            } else if (historico.operacao == 'saida') {
                atual -= historico.quantidade
            }
        }
    }

    let data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    let div_historico = ''
    if (estoque.historico && Object.keys(estoque.historico).length > 0) {
        div_historico = `
            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <label>Histórico</label>
            </div>

            <div style="background-color: #B12425; white; border-radius: 3px; height: max-content; max-height: 400px; width: 100%; overflow: auto; border-radius: 3px;">
                <table class="table" style="width: 100%;">
                    <thead>
                        <th>Sin</th>
                        <th>Qt.</th>
                        <th>Operação</th>
                        <th>Data</th>
                        <th>Usuário</th>
                        <th>Comentário</th>
                        <th>Excluir</th>
                    </thead>
                    <tbody style="color: #222;">${linhas}</tbody>
                </table>
            </div>
        `
    }

    let acumulado = `
        <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 10%;">
        <label style="position: absolute; bottom: 5px; right: 15px; font-size: 0.7em;" id="data">${data}</label>

        <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
            <label>Movimentação de estoque</label>
        </div>

        <div style="position: relative; display: flex; justify-content: space-evenly; align-items: center; background-color: white; border-radius: 5px; margin: 5px; height: 140px;">
            
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <label style="color: #222;">Saída</label>
                <input class="numero-bonito" style="background-color: #B12425;" id="saida">
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <label style="color: #222;">Entrada</label>
                <input class="numero-bonito" id="entrada">
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <label style="color: #222;">Comentário</label>
                <textarea maxlength="100" placeholder="Saída/Entrada de X itens para loja..." id="comentario"></textarea>
            </div>

            <img src="imagens/concluido.png" style="cursor: pointer;" onclick="salvar_movimento('${codigo}', '${stq}')">

        </div>

        <div style="position: relative; display: flex; justify-content: space-evenly; align-items: center; background-color: white; border-radius: 5px; margin: 5px; height: 130px;">
         
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 60%;">
                <label style="color: #222;">Saldo Atual</label>
                <label style="background-color: #4CAF50; font-size: 35px; height: 50px; width: 90%; border-radius: 5px;">${atual}</label>
            </div>
        
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">

                <label style="color: #222;">Saldo Inicial</label>

                <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                    <input class="numero-bonito" style="background-color: #B12425;" value="${inicial}">
                    <img src="imagens/concluido.png" style="cursor: pointer; width: 30px; height: 30px;" onclick="salvar_movimento('${codigo}', '${stq}', this)">
                </div>
            
            </div>

        </div>

        ${div_historico}

    `

    openPopup_v2(acumulado)

}

async function remover_historico(codigo, stq, chave) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let item = dados_estoque[codigo]

    if (item[stq].historico && item[stq].historico[chave]) {
        delete item[stq].historico[chave]
    }

    let dados = {
        id: codigo,
        tabela: 'estoque',
        chave: stq,
        chave2: chave,
        operacao: 'remover'
    }

    enviar_dados_generico(dados)

    await inserirDados(dados_estoque, 'dados_estoque')
    remover_popup()
    await carregar_estoque()
    await abrir_estoque(codigo, stq)

}

async function salvar_movimento(codigo, stq, inicial) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let item = dados_estoque[codigo]
    if (!dicionario(item[stq])) {
        item[stq] = {
            historico: {},
            quantidade: 0
        };
    }
    let estoque = item[stq]
    let data = document.getElementById('data')
    let comentario = document.getElementById('comentario')
    let entrada = document.getElementById('entrada')
    let saida = document.getElementById('saida')
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let id = gerar_id_5_digitos()

    let movimento = {
        data: data.textContent,
        usuario: acesso.usuario,
        comentario: comentario.value,
    }

    if (entrada && entrada.value !== '') {

        movimento.operacao = 'entrada'
        movimento.quantidade = conversor(entrada.value)

    } else if (saida && saida.value !== '') {

        movimento.operacao = 'saida'
        movimento.quantidade = conversor(saida.value)

    } else if (inicial !== undefined) {

        let div = inicial.parentElement
        let input = div.querySelector('input')

        movimento.operacao = 'inicial'
        movimento.quantidade = conversor(input.value)
        estoque.quantidade = conversor(input.value)

    } else {
        return
    }

    estoque.historico[id] = movimento

    let dados = {
        id: codigo,
        tabela: 'estoque',
        chave: stq,
        operacao: 'movimento',
        movi_id: id,
        movimento: movimento,
    }

    enviar_dados_generico(dados)

    await inserirDados(dados_estoque, 'dados_estoque')

    remover_popup()
    await carregar_estoque()
    await abrir_estoque(codigo, stq)

}

async function recuperar_estoque() {
    return new Promise((resolve, reject) => {
        fetch('https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=estoque')
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

    await carregar_estoque()
}

function exibir_botao(elemento, chave) {

    if (String(chave).includes('estoque')) {
        if (conversor(elemento.value) > 0) {
            elemento.style.backgroundColor = '#4CAF50'
        } else {
            elemento.style.backgroundColor = '#B12425'
        }
    }

    let img = elemento.previousElementSibling;
    img.style.display = 'block'

}

function incluir_linha() {
    let codigo = gerar_id_5_digitos()
    let body = document.getElementById('body')

    let campos = ['Excluir', 'partnumber', 'categoria', 'marca', 'descricao', 'estoque', 'localizacao', 'estoque_usado', 'inventario', 'valor_compra']
    let tds = ''

    campos.forEach(campo => {
        let elemento = `<input style="background-color: transparent; cursor: pointer; text-align: center; padding: 10px; border-radius: 3px;" oninput="exibir_botao(this, '${campo}')">`
        let cor = ''
        if (campo == 'descricao' || campo == 'inventario') {
            elemento = `<textarea style="border: none;" oninput="exibir_botao(this, '${campo}')"></textarea>`

        } else if (campo == 'Excluir') { 

            elemento = `
            <div style="display: flex; align-items: center; justify-content: center;">
                <img src="imagens/cancel.png" style="cursor: pointer; width: 25px; height: 25px;" onclick="remover_linha_excluir_item(this)">
            </div>
            `

        } else if (campo.includes('estoque')) {
            elemento = `<label style="cursor: pointer; font-size: 25px; text-align: center; color: white; width: 100%;" onclick="abrir_estoque('${codigo}', '${campo}')">0</label>`
            cor = '#222'
        }

        tds += `
            <td style="background-color: ${cor}">
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_estoque(this, '${codigo}', '${campo}')">
                    ${elemento}
                </div>
            </td>
        `
    })

    let linha = `
    <tr>
        ${tds}
    </tr>
    `
    body.insertAdjacentHTML('beforebegin', linha)

}

async function remover_linha_excluir_item(elemento) {

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let tr = elemento.closest('tr')
    let tds = tr.querySelectorAll('td')
    let codigo = tds[0].textContent

    if (dados_estoque[codigo]) {

        let item = dados_estoque[codigo]

        openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Deseja excluir este item?</label>
            </div>
            <label style="font-size: 0.7em;">${item.partnumber} - ${item.descricao}</label>
            <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
                <button onclick="confirmar_exclusao('${codigo}')">Confirmar</button>
            </div>
        `)

    } else {
        tr.remove()
    }

}

async function confirmar_exclusao(codigo) {

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    delete dados_estoque[codigo]

    let dados = {
        tabela: 'estoque',
        operacao: 'excluir_produto',
        id: codigo
    }

    enviar_dados_generico(dados)

    await inserirDados(dados_estoque, 'dados_estoque')

    remover_popup()
    carregar_estoque()
}

async function salvar_dados_estoque(img, codigo, chave) {

    img.style.display = 'none'

    let elemento = img.nextElementSibling;

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

    } else if (!dados_estoque[codigo]) { //29 PERMANENTE; Objetos criados no primeiro momento;

        dados_estoque[codigo] = {
            id: codigo,
            partnumber: '',
            categoria: '',
            marca: '',
            descricao: '',
            estoque: {
                quantidade: 0,
                historico: {}
            },
            localizacao: '',
            estoque_usado: {
                quantidade: 0,
                historico: {}
            },
            inventario: '',
            valor_compra: 0
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
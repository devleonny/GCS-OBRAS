var dados = {}
var filtrosAtivos = {};
var composicoes_ = document.getElementById('composicoes_')
var overlay = document.getElementById('overlay')
var acesso = JSON.parse(localStorage.getItem('acesso')) || {}

document.getElementById("btn-criar-lpu").addEventListener("click", function () {
    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <label style="font-size: 1.2em;">Digite o nome da nova LPU:</label>
            <input id="nome-lpu" type="text" placeholder="Ex: LPU Novo" style="padding: 10px; width: 80%; border-radius: 5px;">
            <label id="texto-aviso" style="display: none; color: red;"></label>
            <button onclick="salvarNovaLPU()" style="background-color: #026CED; color: white; padding: 10px; border: none; cursor: pointer; width: 80%;">Salvar</button>
        </div>
    `);
});


function pesquisar_em_composicoes(elemento) {
    var tabela = composicoes_.querySelector('table');
    var tbody = tabela.querySelector('tbody');
    var trs = tbody.querySelectorAll('tr');
    var termo = elemento.value.toLowerCase();
    var inputs = tabela.querySelectorAll('input');
    var coluna = Array.from(inputs).indexOf(elemento);
    filtrosAtivos[coluna] = termo;

    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td');
        var exibir = true;

        for (var col in filtrosAtivos) {
            var filtroTexto = filtrosAtivos[col].toLowerCase();
            var conteudoCelula = tds[col]?.textContent.toLowerCase() || '';

            if (filtroTexto && !conteudoCelula.includes(filtroTexto)) {
                exibir = false;
                break;
            }
        }

        tr.style.display = exibir ? '' : 'none';
    });
}
carregar_tabela_v2()

async function recuperar_composicoes() {
    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde())
    let nuvem = await receber('dados_composicoes')
    await inserirDados(nuvem, 'dados_composicoes')
    await carregar_tabela_v2()
    document.getElementById("aguarde").remove()
}

async function carregar_tabela_v2() {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {};

    if (Object.keys(dados_composicoes).length == 0) {
        return recuperar_composicoes();
    }

    var thead = '';
    var tbody = '';
    var tsearch = '';
    var painel_colunas = '';

    // 🔹 Obtém os cabeçalhos padrão dos dados
    var cabecalhos = [
        ...new Set(
            Object.values(dados_composicoes).flatMap(obj => Object.keys(obj))
        )
    ];

    // 🔹 Adiciona LPUs criadas no `localStorage`
    let lpusCriadas = JSON.parse(localStorage.getItem("lpus_criadas")) || [];
    cabecalhos.push(...lpusCriadas);

    cabecalhos.push('editar');

    var colunas = JSON.parse(localStorage.getItem('colunas_composicoes')) || [];

    if (acesso.permissao == 'adm') {
        var adicionar_item = document.getElementById('adicionar_item');
        var btn_criar_lpu = document.getElementById('btn-criar-lpu')
        if (adicionar_item) {
            adicionar_item.style.display = 'flex';
        }
        if (btn_criar_lpu) {
            btn_criar_lpu.style.display = 'flex';
        }
    }
    composicoes_.innerHTML = '';

    var ths = {};
    var tsc = {};

    cabecalhos.forEach((cab, i) => {
        ths[cab] = `<th style="position: relative; cursor: pointer; text-align: left;">${inicial_maiuscula(cab)}</th>`
        tsc[cab] = `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" placeholder="..." oninput="pesquisar_em_composicoes(this)">
            </th>`;
    });

    colunas.forEach(col => {
        thead += ths[col];
        tsearch += tsc[col];
    });

    for (let [codigo, produto] of Object.entries(dados_composicoes).reverse()) {
        var tds = {};

        colunas.forEach(chave => {
            var conteudo = produto[chave] || '';
            var alinhamento = 'left';
            chave = String(chave)
            if (chave == 'imagem') {
                var imagem = conteudo || 'https://i.imgur.com/Nb8sPs0.png';
                alinhamento = 'center';
                conteudo = `<img src="${imagem}" style="width: 50px; cursor: pointer;" onclick="ampliar_especial(this, '${codigo}')">`;

            } else if (chave.includes('lpu')) {
                var preco_final = produto[chave];
                if (dicionario(produto[chave]) && produto[chave].historico && produto[chave].ativo) {
                    var ativo = produto[chave].ativo;
                    preco_final = produto[chave].historico[ativo].valor;
                } else {
                    preco_final = '';
                }

                var estilo = preco_final !== '' ? 'valor_preenchido' : 'valor_zero';
                conteudo = `<label class="${estilo}" onclick="abrir_historico_de_precos('${codigo}', '${chave}', this)"> ${dinheiro(conversor(preco_final))}</label>`;

            } else if (chave == 'agrupamentos') {

                var info_agrupamentos = ''

                if (produto[chave]) {
                    var agrupamentos = produto[chave]

                    for (item in agrupamentos) {

                        if (!dados_composicoes[item]) {
                            delete produto.agrupamentos[item]
                            deletar(`dados_composicoes/${codigo}/agrupamentos/${item}`)
                            inserirDados(dados_composicoes, 'dados_composicoes')
                        } else {

                            let tipo = dados_composicoes[item].tipo

                            var cor = 'green'
                            if (tipo == 'VENDA') {
                                cor = '#B12425'
                            }

                            info_agrupamentos += `
                            <div style="display: flex; gap: 3px; align-items: center; justify-content: left;">
                                <label class="numero" style="width: 20px; height: 20px; padding: 3px; background-color: ${cor}">${agrupamentos[item]}</label>
                                <label style="font-size: 0.6em; text-align: left;">${String(dados_composicoes[item].descricao).slice(0, 10)}...</label>
                            </div>
                            `
                        }
                    }
                }

                conteudo = `
                    <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                        <img src="imagens/construcao.png" style="width: 30px; height: 30px; cursor: pointer;" onclick="abrir_agrupamentos('${codigo}')">
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; gap: 2px;">
                            ${info_agrupamentos}
                        </div>
                    </div>
                    `
                alinhamento = 'center';

            } else if (chave == 'material infra') {

                var stats = ''
                if (produto[chave]) {
                    stats = 'checked'
                }

                conteudo = `<input type="checkbox" style="width: 30px; height: 30px;" onchange="atualizar_status_material('${codigo}', this)" ${stats}>`;
                alinhamento = 'center';
            }

            tds[chave] = `<td style="text-align: ${alinhamento}; max-width: 200px;">${conteudo}</td>`;
        });

        tds.editar = `<td style="width: 70px;"><img src="imagens/editar.png" style="width: 30px; cursor: pointer;" onclick="cadastrar_editar_item('${codigo}')"></td>`;

        var celulas = '';
        colunas.forEach(col => {
            if (tds[col] !== undefined) {
                celulas += tds[col];
            }
        });

        tbody += `<tr>${celulas}</tr>`;
    }

    var acumulado = `
        <div style="display: flex; gap: 10px;">
            <div id="pc">
                ${painel_colunas}
            </div>
            <div style="resize: both; overflow: auto; height: max-content; max-height: 70vh; width: max-content; max-width: 92.5vw; background-color: #d2d2d2; border-radius: 3px;">
                <table style="border-collapse: collapse;" id="tabela_composicoes">
                    <thead id="thead1">${thead}</thead>
                    <thead id="tsearch">${tsearch}</thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>
        </div>`;

    composicoes_.innerHTML = acumulado;

    // Inclusão do evento click nos cabeçalhos;
    let thead1 = document.getElementById('thead1')
    if (thead1) {
        let tr = thead1.querySelector('tr')
        if (tr) {
            let ths = tr.querySelectorAll('th')
            ths.forEach((th, i) => {
                th.addEventListener('click', function () {
                    filtrar_tabela(i, 'tabela_composicoes', this)
                })
            })
        }
    }

}

async function atualizar_status_material(codigo, elemento) {

    var resposta = elemento.checked
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    dados_composicoes[codigo]['material infra'] = resposta
    await inserirDados(dados_composicoes, 'dados_composicoes')

    await enviar(`dados_composicoes/${codigo}/material infra`, resposta)

    carregar_tabela_v2()

}

async function abrir_agrupamentos(codigo) {

    var acumulado = ''

    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    var produto = dados_composicoes[codigo]
    var imagem = 'https://i.imgur.com/Nb8sPs0.png'
    var linhas = ''


    for (item in dados_composicoes) {
        var checked = ''

        if (produto.agrupamentos && produto.agrupamentos[item]) {
            checked = 'checked'
        }
        var tr = `
        <tr>
            <td style="white-space: normal; text-align: center;"><input type="checkbox" style="width: 30px; height: 30px;" onclick="incluir_agrupamento(this)" ${checked}></td>
            <td style="white-space: normal;">${item}</td>
            <td style="white-space: normal;">${dados_composicoes[item].descricao}</td>
            <td style="white-space: normal;">${dados_composicoes[item].modelo}</td>
            <td style="white-space: normal;">${dados_composicoes[item].unidade}</td>
            <td style="white-space: normal;">${dados_composicoes[item].tipo}</td>
        </tr>
        `
        linhas += tr
    }

    if (produto.imagem && produto.imagem !== '') {
        imagem = produto.imagem
    }

    acumulado += `

        <div class="agrupamentos">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                <img src="${imagem}" style="width: 100px">
                <h2>${produto.descricao}</h2>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-evenly; gap: 10px;">
                <div id="div_agrupamentos" style="display: flex; flex-direction: column; align-items: start; justify-content: left;">
                </div>
                <label class="contorno_botoes" style="background-color: #026CED;" onclick="salvar_agrupamentos('${codigo}')">Salvar Agrupamentos</label>
            </div>

            <hr style="width: 100%; margin: 10px;">

            <div style="width: 80vw; overflow: auto; height: 500px; border-radius: 3px; background-color: #222; padding: 10px;">
                <table class="tabela" style="border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Marcação</th>
                            <th>Código</th>
                            <th>Descrição</th>
                            <th>Modelo</th>
                            <th>Unidade</th>
                            <th>Tipo</th>
                        <tr>
                    </thead>
                    <thead>
                        <tr>
                            <th style="background-color: white; position: relative; border-radius: 0px;">
                                <select onchange="checked_inputs(this)">
                                    <option>Todos</todos>
                                    <option>Marcados</todos>
                                    <option>Não Marcados</todos>
                                </select>
                            </th>
                            <th style="background-color: white; position: relative; border-radius: 0px;">
                                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                                <input style="width: 100%;" placeholder="Código" oninput="pesquisar_em_agrupamentos(this, 1)">
                            </th>
                            <th style="background-color: white; position: relative; border-radius: 0px;">
                                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                                <input style="width: 100%;" placeholder="Descrição" oninput="pesquisar_em_agrupamentos(this, 2)">
                            </th>
                            <th style="background-color: white; position: relative; border-radius: 0px;">
                                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                                <input style="width: 100%;" placeholder="Modelo" oninput="pesquisar_em_agrupamentos(this, 3)">
                            </th>
                            <th style="background-color: white; position: relative; border-radius: 0px;">
                                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                                <input style="width: 100%;" placeholder="Unidade" oninput="pesquisar_em_agrupamentos(this, 4)">
                            </th>
                            <th style="background-color: white; position: relative; border-radius: 0px;">
                                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                                <input style="width: 100%;" placeholder="Tipo" oninput="pesquisar_em_agrupamentos(this, 5)">
                            </th>
                        <tr>
                    </thead>
                    <tbody id="linhas_agrupamentos">
                        ${linhas}
                    </tbody>
                </table>
            </div>

        </div>    
    `
    openPopup_v2(acumulado)

    if (produto.agrupamentos) {
        var div_agrupamentos = document.getElementById('div_agrupamentos')
        if (div_agrupamentos) {
            for (item in produto.agrupamentos) {
                incluir_agrupamento(undefined, item, produto.agrupamentos[item])
            }
        }
    }

}

async function salvar_agrupamentos(codigo) {

    var div_agrupamentos = document.getElementById('div_agrupamentos')
    var agrupamentos = div_agrupamentos.querySelectorAll('.agrupado')
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    if (dados_composicoes[codigo]) {

        let produto = dados_composicoes[codigo]
        produto.agrupamentos = {}

        agrupamentos.forEach(agrupamento => {
            var codigo_agrupamento = agrupamento.querySelectorAll('label')[0].textContent
            produto.agrupamentos[codigo_agrupamento] = Number(agrupamento.querySelector('input').value)

        })

        await inserirDados(dados_composicoes, 'dados_composicoes')

        await enviar(`dados_composicoes/${codigo}/agrupamentos`, produto.agrupamentos)

        remover_popup()

        carregar_tabela_v2()
    }

}

function checked_inputs(filtro) {
    var linhas_agrupamentos = document.getElementById('linhas_agrupamentos')
    var filtrar = filtro.value

    if (linhas_agrupamentos) {

        var trs = linhas_agrupamentos.querySelectorAll('tr')

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td')

            var mostrar_linha = false

            var check = tds[0].querySelector('input').checked

            if (filtrar == 'Todos') {

                mostrar_linha = true

            } else if (filtrar == 'Marcados') {

                if (check) {
                    mostrar_linha = true
                } else {
                    mostrar_linha = false
                }

            } else if (filtrar == 'Não Marcados') {

                if (!check) {
                    mostrar_linha = true
                } else {
                    mostrar_linha = false
                }
            }

            if (mostrar_linha) {
                tr.style.display = 'table-row'
            } else {
                tr.style.display = 'none'
            }

        })
    }
}


function pesquisar_em_agrupamentos(elemento, coluna) {

    var linhas_agrupamentos = document.getElementById('linhas_agrupamentos')

    if (linhas_agrupamentos) {

        var trs = linhas_agrupamentos.querySelectorAll('tr')

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td')
            var mostrar_linha = false

            var texto = String(tds[coluna].textContent).toLocaleLowerCase()
            var termo = String(elemento.value).toLocaleLowerCase()

            if (texto.includes(termo)) {
                mostrar_linha = true
            }

            if (mostrar_linha) {
                tr.style.display = 'table-row'
            } else {
                tr.style.display = 'none'
            }

        })

    }

}

async function incluir_agrupamento(elemento, cod, qtde) {

    var codigo = ''
    var descricao = ''
    var modelo = ''
    var unidade = ''
    var tipo = ''
    var quantidade = 0

    if (cod !== undefined) {
        var dados_composicoes = await recuperarDados('dados_composicoes') || {}
        var produto = dados_composicoes[cod]
        codigo = cod
        descricao = produto.descricao
        modelo = produto.modelo
        unidade = produto.unidade
        tipo = produto.tipo
        quantidade = qtde
    }

    var div_agrupamentos = document.getElementById('div_agrupamentos')

    if (div_agrupamentos) {

        if ((elemento !== undefined && elemento.checked) || cod !== undefined) {

            if (elemento !== undefined && elemento.checked) {
                var tr = elemento.parentElement.parentElement
                codigo = tr.querySelectorAll('td')[1].textContent
                descricao = tr.querySelectorAll('td')[2].textContent
                modelo = tr.querySelectorAll('td')[3].textContent
                unidade = tr.querySelectorAll('td')[4].textContent
                tipo = tr.querySelectorAll('td')[5].textContent
            }

            var cor = 'green'
            if (tipo == 'VENDA') {
                cor = '#B12425'
            }

            var item = `
            <div class="agrupado" style="border: solid 1px ${cor};">
                <img src="imagens/excluir.png" style="width: 30px; cursor: pointer;" onclick="remover_item(this)">
                <label>${codigo}</label>
                <label>${descricao} - ${modelo} - ${unidade}</label>

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label>Quantidade</label>
                    <input style="padding: 5px; background-color: green; color: white; border-radius: 3px; width: 100px; text-align: center;" type="number" value="${quantidade}">
                </div>
            </div>
            `
            div_agrupamentos.insertAdjacentHTML('beforeend', item)
        }

    }

}

function remover_item(elemento) {
    elemento.parentElement.remove()
}

async function abrir_historico_de_precos(codigo, tabela) {


    let overlay = document.getElementById('overlay')
    if (overlay) {
        overlay.style.display = 'block'
    }

    var marcado = ''
    var acumulado = ''
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var produto = dados_composicoes[codigo]

    if (!produto[tabela]) {
        produto[tabela] = {}
    }

    if (!produto[tabela].historico) {
        produto[tabela].historico = {}
    }

    var historico = produto[tabela].historico
    var linhas = ''

    for (cotacao in historico) {
        dados_composicoes[codigo][tabela].ativo == cotacao ? marcado = 'checked' : marcado = ''

        linhas += `
        <tr style="font-size: 0.7em; color: #222;">
            <td>${dinheiro(historico[cotacao].custo)}</td>
            <td>${historico[cotacao].margem}</td>
            <td>${dinheiro(historico[cotacao].valor)}</td>
            <td>${historico[cotacao].data}</td>
            <td>${historico[cotacao].usuario}</td>
            <td>${historico[cotacao].fornecedor}</td>
            <td><input type="checkbox" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvar_preco_ativo('${codigo}', '${cotacao}', '${tabela}')" ${marcado}></td>
            <td>
                <div style="display: flex; align-items: center; justify-content; width: 100%;">
                    <img src="imagens/cancel.png" style="width: 25px; cursor: pointer;" onclick="excluir_cotacao('${codigo}', '${tabela}', '${cotacao}')">
                </div>
            </td>
        </tr>
        `
    }

    let visibilidade = 'flex'
    if (linhas == '') {
        visibilidade = 'none'
    }

    acumulado = `

    <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 70px;">

    <div style="display: flex; justify-content: space-evenly; width: 100%;">
        <label>Valores de Venda</label>
    </div>

    <div id="historico_preco" style="background-color: white; padding: 5px; border-radius: 5px;">

        <div style="color: #222; display: flex; flex-direction: column; justify-content: start; align-items: start;">
            <label>Descrição</label>
            <textarea style="font-size: 1.2em; width: 80%;" readOnly>${dados_composicoes[codigo].descricao}</textarea>
        </div>

        <div id="tabela_historico" style="display: ${visibilidade}; border-radius: 3px; padding: 3px; justify-content: center; align-items: center;">
            <table class="tabela">
                <thead>
                    <th>Custo de Compra</th>
                    <th>% Margem</th>
                    <th>Valor Final</th>
                    <th>Data da Cotação</th>
                    <th>Feito por</th>
                    <th>Fornecedor</th>
                    <th>Ativo</th>
                    <th>Excluir</th>
                </thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>
        <div onclick="adicionar_nova_cotacao('${codigo}', '${tabela}')" class="bot_adicionar">
            <img src="imagens/preco.png" style="cursor: pointer; width: 40px;">
            <label>Adicionar Preço</label>
        </div>
    </div>
    `

    var historico_preco = document.getElementById('historico_preco')
    if (historico_preco) {
        historico_preco.remove()
    }

    openPopup_v2(acumulado)

}

async function excluir_cotacao(codigo, lpu, cotacao) {
    var historico_preco = document.getElementById('historico_preco');
    var dados_composicoes = await recuperarDados('dados_composicoes') || {};

    if (historico_preco) {
        var tabela = historico_preco.querySelector('table');

        // 🔥 Adicionar o aviso de "Aguarde..." dentro do container
        const aviso = document.createElement('div');
        aviso.id = "aviso-aguarde";
        aviso.style = `
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
            font-size: 1.5em;
            border-radius: 5px;
        `;
        aviso.innerHTML = `<div>Aguarde...</div>`;
        historico_preco.style.position = "relative"; // Garante o posicionamento correto
        historico_preco.appendChild(aviso);

        // 🔥 Reduz a opacidade da tabela enquanto o aviso está ativo
        tabela.style.opacity = "0.3";

        // 🔥 Lógica de exclusão da cotação
        if (dados_composicoes[codigo] && dados_composicoes[codigo][lpu]) {
            let cotacoes = dados_composicoes[codigo][lpu];

            // Remove o preço ativo, se ele for a cotação atual
            if (cotacoes.ativo == cotacao) {
                cotacoes.ativo = "";
                await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, "");
            }

            // Remove a cotação do histórico
            delete cotacoes.historico[cotacao];

            // Atualiza o banco de dados
            await inserirDados(dados_composicoes, 'dados_composicoes');
            await deletar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`);
        }

        // 🔥 Restaurar a tabela e abrir o histórico
        tabela.style.opacity = "1"; // Restaura a opacidade
        await abrir_historico_de_precos(codigo, lpu); // 🛠️ Processa o histórico antes de remover o aviso
        aviso.remove(); // Remover aviso somente após abrir_historico_de_precos
    }
}

function adicionar_nova_cotacao(codigo, lpu) {
    var historico_preco = document.getElementById('historico_preco')
    let tabela_historico = document.getElementById('tabela_historico')
    tabela_historico.style.display = 'flex'

    if (historico_preco) {
        var tabela = historico_preco.querySelector('table')
        var tbody = tabela.querySelector('tbody')

        var linha = `
        <tr style="color: #222; font-size: 0.7em;">
            <td><input class="numero-bonito" type="number" oninput="calcular()"></td>
            <td><input class="numero-bonito" type="number" oninput="calcular()"></td>
            <td>R$ 0,00 </td>
            <td>${data_atual('completa')}</td>
            <td>${acesso.usuario}</td>
            <td><input class="numero-bonito"></td>
            <td>
                <img src="imagens/concluido.png" onclick="salvar_cotacao('${codigo}', '${lpu}')" style="width: 30px; cursor: pointer;">
            </td>
            <td>
                <img src="imagens/cancel.png" style="width: 30px; cursor: pointer;" onclick="remover_esta_linha(this)">
            </td>
        </tr>
        `
        tbody.insertAdjacentHTML('beforeend', linha)
    }
}

function remover_esta_linha(elemento) {
    let tr = elemento.closest('tr')
    tr.remove()
}

async function atualizar() {

    carregamento('composicoes_')
    await recuperar_dados_composicoes()

    carregar_tabela_v2()

}

async function salvar_preco_ativo(codigo, id_preco, lpu) {

    var dados_composicoes = await recuperarDados('dados_composicoes') || {};
    var produto = dados_composicoes[codigo];
    var historico_preco = document.getElementById('historico_preco');

    if (historico_preco) {
        var tabela = historico_preco.querySelector('table');
        var tbody = tabela.querySelector('tbody');
        var trs = tbody.querySelectorAll('tr');

        // 🔥 Adicionar o aviso de "Aguarde..." dentro do container da tabela
        const aviso = document.createElement('div');
        aviso.id = "aviso-aguarde";
        aviso.style = `
            display: flex; 
            align-items: center; 
            justify-content: center; 
            background-color: rgba(0, 0, 0, 0.7); 
            color: white; 
            position: absolute; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            z-index: 10; 
            font-size: 1.5em; 
            border-radius: 5px;
        `;
        aviso.innerHTML = `<div>Aguarde...</div>`;
        historico_preco.style.position = "relative"; // Garante que o aviso seja posicionado corretamente
        historico_preco.appendChild(aviso);

        // 🔥 Ocultar a tabela enquanto o aviso é exibido
        tabela.style.opacity = "0.3"; // Reduz a opacidade da tabela

        // 🔥 Desmarca todos os checkboxes antes de ativar o novo
        trs.forEach(tr => {
            let tds = tr.querySelectorAll('td');
            let checkbox = tds[6].querySelector('input');
            checkbox.checked = false; // Remove todas as marcações
        });

        let algumMarcado = false;
        
        // 🔥 Agora percorre e marca apenas o checkbox correto
        for (let tr of trs) {
            let tds = tr.querySelectorAll('td');
            let checkbox = tds[6].querySelector('input');

            if (id_preco === produto[lpu]?.ativo) {
                // Desmarcando o preço ativo
                produto[lpu].ativo = "";
                await inserirDados(dados_composicoes, 'dados_composicoes');
                await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, "");

                // 🔥 Remover o aviso e restaurar a tabela
                aviso.remove();
                tabela.style.opacity = "1"; // Restaura a opacidade
                carregar_tabela_v2();
                return abrir_historico_de_precos(codigo, lpu);
            }

            if (checkbox.checked || id_preco) {
                checkbox.checked = true; // Garante a marcação
                produto[lpu].ativo = id_preco;
                algumMarcado = true;

                await inserirDados(dados_composicoes, 'dados_composicoes');
                await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, id_preco);

                historico_preco.remove();

                // 🔥 Remover o aviso e restaurar a tabela
                aviso.remove();
                tabela.style.opacity = "1"; // Restaura a opacidade
                remover_popup();
                return abrir_historico_de_precos(codigo, lpu);
            }
        }

        // 🔥 Se nenhum checkbox foi marcado, remove o ativo
        if (!algumMarcado) {
            produto[lpu].ativo = "";
            await inserirDados(dados_composicoes, 'dados_composicoes');
            await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, "");
        }

        // 🔥 Remover o aviso e restaurar a tabela
        aviso.remove();
        tabela.style.opacity = "1"; // Restaura a opacidade
        carregar_tabela_v2();
    }
}

async function salvar_cotacao(codigo, lpu) {
    var historico_preco = document.getElementById('historico_preco');
    var dados_composicoes = await recuperarDados('dados_composicoes') || {};
    var produto = dados_composicoes[codigo];

    if (historico_preco) {
        var tabela = historico_preco.querySelector('table');
        var tbody = tabela.querySelector('tbody');
        var trs = tbody.querySelectorAll('tr');

        // 🔥 Adicionar o aviso de "Aguarde..." dentro do container
        const aviso = document.createElement('div');
        aviso.id = "aviso-aguarde";
        aviso.style = `
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
            font-size: 1.5em;
            border-radius: 5px;
        `;
        aviso.innerHTML = `<div>Aguarde...</div>`;
        historico_preco.style.position = "relative"; // Garante que o aviso seja posicionado corretamente
        historico_preco.appendChild(aviso);

        // 🔥 Reduz a opacidade da tabela enquanto o aviso está ativo
        tabela.style.opacity = "0.3";

        for (let tr of trs) {
            var inputs = tr.querySelectorAll('input');
            var tds = tr.querySelectorAll('td');

            if (inputs.length > 1) {
                var dados = {
                    custo: conversorParaCotacao(inputs[0].value),
                    margem: inputs[1].value,
                    valor: conversor(tds[2].textContent),
                    data: tds[3].textContent,
                    usuario: acesso.usuario,
                    fornecedor: inputs[2].value,
                };

                if (!produto[lpu]) {
                    produto[lpu] = {};
                }
                if (!produto[lpu].historico) {
                    produto[lpu].historico = {};
                }

                var id = gerar_id_5_digitos();

                produto[lpu].historico[id] = dados;

                await inserirDados(dados_composicoes, 'dados_composicoes');
                await enviar(`dados_composicoes/${codigo}/${lpu}/historico/${id}`, dados);

            }
        }

        // 🔥 Restaurar a tabela e abrir o histórico
        tabela.style.opacity = "1"; // Restaura a opacidade
        await abrir_historico_de_precos(codigo, lpu); // 🛠️ Processa o histórico antes de remover o aviso
        aviso.remove(); // Remover aviso somente após abrir_historico_de_precos
    }
}

function conversorParaCotacao(valor) {
    if (typeof valor === 'number') {
        return valor; // Retorna diretamente se já for um número
    }

    if (!valor || typeof valor !== 'string' || valor.trim() === "") {
        return 0; // Retorna 0 para valores nulos, vazios ou inválidos
    }

    // Remove espaços em branco
    valor = valor.trim();

    // Identificar formatos
    const isBRFormat = valor.includes(',') && !valor.includes('.'); // Ex: "1.000,25"
    const isUSFormat = valor.includes('.') && valor.includes(','); // Ex: "1,000.25"

    if (isUSFormat) {
        // Formato US: Remove vírgulas e mantém o ponto como decimal
        valor = valor.replace(/,/g, '');
    } else if (isBRFormat) {
        // Formato BR: Remove pontos de milhar e substitui vírgula por ponto
        valor = valor.replace(/\./g, '').replace(',', '.');
    } else {
        // Caso geral: Remove qualquer caracter que não seja número ou ponto
        valor = valor.replace(/[^0-9.]/g, '');
    }

    // Tenta converter para float
    const numero = parseFloat(valor);

    // Retorna o número convertido ou 0 se não for válido
    return isNaN(numero) ? 0 : numero;
}


function calcular() {

    var historico_preco = document.getElementById('historico_preco')
    if (historico_preco) {
        var tabela = historico_preco.querySelector('table')
        var tbody = tabela.querySelector('tbody')
        var trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {
            var inputs = tr.querySelectorAll('input')

            if (inputs.length > 1) {

                var tds = tr.querySelectorAll('td')
                var custo = Number(inputs[0].value)
                var margem = Number(inputs[1].value)

                tds[2].textContent = dinheiro(custo * (1 + (margem / 100)))
            }
        })
    }

}

async function cadastrar_editar_item(codigo) {

    let overlay = document.getElementById('overlay')
    if (overlay) {
        overlay.style.display = 'block'
    }

    let colunas = ['descricao', 'fabricante', 'modelo', 'unidade', 'ncm', 'tipo', 'omie']
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados = dados_composicoes[codigo] || {}
    let n_codigo = codigo
    if (codigo !== undefined) {
        colunas = Object.keys(dados)
    } else {
        n_codigo = `gcs-${gerar_id_5_digitos()}`
    }
    let funcao = codigo == undefined ? `cadastrar_alterar('${n_codigo}')` : `cadastrar_alterar('${codigo}')`

    let elementos = ''

    colunas.forEach(col => {
        let valor = codigo !== undefined ? dados[col] : ''
        let campo = `<input style="background-color: #a2d7a4; padding: 5px; border-radius: 3px;" value="${valor}">`

        if (col.includes('desc')) {
            campo = `
            <textarea style="background-color: #a2d7a4; width: 100%; border: none;">${valor}</textarea>
            `
        } else if (col == 'tipo') {
            campo = `
            <div>
                <select style="cursor: pointer;">
                    <option>VENDA</option>
                    <option>SERVIÇO</option>
                </select>
            </div>
            `
        }

        if (
            !col.includes('lpu') &&
            col !== 'codigo' &&
            col !== 'imagem' &&
            col !== 'agrupamentos' &&
            col !== 'material infra' &&
            col !== 'parceiro') {
            elementos += `
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <label style="width: 30%; text-align: right;">${col}</label>
                ${campo}
            </div>
            `
        }
    })

    var acumulado = `

    <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 70px;">

    <div style="display: flex; align-items: center; justify-content: center; gap: 5px; position: absolute; bottom: 5px; right: 15px; ">
        <label style="font-size: 0.7em;">${n_codigo}</label>
        <img src="imagens/cancel.png" style="width: 15px; cursor: pointer;" onclick="confirmar_exclusao_item('${n_codigo}')">
    </div>

    <div style="display: flex; justify-content: space-evenly; width: 100%;">
        <label>Dados do Item</label>
    </div>

    <div id="cadastrar_item" style="background-color: white; color: #222; padding: 5px; border-radius: 5px;">

        <div id="elementos" style="display: flex; flex-direction: column; gap: 5px;">
        ${elementos}
        </div>
        <div id="novo_campo" style="margin: 10px; display: flex; gap: 10px; align-items: center; justify-content: right; border-radius: 3px; padding: 10px; background-color: #222; color: white;">
            <label>Novo campo?</label>
            <input placeholder="Campo" id="campo" style="padding: 5px; border-radius: 3px;">
            <input placeholder="Valor" id="valor" style="padding: 5px; border-radius: 3px;">
        </div>
        <button style="background-color: #4CAF50; width: 100%; margin: 0px;" onclick="${funcao}">Salvar</buttton>
    </div>
    `
    openPopup_v2(acumulado)
}

async function confirmar_exclusao_item(codigo) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    remover_popup()

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                <img src="gifs/alerta.gif">
                <label>Tem certeza que deseja excluir este item?</label>
            </div>
            <label style="font-size: 0.7em;">${dados_composicoes[codigo].descricao}</label>
            <button onclick="exclusao_item('${codigo}')">Confirmar</button>
        </div>
        `)
}

async function exclusao_item(codigo) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    if (dados_composicoes[codigo]) {
        delete dados_composicoes[codigo]

        await deletar(`dados_composicoes/${codigo}`)
        await inserirDados(dados_composicoes, 'dados_composicoes')
        remover_popup()
        await carregar_tabela_v2()
    }

}

async function cadastrar_alterar(codigo) {
    let elementos = document.getElementById('elementos');
    if (!elementos) return;

    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    if (!dados_composicoes[codigo]) {
        dados_composicoes[codigo] = {};
    }

    let dadosAtualizados = {};
    let divs = elementos.querySelectorAll('div');

    divs.forEach(div => {
        let item = div.querySelector('label');
        let valor = div.querySelector('input') || div.querySelector('textarea') || div.querySelector('select');

        if (item && valor) {
            dadosAtualizados[item.textContent] = valor.value;
        }
    });

    let novo_campo = document.getElementById('nova_lpu');
    if (novo_campo) {
        let campo = document.getElementById('campo').value;
        let valor = document.getElementById('valor').value;
        if (campo !== '' && valor !== '') {
            dadosAtualizados[campo] = valor;
        }
    }

    dadosAtualizados.codigo = codigo;

    dados_composicoes[codigo] = { ...dados_composicoes[codigo], ...dadosAtualizados };

    await inserirDados(dados_composicoes, 'dados_composicoes');
    await enviar(`dados_composicoes/${codigo}`, dados_composicoes[codigo]);

    remover_popup();
    carregar_tabela_v2();
}

async function abrirModalFiltros() {
    let modal = document.getElementById("modal-filtros");
    let overlay = document.getElementById("overlay");
    let listaFiltros = document.getElementById("lista-filtros");
    overlay.style.display = "block"

    // Obtém os dados do localStorage ou do banco
    let dados_composicoes = await recuperarDados("dados_composicoes") || {};
    let cabecalhos = [...new Set(Object.values(dados_composicoes).flatMap(obj => Object.keys(obj)))];

    let lpusCriadas = JSON.parse(localStorage.getItem("lpus_criadas")) || [];
    cabecalhos.push(...lpusCriadas);

    // Adiciona o campo "Editar" manualmente à lista de filtros
    if (!cabecalhos.includes("editar")) {
        cabecalhos.push("editar");
    }

    let colunasAtivas = JSON.parse(localStorage.getItem("colunas_composicoes")) || cabecalhos;

    listaFiltros.innerHTML = ""

    // Ordena os filtros em ordem alfabética
    cabecalhos.sort((a, b) => a.localeCompare(b));

    cabecalhos.forEach(cab => {
        let cabecalhoFormatado = cab
            .toLowerCase()
            .split(" ") // Divide o nome em palavras
            .map(word =>
                word.toLowerCase() === "lpu" ? "LPU" : word.charAt(0).toUpperCase() + word.slice(1)
            ) // Deixa "LPU" totalmente maiúsculo e capitaliza o restante
            .join(" "); // Junta novamente com espaço

        let checked = colunasAtivas.includes(cab) ? "checked" : "";

        listaFiltros.innerHTML += `
            <label>
                <input type="checkbox" value="${cab}" ${checked}> ${cabecalhoFormatado}
            </label>
        `;

    });

    modal.style.display = "block";
}

function fecharModalFiltros() {
    document.getElementById("modal-filtros").style.display = "none";
    overlay = document.getElementById("overlay").style.display = "none";
}

function selecionarTodosFiltros() {
    let checkboxes = document.querySelectorAll("#lista-filtros input[type='checkbox']");
    let selecionarTudo = document.getElementById("selecionar-tudo").checked;

    checkboxes.forEach(cb => cb.checked = selecionarTudo);
}

function aplicarFiltros() {
    let checkboxes = document.querySelectorAll("#lista-filtros input[type='checkbox']:checked");
    let overlay = document.getElementById("overlay");
    let colunasSelecionadas = Array.from(checkboxes).map(cb => cb.value);

    localStorage.setItem("colunas_composicoes", JSON.stringify(colunasSelecionadas));
    fecharModalFiltros();
    carregar_tabela_v2(); // Atualiza a tabela com os filtros aplicados
    overlay.style.display = "none"
}

function filtrarCampos() {
    let termo = document.getElementById("pesquisa-filtros").value.toLowerCase();
    let filtros = document.querySelectorAll("#lista-filtros label");

    filtros.forEach(label => {
        let texto = label.textContent.toLowerCase();
        label.style.display = texto.includes(termo) ? "flex" : "none";
    });
}

function salvarNovaLPU() {
    let inputLPU = document.getElementById("nome-lpu");
    let nomeLPU = inputLPU.value.trim();
    let texto_aviso = document.getElementById("texto-aviso")

    if (nomeLPU === "") {
        alert("Digite um nome válido para a LPU!");
        return;
    }

    nomeLPU = nomeLPU.toLowerCase(); // Converte para maiúsculas

    // Recupera LPUs já salvas ou cria um array vazio
    let lpusCriadas = JSON.parse(localStorage.getItem("lpus_criadas")) || [];

    if (lpusCriadas.includes(nomeLPU)) {
        texto_aviso.style.display = "flex"
        texto_aviso.textContent = "Essa LPU já existe!!!"
        return;
    }

    if (!nomeLPU.includes("lpu")) {
        texto_aviso.style.display = "flex"
        texto_aviso.textContent = "É necessário ter LPU no nome!!!"
        return;
    }

    // Adiciona a nova LPU e salva no localStorage
    lpusCriadas.push(nomeLPU);
    localStorage.setItem("lpus_criadas", JSON.stringify(lpusCriadas));

    remover_popup();
}

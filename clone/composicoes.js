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
                <input style="width: 100%; padding: 0px;" placeholder="..." oninput="pesquisar_em_composicoes(this)">
            </th>`
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
                conteudo = `<label class="${estilo}" onclick="abrir_historico_de_precos('${codigo}', '${chave}')"> ${dinheiro(conversor(preco_final))}</label>`;

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
        <tr>
            <td>${dinheiro(historico[cotacao]?.valor_custo || historico[cotacao]?.custo)}</td>
            <td style="text-align: center;">${historico[cotacao].margem}</td>
            <td>${dinheiro(historico[cotacao].valor)}</td>
            <td>${historico[cotacao].data}</td>
            <td>${historico[cotacao].usuario}</td>
            <td>${historico[cotacao].fornecedor}</td>
            <td><input type="checkbox" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvar_preco_ativo('${codigo}', '${cotacao}', '${tabela}')" ${marcado}></td>
            <td style="text-align: center;">
                <img src="imagens/cancel.png" style="width: 2vw; cursor: pointer;" onclick="excluir_cotacao('${codigo}', '${tabela}', '${cotacao}')">
            </td>
            <td style="text-align: center;">
                <img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;" onclick="adicionar_nova_cotacao('${codigo}', '${tabela}', '${cotacao}')">
            </td>
        </tr>
        `
    }

    let visibilidade = 'flex'
    if (linhas == '') {
        visibilidade = 'none'
    }

    acumulado = `

    <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 5vh;">

    <div style="display: flex; justify-content: space-evenly; width: 100%;">
        <label>Valores de Venda</label>
    </div>

    <div style="display: flex; justify-content: left; align-items: start; flex-direction: column; background-color: white; padding: 5px; border-radius: 5px; color: #222;">
        <div id="historico_preco" style="display: flex; flex-direction: column; align-items: start; justify-content: center; position: relative; width: 100%;">
            
            <div style="display: flex; justify-content: left; align-items: center; gap: 5px;">
                <img style="width: 7vw;" src="${dados_composicoes[codigo].imagem !== '' ? dados_composicoes[codigo].imagem : 'https://i.imgur.com/Nb8sPs0.png'}">
                <div style="color: #222; display: flex; flex-direction: column; justify-content: start; align-items: start;">
                    <label style="font-size: 0.8vw;">Descrição</label>
                    <label>${dados_composicoes[codigo].descricao}</label>
                </div>
            </div>

            <div onclick="adicionar_nova_cotacao('${codigo}', '${tabela}')" class="bot_adicionar">
                <img src="imagens/preco.png">
                <label>Adicionar Preço</label>
            </div>

            <label>Histórico de Preços</label>

            <hr style="width: 100%;">

            <div id="tabela_historico" style="display: ${visibilidade}; border-radius: 3px; padding: 3px; justify-content: center; align-items: center;">
                <table class="tabela">
                    <thead>
                        <th>Valor de Custo</th>
                        <th>Margem %</th>
                        <th>Pr. Venda</th>
                        <th>Data</th>
                        <th>Usuário</th>
                        <th>Fornecedor</th>
                        <th>Ativo</th>
                        <th>Excluir</th>
                        <th>Detalhes</th>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
        </div>
        <div></div>
    </div>
    `
    var historico_preco = document.getElementById('historico_preco')
    if (historico_preco) {
        historico_preco.remove()
    }

    openPopup_v2(acumulado)

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

async function adicionar_nova_cotacao(codigo, lpu, cotacao) {

    let historico_preco = document.getElementById('historico_preco')
    let div = historico_preco.nextElementSibling
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]
    let acumulado = ''
    let funcao = cotacao ? `salvar_preco('${codigo}', '${lpu}', '${cotacao}')` : `salvar_preco('${codigo}', '${lpu}')`

    let painel = `
        <div style="color: #222; font-size: 0.8vw; background-color: #d2d2d2; padding: 5px; border-radius: 3px; display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 2px;">
            <label>NF de Compra</label>
            <input style="background-color: #91b7d9;" id="nota" value="${produto[lpu]?.historico[cotacao]?.nota || ''}">
            ${produto.tipo == 'VENDA' ? `<label>Fornecedor</label>
            <input style="background-color: #91b7d9;" id="fornecedor" value="${produto[lpu]?.historico[cotacao]?.fornecedor || ''}">` : ''}
            <label onclick="${funcao}" class="contorno_botoes" style="background-color: #4CAF50;">Salvar</label>
        </div>
    `

    if (produto.tipo == 'VENDA') {
        acumulado = `
        <div style="display: flex; align-items: start; justify-content: start; gap: 10px;">
            <table class="tabela">
                <thead>
                    <th>Dados Iniciais</th>
                </thead>
                <tbody>
                    <tr>
                        <td>Preço Unitário</td>
                        <td style="background-color: #91b7d9;"><input id="custo" oninput="calcular()" value="${produto[lpu]?.historico[cotacao]?.custo || ''}"></td>
                    </tr>
                    <tr>
                        <td>Frete de Compra (5%)</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>ICMS Creditado em nota (%)</td>
                        <td style="background-color: #91b7d9;"><input id="icms_creditado" oninput="calcular()" value="${produto[lpu]?.historico[cotacao]?.icms_creditado || ''}"></td>
                    </tr>
                    <tr>
                        <td>Aliquota ICMS (Bahia)</td>
                        <td><input value="20.5%" value="20.5%" readOnly></td>
                    </tr>
                    <tr>
                        <td>ICMS a ser pago (DIFAL)</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Valor do ICMS de Entrada</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Valor de Custo</td>
                        <td id="valor_custo"></td>
                    </tr>                                      
                    <tr>
                        <td>Margem de Acréscimo (%)</td>
                        <td style="background-color: #91b7d9;"><input id="margem" type="number" oninput="calcular()" value="${produto[lpu]?.historico[cotacao]?.margem || ''}"></td>
                    </tr>
                    <tr>
                        <td>Preço de Venda</td>
                        <td style="background-color: #91b7d9;"><input id="final" type="number" oninput="calcular(undefined, 'final')" value="${produto[lpu]?.historico[cotacao]?.valor || ''}"></td>
                    </tr>
                    <tr>
                        <td>Frete de Venda (5%)</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; gap: 1vw;">
                <table class="tabela">
                    <thead>
                        <th>Resultados</th>
                    </thead>
                    <tbody>
                        <tr>
                            <td>LUCRO LIQUIDO</td>
                            <td>R$ 0,00</td>
                        </tr>
                        <tr>
                            <td>PERCENTUAL DE LUCRO</td>
                            <td>0%</td>
                        </tr>
                    </tbody>
                </table>

                ${painel}

            </div>
        </div>
        <br>
        <table class="tabela">
            <thead>
                <th>Presunções dos Impostos de Saída</th>
                <th>Percentuais</th>
                <th>Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td>Aliquota do Lucro Presumido Comercio "Incide sobre o valor de Venda do Produto"</td>
                    <td><input value="8%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>Alíquota da Presunção CSLL (Incide sobre o valor de venda do produto)</td>
                    <td><input value="12%" readOnly></td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        <br>
        <table class="tabela">
            <thead>
                <th>Impostos a Serem Pagos</th>
                <th>Percentuais</th>
                <th>Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td>O Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input value="15%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>Adicional do Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input value="10%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>CSLL a ser Pago (9%) da Presunção</td>
                    <td><input value="9%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>O Programa de Integração Social (PIS) (0,65%) do faturamento</td>
                    <td><input value="0.65%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>A Contribuição para o Financiamento da Seguridade Social (COFINS) (3%) do faturamento</td>
                    <td><input value="3%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>O Imposto sobre Circulação de Mercadorias e Serviços (ICMS) (12%) do faturamento</td>
                    <td><input value="12%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td>Total</td>
                    <td></td>
                </tr>                                                                               
            </tbody>
        </table>
        `
    } else { // Serviço

        acumulado = `

        <div style="display: flex; align-items: center; justify-content: space-evenly; width: 100%;">

            <table class="tabela">
                <tbody>
                    <thead>
                        <th>Preço do Serviço</th>
                    </thead>
                    <tr>
                        <td style="background-color: #91b7d9;"><input id="final" type="number" oninput="calcular('servico')" value="${produto[lpu]?.historico[cotacao]?.custo || ''}"></td>
                    </tr>
                </tbody>
            </table>

            <table class="tabela">
                <thead>
                    <th>Resultados</th>
                </thead>
                <tbody>
                    <tr>
                        <td>LUCRO LIQUIDO</td>
                        <td>R$ 0,00</td>
                    </tr>
                    <tr>
                        <td>PERCENTUAL DE LUCRO</td>
                        <td> 0%</td>
                    </tr>
                </tbody>
            </table>

            ${painel}

        </div>
        <br>
        <table class="tabela">
            <thead>
                <th>Presunções dos Impostos de Saída</th>
                <th>Percentuais</th>
                <th>Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td>Aliquota do Lucro Presumido Comercio "Incide sobre o valor de Venda do Produto"</td>
                    <td>32%</td>
                    <td></td>
                </tr>
                <tr>
                    <td>Alíquota da Presunção CSLL (Incide sobre o valor de venda do produto)</td>
                    <td>32%</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        <br>
        <table class="tabela">
            <thead>
                <th>Impostos a Serem Pagos</th>
                <th>Percentuais</th>
                <th>Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td>O Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input value="15%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>Adicional do Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input value="10%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>CSLL a ser Pago (9%) da Presunção</td>
                    <td><input value="9%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>O Programa de Integração Social (PIS) (0,65%) do faturamento</td>
                    <td><input value="0.65%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>A Contribuição para o Financiamento da Seguridade Social (COFINS) (3%) do faturamento</td>
                    <td><input value="3%" readOnly></td>
                    <td></td>
                </tr>
                <tr>
                    <td>O Imposto Sobre Serviços ( ISS )(5%) (Incide sobre o faturamento)</td>
                    <td><input value="5%" readOnly></td>
                    <td></td>
                </tr>                
                <tr>
                    <td></td>
                    <td>Total</td>
                    <td>R$ 0,00</td>
                </tr>                                                                               
            </tbody>
        </table>
        `
    }

    div.innerHTML = `
    <div style="color: #222; background-color: white; border-radius: 3px; padding: 5px; display: flex; justify-content: center; align-items: start; flex-direction: column;">

        <label>Gestão de Preço</label>
        <hr style="width: 100%;">
        ${acumulado}

    </div>`

    calcular(produto.tipo == 'SERVIÇO' ? 'servico' : undefined)

}

async function salvar_preco(codigo, lpu, cotacao) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

    if (!produto[lpu]) {
        produto[lpu] = {
            historico: {}
        }
    }

    let historico = produto[lpu].historico
    let id = cotacao ? cotacao : gerar_id_5_digitos()

    historico[id] = {
        margem: 0,
        custo: Number(document.getElementById('final').value),
        valor: Number(document.getElementById('final').value),
        data: dt(),
        usuario: acesso.usuario,
        nota: document.getElementById('nota').value,
        fornecedor: '--'
    }

    if (produto.tipo == 'VENDA') {
        historico[id].valor_custo = conversor(document.getElementById('valor_custo').textContent)
        historico[id].icms_creditado = Number(document.getElementById('icms_creditado').value)
        historico[id].fornecedor = document.getElementById('fornecedor').value
        historico[id].custo = Number(document.getElementById('custo').value)
        historico[id].margem = Number(document.getElementById('margem').value)
    }

    await inserirDados(dados_composicoes, 'dados_composicoes')

    enviar(`dados_composicoes/${codigo}/${lpu}/historico/${id}`, historico[id])
    remover_popup()

    await abrir_historico_de_precos(codigo, lpu)
}

function calcular(tipo, campo) {

    let historico_preco = document.getElementById('historico_preco')
    let tabelas = historico_preco.nextElementSibling.querySelectorAll('table')

    if (tipo == 'servico') {

        let tds = tabelas[0].querySelectorAll('td') // 1ª Tabela;

        let valor_servico = conversor(tds[0].querySelector('input').value)

        tds = tabelas[2].querySelectorAll('td')

        let aliq_lp = valor_servico * 0.32 // Alíquota do Lucro Presumido;
        let presuncao_csll = valor_servico * 0.32 // Presunção CSLL;

        tds[2].textContent = dinheiro(aliq_lp)
        tds[5].textContent = dinheiro(presuncao_csll)

        tds = tabelas[3].querySelectorAll('td')

        let irpj = aliq_lp * 0.15
        let adicional_irpj = aliq_lp * 0.10
        let presuncao_csll_a_ser_pago = presuncao_csll * 0.09
        let pis = valor_servico * 0.0065
        let cofins = valor_servico * 0.03
        let iss = valor_servico * 0.05
        let total_impostos = irpj + adicional_irpj + presuncao_csll_a_ser_pago + pis + cofins + iss

        tds[2].textContent = dinheiro(irpj)
        tds[5].textContent = dinheiro(adicional_irpj)
        tds[8].textContent = dinheiro(presuncao_csll_a_ser_pago)
        tds[11].textContent = dinheiro(pis)
        tds[14].textContent = dinheiro(cofins)
        tds[17].textContent = dinheiro(iss)
        tds[20].textContent = dinheiro(total_impostos)

        tds = tabelas[1].querySelectorAll('td')
        let lucro_liq = valor_servico - total_impostos

        tds[1].textContent = dinheiro(lucro_liq)
        tds[3].textContent = `${(lucro_liq / valor_servico * 100).toFixed(2)}%`

    } else {

        let tds = tabelas[0].querySelectorAll('td') // 1ª Tabela

        let preco_compra = conversor(tds[1].querySelector('input').value)
        let frete = preco_compra * 0.05
        let icms_creditado = conversor(tds[5].querySelector('input').value)
        let icms_aliquota = conversor(tds[7].querySelector('input').value)
        let difal = icms_aliquota - icms_creditado
        let icms_entrada = difal / 100 * preco_compra
        let valor_custo = icms_entrada + preco_compra + frete

        tds[3].textContent = dinheiro(frete)
        tds[9].textContent = `${difal}%`
        tds[11].textContent = dinheiro(icms_entrada)
        tds[13].textContent = dinheiro(valor_custo)

        let margem = conversor(tds[15].querySelector('input').value)
        let preco_venda = (1 + margem / 100) * valor_custo

        if (campo == 'final') {
            preco_venda = conversor(tds[17].querySelector('input').value)
            margem = ((preco_venda / valor_custo - 1) * 100).toFixed(2)
            tds[15].querySelector('input').value = margem

        } else {
            tds[17].querySelector('input').value = preco_venda.toFixed(2)
        }

        let frete_venda = preco_venda * 0.05
        tds[19].textContent = dinheiro(frete_venda)

        tds = tabelas[2].querySelectorAll('td') // 2ª Tabela
        let porc_LP = conversor(tds[1].querySelector('input').value) / 100 // Lucro Presumido

        tds[2].textContent = dinheiro(preco_venda * porc_LP)

        let porc_CSLL = conversor(tds[4].querySelector('input').value) / 100 // CSLL

        tds[5].textContent = dinheiro(preco_venda * porc_CSLL)

        tds = tabelas[2].querySelectorAll('td') // 3ª Tabela
        let lucro_presumido = preco_venda * 0.08
        let presuncao_csll = preco_venda * 0.12

        tds[2].textContent = dinheiro(lucro_presumido)
        tds[5].textContent = dinheiro(presuncao_csll)

        tds = tabelas[3].querySelectorAll('td') // 4ª Tabela

        let irpj = lucro_presumido * 0.15
        let adicional_irpj = lucro_presumido * 0.1
        let presuncao_csll_a_ser_pago = presuncao_csll * 0.09
        let pis = preco_venda * 0.0065
        let cofins = preco_venda * 0.03
        let icms = preco_venda * 0.12

        let total_impostos = irpj + adicional_irpj + presuncao_csll_a_ser_pago + pis + cofins + icms

        tds[2].textContent = dinheiro(irpj)
        tds[5].textContent = dinheiro(adicional_irpj)
        tds[8].textContent = dinheiro(presuncao_csll_a_ser_pago)
        tds[11].textContent = dinheiro(pis)
        tds[14].textContent = dinheiro(cofins)
        tds[17].textContent = dinheiro(icms)
        tds[20].textContent = dinheiro(total_impostos)

        tds = tabelas[1].querySelectorAll('td') // Tabela resumo
        let total_custos = valor_custo + total_impostos + frete_venda
        let lucro_liquido = preco_venda - total_custos
        tds[1].textContent = dinheiro(lucro_liquido)
        tds[3].textContent = `${(lucro_liquido / valor_custo * 100).toFixed(2)}%`

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

async function cadastrar_editar_item(codigo) {

    let overlay = document.getElementById('overlay')
    if (overlay) {
        overlay.style.display = 'block'
    }

    let colunas = ['descricao', 'fabricante', 'modelo', 'unidade', 'ncm', 'tipo', 'omie']
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados = dados_composicoes[codigo] || {}

    let funcao = codigo ? `cadastrar_alterar('${codigo}')` : `cadastrar_alterar()`
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

    <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 5vh;">

    ${codigo ? `<div style="display: flex; align-items: center; justify-content: center; gap: 5px; position: absolute; bottom: 5px; right: 15px; ">
        <label style="font-size: 0.7em;">${codigo}</label>
        <img src="imagens/cancel.png" style="width: 15px; cursor: pointer;" onclick="confirmar_exclusao_item('${codigo}')">
    </div>` : ''}

    <div style="display: flex; justify-content: space-evenly; width: 100%;">
        <label>Dados do Item</label>
    </div>

    <div id="cadastrar_item" style="background-color: white; color: #222; padding: 5px; border-radius: 5px; margin: 1vw;">

        <div id="elementos" style="display: flex; flex-direction: column; gap: 5px;">
            ${elementos}
        </div>

        <br>

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

    codigo = codigo ? codigo : await verificar_codigo_existente(true) // Verificar com o servidor o último código sequencial;

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

    dadosAtualizados.codigo = codigo;

    dados_composicoes[codigo] = { ...dados_composicoes[codigo], ...dadosAtualizados };

    await inserirDados(dados_composicoes, 'dados_composicoes');
    await enviar(`dados_composicoes/${codigo}`, dados_composicoes[codigo]);

    remover_popup();
    carregar_tabela_v2();
}

async function verificar_codigo_existente(clone) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/codigo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clone })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
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

function para_excel() {

    let tabela = document.getElementById('tabela_composicoes')

    if (!tabela) {
        return;
    }

    let worksheet = XLSX.utils.table_to_sheet(tabela);
    let workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Preços");
    XLSX.writeFile(workbook, 'lpu.xlsx');
}
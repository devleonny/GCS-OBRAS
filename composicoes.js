let filtrosAtivos = {}
let filtroAgrupamentos = {}
let divComposicoes = document.getElementById('composicoes')
const modelos = {
    'VENDA': {
        camposIniciais: [
            { label: 'Preço Unitário', id: 'custo', tipo: 'number', evento: 'oninput="calcular()"', valor: 'custo' },
            { label: 'Frete de Compra (2%)' },
            { label: 'ICMS Creditado em nota (%)', id: 'icms_creditado', tipo: 'number', evento: 'oninput="selecionarOrigemPorICMS(this.value); calcular()"', valor: 'icms_creditado' },
            { label: 'Aliquota ICMS (Bahia)', valorFixo: '20,5%' },
            { label: 'ICMS a ser pago (DIFAL)' },
            { label: 'Valor do ICMS de Entrada' },
            { label: 'Valor de Custo', idResultado: 'valor_custo' },
            { label: 'Margem de Acréscimo (%)', id: 'margem', tipo: 'number', evento: 'oninput="calcular()"', valor: 'margem' },
            { label: 'Preço de Venda', id: 'final', tipo: 'number', evento: 'oninput="calcular(undefined, \"final\")"', valor: 'valor' },
            { label: 'Frete de Venda (5%)' }
        ],
        presuncoes: [
            { label: 'Aliquota do Lucro Presumido Comercio', valor: '8%' },
            { label: 'Alíquota da Presunção CSLL', valor: '12%' }
        ],
        impostos: [
            { label: 'IRPJ', valor: '15%' },
            { label: 'Adicional IRPJ', valor: '10%' },
            { label: 'CSLL', valor: '9%' },
            { label: 'PIS', valor: '0.65%' },
            { label: 'COFINS', valor: '3%' },
            { label: 'ICMS', seletor: true, id: 'icms_saida', opcoes: ['4%', '12%', '20,5%'] }
        ]
    },
    'SERVIÇO': {
        camposIniciais: [
            { label: 'Preço do Serviço', id: 'final', tipo: 'number', evento: 'oninput="calcular(\"servico\")"', valor: 'final' }
        ],
        presuncoes: [
            { label: 'Aliquota do Lucro Presumido Serviço', valor: '32%' },
            { label: 'Alíquota da Presunção CSLL', valor: '32%' }
        ],
        impostos: [
            { label: 'IRPJ', valor: '15%' },
            { label: 'Adicional IRPJ', valor: '10%' },
            { label: 'CSLL', valor: '9%' },
            { label: 'PIS', valor: '0.65%' },
            { label: 'COFINS', valor: '3%' },
            { label: 'ISS', valor: '5%' }
        ]
    },
    'USO CONSUMO': null // Pode ser composto dinamicamente de VENDA + impostos de SERVICO
};

function criar_lpu() {
    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <label style="font-size: 1.2em;">Digite o nome da nova LPU:</label>
            <input id="nome-lpu" type="text" placeholder="Ex: LPU Novo" style="padding: 10px; width: 80%; border-radius: 5px;">
            <label id="texto-aviso" style="display: none; color: red;"></label>
            <button onclick="salvarNovaLPU()" style="background-color: #026CED; color: white; padding: 10px; border: none; cursor: pointer; width: 80%;">Salvar</button>
        </div>
    `, 'Nova LPU');
}

carregar_tabela_v2()

async function recuperar_composicoes() {

    overlayAguarde()
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let nuvem = await receber('dados_composicoes')

    let dadosMescladosComposicoes = {
        ...dados_composicoes,
        ...nuvem
    }

    removerExcluidos(dadosMescladosComposicoes)

    await inserirDados(dadosMescladosComposicoes, 'dados_composicoes')
    await carregar_tabela_v2()
    remover_popup()
}

async function carregar_tabela_v2(auxiliarPaginacao) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {};

    if (Object.keys(dados_composicoes).length == 0) {
        return recuperar_composicoes();
    }

    var thead = '';
    var tbody = '';
    var tsearch = '';

    var cabecalhos = [
        ...new Set(
            Object.values(dados_composicoes).flatMap(obj => Object.keys(obj))
        )
    ];

    let lpusCriadas = JSON.parse(localStorage.getItem("lpus_criadas")) || [];
    cabecalhos.push(...lpusCriadas);

    cabecalhos.push('editar');

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    let colunasComposicoes = JSON.parse(localStorage.getItem('colunasComposicoes')) || {}
    let modo = modoClone ? 'clone' : 'antigos'
    if (!colunasComposicoes[modo]) {
        colunasComposicoes[modo] = []
    }
    let colunas = colunasComposicoes[modo]

    const idxCat = colunas.indexOf('categoria de equipamento');
    const idxSis = colunas.indexOf('sistema');

    if (idxCat !== -1 && idxSis !== -1 && Math.abs(idxCat - idxSis) !== 1) {
        // Remove os dois
        colunas = colunas.filter(c => c !== 'categoria de equipamento' && c !== 'sistema');
        // Define a posição onde quer inserir (por exemplo, no início)
        const posicao = 0;
        colunas.splice(posicao, 0, 'categoria de equipamento', 'sistema');
    }

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

    if (!divComposicoes) {
        return
    }

    divComposicoes.innerHTML = '';

    var ths = {};
    var tsc = {};

    cabecalhos.forEach(cab => {
        ths[cab] = `<th style="position: relative; cursor: pointer; text-align: left;">${inicial_maiuscula(cab)}</th>`
        tsc[cab] = `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%; padding: 0px;" placeholder="...">
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

            } else if (chave == 'sistema' || chave == 'categoria de equipamento' || chave == 'tipo') {

                let opcoes = ''

                esquemas[chave].forEach(op => {
                    opcoes += `<option ${produto?.[chave] == op ? 'selected' : ''}>${op}</option>`
                })

                conteudo = `
                <select class="opcoesSelect" onchange="alterarChave('${codigo}', '${chave}', this)">
                    ${opcoes}
                </select>
                `

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

        tbody += `<tr style="display: ${auxiliarPaginacao ? 'none' : 'table-row'}">${celulas}</tr>`;
    }

    let acumulado = `
        <div style="display: flex; gap: 10px;">
            <div style="resize: both; overflow: auto; height: max-content; max-height: 70vh; width: max-content; max-width: 92.5vw; background-color: #d2d2d2; border-radius: 3px;">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${thead}</tr>
                        <tr>${tsearch}</tr>
                    </thead>
                    <tbody id="linhasComposicoes">
                        ${tbody}
                    </tbody>
                </table>
            </div>
        </div>`;

    divComposicoes.innerHTML = acumulado;

    atribuirFuncoesCabecalho()

}

async function retomarPaginacao() {

    await carregar_tabela_v2(true)

    if (Object.keys(filtrosAtivos).length == 0) return

    try {
        let tabela = document.getElementById('tabela_composicoes')
        let thead = tabela.querySelector('thead')
        let tsearch = thead.querySelectorAll('tr')[1]
        let ths = tsearch.querySelectorAll('th')

        for (col in filtrosAtivos) {
            ths[col].querySelector('input').value = filtrosAtivos[col]
            pesquisar_generico(col, filtrosAtivos[col], filtrosAtivos, 'linhasComposicoes')
        }
    } catch {
        openPopup_v2(`Não foi possível retomar a paginação`)
    }
}

function atribuirFuncoesCabecalho() {

    // Inclusão do evento click nos cabeçalhos;
    let tabela = document.getElementById('tabela_composicoes')
    let thead = tabela.querySelector('thead')
    let trs = thead.querySelectorAll('tr')

    for (let i = 0; i <= 1; i++) {

        let tr = trs[i]
        let ths = tr.querySelectorAll('th')

        ths.forEach((th, j) => {

            if (i == 0) { // Primeiro cabeçalho
                th.addEventListener('click', function () {
                    filtrar_tabela(j, 'tabela_composicoes', this)
                })

            } else { // Segundo, com Inputs;
                th.querySelector('input').addEventListener('input', function () {
                    pesquisar_generico(j, this.value, filtrosAtivos, 'linhasComposicoes')
                })

            }
        })
    }
}

async function abrirFiltros() {

    let dados_composicoes = await recuperarDados("dados_composicoes") || {};
    let cabecalhos = [...new Set(Object.values(dados_composicoes).flatMap(obj => Object.keys(obj)))];

    let lpusCriadas = JSON.parse(localStorage.getItem("lpus_criadas")) || [];
    cabecalhos.push('editar', ...lpusCriadas);

    let acumulado = ''
    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    let colunasComposicoes = JSON.parse(localStorage.getItem('colunasComposicoes')) || {}
    let modo = modoClone ? 'clone' : 'antigos'
    if (!colunasComposicoes[modo]) {
        colunasComposicoes[modo] = []
    }

    let colunas = colunasComposicoes[modo]
    let opcoes = ''

    cabecalhos.sort() // Alfabética;
    cabecalhos.forEach(cabecalho => {
        opcoes += `
        <label>
            <input type="checkbox" value="${cabecalho}" ${colunas.includes(cabecalho) ? 'checked' : ''}> ${inicial_maiuscula(cabecalho)}
        </label>
        `
    })

    acumulado = `
        <div class="lista-filtros">
            <input placeholder="Pesquisar" oninput="filtrarColunas(this.value)">
        </div>

        <hr style="widht: 100%;">

        <div class="lista-filtros" style="margin-bottom: 5px;">
            <label>
                <input type="checkbox" onchange="marcarTodos(this)">Selecionar Todos
            </label>
        </div>

        <div id="filtrosColunas" class="lista-filtros">
            ${opcoes}
        </div>
        <button style="background-color: #4CAF50;" onclick="aplicarFiltros()">Confirmar</button>
    `

    openPopup_v2(acumulado, 'Filtrar Itens')

}

function filtrarColunas(termo) {

    termo = String(termo).toLowerCase()
    let divFiltros = document.getElementById('filtrosColunas')
    let labels = divFiltros.querySelectorAll('label')

    labels.forEach(label => {
        let texto = label.textContent.toLowerCase()
        texto.includes(termo) ? label.style.display = 'flex' : label.style.display = 'none'
    })

}

function marcarTodos(inputTodos) {

    let divFiltros = document.getElementById('filtrosColunas')
    let labels = divFiltros.querySelectorAll('label')

    labels.forEach(label => {
        let input = label.querySelector('input')
        input.checked = inputTodos.checked
    })

}

async function aplicarFiltros() {

    let colunas = []
    let divFiltros = document.getElementById('filtrosColunas')
    let labels = divFiltros.querySelectorAll('label')

    labels.forEach(label => {
        let input = label.querySelector('input')
        if (input.checked) {
            colunas.push(input.value)
        }
    })

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    let colunasComposicoes = JSON.parse(localStorage.getItem('colunasComposicoes')) || {}
    let modo = modoClone ? 'clone' : 'antigos'
    if (!colunasComposicoes[modo]) {
        colunasComposicoes[modo] = []
    }

    colunasComposicoes[modo] = colunas

    localStorage.setItem('colunasComposicoes', JSON.stringify(colunasComposicoes))
    remover_popup()

    await carregar_tabela_v2()

}

async function alterarChave(codigo, chave, select) {
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let produto = dados_composicoes[codigo]

    produto[chave] = select.value

    enviar(`dados_composicoes/${codigo}/${chave}`, select.value)

    await inserirDados(dados_composicoes, 'dados_composicoes')

    if (document.title == 'Criar Orçamento') await carregarTabelas()
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

    let ths = ''
    let campos = ['Código', 'Descrição', 'Modelo', 'Unidade', 'Tipo']

    campos.forEach((campo, i) => {
        i++
        ths += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" placeholder="${campo}" oninput="pesquisar_generico(${i}, this.value, filtroAgrupamentos, 'linhas_agrupamentos')">
            </th>
        `
    })

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
                            ${ths}
                        <tr>
                    </thead>
                    <tbody id="linhas_agrupamentos">
                        ${linhas}
                    </tbody>
                </table>


        </div>    
    `
    openPopup_v2(acumulado, 'Agrupamentos')

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

        await retomarPaginacao()
    }

    if (document.title == 'Criar Orçamento') f5()

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
            <td>${dinheiro(historico[cotacao]?.custo || 0)}</td>
            <td>${dinheiro(historico[cotacao]?.valor_custo || historico[cotacao]?.custo)}</td>
            <td style="text-align: center;">${historico[cotacao].margem}</td>
            <td>${dinheiro(historico[cotacao].valor)}</td>
            <td>${historico[cotacao].data}</td>
            <td>${historico[cotacao].usuario}</td>
            <td>${historico[cotacao].fornecedor}</td>

            <td>
                <input type="radio" name="preco" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvar_preco_ativo('${codigo}', '${cotacao}', '${tabela}')" ${marcado}>
            </td>
            
            <td><textarea style="border: none;" readOnly>${historico[cotacao]?.comentario || ''}</textarea></td>
            <td style="text-align: center;">
                <img src="imagens/cancel.png" style="width: 2vw; cursor: pointer;" onclick="excluir_cotacao('${codigo}', '${tabela}', '${cotacao}')">
            </td>
            <td style="text-align: center;">
                <img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;" onclick="adicionar_nova_cotacao('${codigo}', '${tabela}', '${cotacao}')">
            </td>
        </tr>
        `
    }

    acumulado = `

    <div style="min-width: 40vw; display: flex; justify-content: left; align-items: start; flex-direction: column; background-color: white; padding: 5px; border-radius: 5px; color: #222;">
        <div id="historico_preco" style="display: flex; flex-direction: column; align-items: start; justify-content: center; position: relative; width: 100%;">
            
            <div style="display: flex; justify-content: left; align-items: center; gap: 5px;">
                <img style="width: 7vw;" src="${dados_composicoes[codigo]?.imagem || 'https://i.imgur.com/Nb8sPs0.png'}">
                <div style="color: #222; display: flex; flex-direction: column; justify-content: start; align-items: start;">
                    <label style="font-size: 0.8vw;">Descrição</label>
                    <label>${dados_composicoes[codigo].descricao}</label>
                </div>
            </div>

            <div style="position: absolute; top: 3px; right: 3px; display: flex; align-items: start; justify-content: center; flex-direction: column;">

                <div onclick="adicionar_nova_cotacao('${codigo}', '${tabela}')" class="bot_adicionar">
                    <img src="imagens/preco.png">
                    <label>Adicionar Preço</label>
                </div>

            </div>

            <label>Histórico de Preços</label>

            <hr style="width: 100%;">

            <div id="tabela_historico" style="display: ${linhas == '' ? 'none' : 'flex'}; border-radius: 3px; padding: 3px; justify-content: center; align-items: center;">
                <table class="tabela">
                    <thead>
                        <th>Preço Unitário</th>
                        <th>Valor de Custo</th>
                        <th>Margem %</th>
                        <th>Pr. Venda</th>
                        <th>Data</th>
                        <th>Usuário</th>
                        <th>Fornecedor</th>
                        <th>Ativo</th>
                        <th>Comentário</th>
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

    openPopup_v2(acumulado, 'Valores de Venda')

}

async function salvar_preco_ativo(codigo, id_preco, lpu) {

    overlayAguarde()

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let produto = dados_composicoes[codigo]

    produto[lpu].ativo = id_preco

    let preco_atual = produto[lpu]?.historico?.[id_preco]?.valor;

    let precoFormatado = parseFloat(preco_atual).toFixed(2)

    let comentario = `O usuário ${acesso.usuario} atualizou o preço para ${precoFormatado}`

    enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, id_preco)

    await inserirDados(dados_composicoes, 'dados_composicoes')

    if (document.title == 'Criar Orçamento') total() // Caso esteja na tela de Orçamentos;

    registrarAlteracao('dados_composicoes', codigo, comentario)
    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }

    await retomarPaginacao()

}

async function excluir_cotacao(codigo, lpu, cotacao) {
    let historico_preco = document.getElementById('historico_preco');
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};

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

            let precoExcluido = cotacoes.historico?.[cotacao]?.valor
            let comentario = `O usuário ${acesso.usuario} excluiu o preço de ID: ${cotacao} e valor: ${parseFloat(precoExcluido).toFixed(2)}`
            // Remove a cotação do histórico
            delete cotacoes.historico[cotacao];

            // Atualiza o banco de dados
            await inserirDados(dados_composicoes, 'dados_composicoes');
            await deletar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`);
            registrarAlteracao('dados_composicoes', codigo, comentario)
        }

        // 🔥 Restaurar a tabela e abrir o histórico
        tabela.style.opacity = "1"; // Restaura a opacidade
        await abrir_historico_de_precos(codigo, lpu); // 🛠️ Processa o histórico antes de remover o aviso
        aviso.remove(); // Remover aviso somente após abrir_historico_de_precos
    }
}

function selecionarOrigemPorICMS(valorICMS) {
    const radioImportado = document.getElementById('importado');
    const radioNacional = document.getElementById('nacional');
    const radioBahia = document.getElementById('bahia');

    let icms = parseFloat(valorICMS);
    const ICMS_IMPORTADO = 4;
    const ICMS_NACIONAL = 20;
    const ICMS_BAHIA = 12;

    const icmsEImportado = icms === ICMS_IMPORTADO;
    if (icmsEImportado) radioImportado.checked = true;

    const icmsEDaBahia = icms === ICMS_BAHIA;
    if (icmsEDaBahia) radioBahia.checked = true;

    const icmsENacional = icms >= ICMS_NACIONAL;
    if (icmsENacional) radioNacional.checked = true;

    const icmsNacionalOuDaBahia = icms <= ICMS_BAHIA ? '12' : '20,5';
    const selectICMS = document.getElementById('icms_saida');
    if (selectICMS) selectICMS.value = icms <= ICMS_IMPORTADO ? '4' : icmsNacionalOuDaBahia;
}

function gerarTabela(titulo, campos) {
    return `
        <table class="tabela">
            <thead><th>${titulo}</th><th>Percentuais</th><th>Valor</th></thead>
            <tbody>
                ${campos.map(c => `
                    <tr>
                        <td>${c?.label}</td>
                        <td>${c?.valor ? `<input value="${c?.valor}" readOnly>` : ''}</td>
                        <td></td>
                    </tr>`).join('')}
                <tr><td></td><td>Total</td><td></td></tr>
            </tbody>
        </table>
    `;
}

async function adicionar_nova_cotacao(codigo, lpu, cotacao) {

    let historico_preco = document.getElementById('historico_preco')
    let div = historico_preco.nextElementSibling
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]
    let funcao = cotacao ? `salvar_preco('${codigo}', '${lpu}', '${cotacao}')` : `salvar_preco('${codigo}', '${lpu}')`

    let dados = {}
    if (lpu && cotacao) {
        dados = produto[lpu].historico[cotacao]
    }

    div.innerHTML = `
    <div style="color: #222; background-color: white; border-radius: 3px; padding: 5px; display: flex; justify-content: center; align-items: start; flex-direction: column;">

        <label>Gestão de Preço</label>
        <hr style="width: 100%;">
        ${gerarTabela(modelos[produto.tipo].camposIniciais, dados)}
        ${gerarTabela('Presunções', modelos[produto.tipo].presuncoes)}
        ${gerarTabela('Impostos', modelos[produto.tipo].impostos)}

    </div>`

    if (dados?.icms_creditado) {
        selecionarOrigemPorICMS(dados.icms_creditado);
    }

    calcular(produto.tipo == 'SERVIÇO' ? 'servico' : undefined)

    setTimeout(() => {
        document.getElementById('final').focus();
    }, 100);

}

async function salvar_preco(codigo, lpu, cotacao) {
    // Mostrar loader
    const loader = document.createElement('div');
    loader.innerHTML = '<div style="font-size:1.5em">Salvando preço...</div>';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    document.body.appendChild(loader);

    try {
        // 1. Verificar se o produto existe
        let dados_composicoes = await recuperarDados('dados_composicoes') || {};
        let produto = dados_composicoes[codigo];

        if (!produto) {
            return openPopup_v2('Produto não encontrado!', 'Aviso', true);
        }

        // 2. Coletar valores dos campos - DE FORMA NÃO-DESTRUTIVA
        const getValue = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : null;
        };

        const final = parseFloat(getValue('final')) || 0;
        const custo = parseFloat(getValue('custo')) || 0;
        const icms_creditado = conversor(getValue('icms_creditado')); // Coloquei um conversor para obter o número mesmo que seja float;
        const nota = getValue('nota');
        const comentario = getValue('comentario');
        const margem = parseFloat(getValue('margem')) || 0;
        const fornecedor = getValue('fornecedor');
        const valor_custo = parseFloat(document.querySelector('#valor_custo')?.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

        // 3. Validações obrigatórias
        if (final <= 0) {
            return openPopup_v2('Preço final inválido!', 'Aviso', true);
        }

        // VALIDAÇÃO DO ICMS CREDITADO (APENAS PARA PRODUTOS DE VENDA)
        if (produto.tipo === 'VENDA') {
            if (icms_creditado === null || icms_creditado === "" || isNaN(parseFloat(icms_creditado))) {
                return openPopup_v2('O campo ICMS Creditado é obrigatório! Informe um valor numérico (pode ser 0).', 'Aviso', true);
            }
        }

        // 4. Preparar objeto de histórico
        let historico = produto[lpu]?.historico || {};
        let id = cotacao || gerar_id_5_digitos();
        let comentarioAlteracao = ''
        const entradas = Object.entries(historico)

        if (entradas.length === 0) {
            comentarioAlteracao = `Preço definido para ${final.toFixed(2)}`;
        } else {
            const ordenado = entradas.sort((a, b) => new Date(b[1].data) - new Date(a[1].data));
            const ultimaEntrada = ordenado[0];

            if (ultimaEntrada[0] === id) {
                const precoAnterior = parseFloat(ultimaEntrada[1].valor);
                comentarioAlteracao = `O usuário ${acesso.usuario} alterou o preço de ${precoAnterior.toFixed(2)} para ${final.toFixed(2)}`;
            } else {
                comentarioAlteracao = `O usuário ${acesso.usuario} adicionou novo preço: ${final.toFixed(2)} `
            }
        }

        historico[id] = {
            valor: final,
            data: dt(),
            usuario: acesso.usuario,
            nota: nota || '',
            comentario: comentario || '',
            margem: margem,
            fornecedor: fornecedor || '',
            custo: custo,
            valor_custo: valor_custo
        };

        // Adicionar ICMS creditado apenas para produtos de venda
        if (produto.tipo === 'VENDA') {
            historico[id].icms_creditado = parseFloat(icms_creditado)
        } else { // Aproveitando o else para salvar infos de SERVIÇO
            historico[id].final = getValue('final')
        }

        // 5. Atualizar estrutura de dados
        produto[lpu] = produto[lpu] || { historico: {} };
        produto[lpu].historico = historico;

        // 6. Salvar no banco de dados
        await Promise.all([
            inserirDados(dados_composicoes, 'dados_composicoes'),
            enviar(`dados_composicoes/${codigo}/${lpu}/historico/${id}`, historico[id])
        ]);

        // 7. Fechar popup e recarregar
        remover_popup();
        await abrir_historico_de_precos(codigo, lpu);
        registrarAlteracao('dados_composicoes', codigo, comentarioAlteracao)

    } catch (error) {
        console.error('Erro ao salvar preço:', error);
    } finally {
        if (loader && document.body.contains(loader)) {
            document.body.removeChild(loader);
        }
    }

}

function calcular(tipo, campo) {

    let historico_preco = document.getElementById('historico_preco')
    let tabelas = historico_preco.nextElementSibling.querySelectorAll('table')

    if (tipo == 'servico') {

        let tds = tabelas[0].querySelectorAll('td') // 1ª Tabela;

        let valor_servico = conversor(Number(tds[0].querySelector('input').value))

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

        let preco_compra = conversor(Number(tds[1].querySelector('input').value))
        let frete = preco_compra * 0.02
        let icms_creditado = conversor(Number(tds[5].querySelector('input').value))
        let icms_aliquota = conversor(tds[7].querySelector('input').value)
        let difal = icms_aliquota - icms_creditado
        console.log('ICMS aliquota e creditado:', icms_aliquota, icms_creditado)
        let icms_entrada = difal / 100 * preco_compra
        let valor_custo = icms_entrada + preco_compra + frete

        tds[3].textContent = dinheiro(frete)
        tds[9].textContent = `${difal}%`
        tds[11].textContent = dinheiro(icms_entrada)
        tds[13].textContent = dinheiro(valor_custo)

        let margem = Number(tds[15].querySelector('input').value)
        let preco_venda = (1 + margem / 100) * valor_custo

        if (campo == 'final') {
            preco_venda = conversor(Number(tds[17].querySelector('input').value))
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
        let icms_saida = parseFloat(document.getElementById('icms_saida').value) / 100
        let icms = preco_venda * icms_saida

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

async function cadastrar_editar_item(codigo) {

    let colunas = ['descricao', 'fabricante', 'modelo', 'unidade', 'ncm', 'tipo', 'omie']

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    if (!modoClone) colunas.push('descricaocarrefour')

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados = dados_composicoes[codigo] || {}

    let funcao = codigo ? `salvarServidor('${codigo}')` : `salvarServidor()`
    let elementos = ''

    colunas.forEach(col => {
        let valor = codigo !== undefined ? dados?.[col] : ''
        let campo = `<input style="background-color: #a2d7a4; padding: 5px; border-radius: 3px;" value="${valor}">`

        if (col.includes('desc')) {
            campo = `
            <textarea rows="3" style="color: #222; background-color: #a2d7a4; width: 95%; border: none;">${valor}</textarea>
            `
        } else if (col == 'tipo') {

            let opcoes = ''
            esquemas.tipo.forEach(op => {
                opcoes += `<option ${op == 'VENDA' ? 'selected' : ''}>${op}</option>`
            })

            campo = `
            <div>
                <select style="width: 100%; cursor: pointer; background-color: #a2d7a4; border-radius: 3px; padding: 3px;">
                    ${opcoes}
                </select>
            </div>
            `
        }

        if (
            !col.includes('lpu')
            &&
            col !== 'codigo' &&
            col !== 'imagem' &&
            col !== 'agrupamentos' &&
            col !== 'material infra' &&
            col !== 'parceiro') {
            elementos += `
            <div style="display: flex; flex-direction: column; gap: 3px; align-items: start; justify-content: start;">
                <label>${col}</label>
                ${campo}
            </div>
            `
        }
    })

    var acumulado = `
    
    ${codigo ? `
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px; position: absolute; bottom: 5px; right: 15px; ">
        <label style="font-size: 0.7em;">${codigo}</label>
        <img src="imagens/cancel.png" style="width: 15px; cursor: pointer;" onclick="confirmar_exclusao_item('${codigo}')">
    </div>` : ''}

    <div id="cadastrar_item" style="width: 30vw; background-color: white; color: #222; padding: 5px; border-radius: 5px; margin: 1vw;">

        <div id="elementos">
            ${elementos}
        </div>

        <br>

        <button style="background-color: #4CAF50; margin: 0px;" onclick="${funcao}">Salvar</buttton>
    </div>
    `
    openPopup_v2(acumulado, 'Dados do Item')
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

        let comentario = `O item ${codigo}, descrição ${dados_composicoes[codigo].descricao} foi excluído`
        registrarAlteracao('dados_composicao', codigo, comentario)

        delete dados_composicoes[codigo]

        deletar(`dados_composicoes/${codigo}`)
        await inserirDados(dados_composicoes, 'dados_composicoes')
        remover_popup()
        await retomarPaginacao()
    }

}

async function salvarServidor(codigo) {
    let novoCadastro = false
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};

    overlayAguarde()
    let comentario = ''
    let descricaoProduto = ''

    if (!codigo) {
        novoCadastro = true

        let resposta = await verificarCodigoExistente();

        if (resposta.status == 'Falha') {
            let mensagem = `
            <div id="aviso_campo_branco" style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Não foi possível cadastrar o item... tente novamente</label>
            </div>
            `
            return openPopup_v2(mensagem, 'Aviso')
        }

        codigo = resposta.status // Aqui é retornado o último número sequencial +1 para cadasto;
    }

    if (!dados_composicoes[codigo]) dados_composicoes[codigo] = {};

    let elementos = document.getElementById('elementos')
    let dadosAtualizados = {};
    let divs = elementos.querySelectorAll('div');

    divs.forEach(div => {
        let item = div.querySelector('label');
        let valor = div.querySelector('input') || div.querySelector('textarea') || div.querySelector('select');

        if (item && valor) dadosAtualizados[item.textContent] = valor.value;

    });

    descricaoProduto = dadosAtualizados.descricao

    if (novoCadastro) {
        comentario = `Produto cadastrado com código ${codigo} e descrição: ${descricaoProduto}`
    } else {
        comentario = `Produto alterado com código ${codigo} e descrição: ${descricaoProduto}`
    }

    remover_popup();

    dadosAtualizados.codigo = codigo;

    dados_composicoes[codigo] = { ...dados_composicoes[codigo], ...dadosAtualizados };

    await inserirDados(dados_composicoes, 'dados_composicoes');
    await retomarPaginacao()

    await enviar(`dados_composicoes/${codigo}`, dados_composicoes[codigo]);
    registrarAlteracao('dados_composicoes', codigo, comentario)

}

async function verificarCodigoExistente() {
    return new Promise((resolve, reject) => {

        let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false

        fetch("https://leonny.dev.br/codigo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clone: modoClone })
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

function salvarNovaLPU() {
    let inputLPU = document.getElementById("nome-lpu");
    let nomeLPU = inputLPU.value.trim();
    let texto_aviso = document.getElementById("texto-aviso")

    if (nomeLPU === "") {
        return openPopup_v2('Digite um nome válido para a LPU!', 'Aviso', true);
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

async function para_excel() {
  const tabela = document.getElementById('tabela_composicoes');
  if (!tabela) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Preços');

  const trs = tabela.querySelectorAll('tr');

  for (let rowIndex = 0; rowIndex < trs.length; rowIndex++) {
    const tr = trs[rowIndex];
    const tds = tr.querySelectorAll('td, th');
    let row = [];

    for (let colIndex = 0; colIndex < tds.length; colIndex++) {
      const td = tds[colIndex];
      const img = td.querySelector('img');

      if (img) {
        try {
          const response = await fetch(img.src);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();

          const extension = img.src.includes('.png') ? 'png' : 'jpeg';
          const imageId = workbook.addImage({
            buffer: arrayBuffer,
            extension: extension
          });

          worksheet.addImage(imageId, {
            tl: { col: colIndex, row: rowIndex },
            ext: { width: img.width || 100, height: img.height || 100 }
          });

          row.push(null);
        } catch (e) {
          row.push(''); // imagem ignorada silenciosamente
        }
      } else {
        row.push(td.textContent);
      }
    }

    worksheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'lpu-com-imagens.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

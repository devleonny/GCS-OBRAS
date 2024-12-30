var dados = {}
var filtrosAtivos = {};
var composicoes_ = document.getElementById('composicoes_')
var overlay = document.getElementById('overlay')
var acesso = JSON.parse(localStorage.getItem('acesso')) || {}

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

function carregar_tabela_v2(col, ordem) {
    setTimeout(async function () {
        var dados_composicoes = await recuperarDados('dados_composicoes') || {};
        var thead = '';
        var tbody = '';
        var tsearch = '';
        var painel_colunas = '';

        var cabecalhos = [
            ...new Set(
                Object.values(dados_composicoes).flatMap(obj => Object.keys(obj))
            )
        ];
        cabecalhos.push('editar');

        var pc = document.getElementById('pc');
        var colunas = JSON.parse(localStorage.getItem('colunas_composicoes')) || [];

        if (acesso.permissao == 'adm') {
            var adicionar_item = document.getElementById('adicionar_item');
            if (adicionar_item) {
                adicionar_item.style.display = 'flex';
            }
        }

        if (pc) {
            var inputs = pc.querySelectorAll('input');
            var labels = pc.querySelectorAll('label');
            var coluna_anterior = colunas
            colunas = [];

            inputs.forEach((input, i) => {
                if (input.checked) {
                    colunas.push(labels[i].textContent.toLowerCase());
                } else {
                    colunas.splice(i, 1);
                }
            });

            colunas = [...new Set(colunas)];
            colunas.sort((a, b) => a - b); // Ordem Crescente

            if (colunas !== coluna_anterior) {
                filtrosAtivos = {};
            }
            localStorage.setItem('colunas_composicoes', JSON.stringify(colunas));
        }

        composicoes_.innerHTML = '';

        var ths = {};
        var tsc = {};

        cabecalhos.forEach(cab => {
            ths[cab] = `
            <th>
            <div class="contorno_botoes" style="background-color: #B12425; display: flex; align-items: center; justify-content: center; gap: 3px;">

                <label style="font-size: 0.7em;">${cab.toUpperCase()}</label>

                <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                    <img src="/imagens/a.png" style="width: 15px; cursor: pointer;" onclick="carregar_tabela_v2('${cab}', 'a')">
                    <img src="/imagens/z.png" style="width: 15px; cursor: pointer;" onclick="carregar_tabela_v2('${cab}', 'b')">
                </div>
            </div>
            </th>`;
            tsc[cab] = `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="/imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" placeholder="..." oninput="pesquisar_em_composicoes(this)">
            </th>`;
            painel_colunas += `
            <div style="display: flex; gap: 10px; align-items: center; justify-content: right; text-align: right;">
                <label style="color: white;">${cab.toUpperCase()}</label>
                <input type="checkbox" style="cursor: pointer;" onchange="carregar_tabela_v2()" ${colunas.includes(cab) ? 'checked' : ''}>
            </div>`;
        });

        colunas.forEach(col => {
            thead += ths[col];
            tsearch += tsc[col];
        });

        var dadosOrdenados = Object.entries(dados_composicoes);

        if (col && ordem) {
            dadosOrdenados = dadosOrdenados.filter(([_, item]) => {
                var val = item[col] || '';

                if (dicionario(val)) {
                    val = val.historico?.[val.ativo]?.custo || 0;
                }

                return val !== 0 && val !== '';
            });

            dadosOrdenados.sort(([_, a], [__, b]) => {
                var valA = a[col] || '';
                var valB = b[col] || '';

                if (col.includes('lpu')) {

                    if (dicionario(valA)) {
                        valA = valA.historico[valA.ativo].valor
                    }

                    if (dicionario(valB)) {
                        valB = valB.historico[valB.ativo].valor
                    }

                    return ordem === 'a' ? valA - valB : valB - valA;
                } else { // Ordenar como texto
                    return ordem === 'a' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }
            });
        }

        for (const [codigo, produto] of dadosOrdenados) {
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

            tds.editar = `<td style="width: 70px;"><img src="/imagens/editar.png" style="width: 30px; cursor: pointer;" onclick="cadastrar_editar_item('${codigo}')"></td>`;

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
            <div style="padding: 10px; overflow: auto; height: 600px; width:70vw; background-color: #222222bf; border-radius: 3px;">
                <table style="border-collapse: collapse;">
                    <thead>${thead}</thead>
                    <thead id="tsearch">${tsearch}</thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>
        </div>`;
        composicoes_.innerHTML = acumulado;
    }, 200);
}

async function atualizar_status_material(codigo, elemento) {

    var resposta = elemento.checked
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    dados_composicoes[codigo]['material infra'] = resposta
    inserirDados(dados_composicoes, 'dados_composicoes')

    var dados = {
        tabela: 'composicoes',
        campo: 'material infra',
        codigo: codigo,
        info: resposta
    }

    enviar_dados_generico(dados)

    carregar_tabela_v2()

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

    overlay.style.display = 'block'
    var linhas = ''

    var imagem = 'https://i.imgur.com/Nb8sPs0.png'
    if (dados_composicoes[codigo].imagem && dados_composicoes[codigo].imagem !== '') {
        imagem = dados_composicoes[codigo].imagem
    }

    for (cotacao in historico) {
        dados_composicoes[codigo][tabela].ativo == cotacao ? marcado = 'checked' : marcado = ''

        linhas += `
        <tr>
            <td>${dinheiro(historico[cotacao].custo)}</td>
            <td>${historico[cotacao].lucro}</td>
            <td>${dinheiro(historico[cotacao].valor)}</td>
            <td>${historico[cotacao].data}</td>
            <td>${historico[cotacao].usuario}</td>
            <td>${historico[cotacao].fornecedor}</td>
            <td><img src="/imagens/editar.png" style="width: 30px; cursor: pointer;"></td>
            <td><img src="/imagens/excluir.png" style="width: 30px; cursor: pointer;"></td>
            <td><input type="checkbox" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvar_preco_ativo('${codigo}', '${cotacao}', '${tabela}')" ${marcado}></td>
        </tr>
        `
    }

    acumulado = `
    <div id="historico_preco" class="retangulo_glass" style="display: block;">
        <span class="close" onclick="remover_divs('historico_preco')">&times;</span>

        <div style="display: flex; justify-content: space-evenly; width: 100%; gap: 10px; align-items: center; margin: ">
            <img src="${imagem}" style="width: 100px;">
            <h2 style="white-space: normal;">${dados_composicoes[codigo].descricao}</h2>
        </div>

        <div style="background-color: #222; border-radius: 3px; padding: 3px;">
            <table class="tabela">
                <thead>
                    <th>Valor da Cotação</th>
                    <th>% Lucro</th>
                    <th>Valor Final</th>
                    <th>Data da Cotação</th>
                    <th>Feita por</th>
                    <th>Fornecedor</th>
                    <th>Editar</th>
                    <th>Excluir</th>
                    <th>Ativo</th>
                </thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>
        <label class="incluir" onclick="adicionar_nova_cotacao('${codigo}', '${tabela}')">Incluir uma nova cotação</label>
    </div>
    `

    var historico_preco = document.getElementById('historico_preco')
    if (historico_preco) {
        historico_preco.remove()
    }

    document.body.insertAdjacentHTML('beforeend', acumulado)

}

function adicionar_nova_cotacao(codigo, lpu) {
    var historico_preco = document.getElementById('historico_preco')
    if (historico_preco) {
        var tabela = historico_preco.querySelector('table')
        var tbody = tabela.querySelector('tbody')

        var linha = `
        <td><input type="number" oninput="calcular()"></td>
        <td><input type="number" oninput="calcular()"></td>
        <td>R$ 0,00 </td>
        <td>${data_atual('completa')}</td>
        <td>${acesso.usuario}</td>
        <td><input></td>
        <td><img src="/imagens/concluido.png" onclick="salvar_cotacao('${codigo}', '${lpu}')" style="width: 30px; cursor: pointer;"></td>
        <td><img src="/imagens/excluir.png" style="width: 30px; cursor: pointer;"></td>
        `
        tbody.insertAdjacentHTML('beforeend', linha)
    }
}

function remover_divs(elemento) {
    var elemento_div = document.getElementById(elemento)
    if (elemento_div) {
        elemento_div.remove()
    }
    overlay.style.display = 'none'
}

async function atualizar() {

    carregamento('composicoes_')
    await recuperar_dados_composicoes()

    carregar_tabela_v2()

}

async function salvar_preco_ativo(codigo, id_preco, lpu) {
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var produto = dados_composicoes[codigo]
    var historico_preco = document.getElementById('historico_preco')

    if (historico_preco) {
        var tabela = historico_preco.querySelector('table')
        var tbody = tabela.querySelector('tbody')
        var trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td')
            var checkbox = tds[8].querySelector('input')

            if (checkbox.checked) {
                produto[lpu].ativo = id_preco
                inserirDados(dados_composicoes, 'dados_composicoes')

                var requisicao = {
                    tabela: 'composicoes',
                    composicao: produto
                }

                enviar_dados_generico(requisicao)

                historico_preco.remove()
                carregar_tabela_v2()
                return abrir_historico_de_precos(codigo, lpu)
            }
        })
    }

}

async function salvar_cotacao(codigo, lpu) {
    var historico_preco = document.getElementById('historico_preco')
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var produto = dados_composicoes[codigo]

    if (historico_preco) {
        var tabela = historico_preco.querySelector('table')
        var tbody = tabela.querySelector('tbody')
        var trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {
            var inputs = tr.querySelectorAll('input')
            var tds = tr.querySelectorAll('td')

            if (inputs.length > 1) {

                var dados = {
                    custo: conversor(inputs[0].value),
                    lucro: inputs[1].value,
                    valor: conversor(tds[2].textContent),
                    data: tds[3].textContent,
                    usuario: acesso.usuario,
                    fornecedor: inputs[2].value,
                }

                if (!dicionario(produto[lpu]) || !produto[lpu]) {
                    produto[lpu] = {};
                }

                if (!produto[lpu].historico) {
                    produto[lpu].historico = {};
                }

                var id = gerarNumeroAleatorio()

                produto[lpu].historico[id] = dados

                var requisicao = {
                    tabela: 'composicoes',
                    composicao: produto
                }

                enviar_dados_generico(requisicao)

                inserirDados(dados_composicoes, 'dados_composicoes')

            }

        })

        carregar_tabela_v2()
        return abrir_historico_de_precos(codigo, lpu)

    }
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
                var lucro = Number(inputs[1].value)

                tds[2].textContent = dinheiro(custo * (1 + (lucro / 100)))
            }
        })
    }

}

async function cadastrar_editar_item(codigo) {

    var tem_codigo = ''
    if (codigo !== undefined) {
        tem_codigo = `'${codigo}'`
    }

    overlay.style.display = 'block'

    var colunas = ['descricao', 'descricaocarrefour', 'substituto', 'sapid', 'refid', 'fabricante', 'modelo', 'unidade', 'ncm', 'tipo', 'omie']

    if (codigo !== undefined) {
        var dados_composicoes = await recuperarDados('dados_composicoes') || {}
        var dados = dados_composicoes[codigo]
        colunas = Object.keys(dados)
    }

    var elementos = ''

    colunas.forEach(col => {
        var valor = ''
        if (codigo !== undefined) {
            valor = dados[col]
        }

        var campo = ''

        if (col.includes('desc')) {
            campo = `
            <textarea placeholder="${col}" style="width: 100%;">${valor}</textarea>
            `
        } else if (col == 'tipo') {
            campo = `
            <select>
                <option>VENDA</option>
                <option>SERVIÇO</option>
            </select>
            `
        } else {
            campo = `
            <input placeholder="${col}" value="${valor}">
            `
        }

        if (!col.includes('lpu') && col !== 'codigo' && col !== 'imagem') {
            elementos += `
            <div style="display: flex; gap: 10px; align-items: center; justify-content: right;">
                <label>${col}</label>
                ${campo}
            </div>
            `
        }
    })

    var acumulado = `

    <div id="cadastrar_item" class="retangulo_glass" style="display: block; height: 80vh; overflow-y: auto;">
        <span class="close" onclick="remover_divs('cadastrar_item')">&times;</span>

        <div style="display: flex; justify-content: space-evenly; width: 100%;">
            <h2>Dados do Item</h2>
        </div>
        <div id="elementos" style="display: flex; flex-direction: column; gap: 10px;">
        ${elementos}
        </div>
        <div id="nova_lpu" style="margin: 10px; display: flex; gap: 10px; align-items: center; justify-content: right; border-radius: 3px; padding: 10px; background-color: #222; color: white;">
            <label>Começar uma nova LPU?</label>
            <input placeholder="Nome">
        </div>
        <button style="background-color: green;" onclick="cadastrar_alterar(${tem_codigo})">Salvar</buttton>
    </div>
    `

    document.body.insertAdjacentHTML('beforeEnd', acumulado)
}


async function cadastrar_alterar(codigo) {

    var elementos = document.getElementById('elementos')
    var nova_lpu = document.getElementById('nova_lpu')
    var produto;
    var cadastrar = false
    if (codigo == undefined) {
        cadastrar = true
    }

    if (elementos) {

        var dados_composicoes = await recuperarDados('dados_composicoes') || {}
        produto = dados_composicoes[codigo] || {}

        var divs = elementos.querySelectorAll('div')

        divs.forEach(div => {

            var item = div.querySelector('label')
            var valor = div.querySelector('input') || div.querySelector('textarea') || div.querySelector('select')

            if (item && valor) {
                produto[item.textContent] = valor.value
            }

        })

        inserirDados(dados_composicoes, 'dados_composicoes')

        if (nova_lpu) {
            var input_lpu = nova_lpu.querySelector('input')
            if (input_lpu.value !== '') {
                produto[`lpu ${input_lpu.value}`] = ''
            }
        }

        var requisicao = {
            tabela: 'composicoes',
            composicao: produto
        }

        if (cadastrar) {
            requisicao.operacao = 'cadastrar'
        }

        enviar_dados_generico(requisicao)

        remover_divs('cadastrar_item')
        carregar_tabela_v2()
    }
}
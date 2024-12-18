var status_deste_modulo = [];
var modulo = localStorage.getItem('modulo_ativo') || ''
var filtrosAtivos = {};
var filtrosAtivosPagamentos = {};
var botao_status_ativo = ''
var anexos_pagamentos = {};
var anx_parceiros = {};
var intervaloCompleto;
var intervaloCurto;

if (document.title == 'ORÇAMENTOS') {

    document.addEventListener('DOMContentLoaded', function () {
        const switchInput = document.getElementById('switch');
        const switchLabel = document.querySelector('.switch-x-checked');

        const savedStatus = localStorage.getItem('mostrar_orcamentos_proprios');

        if (savedStatus !== null) {
            switchInput.checked = (savedStatus === 'Sim');
            switchLabel.innerText = savedStatus;
        } else {
            localStorage.setItem('mostrar_orcamentos_proprios', switchInput.checked ? 'Sim' : 'Não');
        }

        switchInput.addEventListener('change', function () {
            const isChecked = switchInput.checked;

            if (isChecked) {
                switchLabel.innerText = 'Sim';
            } else {
                switchLabel.innerText = 'Não';
            }
            localStorage.setItem('mostrar_orcamentos_proprios', isChecked ? 'Sim' : 'Não');

            preencher_dados_orcamentos_v2()
        });
    });

    /*
    recuperar_orcamentos()
    preencher_dados_orcamentos_v2()
    obter_lista_pagamentos()
    recuperar()
    */
}

async function atualizar_especial() {

    recuperar()
    await recuperar_orcamentos()
    await obter_lista_pagamentos()

}

function gerar_menu(status, quantidade) {

    return `
    <div class="block" onclick="preencher_dados_orcamentos_v2('${status}')">
        <label>${quantidade}</label>
        <p>${status}</p>
    </div>
    `
}

function pesquisar_v2(coluna, texto) {

    filtrosAtivos[coluna] = texto.toLowerCase();

    var tabela_itens = document.getElementById('orcamentos');
    var trs = tabela_itens.querySelectorAll('tr');

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');
        var mostrarLinha = true;

        for (var col in filtrosAtivos) {
            var filtroTexto = filtrosAtivos[col];

            if (filtroTexto && col < tds.length) {
                var conteudoCelula = tds[col].textContent.toLowerCase();

                if (!conteudoCelula.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        tr.style.display = mostrarLinha ? '' : 'none';
    });
}

preencher_orcamentos_v2()

function preencher_orcamentos_v2() {

    var div_orcamentos = document.getElementById('orcamentos')

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
    var mostrar_orcamentos_proprios = localStorage.getItem('mostrar_orcamentos_proprios') || 'Não'
    document.getElementById('nome_modulo').textContent = modulo

    // Organizar por data de edição;
    var desordenado = Object.entries(dados_orcamentos);
    desordenado.sort((a, b) => new Date(b[1].dados_orcam.data) - new Date(a[1].dados_orcam.data));
    dados_orcamentos = Object.fromEntries(desordenado);

    if (div_orcamentos) {

        var linhas = ''
        var status_deste_modulo = {}

        for (orcamento in dados_orcamentos) {

            var orc = dados_orcamentos[orcamento]
            var dados_orcam = orc.dados_orcam
            var data = new Date(dados_orcam.data).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            })

            if (orc.operacao && orc.operacao == 'excluido') {
                return
            }

            var exibir_linha = false
            var pedidos = orc.status || {}

            for (pedido in pedidos) {
                var status = pedidos[pedido].status

                if (fluxograma[status]) {

                    if (!status_deste_modulo[status]) {
                        status_deste_modulo[status] = 0
                    }
                    status_deste_modulo[status] += 1
                }
            }

            if (Object.keys(pedidos).length == 0) {

                if (!status_deste_modulo['AGUARDANDO']) {
                    status_deste_modulo['AGUARDANDO'] = 0
                }

                status_deste_modulo['AGUARDANDO'] += 1

            }

            for (mod in status_deste_modulo) {

                var modulos = fluxograma[mod].modulos
                if (modulos.includes(modulo)) {
                    exibir_linha = true
                }
            }

            if (exibir_linha) {
                linhas += `
                <tr class="linha_destacada">
                    <td>${data}</td>
                    <td><div></div></td>
                    <td><div></div></td>
                    <td>${dados_orcam.contrato}</td>
                    <td>${dados_orcam.cliente_selecionado}</td>
                    <td>${dados_orcam.cidade}</td>
                    <td>${dados_orcam.analista}</td>
                    <td style="white-space: nowrap;">${orc.total_geral}</td>
                    <td style="white-space: nowrap;">${orc.lpu_ativa}</td>
                    <td style="text-align: center;" onclick="exibir_todos_os_status('${orcamento}')">
                        <img src="imagens/pesquisar2.png" style="width: 20px; height: 20px;">
                    </td>
                </tr>
            `
            }
        }

        var painel_direito = document.getElementById('painel_direito')
        if (painel_direito) {
            var atalhos = ''
            for (atalho in status_deste_modulo) {
                var quantidade = status_deste_modulo[atalho]
                atalhos += gerar_menu(atalho, quantidade)
            }
            painel_direito.innerHTML = atalhos
        }

        var cabecs = ['Última alteração', 'Pedido', 'Notas', 'Chamado', 'Cliente', 'Cidade', 'Analista', 'Valor', 'LPU', 'Status & Ações']
        var ths = ''
        var tsh = ''
        cabecs.forEach((cab, i) => {

            ths += `
            <th>${cab}</th>
            `
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <img src="imagens/pesquisar2.png" style="position: absolute; left: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                    <input placeholder="${cab}" style="margin-left: 25px; text-align: left;" oninput="pesquisar_v2(${i}, this.value)">
                </div>
            </th>            
            `
        })

        var tabela = `
            <table id="orcamentos_" class="tabela">
                <thead>
                    ${ths}
                </thead>
                <thead>
                    ${tsh}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        `
        div_orcamentos.insertAdjacentHTML('beforeend', tabela)
    }

}

async function recuperar_orcamentos() {

    var orcamentos = document.getElementById('orcamentos')
    if (orcamentos) {
        carregamento('orcamentos')
    }

    return new Promise((resolve, reject) => {

        var url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=orcamentos';

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao carregar os dados');
                }
                return response.json();
            })
            .then(data => {

                localStorage.setItem('dados_orcamentos', JSON.stringify(data));

                if (document.title == 'ORÇAMENTOS') {

                    var inputs_ativos = {}

                    var tabela = document.getElementById('orcamento_')
                    var theads;
                    var inputs;
                    if (tabela) {
                        theads = tabela.querySelectorAll('thead')
                        inputs = theads[1].querySelectorAll('input')

                        inputs.forEach((input, i) => {
                            inputs_ativos[i] = input.value
                        })
                    }

                    preencher_dados_orcamentos_v2(botao_status_ativo)

                    Object.keys(inputs_ativos).forEach(i => {
                        inputs[i].value = inputs_ativos[i]
                        pesquisar_v2(i, inputs_ativos[i])
                    })

                }

            })
            .then(() => {
                resolve();
            })
            .catch(error => {
                console.error('Ocorreu um erro:', error);
                reject(error);
            });
    });
}

async function rir(id_orcam) {

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos'));
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    var orcamento = dados_orcamentos[id_orcam];

    orcamento = conversor_composicoes_orcamento(orcamento)

    var estado = orcamento.dados_orcam.estado;
    var icms = estado == 'BA' ? 0.205 : 0.12;

    var dados = {
        'SERVIÇO': [],
        'VENDA': []
    };

    var itens = orcamento.dados_composicoes

    Object.keys(itens).forEach(it => {
        var item = itens[it]

        item.descricao_carrefour = dados_composicoes[item.codigo].descricaocarrefour
        if (dados_composicoes[item.codigo].substituto !== '') {
            var substituto = dados_composicoes[item.codigo].substituto
            item.descricao_carrefour = dados_composicoes[substituto].descricaocarrefour
        }

        item.tipo = dados_composicoes[item.codigo].tipo
        item.descricao = dados_composicoes[item.codigo].descricao
        item.custo = 0

        if (dados_composicoes[item.codigo]['lpu carrefour']) {
            var ativo = dados_composicoes[item.codigo]['lpu carrefour'].ativo
            var historico = dados_composicoes[item.codigo]['lpu carrefour'].historico
            item.custo = historico[ativo].valor
        }

        var custo_sem_icms = item.custo - (icms * item.custo)
        var total_sem_icms = conversor(item.qtde) * custo_sem_icms
        var total = item.custo * conversor(item.qtde)

        if (item.tipo == 'VENDA') {
            dados[item.tipo].push([
                item.codigo,
                item.descricao_carrefour,
                item.descricao,
                item.tipo,
                item.qtde,
                custo_sem_icms,
                total_sem_icms,
                item.custo,
                total
            ])
        } else {
            dados[item.tipo].push([
                item.codigo,
                item.descricao_carrefour,
                item.descricao,
                item.tipo,
                item.qtde,
                item.custo,
                total
            ])
        }

    })

    var nome_arquivo = `RELAÇÃO ITENS REAIS - ${orcamento.dados_orcam.cliente_selecionado} - ${orcamento.dados_orcam.contrato}`;

    rir_excel(dados, nome_arquivo);
}

function editar(orcam_) {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

    var orcamento_v2 = dados_orcamentos[orcam_]

    orcamento_v2 = conversor_composicoes_orcamento(orcamento_v2)

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    window.location.href = 'adicionar.html'

}

function duplicar(orcam_) {
    let dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos'))
    let acesso = JSON.parse(localStorage.getItem('acesso'))

    var orcamento_v2 = dados_orcamentos[orcam_]

    orcamento_v2 = conversor_composicoes_orcamento(orcamento_v2)

    delete orcamento_v2.id

    orcamento_v2.dados_orcam.contrato = ''
    orcamento_v2.dados_orcam.analista = acesso.nome_completo
    orcamento_v2.dados_orcam.email_analista = acesso.email
    orcamento_v2.dados_orcam.telefone_analista = acesso.telefone

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    window.location.href = 'adicionar.html'
}

function salvar_dados_em_excel() {
    var tabela = orcamento_.querySelectorAll('tr');
    var dados = [];

    // Processa o cabeçalho (primeira linha da tabela)
    var cabecalho = tabela[0].querySelectorAll('th');
    var linhaCabecalho = [];
    cabecalho.forEach(th => {
        linhaCabecalho.push(th.textContent);
    });

    dados.push(linhaCabecalho); // Adiciona o cabeçalho ao array 'dados'

    // Processa o restante das linhas (linhas com dados)
    tabela.forEach((tr, index) => {
        if (index === 0) return; // Ignora o cabeçalho

        var tds = tr.querySelectorAll('td');
        var linha = [];
        tds.forEach(td => {
            linha.push(td.textContent);
        });

        dados.push(linha); // Adiciona a linha de dados ao array 'dados'
    });

    // Gera o arquivo Excel com ExcelJS
    var workbook = new ExcelJS.Workbook();
    var worksheet = workbook.addWorksheet('Orcamento');

    // Adiciona os dados ao worksheet
    dados.forEach((linha, index) => {
        worksheet.addRow(linha);
    });

    // Define a largura automática para as colunas
    worksheet.columns.forEach(column => {
        var maxLength = 0;
        column.eachCell({ includeEmpty: true }, function (cell) {
            var columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 10 : 20;
    });

    workbook.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'dados_orcamento.xlsx');
    });
}


async function criar_pagamento_v2(chave1) {

    if (!await calculadora_pagamento()) {

        var cc = document.getElementById('cc')

        if (cc) {

            var elemento = cc.value

            var cod = elemento.match(/\[(\d+)\]$/)[1];

            chave1 = centros_de_custo[cod].key_pedido
            id_orcam = centros_de_custo[cod].key_orc

        }

        var id_pagamento = unicoID()
        var dados_categorias = JSON.parse(localStorage.getItem('dados_categorias'))
        var dados_clientes = await recuperarDados('dados_clientes') || {};
        var acesso = JSON.parse(localStorage.getItem('acesso'))

        var total = document.getElementById('total_de_pagamento').textContent

        var cliente = document.getElementById('cliente_pagamento')
        var chave_pix = document.getElementById('pix').value

        //Categorias
        var valores = central_categorias.querySelectorAll('input[type="number"]');
        var categorias = central_categorias.querySelectorAll('input[type="text"]');
        var rateio_categorias = [];
        var categorias_acumuladas = {};
        var parceiro = ''
        valores.forEach(function (valor, i) {

            if (categorias[i].value == 'Pagamento de Parceiros' || categorias[i].value == 'Adiantamento de Parceiros') {
                parceiro = categorias[i].value
            }

            var codigo_categoria = dados_categorias[categorias[i].value];
            var valor_atual = parseFloat(valor.value);

            if (categorias_acumuladas[codigo_categoria]) {
                categorias_acumuladas[codigo_categoria] += valor_atual;
            } else {
                categorias_acumuladas[codigo_categoria] = valor_atual;
            }
        });

        for (var codigo_categoria in categorias_acumuladas) {
            rateio_categorias.push({
                'codigo_categoria': codigo_categoria,
                'valor': categorias_acumuladas[codigo_categoria]
            });
        }

        var descky = `
        Solicitante: ${acesso.usuario}
        \n
        `
        descky += document.getElementById('descricao_pagamento').value

        var regex_cliente = regex = /\[(.*?)\]/;
        var cnpj_string = String(cliente.value).match(regex_cliente)[1]

        var param = [
            {
                "codigo_cliente_fornecedor": dados_clientes[cnpj_string].omie,
                "codigo_barras_ficha_compensacao": chave_pix,
                "valor_documento": conversor(total),
                "observacao": descky,
                "codigo_lancamento_integracao": id_pagamento,
                "data_vencimento": data_atual('curta', parceiro),
                "categorias": rateio_categorias,
                "data_previsao": data_atual('curta', parceiro),
                "id_conta_corrente": '6054234828', // Itaú AC
                "distribuicao": []
            }
        ]

        var acesso = JSON.parse(localStorage.getItem('acesso')) || {}

        var depart = ''
        if (chave1 == '') {
            depart = id_orcam
        }

        var pagamento = {
            'id_pagamento': id_pagamento,
            'id_pedido': chave1,
            'id_orcamento': id_orcam,
            'departamento': depart,
            'data_registro': data_atual('completa'),
            'anexos': anexos_pagamentos,
            'anexos_parceiros': anx_parceiros,
            'criado': acesso.usuario,
            'status': 'Pagamento salvo localmente',
            param
        }

        var v_orcado = document.getElementById('v_orcado')
        if (v_orcado) {
            var v_pago = document.getElementById('v_pago')
            pagamento.resumo = {
                v_pago: v_pago.textContent,
                v_orcado: v_orcado.value,
            }
        }

        var dados = {
            'tabela': 'lista_pagamentos',
            'operacao': 'incluir',
            pagamento,
        }

        enviar_lista_pagamentos(dados)

        remover_popup()

        var pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos'))

        pagamentos[pagamento.id_pagamento] = pagamento

        localStorage.setItem('lista_pagamentos', JSON.stringify(pagamentos))

        openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="imagens/concluido.png" style="width: 3vw; height: 3vw;">
                <label>Pagamento Solicitado</label>
            </div>                
        `);

        anexos_pagamentos = {}
        anx_parceiros = {}

        var esquema = document.getElementById('esquema')
        if (esquema) {
            fechar_esquema()
            abrir_esquema(id_orcam)
        }

        if (document.title == 'PAGAMENTOS') {
            consultar_pagamentos()
        }

    }

}

function criar_datalist(nome_base) {

    var opcoes = ''
    var base = {}
    var elementos = []

    base = JSON.parse(localStorage.getItem('dados_' + nome_base))
    elementos = Object.keys(base)

    elementos.forEach(item => {
        opcoes += `
        <option>${item}</option>
        `
    })

    return opcoes
}

function encerrarIntervalos() {
    clearInterval(intervaloCompleto);
    clearInterval(intervaloCurto);
}

async function atualizar_departamentos() {

    var departamentos = document.getElementById('departamentos')
    var aguarde = document.getElementById('aguarde')

    departamentos.style.display = 'none'
    aguarde.style.display = 'flex'

    await obter_departamentos_fixos()

    var centro_de_custo = document.getElementById('centro_de_custo')
    if (centro_de_custo) {
        carregar_opcoes(opcoes_centro_de_custo(), 'cc', 'cc_sugestoes') // Carregar os centros de custo;
    }

    departamentos.style.display = 'flex'
    aguarde.style.display = 'none'

}

var ordem = 0
function ordenar() {
    ordem++
    return ordem
}

async function tela_pagamento(chave1) {

    ordem = 0

    overlay.style.display = 'block'

    anexos_pagamentos = {}

    intervaloCompleto = setInterval(function () {
        document.getElementById('tempo').textContent = data_atual('completa');
    }, 1000);

    intervaloCurto = setInterval(function () {
        document.getElementById('tempo_real').textContent = data_atual('curta');
    }, 1000);

    var datalist = ''
    if (chave1 == undefined) {

        datalist += `
        <div class="ordem">

            <label id="cc_numero" class="numero">${ordenar()}</label>

            <div class="itens_financeiro" id="departamentos">
                <label>Centro de Custo</label>

                <div class="autocomplete-container">
                    <textarea style="width: 80%;" type="text" class="autocomplete-input" id="cc"
                        placeholder="42017... ou D7777 ou SAM'S... ou LOGÍSTICA..."></textarea>
                    <div class="autocomplete-list" id="cc_sugestoes"></div>
                </div>

                <div onclick="atualizar_departamentos()" class="botoes_financeiro">
                    <img src="imagens/atualizar_2.png" style="width: 30px;">
                </div>
            </div>

            <div id="aguarde" style="display: none; width: 100%; align-items: center; justify-content: center; gap: 10px;">
                <img src="gifs/loading.gif" style="width: 5vw">
                <label>Aguarde...</label>
            </div>
        </div>
        `
    }

    var acumulado = `
    <div class="pagamento">
        <h2>Solicitação de Pagamento</h2>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: left; gap: 5px; fontsize: 0.8vw;">

            <div style="display: flex; flex-direction: column; align-items: baseline; justify-content: center; width: 100%;">
                <label>• Após às <strong>11h</strong> será lançado no dia útil seguinte;</label>
                <label>• Maior que <strong>R$ 500,00</strong> passa por aprovação;</label>
                <label style="text-align: left;">• Pagamento de parceiro deve ser lançado até dia <strong>5</strong> de cada mês,
                <br> e será pago dia <strong>10</strong> de cada mês;</label>
                <label>• Adiantamento de parceiro, o pagamento ocorre em até 8 dias.</label>
            </div>

            <img src="gifs/baixo.gif" style="width: 2vw;">

            <div class="central_categorias">

                ${datalist}

                <div class="ordem">
                    <label id="recebedor_numero" class="numero">${ordenar()}</label>

                    <div class="itens_financeiro" id="div_recebedor">
                        <label>Recebedor</label>

                        <div class="autocomplete-container">
                            <textarea style="width: 80%;" oninput="calculadora_pagamento()" type="text" class="autocomplete-input" id="cliente_pagamento"
                                placeholder="Quem receberá?"></textarea>
                            <div class="autocomplete-list" id="recebedor_sugestoes"></div>
                        </div>

                        <div onclick="atualizar_base_clientes()" class="botoes_financeiro">
                            <img src="imagens/atualizar_2.png" style="width: 30px;">
                        </div>

                    </div>

                    <div id="aguarde_2" style="display: none; width: 100%; align-items: center; justify-content: center; gap: 10px;">
                        <img src="gifs/loading.gif" style="width: 5vw">
                        <label>Baixando clientes do Omie...</label>
                    </div>

                </div>

                <div id="container_cnpj_cpf" style="display: none; align-items: center; gap: 10px;">

                    <div class="numero" style="background-color: transparent;">
                        <img src="gifs/alerta.gif" style="width: 30px; height: 30px;">
                    </div>

                    <div class="itens_financeiro" style="background-color: #B12425">
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; width: 100%;">
                            <div style="display: flex; align-items: center; gap: 20px;">
                                <input type="text" id="cnpj_cpf" oninput="calculadora_pagamento()"
                                    placeholder="Digite o CNPJ ou CPF aqui...">
                                <img src="imagens/confirmar.png" onclick="botao_cadastrar_cliente()" id="botao_cadastrar_cliente"
                                    style="margin: 10px; cursor: pointer; width: 30px;">
                            </div>

                            <label style="white-space: nowrap; font-size: 0.7em;">Esse <strong>recebedor</strong> parece novo...
                                preencha o CPF/CNPJ e clique no símbolo de confirmação. </label>
                        </div>
                    </div>

                </div>

                <div class="ordem">
                    <label id="descricao_numero" class="numero">${ordenar()}</label>    
                    <div class="itens_financeiro">
                        <label>Descrição do pagamento</label>
                        <textarea style="width:80%" rows="3" id="descricao_pagamento" oninput="calculadora_pagamento()"
                            placeholder="Deixe algum comentário importante. \nIsso facilitará o processo."></textarea>
                    </div>
                </div>    

                <div class="ordem">
                    <label id="pix_numero" class="numero">${ordenar()}</label>    
                    <div class="itens_financeiro">
                        <label>Chave PIX</label>
                        <textarea style="width:80%" rows="3" id="pix" oninput="calculadora_pagamento()"
                            placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."></textarea>
                    </div>
                </div> 

                <div class="ordem">
                    <label id="categoria_numero" class="numero">${ordenar()}</label>   

                    <div id="central_categorias" class="central_categorias" style="width: 80%;">
                        <label style="text-decoration: underline; cursor: pointer;" onclick="nova_categoria()">Clique aqui para + 1 Categoria</label>
                        ${nova_categoria()}
                    </div>
                </div>

                <div class="ordem">
                    <label id="anexo_numero" class="numero">${ordenar()}</label>  

                    <div style="display: flex; flex-direction: column; justify-content: left; gap: 10px; width: 80%;">
                        <div style="display: flex; justify-content: left; gap: 10px; width: 80%;">
                            <label for="adicionar_anexo_pagamento" style="text-decoration: underline; cursor: pointer; margin-left: 20px;">
                                Clique aqui para + 1 Anexo
                                <input type="file" id="adicionar_anexo_pagamento" style="display: none;" onchange="salvar_anexo_pagamento()">
                            </label>
                        </div>

                        <div id="container_anexos" style="display: flex; flex-direction: column; justify-content: left; gap: 10px; width: 100%;"></div>
                    </div>

                </div>

                ${incluir_campos_adicionais()}

                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;" class="time">
                    <label id="tempo" class="contorno_botoes" style="background-color: #097fe6"></label>
                    <label> Vai cair em </label>
                    <label id="tempo_real" class="contorno_botoes" style="background-color: #097fe6"></label>
                    <img src="gifs/alerta.gif" style="width: 30px;">
                </div>

                <div style="display: flex; width: 100%; justify-content: center; align-items: center;">
                    <div class="contorno_botao_liberacao">
                        <label>Total do pagamento</label>
                        <label style="font-size: 2.0em;" id="total_de_pagamento">R$ 0,00</label>
                        <label id="liberar_botao" class="contorno_botoes" style="background-color: green; display: none;" onclick="criar_pagamento_v2('${chave1}')">Salvar Pagamento</label>
                    </div>
                </div>
            </div>

        </div>

    </div>
    `;

    openPopup_v2(acumulado)
    carregar_opcoes(opcoes_centro_de_custo(), 'cc', 'cc_sugestoes')
    carregar_opcoes(await opcoes_clientes(), 'cliente_pagamento', 'recebedor_sugestoes')

}

async function atualizar_base_clientes() {

    var div_recebedor = document.getElementById('div_recebedor')
    var aguarde_2 = document.getElementById('aguarde_2')

    if (div_recebedor) {

        div_recebedor.style.display = 'none'
        aguarde_2.style.display = 'flex'

        contagem_regressiva('aguarde_2', 30)

        await recuperar_dados_clientes()

        carregar_opcoes(await opcoes_clientes(), 'cliente_pagamento', 'recebedor_sugestoes')

        div_recebedor.style.display = 'flex'
        aguarde_2.style.display = 'none'

    }


}

function calcular_custo() {
    var resultado = document.getElementById('resultado')
    if (resultado) {

        var v_pago = conversor(document.getElementById('v_pago').textContent)
        var v_orcado = document.getElementById('v_orcado')

        var porcentagem = (v_pago / v_orcado.value * 100).toFixed(0)

        resultado.innerHTML = `
        ${porcentagem}%
        `
    }

}

function incluir_campos_adicionais() { //29

    var campos = {
        lpu_parceiro: { titulo: 'LPU do parceiro de serviço & material' },
        os: { titulo: 'Ordem de Serviço' },
        relatorio_fotografico: { titulo: 'Relatório de Fotográfico' },
        medicao: { titulo: 'Tem medição para anexar?' },
    }

    var campos_div = ''
    for (campo in campos) {

        var conteudo = campos[campo]
        campos_div += `
            <div class="ordem">
                <label id="recebedor_numero" class="numero">${ordenar()}</label>

                <div class="itens_financeiro" style="justify-content: space-between;">
                    <label style="width: 100%;">${conteudo.titulo}</label>
                        <label class="contorno_botoes" for="anexo_${campo}" style="justify-content: center;">
                            Anexar
                            <input type="file" id="anexo_${campo}" style="display: none;" onchange="anexos_parceiros('${campo}')">
                        </label>
                    <div id="container_${campo}" style="display: flex; flex-direction: column; justify-content: left; gap: 10px; width: 100%;"></div>
                </div>
            </div>    
            `
    }

    var acumulado = `
    <div id="painel_parceiro" style="display: none; flex-direction: column; align-items: start; justify-content: center; gap: 5px;">
        ${campos_div}
        
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <label id="recebedor_numero" class="numero">${ordenar()}</label>
            <div style="background-color: #222; border-radius: 5px; margin: 5px;">
                <table style="font-size: 1vw; padding: 5px;">
                    <thead>
                        <th>Valor Orçado Válido</th>
                        <th>A Pagar</th>
                        <th>%</th>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input style="border: none; width: 100%; background-color: transparent;" id="v_orcado" placeholder="Valor Orçado" oninput="calcular_custo()"></td>
                            <td style="color: #222; white-space: nowrap;" id="v_pago"></td>
                            <td style="color: #222;" id="resultado"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `

    return acumulado
}

async function opcoes_clientes() {

    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var opcoes = []

    for (cnpj in dados_clientes) {
        var infos = dados_clientes[cnpj]

        opcoes.push(`[${cnpj}] ${infos.nome}`)
    }

    return opcoes
}

async function calculadora_pagamento() {

    var central_categorias = document.getElementById('central_categorias')
    var dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {}

    function colorir(cor, elemento) {
        document.getElementById(elemento).style.backgroundColor = cor
    }

    if (central_categorias) {

        var dados_clientes = await recuperarDados('dados_clientes') || {}
        var inputs = central_categorias.querySelectorAll('input[type="number"]');
        var categorias = central_categorias.querySelectorAll('input[type="text"]');
        var total = 0
        var cliente = document.getElementById('cliente_pagamento')
        var descricao = document.getElementById('descricao_pagamento')
        var bloqueio = false
        var categoria_invalida = false

        var pix = document.getElementById('pix')
        if (pix) {
            if (pix.value !== '') {
                colorir('green', 'pix_numero')
            } else {
                bloqueio = true
                colorir('#B12425', 'pix_numero')
            }
        }

        var cc = document.getElementById('cc');
        if (cc) {

            var cod = ''
            try {
                cod = cc.value.match(/\[(\d+)\]$/)[1]
            } catch { }

            if (centros_de_custo[cod]) {
                colorir('green', 'cc_numero')
            } else {
                bloqueio = true
                colorir('#B12425', 'cc_numero')
            }
        }

        var pagamento_parceiros = ''
        var valor_parceiro = 0

        inputs.forEach((input, i) => {

            total += Number(input.value)

            if (categorias[i].value == 'Pagamento de Parceiros' || categorias[i].value == 'Adiantamento de Parceiros') {
                pagamento_parceiros = categorias[i].value
                valor_parceiro += Number(input.value)
            }

            !dados_categorias[categorias[i].value] ? categoria_invalida = true : ''

            if (input.value == '' || categorias[i].value == '') {
                colorir('#B12425', 'categoria_numero')
                bloqueio = true
            } else {
                colorir('green', 'categoria_numero')
            }

            if (!dados_categorias[categorias[i].value]) {
                categorias[i].value = ''
                bloqueio = true
            }

        })

        var painel_parceiro = document.getElementById('painel_parceiro')
        if (valor_parceiro !== 0 && painel_parceiro) {
            painel_parceiro.style.display = 'flex'
            document.getElementById('v_pago').textContent = dinheiro(valor_parceiro)
        } else {
            painel_parceiro.style.display = 'none'
        }

        if (pagamento_parceiros !== '') {
            clearInterval(intervaloCurto);
            intervaloCurto = setInterval(function () {
                tempo_real.textContent = data_atual('curta', pagamento_parceiros);
            }, 1000);

        } else {
            clearInterval(intervaloCurto);
            intervaloCurto = setInterval(function () {
                tempo_real.textContent = data_atual('curta');
            }, 1000);
        }

        document.getElementById('total_de_pagamento').textContent = dinheiro(total)

        var container_cnpj_cpf = document.getElementById('container_cnpj_cpf')

        if (total !== 0 && descricao.value !== '' && cliente.value !== '' && !bloqueio && container_cnpj_cpf.style.display !== 'flex') {
            document.getElementById('liberar_botao').style.display = 'block'
        } else {
            document.getElementById('liberar_botao').style.display = 'none'
        }

        cliente.value == '' ? colorir('#B12425', 'recebedor_numero') : colorir('green', 'recebedor_numero')
        descricao.value == '' ? colorir('#B12425', 'descricao_numero') : colorir('green', 'descricao_numero')

        var div_recebedor = document.getElementById('div_recebedor')
        var regex_cliente = regex = /\[(.*?)\]/;
        var cnpj_string = ''

        if (String(cliente.value).match(regex_cliente)) {
            cnpj_string = String(cliente.value).match(regex_cliente)[1]
        }

        if (dados_clientes[cnpj_string] == undefined || (cliente.value !== '' && cnpj_string == '' && div_recebedor.style.display !== 'none')) {
            document.getElementById('container_cnpj_cpf').style.display = 'flex'
            colorir('#B12425', 'recebedor_numero')
        } else {
            document.getElementById('container_cnpj_cpf').style.display = 'none'
        }

    }

    return categoria_invalida
}

function nova_categoria() {
    var categoria = `
        <div class="itens_financeiro" style="font-size: 0.8em;">
            <label>Categoria</label>
            <input list="W1" type="text" onchange="calculadora_pagamento()" placeholder="Categoria" style="width: 300px">
            <datalist id="W1">${criar_datalist('categorias')}</datalist>
            <label>Valor</label>
            <input type="number" oninput="calculadora_pagamento()" placeholder="0,00">
            <label src="imagens/remover.png" style="cursor: pointer; width: 25px; font-size: 2.5vw;" onclick="apagar_categoria(this)">&times;</label>
        </div>
    `;
    var central_categorias = document.getElementById('central_categorias')
    if (!central_categorias) {
        return categoria
    } else {
        central_categorias.insertAdjacentHTML('beforeend', categoria)
    }
    calculadora_pagamento()
}

function apagar_categoria(elemento) {
    var linha = elemento.closest('div');
    linha.parentNode.removeChild(linha);
    calculadora_pagamento()
}

async function botao_cadastrar_cliente() {
    var cnpj_cpf = document.getElementById('cnpj_cpf')
    var textarea_nome = document.getElementById('cliente_pagamento')
    var regex = /Id \[(\d+)\]/;

    var container_cnpj_cpf = document.getElementById('container_cnpj_cpf')
    var aguarde_2 = document.getElementById('aguarde_2')
    var div_recebedor = document.getElementById('div_recebedor')

    div_recebedor.style.display = 'none'
    container_cnpj_cpf.style.display = 'none'
    aguarde_2.style.display = 'flex'

    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var omie_clientes = {}

    for (let cliente in dados_clientes) {
        var infos = dados_clientes[cliente]
        omie_clientes[dados_clientes[cliente].omie] = infos
    }

    if (textarea_nome.value && cnpj_cpf.value) {

        await cadastrarCliente(textarea_nome.value, cnpj_cpf.value)

        var resposta_cliente_cadastrado = JSON.parse(localStorage.getItem('resposta_cliente_cadastrado'))

        if (resposta_cliente_cadastrado.cod_status == 0) {

            dados_clientes[cnpj_cpf.value] = {
                nome: textarea_nome.value,
                cnpj: cnpj_cpf.value,
                omie: resposta_cliente_cadastrado.codigo_cliente_omie
            }

            inserirDados(dados_clientes, 'dados_clientes')

        } else if (resposta_cliente_cadastrado.cod_status == 4) {

            var match = resposta_cliente_cadastrado.status.match(regex);

            if (match) {
                var omie_cod = match[1]
                textarea_nome.value = `[${omie_clientes[omie_cod].cnpj}] ${omie_clientes[omie_cod].nome}` // Cliente já cadastrado para o CPF informado;

            }

        }

    }

    div_recebedor.style.display = 'flex'
    aguarde_2.style.display = 'none'

    calculadora_pagamento()

}

function cadastrarCliente(nome, cnpj_cpf) {

    return new Promise((resolve, reject) => {
        var bloco = `cdc29_${nome}_${cnpj_cpf}`

        var url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=' + bloco

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao carregar os dados');
                }
                return response.json();
            })
            .then(data => {

                localStorage.setItem('resposta_cliente_cadastrado', JSON.stringify(data))
                resolve();
            })
            .catch(error => {
                console.error('Ocorreu um erro:', error);
                reject(error);
            });
    });
}



function salvar_anexo_pagamento(id_pagamento) {

    var elemento = document.getElementById(`adicionar_anexo_pagamento`)

    var file = elemento.files[0];

    if (file) {

        var fileInput = elemento
        var file = fileInput.files[0];
        var fileName = file.name

        if (!file) {
            openPopup_v2('Nenhum arquivo selecionado...');
            return;
        }

        var reader = new FileReader();
        reader.onload = async (e) => {
            var base64 = e.target.result.split(',')[1];
            var mimeType = file.type;

            var response = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: fileName,
                    mimeType: mimeType,
                    base64: base64
                })
            });

            var result = await response.json();
            if (response.ok) {

                if (id_pagamento == undefined) {

                    anexos_pagamentos[gerar_id_5_digitos()] = {
                        nome: fileName,
                        formato: mimeType,
                        link: result.fileId
                    }

                    var imagem = ''

                    if (formato(mimeType) == 'PDF') {
                        imagem = 'pdf'
                    } else if (formato(mimeType) == 'IMAGEM') {
                        imagem = 'imagem'
                    } else if (formato(mimeType) == 'PLANILHA') {
                        imagem = 'excel2'
                    } else {
                        imagem = 'anexo'
                    }

                    var resposta = `
                <div style="align-items: center; width: max-content; font-size: 0.7em; display: flex; justify-content; left;">
                    <img src="${imagem}.png" style="width: 20px;">
                    <label><strong>${fileName}</strong></label>
                </div>
                `
                    document.getElementById('container_anexos').insertAdjacentHTML('beforeend', resposta)
                } else {

                    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}

                    var anexo = {}

                    anexo[gerar_id_5_digitos()] = {
                        nome: fileName,
                        formato: mimeType,
                        link: result.fileId
                    }

                    lista_pagamentos[id_pagamento].anexos = {
                        ...lista_pagamentos[id_pagamento].anexos,
                        ...anexo
                    };

                    var dados = {
                        id_pagamento: id_pagamento,
                        tabela: 'atualizacoes_pagamentos',
                        alteracao: 'anexo',
                        anexo: anexo
                    }

                    enviar_dados_generico(dados)

                    localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos))

                    consultar_pagamentos()
                    abrir_detalhes(id_pagamento)

                }

            } else {

                openPopup_v2(`Deu erro por aqui... ${result.message}`)

            }

        };

        reader.readAsDataURL(file);
    }
}

function anexos_parceiros(campo, id_pagamento) {

    var elemento = document.getElementById(`anexo_${campo}`)

    var file = elemento.files[0];

    if (file) {

        var fileInput = elemento
        var file = fileInput.files[0];
        var fileName = file.name

        if (!file) {
            openPopup_v2('Nenhum arquivo selecionado...');
            return;
        }

        var reader = new FileReader();
        reader.onload = async (e) => {
            var base64 = e.target.result.split(',')[1];
            var mimeType = file.type;

            var response = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: fileName,
                    mimeType: mimeType,
                    base64: base64
                })
            });

            var result = await response.json();
            if (response.ok) {

                //Verificar estrutura
                if (!anx_parceiros[campo]) {
                    anx_parceiros[campo] = {}
                }

                anx_parceiros[campo][gerar_id_5_digitos()] = {
                    nome: fileName,
                    formato: mimeType,
                    link: result.fileId
                }

                if (id_pagamento !== undefined) {

                    var dados = {
                        id_pagamento: id_pagamento,
                        campo: campo,
                        tabela: 'anexos_parceiros',
                        anexo: anx_parceiros[campo]
                    }

                    var pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}
                    var pagamento = pagamentos[id_pagamento]

                    pagamento.anexos_parceiros = pagamento.anexos_parceiros || {};

                    pagamento.anexos_parceiros[dados.campo] = {
                        ...pagamento.anexos_parceiros[dados.campo],
                        ...dados.anexo
                    }

                    localStorage.setItem('lista_pagamentos', JSON.stringify(pagamentos))

                    enviar_dados_generico(dados)

                    abrir_detalhes(id_pagamento)
                }

                var resposta = `
                <div onclick="abrirArquivo('https://drive.google.com/file/d/${result.fileId}')" class="anexos" style="border: solid 1px green;">
                    <img src="imagens/anexo.png" style="cursor: pointer; width: 20px; height: 20px;">
                    <label style="cursor: pointer; font-size: 0.6em"><strong>${fileName}</strong></label>
                </div>   
                `
                document.getElementById(`container_${campo}`).insertAdjacentHTML('beforeend', resposta)

            } else {

                openPopup_v2(`Deu erro por aqui... ${result.message}`)

            }

        };

        reader.readAsDataURL(file);
    }

}
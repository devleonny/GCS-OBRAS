document.addEventListener("DOMContentLoaded", function () {
    let tipo = localStorage.getItem("ativarPendencias");

    if (tipo != null) {
        mostrar_apenas_pendencias(tipo); // Chama a função com "gerente" ou "diretoria"
        localStorage.removeItem("ativarPendencias"); // Remove para evitar execução futura indevida
    }
});

var status_deste_modulo = [];
var modulo = localStorage.getItem('modulo_ativo') || ''
var filtrosAtivos = {};
var filtrosAtivosPagamentos = {};
var anexos_pagamentos = {};
var anx_parceiros = {};
var intervaloCompleto;
var intervaloCurto;

preencher_orcamentos_v2()

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

function filtros_de_orcamento(dados) {
    let dados_filtrados = {
        gerente: {},
        diretoria: {}
    }

    for (st_existentes in fluxograma) {
        dados_filtrados[st_existentes] = {}
    }

    for (id in dados) {
        let orcamento = dados[id]

        if (orcamento.operacao && orcamento.operacao == 'excluido') {
            continue
        }

        if (orcamento.status) {

            let pedidos = orcamento.status

            for (chave1 in pedidos) {
                let pedido = pedidos[chave1]
                if (String(pedido.pedido).includes('?')) {

                    if (conversor(orcamento.total_geral) > 20000) {
                        dados_filtrados.diretoria[id] = orcamento
                    }

                    dados_filtrados.gerente[id] = orcamento

                }

                if (dados_filtrados[pedido.status]) {
                    dados_filtrados[pedido.status][id] = orcamento
                }
            }
        } else {
            dados_filtrados['AGUARDANDO'][id] = orcamento
        }
    }

    return dados_filtrados

}

async function mostrar_apenas_pendencias(filtros) {

    localStorage.setItem('filtroAtivo', filtros)

    if (filtros == 'gerente' || filtros == 'diretoria') {
        localStorage.setItem('modulo_ativo', 'RELATÓRIOS')
        modulo = 'RELATÓRIOS'
    }

    await preencher_orcamentos_v2(filtros)

    botao_limpar_painel_direito()

}

function botao_limpar_painel_direito() {

    let painel_direito = document.getElementById('painel_direito')

    if (painel_direito) {
        painel_direito.innerHTML = `
            <div class="block_reverso" style="background-color: #222222bf;" onclick="preencher_orcamentos_v2(undefined, true)">
                <img src="imagens/voltar.png" style="width: 50px;">
                <p style="font-size: 0.8vw;">VOLTAR</p>
            </div>
        `
    }

}

async function preencher_orcamentos_v2(filtros, remover) {

    var div_orcamentos = document.getElementById('orcamentos')
    if (!div_orcamentos) {
        return
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (Object.keys(dados_orcamentos).length == 0) {
        await recuperar_orcamentos()
        dados_orcamentos = await recuperarDados('dados_orcamentos')
    }

    let dados_filtrados = filtros_de_orcamento(dados_orcamentos)

    if (remover) {
        localStorage.removeItem('filtroAtivo')

    } else {
        let filtroAtivo = localStorage.getItem('filtroAtivo')

        if (filtros == undefined && filtroAtivo) {
            filtros = filtroAtivo
        }

        if (filtros !== undefined) {
            dados_orcamentos = dados_filtrados[filtros]
        }
    }

    document.getElementById('nome_modulo').textContent = modulo
    let nome = filtros

    //Resetar a tabela caso o filtro não pertença ao módulo;
    if (fluxograma[filtros]) {
        let reiniciar = true
        let modulos = fluxograma[filtros].modulos

        modulos.forEach(mod => {
            if (modulo == mod) {
                reiniciar = false
            }
        })

        if (reiniciar) {
            localStorage.removeItem('filtroAtivo')
            return preencher_orcamentos_v2()
        }
    }
    //Fim

    if (fluxograma[filtros] && fluxograma[filtros].nome) {
        nome = fluxograma[filtros].nome
    }
    document.getElementById('nome_filtro').textContent = nome

    // Eleminar o ID que o DB cria...
    delete dados_orcamentos['id']
    // Fim...

    for (orc in dados_orcamentos) { // Remover os excluídos para não distorcer o relatório;
        if (dados_orcamentos[orc].operacao == 'excluido') {
            delete dados_orcamentos[orc]
        }
    }

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
                continue
            }

            var exibir_linha = false
            var pedidos = orc.status || {}
            var label_pedidos = ''
            var label_notas = ''

            for (pedido in pedidos) {
                let chave_pedido = pedidos[pedido]
                let status = chave_pedido.status
                let num_pedido = chave_pedido.pedido
                let tipo = chave_pedido.tipo
                let cor;

                tipo == 'Venda' ? cor = '#ff9c24' : cor = '#00bfb7'

                label_pedidos += `
                    <div class="etiqueta_pedidos" style="background-color: ${cor};"> 
                        <label style="font-size: 0.7vw; margin: 2px;">${tipo}</label>
                        <label style="font-size: 0.9vw; margin: 2px;"><strong>${num_pedido}</strong></label>
                    </div>
                `

                var historico = chave_pedido.historico

                for (chave2 in historico) {
                    var chave_historico = historico[chave2]
                    let cor2;

                    if (chave_historico.notas) {
                        var nota = chave_historico.notas[0]
                        nota.modalidade == 'Venda' ? cor2 = '#ff9c24' : cor2 = '#00bfb7'
                        label_notas += `
                        <div class="etiqueta_pedidos" style="background-color: ${cor2};">
                            <label style="font-size: 0.8em; margin: 2px;">${nota.modalidade}</label>
                            <label style="font-size: 1.1em; margin: 2px;"><strong>${nota.nota}</strong></label>
                        </div>
                        `
                    }
                }

                if (fluxograma[status]) {

                    var modulos = fluxograma[status].modulos
                    if (modulos.includes(modulo)) {
                        exibir_linha = true
                        if (!status_deste_modulo[status]) {
                            status_deste_modulo[status] = 0
                        }
                        status_deste_modulo[status] += 1
                    }

                }
            }

            if (Object.keys(pedidos).length == 0) {

                var aguardando = 'AGUARDANDO'
                var modulos = fluxograma[aguardando].modulos

                if (modulos.includes(modulo)) {
                    exibir_linha = true
                    if (!status_deste_modulo[aguardando]) {
                        status_deste_modulo[aguardando] = 0
                    }

                    status_deste_modulo[aguardando] += 1
                }

            }

            let cor = '#ffc584'
            let fonte = 'black'

            if (orc.aprovacao && Object.keys(orc.aprovacao).length > 0) {

                let responsaveis = orc.aprovacao
                let valor = conversor(orc.total_geral)
                let gerente = false
                let diretoria = false

                if (responsaveis.Gerente && responsaveis.Gerente.status) {
                    let st = responsaveis.Gerente.status
                    gerente = st == 'aprovado' ? true : false
                }

                if (responsaveis.Diretoria && responsaveis.Diretoria.status) {
                    let st = responsaveis.Diretoria.status
                    diretoria = st == 'aprovado' ? true : false
                }

                if (valor > 21000) {
                    if (diretoria) {
                        cor = '#4CAF50';
                    } else if (gerente) {
                        cor = '#9cc0e0';
                    } else {
                        cor = '#ff7777';
                    }
                } else {
                    cor = gerente ? '#4CAF50' : '#ff7777';
                }

            }

            if (orc.status && cor == '#ffc584') {
                let pedidos = orc.status
                for (id in pedidos) {
                    let pedido = pedidos[id]
                    if (!String(pedido.pedido).includes('?')) {
                        cor = '#4CAF50'
                    }
                }
            }

            if (exibir_linha) {
                linhas += `
                <tr style="background-color: ${cor}; color: ${fonte};">
                    <td>${data}</td>
                    <td>${label_pedidos}</td>
                    <td>${label_notas}</td>
                    <td>${dados_orcam.contrato}</td>
                    <td>${dados_orcam.cliente_selecionado}</td>
                    <td>${dados_orcam.cidade}</td>
                    <td>${dados_orcam.analista}</td>
                    <td style="white-space: nowrap;">${orc.total_geral}</td>
                    <td style="white-space: nowrap;">${orc.lpu_ativa}</td>
                    <td style="text-align: center;" onclick="exibir_todos_os_status('${orcamento}')">
                        <img src="imagens/pesquisar3.png" style="width: 2vw; cursor: pointer;">
                    </td>
                </tr>
                `
            }
        }

        var painel_direito = document.getElementById('painel_direito')
        let atalhos = `
        <div style="display: flex; align-items: center; justify-content: start; gap: 10px; color: white;">
            <label class="numero" style="background-color: #ffc584; width: 2vw; height: 2vw;"></label>
            <label>Sem Pedido</label>
        </div>
        <div style="display: flex; align-items: center; justify-content: start; gap: 10px; color: white;">
            <label class="numero" style="background-color: #4CAF50; width: 2vw; height: 2vw;"></label>
            <label>Aprovados</label>
        </div>
        <div style="display: flex; align-items: center; justify-content: start; gap: 10px; color: white;">
            <label class="numero" style="background-color: #ff7777; width: 2vw; height: 2vw;"></label>
            <label>Reprovados</label>
        </div>
        <div style="display: flex; align-items: center; justify-content: start; gap: 10px; color: white;">
            <label class="numero" style="width: 2vw; height: 2vw;"></label>
            <label>Diretoria Pendente</label>
        </div>
        `
        if (filtros) {
            botao_limpar_painel_direito()
        } else {
            atalhos += `
            <div class="block" onclick="window.location.href = 'adicionar.html'">
                <img src="imagens/projeto.png" style="width: 50px;">
                <p style="font-size: 0.8vw;">CRIAR ORÇAMENTO</p>
            </div>
            `

            for (var atalho in status_deste_modulo) {
                let quantidade = status_deste_modulo[atalho]
                let nome = atalho
                if (fluxograma[atalho].nome) {
                    nome = fluxograma[atalho].nome
                }
                atalhos += `
                    <div class="block" style="background-color: #222222bf;" onclick="mostrar_apenas_pendencias('${atalho}')">
                        <div style="width: 50px; height: 50px; display: flex; justify-content: center; align-items: center;">
                            <label class="numero">${quantidade}</label>
                        </div>
                        <label style="font-size: 0.8vw; cursor: pointer; color: white;">${nome}</label>
                    </div>
                `
            }

            painel_direito.innerHTML = atalhos
        }

        var cabecs = ['Última alteração', 'Pedido', 'Notas', 'Chamado', 'Cliente', 'Cidade', 'Analista', 'Valor', 'LPU', 'Ações']
        var ths = ''
        var tsh = ''
        cabecs.forEach((cab, i) => {

            ths += `
            <th style="text-align: center;">${cab}</th>
            `
            if (cab !== 'Ações' && cab !== 'Aprovação') {
                tsh += `
                <th style="background-color: white; border-radius: 0px;">
                    <div style="position: relative;">
                        <img src="imagens/pesquisar2.png" style="position: absolute; left: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                        <input placeholder="..." style="margin-left: 25px; text-align: left;" oninput="pesquisar_v2(${i}, this.value)">
                    </div>
                </th>            
            `} else {
                tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
            }
        })

        let linhas_orcamento = document.getElementById('linhas_orcamento')

        if (linhas_orcamento) {
            linhas_orcamento.innerHTML = linhas

        } else {

            let tabela = `
            <table id="orcamentos_" class="tabela" style="font-size: 0.8vw; background-color: #222;">
                <thead>
                    ${ths}
                </thead>
                <thead id="tsh">
                    ${tsh}
                </thead>
                <tbody id="linhas_orcamento">
                    ${linhas}
                </tbody>
            </table>
            `
            div_orcamentos.insertAdjacentHTML('beforeend', tabela)
        }
    }

}

async function recuperar_orcamentos() {

    let dados_orcamentos = await receber('dados_orcamentos') || {}
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    if (document.title == 'ORÇAMENTOS') {

        await preencher_orcamentos_v2()
    }
}

async function rir(id_orcam) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    var orcamento = dados_orcamentos[id_orcam];

    orcamento = await conversor_composicoes_orcamento(orcamento)

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

async function editar(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    var orcamento_v2 = dados_orcamentos[orcam_]

    orcamento_v2 = await conversor_composicoes_orcamento(orcamento_v2)

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    window.location.href = 'adicionar.html'

}

async function duplicar(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let acesso = JSON.parse(localStorage.getItem('acesso'))

    var orcamento_v2 = dados_orcamentos[orcam_]

    orcamento_v2 = await conversor_composicoes_orcamento(orcamento_v2)

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

        const selectElement = document.getElementById('forma_pagamento');
        const formaSelecionada = selectElement.value;

        var descky = `
        Solicitante: ${acesso.usuario} \n
        `

        var objetoDataVencimento = ""

        if (formaSelecionada === 'Pix') {

            var chave_pix = document.getElementById('pix').value

            descky += `
            Chave PIX | Forma de Pagamento: ${chave_pix}
            \n
            `

            objetoDataVencimento = data_atual('curta', parceiro)

        } else if (formaSelecionada === 'Boleto') {

            var data_vencimento = document.querySelector("#data_vencimento").value

            const [ano, mes, dia] = data_vencimento.split("-")

            data_vencimento = `${dia}/${mes}/${ano}`

            descky += `
            Data de Vencimento do Boleto: ${data_vencimento}
            \n
            `

            objetoDataVencimento = data_vencimento

        }

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

        descky += document.getElementById('descricao_pagamento').value

        var regex_cliente = regex = /\[(.*?)\]/;
        var cnpj_string = String(cliente.value).match(regex_cliente)[1]

        var param = [
            {
                "codigo_cliente_fornecedor": dados_clientes[cnpj_string].omie,
                "valor_documento": conversor(total),
                "observacao": descky,
                "codigo_lancamento_integracao": id_pagamento,
                "data_vencimento": objetoDataVencimento,
                "categorias": rateio_categorias,
                "data_previsao": objetoDataVencimento,
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

        var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

        lista_pagamentos[pagamento.id_pagamento] = pagamento

        inserirDados(lista_pagamentos, 'lista_pagamentos');

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

    carregar_opcoes(opcoes_centro_de_custo(), 'cc', 'cc_sugestoes') // Carregar os centros de custo;

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
                    <img src="imagens/atualizar_2.png" style="width: 20px;">
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

    <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 70px;">

    <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
        <label>Solicitação de Pagamento</label>
    </div>

    <div class="pagamento">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: left; gap: 5px; fontsize: 0.8vw;">

            <div style="display: flex; flex-direction: column; align-items: baseline; justify-content: center; width: 100%;">
                <label>• Após às <strong>11h</strong> será lançado no dia útil seguinte;</label>
                <label>• Maior que <strong>R$ 500,00</strong> passa por aprovação;</label>
                <label style="text-align: left;">• Pagamento de parceiro deve ser lançado até dia <strong>5</strong> de cada mês,
                <br> e será pago dia <strong>10</strong> de cada mês;</label>
                <label>• Adiantamento de parceiro, o pagamento ocorre em até 8 dias.</label>
            </div>

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
                            <img src="imagens/atualizar_2.png" style="width: 20px;">
                        </div>

                    </div>

                    <div id="aguarde_2" style="display: none; width: 100%; align-items: center; justify-content: center; gap: 10px;">
                        <img src="gifs/loading.gif" style="width: 5vw">
                        <label>Verificando clientes do Omie...</label>
                    </div>

                </div>

                <div id="container_cnpj_cpf" style="display: none; align-items: center; gap: 10px;">

                    <div class="numero" style="background-color: transparent;">
                        <img src="gifs/alerta.gif" style="width: 30px; height: 30px;">
                    </div>

                    <div class="itens_financeiro" style="background-color: #B12425">
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                            <div style="display: flex; align-items: center; gap: 20px; justify-content: center; width: 100%;">
                                <input style="width: 200px;" type="text" id="cnpj_cpf" oninput="calculadora_pagamento()"
                                    placeholder="Digite o CNPJ ou CPF aqui...">
                                <img src="imagens/confirmar.png" onclick="botao_cadastrar_cliente()" id="botao_cadastrar_cliente"
                                    style="margin: 10px; cursor: pointer; width: 30px;">
                            </div>

                            <label style="font-size: 0.7em;">Esse <strong>recebedor</strong> parece novo...
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
                <label id="pix_ou_boleto_numero" class="numero">${ordenar()}</label>
                <div class="itens_financeiro" style="padding: 10px;" id="forma_pagamento_container">
                    <label>Forma de Pagamento</label>
                    <select id="forma_pagamento" onchange="atualizarFormaPagamento()" style="border-radius: 3px; padding: 5px; cursor: pointer;">
                        <option value="Pix">Chave Pix</option>
                        <option value="Boleto">Boleto</option>
                    </select>
                    <textarea style="width: 80%; margin-top: 10px;" rows="2" id="pix" placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..." oninput="calculadora_pagamento()"></textarea>
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
                                Incluir Anexos (Multiplos)
                                <input type="file" id="adicionar_anexo_pagamento" style="display: none;" onchange="salvar_anexo_pagamento()" multiple>
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

    if (chave1 == undefined) {
        carregar_opcoes(opcoes_centro_de_custo(), 'cc', 'cc_sugestoes')
    }

    carregar_opcoes(await opcoes_clientes(), 'cliente_pagamento', 'recebedor_sugestoes')

}

function atualizarFormaPagamento() {
    const formaPagamento = document.getElementById('forma_pagamento').value;
    const formaPagamentoContainer = document.getElementById('forma_pagamento_container');

    formaPagamentoContainer.style.padding = '10px'; // Adiciona padding à div

    formaPagamentoContainer.innerHTML = `
        <label>Forma de Pagamento</label>
        <select id="forma_pagamento" onchange="atualizarFormaPagamento()" style="border-radius: 3px; padding: 5px; cursor: pointer;">
            <option value="Pix" ${formaPagamento === 'Pix' ? 'selected' : ''}>Chave Pix</option>
            <option value="Boleto" ${formaPagamento === 'Boleto' ? 'selected' : ''}>Boleto</option>
        </select>
        ${formaPagamento === 'Pix'
            ? `<textarea style="width: 80%; margin-top: 10px;" rows="2" id="pix" placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."></textarea>`
            : `
                <div style="display: flex; flex-direction: column; justify-content: center;">
                    <label style="font-size: 0.8em; display: block; margin-top: 10px;">Data de Vencimento</label>
                    <input type="date" id="data_vencimento" style="margin-top: 5px; cursor: pointer;">
                </div>
            `
        }
    `;
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

function incluir_campos_adicionais() {

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
                    <div id="container_${campo}" style="display: flex; flex-direction: column; justify-content: left; gap: 2px; width: 100%;"></div>
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
        var data_vencimento = document.getElementById('data_vencimento')

        if (pix) {
            if (pix.value !== '') {
                colorir('green', 'pix_ou_boleto_numero')
            } else {
                bloqueio = true
                colorir('#B12425', 'pix_ou_boleto_numero')
            }
        }

        if (data_vencimento) {

            if (data_vencimento.value) {
                colorir('green', 'pix_ou_boleto_numero')
            } else {
                bloqueio = true
                colorir('#B12425', 'pix_ou_boleto_numero')
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

async function cadastrarCliente(nome, cnpj_cpf) {

    return new Promise((resolve, reject) => {
        var bloco = `cdc29_${nome}_${cnpj_cpf}`

        var url = 'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=' + bloco

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

async function salvar_anexo_pagamento(id_pagamento) {

    let elemento = document.getElementById(`adicionar_anexo_pagamento`);
    let files = Array.from(elemento.files); // Converte a FileList para um array

    for (let file of files) {
        let fileName = file.name;
        let reader = new FileReader();

        reader.onload = async (e) => {
            let base64 = e.target.result.split(',')[1];
            let mimeType = file.type;

            try {
                let response = await fetch('http://localhost:3000/upload', {
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

                let result = await response.json();

                if (response.ok) {
                    if (id_pagamento === undefined) {
                        let anx = gerar_id_5_digitos();

                        anexos_pagamentos[anx] = {
                            nome: fileName,
                            formato: mimeType,
                            link: result.fileId
                        };

                        let resposta = `
                        <div id="${anx}" class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                            <div class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                                <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                                <label style="font-size: 0.8em; cursor: pointer;">${String(fileName).slice(0, 10)} ... ${String(fileName).slice(-7)}</label>
                            </div>
                            <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="remover_anx('${anx}')">
                        </div>
                        `;
                        document.getElementById('container_anexos').insertAdjacentHTML('beforeend', resposta);
                    } else {
                        let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

                        let anexo = {};
                        anexo[gerar_id_5_digitos()] = {
                            nome: fileName,
                            formato: mimeType,
                            link: result.fileId
                        };

                        lista_pagamentos[id_pagamento].anexos = {
                            ...lista_pagamentos[id_pagamento].anexos,
                            ...anexo
                        };

                        let dados = {
                            id_pagamento: id_pagamento,
                            tabela: 'atualizacoes_pagamentos',
                            alteracao: 'anexo',
                            anexo: anexo
                        };

                        enviar_dados_generico(dados);

                        inserirDados(lista_pagamentos, 'lista_pagamentos');

                        consultar_pagamentos();
                        abrir_detalhes(id_pagamento);
                    }
                } else {
                    openPopup_v2(`Erro ao fazer upload do arquivo "${fileName}": ${result.message}`);
                }
            } catch (error) {
                console.error(`Erro ao processar o arquivo "${fileName}":`, error);
                openPopup_v2(`Erro ao processar o arquivo "${fileName}".`);
            }
        };

        reader.readAsDataURL(file);
    }
}

function remover_anx(anx) {

    let div = document.getElementById(anx)
    if (div && anexos_pagamentos && anexos_pagamentos[anx]) {
        delete anexos_pagamentos[anx]
        div.remove()
    }

}

async function anexos_parceiros(campo, id_pagamento) {

    var elemento = document.getElementById(`anexo_${campo}`)

    var file = elemento.files[0];

    if (file) {

        var fileInput = elemento
        var file = fileInput.files[0];
        var fileName = file.name

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

                let id_anx = gerar_id_5_digitos()

                if (id_pagamento !== undefined) {

                    var dados = {
                        id_pagamento: id_pagamento,
                        campo: campo,
                        tabela: 'anexos_parceiros',
                        anexo: {
                            id_anx: {
                                nome: fileName,
                                formato: mimeType,
                                link: result.fileId
                            }
                        }
                    }

                    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
                    var pagamento = lista_pagamentos[id_pagamento]

                    if (pagamento.anexos_parceiros[campo]) {
                        pagamento.anexos_parceiros[campo] = {}
                    }

                    pagamento.anexos_parceiros[campo] = {
                        ...pagamento.anexos_parceiros[dados.campo],
                        ...dados.anexo
                    }

                    enviar_dados_generico(dados)

                    await inserirDados(lista_pagamentos, 'lista_pagamentos')

                    return await abrir_detalhes(id_pagamento)

                } else {

                    if (!anx_parceiros[campo]) {
                        anx_parceiros[campo] = {}
                    }

                    anx_parceiros[campo][id_anx] = {
                        nome: fileName,
                        formato: mimeType,
                        link: result.fileId
                    }

                    let arquivo = `https://drive.google.com/file/d/${result.fileId}/view?usp=drivesdk`

                    let resposta = `
                    <div id="${id_anx}" class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                        <div class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;" onclick="abrirArquivo('${arquivo}')">
                            <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                            <label style="font-size: 0.8em; cursor: pointer;">${String(fileName).slice(0, 20)} ... ${String(fileName).slice(-7)}</label>
                        </div>
                        <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="excluir_anexo_parceiro_2('${campo}', '${id_anx}')">
                    </div>
                    `
                    let local = document.getElementById(`container_${campo}`)

                    if (local) {
                        local.insertAdjacentHTML('beforeend', resposta)
                    }
                }

            } else {

                console.log(`Deu erro por aqui... ${result.message}`)

            }

        };

        reader.readAsDataURL(file);
    }

}

function excluir_anexo_parceiro_2(campo, anx) {

    let local = document.getElementById(`container_${campo}`)
    if (anx_parceiros[anx] && local) {
        delete anx_parceiros[anx]
        local.remove()
    }

}

let orcamento_recuperado = { "total_geral": "R$ 163.970,09", "lpu_ativa": "MODALIDADE LIVRE", "id": "recuperado_vict_13-01", "dados_composicoes": { "1L": { "codigo": "1L", "descricao": "LEITORA DE RECONHECIMENTO FACIAL TELA 4.3 - BIOMETRIA 6000 FACES - 1.0.01.25.11944-0013", "qtde": 2, "unidade": "UND", "custo": 2025, "tipo": "VENDA", "total": 4050, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "2L": { "codigo": "2L", "descricao": "KIT ELETROÍMÃ (ELETROÍMA + BOTÃO DE SAÍDA + BOTÃO DE EMERGÊNCIA + FONTE NOBREAK + BATERIA SELADA)", "qtde": 1, "unidade": "UND", "custo": 739.89, "tipo": "VENDA", "total": 739.89, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "3L": { "codigo": "3L", "descricao": "DETECTOR DE METAIS 18 ZONAS S/ CAMERA TELA", "qtde": 0, "unidade": "UND", "custo": 6967.78, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "4L": { "codigo": "4L", "descricao": "INSTALAÇÃO DE ACESS POINT INDOOR", "qtde": 6, "unidade": "UND", "custo": 45, "tipo": "VENDA", "total": 270, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "5L": { "codigo": "5L", "descricao": "INSTALAÇÃO DE SERVIDOR ACESS PONT", "qtde": 1, "unidade": "UND", "custo": 80, "tipo": "VENDA", "total": 80, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "6L": { "codigo": "6L", "descricao": "INSTALAÇÃO DO KIT ELETROÍMÃ", "qtde": 1, "unidade": "UND", "custo": 200, "tipo": "VENDA", "total": 200, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "7L": { "codigo": "7L", "descricao": "INSTALAÇÃO EQUIPAMENTOS DE CONTROLE DE ACESSO", "qtde": 2, "unidade": "UND", "custo": 200, "tipo": "VENDA", "total": 400, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "8L": { "codigo": "8L", "descricao": "INSTALAÇÃO DO NOBREAK 2KVA", "qtde": 1, "unidade": "UND", "custo": 50, "tipo": "VENDA", "total": 50, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "9L": { "codigo": "9L", "descricao": "INSTALAÇÃO DE SWITCH", "qtde": 3, "unidade": "UND", "custo": 70, "tipo": "VENDA", "total": 210, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "10L": { "codigo": "10L", "descricao": "CAMERA IP FISHEYE 5MP IR10M SDCARD MIC INTEGRADO- 1.0.01.04.33908", "qtde": 0, "unidade": "UND", "custo": 1485, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "11L": { "codigo": "11L", "descricao": "CAMERA IP BULLET 2MP IR 30M DWDR IP67", "qtde": 47, "unidade": "UND", "custo": 410, "tipo": "VENDA", "total": 19270, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "12L": { "codigo": "12L", "descricao": "CAMERA IP BULLET VF 2MP IR60M WDR120DB", "qtde": 0, "unidade": "UND", "custo": 1957, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "13L": { "codigo": "13L", "descricao": "CAMERA IP DOME 2MP IR50M WDR12ODB 2.8MM - 1.0.01.04.38262", "qtde": 1, "unidade": "UND", "custo": 442, "tipo": "VENDA", "total": 442, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "14L": { "codigo": "14L", "descricao": "CAIXA DE JUNCAO PARA CAMERA BULLET DOME FISHEYE - 1.0.02.08.12455", "qtde": 48, "unidade": "UND", "custo": 91.8, "tipo": "VENDA", "total": 4406.4, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "15L": { "codigo": "15L", "descricao": "SWITCH (COMUTADOR) 24 PORTAS PoE GIGABIT + 4 PC 8517.62.39 5 PORTAS SFP LAYER 2 370W - 1.0.01.20.10420-0028", "qtde": 3, "unidade": "UND", "custo": 2808.08, "tipo": "VENDA", "total": 8424.24, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "16L": { "codigo": "16L", "descricao": "DHI-NVR5864-EL", "qtde": 1, "unidade": "UND", "custo": 6952, "tipo": "VENDA", "total": 6952, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "17L": { "codigo": "17L", "descricao": "HDD SKYHAWK 8TB 3,5 SATA 256MB CACHE - ST8000VE001", "qtde": 8, "unidade": "UND", "custo": 2145, "tipo": "VENDA", "total": 17160, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "18L": { "codigo": "18L", "descricao": "TECLADO E MOUSE SEM FIO MULTILASER SLIM 2.4GHZ ABNT 2 PRETO -", "qtde": 1, "unidade": "UND", "custo": 135.71, "tipo": "VENDA", "total": 135.71, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "19L": { "codigo": "19L", "descricao": "TV / MONITOR 43\"", "qtde": 1, "unidade": "UND", "custo": 2580, "tipo": "VENDA", "total": 2580, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "20L": { "codigo": "20L", "descricao": "CABO HDMI (ENTRE 5 A 15 MT)", "qtde": 1, "unidade": "UND", "custo": 66, "tipo": "VENDA", "total": 66, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "21L": { "codigo": "21L", "descricao": "SUPORTE DE TV FIXO", "qtde": 1, "unidade": "UND", "custo": 57.66, "tipo": "VENDA", "total": 57.66, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "22L": { "codigo": "22L", "descricao": "Access point indoor, WMM Ubiquiti UniFi AC Lite UAP-AC-LITE branco - BIVOLT", "qtde": 6, "unidade": "UND", "custo": 1139.7, "tipo": "VENDA", "total": 6838.200000000001, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "23L": { "codigo": "23L", "descricao": "Servidor De Gerenciamento Ubiquiti Unifi Cloud Uck-g2-plus", "qtde": 1, "unidade": "UND", "custo": 2286, "tipo": "VENDA", "total": 2286, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "24L": { "codigo": "24L", "descricao": "MODULO SFP 1.25GB BASE-LX - SM LC DUPLEX 10 KM - DN-SFP-LX-10 - D-NET", "qtde": 0, "unidade": "UND", "custo": 150, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "25L": { "codigo": "25L", "descricao": "CORDAO DUPLEX CONECTORIZADO SM BLI G-657A LC-UPC/LC-UPC 2.5M - LSZH - AZUL (A - B) - 33004465 - FURUKAWA", "qtde": 0, "unidade": "UND", "custo": 321, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "26L": { "codigo": "26L", "descricao": "CAIXA TERMINADOR OPTICO 06 - 12 FO", "qtde": 0, "unidade": "UND", "custo": 90.75, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "27L": { "codigo": "27L", "descricao": "PATCH CORD U/UTP GIGALAN GREEN CAT.6 - LSZH - T568A/B - 2.5M - VERMELHO - 35123234 - FURUKAWA", "qtde": 4, "unidade": "UND", "custo": 40.65, "tipo": "VENDA", "total": 162.6, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "28L": { "codigo": "28L", "descricao": "PATCH CORD U/UTP GIGALAN GREEN CAT.6 - LSZH - T568A/B - 0.5M - VERMELHO - 35123230 - FURUKAWA", "qtde": 114, "unidade": "UND", "custo": 33, "tipo": "VENDA", "total": 3762, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "29L": { "codigo": "29L", "descricao": "CABO TRANSMISSAO DE DADOS MULTILAN U/UTP 24AWGX4P CAT.6 CM VM ROHS - 23400216 - FURUKAWA", "qtde": 2430, "unidade": "UND", "custo": 4.95, "tipo": "VENDA", "total": 12028.5, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "30L": { "codigo": "30L", "descricao": "MÃO DE OBRA DE PASSAGEM DE CABO OPTICO", "qtde": 0, "unidade": "UND", "custo": 3.1, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "31L": { "codigo": "31L", "descricao": "CABO OPTICO CFOT-SM-EO 02F COG/COR (FIBER-LAN INDOOR/OUTDOOR) (26070006) - 28070006 - FURUKAWA", "qtde": 0, "unidade": "UND", "custo": 6.3, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "32L": { "codigo": "32L", "descricao": "CABO DE ELÉTRICA 2,5MM", "qtde": 100, "unidade": "UND", "custo": 3.05, "tipo": "VENDA", "total": 305, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "33L": { "codigo": "33L", "descricao": "CONECTOR FEMEA MULTILAN CAT.6 T568A/B 90/180 - BRANCO - 35030600 - FURUKAWA", "qtde": 57, "unidade": "UND", "custo": 36.3, "tipo": "VENDA", "total": 2069.1, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "34L": { "codigo": "34L", "descricao": "MÃO DE OBRA DE PASSAGEM DE CABO", "qtde": 2530, "unidade": "UND", "custo": 1.8, "tipo": "VENDA", "total": 4554, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "35L": { "codigo": "35L", "descricao": "MÃO DE OBRA DE INFRAESTRUTURA (ELETROCALHA, PERFILADO, ELETRODUTO, CAIXAS DE PASSAGEM, ETC)", "qtde": 223, "unidade": "UND", "custo": 30, "tipo": "VENDA", "total": 6690, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "36L": { "codigo": "36L", "descricao": "FUSÃO DE FIBRA ÓTICA", "qtde": 0, "unidade": "UND", "custo": 200, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "37L": { "codigo": "37L", "descricao": "INSTALAÇÃO DE CÂMERAS", "qtde": 48, "unidade": "UND", "custo": 50, "tipo": "VENDA", "total": 2400, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "38L": { "codigo": "38L", "descricao": "CONFIGURAÇÃO DE CÂMERAS", "qtde": 48, "unidade": "UND", "custo": 60, "tipo": "VENDA", "total": 2880, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "39L": { "codigo": "39L", "descricao": "INSTALAÇÃO DE NVR 04, 08, 16 e 32 CANAIS", "qtde": 1, "unidade": "UND", "custo": 100, "tipo": "VENDA", "total": 100, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "40L": { "codigo": "40L", "descricao": "INSTALAÇÃO DE RACK DE PISO", "qtde": 1, "unidade": "UND", "custo": 80, "tipo": "VENDA", "total": 80, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "41L": { "codigo": "41L", "descricao": "ORGANIZAÇÃO DO CABEAMENTO DE TODOS OS RACKS EXISTENTES NA SALA DE CFTV , ESTAÇÃO DE TRABALHO E MONITORES DO PAIN'EL DE MADEIRA .", "qtde": 1, "unidade": "UND", "custo": 825, "tipo": "VENDA", "total": 825, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "42L": { "codigo": "42L", "descricao": "RACK MONOBLOCO DE PAREDE 19POL 12U X 570MM PT", "qtde": 0, "unidade": "UND", "custo": 825, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "43L": { "codigo": "43L", "descricao": "RACK MONOBLOCO DE PISO 19POL X 24U 600X600 MM PT", "qtde": 1, "unidade": "UND", "custo": 1732.5, "tipo": "VENDA", "total": 1732.5, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "44L": { "codigo": "44L", "descricao": "PATCH PANEL MODULAR MULTILAN CAT.6 24 PORTAS T568A/B - 35030015 - FURUKAWA", "qtde": 3, "unidade": "UND", "custo": 986.5, "tipo": "VENDA", "total": 2959.5, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "45L": { "codigo": "45L", "descricao": "FRENTE FALSA 19 X 1U ABS CLICK PT", "qtde": 9, "unidade": "UND", "custo": 9.71, "tipo": "VENDA", "total": 87.39000000000001, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "46L": { "codigo": "46L", "descricao": "GUIA DE CABO FECHADO 2U MET. 70 MM 19 POL", "qtde": 3, "unidade": "UND", "custo": 40.07, "tipo": "VENDA", "total": 120.21000000000001, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "47L": { "codigo": "47L", "descricao": "BANDEJA FIXA 500 MM", "qtde": 3, "unidade": "UND", "custo": 93.57, "tipo": "VENDA", "total": 280.71, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "48L": { "codigo": "48L", "descricao": "REGUA DE 12 TOMADAS PARA RACK 20A", "qtde": 2, "unidade": "UND", "custo": 98.2, "tipo": "VENDA", "total": 196.4, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "49L": { "codigo": "49L", "descricao": "NOBREAK 2KVA", "qtde": 1, "unidade": "UND", "custo": 1122, "tipo": "VENDA", "total": 1122, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "50L": { "codigo": "50L", "descricao": "TOMADA 2 POLOS + TERRA 20A (PARA CONDULETE)", "qtde": 3, "unidade": "UND", "custo": 8.06, "tipo": "VENDA", "total": 24.18, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "51L": { "codigo": "51L", "descricao": "PARAFUSO / PORCA GAIOLA", "qtde": 50, "unidade": "UND", "custo": 1.2, "tipo": "VENDA", "total": 60, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "52L": { "codigo": "52L", "descricao": "ELETROCALHA LISA 100X50 MM  - BARRA 3 MTS CH.20", "qtde": 18, "unidade": "UND", "custo": 133.6, "tipo": "VENDA", "total": 2404.7999999999997, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "53L": { "codigo": "53L", "descricao": "TAMPA ELETROCALHA LISA 100X50 MM  - BARRA 3 MTS CH.20", "qtde": 6, "unidade": "UND", "custo": 18.15, "tipo": "VENDA", "total": 108.89999999999999, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "54L": { "codigo": "54L", "descricao": "SEPTO DIVISOR PARA ELETROCALHA  - H=50MM - CH 20", "qtde": 0, "unidade": "UND", "custo": 18.13, "tipo": "VENDA", "total": 0, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "55L": { "codigo": "55L", "descricao": "ELETRODUTO GALVANIZADO LEVE Ø3/4\" - BARRA 3M", "qtde": 185, "unidade": "UND", "custo": 80, "tipo": "VENDA", "total": 14800, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "56L": { "codigo": "56L", "descricao": "PERFILADO PERF.REFORÇADO G-PT 38X38X6000MM", "qtde": 20, "unidade": "UND", "custo": 129, "tipo": "VENDA", "total": 2580, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "57L": { "codigo": "57L", "descricao": "QUADRO ELÉTRICO (XXX DISJUNTORES) (COM OS DISJUNTORES)", "qtde": 1, "unidade": "UND", "custo": 580, "tipo": "VENDA", "total": 580, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "58L": { "codigo": "58L", "descricao": "ALUGUEL PLATAFORMA ELEVATÓRIA 12 M", "qtde": 2, "unidade": "UND", "custo": 4090, "tipo": "SERVIÇO", "total": 8180, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "59L": { "codigo": "59L", "descricao": "FRETE DE PLATAFORMA ELEVATÓRIA 12 M", "qtde": 2, "unidade": "UND", "custo": 1300, "tipo": "SERVIÇO", "total": 2600, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "60L": { "codigo": "60L", "descricao": "CUSTO COM JANTAR - ATÉ 4 TÉCNICOS", "qtde": 20, "unidade": "UND", "custo": 180, "tipo": "SERVIÇO", "total": 3600, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "61L": { "codigo": "61L", "descricao": "CUSTO COM HOSPEDAGEM - ATÉ 4 TÉCNICOS", "qtde": 20, "unidade": "UND", "custo": 500, "tipo": "SERVIÇO", "total": 10000, "imagem": "https://i.imgur.com/gUcc7iG.png" }, "62L": { "codigo": "62L", "descricao": "DISTANCIA\"", "qtde": 1144, "unidade": "UND", "custo": 1.8, "tipo": "SERVIÇO", "total": 2059.2000000000003, "imagem": "https://i.imgur.com/gUcc7iG.png" } }, "dados_orcam": { "analista": "Fellipe Leonny Ribeiro", "estado": "MG", "bairro": "RUA JOSE MARIA DE LACERDA", "cep": "32210120", "cidade": "CONTAGEM (MG)", "cliente_selecionado": "IMILE CONTAGEM", "cnpj": "47.173.294/0008-93", "condicoes": "A definir", "consideracoes": "", "contrato": "ORC_324", "data": "2025-01-13T15:24:38.615Z", "email_analista": "fellipe.leonny@acsolucoesintegradas.com.br", "email_vendedor": "vendaequipeinfra@acsolucoesintegradas.com.br", "garantia": "", "telefone_analista": "(71) 98791-6731", "telefone_vendedor": "(71) 3901-3655", "tipo_de_frete": "--", "vendedor": "GRUPO COSTA SILVA" }, "tabela": "orcamentos", "status": { "SrSBj": { "status": "COTAÇÃO PENDENTE", "historico": { "51ire": { "status": "PEDIDO DE SERVIÇO ANEXADO", "data": "13/01/2025, 11:20", "executor": "victorflaubert", "comentario": "", "anexos": {} }, "iBgBh": { "status": "FATURAMENTO PEDIDO DE SERVIÇO", "data": "13/01/2025, 11:20", "executor": "victorflaubert", "comentario": "", "anexos": {}, "requisicoes": [{ "codigo": "1L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "2", "requisicao": "Comprar" }, { "codigo": "2L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "11L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "47", "requisicao": "Comprar" }, { "codigo": "13L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "14L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "48", "requisicao": "Comprar" }, { "codigo": "15L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "3", "requisicao": "Comprar" }, { "codigo": "16L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "17L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "8", "requisicao": "Comprar" }, { "codigo": "18L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "19L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "20L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "21L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "22L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "6", "requisicao": "Comprar" }, { "codigo": "23L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "27L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "4", "requisicao": "Comprar" }, { "codigo": "28L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "114", "requisicao": "Comprar" }, { "codigo": "33L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "57", "requisicao": "Comprar" }, { "codigo": "38L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "48", "requisicao": "Comprar" }, { "codigo": "43L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "44L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "3", "requisicao": "Comprar" }, { "codigo": "45L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "9", "requisicao": "Comprar" }, { "codigo": "46L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "3", "requisicao": "Comprar" }, { "codigo": "47L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "3", "requisicao": "Comprar" }, { "codigo": "48L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "2", "requisicao": "Comprar" }, { "codigo": "49L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }, { "codigo": "50L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "3", "requisicao": "Comprar" }, { "codigo": "51L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "50", "requisicao": "Comprar" }, { "codigo": "53L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "6", "requisicao": "Comprar" }, { "codigo": "57L", "partnumber": ".", "tipo": "VENDA", "qtde_enviar": "1", "requisicao": "Comprar" }], "adicionais": {}, "total_sem_icms": "R$ 71.195,10", "total_com_icms": "R$ 89.553,59", "pedido_selecionado": "???" }, "a3ee2b1a-5252-44d7-b670-f90f7293752a": { "status": "COTAÇÃO PENDENTE", "data": "17/01/2025, 10:49", "executor": "Leonny", "cotacao": { "informacoes": { "id": "a3ee2b1a-5252-44d7-b670-f90f7293752a", "data": "17/01/2025", "hora": "10:49:00", "criador": "Leonny", "apelidoCotacao": "IMILE CONTAGEM" }, "dados": [{ "quantidade": 2, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "LEITORA DE RECONHECIMENTO FACIAL TELA 4.3 - BIOMETRIA 6000 FACES - 1.0.01.25.11944-0013", "numeroItem": 1 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "KIT ELETROÍMÃ (ELETROÍMA + BOTÃO DE SAÍDA + BOTÃO DE EMERGÊNCIA + FONTE NOBREAK + BATERIA SELADA)", "numeroItem": 2 }, { "quantidade": 47, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CAMERA IP BULLET 2MP IR 30M DWDR IP67", "numeroItem": 3 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CAMERA IP DOME 2MP IR50M WDR12ODB 2.8MM - 1.0.01.04.38262", "numeroItem": 4 }, { "quantidade": 48, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CAIXA DE JUNCAO PARA CAMERA BULLET DOME FISHEYE - 1.0.02.08.12455", "numeroItem": 5 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "SWITCH (COMUTADOR) 24 PORTAS PoE GIGABIT + 4 PC 8517.62.39 5 PORTAS SFP LAYER 2 370W - 1.0.01.20.10420-0028", "numeroItem": 6 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "DHI-NVR5864-EL", "numeroItem": 7 }, { "quantidade": 8, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "HDD SKYHAWK 8TB 3,5 SATA 256MB CACHE - ST8000VE001", "numeroItem": 8 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TECLADO E MOUSE SEM FIO MULTILASER SLIM 2.4GHZ ABNT 2 PRETO -", "numeroItem": 9 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TV / MONITOR 43\"", "numeroItem": 10 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CABO HDMI (ENTRE 5 A 15 MT)", "numeroItem": 11 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "SUPORTE DE TV FIXO", "numeroItem": 12 }, { "quantidade": 6, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "Access point indoor, WMM Ubiquiti UniFi AC Lite UAP-AC-LITE branco - BIVOLT", "numeroItem": 13 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "Servidor De Gerenciamento Ubiquiti Unifi Cloud Uck-g2-plus", "numeroItem": 14 }, { "quantidade": 4, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PATCH CORD U/UTP GIGALAN GREEN CAT.6 - LSZH - T568A/B - 2.5M - VERMELHO - 35123234 - FURUKAWA", "numeroItem": 15 }, { "quantidade": 114, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PATCH CORD U/UTP GIGALAN GREEN CAT.6 - LSZH - T568A/B - 0.5M - VERMELHO - 35123230 - FURUKAWA", "numeroItem": 16 }, { "quantidade": 57, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CONECTOR FEMEA MULTILAN CAT.6 T568A/B 90/180 - BRANCO - 35030600 - FURUKAWA", "numeroItem": 17 }, { "quantidade": 48, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CONFIGURAÇÃO DE CÂMERAS", "numeroItem": 18 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "RACK MONOBLOCO DE PISO 19POL X 24U 600X600 MM PT", "numeroItem": 19 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PATCH PANEL MODULAR MULTILAN CAT.6 24 PORTAS T568A/B - 35030015 - FURUKAWA", "numeroItem": 20 }, { "quantidade": 9, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "FRENTE FALSA 19 X 1U ABS CLICK PT", "numeroItem": 21 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "GUIA DE CABO FECHADO 2U MET. 70 MM 19 POL", "numeroItem": 22 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "BANDEJA FIXA 500 MM", "numeroItem": 23 }, { "quantidade": 2, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "REGUA DE 12 TOMADAS PARA RACK 20A", "numeroItem": 24 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "NOBREAK 2KVA", "numeroItem": 25 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TOMADA 2 POLOS + TERRA 20A (PARA CONDULETE)", "numeroItem": 26 }, { "quantidade": 50, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PARAFUSO / PORCA GAIOLA", "numeroItem": 27 }, { "quantidade": 6, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TAMPA ELETROCALHA LISA 100X50 MM  - BARRA 3 MTS CH.20", "numeroItem": 28 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "QUADRO ELÉTRICO (XXX DISJUNTORES) (COM OS DISJUNTORES)", "numeroItem": 29 }], "valorFinal": [], "operacao": "incluir", "status": "ativo" } }, "bKk6X": { "status": "FATURAMENTO PEDIDO DE SERVIÇO", "data": "28/01/2025, 10:20", "executor": "Leonny", "comentario": "REQUISIÇÃO DE INFRAESTRUTURA", "anexos": {}, "requisicoes": [{ "codigo": "29L", "partnumber": "?", "tipo": "VENDA", "qtde_enviar": "4", "requisicao": "Nada a fazer" }, { "codigo": "52L", "partnumber": "?", "tipo": "VENDA", "qtde_enviar": "8", "requisicao": "Nada a fazer" }], "adicionais": { "52L": { "TAMPA ENC.P/ELETROCALHA 100 ZINC.": { "partnumber": "GCS00530", "descricao": "TAMPA ENC.P/ELETROCALHA 100 ZINC.", "unidade": "UND", "qtde": 6 }, "EMENDA PARA CALHA": { "partnumber": "GCS006702", "descricao": "EMENDA PARA CALHA", "unidade": "UND", "qtde": 8 }, "Redução central de eletrocalha (100x50 para 50x50)": { "partnumber": "?", "descricao": "Redução central de eletrocalha (100x50 para 50x50)", "unidade": "UND", "qtde": 2 }, "Eletrocalha 50x50": { "partnumber": "?", "descricao": "Eletrocalha 50x50", "unidade": "UND", "qtde": 36 }, "Emendas para eletrocalha 50x50": { "partnumber": "?", "descricao": "Emendas para eletrocalha 50x50", "unidade": "UND", "qtde": 40 }, "Junção L para eletrocalha 50x50": { "partnumber": "?", "descricao": "Junção L para eletrocalha 50x50", "unidade": "UND", "qtde": 7 }, "Mão francesa para eletrocalha": { "partnumber": "?", "descricao": "Mão francesa para eletrocalha", "unidade": "UND", "qtde": 94 }, "Saída de eletrocalha 50x50 para eletroduto de 3/4\"": { "partnumber": "?", "descricao": "Saída de eletrocalha 50x50 para eletroduto de 3/4\"", "unidade": "UND", "qtde": 15 }, "Perfilado 38x38": { "partnumber": "?", "descricao": "Perfilado 38x38", "unidade": "UND", "qtde": 8 }, "Emenda de Perfilado 38x38": { "partnumber": "?", "descricao": "Emenda de Perfilado 38x38", "unidade": "UND", "qtde": 8 }, "Derivação de Perfilado 38x38 para Eletroduto 3/4\"": { "partnumber": "?", "descricao": "Derivação de Perfilado 38x38 para Eletroduto 3/4\"", "unidade": "UND", "qtde": 15 }, "Eletroduto 3/4\"": { "partnumber": "?", "descricao": "Eletroduto 3/4\"", "unidade": "UND", "qtde": 4 }, "Unidut cônico com bucha e arruela 3/4\"": { "partnumber": "?", "descricao": "Unidut cônico com bucha e arruela 3/4\"", "unidade": "UND", "qtde": 60 }, "TIRANTE 3/8": { "partnumber": "?", "descricao": "TIRANTE 3/8", "unidade": "UND", "qtde": 6 }, "Porca para tirante 3/8": { "partnumber": "?", "descricao": "Porca para tirante 3/8", "unidade": "UND", "qtde": 40 }, "ELETRODUTO GALVANIZADO LEVE 1\"": { "partnumber": "?", "descricao": "ELETRODUTO GALVANIZADO LEVE 1\"", "unidade": "UND", "qtde": 37 }, "Luvas de Emenda para letroduto 1\"": { "partnumber": "?", "descricao": "Luvas de Emenda para letroduto 1\"", "unidade": "UND", "qtde": 40 }, "Abraçadeira tipo cunha  para letroduto 1\"": { "partnumber": "?", "descricao": "Abraçadeira tipo cunha  para letroduto 1\"", "unidade": "UND", "qtde": 80 }, "Curva 90° para para eletroduto 1\"": { "partnumber": "?", "descricao": "Curva 90° para para eletroduto 1\"", "unidade": "UND", "qtde": 10 }, "Condulete tipo X para eletroduto 1\"": { "partnumber": "?", "descricao": "Condulete tipo X para eletroduto 1\"", "unidade": "UND", "qtde": 12 }, "Unidut cônico com bucha e arruela 1\"": { "partnumber": "?", "descricao": "Unidut cônico com bucha e arruela 1\"", "unidade": "UND", "qtde": 64 }, "TAMPA CEGA 3/4 P/ CONDULETE": { "partnumber": "?", "descricao": "TAMPA CEGA 3/4 P/ CONDULETE", "unidade": "UND", "qtde": 12 }, "ARRUELA LISA 3/4": { "partnumber": "?", "descricao": "ARRUELA LISA 3/4", "unidade": "UND", "qtde": 40 } } }, "total_sem_icms": "R$ 957,97", "total_com_icms": "R$ 1.088,60", "pedido_selecionado": "???" }, "c46db3b9-332d-44cc-b5da-4ae5afc64fed": { "status": "COTAÇÃO PENDENTE", "data": "28/01/2025, 12:19", "executor": "lucas", "cotacao": { "informacoes": { "id": "c46db3b9-332d-44cc-b5da-4ae5afc64fed", "data": "28/01/2025", "hora": "12:19:04", "criador": "lucas", "apelidoCotacao": "IMILE CONTAGEM" }, "dados": [{ "quantidade": 2, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "LEITORA DE RECONHECIMENTO FACIAL TELA 4.3 - BIOMETRIA 6000 FACES - 1.0.01.25.11944-0013", "numeroItem": 1 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "KIT ELETROÍMÃ (ELETROÍMA + BOTÃO DE SAÍDA + BOTÃO DE EMERGÊNCIA + FONTE NOBREAK + BATERIA SELADA)", "numeroItem": 2 }, { "quantidade": 47, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CAMERA IP BULLET 2MP IR 30M DWDR IP67", "numeroItem": 3 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CAMERA IP DOME 2MP IR50M WDR12ODB 2.8MM - 1.0.01.04.38262", "numeroItem": 4 }, { "quantidade": 48, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CAIXA DE JUNCAO PARA CAMERA BULLET DOME FISHEYE - 1.0.02.08.12455", "numeroItem": 5 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "SWITCH (COMUTADOR) 24 PORTAS PoE GIGABIT + 4 PC 8517.62.39 5 PORTAS SFP LAYER 2 370W - 1.0.01.20.10420-0028", "numeroItem": 6 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "DHI-NVR5864-EL", "numeroItem": 7 }, { "quantidade": 8, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "HDD SKYHAWK 8TB 3,5 SATA 256MB CACHE - ST8000VE001", "numeroItem": 8 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TECLADO E MOUSE SEM FIO MULTILASER SLIM 2.4GHZ ABNT 2 PRETO -", "numeroItem": 9 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TV / MONITOR 43\"", "numeroItem": 10 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CABO HDMI (ENTRE 5 A 15 MT)", "numeroItem": 11 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "SUPORTE DE TV FIXO", "numeroItem": 12 }, { "quantidade": 6, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "Access point indoor, WMM Ubiquiti UniFi AC Lite UAP-AC-LITE branco - BIVOLT", "numeroItem": 13 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "Servidor De Gerenciamento Ubiquiti Unifi Cloud Uck-g2-plus", "numeroItem": 14 }, { "quantidade": 4, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PATCH CORD U/UTP GIGALAN GREEN CAT.6 - LSZH - T568A/B - 2.5M - VERMELHO - 35123234 - FURUKAWA", "numeroItem": 15 }, { "quantidade": 114, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PATCH CORD U/UTP GIGALAN GREEN CAT.6 - LSZH - T568A/B - 0.5M - VERMELHO - 35123230 - FURUKAWA", "numeroItem": 16 }, { "quantidade": 57, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CONECTOR FEMEA MULTILAN CAT.6 T568A/B 90/180 - BRANCO - 35030600 - FURUKAWA", "numeroItem": 17 }, { "quantidade": 48, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "CONFIGURAÇÃO DE CÂMERAS", "numeroItem": 18 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "RACK MONOBLOCO DE PISO 19POL X 24U 600X600 MM PT", "numeroItem": 19 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PATCH PANEL MODULAR MULTILAN CAT.6 24 PORTAS T568A/B - 35030015 - FURUKAWA", "numeroItem": 20 }, { "quantidade": 9, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "FRENTE FALSA 19 X 1U ABS CLICK PT", "numeroItem": 21 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "GUIA DE CABO FECHADO 2U MET. 70 MM 19 POL", "numeroItem": 22 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "BANDEJA FIXA 500 MM", "numeroItem": 23 }, { "quantidade": 2, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "REGUA DE 12 TOMADAS PARA RACK 20A", "numeroItem": 24 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "NOBREAK 2KVA", "numeroItem": 25 }, { "quantidade": 3, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TOMADA 2 POLOS + TERRA 20A (PARA CONDULETE)", "numeroItem": 26 }, { "quantidade": 50, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "PARAFUSO / PORCA GAIOLA", "numeroItem": 27 }, { "quantidade": 6, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "TAMPA ELETROCALHA LISA 100X50 MM  - BARRA 3 MTS CH.20", "numeroItem": 28 }, { "quantidade": 1, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": ".", "nomeItem": "QUADRO ELÉTRICO (XXX DISJUNTORES) (COM OS DISJUNTORES)", "numeroItem": 29 }, { "quantidade": 4, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "CABO TRANSMISSAO DE DADOS MULTILAN U/UTP 24AWGX4P CAT.6 CM VM ROHS - 23400216 - FURUKAWA", "numeroItem": 30 }, { "quantidade": 6, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "GCS00530", "nomeItem": "TAMPA ENC.P/ELETROCALHA 100 ZINC.", "numeroItem": 31 }, { "quantidade": 8, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "GCS006702", "nomeItem": "EMENDA PARA CALHA", "numeroItem": 32 }, { "quantidade": 2, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Redução central de eletrocalha (100x50 para 50x50)", "numeroItem": 33 }, { "quantidade": 36, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Eletrocalha 50x50", "numeroItem": 34 }, { "quantidade": 40, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Emendas para eletrocalha 50x50", "numeroItem": 35 }, { "quantidade": 7, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Junção L para eletrocalha 50x50", "numeroItem": 36 }, { "quantidade": 94, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Mão francesa para eletrocalha", "numeroItem": 37 }, { "quantidade": 15, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Saída de eletrocalha 50x50 para eletroduto de 3/4\"", "numeroItem": 38 }, { "quantidade": 8, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Perfilado 38x38", "numeroItem": 39 }, { "quantidade": 8, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Emenda de Perfilado 38x38", "numeroItem": 40 }, { "quantidade": 15, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Derivação de Perfilado 38x38 para Eletroduto 3/4\"", "numeroItem": 41 }, { "quantidade": 4, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Eletroduto 3/4\"", "numeroItem": 42 }, { "quantidade": 60, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Unidut cônico com bucha e arruela 3/4\"", "numeroItem": 43 }, { "quantidade": 6, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "TIRANTE 3/8", "numeroItem": 44 }, { "quantidade": 40, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Porca para tirante 3/8", "numeroItem": 45 }, { "quantidade": 37, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "ELETRODUTO GALVANIZADO LEVE 1\"", "numeroItem": 46 }, { "quantidade": 40, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Luvas de Emenda para letroduto 1\"", "numeroItem": 47 }, { "quantidade": 80, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Abraçadeira tipo cunha  para letroduto 1\"", "numeroItem": 48 }, { "quantidade": 10, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Curva 90° para para eletroduto 1\"", "numeroItem": 49 }, { "quantidade": 12, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Condulete tipo X para eletroduto 1\"", "numeroItem": 50 }, { "quantidade": 64, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "Unidut cônico com bucha e arruela 1\"", "numeroItem": 51 }, { "quantidade": 12, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "TAMPA CEGA 3/4 P/ CONDULETE", "numeroItem": 52 }, { "quantidade": 40, "estoque": 0, "fornecedores": [], "tipoUnitario": "UND", "partnumber": "?", "nomeItem": "ARRUELA LISA 3/4", "numeroItem": 53 }], "valorFinal": [], "operacao": "incluir", "status": "ativo" } } }, "valor": 0, "tipo": "Serviço", "pedido": "???" } } }

async function especial() {

    let orccsss = await recuperarDados('dados_orcamentos')

    orccsss['recuperado_vict_13-01'] = orcamento_recuperado

    await inserirDados(orccsss, 'dados_orcamentos')

}

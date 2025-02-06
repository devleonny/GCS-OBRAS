document.addEventListener("DOMContentLoaded", function() {
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

    dados_orcamentos = descodificarUTF8(dados_orcamentos)

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
    await inserirDados(descodificarUTF8(dados_orcamentos), 'dados_orcamentos')

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

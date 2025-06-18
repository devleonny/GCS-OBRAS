let itens_adicionais = {}
let id_orcam = ''
let fluxograma = {}
let dadosNota = {}
let guiaTipo = {
    '11': 'Venda',
    '01': 'Venda de Serviço',
    '13': 'Devolução de Venda',
    '14': 'Remessa',
    '16': 'Nota Complementar de Saída'
}
const modelo = (valor1, valor2) => {
    return `
        <div style="display: flex; flex-direction: column; align-items: start; margin-bottom: 5px; width: 100%;">
            <label><strong>${valor1}</strong></label>
            <div style="width: 100%; text-align: left;">${valor2}</div>
        </div>
        `
}

const labelDestaque = (valor1, valor2) => {
    return `<label style="text-align: left;"><strong>${valor1}: </strong>${valor2}</label>`
}

const botao = (valor1, funcao, cor) => {
    return `
        <div class="contorno_botoes" style="box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.3); background-color: ${cor};" onclick="${funcao}">
            <label>${valor1}</label>
        </div>
        `}

let fluxogramaClone = {
    'ORÇAMENTOS': { cor: '#1CAF29' },
    'LOGÍSTICA': { cor: '#4CAF10' },
    'NFE - VENDAS': { cor: '#B05315' },
    'REQUISIÇÃO': { cor: '#B12425' },
    'MATERIAL ENVIADO': { cor: '#b17724' },
    'MATERIAL ENTREGUE': { cor: '#b17724' },
    'ATIVIDADE EM ANDAMENTO': { cor: '#b17724' },
    'CONCLUÍDO': { cor: '#ff4500' },
    'FATURADO': { cor: '#b17724' },
    'PAGAMENTO RECEBIDO': { cor: '#b17724' }
}

let fluxogramaPadrao = fluxograma = {
    'INCLUIR PEDIDO': { cor: '#4CAF50' },
    'PEDIDO': { cor: '#4CAF50' },
    'REQUISIÇÃO': { cor: '#B12425' },
    'MATERIAL SEPARADO': { cor: '#b17724' },
    'FATURADO': { cor: '#ff4500' },
    'MATERIAL ENVIADO': { cor: '#b17724' },
    'MATERIAL ENTREGUE': { cor: '#b17724' },
    'ATIVIDADE EM ANDAMENTO': { cor: '#b17724' },
    'COTAÇÃO PENDENTE': { cor: '#0a989f' },
    'COTAÇÃO FINALIZADA': { cor: '#0a989f' },
    'RETORNO DE MATERIAIS': { cor: '#aacc14' },
    'FINALIZADO': { cor: 'blue' },
}

// O objeto foi mesclado com o intuito de obter as formatações de ambos os aplicativos sem precisar criar um objeto para isso;
let fluxogramaMesclado = {
    ...fluxogramaClone,
    ...fluxogramaPadrao
}

verificarFluxograma()

function verificarFluxograma() {

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    modoClone ? fluxograma = fluxogramaClone : fluxograma = fluxogramaPadrao

}

async function sincronizarReabrir() {
    await recuperar_orcamentos()
    await abrirEsquema(id_orcam)
}

async function resumo_orcamentos() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let setores = JSON.parse(localStorage.getItem('dados_setores')) || {};
    let setores_por_nome = {};

    Object.keys(setores).forEach(id => {
        setores_por_nome[setores[id].nome] = setores[id];
    });

    let orcamentos_por_usuario = {};

    for (let id in dados_orcamentos) {
        let orcamento = dados_orcamentos[id];
        let analista = orcamento.dados_orcam.analista;

        if (!orcamentos_por_usuario[analista]) {
            orcamentos_por_usuario[analista] = {};
        }

        orcamentos_por_usuario[analista][id] = orcamento;
    }

    let linhas = '';

    for (let pessoa in orcamentos_por_usuario) {
        let orcamentos = orcamentos_por_usuario[pessoa];
        let contadores = {
            aprovados: 0,
            reprovados: 0,
            pendentes: 0,
            total: 0
        };

        for (let id in orcamentos) {
            let orc = orcamentos[id];

            if (orc.status) {
                let pedidos = orc.status;
                for (let ped in pedidos) {
                    let pedido = pedidos[ped];
                    if (String(pedido.pedido).includes('?')) {
                        contadores.pendentes += 1;
                    } else {
                        contadores.aprovados += 1;
                    }
                    contadores.total += 1;
                }
            } else {
                contadores.total += 1;
            }

            if (orc.aprovacao && Object.keys(orc.aprovacao).length > 0) {
                let responsaveis = orc.aprovacao;
                let valor = conversor(orc.total_geral);
                let gerente = false;
                let diretoria = false;

                if (responsaveis.Gerente && responsaveis.Gerente.status) {
                    gerente = responsaveis.Gerente.status === 'aprovado';
                }

                if (responsaveis.Diretoria && responsaveis.Diretoria.status) {
                    diretoria = responsaveis.Diretoria.status === 'aprovado';
                }

                if (valor > 21000) {
                    if (diretoria) {
                        contadores.aprovados += 1;
                    } else if (gerente) {
                        contadores.pendentes += 1;
                    } else {
                        contadores.reprovados += 1;
                    }
                } else {
                    gerente ? contadores.aprovados += 1 : contadores.reprovados += 1;
                }
            }
        }

        // Corrigindo o cálculo de pendentes:
        contadores.pendentes = contadores.total - (contadores.aprovados + contadores.reprovados);

        let porc = {
            apr: ((contadores.aprovados / contadores.total) * 100 || 0).toFixed(0),
            rep: ((contadores.reprovados / contadores.total) * 100 || 0).toFixed(0),
            pen: ((contadores.pendentes / contadores.total) * 100 || 0).toFixed(0)
        };

        function div_porc(porc, cor) {
            return `
                <div style="width: 100px; background-color: #dfdfdf; display: flex; align-items: center; justify-content: start; border-radius: 3px;">
                    <div style="width: ${porc}%; background-color: ${cor}; text-align: center; border-radius: 3px;">
                        <label style="color: black; margin-left: 3px;">${porc}%</label>
                    <div>
                </div>
            `;
        }

        linhas += `
            <tr style="background-color: white; color: #222;">
                <td>${pessoa}</td>
                <td>${setores_por_nome[pessoa]?.setor || '--'}</td>
                <td style="text-align: center;">${contadores.total}</td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <label>${contadores.aprovados}</label>
                        ${div_porc(porc.apr, '#4CAF50')}
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <label>${contadores.reprovados}</label>
                        ${div_porc(porc.rep, 'red')}
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <label>${contadores.pendentes}</label>
                        ${div_porc(porc.pen, 'orange')}
                    </div>
                </td>
            </tr>
        `;
    }

    let colunas = ['Analista', 'Setor', 'Total', 'Aprovados', 'Reprovados', 'Pendentes'];
    let ths = colunas.map(col => `<th>${col}</th>`).join('');

    let acumulado = `
        <img src="imagens/BG.png" style="height: 70px; position: absolute; top: 3px; left: 3px;">
        <label>Relatório de orçamentos por Pessoa</label>
        <div>
            <table class="tabela" style="table-layout: auto;">
                <thead>
                    <tr>${ths}</tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `;

    openPopup_v2(acumulado);
}

async function painelAdicionarPedido() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let cliente = dados_orcamentos[id_orcam].dados_orcam.cliente_selecionado

    let acumulado = `
        <div style="background-color: #d2d2d2; padding: 2vw;">
            <div style="display: flex; justify-content: space-evenly; align-items: center;">
                <label class="novo_titulo" style="color: #222" id="nome_cliente">${cliente}</label>
            </div>

            <hr style="width: 100%">

            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 5px; padding: 10px">

                ${modelo('Tipo de Pedido', `
                    <select id="tipo" class="pedido">
                        <option>Selecione</option>
                        <option>Serviço</option>
                        <option>Venda</option>
                        <option>Venda + Serviço</option>
                    </select>
                    `)}

                ${modelo('',
        `<div style="display: flex; gap: 10px; align-items: center; justify-content: center; align-items: center;">
                    <input type="checkbox" onchange="ocultar_pedido(this)" style="cursor: pointer; width: 30px; height: 30px;">
                    <label>Sem Pedido</label>
                </div>`)}

                <div id="div_pedidos">
                    ${modelo('Número do Pedido', '<input type="text" class="pedido" id="pedido">')}
                    ${modelo('Valor do Pedido', '<input type="number" class="pedido" id="valor">')}
                </div>
                
                ${modelo('Comentário', '<textarea rows="5" id="comentario_status"></textarea>')}

                <hr style="width: 100%">

                <button style="background-color: #4CAF50;" onclick="salvarPedido()">Salvar</button>

            </div>

        </div>
    `

    openPopup_v2(acumulado, "Novo Pedido", true)

}

async function painelAdicionarNotas() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dados_orcamentos[id_orcam];
    let cliente = orcamento.dados_orcam.cliente_selecionado;

    let acumulado = `
        <div id="painelNotas" style="background-color: #d2d2d2; display: flex; justify-content: center; flex-direction: column; align-items: start; padding: 2vw;">
            <div style="display: flex; justify-content: space-evenly; align-items: center; padding: 10px;">
                <label class="novo_titulo" style="color: #222" id="nome_cliente">${cliente}</label>
            </div>

            <hr style="width: 100%;">

            ${modelo('Digite o número da NF', 
                `
                <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <input class="pedido">
                        <select class="pedido">
                        <option>Venda/Remessa</option>
                        <option>Serviço</option>
                    </select>
                    <button onclick="buscarNFOmie(this)" style="background-color: #097fe6;">Buscar dados</button>
                </div>
                `)}

            <div id="detalhesNF" style="width: 100%;"></div>

        </div>
        `;

    openPopup_v2(acumulado, 'Vincular Nota Fiscal', true);

}

async function buscarNFOmie(elemento) {

    overlayAguarde()

    let numero = elemento.previousElementSibling.previousElementSibling.value
    let tipo = elemento.previousElementSibling.value == 'Venda/Remessa' ? 'venda_remessa' : 'serviço'
    let detalhesNF = document.getElementById('detalhesNF')
    detalhesNF.innerHTML = ''

    let resultado = await verificarNF(numero, tipo)

    if (resultado.faultstring) {
        dadosNota = {}
        removerOverlay()
        return detalhesNF.innerHTML = `${resultado.faultstring}`
    }

    let divParcelas = ''
    let parcelas = (resultado?.titulos || [])
        .map((parcela, i) =>
            `${modelo(`Parcela ${i + 1}`,
                `<label>${parcela.dDtVenc} <strong>${dinheiro(parcela.nValorTitulo)}</strong></label><br>`)}`)
        .join('')

    if (parcelas !== '') {
        divParcelas = `
        <hr style="width: 100%;">

        ${parcelas}

        <hr style="width: 100%;">
        `
    }

    dadosNota = {
        notaOriginal: resultado,
        tipo: tipo == 'serviço' ? 'Serviço' : guiaTipo[resultado.pedido.opPedido],
        nf: tipo == 'serviço' ? resultado.Cabecalho.nNumeroNFSe : resultado.ide.nNF,
        dEmi: tipo == 'serviço' ? resultado.Inclusao.cDataInclusao : resultado.ide.dEmi,
        hEmi: tipo == 'serviço' ? resultado.Inclusao.cHoraInclusao : resultado.ide.dReg,
        valor: tipo == 'serviço' ? resultado.Valores.nValorTotalServicos : resultado.total.ICMSTot.vNF,
        parcelas: resultado?.titulos || [],
    }

    detalhesNF.innerHTML = `
        ${modelo('Tipo', tipo == 'serviço' ? 'Serviço' : guiaTipo[resultado.pedido.opPedido])}
        ${modelo('Cliente', tipo == 'serviço' ? resultado.Cabecalho.cRazaoDestinatario : resultado.nfDestInt.cRazao)}
        ${modelo('CNPJ', tipo == 'serviço' ? resultado.Cabecalho.cCNPJDestinatario : resultado.nfDestInt.cnpj_cpf)}
        ${modelo('Total', dinheiro(tipo == 'serviço' ? resultado.Valores.nValorTotalServicos : resultado.total.ICMSTot.vNF))}
        
        ${divParcelas}

        ${modelo('Comentário', `<textarea style="width: 90%;" id="comentario"></textarea>`)}

        <div style="width: 100%; display: flex; justify-content: end; align-items: center;">
            <button onclick="salvarNota()" style="background-color: green;">Salvar</button>
        </div>
    `
    // trazer o pdf e o xml?
    removerOverlay()
}

async function salvarNota() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let chave = gerar_id_5_digitos()
    let comentario = document.getElementById('comentario').value

    if (Object.keys(dadosNota).length == 0) return openPopup_v2(mensagem(`A busca não recuperou dados`), 'ALERTA', true)

    if (!orcamento.status) orcamento.status = {}
    if (!orcamento.status.historico) orcamento.status.historico = {}
    if (!orcamento.status.historico[chave]) orcamento.status.historico[chave] = {}

    let dados = {
        status: 'FATURADO',
        data: data_atual('completa'),
        executor: acesso.usuario,
        comentario
    }

    dados = {
        ...dados,
        ...dadosNota
    }

    orcamento.status.historico[chave] = dados

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, dados)

    remover_popup()
    await abrirEsquema(id_orcam)

    itens_adicionais = {}
}

function removerPagamento(botao) {
    let div = botao.parentElement.parentElement.parentElement
    let labelAnterior = div.previousElementSibling.querySelector('label')

    if (labelAnterior.textContent != '') return

    div.remove()
}

function maisPagamentos(botao) {
    let divAnterior = botao.previousElementSibling;
    let label = divAnterior.querySelector('label')
    if (label.textContent != '') return
    divAnterior.insertAdjacentHTML('afterend', divAnterior.outerHTML);
}

function ocultar_pedido(elemento) {

    let pedido = document.getElementById('pedido')
    let valor = document.getElementById('valor')
    let div_pedidos = document.getElementById('div_pedidos')

    if (pedido && valor && div_pedidos) {

        if (elemento.checked) {
            div_pedidos.style.display = 'none'
            pedido.value = '???'
            valor.value = 0
        } else {
            div_pedidos.style.display = 'block'
            pedido.value = ''
            valor.value = 0
        }
    }
}

async function calcularRequisicao(sincronizar) {

    let tabela_requisicoes = document.getElementById('tabela_requisicoes')

    if (tabela_requisicoes) {
        let tbody = tabela_requisicoes.querySelector('tbody')
        let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
        let orcamento = dados_orcamentos[id_orcam]
        let itens = orcamento.dados_composicoes

        if (tbody) {
            let trs = tbody.querySelectorAll('tr')
            let total = 0

            for (tr of trs) {

                if (tr.style.display !== 'none') {
                    let tds = tr.querySelectorAll('td')
                    let codigo = tds[0].textContent
                    let item = itens[codigo]

                    if (!item) continue

                    let quantidadeDisponivel = 0
                    if (tds[4].querySelector('label.num')) {
                        quantidadeDisponivel = tds[4].querySelector('label.num').textContent
                    } else {
                        quantidadeDisponivel = tds[4].querySelector('label').textContent
                    }

                    if (tds[4].querySelector('input') && tds[4].querySelector('input').value > conversor(quantidadeDisponivel)) {
                        tds[4].querySelector('input').value = conversor(quantidadeDisponivel)
                    }

                    let tipo = 'Error 404'

                    if (sincronizar) { // Inicialmente para carregar os tipos;
                        tipo = item.tipo
                        tds[3].querySelector('select').value = tipo

                    } else {
                        tipo = tds[3].querySelector('select') ? tds[3].querySelector('select').value : tds[3].querySelector('label').textContent
                    }

                    let qtde = tds[4].querySelector('input') ? Number(tds[4].querySelector('input').value) : conversor(tds[4].textContent)

                    if (item.tipo_desconto) {
                        let desconto = item.tipo_desconto == 'Dinheiro' ? item.desconto : (item.custo * (item.desconto / 100))
                        desconto = desconto / item.qtde
                        item.custo = item.custo - desconto
                    }

                    let totalLinhas = item.custo * qtde
                    tds[5].querySelector('label').innerHTML = `${dinheiro(item.custo)}` // Unitário
                    tds[6].querySelector('label').innerHTML = `${dinheiro(totalLinhas)}` // Total

                    total += totalLinhas
                }
            }

            document.getElementById('total_requisicao').textContent = dinheiro(total)

        }
    }

}

function pesquisar_na_requisicao() {

    var pesquisa1 = document.getElementById('pesquisa1');

    if (pesquisa1) {

        var tabela = document.getElementById('tabela_requisicoes');
        var tbody = tabela.querySelector('tbody');
        var trs = tbody.querySelectorAll('tr');

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td');
            var mostrar_linha = false;

            tds.forEach(td => {

                var select = td.querySelector('select');
                var conteudo = select ? select.value : td.textContent;

                if (String(conteudo).toLowerCase().includes(String(pesquisa1.value).toLowerCase()) || pesquisa1.value == '') {
                    mostrar_linha = true;
                }
            });

            tr.style.display = mostrar_linha ? 'table-row' : 'none';
        });
    }
}

async function carregar_itens(apenas_visualizar, tipoRequisicao, chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    let orcamento = dados_orcamentos[id_orcam];
    let itensOrcamento = orcamento.dados_composicoes
    let linhas = '';

    if (!orcamento.dados_composicoes || Object.keys(orcamento.dados_composicoes).length == 0) {
        return '';
    }

    // Filtra os itens com base no tipo de requisição
    let itensFiltrados = [];
    let todos_os_itens = {
        infra: [],
        equipamentos: []
    }

    let requisicao = [] // Comparativo com a requisição já feita, se existir "chave"
    if (chave && orcamento.status && orcamento.status.historico && orcamento.status.historico[chave]) {
        requisicao = orcamento.status.historico[chave].requisicoes
    }

    if (apenas_visualizar) {

        for (id in requisicao) {
            let item = requisicao[id]

            item.descricao = itensOrcamento[item.codigo]?.descricao || '<label style="color: red;">Item Removido do Orçamento</label>'

            let descricao = item.descricao

            descricao = String(descricao).toLowerCase()

            if ((
                descricao.includes('eletrocalha') ||
                descricao.includes('eletroduto') ||
                descricao.includes('perfilado') ||
                descricao.includes('sealtubo')
            )) {
                todos_os_itens.infra.push(item)
            } else {
                todos_os_itens.equipamentos.push(item)
            }
        }

    } else {

        for (id in itensOrcamento) {
            let item = itensOrcamento[id]
            let descricao = itensOrcamento[item.codigo]?.descricao || 'N/A';

            if (requisicao.length > 0) {
                for (let itemRequisicao of requisicao) {
                    if (itemRequisicao.codigo == item.codigo) {
                        item = {
                            ...item,
                            ...itemRequisicao
                        }
                        break
                    }
                }
            }

            descricao = String(descricao).toLowerCase()

            if ((
                descricao.includes('eletrocalha') ||
                descricao.includes('eletroduto') ||
                descricao.includes('perfilado') ||
                descricao.includes('sealtubo')
            )) {
                todos_os_itens.infra.push(item)
            } else {
                todos_os_itens.equipamentos.push(item)
            }

        }

    }

    itensFiltrados = [...todos_os_itens.infra, ...todos_os_itens.equipamentos]

    if (tipoRequisicao == 'equipamentos') {
        itensFiltrados = todos_os_itens.equipamentos
    }

    if (tipoRequisicao == 'infraestrutura') {
        itensFiltrados = todos_os_itens.infra
    }

    let opcoes = ['Nada a fazer', 'Venda Direta', 'Estoque AC', 'Comprar', 'Enviar do CD', 'Fornecido pelo Cliente']
        .map(op => `<option>${op}</option>`)
        .join('')

    for (item of itensFiltrados) {
        let codigo = item.codigo
        let tipo = item.tipo
        let omie = dados_composicoes[codigo]?.omie || dados_composicoes[codigo]?.partnumber || ''
        linhas += `
            <tr class="lin_req" style="background-color: white;">
                <td style="text-align: center; font-size: 1.2em; white-space: nowrap;"><label>${codigo}</label></td>
                <td style="text-align: center;">
                    ${apenas_visualizar ? `<label style="font-size: 1.2em;">${omie}</label>` :
                `<input class="campoRequisicao" value="${omie}">`}
                </td>
                <td style="position: relative;">
                    <div style="position: relative; display: flex; flex-direction: column; gap: 5px; align-items: start;">
                        ${itensImportados.includes(codigo) ? `<label style="font-size: 0.7vw; color: white; position: absolute; top: 0; right: 0; background-color: red; border-radius: 3px; padding: 2px;">Imp</label>` : ''}
                        <label style="font-size: 0.8vw;"><strong>DESCRIÇÃO</strong></label>
                        <label style="text-align: left;">${item?.descricao || 'N/A'}</label>
                    </div>
                    ${apenas_visualizar ? '' : `<img src="imagens/construcao.png" style="position: absolute; top: 5px; right: 5px; width: 20px; cursor: pointer;" onclick="abrir_adicionais('${codigo}')">`}
                </td>
                <td style="text-align: center; font-size: 0.8em;">
                    ${apenas_visualizar ? `<label style="font-size: 1.2em; margin: 10px;">${item?.tipo || ''}</label>` : `
                        <select onchange="calcularRequisicao()" class="opcoesSelect">
                            <option value="SERVIÇO" ${tipo === 'SERVIÇO' ? 'selected' : ''}>SERVIÇO</option>
                            <option value="VENDA" ${tipo === 'VENDA' ? 'selected' : ''}>VENDA</option>
                            <option value="USO E CONSUMO" ${tipo === 'USO E CONSUMO' ? 'selected' : ''}>USO E CONSUMO</option>
                        </select>
                    `}
                </td>
                <td style="text-align: center;">
                    ${apenas_visualizar
                ? `<label style="font-size: 1.2em;">${item?.qtde_enviar || ''}</label>`
                : `
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2vw;">
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: start; gap: 5px;">
                                <label>Quantidade a enviar</label>
                                <input class="campoRequisicao" type="number" oninput="calcularRequisicao()" min="0" value="${item?.qtde_enviar || ''}">
                            </div>
                            <label class="num">${itensOrcamento[codigo]?.qtde || ''}</label>
                        </div>
                    `}
                </td>
                <td style="text-align: left; white-space: nowrap; font-size: 1.2em;">
                    <label></label>
                </td>
                <td style="text-align: left; white-space: nowrap; font-size: 1.2em;">
                    <label></label>
                </td>
                <td>
                    ${apenas_visualizar ? `<label style="font-size: 1.2em;">${item?.requisicao || ''}</label>` : `
                        <select class="opcoesSelect">${opcoes}</select>
                    `}
                </td>
            </tr>
        `
    };

    return linhas;

}

function abrirModalTipoRequisicao() {
    let modal = `
        <div style="text-align: center">
            <button onclick="escolherTipoRequisicao('equipamentos')" style="
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin-right: 10px;">
            Requisição de Equipamentos
            </button>
            <button onclick="escolherTipoRequisicao('infraestrutura')" style="
                background-color: #2196F3;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            ">Requisição de Infraestrutura</button>
        </div>
    `;

    openPopup_v2(modal, 'Escolha o tipo de Requisição', true);
}

function escolherTipoRequisicao(tipo) {
    fecharModalTipoRequisicao();
    detalharRequisicao(undefined, tipo); // Passa o tipo de requisição
}

function fecharModalTipoRequisicao() {
    const modal = document.getElementById('modalTipoRequisicao');
    if (modal) {
        modal.remove();
    }
}
function remover_linha_materiais(element) {
    element.closest('tr').remove()
}

async function abrir_adicionais(codigo) {

    var acumulado = `
        <div id="tela" style="display: flex; flex-direction: column; align-items: start; justify-content: center; background-color: white; border-radius: 3px; padding: 5px;">
            <div class="tabela_manutencao">
                <div class="linha"
                    style="background-color: #151749; color: white; border-top-left-radius: 3px; border-top-right-radius: 3px;">
                    <div style="width: 8vw;">
                        <label>Part Number</label>
                    </div>
                    <div style="width: 25vw;">
                        <label>Descrição</label>
                    </div>
                    <div style="width: 10vw;">
                        <label>Quantidade</label>
                    </div>
                    <div style="width: 20vw;">
                        <label>Unidade</label>
                    </div>
                    <div style="width: 10vw;">
                        <label>Estoque</label>
                    </div>
                    <div style="width: 10vw;">
                        <label>Estoque Usado</label>
                    </div>
                    <div style="width: 5vw;">
                        <label>Remover</label>
                    </div>
                </div>

                <div id="linhas_manutencao">
                    <div id="excluir_inicial" class="linha" style="width: 70vw;">
                        <label>Lista Vazia</label>
                    </div>
                </div>
            </div>

            <br>

            <div style="display: flex; align-items: center; width: 100% ">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <div onclick="adicionar_linha_manut()" class="contorno_botoes"
                        style="background-color: #151749; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/chamados.png" style="cursor: pointer; width: 2vw;">
                        <label>Adicionar Peça</label>
                    </div>
                    <div onclick="recuperar_estoque()" class="contorno_botoes" style="background-color: #151749; color: white;">
                        <img src="imagens/sync.png" style="cursor: pointer; width: 2vw;">
                        <label>Sincronizar Estoque</label>
                    </div>
                </div>

                <div onclick="salvar_itens_adicionais('${codigo}')" class="contorno_botoes"
                    style="background-color: green; display: flex; align-items: center; justify-content: center; gap: 10px; margin-left: auto;">
                    <img src="imagens/estoque.png" style="cursor: pointer; width: 2vw">
                    <label>Salvar</label>
                </div>
            </div>
        </div>
    `

    openPopup_v2(acumulado, 'Itens Adicionais', true)

    for (cd in itens_adicionais) {

        if (cd == codigo) {
            var adicionais = itens_adicionais[cd]

            for (ad in adicionais) {
                var dados = adicionais[ad]
                adicionar_linha_manut(ad, dados)
            }

        }
    }

}

function adicionar_linha_manut(ad, dados) {
    let tbody = document.getElementById('linhas_manutencao')
    let aleatorio = ad ? ad : gerar_id_5_digitos()

    let excluir_inicial = document.getElementById('excluir_inicial')
    if (excluir_inicial) {
        excluir_inicial.remove()
    }

    if (tbody) {
        let linha = `
        <div class="linha_completa">
            <div class="linha">
                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="text" value="${dados?.partnumber || ''}">
                </div>
                <div style="position: relative; width: 25vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent; height: 100%; resize: none; border: none; outline: none;" type="text" id="${aleatorio}" oninput="sugestoes(this, 'sug_${aleatorio}', 'estoque')">${dados?.descricao || ''}</textarea>
                    <div class="autocomplete-list" id="sug_${aleatorio}"></div> 
                    <input id="input_${aleatorio}" style="display: none;">
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="number" value="${dados?.qtde || ''}">
                </div>

                <div style="width: 20vw; height: 30px; background-color: #b5b5b5;">
                    <select style="width: 100%; background-color: transparent;">
                        <option ${dados?.unidade == 'UND' ? 'checked' : ''}>UND</option>
                        <option ${dados?.unidade == 'METRO' ? 'checked' : ''}>METRO</option>
                        <option ${dados?.unidade == 'CX' ? 'checked' : ''}>CX</option>
                        <option ${dados?.unidade == 'PCT' ? 'checked' : ''}>PCT</option>
                    </select>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 5vw; display: flex; align-items: center; justify-content: center;">
                    <img src="imagens/remover.png" onclick="remover_esta_linha(this)" style="width: 30px; cursor: pointer;">
                </div>
            </div>
            <hr style="width: 100%; margin: 0px;">
        </div>
        `
        tbody.insertAdjacentHTML('beforeend', linha)
    }
}

function remover_esta_linha(div_menor) {
    let linha_completa = div_menor.closest('.linha_completa')
    if (linha_completa) {
        linha_completa.remove()
    }
}

async function sugestoes(textarea, div, base) {

    let div_sugestoes = document.getElementById(div)
    let query = String(textarea.value).toUpperCase()
    div_sugestoes.innerHTML = '';

    if (query === '') {
        let campo = div.split('_')[1]
        let endereco = document.getElementById(`endereco_${campo}`)

        if (endereco) {
            document.getElementById(`codigo_${campo}`).innerHTML = ''
            endereco.innerHTML = ''
            return
        }

        return
    }

    let dados = await recuperarDados(`dados_${base}`) || {}
    let opcoes = ''

    for (id in dados) {
        let item = dados[id]
        let info;

        info = String(item.descricao)

        if (info.includes(query)) {
            opcoes += `
                    <div onclick="definir_campo(this, '${div}', '${id}')" class="autocomplete-item" style="font-size: 0.8vw;">${info}</div>
                `
        }
    }

    div_sugestoes.innerHTML = opcoes

}

async function definir_campo(elemento, div, id) {

    let campo = String(div).split('_')[1]

    let input_aleatorio = document.getElementById(`input_${campo}`)
    input_aleatorio.value = id

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let estoques = ['estoque', 'estoque_usado']

    let dic_quantidades = {}

    estoques.forEach(estoque => {

        let estoque_do_objeto = dados_estoque[id][estoque]
        let historicos = estoque_do_objeto.historico
        dic_quantidades[estoque] = estoque_do_objeto.quantidade


        for (his in historicos) {
            let historico = historicos[his]

            if (historico.operacao == 'entrada') {
                dic_quantidades[estoque] += historico.quantidade
            }

            if (historico.operacao == 'saida') {
                dic_quantidades[estoque] -= historico.quantidade
            }
        }

        let div_linha = input_aleatorio.parentElement.parentElement

        let inputs = div_linha.querySelectorAll('input, textarea, select')

        inputs[0].value = dados_estoque[id].partnumber
        inputs[5].value = dic_quantidades.estoque
        inputs[6].value = dic_quantidades.estoque_usado

    })

    document.getElementById(campo).value = elemento.textContent
    document.getElementById(div).innerHTML = '' // Sugestões
}

function salvar_itens_adicionais(codigo) {
    let tabela = document.getElementById('linhas_manutencao')
    let linhas = tabela.querySelectorAll('.linha')

    itens_adicionais[codigo] = {}

    let adicionais = itens_adicionais[codigo]

    linhas.forEach(linha => {
        let valores = linha.querySelectorAll('input, textarea, select')
        let cod = valores[1].id

        if (cod !== '') {
            if (!adicionais[cod]) {
                adicionais[cod] = {}
            }

            adicionais[cod].partnumber = valores[0].value
            adicionais[cod].descricao = valores[1].value
            adicionais[cod].qtde = valores[3].value
            adicionais[cod].unidade = valores[4].value
        }
    })

    mostrarItensAdicionais()
    remover_popup()
}


function mostrarItensAdicionais() {
    let tabela_requisicoes = document.getElementById('tabela_requisicoes')

    if (tabela_requisicoes) {

        let tbody = tabela_requisicoes.querySelector('tbody')
        let trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {
            var tds = tr.querySelectorAll('td')
            let codigo = tds[0]?.textContent || undefined
            if (codigo === "---") {
                return tr.remove()
            }

            let local = document.getElementById(`tabela_${codigo}`)
            if (local) {
                local.remove()
            }

            if (itens_adicionais[codigo]) {

                let adicionais = itens_adicionais[codigo]
                for (ad in adicionais) {

                    let adicional = adicionais[ad]

                    let linha = `
                    <tr class="linha-itens-adicionais">
                        <td style="text-align: center;">---</td>
                        <td>${adicional.partnumber}</td>
                        <td>${adicional.descricao}</td>
                        <td style="text-align: center;">ADICIONAL</td>
                        <td style="text-align: center;">${adicional.qtde}</td>
                        <td style="text-align: center;">---</td>
                        <td style="text-align: center;">---</td>
                        <td style="text-align: center;">
                            ${tds[7].querySelector("select")?.value || "---"}
                        </td>
                    </tr>
                    `
                    tr.insertAdjacentHTML("afterend", linha)
                }


            }

        })
    }
}

async function salvarPedido() {
    let comentario_status = document.getElementById('comentario_status')
    let valor = document.getElementById('valor')
    let tipo = document.getElementById('tipo')
    let pedido = document.getElementById('pedido')
    let chave = gerar_id_5_digitos()

    if (valor.value == '' || tipo.value == 'Selecione' || pedido.value == '') {

        return openPopup_v2(mensagem(`Existem campos em Branco`, 'ALERTA', true))

    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]

    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    if (!orcamento.status.historico) {
        orcamento.status.historico = {}
    }

    if (!orcamento.status.historico[chave]) {
        orcamento.status.historico[chave] = {}
    }

    let dados = {
        data: data_atual('completa'),
        executor: acesso.usuario,
        comentario: comentario_status.value,
        valor: Number(valor.value),
        tipo: tipo.value,
        pedido: pedido.value,
        status: 'PEDIDO'
    }

    orcamento.status.historico[chave] = dados

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, dados)

    remover_popup()
    await abrirEsquema(id_orcam)

}

async function salvar_requisicao(chave) {

    overlayAguarde()
    //Carregar dados existentes
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];
    //Inicializar estruturas se não existirem
    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    if (!orcamento.status.historico) {
        orcamento.status.historico = {}
    }

    //Criar novo lançamento
    var novo_lancamento = {
        status: 'REQUISIÇÃO',
        data: data_atual('completa'),
        executor: acesso.usuario,
        comentario: document.getElementById("comentario_status").value,
        requisicoes: [],
        adicionais: itens_adicionais,
        total_requisicao: document.getElementById("total_requisicao").textContent
    };

    //Processar itens da tabela
    var linhas = document.querySelectorAll('.lin_req');
    var lista_partnumbers = {};
    var temItensValidos = false;

    for (let linha of linhas) {
        let valores = linha.querySelectorAll('input, select');
        if (valores.length == 0) { continue }

        let tds = linha.querySelectorAll('td')
        let codigo = tds[0].textContent
        let partnumber = valores[0].value
        let tipo = valores[1].value
        let qtde = Number(valores[2].value)
        let requisicao = valores[3]?.value || ''

        if (partnumber == '' && qtde > 0) {
            document.getElementById("aguarde")?.remove();
            return openPopup_v2(`
                    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                        <label> Preencha os Códigos do Omie pendentes</label>
                    </div>
                `, 'Aviso', true);
        }

        // Para itens principais com valor > 0
        if (qtde > 0 || itens_adicionais[codigo]) {
            novo_lancamento.requisicoes.push({
                codigo: codigo,
                partnumber: partnumber,
                tipo: tipo,
                qtde_enviar: qtde,
                requisicao: requisicao,
            });

            lista_partnumbers[codigo] = partnumber;
            temItensValidos = true;
        }
    }

    // Se não houver itens válidos, mostra mensagem de erro
    if (!temItensValidos) {
        document.getElementById("aguarde")?.remove();
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Nenhum item válido foi informado</label>
            </div>
        `, 'Aviso', true);
    }

    //Atualizar dados localmente primeiro
    orcamento.status.historico[chave] = novo_lancamento
    dados_orcamentos[id_orcam] = orcamento;

    //Salvar no localstorage
    await inserirDados(dados_orcamentos, "dados_orcamentos");

    //Envio para nuvem
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, novo_lancamento)

    //Atualizar partnumbers se necessário
    if (orcamento.lpu_ativa !== 'MODALIDADE LIVRE') {
        atualizar_partnumber(lista_partnumbers)
    }

    itens_adicionais = {}
    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }
    remover_popup()
    await abrirEsquema(id_orcam)
}

function botao_novo_pedido(id) {
    return `
    <div class="contorno_botoes" style="background-color: ${fluxogramaMesclado['PEDIDO']?.cor}" onclick="painelAdicionarPedido()">
        <label>Novo <strong>Pedido </strong></label>
    </div>
`
}

async function abrirAtalhos(id) {

    let permitidos = ['adm', 'fin', 'diretoria', 'coordenacao', 'gerente']
    id_orcam = id

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id]
    let analista = orcamento.dados_orcam.analista
    let emAnalise = orcamento.aprovacao && orcamento.aprovacao.status !== 'aprovado'
    let botoesDisponiveis = ''

    let modeloBotoes = (imagem, nome, funcao) => {
        return `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="${funcao}">
            <img src="imagens/${imagem}.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">${nome}</label>
        </div>
        `
    }

    let termoArquivar = 'Arquivar Orçamento'
    let iconeArquivar = 'pasta'

    if (orcamento.arquivado) {
        termoArquivar = 'Desarquivar Orçamento'
        iconeArquivar = 'desarquivar'
    }

    if (emAnalise) {
        botoesDisponiveis += mensagem('Este orçamento precisa ser aprovado!')

    } else {
        botoesDisponiveis += `
        ${modeloBotoes('esquema', 'Histórico', `abrirEsquema('${id}')`)}
        ${modeloBotoes('painelcustos', 'Painel de Custos', `painelCustos('${id}')`)}
        ${modeloBotoes('pdf', 'Abrir Orçamento em PDF', `ir_pdf('${id}')`)}
        ${modeloBotoes('excel', 'Baixar Orçamento em Excel', `ir_excel('${id}')`)}
        ${modeloBotoes('duplicar', 'Duplicar Orçamento', `duplicar('${id}')`)}
        ${modeloBotoes(iconeArquivar, termoArquivar, `arquivarOrcamento('${id}')`)}
        `
    }

    if ((document.title !== 'Projetos' && analista == acesso.nome_completo) || (permitidos.includes(acesso.permissao))) {
        botoesDisponiveis += `
        ${modeloBotoes('apagar', 'Excluir Orçamento', `chamar_excluir('${id}')`)}
        ${modeloBotoes('editar', 'Editar Orçamento', `editar('${id}')`)}
        `
    }

    let acumulado = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: start; width: 30vw;">
            <label style="color: #222; font-size: 1.5vw;" id="cliente_status">${orcamento.dados_orcam.cliente_selecionado}</label>
            <hr style="width: 100%">
            ${botoesDisponiveis}
        </div>
    `

    openPopup_v2(acumulado, 'Opções do Orçamento')

}

async function arquivarOrcamento(idOrcamento) {

    overlayAguarde()
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[idOrcamento]

    if (orcamento.arquivado) {
        delete orcamento.arquivado
        deletar(`dados_orcamentos/${idOrcamento}/arquivado`)

    } else {

        let dados = {
            usuario: acesso.usuario,
            data: data_atual('completa')
        }

        orcamento.arquivado = dados
        enviar(`dados_orcamentos/${idOrcamento}/arquivado`, dados)
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await preencherOrcamentos()
    removerOverlay()

    openPopup_v2(mensagem(`${orcamento.arquivado ? 'Arquivado' : 'Desarquivado'} com sucesso!`, 'ARQUIVAMENTO'))

}

async function painelCustos(id) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]

    let guiaCores = {
        'USO E CONSUMO': '#097fe6',
        VENDA: '#B12425',
        SERVIÇO: 'green'
    }

    let estado = orcamento.dados_orcam.estado
    let lpu = String(orcamento.lpu_ativa).toLowerCase()
    let tabelas = {}
    let totalBruto = 0
    let totalDesconto = 0
    let totalLucro = 0
    let colunas = ['Código', 'Descrição', 'Quantidade', 'Margem (%)', 'Unitário Venda', 'Total Venda', 'Desconto', 'Custo Compra', 'Impostos<br>Frete Saída<br>Difal', 'Lucro Total']
    let ths = ''

    colunas.forEach(coluna => {
        ths += `<th>${coluna}</th>`
    })

    for ([codigo, composicao] of Object.entries(orcamento.dados_composicoes)) {

        if (!tabelas[composicao.tipo]) {
            tabelas[composicao.tipo] = { linhas: '', totais: { compra: 0, venda: 0, bruto: 0, imposto: 0, lucro: 0, desconto: 0 } }
        }

        let ativo = dados_composicoes?.[codigo]?.[lpu]?.ativo
        let historico = dados_composicoes?.[codigo]?.[lpu]?.historico
        let dadosPreco = historico?.[ativo] || {}
        let quantidade = composicao.qtde
        let total = composicao.custo * quantidade
        let desconto = 0
        if (composicao.tipo_desconto) desconto = composicao.tipo_desconto == 'Dinheiro' ? composicao.desconto : (composicao.desconto / 100) * total
        let icmsSaida = dadosPreco?.icms_creditado == 4 ? 4 : estado == 'BA' ? 20.5 : 12

        let dadosCalculo = {
            custo: dadosPreco?.custo || 0,
            valor: composicao.custo - (desconto / quantidade), // Valor de venda
            icms_creditado: dadosPreco?.icms_creditado,
            icmsSaida,
            modalidadeCalculo: composicao.tipo
        }

        let lucratividade = calcular(undefined, dadosCalculo)
        let freteSaidaImpostos = (lucratividade.freteVenda + lucratividade.totalImpostos) * quantidade
        let vendaLinha = composicao.custo * quantidade
        let compraLinha = (dadosPreco?.valor_custo || 0) * quantidade
        let custoLinha = freteSaidaImpostos + desconto + compraLinha
        let lucroLinha = vendaLinha - custoLinha
        let lucroPorcentagem = ((lucroLinha / vendaLinha) * 100).toFixed(0)

        tabelas[composicao.tipo].linhas += `
        <tr>
            <td>${codigo}</td>
            <td style="text-align: left; width: 20vw;">${composicao.descricao}</td>
            <td>${quantidade}</td>
            <td>${lucratividade?.margem || '--'}</td>
            <td>${dinheiro(composicao.custo)}</td>
            <td>${dinheiro(vendaLinha)}</td>
            <td>${dinheiro(desconto)}</td>
            <td>${dinheiro(compraLinha)}</td>
            <td>${dinheiro(freteSaidaImpostos)}</td>
            <td style="white-space: nowrap;">(${lucroPorcentagem}%) ${dinheiro(lucroLinha)}</td>
        </tr>
        `

        let totais = tabelas[composicao.tipo].totais
        totais.compra += compraLinha
        totais.venda += vendaLinha - desconto
        totais.bruto += vendaLinha
        totais.desconto += desconto
        totais.imposto += freteSaidaImpostos
        totais.lucro += lucroLinha

        totalLucro += lucroLinha
        totalBruto += vendaLinha
        totalDesconto += desconto
    }

    let modelo = (valor1, valor2) => {
        return `
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 5px; width: 100%;">
                <label style="font-size: 0.9vw;">${valor1}</label>
                <label style="font-size: 1.2vw;"><strong>${valor2}</strong></label>
            </div>
        `
    }

    let stringTabelas = ''
    let linhasTotais = ''

    for (let [tipo, tabela] of Object.entries(tabelas)) {

        let lucroPorcentagem = ((tabela.totais.lucro / tabela.totais.venda) * 100).toFixed(0)

        linhasTotais += `
        <tr>
            <td>${tipo}</td>
            <td>${dinheiro(tabela.totais.bruto)}</td>
            <td>${dinheiro(tabela.totais.desconto)}</td>
            <td>${dinheiro(tabela.totais.venda)}</td>
            <td style="white-space: nowrap;">(${lucroPorcentagem}%) ${dinheiro(tabela.totais.lucro)}</td>
        </tr>
        `
        tabela.linhas += `
        <tr>
            <td style="text-align: right;" colspan="5"><strong>TOTAIS</strong></td>
            <td>${dinheiro(tabela.totais.bruto)}</td>
            <td>${dinheiro(tabela.totais.desconto)}</td>
            <td>${dinheiro(tabela.totais.compra)}</td>
            <td>${dinheiro(tabela.totais.imposto)}</td>
            <td style="white-space: nowrap;">(${lucroPorcentagem}%) ${dinheiro(tabela.totais.lucro)}</td>
        </tr>
        `
        stringTabelas += `
        <div class="contornoTabela" style="background-color: ${guiaCores[tipo]};" onclick="exibirTabela(this)">
            <div style="display: flex; justify-content: end; align-items: center; gap: 5px; width: 100%;">
                <label style="font-size: 1.5vw; color: white; text-align: right;">${tipo}</label>
                <img src="imagens/pasta.png" style="width: 2vw;">
            </div>
            <table class="tabela" style="width: 100%; display: none;">
                <thead>
                    <tr>${ths}</tr>
                </thead>
                <tbody>
                    ${tabela.linhas}
                </tbody>
            </table>
        </div>
        `
    }

    acumulado = `
        <div style="background-color: #d2d2d2; display: flex; flex-direction: column; align-items: end; justify-content: center; padding: 2vw;">

            <br>
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 15px;">
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                    ${modelo('Cliente', orcamento.dados_orcam.cliente_selecionado)}
                    ${modelo('Localização', orcamento.dados_orcam.cidade)}
                </div>

                <div class="contornoTabela">
                    <label>Resumo</label>
                    <table class="tabela">
                        <thead>
                            <th>Tipo</th>
                            <th>Total Bruto</th>
                            <th>Total Desconto</th>
                            <th>Total Geral</th>
                            <th>Total Lucro</th>
                        </thead>
                        <tbody>
                            ${linhasTotais}
                            <td style="text-align: right;" colspan="2">${dinheiro(totalBruto)}</td>
                            <td>${dinheiro(totalDesconto)}</td>
                            <td>${dinheiro(totalBruto - totalDesconto)}</td>
                            <td>(${(totalLucro / (totalBruto - totalDesconto) * 100).toFixed(0)}%) ${dinheiro(totalLucro)}</td>
                        </tbody>
                    </table>
                </div>
            </div>
            <hr style="width: 100%;">
            <div>
                ${stringTabelas}
            </div>
        </div>
    `
    openPopup_v2(acumulado, 'Painel de Custos')

}

function exibirTabela(div) {

    let tabela = div.querySelector('table')
    let visibilidadeAtual = tabela.style.display

    tabela.style.display = visibilidadeAtual == 'none' ? 'table-row' : 'none'

}

function auxiliarDatas(data) {
    let [ano, mes, dia] = data.split('-')

    return `${dia}/${mes}/${ano}`
}

function elementosEspecificos(chave, historico) {

    let acumulado = ''
    let funcaoEditar = ''

    if (historico.status == 'REQUISIÇÃO') {

        funcaoEditar = `detalharRequisicao('${chave}')`
        acumulado = `
            ${labelDestaque('Total Requisição', historico.total_requisicao)}
            <div onclick="detalharRequisicao('${chave}', undefined, true)" class="label_requisicao">
                <img src="gifs/lampada.gif" style="width: 25px">
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; cursor: pointer;">
                    <label style="cursor: pointer;"><strong>REQUISIÇÃO DISPONÍVEL</strong></label>
                    <label style="font-size: 0.7em; cursor: pointer;">Clique Aqui</label>
                </div>
            </div>
        `
    } else if (historico.status == 'PEDIDO') {

        let modeloCampos = (valor1, campo, titulo) => {
            let opcoes = ['Serviço', 'Venda', 'Venda + Serviço']
                .map(op => `<option ${valor1 == op ? 'selected' : ''}>${op}</option>`)
                .join('');
            let estilo = `border-radius: 2px; font-size: 0.7vw; padding: 5px; cursor: pointer;`
            return `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 5px; width: 100%;">
                <label><strong>${titulo}:</strong></label>
                ${campo == 'tipo'
                    ? `<select style="${estilo}" onchange="atualizarPedido('${chave}', '${campo}', this)">${opcoes}</select>`
                    : `<input style="${estilo}" value="${valor1}" oninput="mostrarConfirmacao(this)">`}
                <img src="imagens/concluido.png" style="display: none; width: 1vw;" onclick="atualizarPedido('${chave}', '${campo}', this)">
            </div>
            `
        }

        acumulado = `
            <div style="gap: 2px; display: flex; align-items: start; justify-content: center; flex-direction: column;">
                ${modeloCampos(historico.pedido, 'pedido', 'Pedido')}
                ${modeloCampos(historico.valor, 'valor', 'Valor')}
                ${modeloCampos(historico.tipo, 'tipo', 'Tipo')}
            </div>
            `
    } else if (historico.status == 'FATURADO') {
        let divPacelas = ''
        
        let parcelas = (historico?.parcelas || [])
            .map(parcela => `Parcela ${parcela.nParcela} <br> ${labelDestaque(parcela.dDtVenc, dinheiro(parcela.nValorTitulo))}`)
            .join('')

        if (parcelas !== '') divPacelas = `
            <hr style="width: 100%;">
            ${parcelas}
        `

        acumulado = `
            ${labelDestaque('Nota', historico.nf)}
            ${labelDestaque('Tipo', historico.tipo)}
            ${labelDestaque('Valor Total', dinheiro(historico.valor))}
            ${historico?.notaOriginal?.cUrlDanfe !== '' ? botao('PDF', `abrirArquivo('${historico?.notaOriginal?.cUrlDanfe}')`, '#B12425') : ''}
            ${divPacelas}
        `
    } else if (historico.envio) {

        funcaoEditar = `envioMaterial('${chave}')`

        acumulado = `
            ${labelDestaque('Rastreio', historico.envio.rastreio)}
            ${labelDestaque('Transportadora', historico.envio.transportadora)}
            ${labelDestaque('Data de Saída', auxiliarDatas(historico.envio.data_saida))}
            ${labelDestaque('Data de Entrega', auxiliarDatas(historico.envio.previsao))}
        `
    }

    if (funcaoEditar !== '') {
        acumulado += `
        <div style="background-color: ${fluxogramaMesclado?.[historico.status]?.cor || '#808080'}" class="contorno_botoes" onclick="${funcaoEditar}">
            <img src="imagens/editar4.png">
            <label>Editar</label>
        </div>
        `
    }

    return acumulado

}

async function abrirEsquema(id) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id]
    let blocosStatus = {}
    let chave = ''

    for ([chave, historico] of Object.entries(orcamento.status?.historico || {})) {

        let statusCartao = historico.status
        let cor = fluxogramaMesclado[statusCartao]?.cor || '#808080'

        if (!blocosStatus[statusCartao]) blocosStatus[statusCartao] = ''

        blocosStatus[statusCartao] += `
            <div class="bloko" style="gap: 0px; border: 1px solid ${cor}; background-color: white; justify-content: center;">

                <div style="cursor: pointer; display: flex; align-items: start; flex-direction: column; background-color: ${cor}1f; padding: 3px; border-top-right-radius: 3px; border-top-left-radius: 3px;">
                    <span class="close" style="font-size: 2vw; position: absolute; top: 5px; right: 15px;" onclick="apagarStatusHistorico('${chave}')">&times;</span>

                    ${labelDestaque('Chamado', orcamento.dados_orcam.contrato)}
                    ${labelDestaque('Executor', historico.executor)}
                    ${labelDestaque('Data', historico.data)}
                    ${labelDestaque('Comentário', historico?.comentario || '')}
                    ${labelDestaque('Executor', historico.executor)}

                    ${elementosEspecificos(chave, historico)}

                    <div class="escondido" style="display: none;">
                        <div class="contorno_botoes" style="background-color: ${cor}">
                            <img src="imagens/anexo2.png">
                            <label>Anexo
                                <input type="file" style="display: none;" onchange="salvar_anexo('${chave}', this)" multiple>  
                            </label>
                        </div>

                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                            ${await carregar_anexos(chave)}
                        </div>

                        <div class="contorno_botoes" onclick="toggle_comentario('comentario_${chave}')" style="background-color: ${cor};">
                            <img src="imagens/comentario.png">
                            <label>Comentário</label>
                        </div>

                        <div id="comentario_${chave}" style="display: none; justify-content: space-evenly; align-items: center;">
                            <textarea placeholder="Comente algo aqui..."></textarea>
                            <label class="contorno_botoes" style="background-color: green;" onclick="salvar_comentario('${chave}')">Salvar</label>
                        </div>
                        <div id="caixa_comentarios_${chave}" style="display: flex; flex-direction: column;">
                            ${await carregar_comentarios(chave)}
                        </div>
                    </div>
                    <br>
                </div>

                <div style="cursor: pointer; background-color: ${cor}; border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; display: flex; align-items: center; justify-content: center;" onclick="exibirItens(this)">
                    <label style="color: white; font-size: 0.9vw;">ver mais</label>
                </div>

            </div>
        `
    }

    let blocos = ''
    for ([statusCartao, div] of Object.entries(blocosStatus)) {
        blocos += `
            <div style="display: flex; flex-direction: column; justify-content: start; align-items: center; width: 16vw; gap: 10px;">
                ${div}
            </div>
            `
    }

    let linha1 = `
        <div style="display: flex; align-items: end; justify-content: start; gap: 10px;">

            ${botao('Atualizar Página', `sincronizarReabrir()`, '#222')}

            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; gap: 2px;">
                <label>Status atual</label>
                <select onchange="alterar_status(this)" style="font-size: 1vw; border-radius: 3px; padding: 3px;">
                    ${Object.keys(fluxograma).map(fluxo => `
                        <option ${orcamento.status?.atual == fluxo ? 'selected' : ''}>${fluxo}</option>
                    `).join('')}
                </select>
            </div>
 
            <label class="botaoAlterarStatusOrcam" onclick="mostrarHistoricoStatus()">HISTÓRICO STATUS</label>
        </div>
        `

    let levantamentos = Object.entries(orcamento?.levantamentos || {})
        .map(([iDlevantamento, levantamento]) => `${criarAnexoVisual(levantamento.nome, levantamento.link, `excluir_levantamento('${iDlevantamento}', '${iDlevantamento}')`)}`)
        .join('')

    let divLevantamentos = `
        <div style="display: flex; justify-content: start; align-items: start; flex-direction: column; gap: 2px; margin-right: 20px; margin-top: 10px;">

            <div class="contorno_botoes" for="adicionar_levantamento">
                <img src="imagens/anexo2.png" style="width: 2vw;">
                <label style="font-size: 0.8vw; color: white;"> Anexar levantamento
                    <input type="file" id="adicionar_levantamento" style="display: none;"
                        onchange="salvar_levantamento('${id}')">
                </label>
            </div>

            ${levantamentos}
        </div>`

    let acumulado = `

        <div style="min-height: max-content; height: 70vh; overflow: auto; background-color: #d2d2d2; display: flex; flex-direction: column; gap: 15px; min-width: 70vw; padding: 2vw;">

            <div style="display: flex; flex-direction: column; gap: 10px; padding: 3px;">

                ${linha1}

                <hr style="width: 100%;">

                <div style="display: flex; gap: 10px; font-size: 0.9vw;">
                    
                    ${botao('Novo Pagamento', `tela_pagamento()`, '#097fe6')}
                    ${botao('Novo Pedido', `painelAdicionarPedido()`, '#4CAF50')}
                    ${botao('Nova Requisição', `abrirModalTipoRequisicao()`, '#B12425')}
                    ${botao('Nova Nota Fiscal', `painelAdicionarNotas()`, '#ff4500')}

                    ${(acesso.permissao == 'adm' || acesso.setor == 'LOGÍSTICA')
            ? botao('Novo Envio de Material', `envioMaterial()`, '#b17724')
            : ''}

                    ${botao('Produtos sem Requisição', `mostrarItensPendentes()`, '')}
                </div>
            </div>

            <div class="container-blocos">
                ${divLevantamentos}
                ${blocos}
            </div>
        </div>`

    let titulo = `${orcamento.dados_orcam.contrato} - ${orcamento.dados_orcam.cliente_selecionado}`
    openPopup_v2(acumulado, titulo)

}

async function mostrarItensPendentes() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let itens_no_orcamento = orcamento.dados_composicoes
    let valoresTotais = {}

    let acumulado = ''
    let linhas = ''

    if (orcamento.status) {

        Object.values(orcamento.status.historico).forEach(item => {

            if (item.status.includes("REQUISIÇÃO")) {

                item.requisicoes.forEach(item2 => {

                    if (valoresTotais[item2.codigo]) {

                        valoresTotais[item2.codigo].qtdeTotal += Number(item2.qtde_enviar);

                    } else {

                        valoresTotais[item2.codigo] = {

                            qtdeTotal: Number(item2.qtde_enviar),
                            codigoRequisicao: item2.codigo

                        }

                    }

                })

            }

        })

    }

    Object.values(itens_no_orcamento).forEach(item => {

        let deduzirTotal = 0

        if (valoresTotais[item.codigo]) {

            deduzirTotal = valoresTotais[item.codigo].qtdeTotal

        }

        linhas += `
        
            <tr style="border: 1px solid black;">
                <td>${item.codigo}</td>
                <td>${dados_composicoes[item?.codigo]?.descricao}</td>
                <td>${item.qtde}</td>
                <td>${item.qtde - deduzirTotal}</td>
            </tr>

        `

    })

    acumulado += `

        <table class="tabela">
            <thead>
                <th>Codigo</th>
                <th>Item</th>
                <th>Itens Orçados</th>
                <th>Itens Pendentes</th>
            </thead>
            <tbody>${linhas}</tbody>
        </table>
    
    `

    openPopup_v2(acumulado, "Itens Pendentes", true)

}

async function atualizarPedido(chave, campo, imgSelect) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let orcamento = dados_orcamentos[id_orcam]

    let elemento = campo == 'tipo' ? imgSelect : imgSelect.previousElementSibling;

    orcamento.status.historico[chave][campo] = elemento.value

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/${campo}`, elemento.value)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    campo !== 'tipo' ? imgSelect.style.display = 'none' : ''
}

function mostrarConfirmacao(elemento) {
    let img = elemento.nextElementSibling;
    img.style.display = 'block'
}

async function alterar_status(select, id) {
    let tela_orcamentos = false;
    if (id !== undefined) {
        id_orcam = id;
        tela_orcamentos = true;
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dados_orcamentos[id_orcam];

    // Só prosseguir se o status realmente mudou
    if (orcamento.status?.atual !== select.value) {
        // Inicializar estrutura se não existir
        if (!orcamento.status) {
            orcamento.status = {};
        }

        if (!orcamento.status.historicoStatus) {
            orcamento.status.historicoStatus = []
        }

        let statusAnterior = dados_orcamentos[id_orcam].status?.atual || '--'
        orcamento.status.atual = select.value

        // Adicionar registro de mudança de status
        const registroStatus = {
            data: data_atual('completa'),
            de: statusAnterior,
            para: select.value,
            usuario: acesso.usuario
        };

        orcamento.status.historicoStatus.unshift(registroStatus);
        orcamento.status.atual = select.value;

        // Atualizar dados
        await inserirDados(dados_orcamentos, 'dados_orcamentos');
        enviar(`dados_orcamentos/${id_orcam}/status/atual`, select.value);
        enviar(`dados_orcamentos/${id_orcam}/status/historicoStatus`, orcamento.status.historicoStatus);
    }

    if (tela_orcamentos) {
        filtrar_orcamentos(undefined, undefined, undefined, true);
        select.parentElement.parentElement.style.display = 'none';
    } else {
        await preencherOrcamentos();
    }

}

async function mostrarHistoricoStatus() {
    const dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    const orcamento = dados_orcamentos[id_orcam];

    if (!orcamento?.status?.historicoStatus || orcamento.status.historicoStatus.length === 0) {
        openPopup_v2('<div style="padding:20px;text-align:center;">Nenhuma alteração de status registrada.</div>', 'Histórico de Status', true);
        return;
    }

    const html = `
    <div style="width: 600px; max-width: 90vw; max-height: 70vh; overflow: auto;">
        
        <table class="tabela">
            <thead>
                <tr style="background-color: #d2d2d2;">
                    <th style="padding: 10px; text-align: left;">Data</th>
                    <th style="padding: 10px; text-align: left;">Status Anterior</th>
                    <th style="padding: 10px; text-align: left;">Novo Status</th>
                    <th style="padding: 10px; text-align: left;">Alterado por</th>
                </tr>
            </thead>
            <tbody>
                ${orcamento.status.historicoStatus.map((registro, index) => `
                    <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background-color: white;' : ''}">
                        <td style="padding: 10px;">${registro.data}</td>
                        <td style="padding: 10px;">${registro.de}</td>
                        <td style="padding: 10px;">${registro.para}</td>
                        <td style="padding: 10px;">${registro.usuario}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    `;

    openPopup_v2(html, 'Histórico de Alterações de Status', true);
}

// Add this function to handle closing the popup and returning to main view
function fecharPopup() {
    remover_popup();

    // Verifique se deve voltar pra o
    const lastView = JSON.parse(localStorage.getItem('lastStatusView'));
    if (lastView && lastView.view === 'status') {
        abrirEsquema(lastView.id_orcam);
    }
}

function exibirItens(div) {

    let elemento = div.previousElementSibling;
    let label = div.querySelector('label')
    let itens = elemento.querySelectorAll('.escondido');

    itens.forEach(item => {
        let exibir = item.style.display !== 'flex';
        item.style.display = exibir ? 'flex' : 'none';

        exibir ? label.textContent = 'menos' : label.textContent = 'ver mais'

    });
}

async function iniciar_cotacao(id_orcam) {

    overlayAguarde()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let itens_do_orcamento = dados_orcamentos[id_orcam].dados_composicoes
    let todos_os_status = orcamento.status.historico
    let itens = {} // Dicionário;
    let tem_requisicao = false

    for (chave2 in todos_os_status) {

        let status = todos_os_status[chave2]

        if (String(status.status).includes('REQUISIÇÃO')) {

            if (status.requisicoes) {

                tem_requisicao = true

            }

        }

    }

    if (!tem_requisicao) {
        return openPopup_v2(mensagem('Precisa ter uma requisição para criar uma cotação'), 'ALERTA')
    }

    for (chave2 in todos_os_status) {
        let his = todos_os_status[chave2]
        if (String(his.status).includes('REQUISIÇÃO')) {

            let requisicao = his.requisicoes

            requisicao.forEach(item => {

                let it = item.codigo

                if (!itens[it]) {
                    itens[it] = {
                        quantidade: 0,
                        estoque: 0,
                        fornecedores: []
                    }
                }

                itens[it].tipoUnitario = dados_composicoes[it] !== undefined ? dados_composicoes[it].unidade : itens_do_orcamento[it].unidade
                itens[it].partnumber = item.partnumber
                itens[it].quantidade += conversor(item.qtde_enviar)
                itens[it].nomeItem = dados_composicoes[it] !== undefined ? dados_composicoes[it].descricao : itens_do_orcamento[it].descricao

            })

            let adicionais = his.adicionais || {}

            for (ad in adicionais) {

                let pais = adicionais[ad]

                if (itens[ad]) {
                    delete itens[ad]
                }

                for (filho in pais) {

                    let pais_e_filhos = pais[filho]

                    if (!itens[filho]) {
                        itens[filho] = {
                            quantidade: 0,
                            estoque: 0,
                            fornecedores: []
                        }
                    }

                    itens[filho].tipoUnitario = pais_e_filhos.unidade
                    itens[filho].partnumber = pais_e_filhos.partnumber
                    itens[filho].quantidade += conversor(pais_e_filhos.qtde)
                    itens[filho].nomeItem = filho

                }

            }

        }
    }

    // Converter dicionário em lista; 

    let itens_em_lista = []
    let i = 1
    for (it in itens) {
        itens[it].numeroItem = i
        itens_em_lista.push(itens[it])
        i++
    }

    // Fim

    let id_compartilhado = gerar_id_5_digitos()
    let data = new Date()
    let nova_cotacao = {
        informacoes: {
            id: id_compartilhado,
            data: data.toLocaleDateString('pt-BR'),
            hora: `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}:${String(data.getSeconds()).padStart(2, '0')}`,
            criador: acesso.usuario,
            apelidoCotacao: orcamento.dados_orcam.cliente_selecionado,
            idOrcamento: id_orcam,
            chavePedido: chave
        },
        dados: itens_em_lista,
        valorFinal: [],
        operacao: 'incluir',
        status: 'Pendente'
    }

    let data_completa = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    orcamento.status.historico[id_compartilhado] = {
        status: 'COTAÇÃO PENDENTE',
        data: data_completa,
        executor: acesso.usuario,
        cotacao: nova_cotacao
    };

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${id_compartilhado}`, orcamento.status.historico[id_compartilhado])
    await enviar(`dados_cotacao/${id_compartilhado}`, nova_cotacao)

    document.getElementById("aguarde").remove()

    await abrirEsquema(id_orcam)

}

async function valores_manuais() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];

    let acumulado = `

    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, sans-serif;">

    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">

        <label class="novo_titulo">Gestão de Custos</label>

    </div>
    
    <div style="padding: 20px; border-radius: 8px; text-align: center;">
        <label for="nome-valor-manual" style="display: block; margin-bottom: 5px; font-weight: bold;">Nome do Valor Manual:</label>
        <input type="text" id="nome-valor-manual" placeholder="Digite o nome" 
            style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px;">

        <label for="valor-manual" style="display: block; margin-bottom: 5px; font-weight: bold;">Valor Manual:</label>
        <input type="number" id="valor-manual" placeholder="Digite o valor" 
            style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px;">

        <button onclick="salvarValorManual()" 
            style="width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
            Salvar
        </button>
    </div>

    </div>

    `

    openPopup_v2(acumulado)

}

async function salvarValorManual() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let nome = document.getElementById("nome-valor-manual").value.trim();
    let valor = document.getElementById("valor-manual").value.trim();

    if (!nome || !valor) {
        openPopup_v2("⚠️ Por favor, preencha todos os campos.");
        return;
    }

    if (!dados_orcamentos[id_orcam].valoresManuais) {
        dados_orcamentos[id_orcam].valoresManuais = {};
    }

    let idValorManual = gerar_id_5_digitos(); // 🔥 Gera um ID único

    dados_orcamentos[id_orcam].valoresManuais[idValorManual] = {
        nomeValorManual: nome,
        valorManual: parseFloat(valor)
    };

    // 🔥 Limpa os inputs após salvar
    document.getElementById("nome-valor-manual").value = "";
    document.getElementById("valor-manual").value = "";

    remover_popup()

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/valoresManuais/${idValorManual}`, dados_orcamentos[id_orcam].valoresManuais[idValorManual]);

    abrirEsquema(id_orcam)

}

async function removerValorManual(id_orcam, idValorManual) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};

    if (!dados_orcamentos[id_orcam]?.valoresManuais || !dados_orcamentos[id_orcam].valoresManuais[idValorManual]) {
        return;
    }

    // 🗑️ Remove o valor manual do objeto
    delete dados_orcamentos[id_orcam].valoresManuais[idValorManual];

    // 🔥 Atualiza o localStorage e envia para a nuvem
    await inserirDados(dados_orcamentos, 'dados_orcamentos');
    await deletar(`dados_orcamentos/${id_orcam}/valoresManuais/${idValorManual}`);

    // 🔄 Atualiza a exibição do orçamento
    abrirEsquema(id_orcam);
}

function calcularResultado(orcamento) {
    if (!orcamento || !orcamento.total_geral) return "Erro nos dados";

    // 🔥 Converte total_geral para número (removendo "R$ " e convertendo vírgula para ponto)
    let totalGeral = parseFloat(orcamento.total_geral.replace("R$ ", "").replace(/\./g, "").replace(",", "."));

    if (isNaN(totalGeral)) return "Erro no total_geral";

    // 🔥 Soma os valores de valoresManuais
    let somaValoresManuais = Object.values(orcamento.valoresManuais || {})
        .reduce((soma, item) => soma + (parseFloat(item.valorManual) || 0), 0);

    // 🔥 Subtrai a soma dos valores manuais do total geral
    let resultadoFinal = totalGeral - somaValoresManuais;

    return resultadoFinal;
}


async function retorno_de_materiais(chave) {

    chave == undefined ? chave = gerar_id_5_digitos() : chave

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];
    let linhas = ''

    Object.values(orcamento.dados_composicoes).forEach(item => {
        linhas += `
        <tr>
            <td data-codigo="${item.codigo}">${dados_composicoes[item?.codigo]?.descricao}</td>
            <td style="text-align: center;">${item.qtde}</td>
            <td><input style="background-color: #4CAF50; padding: 3px; border-radius: 3px;" type="number"></td>
        </tr>
        `
    })

    let acumulado = `
    <table id="tabelaRetornoMateriais" class="tabela" style="width: 50vw;">
        <thead>
            <th>Descrição</th>
            <th>Quantidade Disponivel</th>
            <th>Quantidade para Retorno</th>
        </thead>
        <tbody>
            ${linhas}
        </tbody>
    </table>
    <hr style="width: 80%;">
    <button style="background-color: #4CAF50;" onclick="salvar_materiais_retorno('${chave}')">Salvar</button>
    `
    openPopup_v2(acumulado, 'Retorno de Materiais', true)

}

async function salvar_materiais_retorno(chave) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];

    let tabelaRetornoMateriais = document.querySelector("#tabelaRetornoMateriais")

    let inputsQtde = tabelaRetornoMateriais.querySelectorAll(".dados_qtde_retorno")
    let tdsDescricao = tabelaRetornoMateriais.querySelectorAll(".dados_descricao_retorno")

    let dadosMateriaisRetorno = {};

    for (let i = 0; i < inputsQtde.length; i++) {
        let codigo = tdsDescricao[i].dataset.codigo; // Obtém o texto da descrição
        let quantidade = Number(inputsQtde[i].value) || 0; // Obtém o valor do input

        dadosMateriaisRetorno[codigo] = quantidade;
    }

    remover_popup()

    let data_completa = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    orcamento.status.historico[chave] = {
        status: 'RETORNO DE MATERIAIS',
        data: data_completa,
        executor: acesso.usuario,
        materiaisRetorno: dadosMateriaisRetorno
    };

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    remover_popup()
    await abrirEsquema(id_orcam)

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, orcamento.status.historico[chave])

}

async function registrarEnvioMaterial(chave) {
    let campos = ['rastreio', 'transportadora', 'custo_frete', 'nf', 'comentario_envio', 'volumes', 'data_saida', 'previsao']
    let status = {
        envio: {}
    }

    campos.forEach(campo => {
        let info = document.getElementById(campo)
        let valor = info.value

        if (info.type == 'number') {
            valor = Number(info.value)
        }

        if (campo == 'comentario_envio') {
            status.comentario = valor
        } else {
            status.envio[campo] = valor
        }
    })

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let historico = dados_orcamentos[id_orcam].status.historico
    let st = 'MATERIAL ENVIADO'

    status.executor = acesso.usuario
    status.data = data_atual('completa')
    status.status = st

    historico[chave] = status

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, status)

    remover_popup()
    await abrirEsquema(id_orcam)

}

function calcular_quantidades(requisicoes, itens_no_orcamento) {

    if (itens_no_orcamento == undefined) {

        return { cor: '', label_porcentagem: '' }
    }

    var porcentagem = {
        qtde_enviar: 0,
        qtde_orcamento: 0
    }

    if (!dicionario(itens_no_orcamento)) {
        var novo_itens_do_orcamento = {};

        itens_no_orcamento.forEach(it => {

            if (!novo_itens_do_orcamento[it.codigo]) {
                novo_itens_do_orcamento[it.codigo] = it;
            }
        });

        itens_no_orcamento = novo_itens_do_orcamento;
    }

    let totalQtde = Object.values(itens_no_orcamento).reduce((acc, item) => acc + Number(item.qtde), 0);

    totalQtde = conversor(totalQtde)

    porcentagem.qtde_orcamento = totalQtde

    requisicoes.forEach(req => {

        var qtde_enviar = conversor(req.qtde_enviar)

        porcentagem.qtde_enviar += qtde_enviar

    })

    var valor_porcentagem = (porcentagem.qtde_enviar / porcentagem.qtde_orcamento) * 100
    var cor = '#B12425'
    var label_porcentagem = `${valor_porcentagem.toFixed(0)}% Preenchido`

    if (!porcentagem.qtde_enviar || !porcentagem.qtde_orcamento) {
        label_porcentagem = 'Em branco'
    }

    if (valor_porcentagem > 90) {
        cor = 'green'
    } else if (valor_porcentagem > 50) {
        cor = 'orangered'
    } else if (valor_porcentagem > 20) {
        cor = 'orange'
    }

    var infos = {
        label_porcentagem: label_porcentagem,
        cor: cor
    }

    return infos

}

function calcular_quantidades_v2(historico, itens_no_orcamento) {
    let quantidades = {}

    for (chave in historico) {
        if (historico[chave].requisicoes) {
            var requisicoes = historico[chave].requisicoes

            requisicoes.forEach(item => {
                if (!quantidades[item.codigo]) {
                    quantidades[item.codigo] = {
                        qtde_enviar: 0,
                        qtde_orcamento: 0,
                        porcentagem: 0
                    };
                }

                var qtde_enviar = conversor(item.qtde_enviar)
                var qtde_orcamento = conversor(itens_no_orcamento[item.codigo].qtde)
                var porcentagem = qtde_enviar / qtde_orcamento

                quantidades[item.codigo].qtde_enviar += qtde_enviar
                quantidades[item.codigo].qtde_orcamento += qtde_orcamento
                quantidades[item.codigo].porcentagem += porcentagem
            })
        }
    }

    return quantidades
}

function confirmar_exclusao_comentario(id_comentario, chave) {
    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Excluir o comentário?</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <button onclick="excluir_comentario('${id_comentario}', '${chave}')" style="background-color: green">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)
}

async function excluir_comentario(id_comentario, chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let comentarios = dados_orcamentos[id_orcam].status.historico[chave].comentarios || {}

    delete comentarios[id_comentario]

    remover_popup()
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/comentarios/${id_comentario}`)
    await carregar_comentarios(chave)
}

async function carregar_comentarios(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let comentss = ''
    if (dados_orcamentos[id_orcam].status.historico[chave]) {
        let comentarios = dados_orcamentos[id_orcam].status.historico[chave].comentarios || {}

        for (it in comentarios) {
            let item = comentarios[it]
            let excluir = ''

            if (acesso.usuario == item.usuario || acesso.permissao == 'adm') {
                excluir = ` •<label onclick="confirmar_exclusao_comentario('${it}', '${chave}')" style="text-decoration: underline; cursor: pointer;"> Excluir</label>`
            }

            comentss += `
            <div class="anexos2" style="width: 95%; margin: 0px; margin-top: 5px;">
                <label>${item.comentario.replace(/\n/g, '<br>')}
                <br><strong>${item.data} • ${item.usuario}</strong>${excluir}</label>
            </div>
            `
        }
    }

    let div_caixa = document.getElementById(`caixa_comentarios_${chave}`)
    if (div_caixa) {
        div_caixa.innerHTML = comentss
    }

    return comentss
}

async function salvar_comentario(chave) {
    toggle_comentario(`comentario_${chave}`)
    let id_div = `comentario_${chave}`
    let textarea = document.getElementById(id_div).querySelector('textarea')
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]

    var id = gerar_id_5_digitos()

    var comentario = {
        id: id,
        comentario: textarea.value,
        data: data_atual('completa'),
        usuario: acesso.usuario
    }

    let cartao = orcamento.status.historico[chave]
    if (!cartao.comentarios) {
        cartao.comentarios = {}
    }

    cartao.comentarios[id] = comentario

    textarea.value = ''

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/comentarios/${id}`, comentario)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await carregar_comentarios(chave)
}

function toggle_comentario(id) {
    var elemento = document.getElementById(id)
    if (elemento.style.display == 'none') {
        elemento.style.display = 'flex'
    } else {
        elemento.style.display = 'none'
    }
}

function pesquisar_pagamentos(input) {
    let div_do_input = input.parentElement
    let div_pagamentos = div_do_input.nextElementSibling
    let todos_os_pagamentos = div_pagamentos.querySelector('.escondido')
    let pesquisa = String(input.value).toLowerCase()

    if (todos_os_pagamentos) {
        var divs = todos_os_pagamentos.querySelectorAll('div')

        divs.forEach(div => {
            var mostrar = false
            var labels = div.querySelectorAll('label')

            labels.forEach(label => {
                if (label.textContent.toLocaleLowerCase().includes(pesquisa) || pesquisa == '') {
                    mostrar = true
                }
            })

            if (mostrar) {
                div.style.display = 'flex'
            } else {
                div.style.display = 'none'
            }
        })
    }
}

async function excluirAnexo(chave, id_anexo, img) {

    remover_popup()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    delete dados_orcamentos[id_orcam].status.historico[chave].anexos[id_anexo]

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    await abrirEsquema(id_orcam)

    deletar(`dados_orcamentos/${id_orcam}/status/historico/anexos/${id_anexo}`)

    img.parentElement.remove()

}

async function chamar_excluir(id) {
    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Deseja realmente excluir o orçamento?</label>
        </div>
        <button style="background-color: green;" onclick="apagar('${id}')">Confirmar</button>
        `)
}

async function detalharRequisicao(chave, tipoRequisicao, apenas_visualizar) {

    if (!chave) chave = gerar_id_5_digitos()

    let usuario = acesso.usuario
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];
    let menu_flutuante = ''
    let nome_cliente = orcamento.dados_orcam.cliente_selecionado

    // Carrega os itens adicionais se existirem
    itens_adicionais = {}
    let comentarioExistente = ''

    if (chave && orcamento.status && orcamento.status.historico && orcamento.status.historico[chave]) {
        let cartao = orcamento.status.historico[chave]

        if (apenas_visualizar) {
            menu_flutuante = `
            <div class="menu_flutuante" id="menu_flutuante">
                <div class="icone" onclick="gerarpdf('${orcamento.dados_orcam.cliente_selecionado}', '${cartao.pedido}')">
                    <img src="imagens/pdf.png">
                    <label>PDF</label>
                </div>
            </div> 
            `
        }

        if (cartao.adicionais) {
            itens_adicionais = cartao.adicionais
        }

        if (cartao.comentario) {
            comentarioExistente = cartao.comentario
        }

        if (cartao.requisicoes) {
            requisicoesExistente = cartao.requisicoes
        }
    }

    let campos = ''
    let toolbar = ''

    if (!apenas_visualizar) {
        toolbar += `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; background-color: #151749; border-top-left-radius: 5px; border-top-right-radius: 5px">
            <img src="imagens/pesquisar.png" style="width: 25px; height: 25px; padding: 5px;">
            <input id="pesquisa1" style="padding: 10px; border-radius: 5px; margin: 10px; width: 50%;" placeholder="Pesquisar" oninput="pesquisar_na_requisicao()">
        </div>
        `

        campos = `
        <div class="contorno" style="width: 500px;">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; font-size: 1.0em;">Dados da Requisição</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                
                <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                    <label><strong>Data</strong> </label> <label id="data_status">${data_atual('completa')}</label>
                </div>

                <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                    <label><strong>Executor</strong> </label> <label id="usuario_status">${usuario}</label>
                </div>

                <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                    <label><strong>Comentário</strong></label>
                    <textarea rows="3" id="comentario_status" style="width: 80%;">${comentarioExistente}</textarea>
                </div>

                <label class="contorno_botoes" style="background-color: #4CAF50; " onclick="salvar_requisicao('${chave}')">Salvar Requisição</label>
            </div>
        </div>
        `
    }

    let acumulado = `
    ${menu_flutuante}

    <div style="display: flex; align-items: center; justify-content: center; width: 100%; background-color: #151749; border-radius: 3px;">
        <img src="https://i.imgur.com/AYa4cNv.png" 
    style="height: 100px;">
    </div>

    <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
        <h1>REQUISIÇÃO DE COMPRA DE MATERIAL</h1>
    </div>

    <div style="display: flex; justify-content: left; align-items: center; margin: 10px;">

        ${campos}
            
        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; font-size: 1.0em;">Dados do Cliente</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; justify-content: start; align-items: start; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                <label style="color: #222" id="nome_cliente"><strong>Cliente</strong> ${nome_cliente}</label>
                <label style="display: none" id="id_orcam"></label>
                <label style="color: #222"><strong>CNPJ</strong> ${orcamento.dados_orcam.cnpj}</label>
                <label style="color: #222"><strong>Endereço</strong> ${orcamento.dados_orcam.bairro}</label>
                <label style="color: #222"><strong>Cidade</strong> ${orcamento.dados_orcam.cidade}</label>
                <label style="color: #222"><strong>Estado</strong> ${orcamento.dados_orcam.estado}</label>
                <label style="color: #222"><strong>Chamado</strong> ${orcamento.dados_orcam.contrato}</label>
                <label style="color: #222"><strong>Condições</strong> ${orcamento.dados_orcam.condicoes}</label>
            </div>
        </div>

        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">Total</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                <div style="display: flex; gap: 10px;">
                    <label id="total_requisicao"></label> 
                </div>
            </div>
        </div>

    </div>

    <div id="tabela_itens" style="width: 100%; display: flex; flex-direction: column; align-items: left;">

    <div class="contorno">
        ${toolbar}
        <table class="tabela" id="tabela_requisicoes" style="width: 100%; font-size: 0.8em; table-layout: auto; border-radius: 0px;">
            <thead>
                <th style="text-align: center;">Código</th>
                <th style="text-align: center;">OMIE / Partnumber</th>
                <th style="text-align: center;">Informações do Item</th>                        
                <th style="text-align: center;">Tipo</th>         
                <th style="text-align: center;">Quantidade</th>
                <th style="text-align: center;">Valor Unitário</th>     
                <th style="text-align: center;">Valor Total</th>         
                <th style="text-align: center;">Requisição</th>
            </thead>
            <tbody>
                ${await carregar_itens(apenas_visualizar, tipoRequisicao, chave)}
            </tbody>
        </table>
    <div>
    `
    openPopup_v2(acumulado, 'Requisição', true)

    // Preenche os campos com os dados existentes se estiver editando    
    await calcularRequisicao()
    mostrarItensAdicionais()
}

function close_chave() {
    abrirAtalhos(id_orcam)
    document.getElementById('alerta').remove()
}

async function salvar_anexo(chave, input) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (input.files.length === 0) {
        openPopup_v2('Nenhum arquivo selecionado...');
        return;
    }

    let anexos = await anexo_v2(input) // Retorna uma lista [{}, {}]

    anexos.forEach(anexo => {

        if ((dados_orcamentos[id_orcam].status.historico[chave].anexos && Array.isArray(dados_orcamentos[id_orcam].status.historico[chave].anexos) || !dados_orcamentos[id_orcam].status.historico[chave].anexos)) {
            dados_orcamentos[id_orcam].status.historico[chave].anexos = {};
        }

        let id = gerar_id_5_digitos()

        dados_orcamentos[id_orcam].status.historico[chave].anexos[id] = anexo
        enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/anexos/${id}`, anexo)
    })

    await inserirDados(dados_orcamentos, 'dados_orcamentos');

    let div = input.parentElement.parentElement.nextElementSibling // input > label > div pai > div seguinte;

    div.innerHTML = await carregar_anexos(chave)

}

async function carregar_anexos(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let anexos_divs = ''
    let anexos = orcamento.status.historico[chave]?.anexos || {}

    if (anexos) {

        for (id in anexos) {
            var anexo = anexos[id]
            anexos_divs += criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexo('${chave}', '${id}', this)`)
        }
    }

    return anexos_divs

}

async function apagarStatusHistorico(chave) {

    remover_popup()
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let criador = dados_orcamentos[id_orcam]?.status?.historico[chave]?.executor || '';
    let permitidos = acesso.permissao == 'adm' || acesso.usuario == criador;

    if (!permitidos) openPopup_v2(mensagem(`Você não tem permissão para excluir este item`), 'ALERTA', true)

    delete dados_orcamentos[id_orcam].status.historico[chave]
    await deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await abrirEsquema(id_orcam)
}

async function atualizar_partnumber(dicionario) {
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    for (codigo in dicionario) {
        let partnumber = dicionario[codigo]

        if (dados_composicoes[codigo]) {
            dados_composicoes[codigo].omie = partnumber
        }

        await enviar(`dados_composicoes/${codigo}/omie`, partnumber)
    }

    await inserirDados(dados_composicoes, 'dados_composicoes')
}

function getComputedStylesAsText(element) {
    const computedStyles = window.getComputedStyle(element);
    let styleText = "";
    for (let property of computedStyles) {
        styleText += `${property}: ${computedStyles.getPropertyValue(property)}; `;
    }
    return styleText;
}

if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { shell: electronShell } = require('electron');
    shell = electronShell;
}

let ipcRenderer = null;
if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { ipcRenderer: ipc } = require('electron');
    ipcRenderer = ipc;

    ipcRenderer.on('open-save-dialog', (event, { htmlContent, nomeArquivo }) => {
        ipcRenderer.send('save-dialog', { htmlContent, nomeArquivo });
    });
}

async function gerarpdf(cliente, pedido) {

    var janela = document.querySelectorAll('.janela')
    janela = janela[janela.length - 1]

    var htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
        <style>
        body {
            font-family: 'Poppins', sans-serif;
        }
        .titulo {
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #151749;
            padding: 10px;
            font-size: 1.5em;
            color: white;
            height: 20px;
        }
        .contorno {
            border-radius: 5px;
            height: max-content;
            border: 1px solid #151749;
            padding: 5px;
            margin: 5px;
        }
            
        .tabela {
            border-collapse: collapse;
            border-radius: 5px;
            overflow: hidden;
        }
        
        .tabela th {
            background-color: #151749;
            color: white;
        }

        .tabela th, .tabela td {
            margin: 5px;
            text-align: left;
        }

        .tabela td {
            background-color: #99999940;
        }

        label {
            margin: 5px;
        }
        
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            header,
            footer {
                display: none !important;
            }

            .table-container {
                margin-right: 0;
            }
        }
        </style>
    </head>
    <body>
        ${janela.innerHTML}
    </body>
    </html>`;

    if (pedido.includes("?")) {
        pedido = ""
    }

    await gerar_pdf_online(htmlContent, `REQUISICAO_${cliente}_${pedido}`);

}

async function envioMaterial(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let envio = {}
    let comentario = ''
    if (chave !== undefined) {
        envio = orcamento.status.historico[chave].envio
        comentario = orcamento.status.historico[chave].comentario
    } else {
        chave = gerar_id_5_digitos()
    }

    let transportadoras = ['JAMEF', 'CORREIOS', 'RODOVIÁRIA', 'JADLOG', 'AÉREO', 'OUTRAS']
    let opcoes_transportadoras = ''

    transportadoras.forEach(transp => {
        let marcado = envio.transportadora == transp ? 'selected' : ''
        opcoes_transportadoras += `
            <option ${marcado}>${transp}</option>
        `
    })

    let acumulado = `
    <div style="width: 30vw; background-color: #d2d2d2; padding: 2vw; display: flex; align-items: start: justify-content: center; flex-direction: column;">

        ${modelo('Número de rastreio', `<input class="pedido" id="rastreio" value="${envio?.rastreio || ""}">`)}
        ${modelo('Transportadora',
        `<select class="pedido" id="transportadora">
                ${opcoes_transportadoras}
            </select>`)}

        ${modelo('Custo do Frete', `<input class="pedido" type="number" id="custo_frete" value="${envio.custo_frete}">`)}
        ${modelo('Nota Fiscal', `<input class="pedido" id="nf" value="${envio.nf || ""}">`)}
        ${modelo('Comentário', `<textarea class="pedido" id="comentario_envio" style="border: none; width: 152px; height: 70px;">${comentario}</textarea>`)}
        ${modelo('Quantos volumes', `<input class="pedido" type="number" id="volumes" value="${envio.volumes}">`)}
        ${modelo('Data de Saída', `<input class="pedido" type="date" id="data_saida" value="${envio.data_saida}">`)}
        ${modelo('Data de Entrega', `<input class="pedido" type="date" id="previsao" value="${envio.previsao}">`)}

        <hr style="width: 100%;">

        <button style="background-color: #4CAF50;" onclick="registrarEnvioMaterial('${chave}')">Salvar</button>
      
    </div>
    `
    openPopup_v2(acumulado, 'Envio de Material', true)
}

function mostrarElementoSeTiverPermissao({ listaDePermissao, elementoHTML }) {
    const permissaoOuSetorDoUsuario = acesso.permissao || acesso.setor;
    const usuarioTemPermissao = listaDePermissao.includes(permissaoOuSetorDoUsuario);

    return usuarioTemPermissao ? elementoHTML : '';
}
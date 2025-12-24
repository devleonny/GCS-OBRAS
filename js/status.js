let itensAdicionais = {}
let id_orcam = ''
let dadosNota = {}
let dados_estoque = {}

const fluxograma = [
    'SEM STATUS',
    'COTAÇÃO',
    'LEVANTAMENTO',
    'ORC PENDENTE',
    'ORC ENVIADO',
    'ORC APROVADO',
    'ACORDO FINANCEIRO',
    'PENDENTE CERTIFICADO',
    'REQUISIÇÃO',
    'PEND INFRA',
    'PEND ASSISTÊNCIA TÉCNICA',
    'NFE VENDA',
    'ENVIADO',
    'ENTREGUE',
    'AGENDAMENTO',
    'EM ANDAMENTO',
    'OBRA PARALISADA',
    'PENDENTE OS/RELATÓRIO',
    'CONCLUÍDO',
    'FATURADO',
    'ATRASADO',
    'PAG RECEBIDO',
    'LOCAÇÃO',
    'LPU PARCEIRO',
    'ORC REPROVADO'
]

const coresST = {
    'PEDIDO': { cor: '#4CAF50' },
    'LPU PARCEIRO': { cor: '#0062d5' },
    'REQUISIÇÃO': { cor: '#B12425' },
    'MATERIAL SEPARADO': { cor: '#b17724' },
    'FATURADO': { cor: '#ff4500' },
    'MATERIAL ENVIADO': { cor: '#b17724' },
    'MATERIAL ENTREGUE': { cor: '#b17724' }
}

async function sincronizarReabrir() {
    await atualizarOrcamentos()
    await abrirEsquema(id_orcam)
}

function aprovadoEmail(input) {

    const pedido = document.getElementById('pedido')
    pedido.value = input.checked ? 'Aprovado Via E-mail' : ''
    pedido.contentEditable = !input.checked

}

async function painelAdicionarPedido() {

    const opcoes = ['Locação', 'Serviço', 'Venda', 'Venda + Serviço', 'POC']
    const linhas = [
        {
            texto: 'Tipo de Pedido',
            elemento: `
                <select id="tipo">
                    ${opcoes.map(op => `<option>${op}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Aprovado por E-mail',
            elemento: '<input type="checkbox" style="width: 2rem; height: 2rem;" onclick="aprovadoEmail(this)">'
        },
        {
            texto: 'Número do Pedido',
            elemento: `<input type="text" id="pedido">`
        },
        {
            texto: 'Valor do Pedido',
            elemento: `<input type="number" id="valor">`
        },
        {
            texto: 'Comentário',
            elemento: '<textarea rows="5" id="comentario_status"></textarea>'
        }
    ]

    const botoes = [
        { texto: 'Salvar', funcao: 'salvarPedido()', img: 'concluido' }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Novo Pedido' })
    form.abrirFormulario()

}

async function painelAdicionarNotas() {

    const acumulado = `
        <div id="painelNotas" style="${vertical}; background-color: #d2d2d2; padding: 2vw;">

            <div style="width: 100%; ${horizontal}; gap: 5px;">
                <input class="pedido" placeholder="Digite o número da NF">

                <select class="pedido">
                    <option>Venda/Remessa</option>
                    <option>Serviço</option>
                </select>

                <select class="pedido">
                    <option>AC</option>
                    <option>HNW</option>
                    <option>HNK</option>
                </select>
                <button onclick="buscarNFOmie(this)" style="background-color: #097fe6;">Buscar dados</button>
                
                <span style="width: 2vw;">ou</span>

                <button onclick="htmlFormularioAvulso()" style="background-color: #B12425;">Inserir Manualmente</button>
            </div>
                
            <div id="detalhesNF" style="width: 100%;"></div>

        </div>
        `;

    popup(acumulado, 'Vincular Nota Fiscal', true);

}

function htmlFormularioAvulso() {

    const painelNotas = document.getElementById('painelNotas')

    painelNotas.innerHTML = `
        <hr style="width: 100%;">
        <div style="${vertical}; gap: 5px;">
            ${modelo('Número da Nota', '<input id="nf" class="inputParcelas">')}
            ${modelo('Tipo', `<select id="tipo" class="inputParcelas">${['Venda', 'Serviço', 'Remessa'].map(op => `<option>${op}</option>`).join('')}</select>`)}
            ${modelo('Valor', 'R$ <input type="number" id="valor" placeholder="0,00" class="inputParcelas">')}

            <hr style="width: 100%;">
            <label style="${horizontal}; gap: 5px;">
                <strong>Parcelas</strong> 
                <img src="imagens/baixar.png" style="width: 1.5vw; cursor: pointer;" onclick="maisParcela()">
            </label>
            
            <div class="blocoParcelas"></div>

            <hr style="width: 100%;">
            ${botao('Salvar', `salvarNotaAvulsa()`, 'green')}
        </div>
    `
    maisParcela()
}

function maisParcela() {

    const htmlParcela = `
        <div name="parcela" style="${horizontal}; gap: 5px;">
            <label>R$</label>
            <input type="number" placeholder="0,00" class="inputParcelas">
            <input type="date" class="inputParcelas">
            <img src="imagens/cancel.png" style="width: 1.5vw; cursor: pointer;" onclick="this.parentElement.remove()">
        </div>
    `

    document.querySelector('.blocoParcelas').insertAdjacentHTML('beforeend', htmlParcela)
}

async function salvarNotaAvulsa() {

    overlayAguarde()

    const valor = (id) => {
        return document.getElementById(id).value
    }

    let nota = {
        status: 'FATURADO',
        executor: acesso.usuario,
        data: new Date().toLocaleDateString('pt-BR'),
        nf: valor('nf'),
        tipo: valor('tipo'),
        valor: Number(valor('valor')),
        parcelas: []
    }

    const parcelas = document.querySelectorAll('[name="parcela"]')

    parcelas.forEach((div, i) => {
        const inputs = div.querySelectorAll('input')
        nota.parcelas.push({ nParcela: (i + 1), nValor: Number(inputs[0].value), dDtVenc: new Date(inputs[1].value).toLocaleDateString('pt-BR') })
    })

    const idStatus = ID5digitos()
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.status) orcamento.status = {}
    if (!orcamento.status.historico) orcamento.status.historico = {}

    orcamento.status.historico[idStatus] = nota

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${idStatus}`, nota)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await abrirEsquema(id_orcam)

    removerOverlay()

}

async function buscarNFOmie(elemento) {

    overlayAguarde()

    let numero = elemento.previousElementSibling.previousElementSibling.previousElementSibling.value
    let tipo = elemento.previousElementSibling.previousElementSibling.value == 'Venda/Remessa' ? 'venda_remessa' : 'serviço'
    let app = elemento.previousElementSibling.value

    let detalhesNF = document.getElementById('detalhesNF')
    detalhesNF.innerHTML = ''

    let resultado = await verificarNF(numero, tipo, app)

    if (resultado.faultstring) {

        dadosNota = {}
        removerOverlay()

        return detalhesNF.innerHTML = `
            <div style="${vertical}; gap: 10;">
                <label>${resultado.faultstring}</label>
            </div>
        `
    }

    dadosNota = resultado

    let divParcelas = ''
    let parcelas = dadosNota.parcelas
        .map((parcela, i) =>
            `${modelo(`Parcela ${i + 1}`,
                `<label>${parcela.dDtVenc} <strong>${dinheiro(parcela?.nValorTitulo || parcela?.nValor || '??')}</strong></label><br>`)}`)
        .join('')

    if (parcelas !== '') {
        divParcelas = `
        <hr style="width: 100%;">

        ${parcelas}

        <hr style="width: 100%;">
        `
    }

    detalhesNF.innerHTML = `
        ${modelo('Tipo', dadosNota.tipo)}
        ${modelo('Cliente', dadosNota.cliente)}
        ${modelo('CNPJ', dadosNota.cnpj)}
        ${modelo('Cidade', dadosNota.cidade)}
        ${modelo('Total', dinheiro(dadosNota.valor))}
        
        ${divParcelas}

        ${modelo('Comentário', `<textarea style="width: 90%;" id="comentario"></textarea>`)}

        <div style="width: 100%; display: flex; justify-content: end; align-items: center;">
            <button onclick="salvarNota()" style="background-color: green;">Salvar</button>
        </div>
    `
    removerOverlay()
}

async function salvarNota() {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let chave = ID5digitos()
    let comentario = document.getElementById('comentario').value

    if (Object.keys(dadosNota).length == 0) {
        removerOverlay()
        return popup(mensagem(`A busca não recuperou dados`), 'ALERTA', true)
    }

    if (!orcamento.status) orcamento.status = {}
    if (!orcamento.status.historico) orcamento.status.historico = {}
    if (!orcamento.status.historico[chave]) orcamento.status.historico[chave] = {}

    let dados = {
        status: 'FATURADO',
        data: new Date().toLocaleString(),
        executor: acesso.usuario,
        comentario
    }

    dados = {
        ...dados,
        ...dadosNota
    }

    orcamento.status.historico[chave] = dados

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, dados)

    removerPopup()
    await abrirEsquema(id_orcam)

    itensAdicionais = {}
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

async function calcularRequisicao(sincronizar) {

    let tabela_requisicoes = document.getElementById('tabela_requisicoes')

    if (tabela_requisicoes) {
        let tbody = tabela_requisicoes.querySelector('tbody')
        let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
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

                    let qtde = tds[4].querySelector('input') ? Number(tds[4].querySelector('input').value) : Number(tds[4].textContent)


                    if (item.tipo_desconto) {
                        let desconto = item.tipo_desconto == 'Dinheiro' ? item.desconto : (item.custo * (item.desconto / 100))
                        desconto = desconto / item.qtde
                        item.custo = item.custo - desconto
                    }

                    item.custo = Number(item.custo.toFixed(2))

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

    const dados_composicoes = await recuperarDados('dados_composicoes') || {};
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
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
                        <label style="font-size: 0.8vw;"><strong>DESCRIÇÃO</strong></label>
                        <label style="text-align: left;">${item?.descricao || 'N/A'}</label>
                    </div>
                    ${apenas_visualizar ? '' : `<img src="imagens/construcao.png" style="position: absolute; top: 5px; right: 5px; width: 20px; cursor: pointer;" onclick="abrirAdicionais('${codigo}')">`}
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
                ? `<label style="font-size: 1.2em;">${item?.qtde_enviar || 0}</label>`
                : `
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2vw;">
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: start; gap: 5px;">
                                <label>Quantidade a enviar</label>
                                <input class="campoRequisicao" type="number" oninput="calcularRequisicao()" min="0" value="${item?.qtde_enviar || ''}">
                            </div>
                            <label class="num">${itensOrcamento[codigo]?.qtde || 0}</label>
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

async function abrirAdicionais(codigo) {

    dados_estoque = await recuperarDados('dados_estoque')

    const ths = ['Descrição', 'Quantidade', 'Comentário', '']
        .map(op => `<th>${op}</th>`)
        .join('')

    const botoes = [
        { texto: 'Adicionar Peça', img: 'chamados', funcao: `criarLinhaPeca()` },
        { texto: 'Sincronizar Estoque', img: 'estoque', funcao: `sincronizarDados('dados_estoque')` },
        { texto: 'Salvar', img: 'concluido', funcao: `salvarAdicionais('${codigo}')` }
    ]

    const linhas = [
        {
            elemento: `
            <div style="${vertical}; width: 100%;">
                <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela">
                            <thead><tr>${ths}</tr></thead>
                            <tbody id="linhasManutencao"></tbody>
                        </table>
                    </div>
                <div class="rodape-tabela"></div>
            </div>
            `}
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Itens Adicionais' })
    form.abrirFormulario()

    for (const [cd, dados] of Object.entries(itensAdicionais)) {

        if (cd !== codigo) continue

        for (const [ad, dadosAD] of Object.entries(dados)) {
            criarLinhaPeca(ad, dadosAD)
        }

    }

}

function salvarAdicionais(codigo) {
    const tabela = document.getElementById('linhasManutencao')
    const trs = tabela.querySelectorAll('tr')

    itensAdicionais[codigo] = {}

    if (trs.length == 0) {
        mostrarItensAdicionais()
        removerPopup()
        return
    }

    let adicionais = itensAdicionais[codigo]

    for (const tr of trs) {

        const tds = tr.querySelectorAll('td')
        const item = tds[0]?.querySelector('span') || tds[0]?.querySelector('textarea') || {}
        const cod = tds[0].querySelector('.opcoes').getAttribute('name')

        if (item.textContent == 'Selecione') continue
        const estoque = dados_estoque?.[cod] || {}

        adicionais[cod] = {
            partnumber: estoque?.partnumber || '',
            descricao: item?.textContent || item?.value || '',
            qtde: conversor(tds[1].textContent),
            unidade: tds[2].textContent
        }

    }

    mostrarItensAdicionais()
    removerPopup()
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

            if (itensAdicionais[codigo]) {

                let adicionais = itensAdicionais[codigo]
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
    const comentario_status = document.getElementById('comentario_status')
    const valor = document.getElementById('valor')
    const tipo = document.getElementById('tipo')
    const pedido = document.getElementById('pedido')
    const chave = ID5digitos()

    if (valor.value == '' || tipo.value == 'Selecione' || pedido.value == '') {

        return popup(mensagem(`Existem campos em Branco`), 'ALERTA', true)

    }

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.status) orcamento.status = { historico: {} }
    if (!orcamento.status.historico) orcamento.status.historico = {}
    if (!orcamento.status.historico[chave]) orcamento.status.historico[chave] = {}

    const dados = {
        data: new Date().toLocaleString(),
        executor: acesso.usuario,
        comentario: comentario_status.value,
        valor: Number(valor.value),
        tipo: tipo.value,
        pedido: pedido.value,
        status: 'PEDIDO'
    }

    orcamento.status.historico[chave] = dados

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, dados)

    removerPopup()
    await abrirEsquema(id_orcam)

}

async function salvar_requisicao(chave) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    if (!orcamento.status.historico) {
        orcamento.status.historico = {}
    }

    let novo_lancamento = {
        status: 'REQUISIÇÃO',
        data: new Date().toLocaleString(),
        transportadora: document.getElementById('transportadora').value,
        volumes: document.getElementById('volumes').value,
        executor: acesso.usuario,
        comentario: document.getElementById("comentario_status").value,
        requisicoes: [],
        adicionais: itensAdicionais,
        total_requisicao: document.getElementById("total_requisicao").textContent
    };

    const linhas = document.querySelectorAll('.lin_req')
    let lista_partnumbers = {}

    for (let linha of linhas) {
        let valores = linha.querySelectorAll('input, select')
        if (valores.length == 0) { continue }

        let tds = linha.querySelectorAll('td')
        let codigo = tds[0].textContent
        let partnumber = valores[0].value
        let tipo = valores[1].value
        let qtde = Number(valores[2].value)
        let requisicao = valores[3]?.value || ''

        if (partnumber == '' && qtde > 0) {
            document.getElementById("aguarde")?.remove();
            return popup(mensagem('Preencha os Códigos do Omie pendentes'), 'Aviso', true);
        }

        if (qtde > 0 || itensAdicionais[codigo]) {
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

    orcamento.status.historico[chave] = novo_lancamento

    await inserirDados({ [id_orcam]: orcamento }, "dados_orcamentos");

    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, novo_lancamento)

    if (orcamento.lpu_ativa !== 'MODALIDADE LIVRE') atualizar_partnumber(lista_partnumbers)

    itensAdicionais = {}
    removerPopup()
    await abrirEsquema(id_orcam)
}

async function abrirAtalhos(id) {

    const permitidos = ['adm', 'fin', 'diretoria', 'coordenacao', 'gerente']
    id_orcam = id

    const orcamento = dados_orcamentos[id_orcam]
    const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omie_cliente)
    const emAnalise = orcamento.aprovacao && orcamento.aprovacao.status !== 'aprovado'
    let botoesDisponiveis = ''
    let termoArquivar = 'Arquivar Orçamento'
    let iconeArquivar = 'pasta'

    if (orcamento.arquivado) {
        termoArquivar = 'Desarquivar Orçamento'
        iconeArquivar = 'desarquivar'
    }

    // Gambiarra para não mudar a posição das paradas;
    if (!emAnalise)
        botoesDisponiveis += `
        ${modeloBotoes('esquema', 'Histórico', `abrirEsquema('${id}')`)}
        ${modeloBotoes('painelcustos', 'Painel de Custos', `painelCustos('${id}')`)}`


    botoesDisponiveis += modeloBotoes('pdf', 'Abrir Orçamento em PDF', `irPdf('${id}', ${emAnalise})`)

    if (!emAnalise) {
        botoesDisponiveis += `
        ${modeloBotoes('checklist', 'CHECKLIST', `telaChecklist()`)}
        ${modeloBotoes('excel', 'Baixar Orçamento em Excel', `ir_excel('${id}')`)}
        ${modeloBotoes('duplicar', 'Duplicar Orçamento', `duplicar('${id}')`)}
        ${modeloBotoes(iconeArquivar, termoArquivar, `arquivarOrcamento('${id}')`)}
        ${modeloBotoes('link', 'Vincular Orçamento', `vincularOrcamento('${id}')`)}
        ${modeloBotoes('LG', 'OS em PDF', `abrirOS('${id}')`)}
        ${modeloBotoes('projeto', 'Criar Orçamento Vinculado', `criarOrcamentoVinculado('${id}')`)}
        `
    }

    if (orcamento?.usuario == acesso.usuario || permitidos.includes(acesso.permissao) || orcamento?.usuarios?.[acesso.usuario]) {
        botoesDisponiveis += `
        ${modeloBotoes('trocar', 'Mudar (Novos ↔ Antigos)', `migrarOrcamento('${id}')`)}
        ${modeloBotoes('chave', 'Delegar outro analista', `usuariosAutorizados()`)}
        ${modeloBotoes('apagar', 'Excluir Orçamento', `confirmarExclusaoOrcamentoBase('${id}')`)}
        ${modeloBotoes('editar', 'Editar Orçamento', `editar('${id}')`)}
        ${acesso.permissao == 'adm' ? modeloBotoes('editar3', 'Alterar ORC > novo', `mudarNumORC('${id}')`) : '<div></div>'}
        ${modeloBotoes('gerente', 'Editar Dados do Cliente', `painelClientes('${id}')`)}
        `
    }

    const acumulado = `
        <label style="color: #222; font-size: 1rem; text-align: left;" id="cliente_status">${cliente?.nome || '??'}</label>
        <hr>
        <div style="${horizontal}; gap: 5px;">
            <span>Classificar como <b>CHAMADO</b></span>
            <input ${orcamento?.chamado ? 'checked' : ''} onclick="ativarChamado(this, '${id}')" ${styChek} type="checkbox">
        </div>
        <hr>
        ${emAnalise ? mensagem('Este orçamento precisa ser aprovado!') : ''}
        <div class="opcoes-orcamento">${botoesDisponiveis}</div>
    `

    const menuOpcoesOrcamento = document.querySelector('.menu-opcoes-orcamento')

    if (menuOpcoesOrcamento) return menuOpcoesOrcamento.innerHTML = acumulado

    popup(`<div class="menu-opcoes-orcamento">${acumulado}</div>`, 'Opções do Orçamento')

}

async function mudarNumORC(id) {

    overlayAguarde()

    await numORC(id)

    removerOverlay()

}

async function abrirOS(idOrcamento) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))
    window.open('os.html', '_blank')

}

async function vincularOrcamento(idOrcamento) {

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 2rem;">
            <span>Escolha o <b>Orçamento</b> para vincular</span>

            <hr>

            <div style="${horizontal}; gap: 1rem;">
                <span class="opcoes"
                name="orcamento"
                onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/contrato', 'dados_orcam/analista', 'total_geral[dinheiro]'])">
                    Selecione
                </span>
                <img src="imagens/concluido.png" style="width: 2rem;" onclick="confirmarVinculo('${idOrcamento}')">
            </div>
        </div>
    `

    popup(acumulado, 'Vincular orçamentos', true)

}

async function criarOrcamentoVinculado(idOrcamento) {

    const orcamentoRef = await recuperarDado('dados_orcamentos', idOrcamento)
    const orcamento = {
        dados_orcam: {
            omie_cliente: orcamentoRef.dados_orcam.omie_cliente
        },
        hierarquia: idOrcamento
    }

    baseOrcamento(orcamento)
    removerPopup()

    await telaCriarOrcamento()
}

async function confirmarVinculo(idOrcamento) {

    overlayAguarde()

    const orcamentoMaster = document.querySelector('[name="orcamento"]')
    const idMaster = orcamentoMaster.id

    if (!idMaster) return popup(mensagem('Escolha um orçamento'), 'Alerta', true)

    const resposta = await vincularAPI({ idMaster, idSlave: idOrcamento })

    if (resposta.mensagem) return popup(mensagem(resposta.mensagem), 'Alerta', true)

    // Na API será salvo os elementos;
    const dados = { idMaster }
    hierarquia[idOrcamento] = dados
    await inserirDados({ [idOrcamento]: dados }, 'hierarquia')

    removerPopup()
    removerPopup()

    const trExistente = document.getElementById(idOrcamento)
    if (trExistente) trExistente.dataset.timestamp = ''
    await telaOrcamentos()

}

async function confirmarRemoverVinculo(idOrcamento) {

    const acumulado = `
    <div style="${horizontal}; gap: 1rem; background-color: #d2d2d2; padding: 2rem;">
        <span>Deseja desfazer vínculo?</span>
        <button onclick="desfazerVinculo('${idOrcamento}')">Confirmar</button> 
    </div>
    `

    popup(acumulado, 'Tem certeza?', true)

}

async function desfazerVinculo(idOrcamento) {

    overlayAguarde()
    const linha = document.getElementById(idOrcamento)
    if (linha) linha.remove()

    const resposta = vincularAPI({ idSlave: idOrcamento })
    if (resposta.mensagem) {
        await telaOrcamentos()
        return popup(mensagem(resposta.mensagem), 'Alerta', true)
    }

    removerPopup()

}

async function usuariosAutorizados() {

    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">
            
            <div style="${horizontal}; gap: 5px;">
                <span class="opcoes" name="usuario" onclick="cxOpcoes('usuario', 'dados_setores', ['usuario', 'setor', 'permissao'])">Selecionar</span>
                <img src="imagens/concluido.png" style="width: 2rem;" onclick="delegarUsuario()">
            </div>

            <hr style="width: 100%;">

            <div id="autorizados" style="${vertical}; gap: 3px;"></div>
        </div>
    `

    popup(acumulado, 'Autorizados', true)

    carregarAutorizados()

}

async function delegarUsuario(usuario) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.usuarios) orcamento.usuarios = {}

    let dados = {}

    if (usuario) {

        delete orcamento.usuarios[usuario]
        dados = orcamento.usuarios
        deletar(`dados_orcamentos/${id_orcam}/usuarios/${usuario}`)

    } else {

        usuario = document.querySelector('[name="usuario"]').id

        if (!usuario) return popup(mensagem('Selecione um usuário antes'), 'Alerta', true)

        dados = {
            data: new Date().toLocaleString('pt-BR'),
            responsavel: acesso.usuario
        }

        orcamento.usuarios[usuario] = dados
        enviar(`dados_orcamentos/${id_orcam}/usuarios/${usuario}`, dados)
    }

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await carregarAutorizados()
    telaOrcamentos()

    removerOverlay()
}

async function carregarAutorizados() {

    const modelo = (usuario, dados) => `
        <span style="${horizontal}; gap: 3px;">
            <img onclick="delegarUsuario('${usuario}')" src="imagens/cancel.png" style="width: 1.2rem;">
            ${usuario} - liberado em <b>${dados.data}</b> por <b>${dados.responsavel}</b>
        </span>
    `

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const liberados = Object.entries(orcamento?.usuarios || {})
        .map(([usuario, dados]) => modelo(usuario, dados))
        .join('')

    document.getElementById('autorizados').innerHTML = liberados ? liberados : 'Sem usuários autorizados por enquanto'

}

async function migrarOrcamento(idOrcamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const novaOrigem = origem == 'novos' ? 'antigos' : 'novos'
    orcamento.origem = novaOrigem

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${idOrcamento}/origem`, novaOrigem)

    await telaOrcamentos()

}

async function arquivarOrcamento(idOrcamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (orcamento.arquivado) {
        delete orcamento.arquivado
        enviar(`dados_orcamentos/${idOrcamento}/arquivado`, null)

    } else {

        const dados = {
            usuario: acesso.usuario,
            data: new Date().toLocaleString()
        }

        orcamento.arquivado = dados
        enviar(`dados_orcamentos/${idOrcamento}/arquivado`, dados)
    }

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaOrcamentos()
    removerOverlay()

    const img = orcamento.arquivado ? 'desarquivar' : 'pasta'

    popup(mensagem(`${orcamento.arquivado ? 'Arquivado' : 'Desarquivado'} com sucesso!`, `imagens/${img}.png`), 'Arquivamento', true)

}

async function painelCustos() {

    overlayAguarde()

    const dados = await receberCustos(id_orcam)
    const dadosCustos = dados.dadosCustos || {}
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const omieCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omieCliente)
    const totalCustos = Object.values(dadosCustos).reduce((acc, val) => acc + val, 0)
    const lucroReal = orcamento.total_geral - totalCustos
    const lucratividade = ((lucroReal / orcamento.total_geral) * 100).toFixed(0)

    const spans1 = (texto, valor) => `<span>${texto}: <b>${dinheiro(valor)}</b></span>`
    const colunas = ['Código', 'Descrição', 'Tipo', 'Valor no Orçamento', 'Custo Compra', 'Impostos', 'Frete Saída', 'Lucro Líquido', 'Lucratividade Individual']
    const ths = colunas.map(op => `<th>${op}</th>`).join('')
    const pesquisa = colunas.map((op, i) => `
        <th contentEditable="true" 
        style="text-align: left; background-color: white;"
        oninput="pesquisarGenerico('${i}', this.textContent, 'bodyCustos')">
        </th>
    `)
        .join('')

    const linhasPagamentos = Object.entries(dados?.detalhes || {})
        .map(([idPagamento, dados]) => `
            <tr>
                <td>${dados.recebedor}</td>
                <td>${dados.cidade}</td>
                <td>${dinheiro(dados.valor)}</td>
                <td>
                    <div style="${horizontal}">
                        <img src="imagens/pesquisar2.png" onclick="abrirDetalhesPagamentos('${idPagamento}')" style="width: 2rem;">
                    </div>
                </td>
            <tr>
        `).join('')

    const acumulado = `
        <div class="painel-custos">

            <span>${cliente.nome}</span>
            <span><b>${orcamento.dados_orcam.contrato}</b></span>
            <span>${cliente.cidade}</span>

            <hr style="width: 100%;">

            <div style="${horizontal}; justify-content: start; gap: 2rem;">
            
                <div style="${vertical}">
                    ${spans1('Custo com compra de material', dadosCustos.custoCompra)}
                    ${spans1('Custo com Frete de saída (5%)', dadosCustos.freteVenda)}
                    ${spans1('Custo com Impostos', dadosCustos.impostos)}
                    ${spans1('Pagamentos feitos', dadosCustos.pagamentos)}
                </div>

                <img src="imagens/painelcustos.png" style="width: 3rem">

                <div style="${vertical}">
                    <span><span style="font-size: 1.5rem;">${dinheiro(orcamento.total_geral)}</span> Total do Orçamento</span>
                    <span><span style="font-size: 1.5rem;">${dinheiro(lucroReal)}</span> Lucratividade</span>
                    ${divPorcentagem(lucratividade)}
                </div>

            </div>


            <hr style="width: 100%;">

            <div class="toolbar-relatorio">
                <span id="toolbar-orcamento" onclick="mostrarPagina('orcamento')" style="opacity: 1;">Orçamento</span>
                <span id="toolbar-pagamentos" onclick="mostrarPagina('pagamentos')" style="opacity: 0.5;">Pagamentos</span>
            </div>
            <div class="orcamento">
                <div class="borda-tabela">
                    <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela" id="tabela_composicoes">
                            <thead>
                                <tr>${ths}</tr>
                                <tr>${pesquisa}</tr>
                            </thead>
                            <tbody id="bodyCustos"></tbody>
                        </table>
                    </div>
                    <div class="rodape-tabela"></div>
                </div>
            </div>

            <div class="pagamentos" style="display: none;">
                <div class="borda-tabela">
                    <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela" id="tabela_composicoes">
                            <thead>
                                <tr>${['Recebedor', 'Cidade', 'Valor', ''].map(op => `<th>${op}</th>`).join('')}</tr>
                            </thead>
                            <tbody>${linhasPagamentos}</tbody>
                        </table>
                    </div>
                    <div class="rodape-tabela"></div>
                </div>
            </div>

        </div>
    `

    const painelCustos = document.querySelector('.painel-custos')
    if (!painelCustos) popup(acumulado, 'Painel de Custos')

    for (const [codigo, item] of Object.entries(dados?.itens || {})) {
        criarLinhaCusto(codigo, item)
    }

    console.log(dados)

}

function criarLinhaCusto(codigo, item) {

    const custosLinha = item.custoCompra + item.impostoLinha + item.freteLinha
    const totalLinha = item.quantidade * item.valor
    const lucroLinha = totalLinha - custosLinha
    const porcentagemLL = ((lucroLinha / totalLinha) * 100).toFixed(0)

    const td = (valor) => `<td style="white-space: nowrap;">${dinheiro(valor)}</td>`

    const tds = `
            <tr>
                <td>${codigo}</td>
                <td>${item.descricao}</td>
                <td>${item.tipo}</td>

                ${td(totalLinha)}
                ${td(item.custoCompra)}
                ${td(item.impostoLinha)}
                ${td(item.freteLinha)}
                ${td(lucroLinha)}
                <td>
                    ${divPorcentagem(porcentagemLL)}
                </td>
            </tr>
        `

    const trExistente = document.getElementById(codigo)
    if (trExistente) return trExistente.innerHTML = tds
    document.getElementById('bodyCustos').insertAdjacentHTML('beforeend', `<tr id="${codigo}">${tds}</tr>`)

}

async function receberCustos(idOrcamento) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/custos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ idOrcamento })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.mensagem) resolve(data.mensagem)
                resolve(data);
            })
            .catch(err => {
                resolve(err)
            });
    })
}

function divPorcentagem(porcentagem) {
    const valor = Math.max(0, Math.min(100, Number(porcentagem) || 0))

    return `
        <div style="z-index: 0; position: relative; border: 1px solid #666666; width: 100%; height: 16px; background: #eee; border-radius: 8px; overflow: hidden;">
            <div style="width: ${valor}%; height: 100%; background: ${valor >= 70 ? "#4caf50" : valor >= 40 ? "#ffc107" : "#f44336"};"></div>
            <label style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7rem; color: #000;">
                ${valor}%
            </label>
        </div>
    `
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
            ${historico.transportadora ? labelDestaque('Transportadora', historico.transportadora) : ''}
            ${historico.volumes ? labelDestaque('Volumes', historico.volumes) : ''}
            <div onclick="detalharRequisicao('${chave}', undefined, true)" class="label_requisicao">
                <img src="gifs/lampada.gif" style="width: 2vw;">
                <div style="text-align: left; display: flex; flex-direction: column; align-items: start; justify-content: center; cursor: pointer;">
                    <label style="font-size: 0.7vw;"><strong>REQUISIÇÃO DISPONÍVEL</strong></label>
                    <label style="font-size: 0.7vw;">Clique Aqui</label>
                </div>
            </div>
        `
    } else if (historico.status == 'LPU PARCEIRO') {

        funcaoEditar = `modalLPUParceiro('${chave}')`

        acumulado = `
            <div onclick="detalharLpuParceiro('${chave}')" class="label_requisicao">
                <img src="gifs/lampada.gif" style="width: 2vw;">
                <div style="text-align: left; display: flex; flex-direction: column; align-items: start; justify-content: center; cursor: pointer;">
                    <label style="font-size: 0.7vw;"><strong>LPU DISPONÍVEL</strong></label>
                    <label style="font-size: 0.7vw;">Clique Aqui</label>
                </div>
            </div>
        `

    } else if (historico.status == 'PEDIDO') {

        const modeloCampos = (valor1, campo, titulo) => {
            let opcoes = ['Serviço', 'Venda', 'Venda + Serviço']
                .map(op => `<option ${valor1 == op ? 'selected' : ''}>${op}</option>`)
                .join('');
            let estilo = `border-radius: 2px; font-size: 0.7vw; padding: 5px; cursor: pointer;`
            return `
                <div style="display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 5px;">
                    <label><strong>${titulo}:</strong></label>
                    <div style="${horizontal}; gap: 2px;">
                        ${campo == 'tipo'
                    ? `<select style="${estilo}" onchange="atualizarPedido('${chave}', '${campo}', this)">${opcoes}</select>`
                    : `<input style="${estilo}" type="${campo == 'valor' ? 'number' : 'text'}" value="${valor1}" oninput="mostrarConfirmacao(this)">`}
                        <img src="imagens/concluido.png" style="display: none; width: 1vw;" onclick="atualizarPedido('${chave}', '${campo}', this)">
                    </div>
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
            .map(parcela => `Parcela ${parcela.nParcela} <br> ${labelDestaque(parcela.dDtVenc, dinheiro(parcela.nValor))}`)
            .join('')

        if (parcelas !== '') divPacelas = `
            <hr style="width: 100%;">
            ${parcelas}
        `

        let botaoDANFE = `
            ${labelDestaque('Nota', historico.nf)}
            ${labelDestaque('Tipo', historico.tipo)}
        `

        if (historico.notaOriginal) {
            let tipo = historico.tipo == 'Serviço' ? 'serviço' : 'venda_remessa'
            let codOmieNF = tipo == 'venda_remessa' ? historico.notaOriginal.compl.nIdNF : historico.notaOriginal.Cabecalho.nCodNF
            botaoDANFE = balaoPDF(historico.nf, historico.tipo, codOmieNF, tipo, historico.app)
        }

        acumulado = `
            ${labelDestaque('Valor Total', dinheiro(historico.valor))}
            <br>
            ${botaoDANFE}
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
        <div style="background-color: ${coresST?.[historico.status]?.cor || '#808080'}" class="contorno-botoes" onclick="${funcaoEditar}">
            <img src="imagens/editar4.png" style="width: 1rem;">
            <label>Editar</label>
        </div>
        `
    }

    return acumulado

}

async function abrirEsquema(id) {

    overlayAguarde()

    if (id) id_orcam = id

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omie_cliente)
    let blocosStatus = {}

    for (const [chave, historico] of Object.entries(orcamento?.status?.historico || {})) {

        const statusCartao = historico.status
        const cor = coresST?.[statusCartao]?.cor || '#808080'

        if (!blocosStatus[statusCartao]) blocosStatus[statusCartao] = ''

        const excluir = (historico.executor == acesso.usuario || acesso.permissao == 'adm')
            ? `<span class="close" style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" onclick="apagarStatusHistorico('${chave}')">&times;</span>`
            : ''

        blocosStatus[statusCartao] += `
            <div class="bloko" style="gap: 0px; border: 1px solid ${cor}; background-color: white; justify-content: center;">

                <div style="cursor: pointer; display: flex; align-items: start; flex-direction: column; background-color: ${cor}1f; padding: 3px; border-top-right-radius: 3px; border-top-left-radius: 3px;">
                    ${excluir}
                    ${labelDestaque('Chamado', orcamento.dados_orcam.contrato)}
                    ${labelDestaque('Executor', historico.executor)}
                    ${labelDestaque('Data', historico.data)}
                    ${labelDestaque('Comentário', `
                        <div>
                            <textarea oninput="mostrarConfirmacao(this)" style="resize: vertical; width: 90%;">${historico?.comentario || ''}</textarea>
                            <span class="btnConfirmar" onclick="atualizarPedido('${chave}', 'comentario', this)">Atualizar</span>
                        </div>    
                        `)}

                    ${elementosEspecificos(chave, historico)}

                    <div class="escondido" style="display: none;">
                        <div class="contorno-botoes" style="background-color: ${cor}">
                            <img src="imagens/anexo2.png">
                            <label>Anexo
                                <input type="file" style="display: none;" onchange="salvar_anexo('${chave}', this)" multiple>  
                            </label>
                        </div>

                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                            ${await carregar_anexos(chave)}
                        </div>

                        <div class="contorno-botoes" onclick="toggle_comentario('comentario_${chave}')" style="background-color: ${cor};">
                            <img src="imagens/comentario.png">
                            <label>Comentário</label>
                        </div>

                        <div id="comentario_${chave}" style="display: none; justify-content: space-evenly; align-items: center;">
                            <textarea placeholder="Comente algo aqui..."></textarea>
                            <label class="contorno-botoes" style="background-color: green;" onclick="salvar_comentario('${chave}')">Salvar</label>
                        </div>
                        <div id="caixa_comentarios_${chave}" style="display: flex; flex-direction: column;">
                            ${await carregar_comentarios(chave)}
                        </div>
                    </div>
                    <br>
                </div>

                <div style="cursor: pointer; background-color: ${cor}; display: flex; align-items: center; justify-content: center;" onclick="exibirItens(this)">
                    <label style="color: white; font-size: 0.9vw;">ver mais</label>
                </div>

            </div>
        `
    }

    const blocos = Object.entries(blocosStatus)
        .map(([, div]) => `
            <div style="display: flex; flex-direction: column; justify-content: start; align-items: center; width: 16vw; gap: 10px;">
                ${div}
            </div>`)
        .join('')

    const linha1 = `
        <div style="${horizontal}; gap: 2rem;">

            <img onclick="sincronizarReabrir()" src="imagens/atualizar3.png">

            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; gap: 2px;">
                <label>Status atual</label>
                <select onchange="alterarStatus(this)" style="border-radius: 3px; padding: 3px;">
                    ${['', ...fluxograma].map(fluxo => `
                        <option ${orcamento?.status?.atual == fluxo ? 'selected' : ''}>${fluxo}</option>
                    `).join('')}
                </select>
            </div>
 
            <img onclick="mostrarHistoricoStatus()" src="imagens/historico.png">

            <label style="font-size: 1.5rem;">${orcamento.dados_orcam.contrato} - ${cliente?.nome || '??'}</label>

        </div>
        `

    const strAnexos = {
        levantamentos: '',
        finalizado: ''
    }

    for (const [idAnexo, anexo] of Object.entries(orcamento?.levantamentos || {})) {
        const local = anexo?.finalizado == 'S' ? 'finalizado' : 'levantamentos'
        strAnexos[local] += criarAnexoVisual(anexo.nome, anexo.link, `excluirLevantamentoStatus('${idAnexo}', '${id}')`)
    }

    const divLevantamentos = (finalizado) => {

        const local = finalizado ? 'finalizado' : 'levantamentos'

        return `
            <div style="${vertical}; gap: 2px; margin-right: 20px; margin-top: 10px;">

                <div class="contorno-botoes" onclick="document.getElementById('${local}').click()">
                    <img src="imagens/anexo2.png">
                    <label>Anexar ${local}</label>

                    <input
                        type="file" 
                        id="${local}"
                        style="display:none" 
                        data-finalizado="${finalizado ? 'S' : 'N'}"
                        onchange="salvarLevantamento('${id}', '${local}')" 
                        multiple>
                </div>

                ${strAnexos[local]}
            </div>`
    }

    const acumulado = `
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 3px;">

            ${linha1}

            <hr>

            <div style="${horizontal}; gap: 5px;">
                
                ${botao('Novo Pedido', `painelAdicionarPedido()`, '#4CAF50')}
                ${botao('Requisição Materiais', `detalharRequisicao(undefined, 'infraestrutura')`, '#B12425')}
                ${botao('Requisição Equipamentos', `detalharRequisicao(undefined, 'equipamentos')`, '#B12425')}
                ${botao('Nova Nota Fiscal', `painelAdicionarNotas()`, '#ff4500')}

                ${(acesso.permissao == 'adm' || acesso.setor == 'LOGÍSTICA')
            ? botao('Novo Envio de Material', `envioMaterial()`, '#b17724')
            : ''}
                
                ${botao('LPU Parceiro', `modalLPUParceiro()`, '#0062d5')}

                ${botao('Produtos sem Requisição', `mostrarItensPendentes()`, '')}
            </div>
        </div>

        <div class="container-blocos">
            <div style="${vertical}; witdth: 100%; gap: 0.5rem;">
                ${divLevantamentos()}
                <hr>
                ${divLevantamentos(true)}
            </div>
            ${blocos}
        </div>`

    const janelaAtiva = document.querySelector('.painel-historico')
    if (janelaAtiva) {
        removerOverlay()
        janelaAtiva.innerHTML = acumulado
        return
    }
    popup(`<div class="painel-historico">${acumulado}</div>`, 'Histórico do Orçamento')

}

async function mostrarItensPendentes() {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let itens_no_orcamento = orcamento.dados_composicoes
    let valoresTotais = {}

    let acumulado = ''
    let linhas = ''

    if (orcamento.status && orcamento.status.historico) {

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

    popup(acumulado, "Itens Pendentes", true)

}

async function atualizarPedido(chave, campo, imgSelect) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    const elemento = campo == 'tipo' ? imgSelect : imgSelect.previousElementSibling;

    const valor = campo == 'valor' ? Number(elemento.value) : elemento.value

    orcamento.status.historico[chave][campo] = valor

    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/${campo}`, valor)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    campo !== 'tipo' ? imgSelect.style.display = 'none' : ''
}

function mostrarConfirmacao(elemento) {
    let img = elemento.nextElementSibling;
    img.style.display = 'block'
}

async function alterarStatus(select) {

    const orcamento = dados_orcamentos[id_orcam]
    orcamento.status ??= {}
    orcamento.status.historicoStatus ??= {}
    const statusAnterior = orcamento.status?.atual || ''

    const novoSt = select.value
    if (orcamento.status?.atual == novoSt) return

    const bloq = ['REQUISIÇÃO', 'CONCLUÍDO']

    const temPedido = Object.values(orcamento?.status?.historico || {}).some(s => s.status == 'PEDIDO')

    if (!temPedido && bloq.includes(novoSt)) {
        select.value = statusAnterior
        popup(mensagem('Não é possível ir para <b>REQUISIÇÃO</b> ou <b>CONCLUÍDO</b> se o orçamento não tiver Pedido'), 'Aviso', true)
        return
    }

    const idStatus = ID5digitos()

    const registroStatus = {
        data: new Date().toLocaleString(),
        de: statusAnterior,
        para: novoSt,
        usuario: acesso.usuario
    }

    orcamento.status.atual = novoSt
    orcamento.status.historicoStatus[idStatus] = novoSt
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${id_orcam}/status/atual`, novoSt)
    enviar(`dados_orcamentos/${id_orcam}/status/historicoStatus/${idStatus}`, registroStatus)

    if (novoSt == 'ORC PENDENTE') {
        const linhas = [
            {
                texto: 'Por que <b>ORC PENDENTE</b>?',
                elemento: `<textarea name="info"></textarea>`
            }
        ]
        const funcao = `salvarInfoAdicional('${idStatus}')`
        const botoes = [{ texto: 'Salvar', img: 'concluido', funcao }]
        const form = new formulario({ linhas, botoes, titulo: 'Informação adicional' })
        form.abrirFormulario()
    }

    if (novoSt == 'ORC APROVADO') criarDepartamento(id_orcam)
    if (funcaoAtiva == 'telaOrcamentos') await telaOrcamentos(true)
}

async function salvarInfoAdicional(idStatus) {

    overlayAguarde()
    const info = document.querySelector('[name="info"]').value
    const orcamento = dados_orcamentos[id_orcam]
    orcamento.status.historicoStatus[idStatus].info = info
    enviar(`dados_orcamentos/${id_orcam}/status/historicoStatus/${idStatus}/info`, info)
    removerPopup()

}

async function mostrarHistoricoStatus() {
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento?.status?.historicoStatus || Object.entries(orcamento.status.historicoStatus).length === 0) {
        popup(`<div style="${horizontal}; padding: 2vw; background-color: #d2d2d2;">Nenhuma alteração de status registrada.</div>`, 'Histórico de Status', true)
        return
    }

    const html = `
        <div style="${horizontal}; padding: 1rem; background-color: #d2d2d2;">
            <div class="borda-tabela">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Status Anterior</th>
                                <th>Novo Status</th>
                                <th>Alterado por</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(orcamento.status.historicoStatus).map(([id, registro]) => `
                                <tr id="ST_${id}">
                                    <td>${registro.data}</td>
                                    <td>${registro.de}</td>
                                    <td>${registro.para}</td>
                                    <td>${registro.usuario}</td>
                                    <td>
                                        ${acesso.permissao == 'adm' ? `<img onclick="excluirHiStatus('${id}')" src="imagens/cancel.png">` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>
        </div>
    `

    popup(html, 'Histórico de Alterações de Status', true)
}

async function excluirHiStatus(idStatus) {

    overlayAguarde()

    const orcamento = dados_orcamentos[id_orcam]

    delete orcamento.status.historicoStatus[idStatus]

    const trExistente = document.getElementById(`ST_${idStatus}`)

    if (trExistente) trExistente.remove()

    deletar(`dados_orcamentos/${id_orcam}/status/historicoStatus/${idStatus}`)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    removerOverlay()

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

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let historico = orcamento.status.historico
    let st = 'MATERIAL ENVIADO'

    status.executor = acesso.usuario
    status.data = new Date().toLocaleString()
    status.status = st

    historico[chave] = status

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, status)

    removerPopup()
    await abrirEsquema(id_orcam)

}

function confirmarExclusao_comentario(id_comentario, chave) {
    popup(`
        <div style="padding: 2vw; background-color: #d2d2d2; display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Excluir o comentário?</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            ${botao('Confirmar', `excluir_comentario('${id_comentario}', '${chave}')`, 'green')}
        </div>
        `, 'AVISO', true)
}

async function excluir_comentario(id_comentario, chave) {
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let comentarios = orcamento.status.historico[chave].comentarios || {}

    delete comentarios[id_comentario]

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/comentarios/${id_comentario}`)
    await carregar_comentarios(chave)
    removerPopup()
}

async function carregar_comentarios(chave) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let comentss = ''
    if (orcamento.status.historico[chave]) {
        let comentarios = orcamento.status.historico[chave].comentarios || {}

        for (it in comentarios) {
            let item = comentarios[it]
            let excluir = ''

            if (acesso.usuario == item.usuario || acesso.permissao == 'adm') {
                excluir = ` •<label onclick="confirmarExclusao_comentario('${it}', '${chave}')" style="text-decoration: underline; cursor: pointer;"> Excluir</label>`
            }

            comentss += `
            <div class="anexos2" style="width: 95%; margin: 0px; margin-top: 5px;">
                <label style="text-align: left; padding: 5px;">${item.comentario.replace(/\n/g, '<br>')}
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
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    let id = ID5digitos()

    const comentario = {
        id,
        comentario: textarea.value,
        data: new Date().toLocaleString(),
        usuario: acesso.usuario
    }

    let cartao = orcamento.status.historico[chave]
    if (!cartao.comentarios) cartao.comentarios = {}

    cartao.comentarios[id] = comentario

    textarea.value = ''

    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/comentarios/${id}`, comentario)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
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

    removerPopup()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    delete orcamento.status.historico[chave].anexos[id_anexo]

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await abrirEsquema(id_orcam)

    deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/anexos/${id_anexo}`)

    img.parentElement.remove()

}

async function confirmarExclusaoOrcamentoBase(id) {
    popup(`
        <div style="background-color: #d2d2d2; padding: 1rem;">
            <label>Deseja realmente excluir o orçamento?</label>
            <button onclick="excluirOrcamentoBase('${id}')">Confirmar</button>
        </div>
        `, 'Excluir Orçamento')
}

async function excluirOrcamentoBase(idOrcamento) {
    removerPopup()
    overlayAguarde()

    await deletarDB('dados_orcamentos', idOrcamento)

    deletar(`dados_orcamentos/${idOrcamento}`)

    await telaOrcamentos()
    removerPopup()
}

async function detalharRequisicao(chave, tipoRequisicao, apenas_visualizar) {

    if (!chave) chave = ID5digitos()

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const dados_clientes = await recuperarDados('dados_clientes') || {}
    const cliente = dados_clientes?.[orcamento.dados_orcam.omie_cliente] || {}
    const cartao = orcamento?.status?.historico?.[chave] || {}
    let menu_flutuante = ''

    // Carrega os itens adicionais se existirem
    itensAdicionais = {}
    let comentarioExistente = ''

    if (apenas_visualizar) {
        menu_flutuante = `
            <div class="menu_flutuante" id="menu_flutuante">
                <div class="icone" onclick="gerarpdf('${cliente.nome || 'xx'}', '${orcamento?.dados_orcam?.contrato || 'xx'}')">
                    <img src="imagens/pdf.png">
                    <label>PDF</label>
                </div>
            </div>
            `
    }

    if (cartao.adicionais) itensAdicionais = cartao.adicionais
    if (cartao.comentario) comentarioExistente = cartao.comentario
    if (cartao.requisicoes) requisicoesExistente = cartao.requisicoes

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
                
                ${modelo('Transportadora', `
                <select id="transportadora" style="padding: 5px; border-radius: 2px;">

                ${['JAMEF', 'CORREIOS', 'JADLOG', 'OUTROS']
                .map(op => `<option ${cartao?.transportadora == op ? 'selected' : ''}>${op}</option>`)
                .join('')}
                
                </select>`)}

                ${modelo('Volumes', `<input value="${cartao?.volumes || ''}" id="volumes" style="padding: 5px; border-radius: 2px;" type="number">`)}

                <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                    <label><strong>Comentário</strong></label>
                    <textarea rows="3" id="comentario_status" style="width: 80%;">${comentarioExistente}</textarea>
                </div>

                <label class="contorno-botoes" style="background-color: #4CAF50; " onclick="salvar_requisicao('${chave}')">Salvar Requisição</label>
            </div>
        </div>
        `
    }

    let modeloLabel = (valor1, valor2) => `
        <label style="color: #222; text-align: left;"><strong>${valor1}</strong> ${valor2}</label>
    `

    const colunas = ['Código', 'OMIE /Partnumber', 'Informações do Item', 'Tipo', 'Quantidade', 'Valor Unitário', 'Valor Total', 'Requisição']
        .map(col => `<th>${col}</th>`).join('')

    const acumulado = `
    <div style="background-color: white;">
        ${menu_flutuante}

        <div style="display: flex; align-items: center; justify-content: center; width: 100%; background-color: #151749;">
            <img src="https://i.imgur.com/AYa4cNv.png" style="width: 10rem;">
        </div>

        <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
            <h1>REQUISIÇÃO DE COMPRA DE MATERIAL</h1>
        </div>

        <div style="display: flex; justify-content: left; align-items: center; margin: 10px;">

            ${campos}
                
            <div class="contorno">
                <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; font-size: 1.0em;">Dados do Cliente</div>
                <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; justify-content: start; align-items: start; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">

                    ${modeloLabel('Cliente', cliente?.nome || '')}
                    ${modeloLabel('CNPJ', cliente?.cnpj || '')}
                    ${modeloLabel('Endereço', cliente?.bairro || '')}
                    ${modeloLabel('Cidade', cliente?.cidade || '')}
                    ${modeloLabel('Chamado', orcamento.dados_orcam.contrato)}
                    ${modeloLabel('Condições', orcamento.dados_orcam.condicoes)}

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
                <thead>${colunas}</thead>
                
                <tbody>
                    ${await carregar_itens(apenas_visualizar, tipoRequisicao, chave)}
                </tbody>
            </table>
        <div>
    <div>
    `
    popup(acumulado, 'Requisição', true)

    // Preenche os campos com os dados existentes se estiver editando    
    await calcularRequisicao()
    mostrarItensAdicionais()
}

async function salvar_anexo(chave, input) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (input.files.length === 0) {
        popup('Nenhum arquivo selecionado...');
        return;
    }

    let anexos = await importarAnexos(input) // Retorna uma lista [{}, {}]

    anexos.forEach(anexo => {

        if ((orcamento.status.historico[chave].anexos && Array.isArray(orcamento.status.historico[chave].anexos) || !orcamento.status.historico[chave].anexos)) {
            orcamento.status.historico[chave].anexos = {};
        }

        let id = ID5digitos()

        orcamento.status.historico[chave].anexos[id] = anexo
        enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/anexos/${id}`, anexo)
    })

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos');

    let div = input.parentElement.parentElement.nextElementSibling // input > label > div pai > div seguinte;

    div.innerHTML = await carregar_anexos(chave)

}

async function carregar_anexos(chave) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
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

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 1rem; gap: 2rem;">
            <span>Tem certeza?</span>
            <button onclick="confirmarExclusaoStatus('${chave}')">Confirmar</button>
        </div>
    `

    popup(acumulado, 'Excluir Status', true)
}


async function confirmarExclusaoStatus(chave) {

    removerPopup()
    overlayAguarde()
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    delete orcamento.status.historico[chave]
    deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await abrirEsquema()

}

async function atualizar_partnumber(produtos) {

    for (let [codigo, partnumber] of Object.entries(produtos)) {

        let composicao = await recuperarDado('dados_composicoes', codigo)

        if (composicao) {
            composicao.omie = partnumber
            await enviar(`dados_composicoes/${codigo}/omie`, partnumber)
            await inserirDados({ [codigo]: composicao }, 'dados_composicoes')
        }
    }

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

    let janela = document.querySelectorAll('.janela')
    janela = janela[janela.length - 1]

    const htmlContent = `
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

    overlayAguarde()
    await gerarPdfOnline(htmlContent, `REQUISICAO_${cliente}_${pedido}`);
    removerOverlay()
}

async function envioMaterial(chave) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let envio = {}
    let comentario = ''
    if (chave !== undefined) {
        envio = orcamento.status.historico[chave].envio
        comentario = orcamento.status.historico[chave].comentario
    } else {
        chave = ID5digitos()
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
    popup(acumulado, 'Envio de Material', true)
}

async function irOS(idOrcamento) {
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('os.html', '_blank')
}
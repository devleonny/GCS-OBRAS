let itensAdicionais = {}
let id_orcam = ''
let dadosNota = {}
let dados_estoque = {}
let unidadeOrc = null
const altNumOrc = ['adm', 'analista']
const opcoesPedidos = ['Locação', 'Serviço', 'Venda', 'Venda + Serviço', 'POC']

const fluxograma = [
    'SEM STATUS',
    'COTAÇÃO',
    'ORC PENDENTE',
    'ORC ENVIADO',
    'ORC APROVADO',
    'ORC REPROVADO',
    'VENDA DIRETA',
    'REQUISIÇÃO',
    'NFE VENDA',
    'PEND INFRA',
    'PEND ASSISTÊNCIA TÉCNICA',
    'ENVIADO',
    'ENTREGUE',
    'AGENDAMENTO',
    'EM ANDAMENTO',
    'POC EM ANDAMENTO',
    'OBRA PARALISADA',
    'PENDENTE OS/RELATÓRIO',
    'ACORDO FINANCEIRO',
    'PENDENTE PEDIDO',
    'CONCLUÍDO',
    'FATURADO',
    'ATRASADO',
    'PAG RECEBIDO',
    'LOCAÇÃO',
    'GARANTIA'
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

function aprovadoEmail(input) {

    const pedido = document.getElementById('pedido')
    pedido.value = input.checked ? 'Aprovado Via E-mail' : ''
    pedido.contentEditable = !input.checked

}

async function painelAdicionarPedido(chave) {

    const pedido = db.dados_orcamentos?.[id_orcam]?.status?.historico?.[chave] || {}

    const linhas = [
        {
            texto: 'Tipo de Pedido',
            elemento: `
                <select id="tipo">
                    ${opcoesPedidos.map(op => `<option ${pedido.tipo == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Aprovado por E-mail',
            elemento: `<input type="checkbox" style="width: 2rem; height: 2rem;" onclick="aprovadoEmail(this)">`
        },
        {
            texto: 'Número do Pedido',
            elemento: `<input type="text" id="pedido" value="${pedido.pedido || ''}">`
        },
        {
            texto: 'Valor do Pedido',
            elemento: `<input type="number" id="valor" value="${pedido?.valor || ''}">`
        },
        {
            texto: 'Comentário',
            elemento: `<textarea rows="5" id="comentario_status">${pedido.comentario || ''}</textarea>`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            funcao: chave
                ? `salvarPedido('${chave}')`
                : 'salvarPedido()',
            img: 'concluido'
        }
    ]

    popup({ linhas, botoes, titulo: chave ? 'Editar Pedido' : 'Novo Pedido' })

}

async function painelAdicionarNotas() {

    const tipos = ['Serviço', 'Venda', 'Remessa']
    const apps = ['AC', 'HNK', 'HNW', 'IAC']

    const elemento = `
        <div id="painelNotas" style="${vertical};">

            <div style="width: 100%; ${horizontal}; gap: 5px;">
                

                <select class="pedido">
                    ${tipos.map(t => `<option>${t}</option>`).join('')}
                </select>

                <select class="pedido">
                    ${apps.map(a => `<option>${a}</option>`).join('')}
                </select>

                <button onclick="buscarNFOmie(this)" style="background-color: #097fe6;">Buscar dados</button>
                
                <span>ou</span>

                <button onclick="htmlFormularioAvulso()" style="background-color: #B12425;">Inserir Manualmente</button>
            </div>
                
            <div id="detalhesNF" style="width: 100%;"></div>

        </div>
        `

    popup({ elemento, titulo: 'Vincular Nota Fiscal' })

}

function htmlFormularioAvulso() {

    const linhas = [
        {
            texto: 'Número da nota',
            elemento: `<input id="nf" class="inputParcelas">`
        },
        {
            texto: 'Tipo',
            elemento: `<select id="tipo" class="inputParcelas">${['Venda', 'Serviço', 'Remessa'].map(op => `<option>${op}</option>`).join('')}</select>`
        },
        {
            texto: 'Valor',
            elemento: `R$ <input type="number" id="valor" placeholder="0,00" class="inputParcelas">`
        },
        {
            texto: `<div style="${horizontal}; gap: 1rem;"><span>Parcelas</span> <img src="imagens/baixar.png" onclick="maisParcela()"></div>`,
            elemento: `<div class="blocoParcelas"></div>`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarNotaAvulsa()` }
    ]

    popup({ linhas, botoes, titulo: 'Vincular Nota Fiscal' })
    maisParcela()
}

function maisParcela() {

    const htmlParcela = `
        <div name="parcela" style="${horizontal}; gap: 5px;">
            <label>R$</label>
            <input type="number" placeholder="0,00" class="inputParcelas">
            <input type="date" class="inputParcelas">
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
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
    let tipo = elemento.previousElementSibling.previousElementSibling.value == 'serviço' ? 'serviço' : 'venda_remessa'
    let app = elemento.previousElementSibling.value

    let detalhesNF = document.getElementById('detalhesNF')
    detalhesNF.innerHTML = ''

    const resultado = await verificarNF(numero, tipo, app)

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
        return popup({ mensagem: `A busca não recuperou dados` })
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

function pesqRequisicao() {

    const pesquisa1 = document.getElementById('pesquisa1')

    if (!pesquisa1) return

    const tabela = document.getElementById('tabela_requisicoes')
    const tbody = tabela.querySelector('tbody')
    const trs = tbody.querySelectorAll('tr')

    trs.forEach(tr => {

        const tds = tr.querySelectorAll('td')
        let mostrar = false

        tds.forEach(td => {

            const select = td.querySelector('select')
            const conteudo = select ? select.value : td.textContent;

            if (String(conteudo).toLowerCase().includes(String(pesquisa1.value).toLowerCase()) || pesquisa1.value == '') {
                mostrar = true
            }
        })

        tr.style.display = mostrar ? 'table-row' : 'none'
    })
}

async function carregarItensRequisicao(apVisualizar, tipoRequisicao, chave) {

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

    if (apVisualizar) {

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


    for (item of itensFiltrados) {

        const { tipo, codigo, qtde_enviar, requisicao, descricao } = item
        const omie = db.dados_composicoes[codigo]?.omie || db.dados_composicoes[codigo]?.partnumber || ''
        const tOpcoes = ['SEVIÇO', 'VENDA', 'USO E CONSUMO', 'LOCAÇÃO']
            .map(op => `<option value="${op}" ${tipo == op ? 'selected' : ''}>${op}</option>`)
            .join('')

        const rOpcoes = ['Nada a fazer', 'Venda Direta', 'Estoque AC', 'Comprar', 'Enviar do CD', 'Fornecido pelo Cliente']
            .map(op => `<option ${requisicao == op ? 'selected' : ''}>${op}</option>`)
            .join('')

        linhas += `
            <tr class="lin_req">
                <td style="text-align: center; font-size: 1.2em; white-space: nowrap;"><label>${codigo}</label></td>
                <td style="text-align: center;">
                    ${apVisualizar
                ? `<label style="font-size: 1.2em;">${omie}</label>`
                : `<input class="requisicao-campo" value="${omie}">`
            }
                </td>
                <td>
                    <div style="${horizontal}; justify-content: space-between; width: 100%;">
                        <div style="${vertical}; gap: 2px;">
                            <label><strong>DESCRIÇÃO</strong></label>
                            <label style="text-align: left;">${descricao || 'N/A'}</label>
                        </div>
                        ${apVisualizar
                ? ''
                : `<img src="imagens/construcao.png" onclick="abrirAdicionais('${codigo}')">`}
                    </div>
                </td>
                <td>
                    ${apVisualizar
                ? `<label>${tipo || ''}</label>`
                : `<select class="opcoesSelect">${tOpcoes}</option>
                `}
                </td>
                <td style="text-align: center;">
                    ${apVisualizar
                ? `<label style="font-size: 1.2em;">${qtde_enviar || 0}</label>`
                : `
                    <div style="${horizontal}; gap: 5px;">
                        <div style="${vertical}; gap: 5px;">
                            <label>Quantidade a enviar</label>
                            <input class="requisicao-campo" type="number" oninput="calcularRequisicao()" min="0" value="${qtde_enviar || ''}">
                        </div>
                        <label class="num">${itensOrcamento[codigo]?.qtde || 0}</label>
                    </div>
                    `}
                </td>
                <td style="white-space: nowrap;">
                    <label></label>
                </td>
                <td style="white-space: nowrap;">
                    <label></label>
                </td>
                <td>
                    ${apVisualizar
                ? `<label>${requisicao || ''}</label>`
                : `<select class="opcoesSelect">${rOpcoes}</select>`
            }
                </td>
            </tr>
        `
    }

    return linhas;

}

async function abrirAdicionais(codigo) {

    const ths = ['Descrição', 'Quantidade', 'Comentário', '']
        .map(op => `<th>${op}</th>`)
        .join('')

    const botoes = [
        { texto: 'Adicionar Peça', img: 'chamados', funcao: `criarLinhaPeca()` },
        { texto: 'Sincronizar Estoque', img: 'estoque', funcao: `sincronizarDados({base: 'dados_estoque', overlay: true})` },
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

    popup({ linhas, botoes, titulo: 'Itens Adicionais' })

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

async function salvarPedido(chave = ID5digitos()) {

    const comentario_status = document.getElementById('comentario_status')
    const valor = document.getElementById('valor')
    const tipo = document.getElementById('tipo')
    const pedido = document.getElementById('pedido')

    if (valor.value == '' || tipo.value == 'Selecione' || pedido.value == '') {

        return popup({ mensagem: `Existem campos em Branco` })

    }

    const orcamento = db.dados_orcamentos[id_orcam]

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

async function salvarRequisicao(chave) {

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

        if (partnumber == '' && qtde > 0)
            return popup({ mensagem: 'Preencha os Códigos do Omie pendentes' })

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

async function abrirAtalhos(id, idMaster) {

    const permitidos = ['adm', 'fin', 'diretoria', 'coordenacao', 'gerente']
    id_orcam = id

    const orcamento = db.dados_orcamentos[id_orcam]
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
        ${modeloBotoes('LG', 'OS em PDF', `abrirOS('${id}')`)}
        ${modeloBotoes('alerta', 'Definir Prioridade', `formularioOrcAprovado('${id}')`)}
        ${idMaster
                ? modeloBotoes('exclamacao', 'Desvincular Orçamento', `confirmarRemoverVinculo('${id}', '${idMaster}')`)
                : modeloBotoes('link', 'Vincular Orçamento', `vincularOrcamento('${id}')`)
            }
        `
    }

    if (orcamento?.usuario == acesso.usuario || permitidos.includes(acesso.permissao) || orcamento?.usuarios?.[acesso.usuario]) {
        botoesDisponiveis += `
        ${modeloBotoes('chave', 'Delegar outro analista', `usuariosAutorizados()`)}
        ${modeloBotoes('apagar', 'Excluir Orçamento', `confirmarExclusaoOrcamentoBase('${id}')`)}
        ${modeloBotoes('editar', 'Editar Orçamento', `editar('${id}')`)}
        ${modeloBotoes('gerente', 'Editar Dados do Cliente', `painelClientes('${id}')`)}
        `
    }

    if (altNumOrc.includes(acesso.permissao)) botoesDisponiveis += modeloBotoes('editar3', 'Alterar ORC > novo', `mudarNumORC('${id}')`)

    const modAlerta = (texto) => `
        <div class="alerta-pendencia" onclick="irORC('${id}')">
            <img src="gifs/alerta.gif">
            <span>${texto}</span>
        </div>
    `
    // Alertas
    const souResponsavel = Object
        .values(orcamento?.pda?.acoes || {})
        .some(a => a.responsavel == acesso.usuario && a.status == 'pendente')

    const atalho = souResponsavel
        ? modAlerta('Você tem <b>ações</b> pendentes! <br><small>Clique <b>aqui</b> para ver mais</small>')
        : ''

    let prioridade = 3
    const stLiberado = Object
        .values(orcamento?.status?.historicoStatus || {})
        .some(h => stLista.includes(h.para))

    if (!stLiberado) {
        const inicio = new Date(orcamento?.inicio)
        const hoje = new Date()
        const diffDias = Math.abs(hoje - inicio) / (1000 * 60 * 60 * 24)
        if (diffDias < 7) prioridade = 0
        else if (diffDias < 14) prioridade = 1
        else if (diffDias < 21) prioridade = 2
    }

    const prioridadeAtalho = prioridade < 3
        ? modAlerta(`Obra começará em breve! <br><small>Mude o status para 
            <b>Finalizado</b>, 
            <br><b>Obra paralisada</b>, 
            <b>POC Em andamento</b> 
            <br>ou 
            <b>Em andamento</b> 
            para remover</small>`)
        : ''

    const aviso = emAnalise
        ? `
        <div style="${horizontal}; gap: 1rem; padding: 1rem;">
            <img src="gifs/alerta.gif">
            <span>Este orçamento precisa ser aprovado!</span>
        </div>`
        : ''

    const acumulado = `
        <label style="color: #222; text-align: left;" id="cliente_status">${cliente?.nome || '??'}</label>
        <hr>
        <div style="${horizontal}; gap: 5px;">
            <span>Classificar como <b>CHAMADO</b></span>
            <input ${orcamento?.chamado == 'S' ? 'checked' : ''} onclick="ativarChamado(this, '${id}')" ${styChek} type="checkbox">
        </div>
        <hr>
        ${aviso}
        <div class="opcoes-orcamento">${botoesDisponiveis}</div>

        ${atalho}
        ${prioridadeAtalho}
    `

    const menuOpcoesOrcamento = document.querySelector('.menu-opcoes-orcamento')

    if (menuOpcoesOrcamento) return menuOpcoesOrcamento.innerHTML = acumulado

    popup({ elemento: `<div class="menu-opcoes-orcamento">${acumulado}</div>`, titulo: 'Opções do Orçamento' })

}

async function mudarNumORC(id) {

    overlayAguarde()

    const resposta = await numORC(id)

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    if (resposta.numero) {

        db.dados_orcamentos[id].dados_orcam.contrato = resposta.numero
        await inserirDados({ [id]: db.dados_orcamentos[id] }, 'dados_orcamentos')
        await telaOrcamentos()

        popup({ mensagem: `Alterado para <b>${resposta.numero}</b>` })
    }

    removerOverlay()

}

async function abrirOS(idOrcamento) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))
    window.open('os.html', '_blank')

}

async function vincularOrcamento(idOrcamento) {

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
            <span>Escolha o <b>Orçamento</b> para vincular</span>

            <div style="${horizontal}; gap: 1rem;">
                <span class="opcoes"
                name="orcamento"
                onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/chamado', 'dados_orcam/contrato', 'dados_orcam/analista', 'total_geral[dinheiro]'])">
                    Selecione
                </span>
                <img src="imagens/concluido.png" style="width: 2rem;" onclick="confirmarVinculo('${idOrcamento}')">
            </div>
        </div>
    `

    popup({ elemento, titulo: 'Vincular orçamentos' })

}

async function confirmarVinculo(idOrcamento) {

    overlayAguarde()

    const orcamentoMaster = document.querySelector('[name="orcamento"]')
    const idMaster = orcamentoMaster.id

    if (!idMaster) return popup({ mensagem: 'Escolha um orçamento' })
    if (idMaster == idOrcamento) return popup({ mensagem: 'Os orçamentos são iguais [O mesmo]' })

    const dados = {
        data: new Date().toLocaleString(),
        usuario: acesso.usuario
    }

    enviar(`dados_orcamentos/${idMaster}/vinculados/${idOrcamento}`, dados)

    db.dados_orcamentos[idMaster].vinculados ??= {}
    db.dados_orcamentos[idMaster].vinculados[idOrcamento] = dados
    await inserirDados({ [idMaster]: db.dados_orcamentos[idMaster] }, 'dados_orcamentos')

    removerPopup()
    removerPopup()

    await telaOrcamentos()

}

async function confirmarRemoverVinculo(idOrcamento, master) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `desfazerVinculo('${idOrcamento}', '${master}')` }
    ]

    popup({ botoes, mensagem: 'Deseja desfazer vínculo?', nra: true })

}

async function desfazerVinculo(idOrcamento, master) {

    overlayAguarde()

    delete db.dados_orcamentos[master].vinculados[idOrcamento]

    deletar(`dados_orcamentos/${master}/vinculados/${idOrcamento}`)

    await inserirDados({ [master]: db.dados_orcamentos[master] }, 'dados_orcamentos')

    await telaOrcamentos()

    removerPopup()

}

async function usuariosAutorizados() {

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
            
            <div style="${horizontal}; gap: 5px;">
                <span class="opcoes" name="usuario" onclick="cxOpcoes('usuario', 'dados_setores', ['usuario', 'setor', 'permissao'])">Selecionar</span>
                <img src="imagens/concluido.png" style="width: 2rem;" onclick="delegarUsuario()">
            </div>

            <hr style="width: 100%;">

            <div id="autorizados" style="${vertical}; gap: 3px;"></div>
        </div>
    `

    popup({ elemento })

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

        if (!usuario) return popup({ mensagem: 'Selecione um usuário antes' })

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

async function arquivarOrcamento(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    const arquivamento = orcamento?.arquivado == 'S' ? 'N' : 'S'
    orcamento.arquivado = arquivamento
    enviar(`dados_orcamentos/${idOrcamento}/arquivado`, arquivamento)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaOrcamentos()

    removerOverlay()

    const img = orcamento.arquivado ? 'desarquivar' : 'pasta'
    popup({ mensagem: `${orcamento.arquivado ? 'Arquivado' : 'Desarquivado'} com successo!`, imagem: `imagens/${img}.png` })

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

    const elemento = `
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
    if (!painelCustos) popup({ elemento, titulo: 'Painel de Custos' })

    for (const [codigo, item] of Object.entries(dados?.itens || {})) {
        criarLinhaCusto(codigo, item)
    }

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
                <img src="gifs/lampada.gif" style="width: 2rem;">
                <div style="${vertical}; text-align: left; cursor: pointer;">
                    <label><strong>REQUISIÇÃO DISPONÍVEL</strong></label>
                    <label>Clique Aqui</label>
                </div>
            </div>
        `
    } else if (historico.status == 'LPU PARCEIRO') {

        funcaoEditar = `modalLPUParceiro('${chave}')`

        acumulado = `
            <div onclick="detalharLpuParceiro('${chave}')" class="label_requisicao">
                <img src="gifs/lampada.gif" style="width: 2rem;">
                <div style="${vertical}; text-align: left; cursor: pointer;">
                    <label><strong>LPU DISPONÍVEL</strong></label>
                    <label>Clique Aqui</label>
                </div>
            </div>
        `

    } else if (historico.status == 'PEDIDO') {

        acumulado = `
            <div style="${vertical}; gap: 2px;">
                ${labelDestaque('Pedido', historico.pedido)}
                ${labelDestaque('Valor', dinheiro(historico.valor))}
                ${labelDestaque('Tipo', historico.tipo)}
            </div>
            `

        funcaoEditar = `painelAdicionarPedido('${chave}')`

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

        const codOmie = historico?.codOmie || historico?.notaOriginal?.compl?.nIdNF || historico?.notaOriginal?.Cabecalho?.nCodNF
        if (codOmie) {
            const tipo = historico.tipo.toLowerCase() == 'serviço' ? 'serviço' : 'venda_remessa'
            botaoDANFE = balaoPDF({ nf: historico.nf, codOmie, tipo, app: historico.app })
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
            <img src="imagens/editar4.png" style="width: 1.5rem;">
            <label>Editar</label>
        </div>
        `
    }

    return acumulado

}

async function abrirEsquema(id) {

    overlayAguarde()

    if (!id) return popup({ mensagem: 'Ué, não abriu? Tente novamente...' })
    id_orcam = id

    const orcamento = db.dados_orcamentos[id_orcam]
    const contrato = orcamento?.dados_orcam?.contrato
    const oficial = orcamento?.dados_orcam?.chamado || orcamento?.dados_orcam?.contrato
    const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = db.dados_clientes[omie_cliente] || {}
    let blocosStatus = {}

    for (const [chave, historico] of Object.entries(orcamento?.status?.historico || {})) {

        const { anexos } = historico

        const statusCartao = historico.status
        const cor = coresST?.[statusCartao]?.cor || '#808080'

        blocosStatus[statusCartao] ??= ''

        const excluir = (historico.executor == acesso.usuario || acesso.permissao == 'adm')
            ? `<span class="close" style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" onclick="apagarStatusHistorico('${chave}')">&times;</span>`
            : ''

        const stringAnexos = Object.entries(anexos || {})
            .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexo('${chave}', '${idAnexo}', this)`))
            .join('')

        blocosStatus[statusCartao] += `
            <div class="bloco-status" style="padding: 5px; border: 1px solid ${cor};">

                <div style="${vertical}; background-color: ${cor}1f; padding: 5px; border-top-right-radius: 3px; border-top-left-radius: 3px;">
                    ${excluir}
                    ${labelDestaque('Chamado', oficial)}
                    ${labelDestaque('Executor', historico.executor)}
                    ${labelDestaque('Data', historico.data)}
                    ${labelDestaque('Comentário', `
                        <div>
                            <textarea oninput="mostrarConfirmacao(this)" style="resize: vertical; width: 90%;">${historico?.comentario || ''}</textarea>
                            <span class="btnConfirmar" onclick="atualizarPedido('${chave}', 'comentario', this)">Atualizar</span>
                        </div>    
                        `)}

                    ${elementosEspecificos(chave, historico)}

                    <div class="contorno-botoes" style="background-color: ${cor}">
                        <img src="imagens/anexo2.png" style="width: 1.5rem;">
                        <label>Anexo
                            <input type="file" style="display: none;" onchange="salvarAnexo('${chave}', this)" multiple>  
                        </label>
                    </div>

                    <div name="anexos_${chave}" style="${vertical};">
                        ${stringAnexos}
                    </div>

                </div>

            </div>
        `
    }

    const blocos = Object
        .values(blocosStatus)
        .map(div => `
            <div class="cartao-status">
                ${div}
            </div>`)
        .join('')

    const linha1 = `
        <div style="${horizontal}; gap: 2rem;">

            <div style="${vertical}; gap: 2px;">
                <label>Status atual</label>
                <select onchange="alterarStatus(this)" style="border-radius: 3px; padding: 3px;">
                    ${['', ...fluxograma].map(fluxo => `
                        <option ${orcamento?.status?.atual == fluxo ? 'selected' : ''}>${fluxo}</option>
                    `).join('')}
                </select>
            </div>
 
            <img onclick="mostrarHistoricoStatus()" src="imagens/historico.png">

            <label style="font-size: 1.5rem;">${oficial} - ${cliente?.nome || '??'}</label>

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

    // Checklist chamado;
    const enviado = Object.values(orcamento?.status?.historicoStatus || {})
        .some(h => h.para == 'ORC ENVIADO')
    const aprovado = Object.values(orcamento?.status?.historicoStatus || {})
        .some(h => h.para == 'ORC APROVADO')
    const pedido = Object.values(orcamento?.status?.historico || {})
        .some(h => h.status == 'PEDIDO')
    const chamado = orcamento?.chamado == 'S'
    const etapas = [
        {
            texto: `
                <div style="${horizontal}; gap: 5px;">
                    <span>Classificar como <b>CHAMADO</b></span>
                    <input ${chamado ? 'checked' : ''} onclick="ativarChamado(this, '${id}')" ${styChek} type="checkbox">
                </div>
            `,
            status: chamado
        },
        { texto: 'Orçamento enviado', status: enviado },
        { texto: 'Orçamento aprovado', status: aprovado },
        { texto: 'Criar um pedido', status: pedido }
    ]

    let liberado = true
    const checks = etapas
        .map(e => {

            if (!e.status) liberado = false

            return `
        <div class="status-check-item">
            <img src="imagens/${e.status ? 'concluido' : 'cancel'}.png">
            <div>${e.texto}</div>
        </div>`
        }).join('')

    const existente = db.dados_ocorrencias[contrato]
    const f1 = liberado ? `unidadeOrc = '${omie_cliente}'; formularioOcorrencia()` : ''
    const f2 = existente ? `formularioCorrecao('${contrato}')` : ''

    const pChamado = `
        <div class="status-check-ocorrencias">
            <span>Para abrir a <b>OCORRÊNCIA</b><br></span>
            <span>Realize as etapas abaixo:</span>
            <hr>
            ${checks}
            <hr>
            <div style="${horizontal}; gap: 1rem;">
                <button onclick="${f1}" style="opacity: ${liberado ? '1' : '0.5'};">Abrir chamado</button>
                <button onclick="${f2}" style="background-color: #e47a00; opacity: ${existente ? '1' : '0.5'};">Incluir correção</button>
                ${existente ? `<img src="imagens/pesquisar2.png" onclick="verCorrecoes('${contrato}')">` : ''}
            </div>
        </div>
    `

    const acumulado = `
        <div style="${vertical}; gap: 10px; padding: 3px;">

            ${linha1}

            <hr>

            <div class="status-botoes">
                
                ${botao('Novo Pedido', `painelAdicionarPedido()`, '#4CAF50')}
                ${botao('Requisição Materiais', `detalharRequisicao(undefined, 'infraestrutura')`, '#B12425')}
                ${botao('Requisição Equipamentos', `detalharRequisicao(undefined, 'equipamentos')`, '#B12425')}
                ${botao('Nova Nota Fiscal', `painelAdicionarNotas()`, '#ff4500')}

                ${(acesso.permissao == 'adm' || acesso.setor == 'LOGÍSTICA')
            ? botao('Novo Envio de Material', `envioMaterial()`, '#b17724')
            : ''}
                
                ${botao('LPU Parceiro', `modalLPUParceiro()`, '#0062d5')}

            </div>
        </div>

        <div class="container-blocos">
            <div style="${vertical}; witdth: 100%; gap: 0.5rem;">
                ${pChamado}
                <hr>
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

    popup({ elemento: `<div class="painel-historico">${acumulado}</div>`, titulo: 'Histórico do Orçamento' })

}

async function verCorrecoes(idOcorrencia) {

    const elemento = `
        <div class="status-correcoes">
            ${carregarCorrecoes()}
        </div>
    `
    popup({ elemento, titulo: 'Correções' })
}

async function atualizarPedido(chave, campo, imgSelect) {

    overlayAguarde()

    const orcamento = db.dados_orcamentos[id_orcam]

    const elemento = campo == 'tipo' ? imgSelect : imgSelect.previousElementSibling;

    const valor = campo == 'valor' ? Number(elemento.value) : elemento.value

    orcamento.status.historico[chave][campo] = valor

    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/${campo}`, valor)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    campo !== 'tipo' ? imgSelect.style.display = 'none' : ''

    removerOverlay()
}

function mostrarConfirmacao(elemento) {
    let img = elemento.nextElementSibling;
    img.style.display = 'block'
}

async function alterarStatus(select) {

    const orcamento = db.dados_orcamentos[id_orcam]
    orcamento.status ??= {}
    orcamento.status.historicoStatus ??= {}
    const statusAnterior = orcamento.status?.atual || ''

    const novoSt = select.value
    if (orcamento.status?.atual == novoSt) return

    const bloq = ['REQUISIÇÃO', 'CONCLUÍDO']

    const temPedido = Object.values(orcamento?.status?.historico || {}).some(s => s.status == 'PEDIDO')

    if (!temPedido && bloq.includes(novoSt)) {
        select.value = statusAnterior
        popup({ mensagem: 'Não é possível ir para <b>REQUISIÇÃO</b> ou <b>CONCLUÍDO</b> se o orçamento não tiver Pedido' })
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

    db.dados_orcamentos[id_orcam] = orcamento

    if (novoSt == 'ORC PENDENTE') formularioOrcPendente(idStatus)
    if (novoSt == 'ORC APROVADO') {
        formularioOrcAprovado()
        const resposta = await criarDepartamento(id_orcam)
        if (resposta.mensagem) 
            popup({ mensagem: resposta.mensagem })
    }

    if (telaAtiva == 'orcamentos') await telaOrcamentos(true)

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico) await abrirEsquema(id_orcam)
}

function formularioOrcAprovado(idOrcamento) {

    const orcamento = db.dados_orcamentos[idOrcamento]

    const linhas = [
        {
            texto: 'Qual a previsão de início?',
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <input name="prioridade" oninput="mostrarPrioridade()" type="date" value="${orcamento?.inicio || ''}">
                    <div id="indicador"></div>
                </div>
                `
        }
    ]

    const funcao = `salvarPrioridade('${idOrcamento}')`
    const botoes = [{ texto: 'Salvar', img: 'concluido', funcao }]

    popup({ linhas, botoes, titulo: 'Prioridade do Orçamento' })

}

async function salvarPrioridade(idOrcamento) {

    const input = document.querySelector('[name="prioridade"]')
    const orcamento = db.dados_orcamentos[idOrcamento]

    if (!input.value) return removerPopup()

    orcamento.inicio = input.value
    removerPopup()

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/inicio`, input.value)

    await abrirAtalhos(idOrcamento)
    await telaOrcamentos()

}

async function irORC(idOrcamento) {

    overlayAguarde()

    const orcamento = db.dados_orcamentos[idOrcamento]
    const aba = orcamento.aba || ''

    if (!aba)
        return popup({ mensagem: 'Coloque o orçamento em uma <b>aba</b> antes!', titulo: 'Orçamento sem aba definida' })

    await telaInicial()

    mostrarGuia(aba)

    const tbody = document.querySelector(`#body${aba}`)
    const trs = tbody.querySelectorAll('tr')

    for (const tr of trs) {
        tr.style.display = tr.id !== idOrcamento ? 'none' : ''
    }

    removerPopup()

}

function mostrarPrioridade() {
    const div = document.getElementById('indicador')
    const input = document.querySelector('[name="prioridade"]')

    if (!div || !input || !input.value) return

    const hoje = new Date()
    const data = new Date(input.value)

    const diffDias = Math.abs(hoje - data) / (1000 * 60 * 60 * 24)

    let img = ''

    if (diffDias < 7) img = 'gifs/atencao.gif'
    else if (diffDias < 14) img = 'gifs/alerta.gif'
    else if (diffDias < 21) img = 'imagens/pendente.png'
    else img = 'imagens/online.png'

    div.innerHTML = `<img src="${img}">`
}

async function mostrarInfo(idOrcamento) {

    overlayAguarde()

    id_orcam = idOrcamento
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const historico = Object.entries(orcamento?.status?.historicoStatus || {})
        .sort(([, a], [, b]) => {
            const aTemInfo = !!a?.info
            const bTemInfo = !!b?.info

            if (aTemInfo && !bTemInfo) return -1
            if (!aTemInfo && bTemInfo) return 1
            return 0
        })

    let campos = ''

    for (const [chave, his] of historico) {

        campos += `
        <div id="${chave}" class="etiquetas" style="${vertical}; gap: 2px; padding: 0.5rem;">
            <span>${his.para} • ${his.data}</span>
            <div name="info" oninput="editarHistorico('${chave}')" class="comentario-padrao" contentEditable="true">${his.info || ''}</div>
            <div style="${horizontal}; gap: 1rem;">
                <span name="responsavel">${his.usuario}</span>
                <img name="confirmar" onclick="salvarInfoAdicional('${chave}')" src="imagens/concluido.png" style="display: none;">
            </div>
        </div>
        `
    }

    const elemento = `
        <div class="comentario-orcamento">
            ${campos || 'Sem histórico de Status'}
        </div>
    `

    popup({ elemento, titulo: 'Informações' })

}

function editarHistorico(chave) {
    const div = document.getElementById(chave)
    div.querySelector('[name="responsavel"]').textContent = acesso.usuario
    div.querySelector('[name="confirmar"]').style.display = ''
}

function formularioOrcPendente(idStatus) {
    const linhas = [
        {
            texto: 'Por que <b>ORC PENDENTE</b>?',
            elemento: `
            <div id="${idStatus}">
                <div class="comentario-padrao" name="info" contentEditable="true"></div>
            </div>
            `
        }
    ]
    const funcao = `salvarInfoAdicional('${idStatus}')`
    const botoes = [{ texto: 'Salvar', img: 'concluido', funcao }]
    popup({ linhas, botoes, titulo: 'Informação adicional' })

}

async function salvarInfoAdicional(idStatus) {

    overlayAguarde()
    const div = document.getElementById(idStatus)
    const info = div.querySelector('[name="info"]').textContent
    const orcamento = db.dados_orcamentos[id_orcam]
    orcamento.status.historicoStatus[idStatus].info = info
    orcamento.status.historicoStatus[idStatus].usuario = acesso.usuario
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/status/historicoStatus/${idStatus}/info`, info)
    enviar(`dados_orcamentos/${id_orcam}/status/historicoStatus/${idStatus}/usuario`, acesso.usuario)
    removerPopup()

}

async function mostrarHistoricoStatus() {
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento?.status?.historicoStatus || Object.entries(orcamento.status.historicoStatus).length === 0) {
        popup({ elemento: 'Nenhuma alteração de status registrada', titulo: 'Histórico de Status' })
        return
    }

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
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
    `

    popup({ elemento, titulo: 'Histórico de Alterações de Status' })
}

async function excluirHiStatus(idStatus) {

    overlayAguarde()

    const orcamento = db.dados_orcamentos[id_orcam]

    delete orcamento.status.historicoStatus[idStatus]

    const trExistente = document.getElementById(`ST_${idStatus}`)

    if (trExistente) trExistente.remove()

    deletar(`dados_orcamentos/${id_orcam}/status/historicoStatus/${idStatus}`)
    delete db.dados_orcamentos[id_orcam].status.historicoStatus[idStatus]
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico) await abrirEsquema(id_orcam)

    removerOverlay()

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

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluir_comentario('${id_comentario}', '${chave}')` }
    ]

    popup({ mensagem: 'Excluir o comentário?', botoes })
}

async function excluir_comentario(id_comentario, chave) {
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let comentarios = orcamento.status.historico[chave].comentarios || {}

    delete comentarios[id_comentario]

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/comentarios/${id_comentario}`)
    carregarComentarios(chave)
    removerPopup()
}

function carregarComentarios(chave) {

    const orcamento = db.dados_orcamentos[id_orcam]
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
    carregarComentarios(chave)
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
    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirOrcamentoBase('${id}')` }
    ]
    popup({ mensagem: 'Deseja realmente excluir o orçamento?', botoes })
}

async function excluirOrcamentoBase(idOrcamento) {
    removerPopup()
    overlayAguarde()

    await deletarDB('dados_orcamentos', idOrcamento)

    deletar(`dados_orcamentos/${idOrcamento}`)

    await telaOrcamentos()
    removerPopup()
}

async function detalharRequisicao(chave, tipoRequisicao, apVisualizar) {

    if (!chave) chave = ID5digitos()

    const orcamento = db.dados_orcamentos[id_orcam]
    const cliente = db.dados_clientes?.[orcamento.dados_orcam.omie_cliente] || {}
    const cartao = orcamento?.status?.historico?.[chave] || {}
    let btnFlutuante = ''

    // Carrega os itens adicionais se existirem
    itensAdicionais = {}
    let comentarioExistente = ''

    if (cartao.adicionais) itensAdicionais = cartao.adicionais
    if (cartao.comentario) comentarioExistente = cartao.comentario
    if (cartao.requisicoes) requisicoesExistente = cartao.requisicoes

    let campos = ''
    let toolbar = ''

    if (!apVisualizar) {
        toolbar += `
        <div class="requisicao-pesquisa">
            <img src="imagens/pesquisar4.png" style="padding: 5px;">
            <input id="pesquisa1" placeholder="Pesquisar" oninput="pesqRequisicao()">
        </div>
        `

        const opcoes = ['JAMEF', 'CORREIOS', 'JADLOG', 'OUTROS']
            .map(op => `<option ${cartao?.transportadora == op ? 'selected' : ''}>${op}</option>`)
            .join('')

        campos = `
        <div class="requisicao-contorno" style="width: 500px;">
            <div class="requisicao-titulo">Dados da Requisição</div>
            <div class="requisicao-dados">
                
                <div style="${vertical}; width: 100%;">
                    <select id="transportadora">
                        ${opcoes}
                    </select>
                </div>

                <div style="${vertical}; width: 100%;">
                    <span>Volumes</span>
                    <input value="${cartao?.volumes || ''}" id="volumes" type="number">
                </div>

                <div style="${vertical}; width: 100%;">
                    <label>Comentário</label>
                    <textarea rows="3" id="comentario_status" style="width: 80%;">${comentarioExistente}</textarea>
                </div>

                <button onclick="salvarRequisicao('${chave}')">Salvar Requisição</button>
            </div>
        </div>
        `
    }

    const modeloLabel = (valor1, valor2) => `<label><strong>${valor1}</strong> ${valor2}</label>`

    const colunas = ['Cod GCS', 'Cod OMIE', 'Informações do Item', 'Tipo', 'Quantidade', 'Valor Unitário', 'Valor Total', 'Requisição']
        .map(col => `<th>${col}</th>`)
        .join('')

    const elemento = `

    ${btnFlutuante}

    <div id="pdf" class="requisicao-tela">

        <div class="requisicao-contorno" style="width: 98%">
            <div class="requisicao-cabecalho">
                <img src="https://i.imgur.com/5zohUo8.png">
                <span>REQUISIÇÃO DE COMPRA DE MATERIAL</span>
            </div>
        </div>

        <div style="${horizontal}; gap: 2rem; margin: 10px;">

            ${campos}
                
            <div class="requisicao-contorno">
                <div class="requisicao-titulo">Dados do Cliente</div>
                <div class="requisicao-dados">

                    ${modeloLabel('Cliente', cliente?.nome || '')}
                    ${modeloLabel('CNPJ', cliente?.cnpj || '')}
                    ${modeloLabel('Endereço', cliente?.endereco || '')}
                    ${modeloLabel('Bairro', cliente?.bairro || '')}
                    ${modeloLabel('Cidade', cliente?.cidade || '')}
                    ${modeloLabel('Chamado', orcamento.dados_orcam.contrato)}
                    ${modeloLabel('Condições', orcamento.dados_orcam.condicoes)}

                </div>
            </div>

            <div class="requisicao-contorno">
                <div class="requisicao-titulo">Total</div>
                <div class="requisicao-dados">
                    <label id="total_requisicao"></label> 
                </div>
            </div>

            ${apVisualizar
            ? `<img id="bPdf" src="imagens/pdf.png" onclick="gerarPdfRequisicao('${cliente.nome || '-'}')">`
            : ''
        }

        </div>

        <div id="tabela_itens" style="width: 100%; display: flex; flex-direction: column; align-items: left;">

        <div class="requisicao-contorno">
            ${toolbar}
            <table class="tabela" id="tabela_requisicoes" style="width: 100%; font-size: 0.8em; table-layout: auto; border-radius: 0px;">
                <thead style="background-color: #f1f1f1;">${colunas}</thead>
                <tbody>
                    ${await carregarItensRequisicao(apVisualizar, tipoRequisicao, chave)}
                </tbody>
            </table>
        <div>
    <div>
    `
    popup({ elemento, cor: 'white', titulo: 'Requisição' })

    // Preenche os campos com os dados existentes se estiver editando    
    await calcularRequisicao()
    mostrarItensAdicionais()
}

async function salvarAnexo(chave, input) {

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (input.files.length === 0) {
        popup({ elemento: 'Nenhum arquivo selecionado...' })
        return
    }

    let anexos = await importarAnexos({ input }) // Retorna uma lista [{}, {}]

    anexos.forEach(anexo => {

        if ((orcamento.status.historico[chave].anexos && Array.isArray(orcamento.status.historico[chave].anexos) || !orcamento.status.historico[chave].anexos)) {
            orcamento.status.historico[chave].anexos = {};
        }

        let id = ID5digitos()

        orcamento.status.historico[chave].anexos[id] = anexo
        enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/anexos/${id}`, anexo)
    })

    db.dados_orcamentos[id_orcam] = orcamento
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos');

    const div = document.querySelector(`[name="anexos_${chave}"`)

    const stringAnexos = Object.entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexo('${chave}', '${idAnexo}', this)`))
        .join('')

    div.innerHTML = stringAnexos

}

async function apagarStatusHistorico(chave) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `confirmarExclusaoStatus('${chave}')` }
    ]

    popup({ botoes, mensagem: 'Excluir item do histórico?', titulo: 'Excluir Status' })
}


async function confirmarExclusaoStatus(chave) {

    removerPopup()
    overlayAguarde()

    delete db.dados_orcamentos[id_orcam].status.historico[chave]
    deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`)
    await inserirDados({ [id_orcam]: db.dados_orcamentos[id_orcam] }, 'dados_orcamentos')
    await abrirEsquema(id_orcam)

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

    const elemento = `
    <div style="min-width: 300px; ${vertical};">

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
    popup({ elemento, titulo: 'Envio de Material' })
}

async function irOS(idOrcamento) {
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('os.html', '_blank')
}

function voltar() {
    window.history.back();
}

let dadosEmpresas = {
    'AC SOLUÇÕES': {
        'Razão Social': 'AC SOLUCOES INTEGRADAS DE INFORMATICA LTDA',
        'CNPJ': '13.421.071/0001-00',
        'E-mail': 'financeiro@acsolucoesintegradas.com.br',
        'Telefones': '(71) 3901-3655 (71) 98240-3038',
        'Localização': 'CEP 40261-010, Rua Luís Negreiro, nº 701, Luis Anselmo - Salvador(BA)'
    },
    'HNK': {
        'Razão Social': 'HNK COMERCIO E SERVICOS DE EQUIPAMENTOS DE COMUNICACAO LTDA',
        'CNPJ': '33.910.883/0001-26',
        'E-mail': 'financeiro@acsolucoesintegradas.com.br',
        'Telefones': '(71) 3901-3655 (71) 98240-3038',
        'Localização': 'CEP 40261-010, AV SANTOS DUMONT, nº 1883, CENTRO - Lauro de Freitas (BA)'
    },
    'HNW': {
        'Razão Social': 'HNW COMERCIO DE EQUIPAMENTOS, SERVICOS E TELEATENDIMENTO LTD',
        'CNPJ': '41.761.486/0001-68',
        'E-mail': 'financeiro@acsolucoesintegradas.com.br',
        'Telefones': '(71) 3901-3655 (71) 98240-3038',
        'Localização': 'CEP 40261-010, Rua Luís Negreiro, nº 701, Luis Anselmo - Salvador(BA)'
    }
}

var perc_parceiro = 0.35
preencher_v2()

function excel() {
    var orcam_ = JSON.parse(localStorage.getItem('pdf')).id
    ir_excel(orcam_)
}

function criar_bloco_html(titulo, dados) {

    var linhas = ''

    for (item in dados) {
        if (dados[item] && dados[item] !== '') {
            linhas += `
            <label style="margin: 5px;"><strong>${item}</strong> <br>${dados[item].replace(/\n/g, '<br>')}</label>
        `
        }
    }

    var acumulado = `
        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">${titulo}</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940;">
            ${linhas}
            </div>
        </div>
        `
    return acumulado
}

async function atualizar_dados_pdf() {
    let campo_atualizar = document.getElementById('campo_atualizar')

    if (campo_atualizar) {
        campo_atualizar.innerHTML = `
        <img src="gifs/loading.gif" style="width: 5vw;">
        `

        try {
            await inserirDados(await receber('dados_composicoes'), 'dados_composicoes')

            let dados_orcamentos = await receber('dados_orcamentos')
            await inserirDados(dados_orcamentos, 'dados_orcamentos')
            let pdf = JSON.parse(localStorage.getItem('pdf'))
            let orcamento_v2 = dados_orcamentos[pdf.id]
            localStorage.setItem('pdf', JSON.stringify(orcamento_v2))
        } catch (error) {
            const ERROR_MESSAGE = 'Erro ao atualizar os itens da composição:'
            console.log(ERROR_MESSAGE, error)
            alert(ERROR_MESSAGE, error)
        } finally {
            f5()
        }
    }
}

async function preencher_v2() {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {};

    // LÓGICA DOS DADOS
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let informacoes = { 
        ...orcamento_v2.dados_orcam,
        ...dados_clientes?.[orcamento_v2.dados_orcam.omie_cliente] || {}
    }

    let empresaEmissora = dadosEmpresas[informacoes?.emissor || 'AC SOLUÇÕES']

    let dados_por_bloco = {
        'Dados da Proposta': {
            'Número do Chamado': informacoes.contrato,
            'Tipo de Frete': informacoes.tipo_de_frete,
            'Condições de Pagamento': informacoes.condicoes,
            'Garantia': informacoes.garantia == '' ? 'Conforme tratativa Comercial' : informacoes.garantia,
            'REF': ''
        },
        'Dados do Cliente': {
            'Razão Social ou Nome Fantasia': informacoes.nome,
            'CNPJ': informacoes.cnpj,
            'CEP': informacoes.cep,
            'Endereço': informacoes.bairro,
            'Cidade': informacoes.cidade,
            'Estado': informacoes.estado
        },
        'Dados da Empresa': {
            'Razão Social': empresaEmissora['Razão Social'],
            'CNPJ': empresaEmissora['CNPJ'],
            'E-mail': empresaEmissora['E-mail'],
            'Telefones': empresaEmissora['Telefones'],
            'Localização': empresaEmissora['Localização']
        },
        'Contato Analista': {
            'Analista': informacoes.analista,
            'E-mail': informacoes.email_analista,
            'Telefone': informacoes.telefone_analista
        },
        'Contato Vendedor': {
            'Vendedor': informacoes.vendedor,
            'E-mail': informacoes.email_vendedor,
            'Telefone': informacoes.telefone_vendedor
        }
    }

    // LÓGICA DOS ITENS
    let html_orcamento = document.getElementById('html_orcamento')
    html_orcamento.innerHTML = ''

    let tabelas = ''
    let itens = orcamento_v2.dados_composicoes

    let cabecalho = {
        1: 'Código',
        2: 'Descrição',
        3: 'Imagem *Ilustrativa',
        4: 'Unidade',
        5: 'Qtde',
        6: 'UNT S/ICMS',
        7: 'TOTAL S/ICMS',
        8: '% ICMS',
        9: 'UNT',
        10: 'TOTAL'
    }

    let config = {
        'ALUGUEL': { colunas: [1, 2, 3, 4, 5, 9, 10], cor: 'green' },
        'USO E CONSUMO': { colunas: [1, 2, 3, 4, 5, 9, 10], cor: '#24729d' },
        'SERVIÇO': { colunas: [1, 2, 3, 4, 5, 9, 10], cor: 'green' },
        'VENDA': { colunas: [1, 2, 3, 4, 5, 6, 7, 9, 10], cor: '#B12425' }
    }


    let totais = {
        GERAL: { valor: 0, cor: '#151749' }
    };

    for (it in itens) {
        let item = itens[it]
        let colunas = config[item.tipo].colunas

        let itemComposicao = dados_composicoes[it]
        let lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
        let tabelaPreco = itemComposicao?.[lpu]


        // ICMS de Saída só pode ser 4, 12 ou 20.5 [Para venda dentro, fora do estado, ou quando o creditado for 4 == IMPORTADO]
        let icms = 0
        if (tabelaPreco) {
            let ativo = tabelaPreco.ativo
            let historico = tabelaPreco.historico
            let precoAtivo = historico[ativo]
            icms = precoAtivo?.icms_creditado == 4 ? 4 : 0 
        }

        if (icms == 0) {
            let estado = informacoes.estado
            icms = estado == 'BA' ? 20.5 : 12
        }

        if (!totais[item.tipo]) {
            totais[item.tipo] = { linhas: '', valor: 0 }
        }

        if (item.tipo_desconto) {
            let desconto = item.tipo_desconto == 'Dinheiro' ? item.desconto : item.custo * (item.desconto / 100)
            desconto = desconto / item.qtde
            item.custo = item.custo - desconto
        }

        item.total = item.custo * item.qtde;
        totais[item.tipo].valor += item.total // Total isolado do item;
        totais.GERAL.valor += item.total // Total GERAL;
        
        let unitarioSemIcms = item.custo - (item.custo * (icms / 100))
        let totalSemIcms = unitarioSemIcms * item.qtde
        let tds = {}

        tds[1] = `<td>${item.codigo}</td>`
        tds[2] = `<td style="text-align: left;">${item?.descricao || 'N/A'}</td>`
        tds[3] = `<td style="text-align: center;"><img src="${itemComposicao?.imagem || item?.imagem || 'https://i.imgur.com/Nb8sPs0.png'}" style="width: 2vw;"></td>`
        tds[4] = `<td>${item?.unidade || 'UN'}</td>`
        tds[5] = `<td>${item.qtde}</td>`
        tds[6] = `<td style="white-space: nowrap;">${dinheiro(unitarioSemIcms)} (${icms}%)</td>`
        tds[7] = `<td style="white-space: nowrap;">${dinheiro(totalSemIcms)}</td>`
        tds[8] = `<td>${icms}%</td>`
        tds[9] = `<td style="white-space: nowrap;">${dinheiro(item.custo)}</td>`
        tds[10] = `<td style="white-space: nowrap;">${dinheiro(item.total)}</td>`

        let celulas = ''
        colunas.forEach(col => {
            celulas += tds[col]
        })

        totais[item.tipo].linhas += `
            <tr>
                ${celulas}
            </tr>
            `

        if (!totais[item.tipo].ths) {
            totais[item.tipo].ths = ''
            colunas.forEach(col => {

                let complemento = ''
                if(item.tipo == 'VENDA' && (col == 9 || col == 10)) complemento = 'COM ICMS'

                totais[item.tipo].ths += `<th style="color: white;">${cabecalho[col]} ${complemento}</th>`
            })

        }

    }

    for (tab in totais) {

        if (tab == 'ICMS' || tab == 'GERAL') continue

        let tabela = `
        <div>
            <div style="display: flex; align-items: center; justify-content: start;">
                <label style="font-size: 1.3vw;"><strong>${tab.includes('USO') ? `${tab} - SERVIÇO` : tab}</strong></label> 
            </div>
            <table class="tabela">
                <thead style="font-size: 0.7em; color: white; background-color: ${config[tab]?.cor || '#222'}">
                    ${totais[tab].ths}
                </thead>
                <tbody style="font-size: 0.7em;">
                    ${totais[tab].linhas}
                </tbody>
            </table>
            <div style="border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; width: 100%; display: flex; align-items: center; color: white; justify-content: right; background-color: ${config[tab]?.cor}">
                <label style="padding: 5px;">Total ${dinheiro(totais[tab].valor)}</label>
            </div>
        </div>
        <br>
        <hr style="width: 100%;">
        `

        if (totais[tab].linhas != '') {
            tabelas += tabela
        }
    }

    let divs_totais = ''
    let etiqueta_desconto = ''
    let total_bruto = orcamento_v2?.total_bruto || 0
    let total_liquido = orcamento_v2.total_geral;

    if (total_bruto != 0) { // Quer dizer que existe desconto neste orçamento;
        totais.DESCONTO = { valor: Number(total_bruto.toFixed(2)) - conversor(total_liquido) }
        config.DESCONTO = { cor: '#b96300' }
    }

    let ordemTotais = Object.entries(totais)

    let totalGeralBackup = ordemTotais[0]
    ordemTotais.splice(ordemTotais, 1)
    ordemTotais.push(totalGeralBackup)

    for ([tot, objeto] of ordemTotais) {
        if (objeto.valor !== 0) {
            divs_totais += `
                <div id="total_${tot}" class="totais" style="background-color: ${config[tot]?.cor}">
                    TOTAL ${tot} ${dinheiro(objeto?.valor)}
                </div>
            `;
        }
    }

    html_orcamento.innerHTML = `
    <label>Salvador, Bahia, ${carimbo_data()}</label>

    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
        ${criar_bloco_html('Dados da Proposta', dados_por_bloco['Dados da Proposta'])}
        ${criar_bloco_html('Dados do Cliente', dados_por_bloco['Dados do Cliente'])}
    </div>

    ${criar_bloco_html('Dados da Empresa', dados_por_bloco['Dados da Empresa'])}

    <div class="contorno">
        <div class="titulo">
            Itens do Orçamento
        </div>

        ${tabelas}

        <div style="display: flex; align-items: center; justify-content: start; gap: 10px;">
            <div style="display: flex; flex-direction: column;">
                ${divs_totais}
            </div>

            ${etiqueta_desconto}
        </div>
    </div>

    ${criar_bloco_html('Considerações', { Considerações: informacoes.consideracoes })}

    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
        ${criar_bloco_html('Contato Analista', dados_por_bloco['Contato Analista'])}
        ${criar_bloco_html('Contato Vendedor', dados_por_bloco['Contato Vendedor'])}
    </div>`

}

function carimbo_data() {
    let dataAtual = new Date();
    let opcoes = { day: 'numeric', month: 'long', year: 'numeric' };
    let dataFormatada = dataAtual.toLocaleDateString('pt-BR', opcoes);

    return dataFormatada
}

function ocultarElementos() {
    let ocultar = document.querySelector('.ocultar')
    let total_desconto = document.getElementById('total_DESCONTO')
    let exibir = ocultar.style.display == 'none'

    ocultar.style.display = exibir ? '' : 'none'
    if (total_desconto) total_desconto.style.display = exibir ? '' : 'none'
}

async function gerarPDF() {
    preencher_v2();
    ocultarElementos()

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    const orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}
    const contrato = orcamento_v2.dados_orcam.contrato
    let omie_cliente = orcamento_v2.dados_orcam?.omie_cliente || ''
    let cliente = dados_clientes?.[omie_cliente]?.nome || ''

    await gerar_pdf_online(document.documentElement.outerHTML, `Orcamento_${cliente}_${contrato}`);
    ocultarElementos()
}

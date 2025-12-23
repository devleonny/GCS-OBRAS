function voltar() {
    window.history.back();
}

const dadosEmpresas = {
    'IAC': {
        'Razão Social': 'IAC',
        'CNPJ': '61.807.993/0001-00',
        'E-mail': 'financeiroiac@outlook.com.br',
        'Telefones': '(11) 96300-7299',
        'Localização': 'CEP 42.702-901, Avenida Luiz Tarquínio Pontes, nº 132, Galpões 06, 07 e 08, CENTRO - Lauro de Freitas (BA)'
    },
    'AC SOLUÇÕES': {
        'Razão Social': 'AC SOLUCOES INTEGRADAS DE INFORMATICA LTDA',
        'CNPJ': '13.421.071/0001-00',
        'E-mail': 'financeiro@grupocostasilva.com.br',
        'Telefones': '(11) 96300-7299',
        'Localização': 'CEP 42.702-420, Avenida Luiz Tarquínio Pontes, nº 132, Galpões 06, 07 e 08, CENTRO - Lauro de Freitas (BA)'
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

preencher()

function excel() {
    var orcam_ = JSON.parse(localStorage.getItem('pdf')).id
    ir_excel(orcam_)
}

function blocoHtml(titulo, dados = {}) {

    let linhas = ''

    for (const [chave, dado] of Object.entries(dados)) {
        if (dado == '') continue

        linhas += `
        <div style="${vertical}; gap: 5px;">
            <label><b>${chave}</b></label> 
            <div>${dado}</div>
        </div>`

    }

    const acumulado = `
        <div class="contorno">
            <div class="pilula">
                <span>${titulo}</span>
                <div style="${vertical}">${linhas}</div>
            </div>
        </div>
        `
    return acumulado
}

async function atualizarDadosPdf() {

    try {

        overlayAguarde(true)

        semOverlay = true

        await sincronizarDados('dados_orcamentos')
        await sincronizarDados('dados_composicoes')

        const pdf = JSON.parse(localStorage.getItem('pdf'))
        const orcamentoBase = await recuperarDado('dados_orcamentos', pdf.id)
        localStorage.setItem('pdf', JSON.stringify(orcamentoBase))
        location.reload(true)

        semOverlay = false

    } catch (error) {
        console.log(error)
    }

    removerOverlay()
}

async function preencher() {

    const dados_composicoes = await recuperarDados('dados_composicoes') || {}
    const orcamentoBase = JSON.parse(localStorage.getItem('pdf')) || {}

    if (orcamentoBase.emAnalise)
        document.body.classList.add('marca-ativa')
    else
        document.body.classList.remove('marca-ativa')

    // LÓGICA DOS DADOS
    const cliente = await recuperarDado('dados_clientes', orcamentoBase?.dados_orcam?.omie_cliente) || {}
    const informacoes = {
        ...orcamentoBase.dados_orcam,
        ...cliente
    }

    const empresaEmissora = dadosEmpresas[informacoes?.emissor || 'AC SOLUÇÕES']

    const imgLogo = document.getElementById('logo')
    imgLogo.src = informacoes?.emissor == 'IAC' ? 'https://i.imgur.com/6FWwz7l.png' : 'https://i.imgur.com/qZLbNfb.png'
    imgLogo.style.width = informacoes?.emissor == 'IAC' ? '100px' : '10rem'

    // Nome orçamento atual;
    const chamContrato = orcamentoBase?.dados_orcam?.chamado || orcamentoBase?.dados_orcam?.contrato || ''
    let nomeChamado = `<label>${chamContrato}</label>`

    // Chamado Master;
    if (orcamentoBase.hierarquia) {
        const orcamentoRef = await recuperarDado('dados_orcamentos', orcamentoBase.hierarquia)
        const chamContrato = orcamentoRef?.dados_orcam?.chamado || orcamentoRef?.dados_orcam?.contrato || ''
        if (chamContrato) nomeChamado += `<label class="etiqueta-chamado"><b>cham.</b> ${chamContrato}</label>`
    }

    // Revisão atual, se existir;
    if (orcamentoBase.revisoes && orcamentoBase.revisoes.atual) {
        nomeChamado += `<label class="etiqueta-revisao">${orcamentoBase.revisoes.atual}</label>`
    }

    const dadosPorBloco = {
        'Dados da Proposta': {
            'Número do Chamado': `<div class="nome-chamado">${nomeChamado}</div>`,
            'Tipo de Frete': informacoes.tipo_de_frete,
            'Condições de Pagamento': informacoes.condicoes,
            'Garantia': informacoes.garantia == '' ? 'Conforme tratativa Comercial' : informacoes.garantia,
            'REF': ''
        },
        'Dados do Cliente': {
            'Razão Social ou Nome Fantasia': informacoes?.nome || '--',
            'CNPJ': informacoes?.cnpj || '--',
            'CEP': informacoes?.cep || '--',
            'Endereço': informacoes?.bairro || '--',
            'Cidade': informacoes?.cidade || '--',
            'Estado': informacoes?.estado || '--'
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
        }
    }

    // LÓGICA DOS ITENS
    const html_orcamento = document.getElementById('html_orcamento')
    html_orcamento.innerHTML = ''

    let tabelas = ''
    let itens = orcamentoBase.dados_composicoes || {}

    const cabecalho = {
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

    const config = {
        'ALUGUEL': { colunas: [1, 2, 3, 4, 5, 9, 10], cor: 'green' },
        'USO E CONSUMO': { colunas: [1, 2, 3, 4, 5, 9, 10], cor: '#24729d' },
        'SERVIÇO': { colunas: [1, 2, 3, 4, 5, 9, 10], cor: 'green' },
        'VENDA': { colunas: [1, 2, 3, 4, 5, 6, 7, 9, 10], cor: '#B12425' }
    }

    // Se for IAC por não ser Lucro Presumido, então não deve mostrar os campos de ICMS;
    if (informacoes.emissor == 'IAC') config.VENDA.colunas = [1, 2, 3, 4, 5, 9, 10]

    let totais = {
        GERAL: { valor: 0, cor: '#151749' }
    };

    for (let [codigo, item] of Object.entries(itens)) {

        const colunas = config[item.tipo].colunas
        const itemComposicao = dados_composicoes[codigo] || {}
        const lpu = String(orcamentoBase.lpu_ativa).toLowerCase()
        const tabelaPreco = itemComposicao?.[lpu]
        const estado = informacoes.estado

        // Se o ICMS Creditado for 4% e a venda for para fora do estado: ao invés de 12% vai ser apenas 4%;
        let icms = 0
        if (tabelaPreco) {
            let ativo = tabelaPreco.ativo
            let historico = tabelaPreco.historico
            let precoAtivo = historico[ativo]
            icms = precoAtivo?.icms_creditado == 4 && estado !== 'BA' ? 4 : 0
        }

        if (icms == 0) icms = estado == 'BA' ? 20.5 : 12

        if (!totais[item.tipo]) {
            totais[item.tipo] = { linhas: '', valor: 0 }
        }

        if (item.tipo_desconto) {
            let desconto = item.tipo_desconto !== 'Porcentagem' ? item.desconto : item.custo * (item.desconto / 100)
            desconto = desconto / item.qtde
            item.custo = item.custo - desconto
        }

        item.total = item.custo * item.qtde;
        totais[item.tipo].valor += item.total // Total isolado do item;
        totais.GERAL.valor += item.total // Total GERAL;

        let unitarioSemIcms = item.custo - (item.custo * (icms / 100))
        let totalSemIcms = unitarioSemIcms * item.qtde
        let tds = {}

        const ncm = itemComposicao?.ncm || null

        const descricao = `
            ${item?.descricao || 'N/A'}
            <b>${itemComposicao?.fabricante || ''}</b>
            ${itemComposicao?.modelo || ''}
        `

        tds[1] = `<td>${item.codigo}</td>`
        tds[2] = `
        <td>
            <div style="${vertical}; text-align: left;">
                ${item?.tipo_desconto == 'Venda Direta' ? `
                    <div style="${vertical}; gap: 2px; text-align: left;">
                        <label><b>Venda Direta</b></label>
                        <label><b>Razão Social</b> ${item?.razaoSocial || '--'}</label>
                        <label><b>CNPJ</b> ${item?.cnpj || '--'}</label>
                    </div>
                    ` : ''}
                <label>${descricao}</label>
                ${ncm ? `<label><strong>ncm:</strong> ${ncm}</label>` : ''}
            </div>
        </td>`
        tds[3] = `<td style="text-align: center;"><img src="${itemComposicao?.imagem || item?.imagem || 'https://i.imgur.com/Nb8sPs0.png'}" style="width: 4vw;"></td>`
        tds[4] = `<td>${item?.unidade || 'UN'}</td>`
        tds[5] = `<td>${item.qtde}</td>`
        tds[6] = `<td style="white-space: nowrap;">${dinheiro(unitarioSemIcms)} (${icms}%)</td>`
        tds[7] = `<td style="white-space: nowrap;">${dinheiro(totalSemIcms)}</td>`
        tds[8] = `<td>${icms}%</td>`
        tds[9] = `<td style="white-space: nowrap;">${dinheiro(item.custo)}</td>`
        tds[10] = `<td style="white-space: nowrap;">${dinheiro(item.total)}</td>`

        // Inclusão das linhas na tabela específica;
        totais[item.tipo].linhas += `<tr>${colunas.map(col => tds[col]).join('')}</tr>`

        // Inclusão das THS;
        totais[item.tipo].ths = ''
        colunas.forEach(col => {

            const complemento = (informacoes.emissor !== 'IAC' && item.tipo == 'VENDA' && (col == 9 || col == 10) && empresaEmissora)
                ? 'COM ICMS'
                : ''

            totais[item.tipo].ths += `<th style="color: white;">${cabecalho[col]} ${complemento}</th>`

        })


    }

    for (tab in totais) {

        if (tab == 'ICMS' || tab == 'GERAL') continue

        const tabela = `
        <div>
            <div class="painelTitulo" style="background-color: ${config[tab]?.cor || '#222'}">
                <label>${tab.includes('USO') ? 'MATERIAL PARA APLICAR NO SERVIÇO' : tab}</label> 
            </div>
            <table class="tabela" style="background-color: white;">
                <thead style="font-size: 0.7vw; color: white; background-color: ${config[tab]?.cor || '#222'}">
                    ${totais[tab].ths}
                </thead>
                <tbody style="font-size: 0.7vw;">
                    ${totais[tab].linhas}
                </tbody>
            </table>
            <div style="border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; width: 100%; display: flex; align-items: center; color: white; justify-content: right; background-color: ${config[tab]?.cor}">
                <label style="padding: 5px;">Total ${dinheiro(totais[tab].valor)}</label>
            </div>
        </div>
        <br>
        `

        if (totais[tab].linhas != '') {
            tabelas += tabela
        }
    }

    let divTotais = ''
    let etiqueta_desconto = ''
    let total_bruto = orcamentoBase?.total_bruto || 0
    let total_liquido = orcamentoBase.total_geral;

    if (total_bruto != 0) { // Quer dizer que existe desconto neste orçamento;
        totais.DIFERENÇA = { valor: conversor(total_liquido) - Number(total_bruto.toFixed(2)) }
        config.DIFERENÇA = { cor: '#b96300' }
    }

    let ordemTotais = Object.entries(totais)

    let totalGeralBackup = ordemTotais[0]
    ordemTotais.splice(ordemTotais, 1)
    ordemTotais.push(totalGeralBackup)

    for ([tot, objeto] of ordemTotais) {
        if (objeto.valor == 0 || tot == 'GERAL') continue

        divTotais += `
            <div id="total_${tot}" class="totais" style="background-color: ${config[tot]?.cor}">
                ${tot == 'DIFERENÇA' ? `<label> Valor Original ${dinheiro(orcamentoBase?.total_bruto || '--')}</label>` : ''}
                <label><strong>${tot}</strong> ${dinheiro(objeto.valor)}</label>
            </div>
        `;
    }

    const totalGeral = orcamentoBase.total_geral
    const titulo = 'GERAL'
    divTotais += `
        <div id="total_${titulo}" class="totais" style="background-color: ${totais[titulo].cor}">
            TOTAL ${titulo} ${dinheiro(totalGeral)}
        </div>
    `;

    html_orcamento.innerHTML = `
    ${carimboData(orcamentoBase?.dados_orcam)}

    <div style="${horizontal};">
        ${blocoHtml('Dados da Proposta', dadosPorBloco['Dados da Proposta'])}
        ${blocoHtml('Dados do Cliente', dadosPorBloco['Dados do Cliente'])}
    </div>

    <div style="${horizontal};">
        ${blocoHtml('Dados da Empresa', dadosPorBloco['Dados da Empresa'])}
        ${blocoHtml('Contato do Analista', dadosPorBloco['Contato Analista'])}
    </div>

    <div class="contorno">
        <div class="pilula">
            <span>Itens do Orçamento</span>
            <div>
                <br>
                ${tabelas}

                <div style="display: flex; align-items: center; justify-content: start; gap: 10px;">
                    <div style="display: flex; flex-direction: column;">
                        ${divTotais}
                    </div>

                    ${etiqueta_desconto}
                </div>
            </div>
        </div>
    </div>

    ${informacoes.consideracoes ? blocoHtml('Considerações', { Considerações: informacoes.consideracoes }) : ''}
    `

}

function carimboData(dados_orcam) {

    if (!dados_orcam?.data) return ''

    const validade = Number(dados_orcam.validade || 30)

    // espera: "dd/mm/aaaa, hh:mm"
    const [dataStr, horaStr = '00:00'] = dados_orcam.data.split(',').map(s => s.trim())
    const [dia, mes, ano] = dataStr.split('/').map(Number)
    const [hh, mm] = horaStr.split(':').map(Number)

    const dataBase = new Date(ano, mes - 1, dia, hh, mm)

    // soma os dias de validade
    const dataValidade = new Date(dataBase)
    dataValidade.setDate(dataValidade.getDate() + validade)

    const fmt = d => 
        `${String(d.getDate()).padStart(2, '0')}/` +
        `${String(d.getMonth() + 1).padStart(2, '0')}/` +
        `${d.getFullYear()}, ` +
        `${String(d.getHours()).padStart(2, '0')}:` +
        `${String(d.getMinutes()).padStart(2, '0')}`

    return `
        <div style="${vertical}; gap: 3px;">
            <span>Salvador, Bahia, ${fmt(dataBase)}</span>
            <span>Válido até: ${fmt(dataValidade)}</span>
        </div>
    `
}

function ocultarElementos() {
    const ocultar = document.querySelector('.ocultar')
    const total_desconto = document.getElementById('total_DIFERENÇA')
    const exibir = ocultar.style.display == 'none'

    ocultar.style.display = exibir ? '' : 'none'
    if (total_desconto) total_desconto.style.display = exibir ? '' : 'none'
}

async function gerarPDF() {
    preencher()
    ocultarElementos()

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    const orcamentoBase = JSON.parse(localStorage.getItem('pdf')) || {}
    const contrato = orcamentoBase.dados_orcam.contrato
    let omie_cliente = orcamentoBase.dados_orcam?.omie_cliente || ''
    let cliente = dados_clientes?.[omie_cliente]?.nome || ''

    await gerarPdfOnline(document.documentElement.outerHTML, `Orcamento_${cliente}_${contrato}`)
    ocultarElementos()
}

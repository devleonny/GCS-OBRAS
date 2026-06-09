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
    const parametros = new URLSearchParams(window.location.search)
    const idRecebido = parametros.get('id')
    irExcelOrcamento(idRecebido)
}

function blocoHtml({ titulo, dados }) {

    if (!dados)
        return ''

    const linhas = dados
        .filter(item => item.valor != '')
        .map(({ chave, valor }) => {
            return `
            <div style="${vertical}; gap: 5px;">
                ${chave ? `<label><b>${chave}</b></label>` : ''} 
                <div style="white-space: pre-wrap;">${valor}</div>
            </div>`
        })
        .join('')

    if (!linhas.length)
        return ''

    const acumulado = `
        <div class="contorno">
            <div class="pilula">
                <span class="cab">${titulo}</span>
                <div style="${vertical}">${linhas}</div>
            </div>
        </div>
        `
    return acumulado
}

async function preencher() {

    const parametros = new URLSearchParams(window.location.search)
    const idRecebido = parametros.get('id')
    const orcamentoBase = await recuperarDado('dados_orcamentos', idRecebido) || {}

    const {
        omie_cliente,
        venda_direta,
        tipo_de_frete,
        condicoes,
        consideracoes,
        garantia,
        analista,
        email_analista,
        telefone_analista,
        emissor
    } = orcamentoBase.dados_orcam

    const [cliente, clienteVendaDireta] = await Promise.all([
        recuperarDado('dados_clientes_ac', omie_cliente) || {},
        recuperarDado('dados_clientes_ac', venda_direta) || {},
    ])

    const {
        endereco,
        bairro,
        nome,
        cep,
        cnpj,
        cidade,
        estado,
    } = cliente || {}

    const empresaEmissora = dadosEmpresas[emissor || 'AC SOLUÇÕES']

    const imgLogo = document.getElementById('logo')
    imgLogo.src = emissor == 'IAC'
        ? 'https://i.imgur.com/6FWwz7l.png'
        : 'https://i.imgur.com/qZLbNfb.png'

    imgLogo.style.width = emissor == 'IAC'
        ? '100px'
        : '10rem'

    // Nome orçamento atual;
    const chamContrato = orcamentoBase?.dados_orcam?.contrato || ''
    let nomeChamado = `<label>${chamContrato}</label>`

    // Revisão atual, se existir;
    if (orcamentoBase.revisoes && orcamentoBase.revisoes.atual) {
        nomeChamado += `<label class="etiqueta-revisao">${orcamentoBase.revisoes.atual}</label>`
    }

    const dadosPorBloco = {
        proposta: {
            titulo: 'Dados da Proposta',
            dados: [
                { chave: 'Contrato', valor: `<div class="nome-chamado">${nomeChamado}</div>` },
                { chave: 'Condições de Pagamento', valor: condicoes || '' },
                { chave: 'Tipo de Frete', valor: tipo_de_frete || '' },
                { chave: 'Garantia', valor: garantia || 'Conforme tratativa Comercial' },
                { chave: 'Analista', valor: analista || 'Grupo Costa Silva' },
                { chave: 'E-mail', valor: email_analista || 'financeiro@grupocostasilva.com.br' },
                { chave: 'Telefone', valor: telefone_analista || '(11) 96300-7299' }
            ]
        },
        cliente: {
            titulo: 'Dados do Cliente',
            dados: [
                { chave: 'Razão Social ou Nome Fantasia', valor: nome || '--' },
                { chave: 'CNPJ', valor: cnpj || '--' },
                { chave: 'CEP', valor: cep || '--' },
                { chave: 'Endereço', valor: endereco || '--' },
                { chave: 'Bairro', valor: bairro || '--' },
                { chave: 'Cidade', valor: cidade || '--' },
                { chave: 'Estado', valor: estado || '--' }
            ]
        },
        empresa: {
            titulo: 'Dados da Empresa',
            dados: [
                { chave: 'Razão Social', valor: empresaEmissora['Razão Social'] },
                { chave: 'CNPJ', valor: empresaEmissora['CNPJ'] },
                { chave: 'E-mail', valor: empresaEmissora['E-mail'] },
                { chave: 'Telefones', valor: empresaEmissora['Telefones'] },
                { chave: 'Localização', valor: empresaEmissora['Localização'] }
            ]
        },
        escopo: {
            titulo: 'Escopo',
            dados: [
                { valor: consideracoes }
            ]
        },
        adicionais: {
            titulo: 'Venda Direta',
            dados: [
                { chave: 'Empresa', valor: clienteVendaDireta?.nome || '' },
                { chave: 'CNPJ', valor: clienteVendaDireta?.cnpj || '' },
                { chave: 'Endereço', valor: clienteVendaDireta?.endereco || '' },
                { chave: 'Estado', valor: clienteVendaDireta?.estado || '' }
            ]
        }
    }

    // LÓGICA DOS ITENS
    const html_orcamento = document.getElementById('html_orcamento')
    html_orcamento.innerHTML = ''

    const config = {
        'ALUGUEL': { cor: 'green' },
        'USO E CONSUMO': { cor: '#24729d' },
        'SERVIÇO': { cor: 'green' },
        'VENDA': { cor: '#B12425' }
    }

    const totais = {
        GERAL: { valor: 0, cor: '#151749' }
    }

    const itens = orcamentoBase.dados_composicoes || {}

    for (let [codigo, item] of Object.entries(itens)) {

        const { tipo, custo, qtde } = item
        const total = custo * qtde

        totais[tipo] ??= {
            valor: 0,
            linhas: []
        }

        totais[tipo].linhas.push(item)
        totais[tipo].valor += total

    }

    const emMassa = await Object.entries(totais)
        .filter(([tab, dados]) => tab !== 'ICMS' && tab !== 'GERAL')
        .map(async ([tab, { linhas, valor }]) => {

            const titulo = tab.includes('USO')
                ? 'MATERIAL PARA APLICAR NO SERVIÇO'
                : tab

            const btnExtras = `<label class="toolbar-orcamento-pdf">${titulo} • ${dinheiro(valor)}</label>`

            const tabela = await modTab({
                colunas: {
                    'Código': {},
                    'Descrição': {},
                    'Imagem': {},
                    'Unidade': {},
                    'Quantidade': {},
                    'Valor Unitário': {},
                    'Valor Total': {}
                },
                base: linhas,
                ocultarPesquisa: true,
                ocultarPaginacao: true,
                body: tab,
                scroll: false,
                btnExtras,
                pag: tab,
                cor: config[tab]?.cor,
                substituicoes: [
                    {
                        path: 'codigo',
                        tabela: 'dados_composicoes',
                        campoBusca: 'codigo',
                        retorno: 'fabricante',
                        destino: 'fabricante'
                    },
                    {
                        path: 'codigo',
                        tabela: 'dados_composicoes',
                        campoBusca: 'codigo',
                        retorno: 'modelo',
                        destino: 'modelo'
                    },
                    {
                        path: 'codigo',
                        tabela: 'dados_composicoes',
                        campoBusca: 'codigo',
                        retorno: 'ncm',
                        destino: 'ncm'
                    },
                    {
                        path: 'codigo',
                        tabela: 'dados_composicoes',
                        campoBusca: 'codigo',
                        retorno: 'imagem',
                        destino: 'imagemAtualizada'
                    }
                ],
                criarLinha: 'linhaTabelaPdf'
            })

            return tabela

        })

    const tabelas = await Promise.all(emMassa)

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
        `
    }

    const totalGeral = orcamentoBase.total_geral
    const titulo = 'GERAL'
    divTotais += `
        <div id="total_${titulo}" class="totais" style="background-color: ${totais[titulo].cor}">
            TOTAL ${titulo} ${dinheiro(totalGeral)}
        </div>
    `

    html_orcamento.innerHTML = `
    ${carimboData(orcamentoBase?.dados_orcam)}

    <div style="${horizontal};">
        ${blocoHtml(dadosPorBloco.proposta)}
        ${blocoHtml(dadosPorBloco.cliente)}
    </div>

    <div style="${horizontal};">
        ${blocoHtml(dadosPorBloco.empresa)}
        ${blocoHtml(dadosPorBloco.adicionais)}
    </div>

    <div class="contorno">
        <div class="pilula">
            <span class="cab">Itens do Orçamento</span>
            <div style="${vertical}; gap: 1rem;">
                <br>

                ${tabelas.join('')}

                <div style="display: flex; align-items: center; justify-content: start; gap: 10px;">
                    <div style="display: flex; flex-direction: column;">
                        ${divTotais}
                    </div> 

                    ${etiqueta_desconto}
                </div>
            </div>
        </div>
    </div>

    ${consideracoes ? blocoHtml(dadosPorBloco.escopo) : ''}
    `

    await paginacao()

}

async function linhaTabelaPdf(item) {

    const {
        codigo,
        tipo,
        custo,
        unidade,
        qtde,
        descricao,
        imagem,
        imagemAtualizada,
        razaoSocial,
        cnpj,
        fabricante,
        modelo,
        ncm
    } = item || {}

    const descricaoCompleta = `
        ${descricao || 'N/A'}
        <b>${fabricante || ''}</b>
        ${modelo || ''}
    `

    const linha = `
        <tr>
            <td style="text-align: center;">${codigo}</td>
            <td style="text-align: center;">
                <div style="${vertical}; text-align: left;">
                    ${cnpj ? `
                        <div style="${vertical}; gap: 2px; text-align: left;">
                            <label><b>Venda Direta</b></label>
                            <label><b>Razão Social</b> ${razaoSocial || '--'}</label>
                            <label><b>CNPJ</b> ${cnpj || '--'}</label>
                        </div>
                        ` : ''}
                    <label>${descricaoCompleta}</label>
                    ${ncm ? `<label><strong>ncm:</strong> ${ncm}</label>` : ''}
                </div>
            </td>
            <td style="text-align: center;">
                <img src="${imagemAtualizada || imagem || 'https://i.imgur.com/Nb8sPs0.png'}" style="width: 5rem;">
            </td>
            <td style="text-align: center;">${unidade || 'UN'}</td>
            <td style="text-align: center;">${qtde}</td>
            <td style="text-align: center;white-space: nowrap;">${dinheiro(custo)}</td>
            <td style="text-align: center;white-space: nowrap;">${dinheiro(qtde * custo)}</td>
        </tr>
    `

    return linha

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

async function gerarPDF() {

    preencher()

    const parametros = new URLSearchParams(window.location.search)
    const idRecebido = parametros.get('id')
    const orcamentoBase = await recuperarDado('dados_orcamentos', idRecebido) || {}
    const contrato = orcamentoBase.dados_orcam.contrato
    const nomeCliente = orcamentoBase?.snapshots?.cliente || new Date().getTime()

    const divDescontoAcrescimo = document.getElementById(`total_DIFERENÇA`)

    if (divDescontoAcrescimo)
        divDescontoAcrescimo.style.display = 'none'

    const revisao = orcamentoBase?.revisoes?.atual

    await pdf({
        id: 'container',
        estilos: ['pdf', 'tabelas'],
        nome: `Orcamento_${revisao ? `${revisao}_` : ''}${nomeCliente}_${contrato}`
    })

    if (divDescontoAcrescimo)
        divDescontoAcrescimo.style.display = 'flex'

}

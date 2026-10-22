// PDF do orçamento, montado em qualquer página: no pdf.html (prévia) ou direto no
// sistema principal, sem abrir aba (baixarPdfOrcamento). Nomes próprios para não
// colidir com outras funções do index (ex.: gerarPDF da OS em os.js).

const EMPRESAS_PDF_ORCAMENTO = {
    'IAC': {
        'Razão Social': 'IAC',
        'CNPJ': '61.807.993/0001-00',
        'E-mail': 'financeiro@grupocostasilva.com.br',
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

function blocoPdfOrcamento({ titulo, dados }) {

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

// Monta o orçamento dentro de raiz (que precisa ter o modelo de modeloPdfOrcamento).
async function montarPdfOrcamento(idRecebido, raiz = document) {
    await sincronizarRelogioServidor()

    const orcamentoBase = await recuperarDado('dados_orcamentos', idRecebido) || {}

    const idOrcamentoHTML = raiz.querySelector('#codigo_orcamento')
    if (idOrcamentoHTML)
        idOrcamentoHTML.textContent = idRecebido

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
        recuperarDado('clientes', omie_cliente) || {},
        recuperarDado('clientes', venda_direta) || {},
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

    const empresaEmissora = EMPRESAS_PDF_ORCAMENTO[emissor || 'AC SOLUÇÕES']

    const imgLogo = raiz.querySelector('#logo')
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
    const html_orcamento = raiz.querySelector('#html_orcamento')
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

    const tiposTabela = Object.keys(totais).filter(tab => tab !== 'ICMS' && tab !== 'GERAL')
    const pags = tiposTabela.map(tab => `pdfOrcamento_${tab}`)

    const emMassa = tiposTabela
        .map(async tab => {
            const { linhas, valor } = totais[tab]

            const titulo = tab.includes('USO')
                ? 'MATERIAL PARA APLICAR NO SERVIÇO'
                : tab

            const btnExtras = `<label class="toolbar-orcamento-pdf">${titulo} • ${dinheiro(valor)}</label>`

            const tabela = await modTab({
                colunas: {
                    'Código': {},
                    'Descrição': {},
                    ...(
                        tab == 'VENDA' 
                        ? { 'Ncm': {} } 
                        : {}
                    ),
                    'Imagem': {},
                    'U.Med': {},
                    'Quantidade': {},
                    'Valor Unitário': {},
                    'Valor Total': {}
                },
                base: linhas,
                ocultarPesquisa: true,
                ocultarPaginacao: true,
                body: `pdfOrcamento_${tab}`,
                scroll: false,
                btnExtras,
                pag: `pdfOrcamento_${tab}`,
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

    for (const [tot, objeto] of ordemTotais) {
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
            <label>TOTAL ${titulo} ${dinheiro(totalGeral)}</label>
        </div>
    `

    html_orcamento.innerHTML = `
    ${carimboDataPdfOrcamento(orcamentoBase?.dados_orcam)}

    <div style="${horizontal};">
        ${blocoPdfOrcamento(dadosPorBloco.proposta)}
        ${blocoPdfOrcamento(dadosPorBloco.cliente)}
    </div>

    <div style="${horizontal};">
        ${blocoPdfOrcamento(dadosPorBloco.empresa)}
        ${blocoPdfOrcamento(dadosPorBloco.adicionais)}
    </div>

    <div class="contorno">
        <div class="pilula">
            <span class="cab">Itens do Orçamento</span>
            <div style="${vertical}; gap: 1rem;">
                <br>

                ${tabelas.join('')}

                <div class="rodape-totais-pdf">
                    <div class="lista-totais-pdf">
                        ${divTotais}
                    </div> 

                    ${etiqueta_desconto}
                </div>
            </div>
        </div>
    </div>

    ${consideracoes ? blocoPdfOrcamento(dadosPorBloco.escopo) : ''}
    `

    await Promise.all(pags.map(pag => paginacao(pag)))

    return { orcamentoBase, pags }
}

async function linhaTabelaPdf(item) {

    const {
        codigo,
        custo,
        unidade,
        qtde,
        descricao,
        imagem,
        imagemAtualizada,
        razaoSocial,
        tipo,
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
            
            ${tipo == 'VENDA' ? `<td>${ncm || '--'}</td>` : ''}

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

function carimboDataPdfOrcamento(dados_orcam) {

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

function modeloPdfOrcamento() {
    return `
        <div id="container">

            <div
                style="border-radius: 5px; background-color: #151749; display: flex; width: 100%; justify-content: space-evenly; align-items: center;">
                <img id="logo" style="padding: 3px;">
            </div>

            <br>

            <div id="html_orcamento"></div>

            <div class="codigo">
                <span id="codigo_orcamento"></span>
            </div>

        </div>`
}

const ESTILOS_PDF_ORCAMENTO = ['pdf', 'tabelas', 'gcsobras']

async function nomeArquivoPdfOrcamento(orcamentoBase) {
    const { contrato, omie_cliente } = orcamentoBase.dados_orcam || {}
    const cliente = await recuperarDado('clientes', omie_cliente) || {}
    const nomeCliente = String(cliente.nome || orcamentoBase?.snapshots?.cliente || new Date().getTime())
        .replace(/[\\/:*?"<>|]/g, '')
        .trim()
    const revisao = orcamentoBase?.revisoes?.atual
    return `Orcamento_${revisao ? `${revisao}_` : ''}${nomeCliente}_${contrato}`
}

// O desconto/acréscimo aparece na prévia, mas não vai para o PDF.
function htmlPdfOrcamento(raiz) {
    const container = raiz.querySelector('#container')
    const diferenca = container.querySelector('#total_DIFERENÇA')
    if (!diferenca) return container.outerHTML
    const exibicao = diferenca.style.display
    diferenca.style.display = 'none'
    const html = container.outerHTML
    diferenca.style.display = exibicao
    return html
}

// Gera e baixa o PDF a partir do sistema principal, montando o orçamento fora da tela.
async function baixarPdfOrcamento(idOrcamento) {

    overlayAguarde()

    const raiz = document.createElement('div')
    raiz.setAttribute('aria-hidden', 'true')
    raiz.style.cssText = 'position: fixed; left: -10000px; top: 0; width: 794px; pointer-events: none;'
    raiz.innerHTML = modeloPdfOrcamento()
    document.body.appendChild(raiz)

    let pags = []
    try {
        const montado = await montarPdfOrcamento(idOrcamento, raiz)
        pags = montado.pags

        await pdf({
            html: htmlPdfOrcamento(raiz),
            estilos: ESTILOS_PDF_ORCAMENTO,
            nome: await nomeArquivoPdfOrcamento(montado.orcamentoBase)
        })
    } catch (erro) {
        console.error(erro)
        popup({ mensagem: 'Falha ao gerar o PDF do orçamento: Fale com o suporte.' })
    } finally {
        raiz.remove()
        pags.forEach(pag => delete controles[pag])
    }
}

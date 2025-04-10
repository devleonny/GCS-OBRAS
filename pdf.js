function voltar() {
    window.history.back();
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
        if (dados[item] !== '') {
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
        await recuperar()

        campo_atualizar.innerHTML = `
            <img src="imagens/atualizar2.png">
            <label>Atualizar</label>
        `
    }
}

async function preencher_v2() {

    let elem_parceiro = ''
    let ocultar = document.getElementById('ocultar')
    if (ocultar) {
        ocultar.remove()
    }

    let botoes = `
    <div id="ocultar">
        <div class="icone" onclick="atualizar_dados_pdf()" id="campo_atualizar">
            <img src="imagens/atualizar2.png">
            <label>Atualizar</label>
        </div>
        <div class="icone" onclick="gerarPDF()">
            <img src="imagens/pdf.png">
            <label>PDF</label>
        </div>
        <div class="icone" onclick="excel()">
            <img src="imagens/excel.png">
            <label>Excel</label>
        </div>
        ${elem_parceiro}
    </div>
    `
    document.getElementById('container').insertAdjacentHTML('beforeend', botoes)

    let orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {};
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    let icms = orcamento_v2.dados_orcam.estado == 'BA' ? 0.205 : 0.12

    // LÓGICA DOS DADOS
    let informacoes = orcamento_v2.dados_orcam

    let dados_por_bloco = {
        'Dados da Proposta': {
            'Número do Chamado': informacoes.contrato,
            'Tipo de Frete': informacoes.tipo_de_frete,
            'Condições de Pagamento': informacoes.condicoes,
            'Garantia': informacoes.garantia == '' ? '1 ano' : informacoes.garantia,
            'REF': ''
        },
        'Dados do Cliente': {
            'Razão Social ou Nome Fantasia': informacoes.cliente_selecionado,
            'CNPJ': informacoes.cnpj,
            'CEP': informacoes.cep,
            'Endereço': informacoes.bairro,
            'Cidade': informacoes.cidade,
            'Estado': informacoes.estado
        },
        'Dados da Empresa': {
            'Razão Social': 'AC SOLUCOES INTEGRADAS DE INFORMATICA LTDA',
            'CNPJ': '13.421.071/0001-00',
            'E-mail': 'financeiro@acsolucoesintegradas.com.br',
            'Telefones': '(71) 3901-3655 (71) 98240-3038',
            'Localização': 'CEP 40261-010, Rua Luís Negreiro, nº 701, Luis Anselmo - Salvador(BA)'
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
        1: 'Item',
        2: 'SAP ID',
        3: 'REF ID',
        4: 'Descrição',
        5: 'Imagem *Ilustrativa',
        6: 'Unidade',
        7: 'Qtde',
        8: 'Valor UNT S/ICMS',
        9: 'Valor TOTAL S/ICMS',
        10: '% ICMS',
        11: 'Valor UNT',
        12: 'Valor TOTAL',
        13: 'LPU Parceiro UNT',
        14: 'TOTAL Parceiro',
        15: 'Desvio'
    }

    let config = {
        SERVIÇO: { CARREFOUR: [1, 2, 3, 4, 5, 6, 7, 11, 12], COMUM: [1, 4, 5, 6, 7, 11, 12], cor: 'green' },
        VENDA: { CARREFOUR: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], COMUM: [1, 4, 5, 6, 7, 8, 9, 10, 11, 12], cor: '#B12425' }
    }

    let cols_parceiro = [1, 4, 6, 7, 11, 12, 13, 14, 15]

    let totais = {
        SERVIÇO: { valor: 0, cor: 'green' },
        VENDA: { valor: 0, cor: '#B12425' },
        ICMS: { valor: 0, cor: '#555555' },
        GERAL: { valor: 0, cor: '#151749' }
    };

    for (tab in config) {
        let linhas = ''
        let ths = ''
        let carrefour = false
        let modalidade = 'COMUM'
        if (orcamento_v2.lpu_ativa == 'LPU CARREFOUR') {
            carrefour = true
            modalidade = 'CARREFOUR'
        }

        let colunas = config[tab][modalidade]

        colunas.forEach(col => {

            ths += `
                <th>${cabecalho[col]}</th>
                `
        })

        for (it in itens) {

            let item = itens[it]
            let valor_historico_pdf = ""

            if (dados_composicoes[item.codigo]) {
                item.descricao = dados_composicoes[item.codigo].descricao
                if (dados_composicoes[item.codigo].substituto !== '' && carrefour) {
                    item.codigo = dados_composicoes[item.codigo].substituto
                    item.descricao = dados_composicoes[item.codigo].descricaocarrefour
                }
                let dados = dados_composicoes[item.codigo]
                item.tipo = dados.tipo
                item.sapid = dados.sapid
                item.refid = dados.refid
                item.descricao = carrefour ? dados.descricaocarrefour : item.descricao = dados.descricao
                item.imagem = item.imagem ? item.imagem : dados.imagem
                item.unidade = dados.unidade
                item.custo = conversor(item.custo)
            }

            item?.unidade || 'UND'
            item?.imagem || 'https://i.imgur.com/Nb8sPs0.png'
            item.total = item.custo * item.qtde

            // Tem desconto unitário? % ou R$
            if (item.desconto) {
                item.total = item.tipo_desconto == 'Dinheiro' ? item.total - item.desconto : item.total - (item.total * (item.desconto / 100))
            }

            if (item.tipo == tab) {

                totais[tab].valor += item.total
                totais.GERAL.valor += item.total

                let unitario_sem_icms = item.custo - (item.custo * icms)
                let total_sem_icms = unitario_sem_icms * item.qtde
                let tds = {}

                tds[1] = `<td>${item.codigo}</td>`
                tds[2] = `<td>${item.sapid}</td>`
                tds[3] = `<td style="white-space: nowrap;">${item.refid}</td>`
                tds[4] = `<td style="text-align: left;">${item.descricao}</td>`
                tds[5] = `<td><img src="${item.imagem}" style="width: 50px;"></td>`
                tds[6] = `<td>${item.unidade}</td>`
                tds[7] = `<td>${item.qtde}</td>`
                tds[8] = `<td style="white-space: nowrap;">${dinheiro(unitario_sem_icms)}</td>`
                tds[9] = `<td style="white-space: nowrap;">${dinheiro(total_sem_icms)}</td>`
                tds[10] = `<td>${(icms * 100).toFixed(1)}%</td>`
                tds[11] = `<td style="white-space: nowrap;">${dinheiro(item.custo)}</td>`
                tds[12] = `<td style="white-space: nowrap;">${dinheiro(item.total)}</td>`

                let celulas = ''

                colunas.forEach(col => {
                    celulas += tds[col]
                })

                linhas += `
                <tr>
                    ${celulas}
                </tr>
                `
            }
        }

        // ICMS total
        if (totais.VENDA.valor > 0) {
            totais.ICMS.valor = totais.VENDA.valor * icms
        }

        let tabela = `
        <div class="div_tabela">
            <div style="display: flex; align-items: center; justify-content: center;">
                <h3>${tab}</h3> 
            </div>
            <table style="table-layout: fixed;">
                <thead style="font-size: 0.7em; color: white; background-color: ${config[tab].cor}">${ths}</thead>
                <tbody style="font-size: 0.7em;">
                ${linhas}
                </tbody>
            </table>
            <div style="border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; width: 100%; display: flex; align-items: center; justify-content: right; color: white; background-color: ${totais[tab].cor}">
                <label style="padding: 5px;">Total ${dinheiro(totais[tab].valor)}</label>
            </div>
        </div>
        `
        if (linhas != '') {
            tabelas += tabela
        }
    }

    let divs_totais = ''
    for (tot in totais) {

        // Tem desconto geral ? % ou R$
        if (tot == 'GERAL' && orcamento_v2.desconto_geral) {
            totais.GERAL.valor = orcamento_v2.tipo_desconto == 'Dinheiro' ? totais.GERAL.valor - orcamento_v2.desconto_geral : totais.GERAL.valor - (totais.GERAL.valor * orcamento_v2.desconto_geral / 100)
        }

        if (totais[tot].valor !== 0) {
            divs_totais += `
            <div class="totais" style="background-color: ${totais[tot].cor}">
                TOTAL ${tot} ${dinheiro(totais[tot].valor)}
            </div>
            `;
        }
    }

    let etiqueta_desconto = ''
    if (orcamento_v2.total_bruto) {

        let desconto_geral = ((orcamento_v2.total_bruto - totais[tot].valor) / orcamento_v2.total_bruto) * 100

        etiqueta_desconto = `
        <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; gap: 3px;">
            <label>Total sem Desconto <strong>${dinheiro(orcamento_v2.total_bruto)}</strong></label>
            <hr style="width: 100%;">
            <label>Desconto <strong>${desconto_geral.toFixed(0)}% </strong></label>
        </div>
        `
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
    </div>`;

}

function carimbo_data() {
    var dataAtual = new Date();
    var opcoes = { day: 'numeric', month: 'long', year: 'numeric' };
    var dataFormatada = dataAtual.toLocaleDateString('pt-BR', opcoes);

    return dataFormatada
}

async function gerarPDF() {
    preencher_v2();
    ocultar.style.display = 'none';

    var orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {};

    var contrato = orcamento_v2.dados_orcam.contrato;
    var cliente = orcamento_v2.dados_orcam.cliente_selecionado;

    await gerar_pdf_online(document.documentElement.outerHTML, `Orcamento_${cliente}_${contrato}`)

    ocultar.style.display = 'flex';
}
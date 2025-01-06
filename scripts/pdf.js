function voltar() {

    window.history.back();

}

let perc_parceiro = 0.35
preencher_v2()

function excel() {

    let orcam_ = JSON.parse(localStorage.getItem('pdf')).id
    ir_excel(orcam_)

}

function criar_bloco_html(titulo, dados) {

    let linhas = ''

    for (let item in dados) {

        if (dados[item] !== '') {

            linhas += 
            
            `

            <label style="margin: 5px;"><strong>${item}</strong> <br>${dados[item].replace(/\n/g, '<br>')}</label>

        `

        }

    }

    let acumulado = 
    
    `

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

        campo_atualizar.innerHTML = 
        
        `

        <img src="/gifs/loading.gif" style="width: 5vw;">

        `

        await recuperar()

        campo_atualizar.innerHTML = 
        
        `

            <img src="/imagens/atualizar2.png">
            <label>Atualizar</label>

        `

    }

}

async function preencher_v2(parceiro) {

    let elem_parceiro = ''
    let ocultar = document.getElementById('ocultar')

    if (ocultar) {

        ocultar.remove()

    }

    if (parceiro) {

        elem_parceiro += 
        
        `

            <div id="m_parceiro" class="icone" onclick="preencher_v2()" style="background-color: #B12425; color: white;">
                <img src="/imagens/construcao.png">
                <label>Desativar</label>
            </div>

        `

    } else {

        elem_parceiro += 
        
        `

        <div id="m_parceiro" class="icone" onclick="preencher_v2(true)" style="background-color: green; color: white;">
            <img src="/imagens/construcao.png">
            <label>Ativar</label>
        </div>

    `

    }

    let botoes = 
    
    `

    <div id="ocultar">
        <div class="icone" onclick="atualizar_dados_pdf()" id="campo_atualizar">
            <img src="/imagens/atualizar2.png">
            <label>Atualizar</label>
        </div>
        <div class="icone" id="generatePdfButton">
            <img src="imagens/pdf.png">
            <label>PDF</label>
        </div>
        <div class="icone" onclick="excel()">
            <img src="/imagens/excel.png">
            <label>Excel</label>
        </div>
        ${elem_parceiro}
    </div>

    `

    document.getElementById('container').insertAdjacentHTML('beforeend', botoes)

    let orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    let pagamento_parceiro = JSON.parse(localStorage.getItem('pagamento_parceiro')) || {}

    orcamento_v2 = await conversor_composicoes_orcamento(orcamento_v2)

    let informacoes = orcamento_v2.dados_orcam

    let dados = {

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
        14: 'Valor Negociado UNT',
        15: 'TOTAL Parceiro',
        16: 'Desvio'

    }

    let config = {

        SERVIÇO: { CARREFOUR: [1, 2, 3, 4, 5, 6, 7, 11, 12], COMUM: [1, 4, 5, 6, 7, 11, 12], cor: 'green' },
        VENDA: { CARREFOUR: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], COMUM: [1, 4, 5, 6, 7, 8, 9, 10, 11, 12], cor: '#B12425' }

    }

    let cols_parceiro = [1, 4, 6, 7, 11, 12, 13, 14, 15, 16]

    let totais = {

        SERVIÇO: { valor: 0, cor: 'green' },
        VENDA: { valor: 0, cor: '#B12425' },
        ICMS: { valor: 0, cor: '#555555' },
        GERAL: { valor: 0, cor: '#151749' }

    }

    Object.keys(config).forEach((tabela, i) => {

        let linhas = ''
        let ths = ''
        let carrefour = false
        let modalidade = 'COMUM'

        if (orcamento_v2.lpu_ativa == 'LPU CARREFOUR') {

            carrefour = true
            modalidade = 'CARREFOUR'

        }

        let colunas = config[tabela][modalidade]

        if (parceiro) {

            colunas = cols_parceiro

        }

        colunas.forEach(col => {

            ths += 
            
            `

                <th>${cabecalho[col]}</th>

            `

        })

        for (it in itens) {

            let item = itens[it]

            if (item.parceiro) {

                console.log(item.parceiro)

            }

            item.parceiro = {

                quem: '?',
                quando: '?',
                aprovado: '?',
                valor: 0,
                icone: "/gifs/alerta.gif"

            }

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
                item.parceiro.icone = "/imagens/concluido.png"

            }

            item.unidade = item.unidade ? item.unidade : item.unidade = 'UND'
            item.imagem = item.imagem ? item.imagem : item.imagem = 'https://i.imgur.com/Nb8sPs0.png'
            item.total = item.custo * item.qtde

            if (item.tipo == tabela) {

                totais[tabela].valor += item.total
                totais.GERAL.valor += item.total

                let icms = 0.12
                orcamento_v2.dados_orcam.estado == 'BA' ? icms = 0.205 : ''
                let unitario_sem_icms = item.custo - (item.custo * icms)
                let total_sem_icms = unitario_sem_icms * item.qtde
                totais.ICMS.valor += item.custo * item.qtde * icms

                let descricao_auxiliar = ''

                if (parceiro && item.descricao_real && (item.descricao_real !== item.descricao)) {

                    descricao_auxiliar += 
                    
                    `

                    <br><label style="color: red;">${item.descricao_real}</label>
                    `

                }

                let tds = {}

                tds[1] = `<td>${item.codigo}</td>`
                tds[2] = `<td>${item.sapid}</td>`
                tds[3] = `<td style="white-space: nowrap;">${item.refid}</td>`
                tds[4] = `<td style="text-align: left;">${item.descricao} ${descricao_auxiliar}</td>`
                tds[5] = `<td><img src="${item.imagem}" style="width: 50px;"></td>`
                tds[6] = `<td>${item.unidade}</td>`
                tds[7] = `<td>${item.qtde}</td>`
                tds[8] = `<td style="white-space: nowrap;">${dinheiro(unitario_sem_icms)}</td>`
                tds[9] = `<td style="white-space: nowrap;">${dinheiro(total_sem_icms)}</td>`
                tds[10] = `<td>${(icms * 100).toFixed(1)}%</td>`
                tds[11] = `<td style="white-space: nowrap;">${dinheiro(item.custo)}</td>`
                tds[12] = `<td style="white-space: nowrap;">${dinheiro(item.total)}</td>`
                tds[13] = 
                
                `

                    <td>
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; flex-direction: column; justify-content: left; text-align: left; white-space: nowrap;">
                                <label>${dinheiro(item.parceiro.valor)} (<strong>${(item.parceiro.valor / item.custo * 100).toFixed(0)}%</strong>)</label>
                                <label><strong>${item.parceiro.quando}</strong></label>
                                <label><strong>${item.parceiro.quem}</strong></label>
                            </div>
                            <img src="${item.parceiro.icone}" style="width: 25px; cursor: pointer;" onclick="preencher_parceiro(this)">
                        </div>
                    </td>

                `

                tds[14] = `<td><input class="numero-bonito" oninput="calcular_parceiro()"></td>`
                tds[15] = `<td></td>`
                tds[16] = `<td></td>`

                let celulas = ''

                colunas.forEach(col => {

                    celulas += tds[col]

                })

                linhas += 
                
                `

                <tr>
                ${celulas}
                </tr>

                `

            }

        }

        let tabela = 
        
        `

        <div class="div_tabela">
            <div style="display: flex; align-items: center; justify-content: center;">
                <h3>${tabela}</h3> 
            </div>
            <table>
                <thead style="font-size: 0.7em; color: white; background-color: ${config[tabela].cor}">${ths}</thead>
                <tbody style="font-size: 0.7em;">
                ${linhas}
                </tbody>
            </table>
            <div style="border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; width: 100%; display: flex; align-items: center; justify-content: right; color: white; background-color: ${totais[tabela].cor}">
                <label style="padding: 5px;">Total ${dinheiro(totais[tabela].valor)}</label>
            </div>
        </div>

        `

        if (linhas != '') {

            tabelas += tabela

        }

    })

    let divs_totais = ''

    for (let total in totais) {

        if (totais[total].valor !== 0) {

            if (total !== 'ICMS' || (total == 'ICMS' && totais['VENDA'].valor !== 0)) {

                divs_totais += 
                
                `

                <div class="totais" style="background-color: ${totais[total].cor}">TOTAL ${total} ${dinheiro(totais[total].valor)}</div>

                `

            }

        }

    }

    html_orcamento.innerHTML = 
    
    `

    <label>Salvador, Bahia, ${carimbo_data()}</label>
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
    ${criar_bloco_html('Dados da Proposta', dados['Dados da Proposta'])}
    ${criar_bloco_html('Dados do Cliente', dados['Dados do Cliente'])}
    </div>
    ${criar_bloco_html('Dados da Empresa', dados['Dados da Empresa'])}
    <div class="contorno">
        <div class="titulo">
            Itens do Orçamento
        </div>
        ${tabelas}
        <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
            <div>
                ${divs_totais}
            </div>

            <div id="parceiro" style="display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: left;"></div>
        </div>
    </div>

    ${criar_bloco_html('Considerações', { Considerações: informacoes.consideracoes })}

    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
    ${criar_bloco_html('Contato Analista', dados['Contato Analista'])}
    ${criar_bloco_html('Contato Vendedor', dados['Contato Vendedor'])}
    </div>
    <div style="height: 200px;"></div>

    `

    if (parceiro) {

        calcular_parceiro(true)

    }

}

function preencher_parceiro(elemento_img) {

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

    let div_proximo = elemento_img.closest('div')

    div_proximo.innerHTML = 
    
    `

    <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; flex-direction: column; justify-content: left; text-align: left; white-space: nowrap;">
            <label><input class="numero-bonito"></label>
            <label><strong>${data_atual('completa')}</strong></label>
            <label><strong>${acesso.usuario}</strong></label>
        </div>
        <img src="/imagens/concluido.png" style="width: 25px; cursor: pointer;" onclick="salvar_parceiro(this)">
    </div>
    
    `

}

async function salvar_parceiro(elemento_img) {

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};

    let div_proximo = elemento_img.closest('div')
    let tr = elemento_img.closest('tr')
    let tds = tr.querySelectorAll('td')
    let codigo = tds[0].textContent

    let labels = div_proximo.querySelectorAll('label')

    let dados = {

        quem: acesso.usuario,
        quando: data_atual('completa'),
        valor: conversor(labels[0].querySelector('input').value),

    }

    if (dados_composicoes[codigo]) {

        dados_composicoes[codigo].parceiro = dados
        localStorage.setItem('dados_composicoes', JSON.stringify(dados_composicoes))

    }

    div_proximo.innerHTML = 
    
    `

        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; flex-direction: column; justify-content: left; text-align: left; white-space: nowrap;">
                <label>${dinheiro(dados.valor)}</label>
                <label><strong> ${dados.quando}</strong></label>
                <label><strong> ${dados.quem}</strong></label>
            </div>
            <img src="/imagens/concluido.png" style="width: 25px; cursor: pointer;" onclick="preencher_parceiro(this)">
        </div>

    `

}

function carimbo_data() {

    let dataAtual = new Date();
    let opcoes = { day: 'numeric', month: 'long', year: 'numeric' };
    let dataFormatada = dataAtual.toLocaleDateString('pt-BR', opcoes);

    return dataFormatada

}

function calcular_parceiro() {

    let html_orcamento = document.getElementById('html_orcamento')
    let tabelas = html_orcamento.querySelectorAll('table')
    let orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}
    let pagamento_parceiro = JSON.parse(localStorage.getItem('pagamento_parceiro')) || {}

    if (!pagamento_parceiro[orcamento_v2.id]) {

        pagamento_parceiro[orcamento_v2.id] = {}

    }

    let parceiro = document.getElementById('parceiro')

    let total_itens_validos = 0

    tabelas.forEach((tabela, i) => {

        let trs = tabela.querySelectorAll('tr')

        trs.forEach(tr => {

            let tds = tr.querySelectorAll('td')

        })

    })

    let valor_a_pagar = ''
    let observacao = ''

    if (pagamento_parceiro[orcamento_v2.id].valor_a_pagar) {

        let VAPM = pagamento_parceiro[orcamento_v2.id].valor_a_pagar

        valor_a_pagar = 
        
        `

        <label style="padding: 5px;"> <strong>${dinheiro(VAPM)}</strong></label>
        <label>${(VAPM / total_itens_validos * 100).toFixed(1)}%</label>
        <img src="/gifs/alerta.gif" style="width: 3vw; cursor: pointer;" onclick="confirmar_edicao_valor()">
        
        `

        if (total_itens_validos * perc_parceiro < VAPM) {

            let diferenca = VAPM - total_itens_validos * perc_parceiro
            observacao += 
            
            `

            <div style="display: flex; align-items: center; justify-content: left;">
                <img src="/imagens/acima.png" style="width: 15px;">
                <label>Valor acima em ${dinheiro(diferenca)} ${(diferenca / total_itens_validos * 100).toFixed(1)}%</label>
            </div>

            `

        } else {

            let diferenca = (VAPM - total_itens_validos * perc_parceiro) * -1
            observacao += 
            
            `

            <div style="display: flex; align-items: center; justify-content: left;">
                <img src="/imagens/abaixo.png" style="width: 15px;">
                <label>Valor abaixo em ${dinheiro(diferenca)} ${(diferenca / total_itens_validos * 100).toFixed(1)}%</label>
            </div>

            `

        }

    } else {

        valor_a_pagar = 
        
        `

            <input type="number" class="numero-bonito" oninput="atualizar_indicadores(this)">
            <img src="/imagens/concluido.png" style="width: 3vw; cursor: pointer;" onclick="atualizar_indicadores(this, true)">

        `

    }

    let acumulado = 
    
    `

    <div style="display: flex; flex-direction: column; justify-content: left;">
        <label><strong>Custo com Parceiro</strong></label>
        <hr style="width: 100%;">
        <div style="display: flex; align-items: center; justify-content: left;">
            <label>Itens Marcados </label>
            <label style="padding: 5px;"><strong>${dinheiro(total_itens_validos)}</strong></label>
        </div>
        <div style="display: flex; align-items: center; justify-content: left;">
            <label>Limite a pagar 35% </label>
            <label style="padding: 5px;" id="valor_limite"><strong>${dinheiro(total_itens_validos * perc_parceiro)}</strong></label>
        </div>
        <div style="display: flex; align-items: center; justify-content: left;">
            <label>Valor a pagar </label>
            ${valor_a_pagar}
        </div>
        ${observacao}
    </div>

    `

    parceiro.innerHTML = acumulado

}

function confirmar_edicao_valor() {

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="/gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label><strong>ATENÇÃO</strong> <br>Deseja editar o cálculo?</label>
            <button onclick="atualizar_valor()" style="background-color: green;">Sim</button>
            <button onclick="remover_popup()">Não</button>
        </div>      
        `)

}

function atualizar_valor() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}
    let pagamento_parceiro = JSON.parse(localStorage.getItem('pagamento_parceiro')) || {}

    delete pagamento_parceiro[orcamento_v2.id].valor_a_pagar

    localStorage.setItem('pagamento_parceiro', JSON.stringify(pagamento_parceiro))
    preencher_v2(true)

    remover_popup()

}

function atualizar_indicadores(elemento, salvar) {

    let limite = document.getElementById('valor_limite')

    if (elemento.value > conversor(limite.textContent)) {

        elemento.style.backgroundColor = '#B12425'

    } else {

        elemento.style.backgroundColor = 'green'

    }

    if (salvar) {

        let orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}
        let pagamento_parceiro = JSON.parse(localStorage.getItem('pagamento_parceiro')) || {}
        pagamento_parceiro[orcamento_v2.id].valor_a_pagar = elemento.previousElementSibling.value
        localStorage.setItem('pagamento_parceiro', JSON.stringify(pagamento_parceiro))

        preencher_v2(true)

    }

}

const { ipcRenderer } = require('electron');

ipcRenderer.on('open-save-dialog', (event, { htmlContent, nomeArquivo }) => {

    ipcRenderer.send('save-dialog', { htmlContent, nomeArquivo });

});

function gerarPDF() {
    preencher_v2();
    ocultar.style.display = 'none';

    var orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}

    var contrato = orcamento_v2.dados_orcam.contrato
    var cliente = orcamento_v2.dados_orcam.cliente_selecionado

    const formData = {

        htmlContent: document.documentElement.outerHTML,
        nomeArquivo: `Orcamento_${cliente}_${contrato}`

    };
    try {
        const response = await fetch('http://localhost:3000/generate-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Erro ao gerar PDF: ' + response.status + ' ' + response.statusText);
        }
    } catch (err) {
        console.log(err)
    } finally {
        ocultar.style.display = 'flex'
    }

});

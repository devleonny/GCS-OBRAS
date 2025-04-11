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

async function preencher_v2(parceiro) {

    var elem_parceiro = ''
    var ocultar = document.getElementById('ocultar')
    if (ocultar) {
        ocultar.remove()
    }

    if (parceiro) {
        elem_parceiro += `
            <div id="m_parceiro" class="icone" onclick="preencher_v2()" style="background-color: #B12425; color: white;">
                <img src="imagens/construcao.png">
                <label>Desativar</label>
            </div>
        `
    } else {
        elem_parceiro += `
        <div id="m_parceiro" class="icone" onclick="preencher_v2(true)" style="background-color: green; color: white;">
            <img src="imagens/construcao.png">
            <label>Ativar</label>
        </div>
    `
    }

    var botoes = `
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

    var orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {};
    var dados_composicoes = await recuperarDados('dados_composicoes') || {};

    // LÓGICA DOS DADOS
    var informacoes = orcamento_v2.dados_orcam

    var dados_por_bloco = {
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

    var html_orcamento = document.getElementById('html_orcamento')
    html_orcamento.innerHTML = ''

    var tabelas = ''
    var itens = orcamento_v2.dados_composicoes

    var cabecalho = {
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

    var config = {
        SERVIÇO: { CARREFOUR: [1, 2, 3, 4, 5, 6, 7, 11, 12], COMUM: [1, 4, 5, 6, 7, 11, 12], cor: 'green' },
        VENDA: { CARREFOUR: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], COMUM: [1, 4, 5, 6, 7, 8, 9, 10, 11, 12], cor: '#B12425' }
    }

    var cols_parceiro = [1, 4, 6, 7, 11, 12, 13, 14, 15]

    var totais = {
        SERVIÇO: { valor: 0, cor: 'green' },
        VENDA: { valor: 0, cor: '#B12425' },
        ICMS: { valor: 0, cor: '#555555' },
        GERAL: { valor: 0, cor: '#151749' }
    };

    // 🔥 Novo objeto para armazenar os valores de LPU, Informado e Desvio
    var lpuParceiros = {
        LPU: { valor: 0, cor: 'black' },       // Antes era LPU_Parceiro_UNT
        Informado: { valor: 0, cor: 'black' }, // Antes era Parceiro
        Desvio: { valor: 0, cor: 'black' }
    };

    for (tabela in config) {

        var linhas = ''
        var ths = ''
        var carrefour = false
        var modalidade = 'COMUM'
        if (orcamento_v2.lpu_ativa == 'LPU CARREFOUR') {
            carrefour = true
            modalidade = 'CARREFOUR'
        }

        var colunas = config[tabela][modalidade]
        if (parceiro) {
            colunas = cols_parceiro
        }

        colunas.forEach(col => {

            ths += `
                <th>${cabecalho[col]}</th>
                `
        })

        for (it in itens) {

            var item = itens[it]
            let valorAtivo = 0; // Variável para armazenar o valor correspondente ao ativo
            let valor_historico_pdf = ""

            // Verifica se o código existe em dados_composicoes
            if (item.codigo && dados_composicoes[item.codigo]) {
                let itemDados = dados_composicoes[item.codigo]; // Objeto correspondente
                let possuiLpuParceiro = itemDados.hasOwnProperty("lpu parceiro"); // Verifica se existe a chave "lpu parceiro"

                if (possuiLpuParceiro && typeof itemDados["lpu parceiro"] === "object" && tabela === itemDados.tipo) {
                    let chaveAtivo = itemDados["lpu parceiro"].ativo; // Obtém a chave ativa

                    // ✅ Obtém o valor do LPU Parceiro ativo
                    valorAtivo = chaveAtivo && itemDados["lpu parceiro"].historico?.[chaveAtivo]?.valor
                        ? Number(itemDados["lpu parceiro"].historico[chaveAtivo].valor)
                        : 0;

                    // ✅ Obtém o último valor do histórico PDF
                    if (itemDados["lpu parceiro"].historico_pdf) {
                        let historicoValores = Object.values(itemDados["lpu parceiro"].historico_pdf);
                        let ultimoHistorico = historicoValores.length > 0
                            ? Number(historicoValores[historicoValores.length - 1].valor)
                            : 0;

                        valor_historico_pdf = ultimoHistorico || "0"; // Define um valor padrão se for nulo ou undefined
                        lpuParceiros.Informado.valor += valor_historico_pdf;
                    }

                    // ✅ Atualiza os totais
                    lpuParceiros.LPU.valor += valorAtivo;
                }
            }

            if (dados_composicoes[item.codigo]) {
                item.descricao = dados_composicoes[item.codigo].descricao
                if (dados_composicoes[item.codigo].substituto !== '' && carrefour) {
                    item.codigo = dados_composicoes[item.codigo].substituto
                    item.descricao = dados_composicoes[item.codigo].descricaocarrefour
                }
                var dados = dados_composicoes[item.codigo]
                item.tipo = dados.tipo
                item.sapid = dados.sapid
                item.refid = dados.refid
                item.descricao = carrefour ? dados.descricaocarrefour : dados.descricao
                item.imagem = item?.imagem || dados.imagem
                item.unidade = dados.unidade
                item.custo = conversor(item.custo)
            }

            item.unidade = item.unidade ? item.unidade : item.unidade = 'UND'
            item.imagem = item.imagem ? item.imagem : item.imagem = 'https://i.imgur.com/Nb8sPs0.png'
            item.total = item.custo * item.qtde

            if (item.tipo == tabela) {

                totais[tabela].valor += item.total
                totais.GERAL.valor += item.total

                var icms = 0.12
                orcamento_v2.dados_orcam.estado == 'BA' ? icms = 0.205 : ''
                var unitario_sem_icms = item.custo - (item.custo * icms)
                var total_sem_icms = unitario_sem_icms * item.qtde

                if (item.tipo == 'VENDA') {
                    totais.ICMS.valor += item.custo * item.qtde * icms
                }

                var descricao_auxiliar = ''
                if (parceiro && item.descricao_real && (item.descricao_real !== item.descricao)) {
                    descricao_auxiliar += `
                    <br><label style="color: red;">${item.descricao_real}</label>
                    `
                }

                var tds = {}

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
                tds[13] = `
                            <td id="lpu-parceiro-${item.codigo}">
                                <div style="display: flex; align-items: center; justify-content: center;">
                                    <label>${dinheiro(valorAtivo)}</label> 
                                </div>
                            </td>
                        `;

                tds[14] = `
                        <td>
                            <div style="display: flex; align-items: center; justify-content: center;">
                                <img id="concluido-${item.codigo}" src="imagens/concluido.png" 
                                    style="display: none; width: 25px; cursor: pointer;" 
                                    onclick="salvarValorNaNuvem('${item.codigo}')" 
                                    title="Salvar valor na nuvem">
                                
                                <input value="${valor_historico_pdf}" id="input-parceiro-${item.codigo}" class="numero-bonito" 
                                oninput="mostrarConcluido('${item.codigo}'); calcularDesvio('${item.codigo}'); ativar_botao(this);">

                            </div>
                        </td>
                    `;

                tds[15] = `<td id="desvio-${item.codigo}" class="td-desvio"></td>`;

                var celulas = ''

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

        var tabela = `
        <div class="div_tabela">
            <div style="display: flex; align-items: center; justify-content: center;">
                <h3>${tabela}</h3> 
            </div>
            <table style="table-layout: fixed;">
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
    }

    // 🔥 Calcula o desvio antes de gerar os DIVs
    lpuParceiros.Desvio.valor = lpuParceiros.LPU.valor - lpuParceiros.Informado.valor;

    // 🔥 Determina qual imagem exibir com base no valor do desvio
    let imagemDesvio = "";
    if (lpuParceiros.Desvio.valor > 0) {
        imagemDesvio = `<img src="https://imgur.com/2bb0ea22-d3ff-4d7b-bcf7-c266806778b2" style="width: 20px; margin-left: 5px;">`;
    } else if (lpuParceiros.Desvio.valor < 0) {
        imagemDesvio = `<img src="https://imgur.com/d7dd643e-c60b-4675-834a-9ddf3e93bfda" style="width: 20px; margin-left: 5px;">`;
    }

    // 🔥 Gerando os DIVs corretamente alinhados
    var divs_totais = '';
    var divs_lpuParceiros = '';

    // 🔥 Criando a exibição separada para LPU, Informado e Desvio
    if (parceiro) {
        divs_lpuParceiros += `
                        <div style="display: flex; flex-direction: column; align-items: flex-end; width: 100%;">
                            <div class="totais" style="color: ${lpuParceiros.LPU.cor}; background-color: transparent; text-align: right;">
                                LPU: ${dinheiro(lpuParceiros.LPU.valor)}
                            </div>
                            <div class="totais" style="color: ${lpuParceiros.Informado.cor}; background-color: transparent; text-align: right;">
                                Informado: ${dinheiro(lpuParceiros.Informado.valor)}
                            </div>
                            <hr style="width: 80%;">
                            <div class="totais" style="color: ${lpuParceiros.Desvio.cor}; background-color: transparent; display: flex; align-items: center; justify-content: flex-end;">
                                Desvio: ${dinheiro(lpuParceiros.Desvio.valor)} ${imagemDesvio}
                            </div>
                        </div>
                        `;
    }

    // 🔥 Criando os totais normais
    for (total in totais) {
        if (totais[total].valor !== 0) {
            divs_totais += `
            <div class="totais" style="background-color: ${totais[total].cor}">
                TOTAL ${total} ${dinheiro(totais[total].valor)}
            </div>
        `;
        }
    }

    // 🔥 Atualizando o HTML para manter a estrutura correta
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

        <div style="display: flex; gap: 20px; align-items: flex-start; justify-content: space-between;">
            <div style="display: flex; flex-direction: column;">
                ${divs_totais} <!-- Totais normais -->
            </div>

            <div style="display: flex; flex-direction: column;">
                ${divs_lpuParceiros} <!-- Exibição separada de LPU, Informado e Desvio -->
            </div>
        </div>
    </div>

    ${criar_bloco_html('Considerações', { Considerações: informacoes.consideracoes })}

    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
        ${criar_bloco_html('Contato Analista', dados_por_bloco['Contato Analista'])}
        ${criar_bloco_html('Contato Vendedor', dados_por_bloco['Contato Vendedor'])}
    </div>

    <div style="height: 200px;"></div>
`;

    // Aguarda um pequeno tempo para garantir que a tabela foi gerada antes de calcular os desvios
    setTimeout(() => {
        document.querySelectorAll('.numero-bonito').forEach(input => {
            calcularDesvio(input.id.replace('input-parceiro-', ''));
        });
    }, 200);


    if (parceiro) {
        calcular_parceiro(true)
    }
}

function mostrarConcluido(codigoItem) {
    let imgConcluido = document.getElementById(`concluido-${codigoItem}`);
    if (imgConcluido) {
        imgConcluido.style.display = "inline-block"; // Exibe a imagem
    }
}

function salvarValorNaNuvem(codigoItem) {
    let inputElement = document.getElementById(`input-parceiro-${codigoItem}`);
    let imgConcluido = document.getElementById(`concluido-${codigoItem}`);
    if (!inputElement) {
        return;
    }

    let valorSalvo = inputElement.value.trim();
    if (valorSalvo === "") {
        return;
    }

    let id_historico_pdf = gerar_id_5_digitos(); // Gera um ID único
    let acesso = JSON.parse(localStorage.getItem("acesso")) || "Desconhecido";
    let dataHora = new Date().toLocaleString(); // Data e hora atual no formato legível

    // Criação do objeto com os dados a serem salvos
    let objetoSalvo = {
        valor: valorSalvo,
        usuario: acesso.usuario,
        data: dataHora
    };

    // Constrói o caminho correto
    let caminho = `dados_composicoes/${codigoItem}/lpu parceiro/historico_pdf/${id_historico_pdf}`;

    enviar(caminho, objetoSalvo); // Envia o objeto completo para a nuvem

    imgConcluido.style.display = "none"; // Oculta a imagem após salvar
}

function calcularDesvio(codigo) {

    let labelLpuParceiro = document.querySelector(`#lpu-parceiro-${codigo} label`);
    let inputParceiro = document.querySelector(`#input-parceiro-${codigo}`);
    let tdDesvio = document.querySelector(`#desvio-${codigo}`);
    if (!labelLpuParceiro || !inputParceiro || !tdDesvio) {
        console.warn("❌ Erro: Algum dos campos necessários não foi encontrado!");
        return;
    }

    let lpuParceiroValor = parseFloat(labelLpuParceiro.textContent.replace("R$", "").replace(",", ".").trim()) || 0;
    let inputValor = parseFloat(inputParceiro.value.replace(",", ".").trim()) || 0;

    let desvio = lpuParceiroValor - inputValor; // Calcula o desvio

    tdDesvio.textContent = dinheiro(desvio); // Atualiza a célula com o valor formatado
}

function ativar_botao(input) {

    let img = input.previousElementSibling
    img.style.display = 'block'

}

async function preencher_parceiro(elemento_img) {

    let orcamento = JSON.parse(localStorage.getItem('pdf')) || {}
    let tr = elemento_img.closest('tr')
    let tds = tr.querySelectorAll('td')
    let codigo = tds[0].textContent
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let valor = elemento_img.nextElementSibling

    let data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    let id = gerar_id_5_digitos()

    let valor_parceiro = {
        data: data,
        usuario: acesso.usuario,
        valor: conversor(valor.value),
        id_orcamento: orcamento.id
    }

    if (dados_composicoes[codigo]) {
        if (!dados_composicoes[codigo].parceiro || !dicionario(dados_composicoes[codigo].parceiro)) {
            dados_composicoes[codigo].parceiro = {}
        }

        dados_composicoes[codigo].parceiro[id] = valor_parceiro
    }

}

function carimbo_data() {
    var dataAtual = new Date();
    var opcoes = { day: 'numeric', month: 'long', year: 'numeric' };
    var dataFormatada = dataAtual.toLocaleDateString('pt-BR', opcoes);

    return dataFormatada
}

function calcular_parceiro() {

    var html_orcamento = document.getElementById('html_orcamento')
    var tabelas = html_orcamento.querySelectorAll('table')
    var orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}

    var parceiro = document.getElementById('parceiro')

    var total_itens_validos = 0

    tabelas.forEach((tabela, i) => {
        var trs = tabela.querySelectorAll('tr')
        trs.forEach(tr => {
            var tds = tr.querySelectorAll('td')

        })
    })

    var acumulado = `
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
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label><strong>ATENÇÃO</strong> <br>Deseja editar o cálculo?</label>
            <button onclick="atualizar_valor()" style="background-color: green;">Sim</button>
            <button onclick="remover_popup()">Não</button>
        </div>      
        `)
}

function atualizar_valor() {
    var orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}
    var pagamento_parceiro = JSON.parse(localStorage.getItem('pagamento_parceiro')) || {}

    delete pagamento_parceiro[orcamento_v2.id].valor_a_pagar

    localStorage.setItem('pagamento_parceiro', JSON.stringify(pagamento_parceiro))
    preencher_v2(true)

    remover_popup()

}

function atualizar_indicadores(elemento, salvar) {

    var limite = document.getElementById('valor_limite')

    if (elemento.value > conversor(limite.textContent)) {
        elemento.style.backgroundColor = '#B12425'
    } else {
        elemento.style.backgroundColor = 'green'
    }

    if (salvar) {
        var orcamento_v2 = JSON.parse(localStorage.getItem('pdf')) || {}
        var pagamento_parceiro = JSON.parse(localStorage.getItem('pagamento_parceiro')) || {}
        pagamento_parceiro[orcamento_v2.id].valor_a_pagar = elemento.previousElementSibling.value
        localStorage.setItem('pagamento_parceiro', JSON.stringify(pagamento_parceiro))

        preencher_v2(true)
    }

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
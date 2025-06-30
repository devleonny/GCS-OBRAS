async function modalLPUParceiro(chave) {
    const baseOrcamentos = await recuperarDados('dados_orcamentos') || {};

    let acumulado = '';
    let cabecalhos = ['ID', 'Descrição', 'Medida', 'Quantidade', 'Valor Orçamento', 'Valor Total Orçado', 'Impostos (20%)', 'Margem (R$)', 'Valor Parceiro', 'Total Parceiro', 'Desvio'];
    let thSearch = '';
    let thHead = '';
    let linhas = '';

    cabecalhos.forEach((cabecalho, i) => {
        thHead += `<th style="color: white;">${cabecalho}</th>`;
        thSearch +=
            `<th style="background-color: white">
                <div style="display: flex; justify-content:space-between; align-items: center">
                    <input oninput="pesquisar_generico(${i}, this.value, filtrosTabelaParceiros, 'bodyTabela')" style="text-align: left; width: 100%">
                    <img src="imagens/pesquisar2.png" style="width: 1vw;">
                </div>
            </th>`;
    });

    let orcamento = baseOrcamentos[id_orcam]

    let itensOrcamento = orcamento.dados_composicoes

    for ([codigo, composicao] of Object.entries(itensOrcamento)) {

        if (composicao.tipo === 'SERVIÇO') {
            let custo = composicao.custo
            let qtde = composicao.qtde
            let total = custo * qtde
            let imposto = total * 0.2
            linhas += `
            <tr>
                <td>${codigo}</td>
                <td style="text-align: left;">${composicao.descricao}</td>
                <td>${composicao.unidade}</td>
                <td class="quantidade">${qtde}</td>
                <td>${dinheiro(custo)}</td>
                <td>${dinheiro(total)}</td>
                <td>${dinheiro(imposto)}</td>
                <td></td>
                <td style="padding: 0; white-space: nowrap; height: 100%;">
                    <div style="display: flex; align-items: stretch; gap: 4px; width: 100%; height: 100%; box-sizing: border-box; padding: 2px 5px;">
                        <input
                            class="campoRequisicao"
                            oninput="atualizarValorParceiro(this)" 
                            type="number" 
                            class="input-lpuparceiro" 
                            step="0.01">
                    </div>
                </td>
                 <td></td>
                <td><label class="labelAprovacao"></label></td>
                
            </tr>
        `
        }
    }

    let tabela =
        `<table class="tabela" style="display: table-row;">
            <thead style="background-color: #797979;">
                <tr>${thHead}</tr>
                <tr>${thSearch}</tr>
            </thead>
            <tbody id="bodyTabela">${linhas}</tbody>
        </table>

        ${botao('Adicionar Serviço', 'adicionarItemAdicional()', '#222')}
        `;

    let stringHtml = (titulo, valor) => {
        return `
        <div style="display: flex; justifty-content: start; align-items: center; gap: 5px;">
        <label><strong>${titulo}</strong>:</label>
        <label>${valor}</label>
        </div>
        `
    }

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dadosEmpresa = {
        ...orcamento.dados_orcam,
        ...dados_clientes?.[orcamento.dados_orcam.omie_cliente] || {}
    }

    let funcaoSalvar = chave ? `salvarLpuParceiro('${chave}')` : 'salvarLpuParceiro()'

    acumulado = `
        <div style="background-color: #d2d2d2; padding: 5px;">
            <div style="display: flex; justify-content: space-between;" margin-top: 5px>
                <div style=" display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 5px; margin-left: 10px">
                    ${stringHtml('Data', data_atual('completa'))}
                    ${stringHtml('Analista', acesso.nome_completo)}
                    ${stringHtml('Cliente', dadosEmpresa.nome)}
                    ${stringHtml('CNPJ', dadosEmpresa.cnpj)}
                    ${stringHtml('Endereço', dadosEmpresa.bairro)}
                    ${stringHtml('Cidade', dadosEmpresa.cidade)}
                    ${stringHtml('Estado', dadosEmpresa.estado)}
                    ${stringHtml('Margem para este serviço(%)', `<input id="margem_lpu" class="campoRequisicao" style="background-color: white;" value="35" oninput="calcularLpuParceiro()">`)}
                    ${stringHtml('Técnico', `<textarea type="text" id="tecnico" oninput="sugestoesParceiro(this, 'clientes')" placeholder="Qual o nome do técnico?"></textarea><input style="display: none">`)}
                </div>
        
                <div style="margin-top: 5px">
                    ${stringHtml('Resumo', '<lalbel style="margin-bottom: 5px; padding: 10px 0 20px"></lalbel>')}
                    ${stringHtml('Total do Valor Orçamento', '<lalbel style="margin-bottom: 5px; padding: 10px 0 20px"id="totalOrcamento"></lalbel>')}
                    ${stringHtml('Total Margem Disponível', '<lalbel id="totalMargem"></lalbel>')}
                    ${stringHtml('Total do Valor Parceiro', '<lalbe id="totalParceiro"l></lalbe>')}
                    ${stringHtml('Total Desvio', '<lalbel id="totalDesvio" class="labelAprovacao"></lalbel>')}
                </div>

                <div>
                    ${botao('Salvar', funcaoSalvar, 'green')}
                    ${botao('Gerar Excel', `gerarExcelLpuParceiro()`, 'green')}
                </div>
               
            </div>
            <br>
            ${tabela}
        </div>
        `

    popup(acumulado, 'LPU Parceiro', true)

    calcularLpuParceiro();

    // Caso seja informada a CHAVE, então os dados são preenchidos;
    const historico = baseOrcamentos[id_orcam]?.status?.historico || {};
    const dadosSalvos = historico[chave] || {}

    document.getElementById('tecnico').value = dadosSalvos?.tecnicoLpu || '';
    document.getElementById('margem_lpu').value = dadosSalvos?.margem_percentual || 35;

    const trs = document.querySelectorAll('#bodyTabela tr');
    for (let tr of trs) {
        let tds = tr.querySelectorAll('td');
        const codigo = tds[0]?.textContent.trim();
        const itemSalvo = dadosSalvos.itens?.[codigo];
        if (itemSalvo) {
            const input = tds[8]?.querySelector('input');
            if (input) input.value = itemSalvo.valor_parceiro_unitario;
        }
    }

}

async function gerarExcelLpuParceiro() {

    let margem = Number(document.getElementById('margem_lpu').value);
    let tecnico = String(document.getElementById('tecnico').value) || '';

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let dadosEmpresa = {
        ...orcamento.dados_orcam,
        ...dados_clientes?.[orcamento.dados_orcam.omie_cliente] || {}
    }

    let dadosParaExcel = {
        status: 'LPU PARCEIRO',
        data: data_atual('completa'),
        analista: acesso.nome_completo,
        margem_percentual: margem,
        tecnicoLpu: tecnico,
        cliente: dadosEmpresa.nome,
        cnpj: dadosEmpresa.cnpj,
        endereco: dadosEmpresa.bairro,
        cidade: dadosEmpresa.cidade,
        estado: dadosEmpresa.estado,
        itens: {},
        itens_adicionais: [],
        totais: {
            orcamento: 0,
            parceiro: 0,
            desvio: 0,
            margem: 0
        }
    };

    let trs = document.querySelectorAll('#bodyTabela tr');
    for (let tr of trs) {
        let tds = tr.querySelectorAll('td');
        if (tds.length < 11) continue;

        let isAdicional = tr.classList.contains('item-adicional');
        let codigo = tds[0].textContent.trim();
        let descricao = tr.querySelector('textarea')?.value?.trim() || extrairTextoOuInput(tds[1]);
        let unidade = extrairTextoOuInput(tds[2]);
        let qtde = conversor(tds[3].textContent.trim());
        let valor_orcado = conversor(tds[4].textContent.trim());
        let total_orcado = conversor(tds[5].textContent.trim());
        let imposto = conversor(tds[6].textContent.trim());

        let valor_parceiro_unitario = Number(tds[8].querySelector('input')?.value || 0);
        let total_parceiro = qtde * valor_parceiro_unitario;
        let margem_reais = total_orcado * (margem / 100);
        let desvio = margem_reais - total_parceiro;

        if (isAdicional) {
            dadosParaExcel.itens_adicionais = dadosParaExcel.itens_adicionais || [];
            dadosParaExcel.itens_adicionais.push({
                codigo,
                descricao,
                unidade,
                qtde,
                valor_parceiro_unitario,
                total_parceiro
            });
        } else {
            dadosParaExcel.itens[codigo] = {
                descricao,
                unidade,
                qtde,
                valor_orcado,
                total_orcado,
                imposto,
                valor_parceiro_unitario,
                total_parceiro,
                margem_reais,
                desvio
            };

            dadosParaExcel.totais.orcamento += total_orcado;
            dadosParaExcel.totais.parceiro += total_parceiro;
            dadosParaExcel.totais.margem += margem_reais;
            dadosParaExcel.totais.desvio += desvio;
        }
    }

    exportarComoExcelHTML(dadosParaExcel);
}

function calcularLpuParceiro() {
    const margemPercentual = Number(document.getElementById('margem_lpu').value) / 100;

    let calculos = {
        principais: { orcamento: 0, parceiro: 0, margem: 0, desvio: 0 },
        adicionais: { parceiro: 0, desvio: 0 },
        totais: { orcamento: 0, parceiro: 0, margem: 0, desvioFinal: 0 }
    };

    let trs = document.querySelectorAll('#bodyTabela tr');

    for (tr of trs) {
        let tds = tr.querySelectorAll('td');
        if (tds.length < 11) continue;

        let inputParceiro = tds[8].querySelector('input');
        let labelDesvio = tds[10].querySelector('label');
        if (!inputParceiro || !labelDesvio) continue;

        let quantidade = conversor(tds[3].textContent);
        let valorParceiro = Number(inputParceiro.value) || 0;

        let totalParceiro = quantidade * valorParceiro;
        let totalOrcado = conversor(tds[5].textContent);
        let margemLinha = totalOrcado * margemPercentual;
        let desvioLinha = margemLinha - totalParceiro;

        if (tr.classList.contains('item-adicional')) {
            calculos.adicionais.parceiro += totalParceiro;
            calculos.adicionais.desvio -= totalParceiro;

            labelDesvio.textContent = dinheiro(totalParceiro * (-1));
            labelDesvio.style.backgroundColor = '#B12425';

            labelDesvio.className = 'labelAprovacao';
            tds[7].textContent = dinheiro(0);
        } else {
            calculos.principais.orcamento += totalOrcado;
            calculos.principais.parceiro += totalParceiro;
            calculos.principais.margem += margemLinha;
            calculos.principais.desvio += desvioLinha;
            labelDesvio.style.backgroundColor = desvioLinha >= 0 ? 'green' : '#B12425';
            labelDesvio.textContent = dinheiro(desvioLinha);
            tds[7].textContent = dinheiro(margemLinha);
        }

        tds[9].textContent = dinheiro(totalParceiro);
    }

    calculos.totais.orcamento = calculos.principais.orcamento;
    calculos.totais.parceiro = calculos.principais.parceiro + calculos.adicionais.parceiro;
    calculos.totais.margem = calculos.principais.margem;
    calculos.totais.desvioFinal = calculos.principais.margem - calculos.totais.parceiro;

    document.getElementById('totalOrcamento').textContent = dinheiro(calculos.totais.orcamento);
    document.getElementById('totalParceiro').textContent = dinheiro(calculos.totais.parceiro);
    document.getElementById('totalMargem').textContent = dinheiro(calculos.totais.margem);

    let totalDesvioElement = document.getElementById('totalDesvio');
    totalDesvioElement.textContent = dinheiro(calculos.totais.desvioFinal);
    totalDesvioElement.style.backgroundColor = calculos.totais.desvioFinal >= 0 ? 'green' : '#B12425';
}


async function salvarLpuParceiro() {
    overlayAguarde();
    let chave = gerar_id_5_digitos();

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dados_orcamentos[id_orcam];
    let margem = Number(document.getElementById('margem_lpu').value);
    let omieTecnico = document.getElementById('tecnico').nextElementSibling.value

    let novo_lancamento = {
        status: 'LPU PARCEIRO',
        data: data_atual('completa'),
        executor: acesso.usuario,
        margem_percentual: margem,
        tecnicoLpu: omieTecnico,
        itens: {},
        itens_adicionais: [],
        totais: {
            orcamento: 0,
            parceiro: 0,
            desvio: 0,
            margem: 0
        }
    };

    let trs = document.querySelectorAll('#bodyTabela tr');

    for (let tr of trs) {
        let tds = tr.querySelectorAll('td');
        if (tds.length < 11) {
            console.warn('Linha ignorada por ter menos de 11 células:', tr);
            continue;
        }

        let isAdicional = tr.classList.contains('item-adicional');
        let codigo = tds[0].textContent.trim();
        let descricao = tr.querySelector('textarea')?.value?.trim() || extrairTextoOuInput(tds[1]);
        let unidade = extrairTextoOuInput(tds[2]);
        let qtde = conversor(tds[3].textContent.trim());
        let valor_orcado = conversor(tds[4].textContent.trim());
        let total_orcado = conversor(tds[5].textContent.trim());
        let imposto = conversor(tds[6].textContent.trim());

        let valor_parceiro_unitario = Number(tds[8].querySelector('input')?.value || 0);
        let total_parceiro = qtde * valor_parceiro_unitario;
        let margem_reais = total_orcado * (margem / 100);
        let desvio = margem_reais - total_parceiro;

        if (isAdicional) {
            // Adicionais não precisam de todos os campos
            novo_lancamento.itens_adicionais = novo_lancamento.itens_adicionais || [];
            novo_lancamento.itens_adicionais.push({
                codigo,
                descricao,
                unidade,
                qtde,
                valor_parceiro_unitario,
                total_parceiro
            });
        } else {
            // Itens principais
            novo_lancamento.itens[codigo] = {
                descricao,
                unidade,
                qtde,
                valor_orcado,
                total_orcado,
                imposto,
                valor_parceiro_unitario,
                total_parceiro,
                margem_reais,
                desvio
            };

            novo_lancamento.totais.orcamento += total_orcado;
            novo_lancamento.totais.parceiro += total_parceiro;
            novo_lancamento.totais.margem += margem_reais;
            novo_lancamento.totais.desvio += desvio;
        }
    }

    orcamento.status = orcamento.status || {};
    orcamento.status.historico = orcamento.status.historico || {};
    orcamento.status.historico[chave] = novo_lancamento;
    dados_orcamentos[id_orcam] = orcamento;

    await inserirDados(dados_orcamentos, 'dados_orcamentos');
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, novo_lancamento);

    remover_popup();
    await abrirEsquema();

}


function exportarComoExcelHTML(dados) {
    let html = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
        <meta charset="UTF-8">
        <style>
            .numero {
                mso-number-format:"0";
                text-align: right;
            }
            .texto {
                mso-number-format:"\\@";
                text-align: left;
            }
            .moeda {
                mso-number-format:"R$ 0.00";
                text-align: right;
            }
            .cabecalho {
                background-color: rgb(0, 138, 0);
                color: white;
                font-weight: bold;
                text-align: center;
            }
            .total {
                font-weight: bold;
                background-color: #e9ecef;
            }
            td, th {
                border: 0.5pt solid #000000;
                padding: 5px;
            }
            table {
                border-collapse: collapse;
            }
        </style>
    </head>
    <body>
        <div style="text-align: center; margin-bottom: 20px">
            <h2>LPU PARCEIRO - GCS SISTEMAS</h2>
        </div>
        
        <table>
            <tr>
                <td class="texto"><strong>Data:</strong></td>
                <td class="texto">${dados.data}</td>
                <td class="texto"><strong>Analista:</strong></td>
                <td class="texto">${dados.analista}</td>
            </tr>
            <tr>
                <td class="texto"><strong>Cliente:</strong></td>
                <td class="texto">${dados.cliente}</td>
                <td class="texto"><strong>CNPJ:</strong></td>
                <td class="texto">${dados.cnpj}</td>
            </tr>
            <tr>
                <td class="texto"><strong>Endereço:</strong></td>
                <td class="texto">${dados.endereco}</td>
                <td class="texto"><strong>Cidade/Estado:</strong></td>
                <td class="texto">${dados.cidade} - ${dados.estado}</td>
            </tr>
            <tr>
                <td class="texto"><strong>Margem:</strong></td>
                <td class="texto">${dados.margem_percentual}%</td>
                <td class="texto"><strong>Técnico:</strong></td>
                <td class="texto">${dados.tecnicoLpu}</td>
            </tr>
        </table>

        <br>

        <table>
            <thead>
                <tr>
                    <th class="cabecalho">Código</th>
                    <th class="cabecalho">Descrição</th>
                    <th class="cabecalho">Unidade</th>
                    <th class="cabecalho">Quantidade</th>
                    <th class="cabecalho">Valor Unitário</th>
                    <th class="cabecalho">Total</th>
                </tr>
            </thead>
            <tbody>`;

    let linha = 9; // Começa após o cabeçalho
    for (let [codigo, item] of Object.entries(dados.itens)) {
        html += `
            <tr>
                <td class="texto">${codigo}</td>
                <td class="texto">${item.descricao}</td>
                <td class="texto" style="text-align: center">${item.unidade}</td>
                <td class="numero">${item.qtde}</td>
                <td class="moeda">${item.valor_parceiro_unitario}</td>
                <td class="moeda">
                    =MULT(D${linha};E${linha})
                </td>
            </tr>`;
        linha++;
    }

    if (dados.itens_adicionais?.length > 0) {
        html += `
            <tr>
                <td colspan="6" style="text-align: center; font-weight: bold; background-color: #e9ecef">
                    SERVIÇOS ADICIONAIS
                </td>
            </tr>`;

        for (let item of dados.itens_adicionais) {
            html += `
                <tr>
                    <td class="texto">${item.codigo || ''}</td>
                    <td class="texto">${item.descricao}</td>
                    <td class="texto" style="text-align: center">${item.unidade}</td>
                    <td class="numero">${item.qtde}</td>
                    <td class="moeda">${item.valor_parceiro_unitario}</td>
                    <td class="moeda">
                        =MULT(D${linha};E${linha})
                    </td>
                </tr>`;
            linha++;
        }
    }

    html += `
            <tr><td colspan="6" style="border: none; height: 20px"></td></tr>
            <tr class="total">
                <td colspan="5" style="text-align: right"><strong>TOTAL DO ORÇAMENTO VENDIDO:</strong></td>
                <td class="formula">
                    =SOMA(F9:F${linha - 1})
                </td>
            </tr>
        </tbody>
    </table>
    </body>
    </html>`;

    let blob = new Blob([html], { type: "application/vnd.ms-excel" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = `LPU_Parceiro_${dados.tecnicoLpu || 'tecnico'}.xls`;
    a.click();
    URL.revokeObjectURL(url);
}

async function salvarItensAdicionais(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dados_orcamentos[id_orcam];
    if (!orcamento || !orcamento.status || !orcamento.status.historico || !orcamento.status.historico[chave]) {
        console.error('Histórico não encontrado para chave:', chave);
        return;
    }

    let itens_adicionais = [];
    const linhasAdicionais = document.querySelectorAll('.item-adicional');

    linhasAdicionais.forEach(linha => {
        const descricao = linha.querySelector('textarea')?.value || '';
        const codigo = linha.querySelector('.codigo-item')?.textContent || '';
        const unidade = linha.cells[2]?.textContent || '';
        const quantidade = parseFloat(linha.querySelector('.quantidade')?.innerText.replace(',', '.') || 0);
        const valorUnitario = parseFloat(linha.querySelector('.input-lpuparceiro')?.value || 0);
        const total = quantidade * valorUnitario;

        if (descricao) {
            itens_adicionais.push({
                codigo: codigo,
                descricao: descricao,
                unidade: unidade,
                qtde: quantidade,
                valor_parceiro_unitario: valorUnitario,
                total_parceiro: total
            });
        }
    });

    // Salvar os itens adicionais no mesmo lançamento do histórico
    orcamento.status.historico[chave].itens_adicionais = itens_adicionais;

    // Atualizar o objeto de dados
    dados_orcamentos[id_orcam] = orcamento;
    await inserirDados(dados_orcamentos, 'dados_orcamentos');
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/itens_adicionais`, itens_adicionais);
}

function extrairTextoOuInput(td) {
    if (!td) return ''
    const input = td.querySelector('input');
    return input ? input.value.trim() : td.textContent.trim();
}

async function detalharLpuParceiro(chave) {
    let dadosOrcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dadosOrcamentos[id_orcam];
    let dadosLpu = orcamento.status.historico[chave];


    let modelo = () => {
        return `
            <div style="display: flex; flex-direction: column">
                <label>${valor1}</label>
                <label>${valor2}</label>
            </div>
        `;
    }

    let stringHtml = (titulo, valor) => {
        return `
        <div style="display: flex; justifty-content: start; align-items: center; gap: 5px;">
        <label><strong>${titulo}</strong>:</label>
        <label>${valor}</label>
        </div>
        `
    }
    let dadosEmpresa = orcamento.dados_orcam
    let margemLPU = dadosLpu.margem_percentual
    let tecnicoLPU = dadosLpu.tecnicoLpu

    let linhas = Object.values(dadosLpu.itens).map(item => `

        <tr>
            <td>${item.descricao}</td>
            <td>${item.qtde}</td>
            <td>${dinheiro(item.valor_parceiro_unitario)}</td>
            <td>${dinheiro(item.total_parceiro)}</td>
        </tr>
    `);


    if (dadosLpu.itens_adicionais && dadosLpu.itens_adicionais.length > 0) {
        linhas.push(`
            <tr>
                <td colspan="4" style="text-align: center; font-weight: bold; padding-top: 10px;">
                    SERVIÇOS ADICIONAIS
                </td>
            </tr>
        `);

        linhas.push(...dadosLpu.itens_adicionais.map(item => `
            <tr>
                <td>${item.descricao}</td>
                <td>${item.qtde}</td>
                <td>${dinheiro(item.valor_parceiro_unitario)}</td>
                <td>${dinheiro(item.total_parceiro)}</td>
            </tr>
        `));
    }

    let totalOrcamento = 0;
    let totalMargem = 0;
    let totalParceiro = 0

    for (const item of Object.values(dadosLpu.itens)) {
        totalOrcamento += item.total_orcado || 0;
        totalMargem += item.margem_reais || 0;
        totalParceiro += item.total_parceiro
    }

    for (const item of dadosLpu.itens_adicionais || []) {
        totalParceiro += item.total_parceiro || 0
    }

    linhas.push(`
        <tr><td colspan="4" style="padding-top: 20px;"></td></tr>
        <tr>
            <td colspan="3" style="text-align: right; font-weight: bold; background-color: #eaeaea">TOTAL DO ORÇAMENTO VENDIDO:</td>
            <td>${dinheiro(totalOrcamento)}</td>
        </tr>
        <tr>
            <td colspan="3" style="text-align: right; font-weight: bold; background-color: #eaeaea">TOTAL MARGEM DO ORÇAMENTO DISPONÍVEL:</td>
            <td>${dinheiro(totalMargem)}</td>
        </tr>
        <tr>
            <td colspan="3" style="text-align: right; font-weight: bold; background-color: #eaeaea"><strong>TOTAL LPU PARCEIRO:</strong></td>
            <td>${dinheiro(totalParceiro)}</td>
        </tr>
    `);

    // Monta a tabela com as linhas finais
    let tabela = `
        <table class="tabela">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Quantidade</th>
                    <th>Valor Unitário</th>
                    <th>Total Parceiro</th>
                </tr>
            </thead>
            <tbody>
                ${linhas.join('')}
            </tbody>
        </table>
    `;

    let cabecalhoInfo = `
        <div style="display: flex; justify-content: space-between">
            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;">
                ${stringHtml('Data', data_atual('completa'))}
                ${stringHtml('Analista', acesso?.nome_completo || '')}
                ${stringHtml('Cliente', dadosEmpresa?.cliente_selecionado || '')}
                ${stringHtml('CNPJ', dadosEmpresa?.cnpj || '')}
                ${stringHtml('Endereço', dadosEmpresa?.endereco || '')}
                ${stringHtml('Cidade', dadosEmpresa?.cidade || '')}
                ${stringHtml('Estado', dadosEmpresa?.estado || '')}
                ${stringHtml('Margem', margemLPU)}
                ${stringHtml('Técnico', tecnicoLPU || '')}
            </div>
            <div>
                <button onclick="solicitarPagamentoLPU('${tecnicoLPU}', '${dadosEmpresa?.cliente_selecionado || ''}')"><strong>Solicitar Pagamento</strong></button>
                <button id="btnGerarPdf"><strong>Gerar PDF</strong></button>
            </div>
        </div>
    `;

    let acumulado = `
        ${cabecalhoInfo}
        ${tabela}
    `

    popup(acumulado, 'Detalhamento Itens Parceiro', true);

    document.getElementById('btnGerarPdf').addEventListener('click', () => {
        gerarPdfParceiro({
            tabela: `
                <div class="header">
                    <img src="imagens/BG.png" alt="GCS Logo">
                </div>
                <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;">
                    ${stringHtml('Data', data_atual('completa'))}
                    ${stringHtml('Analista', acesso?.nome_completo || '')}
                    ${stringHtml('Cliente', dadosEmpresa?.cliente_selecionado || '')}
                    ${stringHtml('CNPJ', dadosEmpresa?.cnpj || '')}
                    ${stringHtml('Endereço', dadosEmpresa?.endereco || '')}
                    ${stringHtml('Cidade', dadosEmpresa?.cidade || '')}
                    ${stringHtml('Estado', dadosEmpresa?.estado || '')}
                    ${stringHtml('Margem', margemLPU)}
                    ${stringHtml('Técnico', tecnicoLPU || '')}
                </div>
                ${tabela}
            `,
            cnpj: dadosEmpresa?.cnpj || ''
        });
    });
}

function solicitarPagamentoLPU(tecnico, cliente) {
    localStorage.setItem('pagamentoLPU', JSON.stringify({
        tecnico: tecnico,
        cliente: cliente,
        abrirModal: true
    }))

    window.location.href = 'pagamentos.html';
}

async function gerarPdfParceiro({ tabela, cnpj }) {
    let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>
            @page {
                size: A4;
                margin: 1cm;
            }
            body {
                font-family: 'Poppins', sans-serif;
                margin: 0;
                padding: 20px;
                width: 21cm;
                min-height: 29.7cm;
            }
            .header {
                width: 100%;
                text-align: center;
                margin-bottom: 20px;
                background-color: #151749;
                padding: 10px 0;
                border-radius: 5px;
            }
            .header img {
                height: 70px;
            }
            .tabela {
                width: 100%;
                border-collapse: collapse;
                border-radius: 5px;
                overflow: hidden;
                margin-bottom: 20px;
            }
            .tabela th {
                background-color: rgb(0, 138, 0);
                color: white;
                padding: 10px;
                text-align: left;
                font-weight: bold;
            }
            .tabela th, .tabela td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            .tabela td {
                background-color: #ffffff;
            }
            .tabela tr:nth-child(even) td {
                background-color: #f9f9f9;
            }
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .tabela th {
                    background-color: rgb(0, 138, 0) !important;
                    color: white !important;
                }
                .header {
                    background-color: #151749 !important;
                }
            }
            </style>
        </head>
        <body>
            ${tabela}
        </body>
        </html>`
        ;

    await gerar_pdf_online(htmlContent, `LPU_PACEIRO_${cnpj}`);
}

function adicionarItemAdicional(dados = {}) {
    const bodyTabela = document.getElementById('bodyTabela');
    const idAleatoria = gerar_id_5_digitos();

    // Cálculo automático se os dados não foram salvos
    const qtde = Number(dados.qtde || 0);
    const valorUnit = Number(dados.valor_orcamento || dados.valor_parceiro_unitario || 0);
    const margem = Number(document.getElementById('margem_lpu')?.value || 0) / 100;

    const totalOrcado = valorUnit * qtde;
    const impostos = totalOrcado * 0.2;
    const valorComMargem = totalOrcado + (totalOrcado * margem);
    const totalParceiro = Number(dados.valor_parceiro_unitario || 0) * qtde;
    const desvio = totalParceiro - valorComMargem;

    // Adiciona label "SERVIÇOS ADICIONAIS" se não existir
    if (!document.getElementById('labelItensAdicionais')) {
        const labelRow = document.createElement('tr');
        labelRow.id = 'labelItensAdicionais';
        labelRow.innerHTML = `
            <td colspan="11" style="text-align: center; font-weight: bold; padding-top: 15px;">
                SERVIÇOS ADICIONAIS
            </td>
        `;
        bodyTabela.appendChild(labelRow);
    }

    const novaLinha = document.createElement('tr');
    novaLinha.classList.add('item-adicional');

    novaLinha.innerHTML = `
        <td style="position: relative;">
            <div class="codigo-item" style="padding-right: 20px;">${dados.codigo || ''}</div>
            <img src="imagens/cancel.png" 
                onclick="removerItemAdicional(this)" 
                style="position: absolute; top: 2px; right: 4px; cursor: pointer; width: 1.5vw;">
        </td>
        <td>
            <textarea id="${idAleatoria}" style="border: none;" oninput="sugestoesParceiro(this, 'composicoes')">${dados.descricao || ''}</textarea>
            <input style="display: none;">
        </td>
        <td contenteditable="true">${dados.unidade || ''}</td>
        <td class="quantidade" contenteditable="true" oninput="atualizarTotalOrcado(this)">${dados.qtde || ''}</td>
        <td>${dinheiro(dados.valor_orcamento ?? valorUnit)}</td>
        <td>${dinheiro(dados.total_orcado ?? totalOrcado)}</td>
        <td>${dinheiro(dados.impostos ?? impostos)}</td>
        <td>${dinheiro(dados.margem ?? (valorComMargem - totalOrcado))}</td>
        <td style="padding: 0; white-space: nowrap; height: 100%;">
            <div style="display: flex; align-items: stretch; gap: 4px; width: 100%; height: 100%; box-sizing: border-box; padding: 2px 5px;">
                <input
                    oninput="calcularLpuParceiro()" 
                    type="number" 
                    class="campoRequisicao" 
                    step="0.01"
                    value="${dados.valor_parceiro_unitario || ''}">
            </div>
        </td>
        <td>${dinheiro(dados.total_parceiro ?? totalParceiro)}</td>
        <td><label class="labelAprovacao">${dinheiro(dados.desvio ?? desvio)}</label></td>
    `;

    bodyTabela.appendChild(novaLinha);

    if (dados?.descricao && dados?.codigo && dados?.valor_orcamento && dados?.unidade) {
        const textarea = novaLinha.querySelector('textarea');
        definirCampoParceiro(
            { textContent: dados.descricao },
            textarea.id,
            dados.codigo,
            dados.unidade,
            dados.valor_orcamento
        );
    }

    calcularLpuParceiro();
}

function removerItemAdicional(botao) {

    botao.closest('tr').remove()
    calcularLpuParceiro()

}

function atualizarTotalOrcado(tdQuantidade) {
    const margem = Number(document.getElementById('margem_lpu').value || 0) / 100
    const tr = tdQuantidade.closest('tr')
    const tds = tr.querySelectorAll('td')

    const quantidade = conversor(tds[3].textContent)
    const valorUnitario = conversor(tds[4].textContent)
    const totalOrcado = isNaN(quantidade) * isNaN(valorUnitario) ? 0 : quantidade * valorUnitario
    const imposto = totalOrcado * 0.2;
    const margemRS = totalOrcado * margem

    tds[5].textContent = dinheiro(totalOrcado)
    tds[6].textContent = dinheiro(imposto)
    tds[7].textContent = dinheiro(margemRS)

    calcularLpuParceiro();
}

function atualizarValorParceiro(input) {
    const tr = input.closest('tr');
    const tds = tr.querySelectorAll('td')

    const unitarioParceiro = Number(input.value);
    const quantidade = conversor(tds[3]?.textContent);
    const totalParceiro = isNaN(unitarioParceiro) || isNaN(quantidade) ? 0 : unitarioParceiro * quantidade

    tds[9].textContent = dinheiro(totalParceiro)

    const margemRS = conversor(tds[7]?.textContent);
    const desvio = margemRS - totalParceiro

    const labelDesvio = tds[10].querySelector('label')
    labelDesvio.textContent = dinheiro(desvio)
    labelDesvio.style.backgroundColor = desvio > 0 ? 'green' : '#B12425';

    calcularLpuParceiro()
}

async function sugestoesParceiro(textarea, base) {

    let baseOrcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = baseOrcamentos[id_orcam]
    let lpu = String(orcamento.lpu_ativa).toLocaleLowerCase()

    let query = String(textarea.innerText || textarea.value).toUpperCase()

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    if (query === '') {
        let campo = textarea.id
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
        let info = '';
        let codBases;
        let unidade = ''
        let valor = ''

        if (base == 'clientes') {
            codBases = item.omie
            info = String(item.nome)

        } else if (base == 'composicoes') {
            if (item.tipo != 'SERVIÇO') continue
            codBases = item.codigo
            info = String(item.descricao)
            unidade = item.unidade
            let historico = item?.[lpu]?.historico
            let ativo = item?.[lpu]?.ativo
            valor = historico?.[ativo]?.valor || 0
        }

        if (info.includes(query)) {
            opcoes += `
                <div onclick="definirCampoParceiro(this, '${textarea.id}', '${codBases}', '${unidade}', ${valor})" class="autocomplete-item" style="font-size: 0.8vw;">${info}</div>
            `
        }

    }


    let posicao = textarea.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let div = `
    <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
        ${opcoes}
    </div>`

    document.body.insertAdjacentHTML('beforeend', div)

}

async function definirCampoParceiro(elemento, idAleatoria, codBases, unidade, valor) {
    let campo = document.getElementById(idAleatoria);

    if (idAleatoria === 'tecnico') {
        campo.nextElementSibling.value = codBases;
    } else {
        let linha = campo.closest('tr');
        let celulaCodigo = campo.parentElement.previousElementSibling;
        let celulaUnidade = campo.parentElement.nextElementSibling;
        let celulaValorUnitario = celulaUnidade.nextElementSibling?.nextElementSibling;
        let celulaTotal = celulaValorUnitario?.nextElementSibling;


        let divCodigo = celulaCodigo.querySelector('.codigo-item');
        if (divCodigo) {
            divCodigo.textContent = codBases;
        } else {
            celulaCodigo.textContent = codBases; // fallback
        }


        celulaUnidade.textContent = unidade;
        celulaValorUnitario.textContent = dinheiro(valor);


        let quantidadeCelula = linha.querySelector('.quantidade');
        let quantidade = parseFloat(quantidadeCelula?.innerText.replace(',', '.') || 0);
        let total = quantidade * valor;
        celulaTotal.textContent = dinheiro(total);
    }

    // Atualiza o valor do campo selecionado
    if ('value' in campo) {
        campo.value = elemento.textContent;
    } else {
        campo.innerText = elemento.textContent;
    }


    let div_sugestoes = document.getElementById('div_sugestoes');
    if (div_sugestoes) div_sugestoes.remove();

    // Evita que o oninput seja disparado novamente logo após clicar
    campo.blur();
}

async function editarLpuParceiro(chave) {

}

function preencherDadosBasicos(dados) {
    const campos = {
        'margem_lpu': dados.margem_percentual || 35,
        'tecnico': dados.tecnicoLpu || ''
    };

    Object.entries(campos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = valor;
    });
}

function preencherItensPrincipais(itens) {
    const linhas = document.querySelectorAll('#bodyTabela tr');
    linhas.forEach(linha => {
        const codigo = linha.querySelector('td')?.textContent?.trim();
        if (!codigo) return;

        const item = itens[codigo];
        if (!item) return;

        const inputValor = linha.querySelector('.input-lpuparceiro');
        if (inputValor) inputValor.value = item.valor_parceiro_unitario;
    })
}

function preencherItensAdicionais(itens = []) {
    itens.forEach(item => {
        adicionarItemAdicional({
            codigo: item.codigo,
            descricao: item.descricao,
            unidade: item.unidade,
            qtde: item.qtde,
            valor_parceiro_unitario: item.valor_parceiro_unitario,
        });
    });
}